import { DEFAULT_ALERT_RULES, type PatientAlert } from "../types/alerts";
import { DEFAULT_SETTINGS, type ClinicSettings } from "../types/settings";
import { cache, markPatientLoaded, notifyServerData } from "./cache";
import { authApi } from "./auth";
import {
  appointmentsApi,
  insightApi,
  messagesApi,
  notificationsApi,
  patientsApi,
  plansApi,
  settingsApi,
  trackingApi,
  measurementsApi,
  consentApi,
  type NotificationsResult
} from "./endpoints";

const isoDay = (offsetDays = 0): string => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
};

const emptyGrid = () => Array.from({ length: 14 }, () => ["", "", "", "", ""].map(() => false));

/** Giriş sonrası panelin ihtiyaç duyduğu sunucu durumunu yükler. */
export async function bootstrapCore(): Promise<{ patientsOk: boolean; settings: ClinicSettings }> {
  const tasks = await Promise.allSettled([
    patientsApi.listele(),
    authApi.ben(),
    appointmentsApi.listele(isoDay(-365), isoDay(365)),
    notificationsApi.listele(),
    trackingApi.aktiviteler(50),
    insightApi.uyarilar("aktif"),
    insightApi.uyarilar("cozulmus"),
    insightApi.oncelik(),
    insightApi.dashboard(),
    insightApi.kurallar()
  ]);

  const [patients, me, appointments, notifications, activities, activeAlerts, resolvedAlerts, priority, dashboard, rules] =
    tasks;

  if (patients.status === "fulfilled") cache.patients = patients.value;
  if (me.status === "fulfilled") cache.me = me.value;

  const profile = me.status === "fulfilled" ? me.value : null;
  const settings = await settingsApi.tumu(DEFAULT_SETTINGS, {
    dietitianName: profile?.name ?? DEFAULT_SETTINGS.profile.dietitianName,
    title: profile?.title ?? DEFAULT_SETTINGS.profile.title,
    clinicName: profile?.clinicName ?? DEFAULT_SETTINGS.profile.clinicName,
    email: profile?.contactEmail || profile?.email || DEFAULT_SETTINGS.profile.email,
    phone: profile?.phone ?? DEFAULT_SETTINGS.profile.phone,
    diplomaNo: profile?.diplomaNo ?? DEFAULT_SETTINGS.profile.diplomaNo,
    footerText: profile?.footerText ?? DEFAULT_SETTINGS.profile.footerText
  });
  if (profile?.sessionTimeoutMin) {
    settings.security = { sessionTimeoutMin: profile.sessionTimeoutMin };
  }
  cache.settings = settings;

  if (appointments.status === "fulfilled") cache.appointments = appointments.value;
  if (notifications.status === "fulfilled") {
    const result = notifications.value as NotificationsResult;
    cache.notifications = result.items ?? [];
  }
  if (activities.status === "fulfilled") cache.activities = activities.value ?? [];

  const allAlerts: PatientAlert[] = [];
  for (const result of [activeAlerts, resolvedAlerts]) {
    if (result.status === "fulfilled") allAlerts.push(...result.value);
  }
  cache.alerts = allAlerts;
  cache.issueAlerts = allAlerts;
  cache.rules = rules.status === "fulfilled" ? rules.value : { ...DEFAULT_ALERT_RULES };
  if (priority.status === "fulfilled") cache.priority = priority.value ?? [];
  if (dashboard.status === "fulfilled") cache.dashboard = dashboard.value;

  notifyServerData();
  return { patientsOk: patients.status === "fulfilled", settings };
}

/** Seçili danışanın detay verilerini tembel yükler (sayfa açılışında tüm danışanlar çekilmez). */
export async function hydratePatient(patientNo: number, planStartDate?: string): Promise<void> {
  const patient = cache.patients.find((item) => item.id === patientNo);
  const planStart = planStartDate ?? patient?.startDate ?? isoDay();
  const [measurements, plan, notes, reminders, grid, events, timeline, consent, messages] = await Promise.allSettled([
    measurementsApi.listele(patientNo),
    plansApi.getir(patientNo),
    patientsApi.notlar(patientNo),
    patientsApi.hatirlatmalar(patientNo),
    trackingApi.ogunCizelgesi(patientNo, planStart),
    trackingApi.olaylar(patientNo),
    trackingApi.zamanCizelgesi(patientNo, 0),
    consentApi.kvkk(patientNo),
    messagesApi.listele(patientNo, 20)
  ]);

  if (measurements.status === "fulfilled") cache.measurements[patientNo] = measurements.value ?? [];
  if (plan.status === "fulfilled") cache.plans[patientNo] = plan.value;
  if (notes.status === "fulfilled") cache.notes[patientNo] = notes.value?.body ?? "";
  if (reminders.status === "fulfilled") cache.reminders[patientNo] = reminders.value ?? {};
  if (grid.status === "fulfilled") {
    cache.mealGrids[`${patientNo}:${planStart}`] = Array.isArray(grid.value) && grid.value.length > 0 ? grid.value : emptyGrid();
  }
  if (events.status === "fulfilled") cache.eventsByPatient[patientNo] = events.value ?? [];
  if (timeline.status === "fulfilled") cache.timelineByPatient[patientNo] = timeline.value ?? [];
  if (consent.status === "fulfilled") cache.consentByPatient[patientNo] = consent.value;
  if (messages.status === "fulfilled") cache.messagesByPatient[patientNo] = messages.value ?? [];

  markPatientLoaded(patientNo);
  notifyServerData();
}

/** Sunucuya ulaşılamadığında ağ hatasını ayırt etmek için kullanılır. */
export const isNetworkIssue = (error: unknown): boolean => {
  const code = (error as { code?: string } | null)?.code;
  return code === "AG_YOK" || (error instanceof TypeError);
};
