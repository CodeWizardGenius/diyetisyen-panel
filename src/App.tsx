import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from "recharts";
import {
  LayoutDashboard,
  Users,
  Salad,
  CalendarDays,
  Bell,
  Settings,
  Search,
  Menu,
  X,
  LogOut,
  MessageSquare,

  Clock,
  CheckCircle2,
  Leaf,
  ChefHat,
  ClipboardList,
  Ruler,
  StickyNote,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Scale,
  Activity,
  UtensilsCrossed,
  Timer,
  Flame,
  Wheat,
  Beef,
  Droplet,
  Printer,
  Plus,
  Trash2,
  GripVertical,
  Calculator,
  FileText,
  ShieldCheck,
  ShieldAlert
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { SettingsView } from "./components/settings/SettingsView";
import { AlertsView } from "./components/alerts/AlertsView";
import { LandingPage } from "./components/landing/LandingPage";
import { LegalView, legalSlugFromPath } from "./components/landing/LegalPages";
import { ActivityFeed } from "./components/dashboard/ActivityFeed";
import { PriorityList } from "./components/dashboard/PriorityList";
import { buildPriorityList } from "./components/dashboard/priority";
import { PatientTimeline } from "./components/patient/PatientTimeline";
import { AppointmentSummary } from "./components/appointments/AppointmentSummary";
import { MessageComposer } from "./components/messaging/MessageComposer";
import {
  clearMobileEvents,
  consentStatusOf,
  ingestMobileEvent,
  latestConsentFor,
  MOBILE_EVENTS_CHANGED,
  readMobileEvents,
  removePatientMobileEvents,
  type ConsentPayload,
  type ConsentStatus,
  type MobileEvent
} from "./types/mobileData";
import { DEMO_PATIENTS, type Patient, type PatientStatus } from "./data/demo";
import { buildAlerts, isQuietNow, timeAgoTr } from "./components/alerts/alertEngine";
import {
  calculateBmrWithFormula,
  isValidTime,
  loadSettings,
  MACRO_PRESETS,
  SETTINGS_STORAGE_KEY,
  type BmrFormula,
  type MeasurementLike,
  type ProfileSettings,
  type ScheduleSettings,
  type SettingsSectionKey
} from "./types/settings";
import {
  ALERT_RULES_STORAGE_KEY,
  loadAlertRules,
  loadDismissedIds,
  loadResolvedIds,
  rulesFromClinicSettings,
  SEVERITY_META,
  type PatientAlert
} from "./types/alerts";
import { THEME_STORAGE_KEY } from "./context/ThemeContext";

type Measurement = {
  id: string;
  date: string; // ISO YYYY-MM-DD
  weightKg: number;
  heightCm: number;
  bodyFatPercentage: number;
  muscleMassKg: number;
  waistCm: number;
  hipCm: number;
  notes?: string;
};

type BMICategory = "Zayıf" | "Normal" | "Fazla Kilolu" | "Obez";

const calculateBMI = (weightKg: number, heightCm: number): number => {
  if (!weightKg || !heightCm || heightCm <= 0) {
    return 0;
  }
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  return Math.round(bmi * 10) / 10;
};

const getBMICategory = (bmi: number): BMICategory => {
  if (bmi < 18.5) {
    return "Zayıf";
  }
  if (bmi < 25) {
    return "Normal";
  }
  if (bmi < 30) {
    return "Fazla Kilolu";
  }
  return "Obez";
};

const formatDelta = (current: number, previous: number, unit: string, decimals = 1): string => {
  const diff = current - previous;
  if (Math.abs(diff) < 0.0001) {
    return `0 ${unit}`;
  }
  const sign = diff > 0 ? "+" : "-";
  return `${sign}${Math.abs(diff).toFixed(decimals)} ${unit}`;
};

type Sex = "kadin" | "erkek";
type ActivityLevel = "sedanter" | "hafif" | "orta" | "aktif" | "cokAktif";
type WeightGoal = "verme" | "koruma" | "alma";

type BmrInput = {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
};

type MacroSplit = {
  carbsPct: number;
  proteinPct: number;
  fatPct: number;
};

type CalorieTarget = {
  bmr: number;
  tdee: number;
  targetCalories: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
};

const ACTIVITY_FACTORS: Record<ActivityLevel, { factor: number; label: string }> = {
  sedanter: { factor: 1.2, label: "Sedanter (egzersiz yok)" },
  hafif: { factor: 1.375, label: "Hafif (haftada 1-3 gün)" },
  orta: { factor: 1.55, label: "Orta (haftada 3-5 gün)" },
  aktif: { factor: 1.725, label: "Aktif (haftada 6-7 gün)" },
  cokAktif: { factor: 1.9, label: "Çok aktif (günde 2 antrenman)" }
};

const GOAL_ADJUSTMENTS: Record<WeightGoal, { delta: number; label: string; macros: MacroSplit }> = {
  verme: { delta: -500, label: "Kilo verme", macros: { carbsPct: 45, proteinPct: 30, fatPct: 25 } },
  koruma: { delta: 0, label: "Koruma", macros: { carbsPct: 50, proteinPct: 20, fatPct: 30 } },
  alma: { delta: 300, label: "Kilo alma", macros: { carbsPct: 55, proteinPct: 20, fatPct: 25 } }
};

const BMR_FORMULA_LABELS: Record<BmrFormula, string> = {
  mifflin: "Mifflin-St Jeor",
  harris: "Harris-Benedict"
};

const calculateTargets = (
  input: BmrInput,
  activity: ActivityLevel,
  goal: WeightGoal,
  macros: MacroSplit,
  formula: BmrFormula
): CalorieTarget => {
  // Formül yalnızca sıfır değeri yakalar; negatif girdide de BMR 0 olsun.
  const safeInput = input.weightKg > 0 && input.heightCm > 0 && input.age > 0 ? input : { ...input, weightKg: 0 };
  const bmr = calculateBmrWithFormula(safeInput, formula);
  const tdee = Math.round(bmr * ACTIVITY_FACTORS[activity].factor);
  const targetCalories = Math.max(1200, tdee + GOAL_ADJUSTMENTS[goal].delta);
  const total = macros.carbsPct + macros.proteinPct + macros.fatPct;
  const safe = total > 0 ? total : 100;
  const carbsG = Math.round(((targetCalories * macros.carbsPct) / safe / 4) * 10) / 10;
  const proteinG = Math.round(((targetCalories * macros.proteinPct) / safe / 4) * 10) / 10;
  const fatG = Math.round(((targetCalories * macros.fatPct) / safe / 9) * 10) / 10;
  return { bmr, tdee, targetCalories, carbsG, proteinG, fatG };
};

type AuthSnapshot = {
  token: string | null;
  user: string | null;
  expiresAt: number;
};

const MOCK_MEASUREMENTS: Record<number, Measurement[]> = {
  1: [
    { id: "m1-1", date: "2025-10-06", weightKg: 88.4, heightCm: 178, bodyFatPercentage: 27.5, muscleMassKg: 60.2, waistCm: 102, hipCm: 108, notes: "Başlangıç ölçümü" },
    { id: "m1-2", date: "2025-10-13", weightKg: 87.1, heightCm: 178, bodyFatPercentage: 26.8, muscleMassKg: 60.5, waistCm: 100.5, hipCm: 107, notes: "" },
    { id: "m1-3", date: "2025-10-20", weightKg: 86.0, heightCm: 178, bodyFatPercentage: 26.1, muscleMassKg: 60.8, waistCm: 99, hipCm: 106, notes: "" },
    { id: "m1-4", date: "2025-10-27", weightKg: 85.2, heightCm: 178, bodyFatPercentage: 25.4, muscleMassKg: 61.1, waistCm: 98, hipCm: 105, notes: "Bel çevresinde iyi düşüş" },
    { id: "m1-5", date: "2025-11-03", weightKg: 83.8, heightCm: 178, bodyFatPercentage: 24.6, muscleMassKg: 61.4, waistCm: 96.5, hipCm: 104, notes: "" }
  ],
  2: [
    { id: "m2-1", date: "2025-10-11", weightKg: 64.2, heightCm: 165, bodyFatPercentage: 24.0, muscleMassKg: 46.0, waistCm: 78, hipCm: 96, notes: "Başlangıç" },
    { id: "m2-2", date: "2025-10-18", weightKg: 63.5, heightCm: 165, bodyFatPercentage: 23.4, muscleMassKg: 46.2, waistCm: 77, hipCm: 95.5, notes: "" },
    { id: "m2-3", date: "2025-10-25", weightKg: 62.8, heightCm: 165, bodyFatPercentage: 22.9, muscleMassKg: 46.3, waistCm: 76, hipCm: 95, notes: "" },
    { id: "m2-4", date: "2025-11-01", weightKg: 62.1, heightCm: 165, bodyFatPercentage: 22.1, muscleMassKg: 46.5, waistCm: 75, hipCm: 94, notes: "" }
  ],
  3: [
    { id: "m3-1", date: "2025-10-08", weightKg: 74.0, heightCm: 170, bodyFatPercentage: 29.0, muscleMassKg: 49.5, waistCm: 88, hipCm: 102, notes: "Başlangıç" },
    { id: "m3-2", date: "2025-10-15", weightKg: 74.3, heightCm: 170, bodyFatPercentage: 29.2, muscleMassKg: 49.4, waistCm: 88.5, hipCm: 102.5, notes: "Uyum düşük, artış var" },
    { id: "m3-3", date: "2025-10-29", weightKg: 73.6, heightCm: 170, bodyFatPercentage: 28.6, muscleMassKg: 49.6, waistCm: 87.5, hipCm: 101.5, notes: "" }
  ]
};

const MEASUREMENTS_STORAGE_KEY = "dp_measurements";

const readStoredMeasurements = (): Record<number, Measurement[]> => {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = localStorage.getItem(MEASUREMENTS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<number, Measurement[]>) : {};
  } catch {
    return {};
  }
};

const writeStoredMeasurements = (patientId: number, list: Measurement[]): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const all = readStoredMeasurements();
    all[patientId] = list;
    localStorage.setItem(MEASUREMENTS_STORAGE_KEY, JSON.stringify(all));
  } catch {
    // depolama kullanılamıyor / kota dolu — sessizce yoksay
  }
};

/** Danışan bazlı kayıtlar: { [patientId]: değer } biçiminde tek bir anahtarda tutulur. */
const PATIENT_PLANS_KEY = "dp_patient_plans";
const PATIENT_NOTES_KEY = "dp_patient_notes";
const PATIENT_REMINDERS_KEY = "dp_patient_reminders";
const mealGridKey = (patientId: number) => `dp_meal_grid_${patientId}`;

const readPatientRecord = <T,>(key: string): Record<number, T> => {
  try {
    const raw = localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<number, T>)
      : {};
  } catch {
    return {};
  }
};

/** Danışanın kaydını yazar; `value` undefined ise kaydı siler. */
const writePatientEntry = <T,>(key: string, patientId: number, value: T | undefined): void => {
  try {
    const all = readPatientRecord<T>(key);
    if (value === undefined) {
      delete all[patientId];
    } else {
      all[patientId] = value;
    }
    localStorage.setItem(key, JSON.stringify(all));
  } catch {
    // depolama kullanılamıyor / kota dolu — sessizce yoksay
  }
};

/** Silinen danışanın tüm yerel kayıtlarını (ölçüm, plan, not, hatırlatma, öğün çizelgesi) temizler. */
const removePatientLocalData = (patientId: number): void => {
  [MEASUREMENTS_STORAGE_KEY, PATIENT_PLANS_KEY, PATIENT_NOTES_KEY, PATIENT_REMINDERS_KEY].forEach((key) => {
    if (patientId in readPatientRecord(key)) {
      writePatientEntry(key, patientId, undefined);
    }
  });
  removePatientMobileEvents(patientId);
  try {
    localStorage.removeItem(mealGridKey(patientId));
  } catch {
    // depolama kullanılamıyor — yoksay
  }
};

/**
 * Yedek geri yüklenirken eski danışanların plan, not, hatırlatma, öğün çizelgesi ve mobil veri
 * akışı kayıtlarını siler; aynı kimlik numarasını alan yeni danışanlara karışmasınlar.
 * Ölçümler içe aktarmada ayrıca yazılır.
 */
const clearPatientScopedStorage = (): void => {
  try {
    [PATIENT_PLANS_KEY, PATIENT_NOTES_KEY, PATIENT_REMINDERS_KEY].forEach((key) => localStorage.removeItem(key));
    const gridKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith("dp_meal_grid_")) {
        gridKeys.push(key);
      }
    }
    gridKeys.forEach((key) => localStorage.removeItem(key));
    clearMobileEvents();
  } catch {
    // depolama kullanılamıyor — yoksay
  }
};

const getInitialMeasurements = (patientId: number): Measurement[] => {
  const stored = readStoredMeasurements()[patientId];
  if (stored) {
    return [...stored].sort((a, b) => a.date.localeCompare(b.date));
  }
  const seed = MOCK_MEASUREMENTS[patientId];
  if (seed) {
    return [...seed].sort((a, b) => a.date.localeCompare(b.date));
  }
  return [];
};

/** Örnek veri: hiçbir danışanın öğün çizelgesinde işaret yokken dashboard grafiklerinde gösterilir. */
const ADHERENCE_SERIES = [
  { day: "1", value: 70 },
  { day: "2", value: 68 },
  { day: "3", value: 72 },
  { day: "4", value: 74 },
  { day: "5", value: 71 },
  { day: "6", value: 76 },
  { day: "7", value: 78 }
];

const MEAL_COMPLETION = [
  { label: "Kahvaltı", done: 85 },
  { label: "Ara 1", done: 78 },
  { label: "Öğle", done: 82 },
  { label: "Ara 2", done: 73 },
  { label: "Akşam", done: 88 },
  { label: "Gece Ara", done: 60 }
];

const AUTH_TOKEN_KEY = "dp_auth_token";
const AUTH_USER_KEY = "dp_auth_user";
const AUTH_EXPIRES_KEY = "dp_auth_expires_at";
const DEFAULT_DURATION_MIN = 30;

const classNames = (...values: Array<string | false | null | undefined>) =>
  values.filter(Boolean).join(" ");

const formatMMSS = (totalSec: number) => {
  const s = Math.max(0, Math.floor(totalSec));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
};

/** localStorage ile senkronize state. SSR ve kota/erişim hatalarına karşı güvenli. */
function usePersistentState<T>(
  key: string,
  initial: T | (() => T)
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = React.useState<T>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(key);
        if (raw !== null) {
          return JSON.parse(raw) as T;
        }
      } catch {
        // bozuk/erişilemez kayıt — başlangıç değerine düş
      }
    }
    return typeof initial === "function" ? (initial as () => T)() : initial;
  });

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // depolama kullanılamıyor / kota dolu — sessizce yoksay
    }
  }, [key, state]);

  return [state, setState];
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal/dialog erişilebilirliği: açılışta ilk alanı odaklar, Tab döngüsünü
 * içeride tutar (focus trap), Escape ile kapatır ve kapanışta odağı geri verir.
 * Döndürülen ref dialog kapsayıcısına bağlanmalıdır.
 */
function useModalDismiss(onClose: () => void) {
  const ref = React.useRef<HTMLDivElement>(null);
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  React.useEffect(() => {
    const node = ref.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const getFocusables = () =>
      Array.from(node?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []).filter(
        (el) => el.offsetParent !== null
      );

    getFocusables()[0]?.focus();

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key === "Tab") {
        const list = getFocusables();
        if (list.length === 0) {
          return;
        }
        const first = list[0];
        const last = list[list.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKey, true);
    return () => {
      document.removeEventListener("keydown", handleKey, true);
      previouslyFocused?.focus?.();
    };
  }, []);

  return ref;
}

/**
 * Geri alınamaz işlemler (danışan/randevu silme) için erişilebilir onay penceresi.
 * Eylem ve iptal butonları arasında odak tuzağı kurar; başlığı `aria-labelledby` ile duyurur.
 */
const ConfirmDialog: React.FC<{
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}> = ({ title, message, confirmLabel = "Sil", cancelLabel = "Vazgeç", onConfirm, onClose }) => {
  const dialogRef = useModalDismiss(onClose);
  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={onClose}
    >
      <div className="modal modal-confirm" ref={dialogRef} onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title" id="confirm-dialog-title">{title}</h3>
        </div>
        <div className="modal-body">{message}</div>
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>{cancelLabel}</button>
          <button type="button" className="btn btn-danger" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
};

const getAuthFromStorage = (): AuthSnapshot => {
  if (typeof window === "undefined") {
    return { token: null, user: null, expiresAt: 0 };
  }

  return {
    token: localStorage.getItem(AUTH_TOKEN_KEY),
    user: localStorage.getItem(AUTH_USER_KEY),
    expiresAt: Number(localStorage.getItem(AUTH_EXPIRES_KEY) || 0)
  };
};

const setAuthToStorage = ({ token, user, expiresAt }: AuthSnapshot) => {
  localStorage.setItem(AUTH_TOKEN_KEY, token ?? "");
  localStorage.setItem(AUTH_USER_KEY, user ?? "");
  localStorage.setItem(AUTH_EXPIRES_KEY, String(expiresAt ?? 0));
};

const clearAuthStorage = () => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  localStorage.removeItem(AUTH_EXPIRES_KEY);
};

/**
 * "Paylaşımlı bilgisayardan çıkış"ta korunacak "dp_" anahtarları: danışan verisi içermeyen arayüz
 * tercihi ve klinik yapılandırması (tema, klinik ayarları, uyarı kuralları). Geri kalan tüm "dp_"
 * anahtarları (danışanlar, ölçümler, randevular, plan taslağı, bildirimler, uyarı durumu…) iz
 * kalmasın diye silinir. Yeni eklenen anahtarlar varsayılan olarak silinir.
 */
const LOGOUT_PRESERVED_KEYS = new Set<string>([THEME_STORAGE_KEY, SETTINGS_STORAGE_KEY, ALERT_RULES_STORAGE_KEY]);

const clearSessionDataStorage = () => {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith("dp_") && !LOGOUT_PRESERVED_KEYS.has(key)) {
        keys.push(key);
      }
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    // depolama erişilemiyor — yapılacak bir şey yok
  }
};

/** Ayarlardaki hareketsizlik süresi (dk), 5–180 aralığına sıkıştırılmış. */
const getIdleTimeoutMin = (): number => {
  const minutes = loadSettings().security.sessionTimeoutMin || DEFAULT_DURATION_MIN;
  return Math.max(5, Math.min(180, minutes));
};

/** Kullanıcı etkinliğinde oturum süresinin en fazla bu aralıkla yenilenmesi (her fare hareketinde yazmamak için). */
const ACTIVITY_REFRESH_THROTTLE_MS = 15 * 1000;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "wheel", "scroll"] as const;

type AppTab = "dashboard" | "patients" | "plans" | "appointments" | "alerts" | "settings";

const TAB_KEYS: AppTab[] = ["dashboard", "patients", "plans", "appointments", "alerts", "settings"];

const SETTINGS_SECTIONS: SettingsSectionKey[] = ["profil", "beslenme", "bildirim", "calisma", "guvenlik"];

