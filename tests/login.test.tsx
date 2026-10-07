// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ login: vi.fn() }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => auth }));
const captchaApi = vi.hoisted(() => ({ calls: [] as Array<{ path: string; method: string; body?: unknown }>, solve: true, n: 0 }));
vi.mock("@/api/client", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  request: async (path: string, opts: { method?: string; body?: unknown } = {}) => {
    const method = opts.method ?? "GET";
    captchaApi.calls.push({ path, method, body: opts.body });
    if (path.startsWith("/auth/captcha") && method === "GET") {
      return { id: `c${++captchaApi.n}`, image: "data:image/jpeg;base64,AA", grid: 3, size: 360 };
    }
    if (path.startsWith("/auth/captcha")) {
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
  captchaApi.n = 0;
  cleanup();
  document.documentElement.dataset.shell = "";
});

describe("web sign-in errors, read as the desktop reads them", () => {
  it("wrong credentials: one sentence, never which half was wrong", async () => {
    expect(await submit(fail(422, { errors: { password: ["Invalid password"] } }))).toBe("Неверный логин или пароль");
  });

  it("a role the web does not serve: said by its code in our words, not 'wrong password'", async () => {
    const server = "Для роли этого аккаунта такой способ входа недоступен.";
    expect(await submit(fail(403, { message: server, code: "client_access_role_not_allowed" }, server)))
      .toBe("Этот способ входа доступен только владельцам клубов.");
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

const fillAndSubmit = (error: Error) => {
  auth.login.mockRejectedValueOnce(error);
  const view = renderAt();
  fireEvent.change(view.container.querySelector('input[type="email"]')!, { target: { value: "o@example.test" } });
  fireEvent.change(view.container.querySelector('input[type="password"]')!, { target: { value: "pw" } });
  fireEvent.submit(view.container.querySelector("form")!);
  return view;
};

describe("the sign-in guard (2026-10-01, the shared mosaic and countdown since 2026-10-07)", () => {
  // The bug of 2026-10-07: a solved mosaic re-sent the same wrong credentials
  // by itself, which failed and opened the next mosaic at once.
  it("a wrong password that now needs the mosaic: it opens; solved, it goes back to the form and sends nothing", async () => {
    auth.login.mockClear();
    const out = await submit(fail(422, { errors: { password: ["x"] }, code: "captcha_required" }));
    expect(out).toBe("Неверный логин или пароль");
    await screen.findByRole("group", { name: "Подтвердите, что вы человек" });
    await waitFor(() => expect(screen.getAllByRole("button", { name: /^Кусочек / })).toHaveLength(9));
    expect(captchaApi.calls[0].path).toBe("/auth/captcha?client=owner_web");

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Проверить" })); });
    expect(captchaApi.calls.find((c) => c.method === "POST")).toEqual({
      path: "/auth/captcha?client=owner_web", method: "POST", body: { id: "c1", order: [0, 1, 2, 3, 4, 5, 6, 7, 8] },
    });

    expect(await screen.findByText("Проверка пройдена. Проверьте email и пароль и нажмите «Вход».", {}, { timeout: 2000 })).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Подтвердите, что вы человек" })).toBeNull();
    // Nothing signed in by itself, and no second picture asked for.
    expect(auth.login).toHaveBeenCalledTimes(1);
    expect(captchaApi.calls.filter((c) => c.method === "GET")).toHaveLength(1);
    expect(document.activeElement).toBe(document.querySelector('input[type="password"]'));

    // The corrected password goes once, with the pass.
    const { loginChallenge } = await import("@/auth/loginChallenge");
    const sent: Array<[string, string, string | null]> = [];
    auth.login.mockImplementationOnce(async (email: string, password: string) => { sent.push([email, password, loginChallenge.take()]); });
    fireEvent.change(document.querySelector('input[type="password"]')!, { target: { value: "right-one" } });
    fireEvent.submit(document.querySelector("form")!);
    await waitFor(() => expect(sent).toEqual([["o@example.test", "right-one", "solved-token"]]));
  });

  it("a wrong mosaic says so and brings a new picture", async () => {
    captchaApi.solve = false;
    fillAndSubmit(fail(428, { code: "captcha_required", message: "x" }));
    await waitFor(() => expect(screen.getAllByRole("button", { name: /^Кусочек / })).toHaveLength(9));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Проверить" })); });
    await screen.findByText("Мозаика собрана неправильно. Вот новая картинка, попробуйте ещё раз.");
    await waitFor(() => expect(captchaApi.calls.filter((c) => c.method === "GET")).toHaveLength(2));
    // An attempt held back for the mosaic (428) is not called a wrong password.
    expect(screen.queryByText("Неверный логин или пароль")).toBeNull();
  });

  it("after the 10th failure: offers a password reset, and yes turns to it", async () => {
    await submit(fail(422, { errors: { password: ["x"] }, code: "reset_suggested" }));
    expect(screen.getByText("Не получается войти? Сбросить пароль?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Сбросить пароль" }));
    expect(screen.queryByText("Не получается войти? Сбросить пароль?")).toBeNull();
  });

  it("locked: a countdown from the server's seconds, and no sign-in until the time is up", async () => {
    fillAndSubmit(fail(423, { code: "login_locked", retry_after: 3000, message: "Вход закрыт ещё на 50 мин." }, "Вход закрыт ещё на 50 мин."));
    expect(await screen.findByText("Вход временно заблокирован")).toBeTruthy();
    expect(screen.getByText("Попробовать снова через")).toBeTruthy();
    expect(screen.getByText("50 мин 00 сек")).toBeTruthy();
    expect(screen.queryByText("Вход закрыт ещё на 50 мин.")).toBeNull();
    expect(screen.getByRole("button", { name: "Вход" }).hasAttribute("disabled")).toBe(true);
  });

  it("too many tries in a minute: a countdown too, not 'in a minute'", async () => {
    fillAndSubmit(fail(429, { code: "too_many_attempts", retry_after: 42, message: "Слишком много попыток входа. Попробуйте через минуту." }));
    expect(await screen.findByText("Слишком много попыток входа")).toBeTruthy();
    expect(screen.getByText("42 сек")).toBeTruthy();
  });
});
