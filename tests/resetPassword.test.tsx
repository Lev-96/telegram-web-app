// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ reset: vi.fn() }));
vi.mock("@/api/auth", () => ({ apiResetPassword: api.reset }));
vi.mock("@/i18n/LanguageContext", async () => {
  const { t } = await import("@/i18n/translations");
  return { useLang: () => ({ lang: "ru", setLang: vi.fn(), t: (k: string) => t(k, "ru") }) };
});

import { AppConfig } from "@/infrastructure/AppConfig";
import ResetPassword, { isResetLink } from "@web/overrides/ResetPassword";

const SECRET = "s".repeat(64);

const fill = (container: HTMLElement, a: string, b = a) => {
  const [pw, pw2] = container.querySelectorAll<HTMLInputElement>('input[type="password"]');
  fireEvent.change(pw, { target: { value: a } });
  fireEvent.change(pw2, { target: { value: b } });
  fireEvent.submit(container.querySelector("form")!);
};

beforeEach(() => {
  window.history.replaceState(null, "", `/#/reset-password?token=${SECRET}`);
  window.localStorage.clear();
  api.reset.mockReset();
});

afterEach(cleanup);

describe("the web reset screen", () => {
  it("recognises only the reset route", () => {
    expect(isResetLink("#/reset-password?token=x")).toBe(true);
    expect(isResetLink("#/reset-password")).toBe(true);
    expect(isResetLink("#/reset-passwordx")).toBe(false);
    expect(isResetLink("#/login")).toBe(false);
  });

  it("takes the secret from the link, removes it from the address bar and shows no token field", () => {
    const { container } = render(<ResetPassword />);
    expect(window.location.hash).toBe("#/reset-password");
    expect(container.innerHTML).not.toContain(SECRET);
    expect(container.querySelectorAll("input").length).toBe(2);
  });

  it("sends the secret with the new password and forgets this browser's session", async () => {
    window.localStorage.setItem(AppConfig.storageKeys.token, '"1|old"');
    api.reset.mockResolvedValueOnce(undefined);
    const { container } = render(<ResetPassword />);

    fill(container, "brand-new-pass");

    expect(await screen.findByRole("status")).toBeTruthy();
    expect(api.reset).toHaveBeenCalledWith({
      token: SECRET,
      new_password: "brand-new-pass",
      new_password_confirmation: "brand-new-pass",
    });
    expect(window.localStorage.getItem(AppConfig.storageKeys.token)).toBeNull();
  });

  it("does not send mismatched passwords", () => {
    const { container } = render(<ResetPassword />);
    fill(container, "brand-new-pass", "brand-new-pasS");
    expect(api.reset).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe("Пароли не совпадают");
  });

  it("a dead link: the server's sentence and a way to get a new one", async () => {
    api.reset.mockRejectedValueOnce(new Error("Ссылка недействительна."));
    const { container } = render(<ResetPassword />);
    fill(container, "brand-new-pass");

    expect((await screen.findByRole("alert")).textContent).toBe("Ссылка недействительна.");
    expect(screen.getByText("Отправить новую ссылку")).toBeTruthy();
  });

  it("opened without a secret: says so instead of offering a form", () => {
    window.history.replaceState(null, "", "/#/reset-password");
    const { container } = render(<ResetPassword />);
    expect(container.querySelector('input[type="password"]')).toBeNull();
    expect(screen.getByRole("alert").textContent).toBe("Эта ссылка для сброса не работает. Запросите новую.");
  });
});
