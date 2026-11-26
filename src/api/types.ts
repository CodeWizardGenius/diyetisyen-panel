/** Panelde paylaşılan sunucu veri tipleri. */

import type { PatientStatus, PatientPackage, Patient } from "../data/demo";
import type { MobileEvent } from "../types/mobileData";

export type { Patient } from "../data/demo";

export type Measurement = {
  id: string;
  date: string; // ISO YYYY-MM-DD
  weightKg: number | null;
  heightCm: number | null;
  bodyFatPercentage: number | null;
  muscleMassKg: number | null;
  waistCm: number | null;
  hipCm: number | null;
  notes?: string;
};

export type PlanItem = {
  id: string;
  label: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type MacroSplit = {
  carbsPct: number;
  proteinPct: number;
  fatPct: number;
};

/** Diyet planlayıcıda "Kaydet" ile danışana atanan plan. */
export type SavedPatientPlan = {
  templateName: string;
  items: PlanItem[];
  macros: MacroSplit;
  notes: string;
  repeat: { every: number; unit: string };
  targetCalories: number;
  savedAt: string;
  goal?: string;
  startDate?: string;
  endDate?: string;
  waterTargetMl?: number;
  bmr?: number | null;
  tdee?: number | null;
};

/** [gün][öğün] → tamamlandı mı */
export type MealGridState = boolean[][];

export type AppointmentStatus = "Onaylı" | "Bekliyor" | "İptal";

export type Appointment = {
  id: string;
  patientId?: number;
  patient: string;
  date: string;
  time: string;
  type: string;
  status: AppointmentStatus;
};

export type AppointmentDraft = Omit<Appointment, "id">;

export type AppNotification = {
  id: string;
  title: string;
  detail: string;
  time: string;
  tone: string;
  createdAt?: string | null;
  readAt?: string | null;
};

export type PatientDraft = {
  name: string;
  plan: string;
  startDate: string;
  endDate: string;
  compliance?: number;
  status: PatientStatus;
  package?: PatientPackage;
};

export type TimelineSlice = {
  key: string;
  mealsLogged: number;
  mealCompliance: number | null;
  waterMl: number | null;
  weightKg: number | null;
  hasData: boolean;
};

export type PriorityReason = { label: string; points: number };

export type PriorityEntry = {
  patient: {
    id: number;
    name: string;
    plan: string;
    compliance: number;
    status: PatientStatus;
    endDate: string;
  };
  score: number;
  reasons: PriorityReason[];
  summary: string;
};

export type DashboardActivityItem = {
  id: string;
  patientName: string;
  type: string;
  at: string;
};

export type DashboardData = {
  stats: {
    patientCount: number;
    avgCompliance: number | null;
    riskCount: number;
    activeAlerts: number;
  };
  priority: PriorityEntry[];
  alerts: import("../types/alerts").PatientAlert[];
  activity: DashboardActivityItem[];
  upcomingAppointments: unknown[];
};

export type WeeklyReportData = {
  patientId: number;
  weekStart: string;
  weekEnd: string;
  rangeLabel: string;
  compliance: {
    score: number | null;
    meals: number;
    compliant: number;
    partial: number;
    offPlan: number;
    source?: "manual" | "computed" | "none";
  };
  trend: number | null;
  previousScore: number | null;
  waterAvgMl: number | null;
  weight: { from: number; to: number; delta: number } | null;
  loggedDays: number;
  slices: TimelineSlice[];
  alerts: import("../types/alerts").PatientAlert[];
  generatedAt: string;
};

export type Message = {
  id: string;
  direction: "patient" | "dietitian";
  text: string;
  templateId?: string;
  sentAt: string;
  readAt: string | null;
};

export type AppointmentRequest = {
  id: string;
  patientId?: number;
  name: string;
  phone: string;
  preferredDate: string;
  preferredTime: string;
  note?: string;
  status: "bekliyor" | "onaylandi" | "reddedildi";
  createdAt: string;
};

export type Me = {
  id: string;
  email: string;
  name: string;
  title: string;
  diplomaNo?: string;
  clinicName: string;
  phone?: string;
  contactEmail?: string;
  footerText?: string;
  sessionTimeoutMin?: number;
};

export type KvkkState = {
  status: "granted" | "revoked" | "deletion_requested" | "deleted" | null;
  scope: string;
  updatedAt: string | null;
  deletionRequest: {
    id: string;
    status: string;
    scope: string;
    requested_by: string;
    requested_at: string;
    completed_at: string | null;
  } | null;
};

export type ApiActivity = MobileEvent;

export type SessionResult = {
  token: string;
  refreshToken: string;
  user?: { id?: string; email?: string; name?: string; title?: string; clinicName?: string } | string;
  expiresAt: string;
};

/* ------------------------------ 2. tur eklemeleri ---------------------------- */

export type AppointmentLinkState = {
  active: boolean;
  createdAt?: string;
  expiresAt?: string;
};

export type BackupPatient = Patient & {
  heightCm?: number | null;
  weightKg?: number | null;
  age?: number | null;
  sex?: "kadin" | "erkek" | null;
  measurements?: Array<{
    date: string;
    weightKg?: number | null;
    heightCm?: number | null;
    bodyFatPercentage?: number | null;
    muscleMassKg?: number | null;
    waistCm?: number | null;
    hipCm?: number | null;
    notes?: string;
  }>;
};

export type BackupPayload = {
  version: number;
  exportedAt: string;
  patients: BackupPatient[];
};

export type BackupImportResult = {
  patientsCreated: number;
  measurementsCreated: number;
};

export type ExportAuditEntry = {
  id: string;
  type: string;
  patient_count: number;
  measurement_count: number;
  created_at: string;
};

export type PatientSummary = {
  patient: Patient;
  notes: { body: string; updatedAt: string | null } | null;
  reminders: Record<string, string>;
};

export type HealthConsent = {
  danisanId: number;
  status: "granted" | "revoked";
  turler: Record<string, boolean>;
  zamanDamgasi: string;
};

export type HealthRecord = {
  id: string;
  danisanId: number;
  kaynak: string;
  cihazAdi: string | null;
  cihazTuru: string | null;
  kaynakUygulama?: string | null;
  kaynakUygulamaAdi?: string | null;
  disKayitId: string | null;
  zamanDamgasi: string;
  bitis: string | null;
  alinmaZamani: string;
  toplam?: boolean;
  tur: string;
  deger: Record<string, unknown>;
};

export type HealthData = {
  riza: HealthConsent | null;
  sonSenkron: string | null;
  kayitlar: HealthRecord[];
};

export type PlanTemplateItem = {
  id?: string;
  mealSlot?: string;
  label: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type PlanTemplate = {
  id: string;
  name: string;
  notes: string;
  repeatEvery: number;
  repeatUnit: string;
  targetCalories: number;
  macros: MacroSplit;
  goal: "verme" | "koruma" | "alma";
  activityLevel: "sedanter" | "hafif" | "orta" | "aktif" | "cokAktif";
  bmrFormula: "mifflin" | "harris";
  hydrationMlPerKg: number;
  items: PlanTemplateItem[];
  createdAt: string | null;
  updatedAt: string | null;
};

export type PlanTemplateInput = Omit<PlanTemplate, "id" | "createdAt" | "updatedAt">;

export type MessageTemplate = {
  id: string;
  name: string;
  body: string;
  isDefault?: boolean;
};
