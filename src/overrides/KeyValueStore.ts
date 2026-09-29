/**
 * The panel's `@/infrastructure/KeyValueStore` for a browser.
 *
 * On the web everything lives in localStorage, as in the panel's own browser
 * fallback, so a sign-in survives closing the browser the way the desktop's
 * does (2026-09-29). What keeps that safe is on the server, not here: the web
 * token expires (30 days), dies after 14 idle days, is deleted by sign-out,
 * by an account switch, by a password reset and by an administrator's revoke.
 *
 * Inside Telegram the session — the token and the signed-in user — stays in
 * sessionStorage: opening the Mini App signs in again from Telegram's own
 * launch data, so there is nothing to remember between launches.
 *
 * Both are wrapped: a WebView with storage disabled must not crash the app.
 */
import { AppConfig } from "@/infrastructure/AppConfig";

export interface IKeyValueStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

// The panel declares its Electron bridge in the module this one replaces; the
// declaration moves with it (types only — in a browser the bridge is absent,
// which the panel's code already handles).
declare global {
  interface Window {
    desktopAPI?: {
      get(key: string): Promise<string | null>;
      set(key: string, value: string): Promise<void>;
      remove(key: string): Promise<void>;
      wakeOnLan(mac: string): Promise<{
        ok: boolean;
        mac: string;
        sent: number;
        errors: string[];
        message: string;
      }>;
    };
  }
}

const SESSION_KEYS: ReadonlySet<string> = new Set([AppConfig.storageKeys.token, AppConfig.storageKeys.user]);

const inTelegram = () => document.documentElement.dataset.shell === "telegram";

const area = (key: string): Storage | null => {
  try {
    return inTelegram() && SESSION_KEYS.has(key) ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
};

class BrowserStore implements IKeyValueStore {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = area(key)?.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      area(key)?.setItem(key, JSON.stringify(value));
    } catch {
      /* storage full or disabled: the session simply is not remembered */
    }
  }

  async remove(key: string): Promise<void> {
    try {
      area(key)?.removeItem(key);
    } catch {
      /* nothing stored, nothing to remove */
    }
  }
}

export const keyValueStore: IKeyValueStore = new BrowserStore();
