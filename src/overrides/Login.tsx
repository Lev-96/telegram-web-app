/**
 * The panel's `@/routes/Login` for the web.
 *
 * Built from the desktop's own sign-in pieces — the WebGL space scene, the HUD
 * ring around the wordmark, the email field that remembers addresses, the
 * password field, the language pills and every `login-*` style — so the web
 * greets an owner exactly as the desktop does — including the card that turns
 * over to "forgot password" (the panel's own ForgotPasswordForm; the link it
 * mails opens this web app's reset screen, 2026-09-29). Two things differ:
 *
 *   - a language picked here is handed to the account that signs in next, so
 *     it is not asked the same question again seconds later;
 *   - inside Telegram there is no password at all: a Telegram session that
 *     ended is renewed by opening the Mini App again, so that is what shows;
 *   - repeated wrong passwords (2026-10-01, the server's StaffLoginGuard):
 *     from the 5th a mosaic for every attempt (the panel's own CaptchaDialog,
 *     shared with the desktop since 2026-10-07), after 10 "reset your
 *     password?", then a lock counted down from the server's own seconds
 *     (the panel's LoginHold) — this screen decides nothing, the server does.
 *
 * The scene is decoration and is treated as such: skipped when the viewer
 * asks for reduced motion, and if WebGL is unavailable it quietly leaves the
 * CSS backdrop, which already looks finished, and never takes the form down.
 */
