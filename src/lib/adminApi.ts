const SUPABASE_URL = "https://nybuomuvxpppxvpanjlt.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_7a39yL1brl5l9wxpqVFv-Q_2Sthv8ow";
const ADMIN_API_URL = `${SUPABASE_URL}/functions/v1/admin-api`;
const ADMIN_TOKEN_KEY = "admin-session-token";
const ADMIN_BROWSER_KEY = "admin-browser-id";
export const ADMIN_SESSION_EXPIRED_EVENT = "admin-session-expired";

export class AdminApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code = message) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.code = code;
  }
}

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
    apikey: SUPABASE_PUBLISHABLE_KEY,
  };

  if (options.token) headers["x-admin-token"] = options.token;

  const response = await fetch(`${ADMIN_API_URL}${path}${options.query ?? ""}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const code = String(payload?.error || "request_failed");
    if (response.status === 401 && path !== "/login") expireAdminSession();
    throw new AdminApiError(code, response.status, code);
  }
  return payload;
}

export function getStoredAdminToken() {
  const token = window.localStorage.getItem(ADMIN_TOKEN_KEY) || window.sessionStorage.getItem(ADMIN_TOKEN_KEY);
  if (token && !window.localStorage.getItem(ADMIN_TOKEN_KEY)) window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
  return token;
}

export function storeAdminToken(token: string) {
  window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
  window.sessionStorage.removeItem(ADMIN_TOKEN_KEY);
}

export function clearAdminToken() {
  window.localStorage.removeItem(ADMIN_TOKEN_KEY);
  window.sessionStorage.removeItem(ADMIN_TOKEN_KEY);
}

function expireAdminSession() {
  clearAdminToken();
  window.dispatchEvent(new Event(ADMIN_SESSION_EXPIRED_EVENT));
}

function browserAttemptKey() {
  let browserId = window.localStorage.getItem(ADMIN_BROWSER_KEY);
  if (!browserId) {
    browserId = crypto.randomUUID();
    window.localStorage.setItem(ADMIN_BROWSER_KEY, browserId);
  }
  return browserId;
}

export async function loginAdmin(password: string) {
  return request("/login", {
    method: "POST",
    body: {
      password,
      attemptKey: browserAttemptKey(),
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
      apikey: SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const code = String(payload?.error || "upload_failed");
    if (response.status === 401) expireAdminSession();
    throw new AdminApiError(code, response.status, code);
  }
  return payload as T;
}

export async function uploadNewAdminImage<T>(file: File, token: string) {
  const response = await fetch(`${ADMIN_API_URL}/media-library-upload?filename=${encodeURIComponent(file.name)}`, {
    method: "POST",
    headers: {
      "x-admin-token": token,
      apikey: SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const code = String(payload?.error || "upload_failed");
    if (response.status === 401) expireAdminSession();
    throw new AdminApiError(code, response.status, code);
  }
  return payload as T;
}

export async function uploadNewAdminMedia<T>(file: File, label: string, token: string) {
  const params = new URLSearchParams({ filename: file.name, label });
  const response = await fetch(`${ADMIN_API_URL}/media-add-upload?${params}`, {
    method: "POST",
    headers: {
      "x-admin-token": token,
      apikey: SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const code = String(payload?.error || "upload_failed");
    if (response.status === 401) expireAdminSession();
    throw new AdminApiError(code, response.status, code);
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
