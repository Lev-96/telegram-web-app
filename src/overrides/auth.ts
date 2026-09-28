/**
 * The panel's `@/api/auth`, with sign-in and sign-out pointed at the owner-web
 * endpoints. Every other export is the panel's own, re-exported unchanged
 * (explicit exports below take precedence over the star export).
 *
 *   /owner-web/session/login   the desktop's credentials check, then the
 *                              owner's web grant; issues a web-only token
 *   /owner-web/session/logout  deletes THIS token only — the desktop's
 *                              /session/logout deletes every token the user
 *                              has, which would sign the desktop out too
 */
import { request } from "@/api/client";
import type { LoginResult } from "../../vendor/panel/src/api/auth";

export * from "../../vendor/panel/src/api/auth";

interface LoginResponseRaw {
  login: LoginResult["user"];
  token: string;
  messages?: string;
}

export const apiLogin = async (email: string, password: string): Promise<LoginResult> => {
  const res = await request<LoginResponseRaw>("/owner-web/session/login", {
    method: "POST",
    body: { email, password },
  });
  return {
    token: res.token,
    user: { id: res.login.id, name: res.login.name, email: res.login.email, role: res.login.role },
  };
};

export const apiLogout = () => request<{ messages?: string }>("/owner-web/session/logout", { method: "POST" });
