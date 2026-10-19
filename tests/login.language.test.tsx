// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * A sign-in error on the web follows a language switch made while it is on
 * screen (2026-10-07). Before, the card kept the sentence of the moment it
 * failed — "Этот способ входа доступен только владельцам клубов." stayed in
 * Russian after switching to English.
 */

const auth = vi.hoisted(() => ({ login: vi.fn() }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => auth }));
// A real language state: the picker on the card switches it.
vi.mock("@/i18n/LanguageContext", async () => {
  const React = await import("react");
  const { t } = await import("@/i18n/translations");
  type Lang = "en" | "ru" | "am";
  const Ctx = React.createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: string) => string } | null>(null);
  const LanguageProvider = ({ children }: { children: ReactNode }) => {
    const [lang, setLang] = React.useState<Lang>("ru");
    return React.createElement(Ctx.Provider, { value: { lang, setLang, t: (k: string) => t(k, lang) } }, children);
  };
  return { LanguageProvider, useLang: () => React.useContext(Ctx)! };
});

import { LanguageProvider } from "@/i18n/LanguageContext";
import { t } from "@/i18n/translations";
import Login from "@/routes/Login";
import { webText } from "@web/web/i18n";

const fail = (status: number, body: unknown, message = `HTTP ${status}`) =>
  Object.assign(new Error(message), { status, body });

const signInFailing = async (error: Error) => {
  auth.login.mockRejectedValueOnce(error);
  const { container } = render(
    <LanguageProvider>
      <MemoryRouter initialEntries={["/login"]}>
        <Login />
      </MemoryRouter>
    </LanguageProvider>,
  );
  fireEvent.change(container.querySelector('input[type="email"]')!, { target: { value: "o@example.test" } });
  fireEvent.change(container.querySelector('input[type="password"]')!, { target: { value: "pw" } });
  fireEvent.submit(container.querySelector("form")!);
  return (await screen.findByRole("alert")).textContent;
};

const switchTo = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
const alertText = () => screen.getByRole("alert").textContent;

afterEach(() => {
  cleanup();
  auth.login.mockReset();
});

describe("a web sign-in error follows the language switch", () => {
  it("a role the web does not serve (the server's code, said in our words)", async () => {
    const ru = "Этот способ входа доступен только владельцам клубов.";
    expect(await signInFailing(fail(403, { message: ru, code: "client_access_role_not_allowed" }, ru))).toBe(ru);

    switchTo("English");
    expect(alertText()).toBe(webText("web.refusal.client_access_role_not_allowed", "en"));
    expect(alertText()).toBe("This way of signing in is for club owners only.");
    switchTo("Հայերեն");
    expect(alertText()).toBe(webText("web.refusal.client_access_role_not_allowed", "am"));
  });

  it("wrong credentials", async () => {
    expect(await signInFailing(fail(422, { errors: { password: ["x"] } }))).toBe(t("login.invalidCredentials", "ru"));

    switchTo("English");
    expect(alertText()).toBe(t("login.invalidCredentials", "en"));
  });

  it("a block, by its code", async () => {
    await signInFailing(fail(403, { message: "blocked", code: "branch_blocked", scope: "branch" }, "blocked"));

    switchTo("English");
    expect(alertText()).toBe(t("blocking.reason.branch_blocked", "en"));
  });

  it("a wrong password that offers a reset", async () => {
    await signInFailing(fail(422, { errors: { password: ["x"] }, code: "reset_suggested" }));

    switchTo("English");
    expect(alertText()).toBe(t("login.invalidCredentials", "en"));
  });

  it("a code this build has no words for keeps the server's sentence", async () => {
    expect(await signInFailing(fail(403, { message: "Новый отказ", code: "something_new" }, "Новый отказ"))).toBe("Новый отказ");

    switchTo("English");
    expect(alertText()).toBe("Новый отказ");
  });
});
