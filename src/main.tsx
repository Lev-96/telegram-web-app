import App from "@/App";
import { AuthProvider } from "@/auth/AuthContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { FirstRunLanguageGate } from "@/i18n/LanguageGates";
import "@/styles/global.css";
import "@web/styles/web.css";
import TelegramGate from "@web/telegram/TelegramGate";
import { prepareTelegramChrome, readTelegramLaunch } from "@web/telegram/telegram";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");

// Read BEFORE anything renders: Telegram passes its launch in the URL hash,
// which the panel's HashRouter would otherwise take for a route.
const launch = readTelegramLaunch();
if (launch) {
  prepareTelegramChrome(launch.webApp);
} else {
  document.documentElement.dataset.shell = "web";
}

// The panel's own tree — the same providers and the same App the desktop
// renders — with the Telegram gate in front of it when opened from Telegram.
const panel = (
  <AuthProvider>
    <App />
  </AuthProvider>
);

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <LanguageProvider>
        <FirstRunLanguageGate>{launch ? <TelegramGate launch={launch}>{panel}</TelegramGate> : panel}</FirstRunLanguageGate>
      </LanguageProvider>
    </ErrorBoundary>
  </StrictMode>,
);
