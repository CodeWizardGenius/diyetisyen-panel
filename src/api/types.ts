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
  compliance: { score: number | null; meals: number; compliant: number; partial: number; offPlan: number };
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
