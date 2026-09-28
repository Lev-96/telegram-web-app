// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ login: vi.fn() }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/i18n/LanguageContext", async () => {
  const { t } = await import("@/i18n/translations");
  return { useLang: () => ({ lang: "ru", setLang: vi.fn(), t: (k: string) => t(k, "ru") }) };
});

import Login from "@/routes/Login";

const fail = (status: number, body: unknown, message = `HTTP ${status}`) =>
  Object.assign(new Error(message), { status, body });

const submit = async (error: Error) => {
  auth.login.mockRejectedValueOnce(error);
  const { container } = render(<Login />);
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

  it("a manager's correct password is not reported as a wrong one", async () => {
    const text = "Доступ через браузер и Telegram есть только у владельцев компаний.";
    expect(await submit(fail(422, { message: text, code: "client_access_owners_only" }, text))).toBe(text);
  });

  it("a blocked company: the desktop's own blocked sentence", async () => {
    const out = await submit(fail(403, { message: "blocked", code: "company_blocked", scope: "company" }, "blocked"));
    expect(out).not.toBe("blocked");
    expect(out).not.toMatch(/HTTP/);
  });

  it("inside Telegram: no password form, only how to get back in", () => {
    document.documentElement.dataset.shell = "telegram";
    const { container } = render(<Login />);
    expect(container.querySelector('input[type="password"]')).toBeNull();
    expect(screen.getByText(/Закройте приложение/)).toBeTruthy();
  });
});