/** "?bolum=beslenme" → Ayarlar'da açılacak bölüm; geçersizse undefined. */
const settingsSectionFromSearch = (search: string): SettingsSectionKey | undefined => {
  const value = new URLSearchParams(search).get("bolum");
  return (SETTINGS_SECTIONS as string[]).includes(value ?? "") ? (value as SettingsSectionKey) : undefined;
};

/** URL yolunu geçerli bir sekmeye çevirir; tanınmayan yol dashboard'a düşer. */
const pathToTab = (pathname: string): AppTab => {
  const slug = pathname.replace(/^\/+|\/+$/g, "");
  return (TAB_KEYS as string[]).includes(slug) ? (slug as AppTab) : "dashboard";
};

/** Her rota için benzersiz sekme başlığı (SEO). */
const PANEL_DOCUMENT_TITLES: Record<AppTab, string> = {
  dashboard: "Dashboard",
  patients: "Danışanlar",
  plans: "Diyet Planları",
  appointments: "Randevular",
  alerts: "Uyarılar",
  settings: "Ayarlar"
};

const LEGAL_DOCUMENT_TITLES: Record<string, string> = {
  iletisim: "İletişim",
  kvkk: "KVKK Aydınlatma Metni",
  gizlilik: "Gizlilik Politikası",
  "kullanim-sartlari": "Kullanım Şartları"
};

const resolveDocumentTitle = (pathname: string, isAuthed: boolean): string => {
  const slug = pathname.replace(/^\/+|\/+$/g, "");
  if (slug === "") {
    return isAuthed ? "Dashboard | NutriCare" : "NutriCare | Diyetisyen Paneli";
  }
  if (slug === "tanitim") {
    return "NutriCare | Diyetisyen Paneli";
  }
  if (slug === "giris") {
    return "Giriş | NutriCare";
  }
  if (LEGAL_DOCUMENT_TITLES[slug]) {
    return `${LEGAL_DOCUMENT_TITLES[slug]} | NutriCare`;
  }
  if (!isAuthed) {
    return "Giriş | NutriCare";
  }
  const tabKey = (TAB_KEYS as string[]).includes(slug) ? (slug as AppTab) : "dashboard";
  return `${PANEL_DOCUMENT_TITLES[tabKey]} | NutriCare`;
};

const StatCard: React.FC<{
  title: string;
  value: string;
  subtitle: string;
  icon?: React.ReactNode;
  tone?: "emerald" | "mint" | "amber" | "rose" | "slate";
}> = ({ title, value, subtitle, icon, tone = "emerald" }) => (
  <div className="card stat-card">
    <div className="stat-head">
      <span className={classNames("stat-icon", `stat-${tone}`)}>{icon}</span>
      <h3>{title}</h3>
    </div>
    <div className="stat-value">{value}</div>
    <div className="stat-subtitle">{subtitle}</div>
  </div>
);

const Progress: React.FC<{ value: number }> = ({ value }) => (
  <div className="progress">
    <span style={{ width: `${value}%` }} />
  </div>
);

const StatusBadge: React.FC<{ status: PatientStatus }> = ({ status }) => (
  <span
    className={classNames("badge", status === "Risk" ? "badge-rose" : "badge-emerald")}
    title={
      status === "Risk"
        ? "Durum: Risk — uyum eşiğin altında, takip/plan güncellemesi gerekli."
        : "Durum: Aktif — düzenli takipte, uyarı üretmeyen danışan."
    }
  >
    {status === "Risk" ? <TrendingDown size={12} /> : <CheckCircle2 size={12} />}
    {status}
  </span>
);

const PatientRow: React.FC<{ patient: Patient; onOpen: (patient: Patient) => void }> = ({
  patient,
  onOpen
}) => (
  <tr>
    <td style={{ fontWeight: 600 }}>
      <span className="cell-user">
        <span className="avatar">{patient.name.charAt(0)}</span>
        {patient.name}
      </span>
    </td>
    <td>{patient.plan}</td>
    <td>
      {patient.startDate} → {patient.endDate}
    </td>
    <td>
      <div className="table-progress-cell">
        <Progress value={patient.compliance} />
        <span className="table-progress-value">%{patient.compliance}</span>
      </div>
    </td>
    <td>{patient.lastAction}</td>
    <td>
      <StatusBadge status={patient.status} />
    </td>
    <td style={{ textAlign: "right" }}>
      <button className="btn btn-outline btn-small" onClick={() => onOpen(patient)}>
        Detay
      </button>
    </td>
  </tr>
);

const PatientCard: React.FC<{
  patient: Patient;
  onOpen: (patient: Patient) => void;
  onEdit: (patient: Patient) => void;
  onAssignPlan: (patient: Patient) => void;
  onDelete: (patient: Patient) => void;
}> = ({ patient, onOpen, onEdit, onAssignPlan, onDelete }) => (
  <div className="card patient-card">
    <div className="patient-card-header">
      <span className="cell-user">
        <span className="avatar">{patient.name.charAt(0)}</span>
        <strong>{patient.name}</strong>
      </span>
      <StatusBadge status={patient.status} />
    </div>
    <div>
      <label className="label">Plan</label>
      <div className="value-strong">{patient.plan}</div>
    </div>
    <div className="patient-card-grid">
      <div>
        <span className="muted">Başlangıç</span>
        <div className="value-strong">{patient.startDate}</div>
      </div>
      <div>
        <span className="muted">Bitiş</span>
        <div className="value-strong">{patient.endDate}</div>
      </div>
    </div>
    <div>
      <label className="label">Uyum</label>
      <div className="patient-card-progress">
        <Progress value={patient.compliance} />
        <span className="table-progress-value">%{patient.compliance}</span>
      </div>
    </div>
    <div className="card-actions">
      <button className="btn btn-primary" onClick={() => onOpen(patient)}>
        Görüntüle
      </button>
      <button className="btn btn-outline" onClick={() => onEdit(patient)}>Düzenle</button>
      <button className="btn btn-outline" onClick={() => onAssignPlan(patient)}>Plan Ata</button>
      <button className="icon-btn patient-delete" aria-label={`${patient.name} sil`} onClick={() => onDelete(patient)}>
        <Trash2 size={15} />
      </button>
    </div>
  </div>
);

type PatientDraft = {
  name: string;
  plan: string;
  startDate: string;
  endDate: string;
  compliance: number;
  status: PatientStatus;
};

const PatientFormModal: React.FC<{
  initial?: Patient;
  onClose: () => void;
  onSubmit: (draft: PatientDraft) => void;
}> = ({ initial, onClose, onSubmit }) => {
  const dialogRef = useModalDismiss(onClose);
  const today = new Date().toISOString().slice(0, 10);
  const [values, setValues] = React.useState(() => ({
    name: initial?.name ?? "",
    plan: initial?.plan ?? "",
    startDate: initial?.startDate ?? today,
    endDate: initial?.endDate ?? "",
    compliance: initial ? String(initial.compliance) : "0",
    status: (initial?.status ?? "Aktif") as PatientStatus
  }));
  const [touched, setTouched] = React.useState(false);

  const setField = (key: keyof typeof values) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setValues((prev) => ({ ...prev, [key]: event.target.value }));

  const complianceNum = Number(values.compliance);
  const errors = {
    name: values.name.trim() === "" ? "Ad zorunludur." : "",
    compliance:
      values.compliance === "" || Number.isNaN(complianceNum) || complianceNum < 0 || complianceNum > 100
        ? "0–100 arası bir değer girin."
        : "",
    endDate:
      values.endDate.trim() === ""
        ? "Bitiş tarihi zorunludur."
        : values.startDate && values.endDate < values.startDate
        ? "Bitiş, başlangıçtan önce olamaz."
        : ""
  };
  const invalid = Boolean(errors.name || errors.compliance || errors.endDate);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);
    if (invalid) {
      return;
    }
    onSubmit({
      name: values.name.trim(),
      plan: values.plan.trim() || "Plan atanmadı",
      startDate: values.startDate,
      endDate: values.endDate,
      compliance: Math.round(complianceNum),
      status: values.status
    });
    onClose();
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="patient-modal-title" onClick={onClose}>
      <div className="modal" ref={dialogRef} onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title" id="patient-modal-title">{initial ? "Danışan Düzenle" : "Yeni Danışan"}</h3>
            <p className="muted">Danışan bilgilerini girin. Ad ve bitiş tarihi zorunludur.</p>
          </div>
          <button className="btn btn-outline btn-small" onClick={onClose}>Kapat</button>
        </div>
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-grid">
            <div className="form-full">
              <label className="label" htmlFor="p-name">Ad Soyad *</label>
              <input id="p-name" className="input" placeholder="örn. Ayşe K." value={values.name} onChange={setField("name")} />
              {touched && errors.name ? <p className="field-error">{errors.name}</p> : null}
            </div>
            <div className="form-full">
              <label className="label" htmlFor="p-plan">Plan</label>
              <input id="p-plan" className="input" placeholder="örn. 2 Haftalık Fit Plan" value={values.plan} onChange={setField("plan")} />
            </div>
            <div>
              <label className="label" htmlFor="p-start">Başlangıç</label>
              <input id="p-start" type="date" className="input" value={values.startDate} onChange={setField("startDate")} />
            </div>
            <div>
              <label className="label" htmlFor="p-end">Bitiş *</label>
              <input id="p-end" type="date" className="input" value={values.endDate} onChange={setField("endDate")} />
              {touched && errors.endDate ? <p className="field-error">{errors.endDate}</p> : null}
            </div>
            <div>
              <label className="label" htmlFor="p-compliance">Uyum (%)</label>
              <input id="p-compliance" type="number" min={0} max={100} step={1} className="input" value={values.compliance} onChange={setField("compliance")} />
              {touched && errors.compliance ? <p className="field-error">{errors.compliance}</p> : null}
            </div>
            <div>
              <label className="label" htmlFor="p-status">Durum</label>
              <select id="p-status" className="input" value={values.status} onChange={setField("status")}>
                <option value="Aktif">Aktif</option>
                <option value="Risk">Risk</option>
              </select>
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>Vazgeç</button>
            <button type="submit" className="btn btn-primary">{initial ? "Kaydet" : "Danışan Ekle"}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const PLAN_DAYS = 14;
const GRID_MEALS: Array<{ label: string; short: string }> = [
  { label: "Kahvaltı", short: "K" },
  { label: "Ara 1", short: "A1" },
  { label: "Öğle", short: "Ö" },
  { label: "Ara 2", short: "A2" },
  { label: "Akşam", short: "A" }
];

/** [gün][öğün] → tamamlandı mı */
type MealGridState = boolean[][];

const emptyMealGrid = (): MealGridState => Array.from({ length: PLAN_DAYS }, () => GRID_MEALS.map(() => false));

const readMealGrid = (patientId: number): MealGridState => {
  try {
    const raw = localStorage.getItem(mealGridKey(patientId));
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) {
      return emptyMealGrid().map((row, day) =>
        row.map((_, meal) => Array.isArray(parsed[day]) && (parsed[day] as unknown[])[meal] === true)
      );
    }
  } catch {
    // bozuk kayıt — boş çizelgeye düş
  }
  return emptyMealGrid();
};

const writeMealGrid = (patientId: number, grid: MealGridState): void => {
  try {
    localStorage.setItem(mealGridKey(patientId), JSON.stringify(grid));
  } catch {
    // depolama kullanılamıyor — yoksay
  }
};

const todayIso = (): string => new Date().toISOString().slice(0, 10);

const isoToUtc = (iso: string): number => {
  const [year, month, day] = iso.split("-").map(Number);
  return Date.UTC(year, (month || 1) - 1, day || 1);
};

const addDaysIso = (iso: string, days: number): string =>
  new Date(isoToUtc(iso) + days * 86_400_000).toISOString().slice(0, 10);

const daysBetweenIso = (from: string, to: string): number => Math.round((isoToUtc(to) - isoToUtc(from)) / 86_400_000);

/** Plan başlangıcından bugüne geçen (çizelgede sorumlu tutulan) gün sayısı: 0–14. */
const elapsedPlanDays = (startDate: string): number =>
  Math.max(0, Math.min(PLAN_DAYS, daysBetweenIso(startDate, todayIso()) + 1));

/** Geçen günlerdeki işaretli öğün oranı; henüz gün geçmediyse null. */
const gridCompliance = (grid: MealGridState, elapsed: number): number | null => {
  if (elapsed === 0) {
    return null;
  }
  const due = grid.slice(0, elapsed);
  const done = due.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
  return Math.round((done / (elapsed * GRID_MEALS.length)) * 100);
};

type DashboardCharts = {
  adherence: Array<{ day: string; value: number | null }>;
  meals: Array<{ label: string; done: number }>;
  /** Hesaba katılan (çizelgesinde en az bir işaret olan) danışan sayısı; 0 ise örnek veri. */
  trackedPatients: number;
};

/**
 * Dashboard grafikleri danışanların öğün çizelgelerinden hesaplanır. Yalnızca çizelgede en az bir
 * işaret olan danışanlar sayılır (hiç kullanılmayan çizelge ortalamayı sıfıra çekmesin).
 * Hiç işaret yoksa örnek seriler döner.
 */
const buildDashboardCharts = (patients: Patient[]): DashboardCharts => {
  const tracked = patients
    .map((patient) => ({ patient, grid: readMealGrid(patient.id) }))
    .filter(({ grid }) => grid.some((row) => row.some(Boolean)));
  if (tracked.length === 0) {
    return { adherence: ADHERENCE_SERIES, meals: MEAL_COMPLETION, trackedPatients: 0 };
  }

  const today = todayIso();
  const adherence = Array.from({ length: 7 }, (_, index) => {
    const date = addDaysIso(today, index - 6);
    let done = 0;
    let due = 0;
    for (const { patient, grid } of tracked) {
      const day = daysBetweenIso(patient.startDate, date);
      if (day >= 0 && day < PLAN_DAYS) {
        done += grid[day].filter(Boolean).length;
        due += GRID_MEALS.length;
      }
    }
    // O gün planı süren danışan yoksa boşluk bırakılır.
    return { day: `${date.slice(8, 10)}.${date.slice(5, 7)}`, value: due > 0 ? Math.round((done / due) * 100) : null };
  });

  const meals = GRID_MEALS.map((meal, mealIndex) => {
    let done = 0;
    let due = 0;
    for (const { patient, grid } of tracked) {
      const elapsed = elapsedPlanDays(patient.startDate);
      for (let day = 0; day < elapsed; day += 1) {
        due += 1;
        if (grid[day][mealIndex]) {
          done += 1;
        }
      }
    }
    return { label: meal.label, done: due > 0 ? Math.round((done / due) * 100) : 0 };
  });

  return { adherence, meals, trackedPatients: tracked.length };
};

