/// <reference types="vite/client" />

/**
 * Panel API yapılandırması.
 *
 * - Geliştirmede varsayılan `http`, üretim derlemesinde varsayılan `mock`'tur.
 *   Üretimde gerçek API için `VITE_API_MODE=http` ve `VITE_API_BASE_URL` birlikte verilmelidir;
 *   `http` seçilip taban adres yoksa derleme `vite.config.ts` içinde hata verir.
 * - Taban adres koda gömülmez; yalnız ortam değişkeninden okunur.
 */
export type ApiMode = "mock" | "http";

const rawMode = (import.meta.env.VITE_API_MODE as string | undefined)?.trim().toLowerCase();
const isProductionBuild = Boolean(import.meta.env.PROD);

export const API_MODE: ApiMode =
  rawMode === "http" || rawMode === "mock" ? (rawMode as ApiMode) : isProductionBuild ? "mock" : "http";

export const IS_HTTP = API_MODE === "http";

const rawBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ?? "";

export const API_BASE_URL = (rawBase || (isProductionBuild ? "" : "http://localhost:3000")).replace(/\/+$/, "");

/** CSP `connect-src` için API kökeni (yol değil). Derleme zamanında taban adresten üretilir. */
export const API_ORIGIN = (() => {
  if (!API_BASE_URL) {
    return "";
  }
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return "";
  }
})();

/** Yenileme token'ı sekme kapanınca silinir (XSS yüzeyini küçültmek için sessionStorage). */
export const REFRESH_TOKEN_STORAGE_KEY = "nutricare.refresh_token";
/** Hareketsizlik sayacının bitiş zamanı — sunucu verisi değil, oturum meta verisidir. */
export const IDLE_EXPIRES_STORAGE_KEY = "nutricare.idle_expires_at";
/** Giriş yapan diyetisyenin görünen adı/e-postası (hassas veri değil). */
export const SESSION_USER_STORAGE_KEY = "nutricare.session_user";

export const API_VERSION = "1";

/**
 * http moduna geçildiğinde eski mock/demo çalışmasından kalan sunucu verisi anahtarlarını temizler.
 * İstemci tercihleri (tema, UI, plan taslağı, sepet/okundu tercihi) korunur.
 */
export const purgeLegacyServerStorage = (): void => {
  if (!IS_HTTP || typeof window === "undefined") {
    return;
  }
  const keep = new Set([
    "dp_theme",
    "dp_ui",
    "dp_plan_items",
    "dp_plan_repeat",
    "dp_plan_name",
    "dp_plan_patient",
    "dp_plan_notes",
    "dp_plan_profile",
    "dp_plan_activity",
    "dp_plan_goal",
    "dp_plan_macros",
    "dp_feed_last_read_at"
  ]);
  const serverPrefixes = [
    "dp_auth",
    "dp_patients",
    "dp_measurements",
    "dp_patient_plans",
    "dp_patient_notes",
    "dp_patient_reminders",
    "dp_meal_grid_",
    "dp_mobile_events",
    "dp_appointments",
    "dp_notifications",
    "dp_alert_",
    "dp_report_sent_",
    "dp_clinic_settings_",
    "dp_patient_links",
    "dp_export_audit_log"
  ];
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && !keep.has(key) && serverPrefixes.some((prefix) => key.startsWith(prefix))) {
        keys.push(key);
      }
    }
    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // depolama erişilemiyorsa yapılacak bir şey yok
  }
};

purgeLegacyServerStorage();
