const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-token",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const adminTables = new Set([
  "admin_settings",
  "pages",
  "sections",
  "content_blocks",
  "buttons",
  "media",
  "forms",
  "leads",
  "whatsapp_settings",
  "visual_identity",
  "tracking_integrations",
  "analytics_events",
  "published_versions",
  "seo_settings",
  "audit_logs",
]);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function routeParts(req: Request) {
  const parts = new URL(req.url).pathname.split("/").filter(Boolean);
  return parts[0] === "admin-api" ? parts.slice(1) : parts;
}

async function supabaseFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("apikey", SERVICE_ROLE_KEY);
  headers.set("Authorization", `Bearer ${SERVICE_ROLE_KEY}`);
  if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");

  return fetch(`${SUPABASE_URL}${path}`, { ...init, headers });
}

async function readJson(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

async function validateSession(req: Request) {
  const token = req.headers.get("x-admin-token") || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!token) return false;

  const res = await supabaseFetch("/rest/v1/rpc/admin_validate_session", {
    method: "POST",
    body: JSON.stringify({ p_token: token }),
  });

  if (!res.ok) return false;
  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: "server_not_configured" }, 500);

  const url = new URL(req.url);
  const parts = routeParts(req);
  const resource = parts[0] || "";
  const name = parts[1] || "";

  if (resource === "login" && req.method === "POST") {
    const body = await readJson(req);
    const res = await supabaseFetch("/rest/v1/rpc/admin_login", {
      method: "POST",
      body: JSON.stringify({
        p_password: body.password ?? "",
        p_attempt_key: body.attemptKey ?? req.headers.get("x-forwarded-for") ?? "default",
        p_user_agent: req.headers.get("user-agent") ?? null,
      }),
    });
    return json(await res.json(), res.status);
  }

  if (resource === "forgot-password") {
    return json({ ok: false, error: "email_service_not_configured" }, 501);
  }

  const ok = await validateSession(req);
  if (!ok) return json({ error: "unauthorized" }, 401);

  if (resource === "rpc" && req.method === "POST") {
    const allowedRpc = new Set(["admin_change_password", "admin_save_recovery_email"]);
    if (!allowedRpc.has(name)) return json({ error: "rpc_not_allowed" }, 403);
    const body = await readJson(req);
    const token = req.headers.get("x-admin-token") || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
    const payload = name === "admin_change_password"
      ? { p_session_token: token, p_current_password: body.currentPassword ?? "", p_new_password: body.newPassword ?? "" }
      : { p_session_token: token, p_recovery_email: body.recoveryEmail ?? "" };
    const res = await supabaseFetch(`/rest/v1/rpc/${name}`, { method: "POST", body: JSON.stringify(payload) });
    return json(await res.json(), res.status);
  }

  if (resource === "media-upload" && req.method === "POST") {
    const mediaId = name;
    const contentType = (req.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const contentLength = Number(req.headers.get("content-length") || 0);
    const fileName = url.searchParams.get("filename") || "arquivo";
    const allowedTypes = new Set([
      "image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml",
      "video/mp4", "video/webm",
    ]);

    if (!mediaId || !allowedTypes.has(contentType)) return json({ error: "Tipo de arquivo não permitido." }, 400);
    if (!req.body || contentLength <= 0) return json({ error: "Arquivo vazio." }, 400);
    if (contentLength > 50 * 1024 * 1024) return json({ error: "O arquivo deve ter no máximo 50 MB." }, 413);

    const mediaRes = await supabaseFetch(`/rest/v1/media?id=eq.${encodeURIComponent(mediaId)}&select=*`);
    if (!mediaRes.ok) return json({ error: "Não foi possível localizar a mídia." }, mediaRes.status);
    const mediaRows = await mediaRes.json();
    const media = mediaRows[0];
    if (!media) return json({ error: "Mídia não encontrada." }, 404);

    const expectsVideo = media.media_type === "video";
    if ((expectsVideo && !contentType.startsWith("video/")) || (!expectsVideo && !contentType.startsWith("image/"))) {
      return json({ error: expectsVideo ? "Escolha um arquivo de vídeo." : "Escolha um arquivo de imagem." }, 400);
    }

    const extensionByType: Record<string, string> = {
      "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
      "image/svg+xml": "svg", "video/mp4": "mp4", "video/webm": "webm",
    };
    const extension = extensionByType[contentType] || fileName.split(".").pop()?.toLowerCase() || "bin";
    const bucket = media.bucket || "site-media";
    const objectPath = `admin/${media.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const encodedObjectPath = objectPath.split("/").map(encodeURIComponent).join("/");
    const uploadRes = await supabaseFetch(`/storage/v1/object/${encodeURIComponent(bucket)}/${encodedObjectPath}`, {
      method: "POST",
      headers: { "Content-Type": contentType, "x-upsert": "false", "cache-control": "3600" },
      body: req.body,
    });
    if (!uploadRes.ok) {
      const uploadError = await uploadRes.json().catch(() => null);
      return json({ error: uploadError?.message || uploadError?.error || "Não foi possível enviar o arquivo." }, uploadRes.status);
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodedObjectPath}`;
    const metadata = { ...(media.metadata || {}), storage_path: objectPath, original_name: fileName, content_type: contentType, size: contentLength };
    const updateRes = await supabaseFetch(`/rest/v1/media?id=eq.${encodeURIComponent(mediaId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ public_url: publicUrl, metadata, is_active: true }),
    });
    if (!updateRes.ok) return json({ error: "O arquivo foi enviado, mas não foi possível atualizar o site." }, updateRes.status);
    return json((await updateRes.json())[0]);
  }

  if (resource === "media-library-upload" && req.method === "POST") {
    const contentType = (req.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const contentLength = Number(req.headers.get("content-length") || 0);
    const fileName = (url.searchParams.get("filename") || "imagem").slice(0, 200);
    const extensionByType: Record<string, string> = {
      "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
      "image/gif": "gif", "image/svg+xml": "svg",
    };
    const extension = extensionByType[contentType];

    if (!extension) return json({ error: "Escolha uma imagem JPEG, PNG, WebP, GIF ou SVG." }, 400);
    if (!req.body || contentLength <= 0) return json({ error: "Arquivo vazio." }, 400);
    if (contentLength > 50 * 1024 * 1024) return json({ error: "A imagem deve ter no máximo 50 MB." }, 413);

    const bucket = "site-media";
    const objectPath = `admin/uploads/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const encodedObjectPath = objectPath.split("/").map(encodeURIComponent).join("/");
    const uploadRes = await supabaseFetch(`/storage/v1/object/${encodeURIComponent(bucket)}/${encodedObjectPath}`, {
      method: "POST",
      headers: { "Content-Type": contentType, "x-upsert": "false", "cache-control": "3600" },
      body: req.body,
    });
    if (!uploadRes.ok) {
      const uploadError = await uploadRes.json().catch(() => null);
      return json({ error: uploadError?.message || uploadError?.error || "Não foi possível enviar a imagem." }, uploadRes.status);
    }

    return json({
      path: objectPath,
      public_url: `${SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodedObjectPath}`,
      media_type: "image",
      label: fileName,
      alt_text: fileName,
    });
  }

  if (resource !== "table" || !adminTables.has(name)) return json({ error: "not_found" }, 404);

  const query = url.search || "";
  const path = `/rest/v1/${name}${query}`;
  const headers: Record<string, string> = { Prefer: "return=representation" };
  let body: string | undefined;

  if (["POST", "PATCH", "DELETE"].includes(req.method)) {
    body = JSON.stringify(await readJson(req));
  }

  const res = await supabaseFetch(path, { method: req.method, headers, body });
  const text = await res.text();
  return new Response(text || "null", {
    status: res.status,
    headers: { ...corsHeaders, "Content-Type": res.headers.get("Content-Type") || "application/json" },
  });
});
