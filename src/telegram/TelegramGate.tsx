import { request } from "@/api/client";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { AppConfig } from "@/infrastructure/AppConfig";
import { keyValueStore } from "@/infrastructure/KeyValueStore";
import { useWebText } from "@web/web/i18n";
import { ReactNode, useEffect, useRef, useState } from "react";
import { errorMessage, TelegramLaunch } from "./telegram";

type State = { kind: "working" } | { kind: "ready" } | { kind: "refused"; message: string | null };

interface LoginResponse {
  login: { id: number; name: string; email: string; role: string };
  token: string;
}

/**
 * Stands in front of the panel when it was opened inside Telegram.
 *
 *   opened from the web  the signed launch carries the one-time handoff code
 *                        (the owner web's "Telegram"): /telegram/mini-app/link
 *                        links this Telegram account and returns the session
 *   opened from the bot  /telegram/mini-app/session → the session
 *
 * Either way the panel itself follows, signed in, exactly as in a browser.
 *
 * A launch is accepted by the server ONCE, so the exchange runs once per page
 * load even under React's double-invoked effects. A reload inside Telegram
 * keeps the session it already has (sessionStorage) instead of asking again.
 */
const TelegramGate = ({ launch, children }: { launch: TelegramLaunch; children: ReactNode }) => {
  const tw = useWebText();
  const [state, setState] = useState<State>({ kind: "working" });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const run = async () => {
      // A handoff always signs in (it may be a different owner than before);
      // a plain launch keeps the session this Mini App already holds.
      if (!launch.linkParam && (await keyValueStore.get<string>(AppConfig.storageKeys.token))) {
        setState({ kind: "ready" });
        return;
      }

      const res = await request<LoginResponse>(launch.linkParam ? "/telegram/mini-app/link" : "/telegram/mini-app/session", {
        method: "POST",
        body: { init_data: launch.initData },
      });
      await keyValueStore.set(AppConfig.storageKeys.token, res.token);
      setState({ kind: "ready" });
    };

    run().catch((error: unknown) => setState({ kind: "refused", message: errorMessage(error) }));
  }, [launch]);

  if (state.kind === "ready") return <>{children}</>;

  return (
    <div className="web-gate">
      <div className="card web-gate__card">
        <h2 className="web-gate__title">{tw("web.telegram.title")}</h2>
        {state.kind === "working" && (
          <>
            <Spinner />
            <p className="muted">{launch.linkParam ? tw("web.tg.linking") : tw("web.tg.signingIn")}</p>
          </>
        )}
        {state.kind === "refused" && (
          <>
            <p>{state.message ?? tw("web.tg.reopen")}</p>
            <Button variant="secondary" onClick={() => launch.webApp.close()}>
              {tw("web.close")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default TelegramGate;
