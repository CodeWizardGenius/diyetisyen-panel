import { SESSION_USER_STORAGE_KEY } from "./config";
import { apiGet, apiPost, clearTokens, hasRefreshToken, request, setTokens } from "./client";
import type { Me, SessionResult } from "./types";

const saveUser = (user: string): void => {
  try {
    window.sessionStorage.setItem(SESSION_USER_STORAGE_KEY, user);
  } catch {
    // yoksay
  }
};

export const getStoredUser = (): string | null => {
  try {
    return window.sessionStorage.getItem(SESSION_USER_STORAGE_KEY);
  } catch {
    return null;
  }
};

const displayNameOf = (user: SessionResult["user"], email: string): string => {
  if (typeof user === "string" && user.trim()) return user;
  if (user && typeof user === "object") {
    const name = typeof user.name === "string" ? user.name.trim() : "";
    const userEmail = typeof user.email === "string" ? user.email : email;
    return name || userEmail;
  }
  return email;
};

export const authApi = {
  async giris(email: string, sifre: string): Promise<{ user: string; expiresAt: number }> {
    const result = await request<SessionResult>("/panel/auth/giris", {
      method: "POST",
      body: { email, sifre },
      auth: false
    });
    if (!result?.token || !result.refreshToken) {
      throw new Error("Giriş yanıtı beklenen biçimde değil.");
    }
    setTokens({ token: result.token, refreshToken: result.refreshToken, expiresAt: result.expiresAt });
    const user = displayNameOf(result.user, email);
    saveUser(user);
    return { user, expiresAt: Date.parse(result.expiresAt) || Date.now() + 30 * 60 * 1000 };
  },

  /** Sayfa yenilendiğinde refresh token ile oturumu geri yükler. */
  async yenile(): Promise<boolean> {
    if (!hasRefreshToken()) {
      return false;
    }
    try {
      await request<unknown>("/panel/ben", { auth: true });
      return true;
    } catch {
      return false;
    }
  },

  async ben(): Promise<Me> {
    return apiGet<Me>("/panel/ben");
  },

  async cikis(): Promise<void> {
    try {
      await apiPost<void>("/panel/auth/cikis");
    } catch {
      // Sunucuya ulaşılamasa bile yerel oturum kapatılır.
    } finally {
      clearTokens();
    }
  },

  async sifreDegistir(eski: string, yeni: string): Promise<void> {
    await apiPost<void>("/panel/auth/sifre-degistir", { eski, yeni });
  }
};
