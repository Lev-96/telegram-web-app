/**
 * The panel's `@/infrastructure/KeyValueStore` for a browser.
 *
 * The session — the token and the signed-in user — lives in sessionStorage:
 * it ends with the tab and is never written where another tab, or a shared
 * computer's next user, finds it tomorrow. Everything else (language,
 * currency, remembered emails) stays in localStorage, as it does in the
 * panel's own browser fallback.
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

const area = (key: string): Storage | null => {
  try {
    return SESSION_KEYS.has(key) ? window.sessionStorage : window.localStorage;
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
