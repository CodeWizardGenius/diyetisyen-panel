/** Uyarı & Risk Yönetim Merkezi için veri modelleri ve kalıcı depolama yardımcıları. */

import { loadSettings } from "./settings";

export type AlertSeverity = "critical" | "warning" | "info";
export type AlertCategory =
  | "adherence"
  | "missed_meal"
  | "plan_expiration"
  | "package_expiration"
  | "weight_plateau"
  | "weight_gain"
  | "inactivity"
  | "water_target";

export type PatientAlert = {
  id: string;
  patientId: number;
  patientName: string;
  patientPlan: string;
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  description: string;
  /** ISO tarih-saat */
  timestamp: string;
  isResolved: boolean;
};

export type AlertRules = {
  complianceThreshold: number; // e.g. 70%
  missedMealHours: number; // e.g. 4 hours
  planExpiryNoticeDays: number; // e.g. 7 days
  plateauWeeks: number; // e.g. 2 weeks of stable weight
  /** Kaç gündür veri girmezse "hareketsizlik" uyarısı üretilsin. */
  inactivityDays: number; // e.g. 2 days
  /** Kilo kaç hafta üst üste artarsa uyarılsın. */
  weightGainWeeks: number; // e.g. 2 weeks
  /** Su hedefi kaç gün üst üste tutturulamazsa uyarılsın. */
  waterMissDays: number; // e.g. 3 days
  /** Günlük su hedefi (ml) — danışan kendi hedefini belirtmezse kullanılır. */
  waterGoalMl: number; // e.g. 2000 ml
  /** Paket bitişine kaç gün kala uyarı üretilsin. */
  packageExpiryNoticeDays: number; // e.g. 7 days
  quietHoursEnabled: boolean;
  quietHoursRange: [string, string]; // ["23:00", "07:00"]
  autoNotifyPatient: boolean;
  autoEmailDietitian: boolean;
  autoRenewalPrompt: boolean;
};

export const ALERT_RULES_STORAGE_KEY = "dp_alert_rules_v1";
export const ALERT_STATE_STORAGE_KEY = "dp_alert_state_v1";
export const ALERT_DISMISSED_STORAGE_KEY = "dp_alert_dismissed_v1";

export const DEFAULT_ALERT_RULES: AlertRules = {
  complianceThreshold: 70,
  missedMealHours: 4,
  planExpiryNoticeDays: 7,
  plateauWeeks: 2,
  inactivityDays: 2,
  weightGainWeeks: 2,
  waterMissDays: 3,
  waterGoalMl: 2000,
  packageExpiryNoticeDays: 7,
  quietHoursEnabled: true,
  quietHoursRange: ["23:00", "07:00"],
  autoNotifyPatient: true,
  autoEmailDietitian: true,
  autoRenewalPrompt: true
};