import { blockingKeyOf } from "@/api/blockingErrors";
import type { ApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { recentEmails } from "@/auth/recentEmails";
import ForgotPasswordForm from "@/components/login/ForgotPasswordForm";
import HudBackdrop from "@/components/login/HudBackdrop";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import PasswordInput from "@/components/ui/PasswordInput";
import SuggestInput from "@/components/ui/SuggestInput";
import { useLang } from "@/i18n/LanguageContext";
import { notePreLoginChoice } from "@/i18n/languagePreference";
import { Lang, LANGUAGES } from "@/i18n/translations";
import { errorCode } from "@web/telegram/telegram";
import { useWebText } from "@web/web/i18n";
import { loginChallenge } from "@/auth/loginChallenge";
import CaptchaDialog from "@/components/login/CaptchaDialog";
import LoginHold, { HoldKind } from "@/components/login/LoginHold";
import { Component, FormEvent, lazy, ReactNode, Suspense, useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// Same split as the desktop: three.js arrives after the form.
const LoginScene = lazy(() => import("@/components/login/LoginScene"));

const LANG_LABEL: Record<string, string> = { en: "ENG", ru: "РУС", am: "ՀԱՅ" };

const inTelegram = () => document.documentElement.dataset.shell === "telegram";

const prefersReducedMotion = () =>
  typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A scene that cannot start (no WebGL, lost context) removes itself. */
class SceneGuard extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Which face of the card is showing. */
type Face = "login" | "forgot";

/** The server holding sign-in back for a while: a lock (423) or the per-minute limit (429). */
interface Hold { kind: HoldKind; seconds: number; startedAt: number }

const retryAfterOf = (err: unknown): number | null => {
  const value = Number((err as { body?: { retry_after?: unknown } } | undefined)?.body?.retry_after);
  return Number.isFinite(value) && value > 0 ? Math.ceil(value) : null;
};

const Login = () => {
  const { login } = useAuth();
  const { t, lang, setLang } = useLang();
  const tw = useWebText();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // The URL decides the face, as on the desktop: #/forgot-password opens the
  // card already turned.
  const face: Face = pathname === "/forgot-password" ? "forgot" : "login";
  const flipTo = (next: Face) => navigate(next === "forgot" ? "/forgot-password" : "/login", { replace: true });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The server's sign-in guard: a mosaic to solve, a reset to offer, a hold to wait out.
  const [captchaOpen, setCaptchaOpen] = useState(false);
  const [offerReset, setOfferReset] = useState(false);
  const [hold, setHold] = useState<Hold | null>(null);
  const [holdOver, setHoldOver] = useState(false);
  const [known, setKnown] = useState<string[]>([]);
  const [motion] = useState(() => !prefersReducedMotion());
  const telegram = inTelegram();

  useEffect(() => {
    if (!telegram) void recentEmails.list().then(setKnown);
  }, [telegram]);

  const pickLang = (code: Lang) => {
    notePreLoginChoice(code);
    setLang(code);
  };

  const forgetEmail = (value: string) => {
    void recentEmails.forget(value).then(() => recentEmails.list().then(setKnown));
  };

  const attempt = async () => {
    setBusy(true);
    setError(null);
    setHoldOver(false);
    try {
      await login(email.trim(), password);
    } catch (err) {
      // Read exactly as the desktop's sign-in reads it: a block by its key; a
      // coded refusal ("no web access", "owners only") in the server's own
      // words; wrong credentials as one sentence, never which half was wrong.
      // The sign-in guard's codes add a step on top of the sentence.
      const status = (err as ApiError | undefined)?.status;
      const code = errorCode(err);
      const blockedKey = blockingKeyOf(err);
      const retryAfter = retryAfterOf(err);
      if ((status === 423 || status === 429) && retryAfter !== null) {
        setHold({ kind: status === 423 ? "locked" : "throttled", seconds: retryAfter, startedAt: performance.now() });
      } else if (code === "captcha_required") {
        // A wrong password that now needs the mosaic (422), or an attempt held
        // back for it (428): the mosaic, then the same attempt again.
        if (status === 422) setError(t("login.invalidCredentials"));
        setCaptchaOpen(true);
      } else if (code === "reset_suggested") {
        setError(t("login.invalidCredentials"));
        setOfferReset(true);
      } else if (blockedKey) setError(t(blockedKey));
      else if (code && err instanceof Error) setError(err.message);
      else if (status === 401 || status === 422) setError(t("login.invalidCredentials"));
      else setError(err instanceof Error ? err.message : t("login.failed"));
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || hold) return;
    await attempt();
  };

  const captchaSolved = (token: string) => {
    loginChallenge.set(token);
    setCaptchaOpen(false);
    void attempt();
  };

  // The time is up: the form is open again (the server decides on the next try).
  const holdOverNow = useCallback(() => { setHold(null); setHoldOver(true); }, []);

  return (
    <div className="login-shell web-login">
      {motion && (
        <SceneGuard>
          <Suspense fallback={null}>
            <LoginScene />
          </Suspense>
        </SceneGuard>
      )}

      <div className="login-lang" role="group" aria-label="Language">
        {LANGUAGES.map((l) => (
          <button
            key={l.code}
            type="button"
            className={`login-lang-pill${lang === l.code ? " active" : ""}`}
            onClick={() => pickLang(l.code)}
            aria-label={l.name}
            aria-pressed={lang === l.code}
          >
            {LANG_LABEL[l.code] ?? l.code.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="login-stage">
        <div className="login-brand-wrap">
          <HudBackdrop />
          <h1 className="login-brand">Cyber Place</h1>
        </div>
        <img className="login-logo" src="./logo.png" alt="" />
        <h2 className="login-title">
          {telegram ? tw("web.telegram.title") : face === "forgot" ? t("auth.forgotTitle") : tw("web.signIn.title")}
        </h2>

        {telegram ? (
          <div className="login-card web-login__card">
            <p className="web-login__note">{tw("web.tg.reopen")}</p>
            <Button type="button" onClick={() => window.Telegram?.WebApp?.close()}>
              {tw("web.close")}
            </Button>
          </div>
        ) : (
          <div className="login-flip-wrap">
            <div className={`login-flip${face === "forgot" ? " is-back" : ""}`}>
              <form
                className="login-card web-login__card"
                onSubmit={submit}
                noValidate
                inert={face === "forgot" || undefined}
              >
                <SuggestInput
                  label={t("auth.email")}
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  placeholder="your@email.com"
                  value={email}
                  onValueChange={(value) => { setEmail(value); setHold(null); setHoldOver(false); }}
                  options={known}
                  onRemoveOption={forgetEmail}
                  removeHint={t("login.forgetEmail")}
                  required
                  autoFocus={face === "login"}
                />
                <PasswordInput
                  label={t("auth.password")}
                  placeholder={t("login.passwordPlaceholder")}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                {hold ? (
                  <LoginHold kind={hold.kind} seconds={hold.seconds} startedAt={hold.startedAt} onOver={holdOverNow} />
                ) : holdOver ? (
                  <div className="login-hold is-over" role="status">{t("login.hold.ready")}</div>
                ) : error && (
                  <div className="error web-login__error" role="alert">
                    {error}
                  </div>
                )}
                <button type="button" className="login-forgot login-flip-back" onClick={() => flipTo("forgot")}>
                  {t("auth.forgot")}
                </button>
                <Button disabled={busy || hold !== null || email.trim() === "" || password === ""}>
                  {busy ? t("login.signingIn") : t("login.title")}
                </Button>
              </form>

              {offerReset && (
                <Modal open onClose={() => setOfferReset(false)}>
                  <div className="card web-login__reset">
                    <p>{tw("web.login.resetAsk")}</p>
                    <div className="row-between">
                      <Button type="button" variant="secondary" onClick={() => setOfferReset(false)}>
                        {tw("web.login.resetNo")}
                      </Button>
                      <Button type="button" onClick={() => { setOfferReset(false); flipTo("forgot"); }}>
                        {tw("web.login.resetYes")}
                      </Button>
                    </div>
                  </div>
                </Modal>
              )}

              <CaptchaDialog open={captchaOpen} client="owner_web" onSolved={captchaSolved} onClose={() => setCaptchaOpen(false)} />

              {/* The reverse face; `inert` keeps the hidden side out of the tab order. */}
              <div className="login-flip-face-back" inert={face === "login" || undefined}>
                <ForgotPasswordForm onBack={() => flipTo("login")} autoFocus={face === "forgot"} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
