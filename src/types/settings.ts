/** Klinik diyetisyen ayarları için merkezi tip tanımları ve kalıcı depolama yardımcıları. */

export type BmrFormula = "mifflin" | "harris";

export type SettingsSectionKey = "profil" | "beslenme" | "bildirim" | "calisma" | "guvenlik";

export interface MacroPreset {
  id: string;
  label: string;
  carbsPct: number;
  proteinPct: number;
  fatPct: number;
}

export interface MealSlot {
  id: string;
  label: string;
  /** "HH:MM" formatında */
  time: string;
}

export interface ReminderSlot {
  id: string;
  label: string;
  /** "HH:MM" formatında */
  time: string;
}

export interface WorkingDay {
  day: string;
  enabled: boolean;
  /** "HH:MM" */
  start: string;
  /** "HH:MM" */
  end: string;
}

export interface ProfileSettings {
  dietitianName: string;
  title: string;
  diplomaNo: string;
  clinicName: string;
  phone: string;
  email: string;
  /** Diyet listesi PDF çıktısının alt bilgi metni */
  footerText: string;
}

export interface NutritionSettings {
  bmrFormula: BmrFormula;
  macroPresetId: string;
  customMacros: { carbsPct: number; proteinPct: number; fatPct: number };
  /** ml/kg cinsinden hidrasyon çarpanı */
  hydrationMlPerKg: number;
  mealSlots: MealSlot[];
}

export interface NotificationSettings {
  reminderSlots: ReminderSlot[];
  /** Uyum bu yüzdenin altına düşerse uyar */
  complianceThreshold: number;
  /** İşaretlenmeyen öğün eşiği (saat) */
  missedMealHours: number;
  /** Sessiz saat başlangıcı "HH:MM" */
  quietStart: string;
  /** Sessiz saat bitişi "HH:MM" */
  quietEnd: string;
}

export interface ScheduleSettings {
  workingDays: WorkingDay[];
  /** Varsayılan görüşme süresi (dk) */
  defaultDurationMin: 30 | 45 | 60;
  /** Randevular arası tampon süre (dk) */
  bufferMin: number;
}

export interface SecuritySettings {
  /** Oturum zaman aşımı (dk) — localStorage auth sayacına bağlanır */
  sessionTimeoutMin: number;
}

export interface ClinicSettings {
  profile: ProfileSettings;
  nutrition: NutritionSettings;
  notifications: NotificationSettings;
  schedule: ScheduleSettings;
  security: SecuritySettings;
}

/** Danışan dışa aktarımı için SettingsView'a prop olarak geçen minimal veri şekli. */
export interface SettingsPatient {
  id: number;
  name: string;
  plan: string;
  compliance: number;
  status: string;
  /** Yedekleme/geri yükleme için opsiyonel tam alanlar. */
  startDate?: string;
  endDate?: string;
  lastAction?: string;
}

export interface MeasurementLike {
  date: string;
  weightKg: number;
  heightCm: number;
  bodyFatPercentage: number;
  muscleMassKg: number;
  waistCm: number;
  hipCm: number;
  notes?: string;
}

export const MACRO_PRESETS: MacroPreset[] = [
  { id: "balanced", label: "Dengeli 50/20/30", carbsPct: 50, proteinPct: 20, fatPct: 30 },
  { id: "lowcarb", label: "Düşük Karb 25/35/40", carbsPct: 25, proteinPct: 35, fatPct: 40 },
  { id: "highprotein", label: "Yüksek Protein 40/35/25", carbsPct: 40, proteinPct: 35, fatPct: 25 },
  { id: "custom", label: "Özel", carbsPct: 50, proteinPct: 20, fatPct: 30 }
];

const DEFAULT_MEAL_SLOTS: MealSlot[] = [
  { id: "kahvalti", label: "Kahvaltı", time: "09:00" },
  { id: "ara1", label: "Ara 1", time: "11:00" },
  { id: "ogle", label: "Öğle", time: "13:30" },
  { id: "ara2", label: "Ara 2", time: "16:30" },
  { id: "aksam", label: "Akşam", time: "19:30" },
  { id: "gece", label: "Gece Ara", time: "22:30" }
];

const DEFAULT_REMINDER_SLOTS: ReminderSlot[] = DEFAULT_MEAL_SLOTS.map((slot) => ({ ...slot }));

const DEFAULT_WORKING_DAYS: WorkingDay[] = [
  { day: "Pazartesi", enabled: true, start: "09:00", end: "18:00" },
  { day: "Salı", enabled: true, start: "09:00", end: "18:00" },
  { day: "Çarşamba", enabled: true, start: "09:00", end: "18:00" },
  { day: "Perşembe", enabled: true, start: "09:00", end: "18:00" },
  { day: "Cuma", enabled: true, start: "09:00", end: "18:00" },
  { day: "Cumartesi", enabled: true, start: "10:00", end: "14:00" },
  { day: "Pazar", enabled: false, start: "10:00", end: "14:00" }
];

