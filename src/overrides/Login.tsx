/**
 * The panel's `@/routes/Login` for the web: the panel's own sign-in (its
 * AuthContext, its token handling) behind a light form — the desktop's screen
 * carries a three.js scene and a password-reset flow this app does not offer.
 *
 * Inside Telegram there is no password to type: a Telegram session that ended
 * is renewed by opening the Mini App again, so that is what this screen says.
 */
import { useAuth } from "@/auth/AuthContext";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useLang } from "@/i18n/LanguageContext";
import { LANGUAGES } from "@/i18n/translations";
import { useWebText } from "@web/web/i18n";
import { FormEvent, useState } from "react";

const inTelegram = () => document.documentElement.dataset.shell === "telegram";

const Login = () => {
  const { login } = useAuth();
  const { lang, setLang } = useLang();
  const tw = useWebText();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (inTelegram()) {
    return (
      <div className="web-gate">
        <div className="card web-gate__card">
          <h2 className="web-gate__title">{tw("web.telegram.title")}</h2>
          <p>{tw("web.tg.reopen")}</p>
          <Button variant="secondary" onClick={() => window.Telegram?.WebApp?.close()}>
            {tw("web.close")}
          </Button>
        </div>
      </div>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (err) {
      // The server's own sentence, already in the requested language:
      // wrong password, not granted, company closed.
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="web-gate">
      <form className="card web-gate__card" onSubmit={submit} noValidate>
        <div className="web-gate__langs" role="group" aria-label="Language">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              className={`web-gate__lang${l.code === lang ? " is-active" : ""}`}
              aria-pressed={l.code === lang}
              onClick={() => setLang(l.code)}
            >
              {l.name}
            </button>
          ))}
        </div>
        <img className="web-gate__logo" src="./logo.png" alt="Cyber Place" />
        <h2 className="web-gate__title">{tw("web.signIn.title")}</h2>
        <p className="muted">{tw("web.signIn.subtitle")}</p>
        <Input
          label={tw("web.signIn.email")}
          type="email"
          autoComplete="username"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          label={tw("web.signIn.password")}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <Button type="submit" disabled={busy || email.trim() === "" || password === ""}>
          {busy ? tw("web.signIn.busy") : tw("web.signIn.submit")}
        </Button>
        <p className="muted web-gate__note">{tw("web.signIn.accessNote")}</p>
        <p className="muted web-gate__note">{tw("web.signIn.forgot")}</p>
      </form>
    </div>
  );
};

export default Login;
