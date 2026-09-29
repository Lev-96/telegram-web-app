// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * "Open in Telegram" (2026-09-29): shown when the server hands over a direct
 * link for a usable Telegram link, and never built by the client itself.
 */

const api = vi.hoisted(() => ({ state: null as unknown }));
vi.mock("@/api/client", () => ({ request: async () => api.state }));
vi.mock("@/i18n/LanguageContext", async () => {
  const { t } = await import("@/i18n/translations");
  return { useLang: () => ({ lang: "ru", setLang: vi.fn(), t: (k: string) => t(k, "ru") }) };
});
vi.mock("@/components/ui/ConfirmProvider", () => ({ useConfirm: () => async () => true }));
vi.mock("@/components/ui/Modal", () => ({ default: ({ open, children }: { open: boolean; children: unknown }) => (open ? <div>{children as never}</div> : null) }));

import TelegramAccess from "@web/web/TelegramAccess";

const active = (openUrl: string | null) => ({
  clients: ["owner_web", "telegram"],
  telegram: { status: "active", username: "owner_tg", telegram_user_id: 777, enabled: true, open_url: openUrl },
});

afterEach(cleanup);

describe("Telegram access dialog", () => {
  it("offers the server's direct link to open the Mini App in a new tab", async () => {
    api.state = active("https://t.me/cp_owner_bot/panel");
    render(<TelegramAccess open onClose={vi.fn()} />);

    const link = (await screen.findByText("Открыть в Telegram")) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("https://t.me/cp_owner_bot/panel");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("offers nothing to open when the server gives no link", async () => {
    api.state = active(null);
    render(<TelegramAccess open onClose={vi.fn()} />);

    await screen.findByText(/привязан/);
    expect(screen.queryByText("Открыть в Telegram")).toBeNull();
  });
});
