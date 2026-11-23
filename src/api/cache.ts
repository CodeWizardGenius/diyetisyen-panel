/**
 * Sunucu verisinin bellek içi önbelleği.
 *
 * Ekranlar `http` modunda bu önbellekten okur; `localStorage`'a danışan/klinik
 * verisi yazılmaz. Yazmalar API'ye gider ve başarılı yanıt önbelleğe işlenir.
 * `mock` modunda ise eski `localStorage` yolu kullanılmaya devam eder.
 */
import type { Patient } from "../data/demo";
import type { PatientAlert, AlertRules } from "../types/alerts";
import type { ClinicSettings } from "../types/settings";
import type { MobileEvent } from "../types/mobileData";
import type {
  Appointment,
  AppNotification,
  DashboardData,
  KvkkState,
  MealGridState,
  Measurement,
  Message,
  Me,
  PriorityEntry,
  SavedPatientPlan,
  TimelineSlice,
  WeeklyReportData
} from "./types";

export type ServerCache = {
  patients: Patient[];
  measurements: Record<number, Measurement[]>;
  plans: Record<number, SavedPatientPlan | null>;
  notes: Record<number, string>;
  reminders: Record<number, Record<string, string>>;
  mealGrids: Record<string, MealGridState>;
  appointments: Appointment[];
  notifications: AppNotification[];
  alerts: PatientAlert[];
  issueAlerts: PatientAlert[];
  rules: AlertRules | null;
  dashboard: DashboardData | null;
  priority: PriorityEntry[];
  activities: MobileEvent[];
  eventsByPatient: Record<number, MobileEvent[]>;
  timelineByPatient: Record<number, TimelineSlice[]>;
  consentByPatient: Record<number, KvkkState>;
  messagesByPatient: Record<number, Message[]>;
  settings: ClinicSettings | null;
  me: Me | null;
  weeklyReports: Record<string, WeeklyReportData>;
  loadedPatients: Set<number>;
};

const emptyCache = (): ServerCache => ({
  patients: [],
  measurements: {},
  plans: {},
  notes: {},
  reminders: {},
  mealGrids: {},
  appointments: [],
  notifications: [],
  alerts: [],
  issueAlerts: [],
  rules: null,
  dashboard: null,
  priority: [],
  activities: [],
  eventsByPatient: {},
  timelineByPatient: {},
  consentByPatient: {},
  messagesByPatient: {},
  settings: null,
  me: null,
  weeklyReports: {},
  loadedPatients: new Set<number>()
});

export const cache: ServerCache = emptyCache();

const listeners = new Set<() => void>();

export const notifyServerData = (): void => {
  listeners.forEach((listener) => listener());
};

export const subscribeServerData = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const resetServerCache = (): void => {
  Object.assign(cache, emptyCache());
  notifyServerData();
};

/** Danışanın tüm detayları yüklendi mi? */
export const isPatientLoaded = (patientId: number): boolean => cache.loadedPatients.has(patientId);

export const markPatientLoaded = (patientId: number): void => {
  cache.loadedPatients.add(patientId);
};

export const markPatientUnloaded = (patientId: number): void => {
  cache.loadedPatients.delete(patientId);
  delete cache.measurements[patientId];
  delete cache.plans[patientId];
  delete cache.notes[patientId];
  delete cache.reminders[patientId];
  delete cache.eventsByPatient[patientId];
  delete cache.timelineByPatient[patientId];
  delete cache.consentByPatient[patientId];
  delete cache.messagesByPatient[patientId];
  Object.keys(cache.mealGrids).forEach((key) => {
    if (key.startsWith(`${patientId}:`)) {
      delete cache.mealGrids[key];
    }
  });
};

export const mealGridKey = (patientId: number, planStart: string): string => `${patientId}:${planStart}`;