/** Kayıtlı kural yokken kullanılacak varsayılan: Ayarlar > Bildirimler & Risk değerleri. */
export const rulesFromClinicSettings = (): AlertRules => {
  try {
    const clinic = loadSettings();
    return {
      ...DEFAULT_ALERT_RULES,
      complianceThreshold: clinic.notifications.complianceThreshold,
      missedMealHours: clinic.notifications.missedMealHours,
      quietHoursEnabled: true,
      quietHoursRange: [clinic.notifications.quietStart, clinic.notifications.quietEnd]
    };
  } catch {
    return { ...DEFAULT_ALERT_RULES };
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** Çekirdek (ilk sürümden beri var olan) alanları doğrular; yeni alanlar load sırasında varsayılanla doldurulur. */
const isValidRules = (value: Record<string, unknown>): boolean =>
  typeof value.complianceThreshold === "number" &&
  typeof value.missedMealHours === "number" &&
  typeof value.planExpiryNoticeDays === "number" &&
  typeof value.quietHoursEnabled === "boolean" &&
  Array.isArray(value.quietHoursRange) &&
  typeof value.autoNotifyPatient === "boolean" &&
  typeof value.autoEmailDietitian === "boolean";

/** Kayıtlı kuralları okur; yoksa/bozuksa `fallback` (önce klinik ayarları) kullanır. */
export const loadAlertRules = (fallback?: AlertRules): AlertRules => {
  const base: AlertRules = fallback ?? { ...DEFAULT_ALERT_RULES };
  if (typeof window === "undefined") {
    return { ...base };
  }
  try {
    const raw = localStorage.getItem(ALERT_RULES_STORAGE_KEY);
    if (!raw) {
      return { ...base };
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || !isValidRules(parsed)) {
      return { ...base };
    }
    return {
      complianceThreshold: parsed.complianceThreshold as number,
      missedMealHours: parsed.missedMealHours as number,
      planExpiryNoticeDays: parsed.planExpiryNoticeDays as number,
      plateauWeeks: typeof parsed.plateauWeeks === "number" ? (parsed.plateauWeeks as number) : base.plateauWeeks,
      inactivityDays: typeof parsed.inactivityDays === "number" ? (parsed.inactivityDays as number) : base.inactivityDays,
      weightGainWeeks: typeof parsed.weightGainWeeks === "number" ? (parsed.weightGainWeeks as number) : base.weightGainWeeks,
      waterMissDays: typeof parsed.waterMissDays === "number" ? (parsed.waterMissDays as number) : base.waterMissDays,
      waterGoalMl: typeof parsed.waterGoalMl === "number" ? (parsed.waterGoalMl as number) : base.waterGoalMl,
      packageExpiryNoticeDays:
        typeof parsed.packageExpiryNoticeDays === "number"
          ? (parsed.packageExpiryNoticeDays as number)
          : base.packageExpiryNoticeDays,
      quietHoursEnabled: parsed.quietHoursEnabled as boolean,
      quietHoursRange: (parsed.quietHoursRange as [string, string]).slice(0, 2) as [string, string],
      autoNotifyPatient: parsed.autoNotifyPatient as boolean,
      autoEmailDietitian: parsed.autoEmailDietitian as boolean,
      autoRenewalPrompt:
        typeof parsed.autoRenewalPrompt === "boolean" ? (parsed.autoRenewalPrompt as boolean) : base.autoRenewalPrompt
    };
  } catch {
    return { ...base };
  }
};

export const saveAlertRules = (rules: AlertRules): void => {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(ALERT_RULES_STORAGE_KEY, JSON.stringify(rules));
};

/**
 * Ayarlar > Bildirimler & Risk ile ortak alanları (uyum eşiği, kaçan öğün saati, sessiz saatler)
 * kayıtlı kurallara yansıtır. Kayıtlı kural yoksa bir şey yapmaz — o durumda zaten klinik ayarlar kullanılır.
 */
export const syncAlertRulesWithClinic = (clinic: {
  complianceThreshold: number;
  missedMealHours: number;
  quietStart: string;
  quietEnd: string;
}): void => {
  if (typeof window === "undefined" || !localStorage.getItem(ALERT_RULES_STORAGE_KEY)) {
    return;
  }
  const current = loadAlertRules();
  saveAlertRules({
    ...current,
    complianceThreshold: clinic.complianceThreshold,
    missedMealHours: clinic.missedMealHours,
    quietHoursRange: [clinic.quietStart, clinic.quietEnd]
  });
};

/** Çözüldü olarak işaretlenen uyarı id'leri (motor yeniden üretse bile korunur). */
export const loadResolvedIds = (): string[] => {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = localStorage.getItem(ALERT_STATE_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as unknown[]).filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
};

export const saveResolvedIds = (ids: string[]): void => {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(ALERT_STATE_STORAGE_KEY, JSON.stringify(ids));
};

/** Kalıcı olarak silinen (gizlenen) uyarı id'leri — motor yeniden üretse bile gösterilmez. */
export const loadDismissedIds = (): string[] => {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = localStorage.getItem(ALERT_DISMISSED_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as unknown[]).filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
};

export const saveDismissedIds = (ids: string[]): void => {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(ALERT_DISMISSED_STORAGE_KEY, JSON.stringify(ids));
};

export const SEVERITY_META: Record<AlertSeverity, { label: string; rank: number; accent: string }> = {
  critical: { label: "Kritik", rank: 0, accent: "#ef4444" },
  warning: { label: "Uyarı", rank: 1, accent: "#f59e0b" },
  info: { label: "Bilgi", rank: 2, accent: "#3b82f6" }
};

export const CATEGORY_META: Record<AlertCategory, { label: string }> = {
  adherence: { label: "Uyum" },
  missed_meal: { label: "Kaçan Öğün" },
  plan_expiration: { label: "Plan Bitişi" },
  package_expiration: { label: "Paket & Ödeme" },
  weight_plateau: { label: "Kilo Platosu" },
  weight_gain: { label: "Kilo Artışı" },
  inactivity: { label: "Veri Akışı" },
  water_target: { label: "Su Hedefi" }
};
