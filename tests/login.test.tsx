// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ login: vi.fn() }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/i18n/LanguageContext", async () => {
  const { t } = await import("@/i18n/translations");
  return { useLang: () => ({ lang: "ru", setLang: vi.fn(), t: (k: string) => t(k, "ru") }) };
});

import { takePreLoginChoice } from "@/i18n/languagePreference";
import Login from "@/routes/Login";

const renderAt = (path = "/login") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Login />
    </MemoryRouter>,
  );

const fail = (status: number, body: unknown, message = `HTTP ${status}`) =>
  Object.assign(new Error(message), { status, body });

const submit = async (error: Error) => {
  auth.login.mockRejectedValueOnce(error);
  const { container } = renderAt();
  fireEvent.change(container.querySelector('input[type="email"]')!, { target: { value: "o@example.test" } });
  fireEvent.change(container.querySelector('input[type="password"]')!, { target: { value: "pw" } });
  fireEvent.submit(container.querySelector("form")!);
  return (await screen.findByRole("alert")).textContent;
};

afterEach(() => {
  cleanup();
  document.documentElement.dataset.shell = "";
});

describe("web sign-in errors, read as the desktop reads them", () => {
  it("wrong credentials: one sentence, never which half was wrong", async () => {
    expect(await submit(fail(422, { errors: { password: ["Invalid password"] } }))).toBe("Неверный логин или пароль");
  });

  it("no web access: the server's own sentence", async () => {
    const text = "Этому аккаунту не выдан доступ через браузер и Telegram.";
    expect(await submit(fail(403, { message: text, code: "client_access_not_granted" }, text))).toBe(text);
  });

  it("a role the web does not serve: the server's sentence, not 'wrong password'", async () => {
    const text = "Для роли этого аккаунта такой способ входа недоступен.";
    expect(await submit(fail(403, { message: text, code: "client_access_role_not_allowed" }, text))).toBe(text);
  });

  it("a blocked company: the desktop's own blocked sentence", async () => {
    const out = await submit(fail(403, { message: "blocked", code: "company_blocked", scope: "company" }, "blocked"));
    expect(out).not.toBe("blocked");
    expect(out).not.toMatch(/HTTP/);
  });

  it("inside Telegram: no password form, only how to get back in", () => {
    document.documentElement.dataset.shell = "telegram";
    const { container } = renderAt();
    expect(container.querySelector('input[type="password"]')).toBeNull();
    expect(screen.getByText(/Закройте приложение/)).toBeTruthy();
  });
});

describe("web sign-in card", () => {
  it("turns over to the desktop's forgot-password form, and back", () => {
    const { container } = renderAt();
    expect(container.querySelector(".login-flip.is-back")).toBeNull();

    fireEvent.click(screen.getByText("Забыли пароль?"));
    expect(container.querySelector(".login-flip.is-back")).not.toBeNull();
    expect(container.querySelector(".login-flip-face-back")!.hasAttribute("inert")).toBe(false);
    expect(container.querySelector("form.web-login__card")!.hasAttribute("inert")).toBe(true);
  });

  it("opens already turned on #/forgot-password", () => {
    const { container } = renderAt("/forgot-password");
    expect(container.querySelector(".login-flip.is-back")).not.toBeNull();
  });

  it("hands a language picked here to the account that signs in next", () => {
    renderAt();
    takePreLoginChoice();
    fireEvent.click(screen.getByRole("button", { name: /Հայերեն|Armenian/ }));
    expect(takePreLoginChoice()).toBe("am");
  });
});