const MealGrid: React.FC<{
  grid: MealGridState;
  elapsed: number;
  onToggle: (day: number, meal: number) => void;
}> = ({ grid, elapsed, onToggle }) => (
  <div className="table-scroll">
    <table className="meal-grid">
      <thead>
        <tr>
          <th>Gün</th>
          {GRID_MEALS.map((meal) => (
            <th key={meal.label}>{meal.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {grid.map((row, dayIndex) => (
          <tr key={dayIndex}>
            <td className={dayIndex < elapsed ? "value-strong" : "muted"}>{dayIndex + 1}</td>
            {row.map((done, mealIndex) => (
              <td key={GRID_MEALS[mealIndex].label}>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={done}
                    onChange={() => onToggle(dayIndex, mealIndex)}
                    aria-label={`${GRID_MEALS[mealIndex].label} (Gün ${dayIndex + 1}) — ${
                      done ? "tamamlandı" : "tamamlanmadı"
                    }`}
                  />
                </label>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

type MeasurementFormValues = {
  date: string;
  weightKg: string;
  heightCm: string;
  bodyFatPercentage: string;
  muscleMassKg: string;
  waistCm: string;
  hipCm: string;
  notes: string;
};

type MeasurementFormErrors = Partial<Record<keyof MeasurementFormValues, string>>;

const EMPTY_MEASUREMENT_FORM: MeasurementFormValues = {
  date: new Date().toISOString().slice(0, 10),
  weightKg: "",
  heightCm: "",
  bodyFatPercentage: "",
  muscleMassKg: "",
  waistCm: "",
  hipCm: "",
  notes: ""
};

const validateMeasurementForm = (values: MeasurementFormValues): MeasurementFormErrors => {
  const errors: MeasurementFormErrors = {};
  if (!values.date) {
    errors.date = "Tarih zorunludur.";
  } else if (values.date > new Date().toISOString().slice(0, 10)) {
    errors.date = "Tarih gelecekte olamaz.";
  }

  const checkNumber = (
    key: keyof MeasurementFormValues,
    label: string,
    min: number,
    max: number,
    required = true
  ) => {
    const raw = values[key].trim();
    if (!raw) {
      if (required) {
        errors[key] = `${label} zorunludur.`;
      }
      return;
    }
    const num = Number(raw.replace(",", "."));
    if (!Number.isFinite(num)) {
      errors[key] = `${label} sayısal olmalıdır.`;
    } else if (num < min || num > max) {
      errors[key] = `${label} ${min}-${max} aralığında olmalıdır.`;
    }
  };

  checkNumber("weightKg", "Kilo (kg)", 30, 300);
  checkNumber("heightCm", "Boy (cm)", 100, 250);
  checkNumber("bodyFatPercentage", "Vücut yağ oranı (%)", 3, 75);
  checkNumber("muscleMassKg", "Kas kütlesi (kg)", 10, 150);
  checkNumber("waistCm", "Bel çevresi (cm)", 40, 200);
  checkNumber("hipCm", "Kalça çevresi (cm)", 40, 200);

  if (values.notes && values.notes.length > 280) {
    errors.notes = "Not en fazla 280 karakter olabilir.";
  }

  return errors;
};

const toMeasurement = (values: MeasurementFormValues): Measurement => ({
  id: `m-${Date.now()}`,
  date: values.date,
  weightKg: Number(values.weightKg.replace(",", ".")),
  heightCm: Number(values.heightCm.replace(",", ".")),
  bodyFatPercentage: Number(values.bodyFatPercentage.replace(",", ".")),
  muscleMassKg: Number(values.muscleMassKg.replace(",", ".")),
  waistCm: Number(values.waistCm.replace(",", ".")),
  hipCm: Number(values.hipCm.replace(",", ".")),
  notes: values.notes.trim()
});

const MeasurementDeltaCard: React.FC<{ current?: Measurement; previous?: Measurement }> = ({
  current,
  previous
}) => {
  if (!current || !previous) {
    return (
      <div className="card delta-card">
        <h3>Son Ölçüm Farkı</h3>
        <p className="muted">Karşılaştırma için en az 2 ölçüm gerekli.</p>
      </div>
    );
  }

  const deltas = [
    {
      label: "Kilo",
      text: formatDelta(current.weightKg, previous.weightKg, "kg"),
      value: current.weightKg - previous.weightKg,
      invert: false
    },
    {
      label: "Yağ Oranı",
      text: formatDelta(current.bodyFatPercentage, previous.bodyFatPercentage, "% yağ"),
      value: current.bodyFatPercentage - previous.bodyFatPercentage,
      invert: false
    },
    {
      label: "Kas",
      text: formatDelta(current.muscleMassKg, previous.muscleMassKg, "kg kas"),
      value: current.muscleMassKg - previous.muscleMassKg,
      invert: true
    },
    {
      label: "Bel",
      text: formatDelta(current.waistCm, previous.waistCm, "cm"),
      value: current.waistCm - previous.waistCm,
      invert: false
    }
  ];

  return (
    <div className="card delta-card">
      <h3>
        Son Ölçüm Farkı <span className="muted">· {previous.date} → {current.date}</span>
      </h3>
      <div className="delta-grid">
        {deltas.map((delta) => {
          const isZero = Math.abs(delta.value) < 0.0001;
          const isGood = isZero ? null : delta.invert ? delta.value > 0 : delta.value < 0;
          return (
            <div
              key={delta.label}
              className={classNames(
                "delta-chip",
                isZero ? "delta-neutral" : isGood ? "delta-good" : "delta-bad"
              )}
            >
              <span className="delta-label">{delta.label}</span>
              <strong className="delta-value">{delta.text}</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const MeasurementChart: React.FC<{ measurements: Measurement[] }> = ({ measurements }) => {
  const data = React.useMemo(
    () =>
      [...measurements]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((m) => ({
          date: m.date.slice(5),
          fullDate: m.date,
          weightKg: m.weightKg,
          bodyFatPercentage: m.bodyFatPercentage
        })),
    [measurements]
  );

  if (data.length === 0) {
    return (
      <div className="card">
        <h3>Kilo & Yağ Oranı Gelişimi</h3>
        <p className="muted">Grafik için henüz ölçüm bulunmuyor. İlk ölçümü ekleyin.</p>
      </div>
    );
  }

  return (
    <div className="card chart-card">
      <h3>Kilo & Yağ Oranı Gelişimi</h3>
      <div className="chart chart-tall">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis
              yAxisId="weight"
              orientation="left"
              tick={{ fontSize: 12 }}
              label={{ value: "kg", angle: -90, position: "insideLeft", fontSize: 12 }}
            />
            <YAxis
              yAxisId="fat"
              orientation="right"
              tick={{ fontSize: 12 }}
              domain={["auto", "auto"]}
              label={{ value: "% yağ", angle: 90, position: "insideRight", fontSize: 12 }}
            />
            <Tooltip
              labelFormatter={(_, payload) =>
                payload && payload.length > 0 ? String(payload[0]?.payload?.fullDate ?? "") : ""
              }
            />
            <Legend />
            <Line
              yAxisId="weight"
              type="monotone"
              dataKey="weightKg"
              name="Kilo (kg)"
              stroke="#059669"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line
              yAxisId="fat"
              type="monotone"
              dataKey="bodyFatPercentage"
              name="Yağ (%)"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const MeasurementEntryModal: React.FC<{
  initialHeight?: number;
  /** Verilirse form bu ölçümü düzenler (kimliği korunur). */
  initial?: Measurement;
  onClose: () => void;
  onSubmit: (measurement: Measurement) => void;
}> = ({ initialHeight, initial, onClose, onSubmit }) => {
  const [values, setValues] = React.useState<MeasurementFormValues>(() =>
    initial
      ? {
          date: initial.date,
          weightKg: String(initial.weightKg),
          heightCm: String(initial.heightCm),
          bodyFatPercentage: String(initial.bodyFatPercentage),
          muscleMassKg: String(initial.muscleMassKg),
          waistCm: String(initial.waistCm),
          hipCm: String(initial.hipCm),
          notes: initial.notes ?? ""
        }
      : {
          ...EMPTY_MEASUREMENT_FORM,
          heightCm: initialHeight ? String(initialHeight) : ""
        }
  );
  const [errors, setErrors] = React.useState<MeasurementFormErrors>({});
  const [touched, setTouched] = React.useState(false);

  const setField = (key: keyof MeasurementFormValues) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setValues((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validation = validateMeasurementForm(values);
    setErrors(validation);
    setTouched(true);
    if (Object.keys(validation).length > 0) {
      return;
    }
    const measurement = toMeasurement(values);
    onSubmit(initial ? { ...measurement, id: initial.id } : measurement);
    onClose();
  };

  const dialogRef = useModalDismiss(onClose);

  const liveBMI =
    values.weightKg && values.heightCm && !Number.isNaN(Number(values.weightKg)) && !Number.isNaN(Number(values.heightCm))
      ? calculateBMI(Number(String(values.weightKg).replace(",", ".")), Number(String(values.heightCm).replace(",", ".")))
      : 0;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="measurement-modal-title" onClick={onClose}>
      <div className="modal" ref={dialogRef} onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title" id="measurement-modal-title">{initial ? "Ölçümü Düzenle" : "Yeni Ölçüm Ekle"}</h3>
            <p className="muted">Seans ölçümünü kaydedin. Tüm sayısal alanlar zorunludur.</p>
          </div>
          <button className="btn btn-outline btn-small" onClick={onClose}>
            Kapat
          </button>
        </div>
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-grid">
            <div>
              <label className="label" htmlFor="m-date">Tarih *</label>
              <input id="m-date" type="date" className="input" value={values.date} onChange={setField("date")} />
              {touched && errors.date ? <p className="field-error">{errors.date}</p> : null}
            </div>
            <div>
              <label className="label" htmlFor="m-weight">Kilo (kg) *</label>
              <input id="m-weight" type="number" step="0.1" min={30} max={300} className="input" placeholder="örn. 83.5" value={values.weightKg} onChange={setField("weightKg")} />
              {touched && errors.weightKg ? <p className="field-error">{errors.weightKg}</p> : null}
            </div>
            <div>
              <label className="label" htmlFor="m-height">Boy (cm) *</label>
              <input id="m-height" type="number" step="0.5" min={100} max={250} className="input" placeholder="örn. 178" value={values.heightCm} onChange={setField("heightCm")} />
              {touched && errors.heightCm ? <p className="field-error">{errors.heightCm}</p> : null}
            </div>
            <div>
              <label className="label" htmlFor="m-fat">Vücut Yağ Oranı (%) *</label>
              <input id="m-fat" type="number" step="0.1" min={3} max={75} className="input" placeholder="örn. 24.6" value={values.bodyFatPercentage} onChange={setField("bodyFatPercentage")} />
              {touched && errors.bodyFatPercentage ? <p className="field-error">{errors.bodyFatPercentage}</p> : null}
            </div>
            <div>
              <label className="label" htmlFor="m-muscle">Kas Kütlesi (kg) *</label>
              <input id="m-muscle" type="number" step="0.1" min={10} max={150} className="input" placeholder="örn. 61.4" value={values.muscleMassKg} onChange={setField("muscleMassKg")} />
              {touched && errors.muscleMassKg ? <p className="field-error">{errors.muscleMassKg}</p> : null}
            </div>
            <div>
              <label className="label" htmlFor="m-waist">Bel (cm) *</label>
              <input id="m-waist" type="number" step="0.5" min={40} max={200} className="input" placeholder="örn. 96.5" value={values.waistCm} onChange={setField("waistCm")} />
              {touched && errors.waistCm ? <p className="field-error">{errors.waistCm}</p> : null}
            </div>
            <div>
              <label className="label" htmlFor="m-hip">Kalça (cm) *</label>
              <input id="m-hip" type="number" step="0.5" min={40} max={200} className="input" placeholder="örn. 104" value={values.hipCm} onChange={setField("hipCm")} />
              {touched && errors.hipCm ? <p className="field-error">{errors.hipCm}</p> : null}
            </div>
            <div>
              <label className="label">Tahmini VKİ</label>
              <div className="bmi-preview">
                {liveBMI > 0 ? (
                  <>
                    <strong>{liveBMI}</strong>
                    <span className="badge">{getBMICategory(liveBMI)}</span>
                  </>
                ) : (
                  <span className="muted">Kilo ve boy girin</span>
                )}
              </div>
            </div>
          </div>
          <div className="form-full">
            <label className="label" htmlFor="m-notes">Notlar</label>
            <textarea id="m-notes" className="input" rows={3} placeholder="Seans notu (opsiyonel)" value={values.notes} onChange={setField("notes")} />
            {touched && errors.notes ? <p className="field-error">{errors.notes}</p> : null}
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Vazgeç
            </button>
            <button type="submit" className="btn btn-primary">
              Ölçümü Kaydet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const MeasurementsTab: React.FC<{ patient: Patient }> = ({ patient }) => {
  const [measurements, setMeasurements] = React.useState<Measurement[]>(() =>
    getInitialMeasurements(patient.id)
  );
  /** null: kapalı · "new": yeni ölçüm · Measurement: düzenlenen kayıt */
  const [modal, setModal] = React.useState<"new" | Measurement | null>(null);

  React.useEffect(() => {
    setMeasurements(getInitialMeasurements(patient.id));
    setModal(null);
  }, [patient.id]);

  const sorted = React.useMemo(
    () => [...measurements].sort((a, b) => a.date.localeCompare(b.date)),
    [measurements]
  );
  const latest = sorted.length > 0 ? sorted[sorted.length - 1] : undefined;
  const previous = sorted.length > 1 ? sorted[sorted.length - 2] : undefined;
  const latestBMI = latest ? calculateBMI(latest.weightKg, latest.heightCm) : 0;
  const latestCategory = latestBMI ? getBMICategory(latestBMI) : null;

  /** Yeni ölçümü ekler; aynı kimlik varsa (düzenleme) yerine yazar. */
  const handleSave = React.useCallback(
    (measurement: Measurement) => {
      setMeasurements((prev) => {
        const next = [...prev.filter((m) => m.id !== measurement.id), measurement].sort((a, b) =>
          a.date.localeCompare(b.date)
        );
        writeStoredMeasurements(patient.id, next);
        return next;
      });
    },
    [patient.id]
  );

  const handleDelete = React.useCallback(
    (measurement: Measurement) => {
      if (!window.confirm(`${measurement.date} tarihli ölçüm silinsin mi?`)) {
        return;
      }
      setMeasurements((prev) => {
        const next = prev.filter((m) => m.id !== measurement.id);
        writeStoredMeasurements(patient.id, next);
        return next;
      });
    },
    [patient.id]
  );

  return (
    <div className="measurements">
      <div className="card measurements-summary">
        <div>
          <h3>Ölçüm ve Gelişim Takibi</h3>
          <p className="muted">
            {sorted.length > 0
              ? `Toplam ${sorted.length} ölçüm · Son ölçüm: ${latest?.date}`
              : "Henüz ölçüm girilmedi."}
          </p>
        </div>
        <div className="measurements-summary-side">
          {latest ? (
            <div className="bmi-badge">
              <span className="muted">VKİ</span>
              <strong>{latestBMI}</strong>
              {latestCategory ? <span className="badge">{latestCategory}</span> : null}
            </div>
          ) : null}
          <button className="btn btn-primary btn-small" onClick={() => setModal("new")}>
            + Yeni Ölçüm
          </button>
        </div>
      </div>

      <MeasurementDeltaCard current={latest} previous={previous} />
      <MeasurementChart measurements={sorted} />

      <div className="card">
        <h3>Ölçüm Geçmişi</h3>
        {sorted.length === 0 ? (
          <p className="muted">Kayıtlı ölçüm yok.</p>
        ) : (
          <div className="table-scroll">
            <table className="measurement-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Kilo</th>
                  <th>Boy</th>
                  <th>VKİ</th>
                  <th>Yağ %</th>
                  <th>Kas</th>
                  <th>Bel</th>
                  <th>Kalça</th>
                  <th>Not</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {[...sorted].reverse().map((m) => {
                  const bmi = calculateBMI(m.weightKg, m.heightCm);
                  return (
                    <tr key={m.id}>
                      <td className="value-strong">{m.date}</td>
                      <td>{m.weightKg.toFixed(1)} kg</td>
                      <td>{m.heightCm} cm</td>
                      <td>
                        {bmi} <span className="muted">({getBMICategory(bmi)})</span>
                      </td>
                      <td>%{m.bodyFatPercentage.toFixed(1)}</td>
                      <td>{m.muscleMassKg.toFixed(1)} kg</td>
                      <td>{m.waistCm} cm</td>
                      <td>{m.hipCm} cm</td>
                      <td className="muted">{m.notes || "—"}</td>
                      <td style={{ textAlign: "right" }}>
                        <div className="row-actions">
                          <button className="btn btn-outline btn-small" onClick={() => setModal(m)}>
                            Düzenle
                          </button>
                          <button className="icon-btn" aria-label={`${m.date} ölçümünü sil`} onClick={() => handleDelete(m)}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal ? (
        <MeasurementEntryModal
          initialHeight={latest?.heightCm}
          initial={modal === "new" ? undefined : modal}
          onClose={() => setModal(null)}
          onSubmit={handleSave}
        />
      ) : null}
    </div>
  );
};

type DrawerTab = "ozet" | "zaman" | "plan" | "olcum" | "bildirim" | "kvkk";

const DRAWER_TABS: Array<{ key: DrawerTab; label: string; icon: React.ReactNode }> = [
  { key: "ozet", label: "Özet", icon: <ClipboardList size={15} /> },
  { key: "zaman", label: "Zaman Çizelgesi", icon: <CalendarDays size={15} /> },
  { key: "plan", label: "14 Günlük Plan", icon: <UtensilsCrossed size={15} /> },
  { key: "olcum", label: "Ölçüm & Değerler", icon: <Scale size={15} /> },
  { key: "bildirim", label: "Bildirimler & Notlar", icon: <Bell size={15} /> },
  { key: "kvkk", label: "Gizlilik & Veri", icon: <ShieldCheck size={15} /> }
];

/** KVKK rıza durumunu kısa etiket + renk sınıfına çevirir. */
const consentChipMeta = (status: ConsentStatus | null): { label: string; className: string } => {
  if (status === "granted") {
    return { label: "Onaylı", className: "privacy-chip-granted" };
  }
  if (status === "deletion_requested") {
    return { label: "Silme talebi var", className: "privacy-chip-danger" };
  }
  if (status === "revoked") {
    return { label: "Geri çekildi", className: "privacy-chip-warn" };
  }
  return { label: "Onay yok", className: "privacy-chip-warn" };
};

type UpdatePatient = (patientId: number, patch: Partial<Omit<Patient, "id">>) => void;

const PatientDetailDrawer: React.FC<{
  patient: Patient | null;
  onClose: () => void;
  onUpdatePatient: UpdatePatient;
  onMessage: (patientId: number) => void;
}> = ({ patient, onClose, onUpdatePatient, onMessage }) => {
  const [drawerTab, setDrawerTab] = React.useState<DrawerTab>("ozet");
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    setDrawerTab("ozet");
  }, [patient?.id]);

  React.useEffect(() => {
    if (patient) {
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }
    setVisible(false);
    return undefined;
  }, [patient]);

  React.useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const [dataVersion, setDataVersion] = React.useState(0);

  React.useEffect(() => {
    const onChange = () => setDataVersion((version) => version + 1);
    window.addEventListener(MOBILE_EVENTS_CHANGED, onChange);
    return () => window.removeEventListener(MOBILE_EVENTS_CHANGED, onChange);
  }, []);

  const consent = React.useMemo(
    () => (patient ? consentStatusOf(readMobileEvents(), patient.id) : null),
    [patient, dataVersion]
  );

  if (!patient) {
    return null;
  }

  const consentMeta = consentChipMeta(consent);

  return (
    <div className="drawer" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className={classNames("drawer-panel", visible && "drawer-panel-visible")}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="drawer-header">
          <div className="drawer-identity">
            <span className="avatar avatar-emerald avatar-lg">{patient.name.charAt(0)}</span>
            <div>
              <p className="muted drawer-subtitle">Danışan Detay</p>
              <h2 className="drawer-title">
                {patient.name}
                <span className="drawer-title-secondary"> · {patient.plan}</span>
              </h2>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Kapat">
            <X size={18} />
          </button>
        </div>

        <div className="drawer-quick-actions">
          <button type="button" className="btn btn-outline btn-small" onClick={() => onMessage(patient.id)}>
            <MessageSquare size={14} /> Danışana Mesaj
          </button>
          <span className={classNames("privacy-chip", consentMeta.className)} title="KVKK rıza durumu (mobil uygulama)">
            <ShieldCheck size={13} /> KVKK: {consentMeta.label}
          </span>
        </div>

        <div className="drawer-tabs" role="tablist" aria-label="Danışan detay sekmeleri">
          {DRAWER_TABS.map((item) => (
            <button
              key={item.key}
              role="tab"
              aria-selected={drawerTab === item.key}
              className={drawerTab === item.key ? "active" : undefined}
              onClick={() => setDrawerTab(item.key)}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>

        <div className="drawer-body">
          {drawerTab === "ozet" ? <DrawerSummary patient={patient} /> : null}
          {drawerTab === "zaman" ? (
            <PatientTimeline key={patient.id} patientId={patient.id} measurements={getInitialMeasurements(patient.id)} />
          ) : null}
          {drawerTab === "plan" ? (
            <DrawerPlanTab key={patient.id} patient={patient} onUpdatePatient={onUpdatePatient} />
          ) : null}
          {drawerTab === "olcum" ? <MeasurementsTab patient={patient} /> : null}
          {drawerTab === "bildirim" ? <DrawerNotificationsTab key={patient.id} patient={patient} /> : null}
          {drawerTab === "kvkk" ? <PatientPrivacyTab key={patient.id} patient={patient} /> : null}
        </div>
      </div>
    </div>
  );
};

type PlanItem = {
  id: string;
  label: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

/** Diyet planlayıcıda "Kaydet" ile danışana atanan plan (dp_patient_plans). */
type SavedPatientPlan = {
  templateName: string;
  items: PlanItem[];
  macros: MacroSplit;
  notes: string;
  repeat: { every: number; unit: string };
  targetCalories: number;
  savedAt: string;
};

const DEFAULT_PLAN_ITEMS: PlanItem[] = [
  { id: "k", label: "Kahvaltı: 1 haşlanmış yumurta + 2 dilim tam buğday + domates-salatalık", calories: 350, proteinG: 22, carbsG: 32, fatG: 14 },
  { id: "a1", label: "Ara 1: 1 fincan sade kahve + 1 küçük elma", calories: 120, proteinG: 3, carbsG: 24, fatG: 2 },
  { id: "o", label: "Öğle: 1 kase mevsim salata + 1 dilim tam buğday + 100 g ızgara tavuk", calories: 450, proteinG: 32, carbsG: 42, fatG: 15 },
  { id: "a2", label: "Ara 2: 6 adet badem + 1 bardak ayran", calories: 180, proteinG: 8, carbsG: 10, fatG: 12 },
  { id: "a", label: "Akşam: Izgara tavuk (120 g) + bol salata + 1 tatlı kaşığı zeytinyağı", calories: 500, proteinG: 40, carbsG: 20, fatG: 22 }
];

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const buildDietPrintHtml = (opts: {
  /** Ayarlar > Profil: başlık, iletişim ve alt bilgi buradan gelir. */
  clinic: ProfileSettings;
  bmrFormulaLabel: string;
  waterMl: number;
  dietitian: string;
  patient: string;
  templateName: string;
  date: string;
  notes: string;
  bmr: number;
  tdee: number;
  targetCalories: number;
  macros: MacroSplit;
  macroGrams: { carbsG: number; proteinG: number; fatG: number };
  items: PlanItem[];
  totals: { calories: number; proteinG: number; carbsG: number; fatG: number };
}): string => {
  const rows = opts.items
    .map(
      (item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(item.label)}</td>
        <td>${item.calories}</td>
        <td>${item.proteinG} g</td>
        <td>${item.carbsG} g</td>
        <td>${item.fatG} g</td>
      </tr>`
    )
    .join("");

  const clinicName = opts.clinic.clinicName.trim() || "Diyetisyen Kliniği";
  const contact = [
    opts.clinic.title.trim(),
    opts.clinic.diplomaNo.trim() ? `Diploma No: ${opts.clinic.diplomaNo.trim()}` : "",
    opts.clinic.phone.trim(),
    opts.clinic.email.trim()
  ]
    .filter(Boolean)
    .map(escapeHtml)
    .join(" · ");
  const footerText = opts.clinic.footerText.trim() || "Bu liste bilgilendirme amaçlıdır.";

  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(opts.templateName)} - ${escapeHtml(opts.patient)}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 40px; }
  .brand { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #059669; padding-bottom: 12px; }
  .brand h1 { margin: 0; font-size: 22px; color: #059669; }
  .brand small { color: #64748b; }
  .meta { display: flex; gap: 24px; margin: 16px 0; font-size: 13px; }
  .meta strong { display: block; font-size: 11px; color: #64748b; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 12px; }
  th { background: #ecfdf5; color: #065f46; text-align: left; padding: 8px; border: 1px solid #a7f3d0; }
  td { padding: 8px; border: 1px solid #e2e8f0; }
  .totals td { font-weight: bold; background: #f8fafc; }
  .targets { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; font-size: 13px; margin-top: 12px; }
  .notes { margin-top: 16px; font-size: 13px; }
  footer { margin-top: 28px; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  @media print { body { margin: 12mm; } }
</style>
</head>
<body>
  <div class="brand">
    <div><h1>${escapeHtml(clinicName)}</h1><small>Kişisel Diyet Programı${contact ? ` · ${contact}` : ""}</small></div>
    <div><small>${escapeHtml(opts.date)}</small></div>
  </div>
  <div class="meta">
    <div><strong>Diyetisyen</strong>${escapeHtml(opts.dietitian)}</div>
    <div><strong>Danışan</strong>${escapeHtml(opts.patient)}</div>
    <div><strong>Program</strong>${escapeHtml(opts.templateName)}</div>
  </div>
  <div class="targets">
    Hedef: <strong>${opts.targetCalories} kcal/gün</strong> (BMR ${opts.bmr} · ${escapeHtml(opts.bmrFormulaLabel)} · TDEE ${opts.tdee}) ·
    Su: ${(opts.waterMl / 1000).toFixed(1)} L/gün ·
    Karbonhidrat %${opts.macros.carbsPct} (${opts.macroGrams.carbsG} g) ·
    Protein %${opts.macros.proteinPct} (${opts.macroGrams.proteinG} g) ·
    Yağ %${opts.macros.fatPct} (${opts.macroGrams.fatG} g)
  </div>
  <table>
    <thead><tr><th>#</th><th>Öğün</th><th>Kalori (kcal)</th><th>Protein</th><th>Karb.</th><th>Yağ</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr class="totals"><td></td><td>Toplam</td><td>${opts.totals.calories} kcal</td><td>${opts.totals.proteinG} g</td><td>${opts.totals.carbsG} g</td><td>${opts.totals.fatG} g</td></tr></tfoot>
  </table>
  ${opts.notes ? `<div class="notes"><strong>Notlar:</strong> ${escapeHtml(opts.notes)}</div>` : ""}
  <footer>${escapeHtml(footerText)} · ${escapeHtml(opts.dietitian)} · ${escapeHtml(clinicName)}</footer>
</body>
</html>`;
};

const TargetBar: React.FC<{
  icon: React.ReactNode;
  label: string;
  planned: number;
  target: number;
  unit: string;
}> = ({ icon, label, planned, target, unit }) => {
  const pct = target > 0 ? Math.min(100, Math.round((planned / target) * 100)) : 0;
  const diff = Math.round((planned - target) * 10) / 10;
  const inRange = target > 0 && Math.abs(planned - target) <= target * 0.1;
  return (
    <div className="target-bar">
      <div className="target-bar-head">
        <span className="target-bar-label">
          {icon} {label}
        </span>
        <span className="target-bar-values">
          <strong>{planned}</strong> / {target} {unit}
        </span>
      </div>
      <div className="target-track">
        <span
          className={inRange ? "target-fill target-fill-good" : "target-fill"}
          style={{ width: `${pct}%` }}
        />
      </div>
      <small className={diff <= 0 ? "muted" : "text-bad"}>
        {diff === 0 ? "Hedef tutturuldu" : diff < 0 ? `${Math.abs(diff)} ${unit} eksik` : `${diff} ${unit} fazla`}
        {` · %${pct}`}
      </small>
    </div>
  );
};

const DnDPlanEditor: React.FC<{ patients: Patient[]; onUpdatePatient: UpdatePatient }> = ({
  patients,
  onUpdatePatient
}) => {
  // Klinik ayarları sekme açılırken bir kez okunur (Ayarlar ayrı sekmede düzenlenir).
  const clinic = React.useMemo(() => loadSettings(), []);
  const [items, setItems] = usePersistentState<PlanItem[]>("dp_plan_items", DEFAULT_PLAN_ITEMS);
  const [repeat, setRepeat] = usePersistentState("dp_plan_repeat", { every: 14, unit: "day" });
  const [templateName, setTemplateName] = usePersistentState("dp_plan_name", "2 Haftalık Fit Plan");
  // Diyetisyen adı sabit değil; Ayarlar > Profil & Klinik'teki gerçek isimden gelir.
  const [dietitian, setDietitian] = React.useState(() => loadSettings().profile.dietitianName);
  const [patientId, setPatientId] = usePersistentState<number>("dp_plan_patient", patients[0]?.id ?? 1);
  const [notes, setNotes] = usePersistentState(
    "dp_plan_notes",
    "Bol su tüketin (günde en az 2 lt). Öğün saatlerine uymaya özen gösterin."
  );

  const [profile, setProfile] = usePersistentState<BmrInput>("dp_plan_profile", {
    weightKg: 70,
    heightCm: 170,
    age: 35,
    sex: "kadin"
  });
  const [activity, setActivity] = usePersistentState<ActivityLevel>("dp_plan_activity", "orta");
  const [goal, setGoal] = usePersistentState<WeightGoal>("dp_plan_goal", "verme");
  // Makrolar seçili hedefin dağılımıyla başlar (hedef değişince de ona döner);
  // ayarlardaki klinik varsayılanı "Klinik varsayılanı" ile uygulanır.
  const [macros, setMacros] = usePersistentState<MacroSplit>("dp_plan_macros", () => ({
    ...GOAL_ADJUSTMENTS[goal].macros
  }));
  const clinicMacros = React.useMemo(() => {
    const { macroPresetId, customMacros } = clinic.nutrition;
    const preset = MACRO_PRESETS.find((item) => item.id === macroPresetId);
    const source = macroPresetId === "custom" || !preset ? customMacros : preset;
    return {
      label: preset && macroPresetId !== "custom" ? preset.label : `Özel ${source.carbsPct}/${source.proteinPct}/${source.fatPct}`,
      macros: { carbsPct: source.carbsPct, proteinPct: source.proteinPct, fatPct: source.fatPct }
    };
  }, [clinic]);
  const navigate = useNavigate();
  const openNutritionSettings = () => navigate("/settings?bolum=beslenme");
  const [savedMsg, setSavedMsg] = React.useState<string | null>(null);

  // Danışan değişince kayıtlı planını ve son ölçümünü yükle. İlk açılışta çalışmaz:
  // kaydedilmemiş taslak (dp_plan_*) korunur.
  const previousPatientId = React.useRef(patientId);
  React.useEffect(() => {
    if (previousPatientId.current === patientId) {
      return;
    }
    previousPatientId.current = patientId;
    setSavedMsg(null);
    const saved = readPatientRecord<SavedPatientPlan>(PATIENT_PLANS_KEY)[patientId];
    if (saved && Array.isArray(saved.items)) {
      setItems(saved.items);
      setTemplateName(saved.templateName);
      setMacros(saved.macros);
      setNotes(saved.notes);
      setRepeat(saved.repeat);
    }
    const measurements = getInitialMeasurements(patientId);
    const latest = measurements[measurements.length - 1];
    if (latest) {
      setProfile((prev) => ({ ...prev, weightKg: latest.weightKg, heightCm: latest.heightCm }));
    }
  }, [patientId, setItems, setTemplateName, setMacros, setNotes, setRepeat, setProfile]);

  const bmrFormula = clinic.nutrition.bmrFormula;
  const targets = React.useMemo(
    () => calculateTargets(profile, activity, goal, macros, bmrFormula),
    [profile, activity, goal, macros, bmrFormula]
  );
  const waterMl = Math.round(Math.max(0, profile.weightKg) * clinic.nutrition.hydrationMlPerKg);

  const totals = React.useMemo(
    () =>
      items.reduce(
        (acc, item) => ({
          calories: acc.calories + (Number(item.calories) || 0),
          proteinG: Math.round((acc.proteinG + (Number(item.proteinG) || 0)) * 10) / 10,
          carbsG: Math.round((acc.carbsG + (Number(item.carbsG) || 0)) * 10) / 10,
          fatG: Math.round((acc.fatG + (Number(item.fatG) || 0)) * 10) / 10
        }),
        { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
      ),
    [items]
  );

  const macroSum = macros.carbsPct + macros.proteinPct + macros.fatPct;

  const handleGoalChange = (next: WeightGoal) => {
    setGoal(next);
    setMacros({ ...GOAL_ADJUSTMENTS[next].macros });
  };

  const updateItem = (id: string, patch: Partial<PlanItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { id: `yeni-${Date.now()}`, label: "Yeni öğün: açıklamayı yazın", calories: 200, proteinG: 10, carbsG: 20, fatG: 8 }
    ]);
  };

  const handleDragStart = React.useCallback((event: React.DragEvent<HTMLLIElement>, id: string) => {
    event.dataTransfer.setData("text/plain", id);
  }, []);

  const handleDrop = React.useCallback(
    (event: React.DragEvent<HTMLLIElement>, index: number) => {
      event.preventDefault();
      const id = event.dataTransfer.getData("text/plain");
      const from = items.findIndex((item) => item.id === id);
      if (from === -1) {
        return;
      }

      const next = [...items];
      const [moved] = next.splice(from, 1);
      next.splice(index, 0, moved);
      setItems(next);
    },
    [items]
  );

  const handleDragOver = React.useCallback((event: React.DragEvent<HTMLLIElement>) => {
    event.preventDefault();
  }, []);

  const handlePdfExport = () => {
    const patient = patients.find((p) => p.id === patientId);
    const html = buildDietPrintHtml({
      clinic: clinic.profile,
      bmrFormulaLabel: BMR_FORMULA_LABELS[bmrFormula],
      waterMl,
      dietitian: dietitian.trim() || clinic.profile.dietitianName.trim() || "Diyetisyen",
      patient: patient?.name ?? "Danışan",
      templateName: templateName.trim() || "Diyet Programı",
      date: new Date().toLocaleDateString("tr-TR"),
      notes: notes.trim(),
      bmr: targets.bmr,
      tdee: targets.tdee,
      targetCalories: targets.targetCalories,
      macros,
      macroGrams: { carbsG: targets.carbsG, proteinG: targets.proteinG, fatG: targets.fatG },
      items,
      totals
    });
    // document.write yerine Blob URL: içerik ayrı bir belge olarak ayrıştırılır.
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    const win = window.open(url, "_blank", "width=900,height=700");
    if (!win) {
      URL.revokeObjectURL(url);
      return;
    }
    // Blob URL aynı kökenden olduğu için yeni pencerenin yüklenmesi izlenebilir; yüklenince yazdır ve URL'yi bırak.
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      let ready = false;
      try {
        ready = !win.closed && win.location.href === url && win.document.readyState === "complete";
      } catch {
        ready = false;
      }
      if (!ready && !win.closed && Date.now() - startedAt < 15000) {
        return;
      }
      window.clearInterval(timer);
      if (ready) {
        win.focus();
        win.print();
      }
      // Belge yüklendikten sonra URL'yi bırakmak açık pencereyi etkilemez.
      URL.revokeObjectURL(url);
    }, 100);
  };

  const handleSavePlan = () => {
    const patient = patients.find((p) => p.id === patientId);
    if (!patient) {
      setSavedMsg("Kaydetmek için bir danışan seçin.");
      return;
    }
    const name = templateName.trim() || "Diyet Programı";
    const plan: SavedPatientPlan = {
      templateName: name,
      items,
      macros,
      notes: notes.trim(),
      repeat,
      targetCalories: targets.targetCalories,
      savedAt: new Date().toISOString()
    };
    writePatientEntry(PATIENT_PLANS_KEY, patient.id, plan);
    onUpdatePatient(patient.id, { plan: name, lastAction: `Plan kaydedildi · ${new Date().toLocaleDateString("tr-TR")}` });
    setSavedMsg(`"${name}" ${patient.name} için kaydedildi.`);
  };

  const setProfileField = (key: keyof BmrInput) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const raw = event.target.value;
    setProfile((prev) => ({
      ...prev,
      [key]: key === "sex" ? (raw as Sex) : Math.max(0, Number(raw) || 0)
    }));
  };

  return (
    <div className="planner-stack">
      <div className="card">
        <div className="card-head">
          <h3>
            <Calculator size={15} /> BMR & Hedef Kalori Hesaplayıcı
          </h3>
          <span className="calc-head-meta">
            <span className="badge badge-emerald">{BMR_FORMULA_LABELS[bmrFormula]}</span>
            <button type="button" className="btn btn-link btn-small" onClick={openNutritionSettings}>
              Ayarlarda değiştir
            </button>
          </span>
        </div>
        <div className="calc-grid">
          <div>
            <label className="label">Kilo (kg)</label>
            <input type="number" min={30} max={300} className="input" value={profile.weightKg || ""} onChange={setProfileField("weightKg")} />
          </div>
          <div>
            <label className="label">Boy (cm)</label>
            <input type="number" min={100} max={250} className="input" value={profile.heightCm || ""} onChange={setProfileField("heightCm")} />
          </div>
          <div>
            <label className="label">Yaş</label>
            <input type="number" min={10} max={100} className="input" value={profile.age || ""} onChange={setProfileField("age")} />
          </div>
          <div>
            <label className="label">Cinsiyet</label>
            <select className="input" value={profile.sex} onChange={setProfileField("sex")}>
              <option value="kadin">Kadın</option>
              <option value="erkek">Erkek</option>
            </select>
          </div>
          <div className="calc-wide">
            <label className="label">Aktivite</label>
            <select className="input" value={activity} onChange={(event) => setActivity(event.target.value as ActivityLevel)}>
              {(Object.keys(ACTIVITY_FACTORS) as ActivityLevel[]).map((key) => (
                <option key={key} value={key}>
                  {ACTIVITY_FACTORS[key].label} × {ACTIVITY_FACTORS[key].factor}
                </option>
              ))}
            </select>
          </div>
          <div className="calc-wide">
            <label className="label">Hedef</label>
            <select
              className="input"
              value={goal}
              onChange={(event) => handleGoalChange(event.target.value as WeightGoal)}
            >
              <option value="verme">Kilo verme (−500 kcal)</option>
              <option value="koruma">Koruma (±0 kcal)</option>
              <option value="alma">Kilo alma (+300 kcal)</option>
            </select>
          </div>
        </div>
        <div className="calc-results">
          <div className="calc-chip">
            <span className="muted">BMR</span>
            <strong>{targets.bmr} kcal</strong>
          </div>
          <div className="calc-chip">
            <span className="muted">TDEE</span>
            <strong>{targets.tdee} kcal</strong>
          </div>
          <div className="calc-chip calc-chip-primary">
            <span className="muted">Günlük Hedef</span>
            <strong>{targets.targetCalories} kcal</strong>
          </div>
          <div className="calc-chip">
            <span className="muted">Su Hedefi</span>
            <strong>{(waterMl / 1000).toFixed(1)} L</strong>
            <small className="muted">{clinic.nutrition.hydrationMlPerKg} ml/kg</small>
          </div>
          <div className="macro-edit">
            <div>
              <label className="label">Karb %</label>
              <input type="number" min={0} max={100} className="input" value={macros.carbsPct} onChange={(event) => setMacros((prev) => ({ ...prev, carbsPct: Number(event.target.value) || 0 }))} />
            </div>
            <div>
              <label className="label">Protein %</label>
              <input type="number" min={0} max={100} className="input" value={macros.proteinPct} onChange={(event) => setMacros((prev) => ({ ...prev, proteinPct: Number(event.target.value) || 0 }))} />
            </div>
            <div>
              <label className="label">Yağ %</label>
              <input type="number" min={0} max={100} className="input" value={macros.fatPct} onChange={(event) => setMacros((prev) => ({ ...prev, fatPct: Number(event.target.value) || 0 }))} />
            </div>
          </div>
        </div>
        <div className="calc-foot">
          {macroSum !== 100 ? (
            <p className="field-error">Makro yüzdeleri toplamı %{macroSum} — hedef %{100} olmalı, gramlar oransal hesaplanır.</p>
          ) : (
            <p className="muted">
              Hedef dağılım: {targets.carbsG} g karbonhidrat · {targets.proteinG} g protein · {targets.fatG} g yağ
            </p>
          )}
          <button
            type="button"
            className="btn btn-outline btn-small"
            onClick={() => setMacros({ ...clinicMacros.macros })}
            title="Ayarlar > Beslenme bölümündeki varsayılan makro dağılımı"
          >
            Klinik varsayılanı: {clinicMacros.label}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>
            <Flame size={15} /> Günlük Özet — Planlanan / Hedef
          </h3>
          <span className="muted">{totals.calories} / {targets.targetCalories} kcal</span>
        </div>
        <div className="target-grid">
          <TargetBar icon={<Flame size={14} />} label="Kalori" planned={totals.calories} target={targets.targetCalories} unit="kcal" />
          <TargetBar icon={<Beef size={14} />} label="Protein" planned={totals.proteinG} target={targets.proteinG} unit="g" />
          <TargetBar icon={<Wheat size={14} />} label="Karbonhidrat" planned={totals.carbsG} target={targets.carbsG} unit="g" />
          <TargetBar icon={<Droplet size={14} />} label="Yağ" planned={totals.fatG} target={targets.fatG} unit="g" />
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>
            <ChefHat size={15} /> Öğün Oluşturucu (Sürükle-Bırak)
          </h3>
          <button className="btn btn-outline btn-small" onClick={addItem}>
            <Plus size={14} /> Öğün Ekle
          </button>
        </div>
        <div className="editor-grid">
          <div className="editor-board">
            <p className="muted">Öğeleri sürükleyerek sıralamayı değiştirin, değerleri satır içinde düzenleyin.</p>
            <ul className="editor-list">
              {items.map((item, index) => (
                <li
                  key={item.id}
                  draggable
                  onDragStart={(event) => handleDragStart(event, item.id)}
                  onDrop={(event) => handleDrop(event, index)}
                  onDragOver={handleDragOver}
                  className="editor-item editor-item-meal"
                >
                  <div className="meal-row-head">
                    <span className="drag-handle">
                      <GripVertical size={14} /> {index + 1}
                    </span>
                    <button className="icon-btn icon-btn-danger" onClick={() => removeItem(item.id)} aria-label="Öğünü sil">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <input
                    className="input"
                    value={item.label}
                    onChange={(event) => updateItem(item.id, { label: event.target.value })}
                    aria-label="Öğün açıklaması"
                  />
                  <div className="meal-macros">
                    <div>
                      <label className="label">Kalori</label>
                      <input type="number" min={0} max={3000} className="input" value={item.calories} onChange={(event) => updateItem(item.id, { calories: Number(event.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className="label">Protein (g)</label>
                      <input type="number" min={0} max={300} step="0.5" className="input" value={item.proteinG} onChange={(event) => updateItem(item.id, { proteinG: Number(event.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className="label">Karb (g)</label>
                      <input type="number" min={0} max={500} step="0.5" className="input" value={item.carbsG} onChange={(event) => updateItem(item.id, { carbsG: Number(event.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className="label">Yağ (g)</label>
                      <input type="number" min={0} max={300} step="0.5" className="input" value={item.fatG} onChange={(event) => updateItem(item.id, { fatG: Number(event.target.value) || 0 })} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="editor-sidebar">
            <div>
              <label className="label">Danışan</label>
              <select className="input" value={patientId} onChange={(event) => setPatientId(Number(event.target.value))}>
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Diyetisyen</label>
              <input className="input" value={dietitian} onChange={(event) => setDietitian(event.target.value)} />
            </div>
            <div>
              <label className="label">Şablon Adı</label>
              <input className="input" value={templateName} onChange={(event) => setTemplateName(event.target.value)} />
            </div>
            <div>
              <label className="label">Tekrar Kuralı</label>
              <div className="editor-repeat">
                <input
                  type="number"
                  className="input"
                  value={repeat.every}
                  onChange={(event) =>
                    setRepeat((prev) => ({
                      ...prev,
                      every: Number(event.target.value)
                    }))
                  }
                />
                <select
                  className="input"
                  value={repeat.unit}
                  onChange={(event) =>
                    setRepeat((prev) => ({
                      ...prev,
                      unit: event.target.value
                    }))
                  }
                >
                  <option value="day">gün</option>
                  <option value="week">hafta</option>
                </select>
              </div>
              <p className="muted">Örn: 14 gün döngü ile tekrar et.</p>
            </div>
            <div>
              <label className="label">Danışan Notları</label>
              <textarea className="input" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
            </div>
            <div className="card-actions">
              <button className="btn btn-primary" onClick={handlePdfExport}>
                <Printer size={15} /> Diyet Listesini PDF İndir
              </button>
              <button className="btn btn-outline" onClick={handleSavePlan}>
                <FileText size={15} /> Kaydet
              </button>
            </div>
            {savedMsg ? (
              <p className="muted" role="status">
                {savedMsg}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

const LoginScreen: React.FC<{
  onLogin: (email: string, password: string) => void;
  /** Tanıtım sayfasına dönüş. */
  onBack?: () => void;
}> = ({ onLogin, onBack }) => {
  // Demo giriş bilgileri ekranda hazır gelir; kullanıcı doğrudan "Giriş"e basabilir.
  const [email, setEmail] = React.useState("demo@nutricare.com.tr");
  const [password, setPassword] = React.useState("demo1234");
  const emailRef = React.useRef<HTMLInputElement>(null);
  const passwordRef = React.useRef<HTMLInputElement>(null);
  const canSubmit = email.trim() !== "" && password.trim() !== "";

  // Tarayıcının autofill'i bazen React'in change olayını tetiklemez; DOM değerlerini
  // okuyup state'e yansıtarak "Giriş" butonunun autofill sonrası da etkinleşmesini sağla.
  const syncFromDom = React.useCallback(() => {
    const emailValue = emailRef.current?.value ?? "";
    const passwordValue = passwordRef.current?.value ?? "";
    setEmail((prev) => (prev === emailValue ? prev : emailValue));
    setPassword((prev) => (prev === passwordValue ? prev : passwordValue));
  }, []);

  React.useEffect(() => {
    syncFromDom();
    const timer = window.setInterval(syncFromDom, 400);
    return () => window.clearInterval(timer);
  }, [syncFromDom]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const emailValue = emailRef.current?.value ?? email;
    const passwordValue = passwordRef.current?.value ?? password;
    if (emailValue.trim() !== "" && passwordValue.trim() !== "") {
      onLogin(emailValue, passwordValue);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="card login-card">
        <h2 className="login-title">Giriş Yap</h2>
        <form className="login-form" onSubmit={handleSubmit}>
          <div>
            <label className="label" htmlFor="login-email">E-posta</label>
            <input
              id="login-email"
              ref={emailRef}
              type="email"
              autoComplete="username"
              inputMode="email"
              className="input"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onAnimationStart={syncFromDom}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="label" htmlFor="login-password">Şifre</label>
            <input
              id="login-password"
              ref={passwordRef}
              type="password"
              autoComplete="current-password"
              className="input"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onAnimationStart={syncFromDom}
              placeholder="••••••••"
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={!canSubmit}>
            Giriş
          </button>
          <p className="muted login-hint">
            Demo giriş bilgileri hazır: <strong>demo@nutricare.com.tr</strong> / <strong>demo1234</strong>. Doğrudan
            "Giriş"e basabilir veya herhangi bir e-posta/şifre yazabilirsiniz.
          </p>
          {onBack ? (
            <button type="button" className="btn btn-link btn-small login-back" onClick={onBack}>
              <ChevronLeft size={14} /> Tanıtım sayfasına dön
            </button>
          ) : null}
        </form>
      </div>
    </div>
  );
};

type AppointmentStatus = "Onaylı" | "Bekliyor";

type Appointment = {
  id: string;
  /** Danışan kimliği; eski kayıtlarda yoksa ada göre eşleştirilir. */
  patientId?: number;
  /** Görünen ad (danışan adı değişince güncellenir). */
  patient: string;
  date: string; // ISO YYYY-MM-DD
  time: string; // HH:MM
  type: string;
  status: AppointmentStatus;
};

const APPOINTMENT_TYPES = ["Kontrol / Ölçüm", "Online Görüşme", "Plan Revizyonu", "İlk Görüşme"];
const APPOINTMENT_STATUSES: AppointmentStatus[] = ["Onaylı", "Bekliyor"];

const SEED_APPOINTMENTS: Appointment[] = [
  { id: "r1", patientId: 1, patient: "Barış Karapelit", date: "2025-11-12", time: "10:30", type: "Kontrol / Ölçüm", status: "Onaylı" },
  { id: "r2", patientId: 2, patient: "Elif Y.", date: "2025-11-12", time: "11:30", type: "Online Görüşme", status: "Bekliyor" },
  { id: "r3", patientId: 3, patient: "Meriç B.", date: "2025-11-13", time: "14:00", type: "Plan Revizyonu", status: "Onaylı" },
  { id: "r4", patientId: 2, patient: "Elif Y.", date: "2025-11-15", time: "09:30", type: "Kontrol / Ölçüm", status: "Bekliyor" }
];

/** Randevu bu danışana mı ait? Kimlik varsa ona, yoksa (eski kayıt) ada bakılır. */
const isAppointmentOf = (appt: Appointment, patient: Pick<Patient, "id" | "name">): boolean =>
  appt.patientId !== undefined ? appt.patientId === patient.id : appt.patient === patient.name;

const APPOINTMENTS_STORAGE_KEY = "dp_appointments";

/** Panel içinden (örn. öncelik listesinden) yeni randevu ekler; Randevular sayfası açılışta okur. */
const appendStoredAppointment = (draft: AppointmentDraft): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const next: Appointment[] = [...readStoredAppointments(), { ...draft, id: `appt-${Date.now()}` }];
    localStorage.setItem(APPOINTMENTS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // depolama kullanılamıyor — yoksay
  }
};

/** Dashboard özeti için randevuları salt-okunur okur; yoksa/bozuksa çekirdek veriye düşer. */
const readStoredAppointments = (): Appointment[] => {
  if (typeof window === "undefined") {
    return SEED_APPOINTMENTS;
  }
  try {
    const raw = localStorage.getItem(APPOINTMENTS_STORAGE_KEY);
    if (!raw) {
      return SEED_APPOINTMENTS;
    }
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Appointment[]) : SEED_APPOINTMENTS;
  } catch {
    return SEED_APPOINTMENTS;
  }
};

/** Danışan adı değiştiğinde/silindiğinde kayıtlı randevuları günceller (yetim kayıt kalmasın). */
const updateStoredAppointments = (update: (appointments: Appointment[]) => Appointment[]): void => {
  try {
    localStorage.setItem(APPOINTMENTS_STORAGE_KEY, JSON.stringify(update(readStoredAppointments())));
  } catch {
    // depolama kullanılamıyor — yoksay
  }
};

type AppNotification = {
  id: string;
  title: string;
  detail: string;
  time: string;
  tone: string;
};

const SEED_NOTIFICATIONS: AppNotification[] = [
  { id: "n1", title: "Uyum uyarısı", detail: "Meriç B. uyumu %54'e düştü.", time: "10 dk önce", tone: "rose" },
  { id: "n2", title: "Öğün atlandı", detail: "Barış Karapelit akşam öğününü işaretlemedi.", time: "1 sa önce", tone: "amber" },
  { id: "n3", title: "Plan bitişi", detail: "Glütensiz 14G planı 2 gün içinde bitiyor.", time: "3 sa önce", tone: "slate" }
];

const NAV_ITEMS: Array<{ key: AppTab; label: string; icon: React.ReactNode }> = [
  { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
  { key: "patients", label: "Danışanlar", icon: <Users size={18} /> },
  { key: "plans", label: "Diyet Planları", icon: <Salad size={18} /> },
  { key: "appointments", label: "Randevular", icon: <CalendarDays size={18} /> },
  { key: "alerts", label: "Uyarılar", icon: <Bell size={18} /> },
  { key: "settings", label: "Ayarlar", icon: <Settings size={18} /> }
];

const Sidebar: React.FC<{
  tab: AppTab;
  onNavigate: (tab: AppTab) => void;
  collapsed: boolean;
  onToggle: () => void;
  riskCount: number;
  avgCompliance: number;
  patientCount: number;
}> = ({ tab, onNavigate, collapsed, onToggle, riskCount, avgCompliance, patientCount }) => (
  <aside className={classNames("sidebar", collapsed && "sidebar-collapsed")}>
    <div className="sidebar-brand">
      <span className="sidebar-logo">
        <Leaf size={20} />
      </span>
      {!collapsed && (
        <span className="sidebar-brand-text">
          <strong>NutriCare</strong>
          <small>Diyetisyen Paneli</small>
        </span>
      )}
      <button className="icon-btn sidebar-toggle" onClick={onToggle} aria-label="Menüyü daralt/genişlet">
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </div>
    <nav className="sidebar-nav">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.key}
          className={classNames("sidebar-item", tab === item.key && "active")}
          onClick={() => onNavigate(item.key)}
          title={item.label}
        >
          <span className="sidebar-item-icon">{item.icon}</span>
          {!collapsed && <span className="sidebar-item-label">{item.label}</span>}
          {!collapsed && item.key === "patients" && riskCount > 0 && (
            <span className="count-badge">{riskCount}</span>
          )}
          {collapsed && item.key === "patients" && riskCount > 0 && (
            <span className="count-dot" />
          )}
        </button>
      ))}
    </nav>
    {!collapsed && (
      <div className="sidebar-foot">
        <div className="sidebar-wellness">
          <Activity size={16} />
          <div>
            <strong>Ortalama Uyum %{avgCompliance}</strong>
            <small>{patientCount} danışan · {riskCount} riskli</small>
          </div>
        </div>
      </div>
    )}
  </aside>
);

const TopHeader: React.FC<{
  query: string;
  onQuery: (value: string) => void;
  showSearch: boolean;
  searchPlaceholder: string;
  user: string | null;
  remainingSec: number;
  onExtend: () => void;
  /** clearLocalData: paylaşımlı bilgisayar çıkışı — danışan verisini localStorage'dan da sil */
  onLogout: (clearLocalData: boolean) => void;
  onMenuToggle: () => void;
}> = ({ query, onQuery, showSearch, searchPlaceholder, user, remainingSec, onExtend, onLogout, onMenuToggle }) => {
  const [showNotifications, setShowNotifications] = React.useState(false);
  const [showProfile, setShowProfile] = React.useState(false);
  const [notifications, setNotifications] = usePersistentState<AppNotification[]>(
    "dp_notifications",
    SEED_NOTIFICATIONS
  );
  const headerRef = React.useRef<HTMLDivElement>(null);
  // Unvan Ayarlar > Profil'den; ayar kaydedildiğinde bir sonraki çizimde güncellenir.
  const profileTitle = loadSettings().profile.title.trim() || "Diyetisyen";

  const dismissNotification = React.useCallback(
    (id: string) => setNotifications((prev) => prev.filter((item) => item.id !== id)),
    [setNotifications]
  );

  const clearNotifications = React.useCallback(() => setNotifications([]), [setNotifications]);

  React.useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
        setShowProfile(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <header className="topheader" ref={headerRef}>
      <button className="icon-btn menu-btn" onClick={onMenuToggle} aria-label="Menü">
        <Menu size={18} />
      </button>
      {showSearch ? (
        <div className="search">
          <Search size={16} className="search-icon" />
          <input
            placeholder={searchPlaceholder}
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            aria-label={searchPlaceholder}
          />
        </div>
      ) : null}
      <div className="spacer" />
      <span className="session-chip">
        <Timer size={14} />
        {formatMMSS(remainingSec)}
      </span>
      <div className="popover-wrap">
        <button
          className="icon-btn"
          onClick={() => {
            setShowNotifications((prev) => !prev);
            setShowProfile(false);
          }}
          aria-label={`Bildirimler${notifications.length ? ` (${notifications.length})` : ""}`}
        >
          <Bell size={18} />
          {notifications.length > 0 ? <span className="ping-dot" /> : null}
        </button>
        {showNotifications ? (
          <div className="popover">
            <div className="popover-head">
              <strong>Bildirimler</strong>
              {notifications.length > 0 ? (
                <button type="button" className="btn btn-link btn-small" onClick={clearNotifications}>
                  Tümünü temizle
                </button>
              ) : (
                <span className="muted">0 yeni</span>
              )}
            </div>
            {notifications.length === 0 ? (
              <div className="popover-empty">
                <CheckCircle2 size={18} />
                <span>Tüm bildirimler temizlendi.</span>
              </div>
            ) : (
              <ul className="popover-list">
                {notifications.map((n) => (
                  <li key={n.id} className="popover-item">
                    <span className={classNames("tone-dot", `tone-${n.tone}`)} />
                    <div>
                      <strong>{n.title}</strong>
                      <p className="muted">{n.detail}</p>
                      <small className="muted">{n.time}</small>
                    </div>
                    <button
                      type="button"
                      className="icon-btn popover-dismiss"
                      aria-label="Bildirimi kaldır"
                      onClick={() => dismissNotification(n.id)}
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>
      <div className="popover-wrap">
        <button
          className="profile-btn"
          onClick={() => {
            setShowProfile((prev) => !prev);
            setShowNotifications(false);
          }}
        >
          <span className="avatar avatar-emerald">
            {(user ?? "D").charAt(0).toUpperCase()}
          </span>
          <span className="profile-meta">
            <strong>{user ?? "Diyetisyen"}</strong>
            <small>{profileTitle}</small>
          </span>
        </button>
        {showProfile ? (
          <div className="popover popover-right">
            <div className="popover-head">
              <span className="avatar avatar-emerald">{(user ?? "D").charAt(0).toUpperCase()}</span>
              <div>
                <strong>{user ?? "Diyetisyen"}</strong>
                <p className="muted">{profileTitle}</p>
              </div>
            </div>
            <div className="popover-actions">
              <button className="btn btn-outline btn-small" onClick={onExtend}>
                <Clock size={14} /> Oturumu Uzat
              </button>
              <button className="btn btn-outline btn-small" onClick={() => onLogout(false)}>
                <LogOut size={14} /> Çıkış
              </button>
            </div>
            <button
              type="button"
              className="btn btn-outline btn-small"
              style={{ width: "100%", marginTop: 8, justifyContent: "center" }}
              title="Danışan, ölçüm, randevu, plan ve bildirim verileri bu tarayıcıdan silinir. Tema ve klinik ayarları korunur."
              onClick={() => onLogout(true)}
            >
              <Trash2 size={14} /> Paylaşımlı bilgisayardan çıkış yap (yerel verileri temizle)
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
};

type AppointmentDraft = Omit<Appointment, "id">;

const DAY_NAMES_TR = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

const timeToMinutes = (hhmm: string): number => {
  const [hours, minutes] = hhmm.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

/**
 * Ayarlar > Çalışma Saatleri'ne göre randevu doğrulaması: kapalı gün, çalışma aralığı dışı
 * ve diğer randevularla (seans süresi + tampon) çakışma. Boş dizi = uygun.
 */
const validateAppointmentSlot = (
  draft: Pick<AppointmentDraft, "date" | "time">,
  others: Appointment[],
  schedule: ScheduleSettings
): string[] => {
  if (!draft.date || !isValidTime(draft.time)) {
    return [];
  }
  const errors: string[] = [];
  const dayName = DAY_NAMES_TR[new Date(isoToUtc(draft.date)).getUTCDay()];
  const workingDay = schedule.workingDays.find((day) => day.day === dayName);
  const duration = schedule.defaultDurationMin;
  const start = timeToMinutes(draft.time);

  if (!workingDay || !workingDay.enabled) {
    errors.push(`${dayName} günü klinik kapalı.`);
  } else if (start < timeToMinutes(workingDay.start) || start + duration > timeToMinutes(workingDay.end)) {
    errors.push(
      `${dayName} çalışma saatleri ${workingDay.start}–${workingDay.end}; ${duration} dk'lık seans bu aralığa sığmıyor.`
    );
  }

  const gap = duration + schedule.bufferMin;
  const clash = others.find(
    (other) => other.date === draft.date && Math.abs(timeToMinutes(other.time) - start) < gap
  );
  if (clash) {
    errors.push(
      `${clash.time} ${clash.patient} randevusuyla çakışıyor (seans ${duration} dk + ${schedule.bufferMin} dk tampon).`
    );
  }
  return errors;
};

const AppointmentFormModal: React.FC<{
  patients: Patient[];
  /** Çakışma kontrolü için mevcut randevular (düzenlenen kayıt hariç). */
  others: Appointment[];
  initial?: Appointment;
  /** Yeni randevuda önceden seçili danışan (örn. öncelik listesinden "Randevu"). */
  initialPatientId?: number;
  onClose: () => void;
  onSubmit: (draft: AppointmentDraft) => void;
}> = ({ patients, others, initial, initialPatientId, onClose, onSubmit }) => {
  const dialogRef = useModalDismiss(onClose);
  const schedule = React.useMemo(() => loadSettings().schedule, []);
  const [values, setValues] = React.useState<AppointmentDraft>(() => {
    const initialPatient = initial
      ? patients.find((patient) => (initial.patientId !== undefined ? patient.id === initial.patientId : patient.name === initial.patient))
      : patients.find((patient) => patient.id === initialPatientId) ?? patients[0];
    return {
      patientId: initialPatient?.id,
      patient: initialPatient?.name ?? "",
      date: initial?.date ?? todayIso(),
      time: initial?.time ?? "10:00",
      type: initial?.type ?? APPOINTMENT_TYPES[0],
      status: initial?.status ?? "Bekliyor"
    };
  });
  const [touched, setTouched] = React.useState(false);

  const setField = <K extends keyof AppointmentDraft>(key: K) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setValues((prev) => ({ ...prev, [key]: event.target.value }));

  const setPatient = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const patient = patients.find((item) => item.id === Number(event.target.value));
    setValues((prev) => ({ ...prev, patientId: patient?.id, patient: patient?.name ?? "" }));
  };

  const slotErrors = validateAppointmentSlot(values, others, schedule);
  const invalid = values.patientId === undefined || !values.date || !values.time || slotErrors.length > 0;
  const isPastDate = Boolean(values.date) && values.date < todayIso();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);
    if (invalid) {
      return;
    }
    onSubmit(values);
    onClose();
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="appt-modal-title" onClick={onClose}>
      <div className="modal" ref={dialogRef} onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title" id="appt-modal-title">{initial ? "Randevu Düzenle" : "Yeni Randevu"}</h3>
            <p className="muted">Danışan, tarih ve saat zorunludur.</p>
          </div>
          <button className="btn btn-outline btn-small" onClick={onClose}>Kapat</button>
        </div>
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-grid">
            <div>
              <label className="label" htmlFor="a-patient">Danışan *</label>
              <select id="a-patient" className="input" value={values.patientId ?? ""} onChange={setPatient}>
                {values.patientId === undefined ? <option value="">{patients.length === 0 ? "Danışan yok" : "Danışan seçin"}</option> : null}
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>{patient.name}</option>
                ))}
              </select>
              {touched && values.patientId === undefined ? <p className="field-error">Danışan seçin.</p> : null}
            </div>
            <div>
              <label className="label" htmlFor="a-type">Tür</label>
              <select id="a-type" className="input" value={values.type} onChange={setField("type")}>
                {APPOINTMENT_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="a-date">Tarih *</label>
              <input id="a-date" type="date" className="input" value={values.date} onChange={setField("date")} />
              {touched && !values.date ? (
                <p className="field-error">Tarih girin.</p>
              ) : isPastDate ? (
                <p className="field-warning">Bu tarih geçmişte — yine de kaydedebilirsiniz.</p>
              ) : null}
            </div>
            <div>
              <label className="label" htmlFor="a-time">Saat *</label>
              <input id="a-time" type="time" className="input" value={values.time} onChange={setField("time")} />
              {touched && !values.time ? <p className="field-error">Saat girin.</p> : null}
            </div>
            {slotErrors.length > 0 ? (
              <div className="form-full" role="alert">
                {slotErrors.map((message) => (
                  <p key={message} className="field-error">{message}</p>
                ))}
              </div>
            ) : null}
            <div>
              <label className="label" htmlFor="a-status">Durum</label>
              <select id="a-status" className="input" value={values.status} onChange={setField("status")}>
                {APPOINTMENT_STATUSES.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>Vazgeç</button>
            <button type="submit" className="btn btn-primary">{initial ? "Kaydet" : "Randevu Ekle"}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AppointmentsView: React.FC<{
  patients: Patient[];
  query: string;
  getMeasurements: (patientId: number) => MeasurementLike[];
  getMobileEvents: (patientId: number) => MobileEvent[];
  onMessage: (patientId: number) => void;
}> = ({ patients, query, getMeasurements, getMobileEvents, onMessage }) => {
  const [appointments, setAppointments] = usePersistentState<Appointment[]>(APPOINTMENTS_STORAGE_KEY, SEED_APPOINTMENTS);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Appointment | null>(null);
  const [apptToDelete, setApptToDelete] = React.useState<Appointment | null>(null);
  const [summaryAppt, setSummaryAppt] = React.useState<Appointment | null>(null);

  // Eski (yalnızca ad tutan) kayıtlara danışan kimliğini bir kez ekle.
  React.useEffect(() => {
    if (appointments.every((appt) => appt.patientId !== undefined)) {
      return;
    }
    setAppointments((prev) =>
      prev.map((appt) =>
        appt.patientId !== undefined
          ? appt
          : { ...appt, patientId: patients.find((patient) => patient.name === appt.patient)?.id }
      )
    );
    // Yalnızca açılışta çalışması yeterli.
  }, []);

  /** Görünen ad: danışan kimliği varsa güncel kayıttan, yoksa randevudaki addan. */
  const displayName = React.useCallback(
    (appt: Appointment) =>
      (appt.patientId !== undefined ? patients.find((patient) => patient.id === appt.patientId)?.name : undefined) ??
      appt.patient,
    [patients]
  );

  const sorted = React.useMemo(() => {
    const lower = query.trim().toLowerCase();
    return [...appointments]
      .filter(
        (appt) =>
          !lower ||
          displayName(appt).toLowerCase().includes(lower) ||
          appt.type.toLowerCase().includes(lower)
      )
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  }, [appointments, query, displayName]);

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (appt: Appointment) => {
    setEditing(appt);
    setModalOpen(true);
  };

  const handleSubmit = (draft: AppointmentDraft) => {
    setAppointments((prev) =>
      editing
        ? prev.map((appt) => (appt.id === editing.id ? { ...editing, ...draft } : appt))
        : [...prev, { ...draft, id: `appt-${Date.now()}` }]
    );
  };

  const handleDelete = (appt: Appointment) => {
    setApptToDelete(appt);
  };

  const confirmDelete = () => {
    if (!apptToDelete) {
      return;
    }
    setAppointments((prev) => prev.filter((item) => item.id !== apptToDelete.id));
    setApptToDelete(null);
  };

  return (
    <div className="card">
      <div className="card-head">
        <h3>
          <CalendarDays size={16} /> Yaklaşan Randevular
        </h3>
        <button className="btn btn-primary btn-small" onClick={openAdd}>
          <Plus size={14} /> Yeni Randevu
        </button>
      </div>
      {sorted.length === 0 ? (
        <p className="muted">
          {query.trim()
            ? `"${query}" ile eşleşen randevu yok.`
            : 'Kayıtlı randevu yok. "Yeni Randevu" ile ekleyin.'}
        </p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Danışan</th>
                <th>Tarih</th>
                <th>Saat</th>
                <th>Tür</th>
                <th>Durum</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sorted.map((appt) => (
                <tr key={appt.id}>
                  <td style={{ fontWeight: 600 }}>{displayName(appt)}</td>
                  <td>{appt.date}</td>
                  <td>{appt.time}</td>
                  <td>{appt.type}</td>
                  <td>
                    <span className={classNames("badge", appt.status === "Onaylı" ? "badge-emerald" : "badge-amber")}>
                      {appt.status}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div className="row-actions">
                      <button className="btn btn-outline btn-small" onClick={() => setSummaryAppt(appt)}>
                        Özet
                      </button>
                      <button className="btn btn-outline btn-small" onClick={() => openEdit(appt)}>Düzenle</button>
                      <button className="icon-btn" aria-label="Randevuyu sil" onClick={() => handleDelete(appt)}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen ? (
        <AppointmentFormModal
          patients={patients}
          others={appointments.filter((appt) => appt.id !== editing?.id)}
          initial={editing ?? undefined}
          onClose={() => setModalOpen(false)}
          onSubmit={handleSubmit}
        />
      ) : null}

      {summaryAppt ? (
        <AppointmentSummary
          appointment={summaryAppt}
          patient={patients.find((patient) => patient.id === summaryAppt.patientId)}
          getMeasurements={getMeasurements}
          getMobileEvents={getMobileEvents}
          onMessage={onMessage}
          onClose={() => setSummaryAppt(null)}
        />
      ) : null}

      {apptToDelete ? (
        <ConfirmDialog
          title="Randevuyu sil"
          message={
            <>
              <p>
                <strong>{displayName(apptToDelete)}</strong> için {apptToDelete.date} {apptToDelete.time} randevusu
                silinsin mi?
              </p>
              <p className="muted">Bu işlem geri alınamaz.</p>
            </>
          }
          onConfirm={confirmDelete}
          onClose={() => setApptToDelete(null)}
        />
      ) : null}
    </div>
  );
};

const DrawerSummary: React.FC<{ patient: Patient }> = ({ patient }) => {
  // Her çizimde güncel kayıt okunur; ölçüm sekmesindeki ekleme/düzenleme/silme hemen yansır.
  const measurements = getInitialMeasurements(patient.id);
  const latest = measurements.length > 0 ? measurements[measurements.length - 1] : undefined;
  const previous = measurements.length > 1 ? measurements[measurements.length - 2] : undefined;
  const bmi = latest ? calculateBMI(latest.weightKg, latest.heightCm) : 0;

  return (
    <div className="drawer-stack">
      <div className="card patient-hero">
        <span className="avatar avatar-lg">{patient.name.charAt(0)}</span>
        <div>
          <h3 className="patient-hero-name">{patient.name}</h3>
          <p className="muted">{patient.plan} · {patient.startDate} → {patient.endDate}</p>
          <div className="hero-badges">
            <StatusBadge status={patient.status} />
            {bmi > 0 ? <span className="badge badge-slate">VKİ {bmi} · {getBMICategory(bmi)}</span> : null}
          </div>
        </div>
        <div className="hero-compliance">
          <span className="muted">Uyum</span>
          <strong>%{patient.compliance}</strong>
          <Progress value={patient.compliance} />
        </div>
      </div>
      <div className="grid grid-3">
        <div className="card mini-stat">
          <span className="stat-icon stat-emerald"><Scale size={16} /></span>
          <small className="muted">Son Kilo</small>
          <strong>{latest ? `${latest.weightKg.toFixed(1)} kg` : "—"}</strong>
          {latest && previous ? (
            <small className={latest.weightKg <= previous.weightKg ? "text-good" : "text-bad"}>
              {formatDelta(latest.weightKg, previous.weightKg, "kg")}
            </small>
          ) : null}
        </div>
        <div className="card mini-stat">
          <span className="stat-icon stat-mint"><Activity size={16} /></span>
          <small className="muted">Yağ Oranı</small>
          <strong>{latest ? `%${latest.bodyFatPercentage.toFixed(1)}` : "—"}</strong>
          {latest && previous ? (
            <small className={latest.bodyFatPercentage <= previous.bodyFatPercentage ? "text-good" : "text-bad"}>
              {formatDelta(latest.bodyFatPercentage, previous.bodyFatPercentage, "%")}
            </small>
          ) : null}
        </div>
        <div className="card mini-stat">
          <span className="stat-icon stat-amber"><Ruler size={16} /></span>
          <small className="muted">Bel / Kalça</small>
          <strong>{latest ? `${latest.waistCm} / ${latest.hipCm} cm` : "—"}</strong>
          <small className="muted">{latest ? latest.date : "ölçüm yok"}</small>
        </div>
      </div>
      <div className="card">
        <h3><ClipboardList size={15} /> Son İşlem</h3>
        <p className="muted">{patient.lastAction} · {measurements.length} ölçüm kaydı</p>
      </div>
    </div>
  );
};

const BASE_PLAN_TEMPLATES = ["2 Haftalık Fit Plan", "Düşük Karbonhidrat", "Glütensiz 14G"];

const DrawerPlanTab: React.FC<{ patient: Patient; onUpdatePatient: UpdatePatient }> = ({
  patient,
  onUpdatePatient
}) => {
  const [grid, setGrid] = React.useState<MealGridState>(() => readMealGrid(patient.id));
  const elapsed = elapsedPlanDays(patient.startDate);
  const compliance = gridCompliance(grid, elapsed);

  const templates = React.useMemo(() => {
    const saved = Object.values(readPatientRecord<SavedPatientPlan>(PATIENT_PLANS_KEY)).map((plan) => plan.templateName);
    return Array.from(new Set([patient.plan, ...saved, ...BASE_PLAN_TEMPLATES])).filter(
      (name) => name && name !== "Plan atanmadı"
    );
  }, [patient.plan]);

  const [planName, setPlanName] = React.useState(() => templates[0] ?? BASE_PLAN_TEMPLATES[0]);
  const [startDate, setStartDate] = React.useState(patient.startDate);
  const [cycleDays, setCycleDays] = React.useState(() =>
    String(Math.max(1, daysBetweenIso(patient.startDate, patient.endDate)) || PLAN_DAYS)
  );
  const [assignMsg, setAssignMsg] = React.useState<{ ok: boolean; text: string } | null>(null);

  const handleToggle = (day: number, meal: number) => {
    const next = grid.map((row, d) => (d === day ? row.map((done, m) => (m === meal ? !done : done)) : row));
    setGrid(next);
    writeMealGrid(patient.id, next);
    // Öğün çizelgesi kaydedilen "Uyum" değerini ezmez; tamamlama oranı yalnızca
    // "Çizelgeye göre uyum" metriği olarak gösterilir. Uyum elle (danışan formu) güncellenir.
    onUpdatePatient(patient.id, { lastAction: "Öğün çizelgesi güncellendi" });
  };

  const handleAssign = () => {
    const cycle = Number(cycleDays);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      setAssignMsg({ ok: false, text: "Geçerli bir başlangıç tarihi seçin." });
      return;
    }
    if (!Number.isInteger(cycle) || cycle < 1 || cycle > 365) {
      setAssignMsg({ ok: false, text: "Döngü 1–365 gün arasında olmalıdır." });
      return;
    }
    const newPeriod = startDate !== patient.startDate;
    const hasMarks = grid.some((row) => row.some(Boolean));
    if (newPeriod && hasMarks && !window.confirm("Yeni plan dönemi başlıyor; öğün çizelgesi sıfırlansın mı?")) {
      return;
    }
    if (newPeriod) {
      const empty = emptyMealGrid();
      setGrid(empty);
      writeMealGrid(patient.id, empty);
    }
    const endDate = addDaysIso(startDate, cycle);
    onUpdatePatient(patient.id, { plan: planName, startDate, endDate, lastAction: "Plan atandı" });
    setAssignMsg({ ok: true, text: `${planName} atandı: ${startDate} → ${endDate}` });
  };

  // Son 7 gün: plan başlangıcından bugüne kadar geçen günlerin son yedisi.
  const weekStart = Math.max(0, elapsed - 7);
  const weekDays = grid.slice(weekStart, elapsed);

  return (
    <div className="drawer-stack">
      <div className="card">
        <div className="card-head">
          <h3><UtensilsCrossed size={15} /> 14 Günlük Çizelge</h3>
          <span
            className="muted"
            title="Öğün çizelgesindeki işaretlerden hesaplanır; danışanın kayıtlı Uyum değerini değiştirmez."
          >
            {compliance === null ? "Plan henüz başlamadı" : `Çizelgeye göre uyum %${compliance} · ${elapsed}/${PLAN_DAYS} gün`}
          </span>
        </div>
        <MealGrid grid={grid} elapsed={elapsed} onToggle={handleToggle} />
      </div>
      <div className="card">
        <h3><ChefHat size={15} /> Plan Atama</h3>
        <div className="drawer-plan-grid">
          <div>
            <label className="label" htmlFor="dp-plan">Plan Şablonu</label>
            <select id="dp-plan" className="input" value={planName} onChange={(event) => setPlanName(event.target.value)}>
              {templates.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="dp-start">Başlangıç Tarihi</label>
            <input id="dp-start" type="date" className="input" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="dp-cycle">Döngü (gün)</label>
            <input id="dp-cycle" type="number" min={1} max={365} className="input" value={cycleDays} onChange={(event) => setCycleDays(event.target.value)} />
          </div>
          <div className="drawer-plan-action">
            <button type="button" className="btn btn-primary" onClick={handleAssign}>Ata / Güncelle</button>
          </div>
        </div>
        {assignMsg ? (
          <p className={classNames("muted-spaced", assignMsg.ok ? "import-ok" : "field-error")} role="status">
            {assignMsg.text}
          </p>
        ) : null}
      </div>
      <div className="card">
        <h3>Öğün Günlüğü (Son 7 Gün)</h3>
        {weekDays.length === 0 ? (
          <p className="muted">Plan henüz başlamadı — başlangıç: {patient.startDate}.</p>
        ) : (
          <div className="drawer-week-grid">
            {weekDays.map((row, index) => (
              <div key={weekStart + index} className="week-chip">
                <p className="muted">Gün {weekStart + index + 1}</p>
                <div className="week-chip-grid">
                  {row.map((done, mealIndex) => (
                    <span key={GRID_MEALS[mealIndex].short} className="week-chip-cell">
                      {GRID_MEALS[mealIndex].short}{" "}
                      {done ? (
                        <CheckCircle2 size={12} className="text-good" aria-label="tamamlandı" />
                      ) : (
                        <X size={12} className="text-bad" aria-label="tamamlanmadı" />
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/** Hatırlatma slotu kimliği → "HH:MM" (danışana özel saatler). */
type ReminderTimes = Record<string, string>;

const NOTE_MAX_LENGTH = 2000;

const SEVERITY_BADGE: Record<PatientAlert["severity"], string> = {
  critical: "badge-rose",
  warning: "badge-amber",
  info: "badge-slate"
};

const DrawerNotificationsTab: React.FC<{ patient: Patient }> = ({ patient }) => {
  const slots = React.useMemo(() => loadSettings().notifications.reminderSlots, []);
  const [times, setTimes] = React.useState<ReminderTimes>(() => {
    const saved = readPatientRecord<ReminderTimes>(PATIENT_REMINDERS_KEY)[patient.id] ?? {};
    return Object.fromEntries(
      slots.map((slot) => [slot.id, typeof saved[slot.id] === "string" ? saved[slot.id] : slot.time])
    );
  });
  const [reminderMsg, setReminderMsg] = React.useState<{ ok: boolean; text: string } | null>(null);

  const storedNote = React.useMemo(() => readPatientRecord<string>(PATIENT_NOTES_KEY)[patient.id], [patient.id]);
  const [notes, setNotes] = React.useState(storedNote ?? "");
  const [saved, setSaved] = React.useState(storedNote !== undefined);

  const alerts = React.useMemo(() => {
    const dismissed = new Set(loadDismissedIds());
    return buildAlerts(
      [{ id: patient.id, name: patient.name, plan: patient.plan, compliance: patient.compliance, status: patient.status, endDate: patient.endDate }],
      getInitialMeasurements,
      loadAlertRules(rulesFromClinicSettings()),
      loadResolvedIds(),
      Date.now(),
      (patientId: number) => readMobileEvents().filter((event) => event.patientId === patientId)
    ).filter((alert) => !dismissed.has(alert.id));
  }, [patient]);

  const saveReminders = () => {
    const invalid = slots.find((slot) => !isValidTime(times[slot.id] ?? ""));
    if (invalid) {
      setReminderMsg({ ok: false, text: `${invalid.label} saati HH:MM formatında olmalı.` });
      return;
    }
    writePatientEntry(PATIENT_REMINDERS_KEY, patient.id, times);
    setReminderMsg({ ok: true, text: "Bildirim saatleri kaydedildi." });
  };

  const saveNote = () => {
    writePatientEntry(PATIENT_NOTES_KEY, patient.id, notes.trim() ? notes : undefined);
    setSaved(true);
  };

  return (
    <div className="drawer-stack">
      <div className="card">
        <h3><Bell size={15} /> Bildirim Saatleri</h3>
        <div className="drawer-form">
          {slots.length === 0 ? (
            <p className="muted">Ayarlar &gt; Bildirimler bölümünde hatırlatma saati tanımlı değil.</p>
          ) : (
            slots.map((slot) => (
              <div key={slot.id} className="drawer-form-row">
                <label className="label" htmlFor={`rem-${slot.id}`}>{slot.label}</label>
                <input
                  id={`rem-${slot.id}`}
                  type="time"
                  className="input"
                  value={times[slot.id] ?? ""}
                  onChange={(event) => {
                    setTimes((prev) => ({ ...prev, [slot.id]: event.target.value }));
                    setReminderMsg(null);
                  }}
                />
              </div>
            ))
          )}
          <div>
            <button type="button" className="btn btn-primary btn-small" onClick={saveReminders} disabled={slots.length === 0}>
              Kaydet
            </button>
          </div>
          {reminderMsg ? (
            <p className={reminderMsg.ok ? "import-ok" : "field-error"} role="status">{reminderMsg.text}</p>
          ) : null}
        </div>
      </div>
      <div className="card">
        <h3><StickyNote size={15} /> Diyetisyen Notları</h3>
        <textarea
          className="input"
          rows={4}
          maxLength={NOTE_MAX_LENGTH}
          placeholder={`${patient.name} için seans notu...`}
          value={notes}
          onChange={(event) => {
            setNotes(event.target.value);
            setSaved(false);
          }}
        />
        <div className="card-actions card-actions-spaced">
          <span className="muted">{saved ? "Kaydedildi." : "Kaydedilmemiş değişiklik var."}</span>
          <button type="button" className="btn btn-primary btn-small" onClick={saveNote} disabled={saved}>
            Notu Kaydet
          </button>
        </div>
      </div>
      <div className="card">
        <h3>Uyarı Geçmişi</h3>
        {alerts.length === 0 ? (
          <p className="muted">Bu danışan için güncel uyarı yok.</p>
        ) : (
          <ul className="scenario-list">
            {alerts.map((alert) => (
              <li key={alert.id}>
                <span>
                  {alert.title} — <span className="muted">{alert.description}</span>
                </span>
                <span className={classNames("badge", alert.isResolved ? "badge-emerald" : SEVERITY_BADGE[alert.severity])}>
                  {alert.isResolved ? "Çözüldü" : SEVERITY_META[alert.severity].label}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

/**
 * KVKK sekmesi: mobil uygulamadaki rıza durumu + veri silme talebinin işlenmesi.
 * Talep işlendiğinde danışanın tüm mobil verileri silinir ve rıza "geri çekildi"
 * olarak kaydedilir; panel ölçümleri ve plan kayıtları etkilenmez.
 */
const PatientPrivacyTab: React.FC<{ patient: Patient }> = ({ patient }) => {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [processedAt, setProcessedAt] = React.useState<number | null>(null);

  const events = readMobileEvents();
  const patientEvents = events.filter((event) => event.patientId === patient.id);
  const consentEvent = latestConsentFor(events, patient.id);
  const status = consentStatusOf(events, patient.id);
  const scope = consentEvent ? (consentEvent.payload as ConsentPayload).scope : undefined;
  const meta = consentChipMeta(status);

  const processDeletion = () => {
    removePatientMobileEvents(patient.id);
    ingestMobileEvent({
      patientId: patient.id,
      type: "consent",
      timestamp: new Date().toISOString(),
      payload: { status: "revoked", scope: "Veri silme talebi işlendi — mobil veriler silindi" }
    });
    setProcessedAt(Date.now());
    setConfirmOpen(false);
  };

  return (
    <div className="drawer-stack">
      <div className="card">
        <h3>
          <ShieldCheck size={15} /> KVKK Rıza Durumu
        </h3>
        <div className="privacy-status">
          <span className={classNames("privacy-chip", meta.className)}>{meta.label}</span>
          <span className="muted">
            {consentEvent ? `son güncelleme ${timeAgoTr(consentEvent.timestamp)}` : "onay kaydı yok"}
          </span>
        </div>
        <ul className="privacy-meta">
          <li>
            <span className="muted">Kapsam</span>
            <strong>{scope ?? "Mobil veri paylaşımı ve panele aktarım"}</strong>
          </li>
          <li>
            <span className="muted">Mobil veri kaydı</span>
            <strong>{patientEvents.length}</strong>
          </li>
          <li>
            <span className="muted">Son işlem</span>
            <strong>{consentEvent ? new Date(consentEvent.timestamp).toLocaleString("tr-TR") : "—"}</strong>
          </li>
        </ul>
        {status === null ? (
          <p className="muted">Danışandan KVKK onayı alınmadı; mobil veri paylaşımı için onay bekleniyor.</p>
        ) : null}
        {processedAt ? (
          <p className="import-ok" role="status">
            Talep işlendi: danışanın mobil verileri silindi ve rıza geri çekildi olarak kaydedildi.
          </p>
        ) : null}
      </div>

      {status === "deletion_requested" ? (
        <div className="card">
          <h3>
            <ShieldAlert size={15} /> Veri Silme Talebi
          </h3>
          <p className="muted">
            {patient.name} tüm mobil verilerinin silinmesini talep etti
            {consentEvent ? ` (${timeAgoTr(consentEvent.timestamp)})` : ""}. Talep işlendiğinde mobilden gelen
            veriler silinir ve rıza geri çekilmiş sayılır.
          </p>
          <div className="card-actions">
            <button type="button" className="btn btn-danger btn-small" onClick={() => setConfirmOpen(true)}>
              <Trash2 size={14} /> Talebi işle (verileri sil)
            </button>
          </div>
        </div>
      ) : null}

      {confirmOpen ? (
        <ConfirmDialog
          title="Veri silme talebini işle"
          message={
            <>
              <p>
                <strong>{patient.name}</strong> için mobilden gelen tüm veri kayıtları silinsin mi?
              </p>
              <p className="muted">
                Ölçüm ve plan gibi panel kayıtları etkilenmez. Bu işlem geri alınamaz.
              </p>
            </>
          }
          confirmLabel="Verileri sil"
          onConfirm={processDeletion}
          onClose={() => setConfirmOpen(false)}
        />
      ) : null}
    </div>
  );
};

const App: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const tab = pathToTab(location.pathname);
  const setTab = React.useCallback(
    (next: AppTab) => navigate(next === "dashboard" ? "/" : `/${next}`),
    [navigate]
  );

  const [query, setQuery] = React.useState("");
  const [patients, setPatients] = usePersistentState<Patient[]>("dp_patients", DEMO_PATIENTS);
  const [selectedPatient, setSelectedPatient] = React.useState<Patient | null>(null);
  const [showDetail, setShowDetail] = React.useState(false);
  const [patientModalOpen, setPatientModalOpen] = React.useState(false);
  const [editingPatient, setEditingPatient] = React.useState<Patient | null>(null);
  const [patientToDelete, setPatientToDelete] = React.useState<Patient | null>(null);

  const [auth, setAuth] = React.useState<AuthSnapshot>(() => getAuthFromStorage());
  const [isAuthed, setIsAuthed] = React.useState(() => {
    const snapshot = getAuthFromStorage();
    return Boolean(snapshot.token) && snapshot.expiresAt > Date.now();
  });
  const [remainingSec, setRemainingSec] = React.useState(() => {
    const snapshot = getAuthFromStorage();
    return Math.max(0, Math.floor((snapshot.expiresAt - Date.now()) / 1000));
  });

  /**
   * Normal çıkış yerel kayıtları korur; clearLocalData=true (paylaşımlı bilgisayar) danışan verisini
   * localStorage'dan da siler. Her iki durumda da sayfa yeniden yüklenir, böylece bellekteki
   * danışan verisi (React state'i) sıfırlanır ve giriş ekranında görünür kalmaz.
   */
  const handleLogout = React.useCallback((clearLocalData = false) => {
    clearAuthStorage();
    if (clearLocalData) {
      clearSessionDataStorage();
    }
    setAuth({ token: null, user: null, expiresAt: 0 });
    setIsAuthed(false);
    setRemainingSec(0);
    // Bellekteki danışan verisi de silinsin diye sayfayı ana sayfadan yeniden yükle.
    window.history.replaceState(null, "", "#/");
    window.location.reload();
  }, []);

  const extendSession = React.useCallback(
    (minutes = 15) => {
      if (!isAuthed) {
        return;
      }

      // Uzatma, hareketsizlik süresinden kısa olamaz (aksi halde butona tıklamak süreyi kısaltırdı).
      const expiration = Date.now() + Math.max(minutes, getIdleTimeoutMin()) * 60 * 1000;
      const next: AuthSnapshot = {
        token: auth.token ?? "demo-token",
        user: auth.user ?? "user",
        expiresAt: expiration
      };
      setAuthToStorage(next);
      setAuth(next);
      setRemainingSec(Math.floor((expiration - Date.now()) / 1000));
    },
    [auth, isAuthed]
  );

  React.useEffect(() => {
    if (!isAuthed) {
      return;
    }

    const timer = window.setInterval(() => {
      const snapshot = getAuthFromStorage();
      const diff = Math.floor((snapshot.expiresAt - Date.now()) / 1000);
      setRemainingSec(Math.max(0, diff));

      if (!snapshot.expiresAt || snapshot.expiresAt <= Date.now()) {
        window.clearInterval(timer);
        handleLogout();
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isAuthed, handleLogout]);

  // Hareketsizlik zamanlayıcısı: kullanıcı etkinliğinde bitiş zamanını ayarlanan süre kadar ileri at.
  // Yazma işlemi kısıtlanır; localStorage'a yazıldığı için diğer sekmeler de "storage" olayıyla güncellenir.
  React.useEffect(() => {
    if (!isAuthed) {
      return;
    }

    let lastRefresh = 0;
    const handleActivity = () => {
      const now = Date.now();
      if (now - lastRefresh < ACTIVITY_REFRESH_THROTTLE_MS) {
        return;
      }
      const snapshot = getAuthFromStorage();
      // Süresi dolmuş oturum etkinlikle diriltilmez; sayaç zaten çıkış yapacak.
      if (!snapshot.token || snapshot.expiresAt <= now) {
        return;
      }
      lastRefresh = now;
      const expiration = Math.max(snapshot.expiresAt, now + getIdleTimeoutMin() * 60 * 1000);
      if (expiration === snapshot.expiresAt) {
        return;
      }
      const next: AuthSnapshot = { ...snapshot, expiresAt: expiration };
      setAuthToStorage(next);
      setAuth(next);
      setRemainingSec(Math.floor((expiration - now) / 1000));
    };

    const options: AddEventListenerOptions = { passive: true, capture: true };
    ACTIVITY_EVENTS.forEach((type) => window.addEventListener(type, handleActivity, options));
    return () => {
      ACTIVITY_EVENTS.forEach((type) => window.removeEventListener(type, handleActivity, options));
    };
  }, [isAuthed]);

  React.useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if ([AUTH_TOKEN_KEY, AUTH_USER_KEY, AUTH_EXPIRES_KEY].includes(event.key ?? "")) {
        const next = getAuthFromStorage();
        // Başka sekmede çıkış yapıldı: bu sekmenin belleğindeki danışan verisini de bırak.
        if (!next.token && event.key === AUTH_TOKEN_KEY) {
          window.history.replaceState(null, "", "#/");
          window.location.reload();
          return;
        }
        const valid = Boolean(next.token) && next.expiresAt > Date.now();
        setAuth(next);
        setIsAuthed(valid);
        setRemainingSec(Math.max(0, Math.floor((next.expiresAt - Date.now()) / 1000)));
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const filteredPatients = React.useMemo(() => {
    const lower = query.trim().toLowerCase();
    if (!lower) {
      return patients;
    }
    return patients.filter((patient) => patient.name.toLowerCase().includes(lower));
  }, [query, patients]);

  const applySessionTimeout = React.useCallback(
    (minutes: number) => {
      if (!isAuthed) {
        return;
      }
      const safe = Math.max(5, Math.min(180, minutes || DEFAULT_DURATION_MIN));
      const expiration = Date.now() + safe * 60 * 1000;
      const next: AuthSnapshot = {
        token: auth.token ?? "demo-token",
        user: auth.user ?? "user",
        expiresAt: expiration
      };
      setAuthToStorage(next);
      setAuth(next);
      setRemainingSec(Math.floor((expiration - Date.now()) / 1000));
    },
    [auth, isAuthed]
  );

  const handleLogin = React.useCallback((email: string, password: string) => {
    if (!email || !password) {
      return;
    }
    const expiration = Date.now() + getIdleTimeoutMin() * 60 * 1000;
    const next: AuthSnapshot = {
      token: "demo-token",
      user: email,
      expiresAt: expiration
    };
    setAuthToStorage(next);
    setAuth(next);
    setIsAuthed(true);
    setRemainingSec(Math.floor((expiration - Date.now()) / 1000));
  }, []);

  const getMeasurements = React.useCallback((patientId: number) => getInitialMeasurements(patientId), []);

  const getMobileEvents = React.useCallback(
    (patientId: number): MobileEvent[] => readMobileEvents().filter((event) => event.patientId === patientId),
    []
  );

  const [composerOpen, setComposerOpen] = React.useState(false);
  const [composerPatientId, setComposerPatientId] = React.useState<number | null>(null);
  const [priorityApptPatientId, setPriorityApptPatientId] = React.useState<number | null>(null);
  const [mobileEventsVersion, setMobileEventsVersion] = React.useState(0);

  // Mobil veri deposu değiştiğinde (mesaj gönderimi, simülasyon vb.) öncelik listesi anında güncellenir.
  React.useEffect(() => {
    const onChange = () => setMobileEventsVersion((version) => version + 1);
    window.addEventListener(MOBILE_EVENTS_CHANGED, onChange);
    return () => window.removeEventListener(MOBILE_EVENTS_CHANGED, onChange);
  }, []);

  const openComposer = React.useCallback((patientId: number) => {
    setComposerPatientId(patientId);
    setComposerOpen(true);
  }, []);

  const enginePatients = React.useMemo(
    () =>
      patients.map((patient) => ({
        id: patient.id,
        name: patient.name,
        plan: patient.plan,
        compliance: patient.compliance,
        status: patient.status,
        endDate: patient.endDate
      })),
    [patients]
  );

  // Öncelik listesi her sekme açılışında güncel veriyle yeniden hesaplanır.
  const priorityEntries = React.useMemo(() => {
    const rules = loadAlertRules(rulesFromClinicSettings());
    const dismissed = new Set(loadDismissedIds());
    const alerts = buildAlerts(
      enginePatients,
      getMeasurements,
      rules,
      loadResolvedIds(),
      Date.now(),
      getMobileEvents
    ).filter((alert) => !dismissed.has(alert.id));
    return buildPriorityList({ patients: enginePatients, getMobileEvents, getMeasurements, alerts, rules });
  }, [enginePatients, getMeasurements, getMobileEvents, tab, mobileEventsVersion]);

  const openDetail = React.useCallback((patient: Patient) => {
    setSelectedPatient(patient);
    setShowDetail(true);
  }, []);

  const closeDetail = React.useCallback(() => {
    setShowDetail(false);
  }, []);

  const openAddPatient = React.useCallback(() => {
    setEditingPatient(null);
    setPatientModalOpen(true);
  }, []);

  const openEditPatient = React.useCallback((patient: Patient) => {
    setEditingPatient(patient);
    setPatientModalOpen(true);
  }, []);

  const handleSavePatient = React.useCallback(
    (draft: PatientDraft) => {
      if (editingPatient && editingPatient.name !== draft.name) {
        const target = editingPatient;
        updateStoredAppointments((appointments) =>
          appointments.map((appt) =>
            isAppointmentOf(appt, target) ? { ...appt, patientId: target.id, patient: draft.name } : appt
          )
        );
      }
      setPatients((prev) => {
        if (editingPatient) {
          return prev.map((patient) =>
            patient.id === editingPatient.id ? { ...patient, ...draft, lastAction: "Az önce güncellendi" } : patient
          );
        }
        const nextId = prev.reduce((max, patient) => Math.max(max, patient.id), 0) + 1;
        return [...prev, { ...draft, id: nextId, lastAction: "Az önce eklendi" }];
      });
    },
    [editingPatient, setPatients]
  );

  /** Çekmece ve diyet planlayıcıdan gelen kısmi güncellemeler (plan ataması, uyum vb.). */
  const handleUpdatePatient = React.useCallback(
    (patientId: number, patch: Partial<Omit<Patient, "id">>) => {
      setPatients((prev) => prev.map((patient) => (patient.id === patientId ? { ...patient, ...patch } : patient)));
    },
    [setPatients]
  );

  const handleAssignPlan = React.useCallback(
    (patient: Patient) => {
      try {
        localStorage.setItem("dp_plan_patient", JSON.stringify(patient.id));
      } catch {
        // depolama kullanılamıyor — yoksay
      }
      setTab("plans");
    },
    [setTab]
  );

  const handleDeletePatient = React.useCallback((patient: Patient) => {
    setPatientToDelete(patient);
  }, []);

  const confirmDeletePatient = React.useCallback(() => {
    const patient = patientToDelete;
    if (!patient) {
      return;
    }
    setPatients((prev) => prev.filter((item) => item.id !== patient.id));
    updateStoredAppointments((appointments) => appointments.filter((appt) => !isAppointmentOf(appt, patient)));
    removePatientLocalData(patient.id);
    if (selectedPatient?.id === patient.id) {
      setShowDetail(false);
    }
    setPatientToDelete(null);
  }, [patientToDelete, setPatients, selectedPatient]);

  const handleImportData = React.useCallback(
    (raw: unknown): { ok: boolean; message: string } => {
      if (typeof raw !== "object" || raw === null || !Array.isArray((raw as { patients?: unknown }).patients)) {
        return { ok: false, message: "Geçersiz yedek: 'patients' listesi bulunamadı." };
      }
      const today = new Date().toISOString().slice(0, 10);
      // Biçim + gerçek takvim günü: "2025-99-99" ve "2025-02-30" gibi değerler elenir.
      const isDate = (value: unknown): value is string =>
        typeof value === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        !Number.isNaN(Date.parse(value)) &&
        new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
      const num = (value: unknown, fallback = 0): number =>
        typeof value === "number" && Number.isFinite(value) ? value : fallback;
      const numText = (value: unknown): string =>
        typeof value === "number" && Number.isFinite(value) ? String(value) : "";
      const MAX_TEXT = 120;

      const rows = (raw as { patients: unknown[] }).patients;
      const nextPatients: Patient[] = [];
      const nextMeasurements: Record<number, Measurement[]> = {};
      const usedIds = new Set<number>();
      let measurementCount = 0;
      let skippedMeasurements = 0;

      rows.forEach((entry, index) => {
        if (typeof entry !== "object" || entry === null) {
          return;
        }
        const row = entry as Record<string, unknown>;
        if (typeof row.name !== "string" || !row.name.trim()) {
          return;
        }
        let id = Number(row.id);
        if (!Number.isInteger(id) || id <= 0 || usedIds.has(id)) {
          id = (usedIds.size ? Math.max(...usedIds) : index) + 1;
        }
        usedIds.add(id);

        const startDate = isDate(row.startDate) ? (row.startDate as string) : today;
        nextPatients.push({
          id,
          name: row.name.trim().slice(0, MAX_TEXT),
          plan: typeof row.plan === "string" && row.plan.trim() ? row.plan.trim().slice(0, MAX_TEXT) : "Plan atanmadı",
          startDate,
          endDate: isDate(row.endDate) ? (row.endDate as string) : startDate,
          compliance: Math.max(0, Math.min(100, Math.round(num(row.compliance)))),
          lastAction: typeof row.lastAction === "string" && row.lastAction ? row.lastAction : "İçe aktarıldı",
          status: row.status === "Risk" ? "Risk" : "Aktif"
        });

        if (Array.isArray(row.measurements)) {
          // Ölçümler formdaki kurallarla (validateMeasurementForm) aynı sınırlardan geçer;
          // aralık dışı / eksik değerli kayıtlar atlanır.
          const valid: Measurement[] = [];
          (row.measurements as unknown[]).forEach((item, mi) => {
            if (typeof item !== "object" || item === null) {
              skippedMeasurements += 1;
              return;
            }
            const m = item as Record<string, unknown>;
            const formValues: MeasurementFormValues = {
              date: isDate(m.date) ? m.date : "",
              weightKg: numText(m.weightKg),
              heightCm: numText(m.heightCm),
              bodyFatPercentage: numText(m.bodyFatPercentage),
              muscleMassKg: numText(m.muscleMassKg),
              waistCm: numText(m.waistCm),
              hipCm: numText(m.hipCm),
              notes: typeof m.notes === "string" ? m.notes : ""
            };
            if (Object.keys(validateMeasurementForm(formValues)).length > 0) {
              skippedMeasurements += 1;
              return;
            }
            valid.push({
              id: typeof m.id === "string" ? m.id.slice(0, 64) : `imp-${id}-${mi}`,
              date: formValues.date,
              weightKg: num(m.weightKg),
              heightCm: num(m.heightCm),
              bodyFatPercentage: num(m.bodyFatPercentage),
              muscleMassKg: num(m.muscleMassKg),
              waistCm: num(m.waistCm),
              hipCm: num(m.hipCm),
              notes: formValues.notes
            });
          });
          if (valid.length > 0) {
            nextMeasurements[id] = valid;
            measurementCount += valid.length;
          }
        }
      });

      if (nextPatients.length === 0) {
        return { ok: false, message: "Yedekte geçerli danışan kaydı bulunamadı." };
      }

      setPatients(nextPatients);
      try {
        localStorage.setItem(MEASUREMENTS_STORAGE_KEY, JSON.stringify(nextMeasurements));
      } catch {
        // depolama kullanılamıyor — yoksay
      }
      clearPatientScopedStorage();
      // Randevular yedekte yok: kimliği yeni listede aynı adla eşleşmeyenler ada göre eşleşmeye döner.
      updateStoredAppointments((appointments) =>
        appointments.map((appt) => {
          if (appt.patientId === undefined) {
            return appt;
          }
          const match = nextPatients.find((patient) => patient.id === appt.patientId);
          return match && match.name === appt.patient ? appt : { ...appt, patientId: undefined };
        })
      );
      setShowDetail(false);
      return {
        ok: true,
        message:
          `${nextPatients.length} danışan ve ${measurementCount} ölçüm geri yüklendi.` +
          (skippedMeasurements > 0 ? ` ${skippedMeasurements} geçersiz ölçüm atlandı.` : "")
      };
    },
    [setPatients]
  );

  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const riskCount = React.useMemo(() => patients.filter((p) => p.status === "Risk").length, [patients]);

  const dashboardStats = React.useMemo(() => {
    const total = patients.length;
    const active = patients.filter((p) => p.status === "Aktif").length;
    const avgCompliance =
      total > 0 ? Math.round(patients.reduce((sum, p) => sum + (p.compliance || 0), 0) / total) : 0;
    const todayIso = new Date().toISOString().slice(0, 10);
    const upcomingAppointments = readStoredAppointments().filter((appt) => appt.date >= todayIso).length;
    return { total, active, avgCompliance, upcomingAppointments };
  }, [patients, tab]);

  // Çizelge işaretleri danışanın uyumunu da güncellediği için `patients` değişimi yeniden hesaplatır.
  const dashboardCharts = React.useMemo(() => buildDashboardCharts(patients), [patients, tab]);
  const adherenceTrend = React.useMemo(() => {
    const values = dashboardCharts.adherence
      .map((point) => point.value)
      .filter((value): value is number => value !== null);
    return values.length >= 2 ? values[values.length - 1] - values[0] : null;
  }, [dashboardCharts]);

  // Giriş ekranından (#/giris) giriş yapılınca panelin ana sayfasına geç.
  React.useEffect(() => {
    if (isAuthed && location.pathname === "/giris") {
      navigate("/", { replace: true });
    }
  }, [isAuthed, location.pathname, navigate]);

  // SEO: her rota için benzersiz sekme başlığı.
  React.useEffect(() => {
    document.title = resolveDocumentTitle(location.pathname, isAuthed);
  }, [location.pathname, isAuthed]);

  // Tanıtım sayfası: giriş yapılmamışken kök adreste, her zaman #/tanitim adresinde.
  // Diğer adreslerde (örn. süresi dolan oturumda #/settings) doğrudan giriş ekranı açılır.
  const routePath = location.pathname.replace(/\/+$/, "") || "/";

  // Yasal/iletişim sayfaları herkese açıktır (giriş yapılmış olsa da erişilebilir).
  const legalSlug = legalSlugFromPath(routePath);
  if (legalSlug) {
    return <LegalView slug={legalSlug} homeHref="#/" />;
  }

  if (routePath === "/tanitim" || (!isAuthed && routePath === "/")) {
    return <LandingPage isAuthed={isAuthed} onStart={() => navigate(isAuthed ? "/" : "/giris")} />;
  }

  if (!isAuthed) {
    return <LoginScreen onLogin={handleLogin} onBack={() => navigate("/")} />;
  }

  const pageTitles: Record<AppTab, { title: string; desc: string }> = {
    dashboard: { title: "Dashboard", desc: "Uyum, öğünler ve danışan özeti" },
    patients: { title: "Danışanlar", desc: "Tüm danışanlar ve uyum durumları" },
    plans: { title: "Diyet Planları", desc: "Şablonları sürükle-bırak ile düzenleyin" },
    appointments: { title: "Randevular", desc: "Kontrol ve görüşme takvimi" },
    alerts: { title: "Uyarılar", desc: "Eşikler, sessize alma ve otomasyon" },
    settings: { title: "Ayarlar", desc: "Varsayılan bildirim ve eşik ayarları" }
  };

  // Global arama yalnızca filtrelenebilir bir listesi olan sekmelerde gösterilir.
  // (Planlar/Ayarlar: filtrelenecek liste yok · Uyarılar: kendi aramasına sahip.)
  const searchPlaceholders: Partial<Record<AppTab, string>> = {
    dashboard: "Danışan ara...",
    patients: "Danışan ara...",
    appointments: "Randevu ara (danışan veya tür)..."
  };
  const showSearch = tab in searchPlaceholders;
  const searchPlaceholder = searchPlaceholders[tab] ?? "Ara...";

  return (
    <div className={classNames("layout app-shell", mobileNavOpen && "nav-open")}>
      <Sidebar
        tab={tab}
        onNavigate={(next) => {
          setTab(next);
          setMobileNavOpen(false);
        }}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((prev) => !prev)}
        riskCount={riskCount}
        avgCompliance={dashboardStats.avgCompliance}
        patientCount={dashboardStats.total}
      />
      {mobileNavOpen ? <div className="sidebar-scrim" onClick={() => setMobileNavOpen(false)} /> : null}

      <div className="main-column">
        <TopHeader
          query={query}
          onQuery={setQuery}
          showSearch={showSearch}
          searchPlaceholder={searchPlaceholder}
          user={auth.user}
          remainingSec={remainingSec}
          onExtend={() => extendSession(15)}
          onLogout={handleLogout}
          onMenuToggle={() => {
            if (window.innerWidth < 960) {
              setMobileNavOpen((prev) => !prev);
            } else {
              setSidebarCollapsed((prev) => !prev);
            }
          }}
        />

        <main className="content">
          <div className="page-head">
            <div>
              <h1>{pageTitles[tab].title}</h1>
              <p className="muted">{pageTitles[tab].desc}</p>
            </div>
            {tab === "patients" ? (
              <div className="page-head-actions">
                <span className="badge badge-rose"><TrendingDown size={12} /> {riskCount} riskli danışan</span>
                <button className="btn btn-primary btn-small" onClick={openAddPatient}>
                  <Plus size={14} /> Yeni Danışan
                </button>
              </div>
            ) : null}
          </div>

          {tab === "dashboard" && (
            <section className="tab-panel">
              <PriorityList
                entries={priorityEntries}
                onOpen={(patientId) => {
                  const target = patients.find((patient) => patient.id === patientId);
                  if (target) {
                    openDetail(target);
                  }
                }}
                onMessage={openComposer}
                onAppointment={(patientId) => setPriorityApptPatientId(patientId)}
              />
              <div className="grid grid-md-4">
                <StatCard title="Toplam Danışan" value={String(dashboardStats.total)} subtitle={`${dashboardStats.active} aktif · ${riskCount} riskli`} tone="emerald" icon={<Users size={18} />} />
                <StatCard title="Ortalama Uyum" value={`%${dashboardStats.avgCompliance}`} subtitle="Tüm danışanlar" tone="mint" icon={<CheckCircle2 size={18} />} />
                <StatCard title="Riskli Danışan" value={String(riskCount)} subtitle={riskCount > 0 ? "Takip gerekli" : "Risk yok"} tone="slate" icon={<TrendingDown size={18} />} />
                <StatCard title="Yaklaşan Randevu" value={String(dashboardStats.upcomingAppointments)} subtitle="Bugün ve sonrası" tone="amber" icon={<CalendarDays size={18} />} />
              </div>
              <p className="muted stat-legend">
                Durum rozetleri: <strong>Aktif</strong> düzenli takipteki danışanı, <strong>Risk</strong> uyum
                eşiğinin altına düşen danışanı gösterir. Toplam danışan = aktif + riskli.
              </p>

              <div className="grid grid-lg-5 dashboard-charts">
                <div className="card chart-card span-3">
                  <div className="card-head">
                    <h3><Activity size={15} /> 7 Günlük Uyum Yüzdesi</h3>
                    {dashboardCharts.trackedPatients === 0 ? (
                      <span className="badge badge-slate" title="Öğün çizelgesinde henüz işaret yok">Örnek veri</span>
                    ) : adherenceTrend !== null ? (
                      <span className={classNames("badge", adherenceTrend >= 0 ? "badge-emerald" : "badge-rose")}>
                        {adherenceTrend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {adherenceTrend >= 0 ? "+" : "−"}%{Math.abs(adherenceTrend)}
                      </span>
                    ) : null}
                  </div>
                  <div className="chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dashboardCharts.adherence}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(value) => [`%${value}`, "Uyum"]} />
                        <Line type="monotone" dataKey="value" stroke="#059669" strokeWidth={2.5} dot={{ r: 3, fill: "#059669" }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="card chart-card span-2">
                  <div className="card-head">
                    <h3><UtensilsCrossed size={15} /> Öğün Tamamlama Dağılımı</h3>
                    <span className="muted">
                      {dashboardCharts.trackedPatients === 0
                        ? "Örnek veri"
                        : `${dashboardCharts.trackedPatients} danışanın çizelgesi`}
                    </span>
                  </div>
                  <div className="chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dashboardCharts.meals}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-12} dy={8} height={52} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(value) => [`%${value}`, "Tamamlanan"]} />
                        <Bar dataKey="done" fill="#10b981" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <ActivityFeed patients={patients} />

              <div className="card">
                <div className="card-head">
                  <h3>Hızlı Danışan Görünümü</h3>
                  <span className="muted">{filteredPatients.length} kayıt</span>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Danışan</th>
                        <th>Plan</th>
                        <th>Tarih</th>
                        <th>Uyum</th>
                        <th>Son İşlem</th>
                        <th>Durum</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPatients.map((patient) => (
                        <PatientRow key={patient.id} patient={patient} onOpen={openDetail} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {tab === "patients" && (
            <section className="tab-panel">
              {filteredPatients.length === 0 ? (
                <div className="card">
                  <p className="muted">
                    {query.trim()
                      ? `"${query}" ile eşleşen danışan yok.`
                      : 'Henüz danışan yok. "Yeni Danışan" ile ekleyin.'}
                  </p>
                </div>
              ) : (
                <div className="patients-grid">
                  {filteredPatients.map((patient) => (
                    <PatientCard
                      key={patient.id}
                      patient={patient}
                      onOpen={openDetail}
                      onEdit={openEditPatient}
                      onAssignPlan={handleAssignPlan}
                      onDelete={handleDeletePatient}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {tab === "plans" && (
            <section className="tab-panel">
              <DnDPlanEditor patients={patients} onUpdatePatient={handleUpdatePatient} />
            </section>
          )}

          {tab === "appointments" && (
            <section className="tab-panel">
              <AppointmentsView
                patients={patients}
                query={query}
                getMeasurements={getMeasurements}
                getMobileEvents={getMobileEvents}
                onMessage={openComposer}
              />
            </section>
          )}

          {tab === "alerts" && (
            <section className="tab-panel">
              <AlertsView
                patients={enginePatients}
                getMeasurements={getMeasurements}
                getMobileEvents={getMobileEvents}
                onOpenPatient={(patientId) => {
                  const target = patients.find((patient) => patient.id === patientId);
                  if (target) {
                    openDetail(target);
                  }
                }}
              />
            </section>
          )}

          {tab === "settings" && (
            <section className="tab-panel">
              <SettingsView
                patients={patients.map((patient) => ({
                  id: patient.id,
                  name: patient.name,
                  plan: patient.plan,
                  compliance: patient.compliance,
                  status: patient.status,
                  startDate: patient.startDate,
                  endDate: patient.endDate,
                  lastAction: patient.lastAction
                }))}
                getMeasurements={getMeasurements}
                onSessionTimeoutSave={applySessionTimeout}
                onImportData={handleImportData}
                initialSection={settingsSectionFromSearch(location.search)}
              />
            </section>
          )}
        </main>

        <footer className="app-footer">© {new Date().getFullYear()} NutriCare · Diyetisyen Paneli</footer>

        {showDetail ? (
          <PatientDetailDrawer
            // Seçim anındaki kopya yerine güncel kaydı ver; çekmecedeki değişiklikler anında yansısın.
            patient={patients.find((patient) => patient.id === selectedPatient?.id) ?? null}
            onClose={closeDetail}
            onUpdatePatient={handleUpdatePatient}
            onMessage={openComposer}
          />
        ) : null}

        {composerOpen ? (
          <MessageComposer
            patients={patients.map((patient) => ({ id: patient.id, name: patient.name }))}
            initialPatientId={composerPatientId ?? undefined}
            onClose={() => setComposerOpen(false)}
          />
        ) : null}

        {priorityApptPatientId !== null ? (
          <AppointmentFormModal
            patients={patients}
            others={readStoredAppointments()}
            initialPatientId={priorityApptPatientId}
            onClose={() => setPriorityApptPatientId(null)}
            onSubmit={(draft) => {
              appendStoredAppointment(draft);
            }}
          />
        ) : null}

        {patientModalOpen ? (
          <PatientFormModal
            initial={editingPatient ?? undefined}
            onClose={() => setPatientModalOpen(false)}
            onSubmit={handleSavePatient}
          />
        ) : null}

        {patientToDelete ? (
          <ConfirmDialog
            title="Danışanı sil"
            message={
              <>
                <p>
                  <strong>{patientToDelete.name}</strong> adlı danışan silinsin mi?
                </p>
                <p className="muted">
                  Danışanın ölçüm geçmişi, randevuları, planı ve notları da kaldırılır. Bu işlem geri alınamaz.
                </p>
              </>
            }
            onConfirm={confirmDeletePatient}
            onClose={() => setPatientToDelete(null)}
          />
        ) : null}
      </div>
    </div>
  );
};

if (import.meta.env.DEV && typeof window !== "undefined") {
  try {
    console.assert(formatMMSS(61) === "01:01", "formatMMSS(61) => 01:01 olmalı");
    console.assert(formatMMSS(0) === "00:00", "formatMMSS(0) => 00:00 olmalı");
    console.assert(formatMMSS(3599) === "59:59", "formatMMSS(3599) => 59:59 olmalı");
    console.assert(calculateBMI(83.8, 178) === 26.4, "calculateBMI(83.8,178) => 26.4 olmalı");
    console.assert(getBMICategory(17.3) === "Zayıf", "17.3 => Zayıf olmalı");
    console.assert(getBMICategory(23.6) === "Normal", "23.6 => Normal olmalı");
    console.assert(getBMICategory(26.4) === "Fazla Kilolu", "26.4 => Fazla Kilolu olmalı");
    console.assert(getBMICategory(32.1) === "Obez", "32.1 => Obez olmalı");
    console.assert(calculateBmrWithFormula({ weightKg: 70, heightCm: 170, age: 30, sex: "erkek" }, "mifflin") === 1618, "BMR erkek 70/170/30 => 1618 olmalı");
    console.assert(calculateBmrWithFormula({ weightKg: 70, heightCm: 170, age: 30, sex: "kadin" }, "mifflin") === 1452, "BMR kadın 70/170/30 => 1452 olmalı");
    console.assert(calculateBmrWithFormula({ weightKg: 70, heightCm: 170, age: 30, sex: "erkek" }, "harris") === 1672, "Harris erkek 70/170/30 => 1672 olmalı");
    console.assert(
      calculateTargets({ weightKg: 70, heightCm: 170, age: 30, sex: "erkek" }, "orta", "koruma", { carbsPct: 50, proteinPct: 20, fatPct: 30 }, "mifflin").targetCalories === 2508,
      "TDEE 1618x1.55 koruma => 2508 olmalı"
    );
    console.assert(addDaysIso("2025-11-03", 14) === "2025-11-17", "2025-11-03 + 14 gün => 2025-11-17 olmalı");
    console.assert(
      gridCompliance([[true, true, false, false, false], [true, true, true, true, true]], 2) === 70,
      "2 günde 7/10 öğün => %70 olmalı"
    );
    console.assert(
      timeAgoTr(new Date(Date.now() - 5 * 60000).toISOString()) === "5 dk önce",
      "timeAgoTr(5dk) => 5 dk önce olmalı"
    );
    console.assert(
      isQuietNow(["23:00", "07:00"], true, new Date(2025, 0, 1, 2, 0)) === true,
      "02:00 sessiz saat içinde olmalı"
    );
    console.assert(
      isQuietNow(["23:00", "07:00"], true, new Date(2025, 0, 1, 12, 0)) === false,
      "12:00 sessiz saat dışında olmalı"
    );
  } catch (error) {
    // no-op
  }
}

export default App;

