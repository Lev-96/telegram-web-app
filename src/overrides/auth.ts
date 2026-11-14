/**
 * The panel's `@/api/auth`, with sign-in and sign-out pointed at the owner-web
 * endpoints. Every other export is the panel's own, re-exported unchanged
 * (explicit exports below take precedence over the star export).
 *
 *   /owner-web/session/login   the desktop's credentials check, then the
 *                              owner's web grant; issues a web-only token
 *   /owner-web/session/logout  deletes THIS token only — the desktop's
 *                              /session/logout deletes every token the user
 *                              has, which would sign the desktop out too;
 *                              first, this phone's push subscription is
 *                              removed (web-push DELETE)
 */
import { request } from "@/api/client";
import { loginChallenge } from "@/auth/loginChallenge";
import { forgetPushOnSignOut } from "@web/web/pwa/webPush";
import type { LoginResult } from "../../vendor/panel/src/api/auth";

export * from "../../vendor/panel/src/api/auth";

interface LoginResponseRaw {
  login: LoginResult["user"];
  token: string;
  messages?: string;
}

export const apiLogin = async (email: string, password: string): Promise<LoginResult> => {
  // A solved mosaic rides along once (the panel's loginChallenge, shared with the desktop).
  const captchaToken = loginChallenge.take();
  const res = await request<LoginResponseRaw>("/owner-web/session/login", {
    method: "POST",
    body: captchaToken ? { email, password, captcha_token: captchaToken } : { email, password },
  });
  return {
    token: res.token,
    user: { id: res.login.id, name: res.login.name, email: res.login.email, role: res.login.role },
  };
};

/**
 * Signing out also disconnects this phone's notifications (2026-11-09), while
 * the token still works: the account's notices must not keep arriving on a
 * phone it left, and the next person turns them on for themselves.
 */
export const apiLogout = async () => {
  await forgetPushOnSignOut();
  return request<{ messages?: string }>("/owner-web/session/logout", { method: "POST" });
};