export const DEFAULT_SETTINGS: ClinicSettings = {
  profile: {
    dietitianName: "Uzm. Dyt. NutriCare",
    title: "Uzman Diyetisyen",
    diplomaNo: "",
    clinicName: "NutriCare Beslenme Kliniği",
    phone: "",
    email: "",
    footerText: "Bu liste bilgilendirme amaçlıdır. Herhangi bir sağlık sorununuzda hekiminize danışın."
  },
  nutrition: {
    bmrFormula: "mifflin",
    macroPresetId: "balanced",
    customMacros: { carbsPct: 50, proteinPct: 20, fatPct: 30 },
    hydrationMlPerKg: 35,
    mealSlots: DEFAULT_MEAL_SLOTS.map((slot) => ({ ...slot }))
  },
  notifications: {
    reminderSlots: DEFAULT_REMINDER_SLOTS.map((slot) => ({ ...slot })),
    complianceThreshold: 70,
    missedMealHours: 4,
    quietStart: "23:00",
    quietEnd: "08:00"
  },
  schedule: {
    workingDays: DEFAULT_WORKING_DAYS.map((day) => ({ ...day })),
    defaultDurationMin: 30,
    bufferMin: 10
  },
  security: {
    sessionTimeoutMin: 30
  }
};

export const SETTINGS_STORAGE_KEY = "dp_clinic_settings_v1";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const mergeWithDefaults = (stored: Record<string, unknown>): ClinicSettings => ({
  profile: { ...DEFAULT_SETTINGS.profile, ...((isRecord(stored.profile) ? stored.profile : {}) as Partial<ProfileSettings>) },
  nutrition: {
    ...DEFAULT_SETTINGS.nutrition,
    ...((isRecord(stored.nutrition) ? stored.nutrition : {}) as Partial<NutritionSettings>),
    customMacros: {
      ...DEFAULT_SETTINGS.nutrition.customMacros,
      ...((isRecord(stored.nutrition) && isRecord((stored.nutrition as Record<string, unknown>).customMacros)
        ? (stored.nutrition as Record<string, unknown>).customMacros
        : {}) as Partial<NutritionSettings["customMacros"]>)
    },
    mealSlots: Array.isArray((stored.nutrition as Record<string, unknown> | undefined)?.mealSlots)
      ? ((stored.nutrition as Record<string, unknown>).mealSlots as MealSlot[])
      : DEFAULT_SETTINGS.nutrition.mealSlots.map((slot) => ({ ...slot }))
  },
  notifications: {
    ...DEFAULT_SETTINGS.notifications,
    ...((isRecord(stored.notifications) ? stored.notifications : {}) as Partial<NotificationSettings>),
    reminderSlots: Array.isArray((stored.notifications as Record<string, unknown> | undefined)?.reminderSlots)
      ? ((stored.notifications as Record<string, unknown>).reminderSlots as ReminderSlot[])
      : DEFAULT_SETTINGS.notifications.reminderSlots.map((slot) => ({ ...slot }))
  },
  schedule: {
    ...DEFAULT_SETTINGS.schedule,
    ...((isRecord(stored.schedule) ? stored.schedule : {}) as Partial<ScheduleSettings>),
    workingDays: Array.isArray((stored.schedule as Record<string, unknown> | undefined)?.workingDays)
      ? ((stored.schedule as Record<string, unknown>).workingDays as WorkingDay[])
      : DEFAULT_SETTINGS.schedule.workingDays.map((day) => ({ ...day }))
  },
  security: { ...DEFAULT_SETTINGS.security, ...((isRecord(stored.security) ? stored.security : {}) as Partial<SecuritySettings>) }
});

/** localStorage'dan ayarları okur; bozuk/eksik veride varsayılanlarla birleştirir. */
export const loadSettings = (): ClinicSettings => {
  if (typeof window === "undefined") {
    return structuredCloneSafe(DEFAULT_SETTINGS);
  }
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return structuredCloneSafe(DEFAULT_SETTINGS);
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return structuredCloneSafe(DEFAULT_SETTINGS);
    }
    return mergeWithDefaults(parsed);
  } catch {
    return structuredCloneSafe(DEFAULT_SETTINGS);
  }
};

const structuredCloneSafe = (value: ClinicSettings): ClinicSettings =>
  JSON.parse(JSON.stringify(value)) as ClinicSettings;

/** Ayarları localStorage'a yazar. */
export const saveSettings = (settings: ClinicSettings): void => {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
};

export interface BmrPersonInput {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: "kadin" | "erkek";
}

/**
 * Seçili formüle göre bazal metabolizma hızı.
 * Mifflin-St Jeor: 10·kg + 6.25·cm − 5·yaş + 5 (erkek) / −161 (kadın)
 * Harris-Benedict (revize): erkek 88.362 + 13.397·kg + 4.799·cm − 5.677·yaş,
 * kadın 447.593 + 9.247·kg + 3.098·cm − 4.330·yaş
 */
export const calculateBmrWithFormula = (input: BmrPersonInput, formula: BmrFormula): number => {
  if (!input.weightKg || !input.heightCm || !input.age) {
    return 0;
  }
  if (formula === "harris") {
    const value =
      input.sex === "erkek"
        ? 88.362 + 13.397 * input.weightKg + 4.799 * input.heightCm - 5.677 * input.age
        : 447.593 + 9.247 * input.weightKg + 3.098 * input.heightCm - 4.33 * input.age;
    return Math.round(value);
  }
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age;
  return Math.round(input.sex === "erkek" ? base + 5 : base - 161);
};

export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const isValidTime = (value: string): boolean => TIME_PATTERN.test(value.trim());

export const isValidEmail = (value: string): boolean =>
  value.trim() === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
