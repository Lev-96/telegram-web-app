// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ login: vi.fn() }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => auth }));
const captchaApi = vi.hoisted(() => ({ calls: [] as Array<{ path: string; body?: unknown }>, solve: true }));
vi.mock("@/api/client", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  request: async (path: string, opts: { method?: string; body?: unknown } = {}) => {
    captchaApi.calls.push({ path, body: opts.body });
    if (path === "/owner-web/captcha" && (opts.method ?? "GET") === "GET") {
      return { id: "c1", background: "data:image/png;base64,AA", piece: "data:image/png;base64,AA", piece_y: 20, width: 320, height: 160, piece_size: 56 };
    }
    if (path === "/owner-web/captcha") {
      if (captchaApi.solve) return { captcha_token: "solved-token" };
      throw Object.assign(new Error("miss"), { status: 422, body: { code: "captcha_failed" } });
    }
    throw new Error("unexpected " + path);
  },
}));
vi.mock("@/components/ui/Modal", () => ({
  default: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div>{children}</div> : null),
}));
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
  captchaApi.calls = [];
  captchaApi.solve = true;
  cleanup();
  document.documentElement.dataset.shell = "";
});

describe("web sign-in errors, read as the desktop reads them", () => {
  it("wrong credentials: one sentence, never which half was wrong", async () => {
    expect(await submit(fail(422, { errors: { password: ["Invalid password"] } }))).toBe("Неверный логин или пароль");
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
  it("does not say access is given by an administrator: every owner has it", () => {
    const { container } = renderAt();
    expect(container.textContent).not.toMatch(/администратор|Сам адрес/);
  });

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

describe("the sign-in guard (2026-10-01)", () => {
  it("after the 5th failure: the mosaic; solved, its token rides on the next attempt", async () => {
    const out = await submit(fail(422, { errors: { password: ["x"] }, code: "captcha_required" }));
    expect(out).toBe("Неверный логин или пароль");
    await screen.findByRole("group", { name: "Подтвердите, что вы человек" });
    const slider = screen.getByRole("slider");
    expect(screen.getByRole("button", { name: "Вход" }).hasAttribute("disabled")).toBe(true);

    fireEvent.change(slider, { target: { value: "150" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Проверить" })); });

    expect(captchaApi.calls.find((c) => c.body)?.body).toEqual({ id: "c1", x: 150 });
    await waitFor(() => expect(screen.queryByRole("slider")).toBeNull());
    expect(screen.getByRole("alert").textContent).toBe("Готово. Введите пароль ещё раз.");
    const { loginChallenge } = await import("@web/web/loginChallenge");
    expect(loginChallenge.take()).toBe("solved-token");
  });

  it("a miss draws a new picture", async () => {
    captchaApi.solve = false;
    await submit(fail(428, { code: "captcha_required", message: "x" }));
    await screen.findByRole("slider");
    fireEvent.change(screen.getByRole("slider"), { target: { value: "10" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Проверить" })); });
    await screen.findByText("Не совсем. Вот новая картинка, попробуйте ещё раз.");
    expect(captchaApi.calls.filter((c) => c.path === "/owner-web/captcha" && !c.body)).toHaveLength(2);
  });

  it("after the 10th failure: offers a password reset, and yes turns to it", async () => {
    await submit(fail(422, { errors: { password: ["x"] }, code: "reset_suggested" }));
    expect(screen.getByText("Не получается войти? Сбросить пароль?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Сбросить пароль" }));
    expect(screen.queryByText("Не получается войти? Сбросить пароль?")).toBeNull();
  });

  it("locked: the server's sentence, and no sign-in until the time is up", async () => {
    const out = await submit(fail(423, { code: "login_locked", retry_after: 3000, message: "Вход закрыт ещё на 50 мин." }, "Вход закрыт ещё на 50 мин."));
    expect(out).toBe("Вход закрыт ещё на 50 мин.");
    expect(screen.getByRole("button", { name: "Вход" }).hasAttribute("disabled")).toBe(true);
  });
});
