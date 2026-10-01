/**
 * The solved-captcha token the NEXT owner-web sign-in attempt carries
 * (2026-10-01). The sign-in screen stores it after the mosaic is solved; the
 * web's `apiLogin` sends it once and forgets it — the server spends it either
 * way, so it is never sent twice.
 */
let token: string | null = null;

export const loginChallenge = {
  set: (value: string): void => { token = value; },
  take: (): string | null => {
    const value = token;
    token = null;
    return value;
  },
};
