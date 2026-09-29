/**
 * The panel's `@/routes/ResetPassword` for the web (2026-09-29).
 *
 * "Forgot password?" — on the desktop or here — mails a link to
 * `#/reset-password?token=…` on this app. The panel's own screen asks for the
 * token in a text field; a person arriving from the email should never see it.
 * So this one:
 *
 *   - takes the secret from the link once, then drops it from the address
 *     bar and the history entry (it is a password-equivalent for an hour and
 *     must not sit in a shared computer's history or a screenshot);
 *   - asks only for the new password, twice, with the backend's own minimum;
 *   - answers a used, expired or missing link with one way forward: a new one.
 *
 * The backend spends the link, sets the password and signs the account out
 * everywhere, so afterwards the only step is signing in.
 *
 * It depends on no router and no session: main.tsx renders it ON ITS OWN when
 * the app is opened on a reset link — also in a browser that is still signed
 * in, where the panel's signed-in routes would otherwise send the link to the
 * dashboard and lose it. Leaving it therefore reloads into the full app.
 */
import { apiResetPassword } from "@/api/auth";
import { AppConfig } from "@/infrastructure/AppConfig";
import { keyValueStore } from "@/infrastructure/KeyValueStore";
import HudBackdrop from "@/components/login/HudBackdrop";
import Button from "@/components/ui/Button";
import PasswordInput from "@/components/ui/PasswordInput";
import { useLang } from "@/i18n/LanguageContext";
import { useWebText } from "@web/web/i18n";
import { FormEvent, useState } from "react";

/** The backend's rule (PasswordResetRequest: min:8). */
const MIN_LENGTH = 8;

type Outcome = { kind: "done" } | { kind: "failed"; message: string } | null;

export const RESET_ROUTE = "#/reset-password";

/** Is the app being opened on a reset link? */
export const isResetLink = (hash: string = window.location.hash): boolean =>
  hash === RESET_ROUTE || hash.startsWith(`${RESET_ROUTE}?`);

/**
 * The secret from the link, read once; the address bar and this history entry
 * are rewritten without it.
 */
const takeTokenFromLink = (): string => {
  const hash = window.location.hash;
  const query = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  const token = new URLSearchParams(query).get("token") ?? "";
  if (query !== "") window.history.replaceState(window.history.state, "", RESET_ROUTE);
  return token;
};

/** Into the full app, booted fresh so it reads the (now ended) session anew. */
const openApp = (route: "/login" | "/forgot-password") => {
  window.location.replace(`#${route}`);
  window.location.reload();
};

const ResetPassword = () => {
  const { t } = useLang();
  const tw = useWebText();
  const [token] = useState(takeTokenFromLink);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [mismatch, setMismatch] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (pw !== pw2) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    setBusy(true);
    try {
      await apiResetPassword({ token, new_password: pw, new_password_confirmation: pw2 });
      // The server has just ended every session of this account; forget the
      // one this browser holds so the next screen is the sign-in, not a 401.
      await keyValueStore.remove(AppConfig.storageKeys.token);
      await keyValueStore.remove(AppConfig.storageKeys.user);
      setOutcome({ kind: "done" });
    } catch (ex) {
      setOutcome({ kind: "failed", message: ex instanceof Error ? ex.message : t("form.errors.failed") });
    } finally {
      setBusy(false);
    }
  };

  const linkUnusable = token === "" || outcome?.kind === "failed";

  return (
    <div className="login-shell web-login">
      <div className="login-stage">
        <div className="login-brand-wrap">
          <HudBackdrop />
          <h1 className="login-brand">Cyber Place</h1>
        </div>
        <img className="login-logo" src="./logo.png" alt="" />
        <h2 className="login-title">{t("auth.resetTitle")}</h2>

        {outcome?.kind === "done" ? (
          <div className="login-card web-login__card" role="status">
            <p className="web-login__note">{t("reset.successDone")}</p>
            <Button type="button" onClick={() => openApp("/login")}>
              {t("login.title")}
            </Button>
          </div>
        ) : linkUnusable ? (
          <div className="login-card web-login__card">
            <div className="error web-login__error" role="alert">
              {outcome?.kind === "failed" ? outcome.message : tw("web.reset.noLink")}
            </div>
            <Button type="button" onClick={() => openApp("/forgot-password")}>
              {tw("web.reset.newLink")}
            </Button>
            <button type="button" className="login-forgot" onClick={() => openApp("/login")}>
              {t("auth.backToLogin")}
            </button>
          </div>
        ) : (
          <form className="login-card web-login__card" onSubmit={submit}>
            <PasswordInput
              label={t("settings.newPassword")}
              autoComplete="new-password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              minLength={MIN_LENGTH}
              required
              autoFocus
            />
            <PasswordInput
              label={t("settings.confirmPassword")}
              autoComplete="new-password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              minLength={MIN_LENGTH}
              required
            />
            {mismatch && (
              <div className="error web-login__error" role="alert">
                {t("settings.passwordsMismatch")}
              </div>
            )}
            <Button disabled={busy || pw.length < MIN_LENGTH || pw2 === ""}>
              {busy ? t("auth.sending") : t("settings.updatePassword")}
            </Button>
            <p className="web-login__note">{tw("web.reset.everywhere")}</p>
            <button type="button" className="login-forgot" onClick={() => openApp("/login")}>
              {t("auth.backToLogin")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
