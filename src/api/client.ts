import {
  API_BASE_URL,
  API_VERSION,
  REFRESH_TOKEN_STORAGE_KEY
} from "./config";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly issues?: Array<{ field?: string; message: string }>;
  readonly traceId?: string;

  constructor(
    status: number,
    code: string,
    message: string,
    options?: { issues?: Array<{ field?: string; message: string }>; traceId?: string }
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.issues = options?.issues;
    this.traceId = options?.traceId;
  }
}

export const isApiError = (value: unknown): value is ApiError => value instanceof ApiError;

const NETWORK_MESSAGE = "Sunucuya ulaşılamıyor. Bağlantınızı ve API adresini kontrol edip tekrar deneyin.";
const SESSION_EXPIRED_MESSAGE = "Oturumunuzun süresi doldu. Lütfen tekrar giriş yapın.";

/* -------------------------------------------------------------------------- */
/* Token yöneticisi — access bellekte, refresh sessionStorage'da              */
/* -------------------------------------------------------------------------- */

let accessToken: string | null = null;
let accessExpiresAt = 0;
let refreshToken: string | null = null;
const sessionListeners = new Set<() => void>();

const safeSessionGet = (key: string): string | null => {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeSessionSet = (key: string, value: string | null): void => {
  try {
    if (typeof window === "undefined") return;
    if (value === null) {
      window.sessionStorage.removeItem(key);
    } else {
      window.sessionStorage.setItem(key, value);
    }
  } catch {
    // sessionStorage kullanılamıyorsa token yalnız bellekte kalır.
  }
};

// Sayfa yenilendiğinde refresh token'ı geri yükle; access token yeniden alınacak.
refreshToken = safeSessionGet(REFRESH_TOKEN_STORAGE_KEY);

export const setTokens = (tokens: { token: string; refreshToken?: string | null; expiresAt?: string | null }): void => {
  accessToken = tokens.token;
  const parsed = tokens.expiresAt ? Date.parse(tokens.expiresAt) : Number.NaN;
  accessExpiresAt = Number.isFinite(parsed) ? parsed : Date.now() + 30 * 60 * 1000;
  if (tokens.refreshToken !== undefined) {
    refreshToken = tokens.refreshToken;
    safeSessionSet(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
  }
};

export const clearTokens = (): void => {
  accessToken = null;
  accessExpiresAt = 0;
  refreshToken = null;
  safeSessionSet(REFRESH_TOKEN_STORAGE_KEY, null);
  sessionListeners.forEach((listener) => listener());
};

export const getAccessToken = (): string | null => accessToken;
export const getRefreshToken = (): string | null => refreshToken;
export const hasRefreshToken = (): boolean => Boolean(refreshToken);
export const getAccessExpiresAt = (): number => accessExpiresAt;

export const onSessionCleared = (listener: () => void): (() => void) => {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
};

/* -------------------------------------------------------------------------- */
/* İstek katmanı                                                              */
/* -------------------------------------------------------------------------- */

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** false ise Authorization eklenmez (giriş/yenile). */
  auth?: boolean;
  /** Aynı istek tekrarında aynı anahtar kullanılmalı. */
  idempotencyKey?: string;
  query?: Record<string, string | number | undefined | null>;
  /** İç kullanım: 401 sonrası tekrar denemeyi engeller. */
  _retried?: boolean;
};

const buildUrl = (path: string, query?: RequestOptions["query"]): string => {
  if (!API_BASE_URL) {
    throw new ApiError(0, "YAPILANDIRMA_YOK", "API adresi tanımlı değil (VITE_API_BASE_URL).");
  }
  const url = new URL(
    `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`,
    typeof window !== "undefined" ? window.location.origin : undefined
  );
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
};

const newIdempotencyKey = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

type Envelope<T> = { data?: T; meta?: unknown; traceId?: string };

const parseBody = async (response: Response): Promise<unknown> => {
  if (response.status === 204) {
    return undefined;
  }
  const text = await response.text();
  if (!text) {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const toApiError = (response: Response, payload: unknown): ApiError => {
  const envelope = payload as { error?: { code?: string; message?: string; issues?: ApiError["issues"]; traceId?: string } } | undefined;
  const error = envelope?.error;
  return new ApiError(response.status, error?.code ?? `HTTP_${response.status}`, error?.message ?? "İstek tamamlanamadı.", {
    issues: error?.issues,
    traceId: error?.traceId
  });
};

const unwrap = <T>(payload: unknown): T => {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as Envelope<T>).data as T;
  }
  return payload as T;
};

/**
 * Yenileme sonucu:
 * - "ok": yeni token alındı
 * - "invalid": sunucu reddetti → oturum kapatılır
 * - "network": sunucuya ulaşılamadı → oturum KORUNUR (kısa kopukluk kullanıcıyı dışarı atmasın)
 */
type RefreshResult = "ok" | "invalid" | "network";

let refreshInFlight: Promise<RefreshResult> | null = null;

const refreshAccessToken = async (): Promise<RefreshResult> => {
  if (!refreshToken) {
    return "invalid";
  }
  const response = await fetch(buildUrl("/panel/auth/yenile"), {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Version": API_VERSION },
    body: JSON.stringify({ refreshToken })
  }).catch(() => null);

  if (!response) {
    return "network";
  }
  if (!response.ok) {
    // 5xx geçici sunucu hatasıdır; oturumu yalnız açık reddetmede (4xx) kapat.
    if (response.status >= 500) {
      return "network";
    }
    clearTokens();
    return "invalid";
  }

  const payload = await parseBody(response);
  const result = payload as { token?: string; refreshToken?: string; expiresAt?: string } | undefined;
  if (!result?.token || !result.refreshToken) {
    clearTokens();
    return "invalid";
  }
  setTokens({ token: result.token, refreshToken: result.refreshToken, expiresAt: result.expiresAt ?? null });
  return "ok";
};

const sharedRefresh = (): Promise<RefreshResult> => {
  if (!refreshInFlight) {
    refreshInFlight = refreshAccessToken().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
};

const ensureFreshToken = async (): Promise<RefreshResult> => {
  if (accessToken && accessExpiresAt - Date.now() > 15_000) {
    return "ok";
  }
  return sharedRefresh();
};

/** Yenileme sonucuna göre hata fırlatır; "ok" ise bir şey yapmaz. */
const throwForRefreshResult = (result: RefreshResult): void => {
  if (result === "network") {
    throw new ApiError(0, "AG_YOK", NETWORK_MESSAGE);
  }
  if (result === "invalid") {
    clearTokens();
    throw new ApiError(401, "OTURUM_GECERSIZ", SESSION_EXPIRED_MESSAGE);
  }
};

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true, idempotencyKey, _retried = false } = options;

  if (auth) {
    throwForRefreshResult(await ensureFreshToken());
  }

  const headers: Record<string, string> = { "X-Api-Version": API_VERSION };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (auth && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  const write = method !== "GET" && method !== "DELETE";
  const requestKey = write ? idempotencyKey ?? newIdempotencyKey() : undefined;
  if (write && requestKey) {
    headers["Idempotency-Key"] = requestKey;
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    throw new ApiError(0, "AG_YOK", NETWORK_MESSAGE);
  }

  if (response.status === 401 && auth) {
    if (_retried) {
      clearTokens();
      throw new ApiError(401, "OTURUM_GECERSIZ", SESSION_EXPIRED_MESSAGE);
    }
    throwForRefreshResult(await sharedRefresh());
    return request<T>(path, { ...options, _retried: true, idempotencyKey: requestKey });
  }

  if (response.status === 429 && !_retried) {
    // Hız sınırı: kısa bir beklemeden sonra yalnızca bir kez tekrar dene.
    await sleep(800);
    return request<T>(path, { ...options, _retried: true, idempotencyKey: requestKey });
  }

  const payload = await parseBody(response);
  if (!response.ok) {
    throw toApiError(response, payload);
  }
  return unwrap<T>(payload);
}

export const apiGet = <T>(path: string, query?: RequestOptions["query"]) => request<T>(path, { query });
export const apiPost = <T>(path: string, body?: unknown, idempotencyKey?: string) =>
  request<T>(path, { method: "POST", body, idempotencyKey });
export const apiPut = <T>(path: string, body?: unknown, idempotencyKey?: string) =>
  request<T>(path, { method: "PUT", body, idempotencyKey });
export const apiPatch = <T>(path: string, body?: unknown, idempotencyKey?: string) =>
  request<T>(path, { method: "PATCH", body, idempotencyKey });
export const apiDelete = <T>(path: string) => request<T>(path, { method: "DELETE" });

export const errorMessage = (error: unknown): string => {
  if (isApiError(error)) {
    return error.message;
  }
  return error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu.";
};
