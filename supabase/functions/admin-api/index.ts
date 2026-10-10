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
