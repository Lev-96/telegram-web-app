import { request } from "@/api/client";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import Modal from "@/components/ui/Modal";
import QrCode from "@/components/ui/QrCode";
import Spinner from "@/components/ui/Spinner";
import { notify } from "@/ui/notify";
import { useCallback, useEffect, useState } from "react";
import { useWebText } from "./i18n";

export interface ClientAccessState {
  clients: string[];
  telegram: {
    status: "none" | "pending" | "active";
    username: string | null;
    telegram_user_id: number | null;
    enabled: boolean;
    /** Opens the Mini App directly (no chat, no START); only for a usable link. */
    open_url?: string | null;
  };
}

interface LinkCode {
  url: string;
  expires_at: string;
}

const LINK_MINUTES = 10;

export const fetchClientAccess = () => request<ClientAccessState>("/client-access", { noCache: true });

/**
 * The owner's Telegram link, managed from the web panel (2026-09-28):
 * create a one-time link, confirm the Telegram account that used it — shown
 * by its @name, so a stranger who got hold of the link is refused here — or
 * unlink. Every decision is the server's; this only shows its answers.
 */
const TelegramAccess = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const tw = useWebText();
  const confirm = useConfirm();
  const [state, setState] = useState<ClientAccessState | null>(null);
  const [link, setLink] = useState<LinkCode | null>(null);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");

  const reload = useCallback(async () => {
    try {
      setState(await fetchClientAccess());
    } catch (e) {
      notify.message("error", e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    if (open) {
      setLink(null);
      setPassword("");
      void reload();
    }
  }, [open, reload]);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      notify.message("error", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      void reload();
    }
  };

  const createLink = () => act(async () => setLink(await request<LinkCode>("/client-access/telegram/link-code", { method: "POST" })));

  // The server asks for the password and for THE account shown here, so a
  // link replaced in between is never confirmed blind.
  const confirmLink = () =>
    act(async () => {
      const res = await request<{ message: string }>("/client-access/telegram/confirm", {
        method: "POST",
        body: { telegram_user_id: state?.telegram.telegram_user_id, password },
      });
      setLink(null);
      setPassword("");
      notify.message("success", res.message);
    });

  const unlink = async (question: string) => {
    if (!(await confirm(question, { destructive: true }))) return;
    await act(async () => {
      const res = await request<{ message: string }>("/client-access/telegram", { method: "DELETE" });
      setLink(null);
      notify.message("success", res.message);
    });
  };

  const who = state?.telegram.username ? `@${state.telegram.username}` : tw("web.telegram.noUsername");
  const granted = state?.clients.includes("telegram") ?? false;

  return (
    <Modal open={open} onClose={onClose}>
      <div className="card web-telegram">
        <h2 className="web-telegram__title">{tw("web.telegram.open")}</h2>

        {!state && <Spinner />}

        {state && !state.telegram.enabled && <p>{tw("web.telegram.disabled")}</p>}
        {state && state.telegram.enabled && !granted && <p>{tw("web.telegram.notGranted")}</p>}

        {state && state.telegram.enabled && granted && state.telegram.status === "none" && (
          <>
            <p>{tw("web.telegram.none")}</p>
            {link ? (
              <div className="web-telegram__link">
                <QrCode value={link.url} size={200} />
                <p className="muted">{tw("web.telegram.linkHint", LINK_MINUTES)}</p>
                <a className="web-telegram__url" href={link.url} target="_blank" rel="noreferrer noopener">
                  {link.url}
                </a>
                <Button
                  variant="secondary"
                  onClick={() => {
                    void navigator.clipboard?.writeText(link.url).then(() => notify.message("success", tw("web.telegram.copied")));
                  }}
                >
                  {tw("web.telegram.copy")}
                </Button>
              </div>
            ) : (
              <Button onClick={() => void createLink()} disabled={busy}>
                {tw("web.telegram.create")}
              </Button>
            )}
          </>
        )}

        {state && granted && state.telegram.status === "pending" && (
          <>
            <p>{tw("web.telegram.pending", who)}</p>
            <Input
              label={tw("web.telegram.password")}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div className="web-telegram__actions">
              <Button variant="secondary" onClick={() => void unlink(tw("web.telegram.unlinkConfirm"))} disabled={busy}>
                {tw("web.telegram.reject")}
              </Button>
              <Button onClick={() => void confirmLink()} disabled={busy || password === ""}>
                {tw("web.telegram.confirm")}
              </Button>
            </div>
          </>
        )}

        {state && state.telegram.status === "active" && (
          <>
            <p>{tw("web.telegram.active", who)}</p>
            {state.telegram.open_url && (
              <a className="btn web-telegram__open" href={state.telegram.open_url} target="_blank" rel="noopener noreferrer">
                {tw("web.telegram.openApp")}
              </a>
            )}
            <Button variant="secondary" className="is-danger" onClick={() => void unlink(tw("web.telegram.unlinkConfirm"))} disabled={busy}>
              {tw("web.telegram.unlink")}
            </Button>
          </>
        )}

        <div className="web-telegram__footer">
          <Button variant="secondary" onClick={onClose}>
            {tw("web.close")}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default TelegramAccess;
