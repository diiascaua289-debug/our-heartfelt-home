const SUPABASE_URL = "https://nybuomuvxpppxvpanjlt.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_7a39yL1brl5l9wxpqVFv-Q_2Sthv8ow";
const ADMIN_API_URL = `${SUPABASE_URL}/functions/v1/admin-api`;

export type AdminTable =
  | "admin_settings"
  | "pages"
  | "sections"
  | "content_blocks"
  | "buttons"
  | "media"
  | "forms"
  | "leads"
  | "whatsapp_settings"
  | "visual_identity"
  | "tracking_integrations"
  | "analytics_events"
  | "published_versions"
  | "seo_settings"
  | "audit_logs";

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  token?: string | null;
  body?: unknown;
  query?: string;
};

async function request(path: string, options: RequestOptions = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (options.token) headers["x-admin-token"] = options.token;

  const response = await fetch(`${ADMIN_API_URL}${path}${options.query ?? ""}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || "Não foi possível completar a ação.");
  }
  return payload;
}

export function getStoredAdminToken() {
  return window.sessionStorage.getItem("admin-session-token");
}

export function storeAdminToken(token: string) {
  window.sessionStorage.setItem("admin-session-token", token);
}

export function clearAdminToken() {
  window.sessionStorage.removeItem("admin-session-token");
}

export async function loginAdmin(password: string) {
  return request("/login", {
    method: "POST",
    body: {
      password,
      attemptKey: window.navigator.userAgent.slice(0, 120),
    },
  });
}

export async function adminTable<T>(table: AdminTable, options: RequestOptions = {}) {
  return request(`/table/${table}`, options) as Promise<T>;
}

export async function uploadAdminMedia<T>(mediaId: string, file: File, token: string) {
  const response = await fetch(`${ADMIN_API_URL}/media-upload/${encodeURIComponent(mediaId)}?filename=${encodeURIComponent(file.name)}`, {
    method: "POST",
    headers: {
      "x-admin-token": token,
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || "Não foi possível enviar o arquivo.");
  }
  return payload as T;
}

export async function uploadNewAdminImage<T>(file: File, token: string) {
  const response = await fetch(`${ADMIN_API_URL}/media-library-upload?filename=${encodeURIComponent(file.name)}`, {
    method: "POST",
    headers: {
      "x-admin-token": token,
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || "Não foi possível enviar a imagem.");
  }
  return payload as T;
}

export async function adminRpc<T>(name: "admin_change_password" | "admin_save_recovery_email", token: string, body: unknown) {
  return request(`/rpc/${name}`, {
    method: "POST",
    token,
    body,
  }) as Promise<T>;
}

export async function publicInsert(table: "leads" | "analytics_events", body: unknown) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) throw new Error("Falha ao registrar dado público.");
}
