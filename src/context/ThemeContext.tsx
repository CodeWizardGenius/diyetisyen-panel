import React from "react";

/** Kullanıcı tercihi: açık, koyu veya sistem (işletim sistemi) teması. */
export type ThemeMode = "light" | "dark" | "system";
/** DOM'a uygulanan çözülmüş tema (yalnızca açık/koyu). */
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "dp_theme";

const isThemeMode = (value: unknown): value is ThemeMode =>
  value === "light" || value === "dark" || value === "system";

/** localStorage'dan kayıtlı tercihi okur; yoksa/bozuksa güvenle "light". */
export const readStoredTheme = (): ThemeMode => {
  if (typeof window === "undefined") {
    return "light";
  }
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(raw) ? raw : "light";
  } catch {
    return "light";
  }
};

const prefersDark = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-color-scheme: dark)").matches;

/** Tercihi gerçek (açık/koyu) temaya çözer. */
export const resolveTheme = (mode: ThemeMode): ResolvedTheme =>
  mode === "system" ? (prefersDark() ? "dark" : "light") : mode;

/** Çözülmüş temayı tek yerden <html data-theme> özniteliğine yazar. */
const applyResolvedTheme = (resolved: ResolvedTheme): void => {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.dataset.theme = resolved;
};

interface ThemeContextValue {
  /** Kullanıcının seçtiği mod (light/dark/system). */
  theme: ThemeMode;
  /** DOM'a uygulanan gerçek tema (light/dark). */
  resolvedTheme: ResolvedTheme;
  /** Temayı değiştirir ve anında kalıcı hale getirir. */
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = React.useState<ThemeMode>(() => readStoredTheme());
  const [resolvedTheme, setResolvedTheme] = React.useState<ResolvedTheme>(() => resolveTheme(readStoredTheme()));

  // Tercih değiştikçe çözülmüş temayı hesapla ve DOM'a uygula (tek kaynak).
  React.useEffect(() => {
    const resolved = resolveTheme(theme);
    setResolvedTheme(resolved);
    applyResolvedTheme(resolved);
  }, [theme]);

  // "Sistem" modunda işletim sistemi teması değişirse canlı takip et.
  React.useEffect(() => {
    if (theme !== "system" || typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const resolved = prefersDark() ? "dark" : "light";
      setResolvedTheme(resolved);
      applyResolvedTheme(resolved);
    };
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [theme]);

  const setTheme = React.useCallback((mode: ThemeMode) => {
    setThemeState(mode);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(THEME_STORAGE_KEY, mode);
      } catch {
        // depolama kullanılamıyor — yoksay
      }
    }
  }, []);

  const value = React.useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme, <ThemeProvider> içinde kullanılmalıdır.");
  }
  return context;
};
