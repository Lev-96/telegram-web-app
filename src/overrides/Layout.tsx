/**
 * The panel's `@/components/Layout` for a browser and for Telegram.
 *
 * Everything the desktop shell mounts is mounted here too, from the panel's own
 * modules — the sidebar and its role-aware menu, the back button, the booking /
 * support / session-ending notifiers, the unexpected-console-wake question — so
 * the owner is told the same things whichever window they work in.
 *
 * What differs is the frame: below 900px the sidebar becomes a drawer behind a
 * top bar, so the same screens fit a phone and Telegram's narrow view. In a
 * browser the top bar also opens the owner's Telegram access.
 */
import ExpenseReminderNotifier from "@/components/notifications/ExpenseReminderNotifier";
import GlobalBookingNotifier from "@/components/notifications/GlobalBookingNotifier";
import SessionEndingNotifier from "@/components/notifications/SessionEndingNotifier";
import SupportNotifier from "@/components/notifications/SupportNotifier";
import UnexpectedWakeDialog from "@/components/ps5/UnexpectedWakeDialog";
import Sidebar from "@/components/Sidebar";
import BackButton from "@/components/ui/BackButton";
import { Ps5ControlProvider } from "@/ps5/Ps5ControlProvider";
import TelegramAccess from "@web/web/TelegramAccess";
import { useWebText } from "@web/web/i18n";
import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

const inTelegram = () => document.documentElement.dataset.shell === "telegram";

const Layout = () => {
  const tw = useWebText();
  const location = useLocation();
  const [drawer, setDrawer] = useState(false);
  const [telegram, setTelegram] = useState(false);

  // A menu item was chosen: the drawer has done its job.
  useEffect(() => setDrawer(false), [location.pathname]);

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);

  return (
    <Ps5ControlProvider>
      <div className={`app-shell web-shell${drawer ? " is-drawer-open" : ""}`}>
        <header className="web-topbar">
          <button
            type="button"
            className="web-topbar__menu"
            aria-label={tw("web.menu")}
            aria-expanded={drawer}
            onClick={() => setDrawer((v) => !v)}
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
          <img className="web-topbar__logo" src="./logo.png" alt="Cyber Place" />
          {!inTelegram() && (
            <button type="button" className="web-topbar__action" onClick={() => setTelegram(true)}>
              {tw("web.telegram.title")}
            </button>
          )}
        </header>
        <div className="web-drawer-backdrop" onClick={() => setDrawer(false)} aria-hidden="true" />
        <div className="web-drawer">
          <Sidebar />
        </div>
        <main className="main">
          <BackButton />
          <Outlet />
        </main>
        {/* The notifiers' toasts place themselves (fixed, top-right, each at
            its own offset). On the web they sit in one stack instead, so they
            cover neither the top bar nor, on a phone, the page title: see
            .web-notices in web.css. Their dialogs portal to <body> and are
            not affected. */}
        <div className="web-notices">
          <GlobalBookingNotifier />
          <SupportNotifier />
          <SessionEndingNotifier />
          <ExpenseReminderNotifier />
        </div>
        <UnexpectedWakeDialog />
      </div>
      {!inTelegram() && <TelegramAccess open={telegram} onClose={() => setTelegram(false)} />}
    </Ps5ControlProvider>
  );
};

export default Layout;
