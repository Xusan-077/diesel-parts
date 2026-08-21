// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "./theme-provider";
import { ThemeToggle } from "./layout/theme-toggle";
import { DEFAULT_THEME, THEME_STORAGE_KEY } from "@/lib/store/theme";
import { useThemeStore } from "@/lib/store/theme-store";

/*
 * These cover the swap away from `next-themes`. What is worth pinning down is
 * the hydration contract: the first render is always light, whatever the
 * machine or localStorage say, and the stored preference plus the operating
 * system preference both land from effects straight after mount. Only the
 * pre-paint script (covered in lib/store/theme.test.ts) touches the document
 * before React does.
 */

/** jsdom has no media engine, so the machine preference is stubbed per test. */
function stubSystemDark(matches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches,
      addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) =>
        listeners.add(listener),
      removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) =>
        listeners.delete(listener),
    }))
  );

  return {
    change: (next: boolean) =>
      listeners.forEach((listener) => listener({ matches: next } as MediaQueryListEvent)),
  };
}

function renderToggle() {
  return render(
    <ThemeProvider>
      <ThemeToggle lightLabel="Yorug‘ rejim" darkLabel="Qorong‘i rejim" />
    </ThemeProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  useThemeStore.setState({ theme: DEFAULT_THEME, systemDark: false });
  stubSystemDark(false);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the theme provider", () => {
  it("follows the system when nothing is stored", () => {
    renderToggle();

    expect(useThemeStore.getState().theme).toBe("system");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(screen.getByRole("button").getAttribute("aria-label")).toBe("Qorong‘i rejim");
  });

  it("paints dark when the system asks for it", () => {
    stubSystemDark(true);

    renderToggle();

    expect(useThemeStore.getState().theme).toBe("system");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("keeps up when the system preference changes while the page is open", () => {
    const media = stubSystemDark(false);
    renderToggle();

    expect(document.documentElement.classList.contains("dark")).toBe(false);

    act(() => media.change(true));

    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("lets an explicit choice outrank the system", () => {
    stubSystemDark(true);
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ state: { theme: "light" } }));

    renderToggle();

    expect(useThemeStore.getState().theme).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("applies a stored dark theme after mount", () => {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ state: { theme: "dark" } }));

    renderToggle();

    expect(useThemeStore.getState().theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("honours the bare value next-themes left behind", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");

    renderToggle();

    expect(useThemeStore.getState().theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("ignores a corrupt stored value instead of throwing", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "{not json");

    renderToggle();

    expect(useThemeStore.getState().theme).toBe("system");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});

describe("the toggle", () => {
  it("flips the class, the label and the stored value", async () => {
    const user = userEvent.setup();
    renderToggle();

    await user.click(screen.getByRole("button"));

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(screen.getByRole("button").getAttribute("aria-label")).toBe("Yorug‘ rejim");
    expect(JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) ?? "null")).toMatchObject({
      state: { theme: "dark" },
    });

    await user.click(screen.getByRole("button"));

    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(screen.getByRole("button").getAttribute("aria-label")).toBe("Qorong‘i rejim");
  });

  it("leaves system for the opposite of what is on screen", async () => {
    const user = userEvent.setup();
    stubSystemDark(true);
    renderToggle();

    await user.click(screen.getByRole("button"));

    expect(useThemeStore.getState().theme).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});

describe("the store", () => {
  it("sets a theme outright, system included", () => {
    useThemeStore.getState().setTheme("dark");
    expect(useThemeStore.getState().theme).toBe("dark");

    useThemeStore.getState().setTheme("system");
    expect(useThemeStore.getState().theme).toBe("system");
  });

  it("toggles between the two visible themes", () => {
    useThemeStore.setState({ theme: "light", systemDark: false });

    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe("dark");

    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe("light");
  });

  it("never persists the machine preference", () => {
    useThemeStore.getState().setTheme("dark");
    useThemeStore.getState().setSystemDark(true);

    expect(JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) ?? "null")).toMatchObject({
      state: { theme: "dark" },
    });
    expect(localStorage.getItem(THEME_STORAGE_KEY)).not.toContain("systemDark");
  });
});
