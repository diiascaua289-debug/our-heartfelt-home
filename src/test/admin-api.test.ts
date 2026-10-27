import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ADMIN_SESSION_EXPIRED_EVENT,
  adminTable,
  getStoredAdminToken,
  loginAdmin,
  uploadNewAdminMedia,
} from "@/lib/adminApi";

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("admin session fallback", () => {
  it("migrates the legacy session token so it works in new tabs", () => {
    window.sessionStorage.setItem("admin-session-token", "legacy-token");

    expect(getStoredAdminToken()).toBe("legacy-token");
    expect(window.localStorage.getItem("admin-session-token")).toBe("legacy-token");
  });

  it("uses a stable browser-specific key for login attempts", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: false, error: "invalid_password" }),
    } as Response));
    window.fetch = fetchMock;

    await loginAdmin("wrong-one");
    await loginAdmin("wrong-two");

    const firstBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    const secondBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(firstBody.attemptKey).toBeTruthy();
    expect(firstBody.attemptKey).toBe(secondBody.attemptKey);
    expect(firstBody.attemptKey).not.toBe(window.navigator.userAgent.slice(0, 120));
  });

  it("clears an expired token and asks the panel to return to login", async () => {
    window.localStorage.setItem("admin-session-token", "expired-token");
    window.fetch = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: "unauthorized" }),
    } as Response));
    const expired = vi.fn();
    window.addEventListener(ADMIN_SESSION_EXPIRED_EVENT, expired);

    await expect(adminTable("sections", { token: "expired-token" })).rejects.toMatchObject({ status: 401 });

    expect(window.localStorage.getItem("admin-session-token")).toBeNull();
    expect(expired).toHaveBeenCalledOnce();
    window.removeEventListener(ADMIN_SESSION_EXPIRED_EVENT, expired);
  });

  it("uploads a new image or video with its display name", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => ({ id: "new-media", media_type: "video" }),
    } as Response));
    window.fetch = fetchMock;
    const file = new File(["video"], "deserto.mp4", { type: "video/mp4" });

    await uploadNewAdminMedia(file, "Deserto ao entardecer", "valid-token");

    const requestUrl = String(fetchMock.mock.calls[0][0]);
    expect(requestUrl).toContain("/media-add-upload?");
    expect(requestUrl).toContain("label=Deserto+ao+entardecer");
    expect(fetchMock.mock.calls[0][1]?.body).toBe(file);
  });
});
