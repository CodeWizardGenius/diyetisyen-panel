import { apiDelete, apiGet, apiPatch, apiPost, apiPut, ApiError, request } from "./client";
import type { AlertRules, PatientAlert } from "../types/alerts";
import type {
  ClinicSettings,
  MeasurementLike,
  NutritionSettings,
  NotificationSettings,
  ScheduleSettings
} from "../types/settings";
import type {
  Appointment,
  AppointmentDraft,
  AppointmentRequest,
  AppNotification,
  DashboardData,
  KvkkState,
  MealGridState,
  Measurement,
  Message,
  Patient,
  PatientDraft,
  PriorityEntry,
  SavedPatientPlan,
  TimelineSlice,
  WeeklyReportData
} from "./types";
import type { MobileEvent } from "../types/mobileData";

/* ---------------------------------- hasta --------------------------------- */

export const patientsApi = {
  listele(query = "") {
    return apiGet<Patient[]>("/panel/danisanlar", query ? { query } : undefined);
  },
  getir(patientNo: number) {
    return apiGet<Patient>(`/panel/danisanlar/${patientNo}`);
  },
  ekle(draft: PatientDraft) {
    return apiPost<Patient>("/panel/danisanlar", draft);
  },
  guncelle(patientNo: number, patch: Partial<PatientDraft> & { compliance?: number | null }) {
    return apiPatch<Patient>(`/panel/danisanlar/${patientNo}`, patch);
  },
  sil(patientNo: number) {
    return apiDelete<{ patientNo: number }>(`/panel/danisanlar/${patientNo}`);
  },
  notlar(patientNo: number) {
    return apiGet<{ body: string; updatedAt: string | null }>(`/panel/danisanlar/${patientNo}/notlar`);
  },
  notKaydet(patientNo: number, body: string) {
    return apiPut<{ body: string; updatedAt: string }>(`/panel/danisanlar/${patientNo}/notlar`, { body });
  },
  hatirlatmalar(patientNo: number) {
    return apiGet<Record<string, string>>(`/panel/danisanlar/${patientNo}/hatirlatmalar`);
  },
  hatirlatmaKaydet(patientNo: number, times: Record<string, string>) {
    return apiPut<Record<string, string>>(`/panel/danisanlar/${patientNo}/hatirlatmalar`, times);
  },
  davet(patientNo: number, body: { email?: string; phone?: string } = {}) {
    return apiPost<{ davetToken: string; expiresAt: string }>(`/panel/danisanlar/${patientNo}/davet`, body);
  }
};

/* --------------------------------- ölçümler -------------------------------- */

export const measurementsApi = {
  listele(patientNo: number) {
    return apiGet<Measurement[]>(`/panel/danisanlar/${patientNo}/olcumler`);
  },
  ekle(patientNo: number, measurement: Omit<Measurement, "id">) {
    return apiPost<Measurement>(`/panel/danisanlar/${patientNo}/olcumler`, {
      date: measurement.date,
      weightKg: measurement.weightKg,
      heightCm: measurement.heightCm,
      bodyFatPercentage: measurement.bodyFatPercentage,
      muscleMassKg: measurement.muscleMassKg,
      waistCm: measurement.waistCm,
      hipCm: measurement.hipCm,
      notes: measurement.notes
    });
  },
  sil(id: string) {
    return apiDelete<void>(`/panel/olcumler/${id}`);
  },
  guncelle(id: string, patch: Partial<Omit<Measurement, "id">>) {
    return apiPatch<Measurement>(`/panel/olcumler/${id}`, patch);
  }
};

/* ---------------------------------- planlar -------------------------------- */

export const plansApi = {
  async getir(patientNo: number): Promise<SavedPatientPlan | null> {
    try {
      return await apiGet<SavedPatientPlan>(`/panel/danisanlar/${patientNo}/plan`);
    } catch (error) {
      if (error instanceof ApiError && (error.code === "PLAN_YOK" || error.status === 404)) {
        return null;
      }
      throw error;
    }
  },
  kaydet(patientNo: number, plan: SavedPatientPlan) {
    return apiPut<SavedPatientPlan>(`/panel/danisanlar/${patientNo}/plan`, plan);
  },
  sablonlar() {
    return apiGet<Array<{ id: string; name: string }>>("/panel/plan-sablonlari");
  }
};

/* --------------------------------- takip ----------------------------------- */

const GRID_SLOTS = ["kahvalti", "ara1", "ogle", "ara2", "aksam"] as const;

export const trackingApi = {
  ogunCizelgesi(patientNo: number, planStart: string) {
    return apiGet<MealGridState>(`/panel/danisanlar/${patientNo}/ogun-cizelgesi`, { planStart });
  },
  async ogunKaydet(patientNo: number, planStart: string, grid: MealGridState) {
    const cells = [] as Array<{ planStartDate: string; dayIndex: number; mealSlot: string; done: boolean }>;
    grid.forEach((row, dayIndex) => {
      row.forEach((done, mealIndex) => {
        const mealSlot = GRID_SLOTS[mealIndex];
        if (mealSlot) {
          cells.push({ planStartDate: planStart, dayIndex, mealSlot, done });
        }
      });
    });
    return apiPut<{ updated: number }>(`/panel/danisanlar/${patientNo}/ogun-cizelgesi`, cells);
  },
  aktiviteler(limit = 24) {
    return apiGet<MobileEvent[]>("/panel/aktiviteler", { limit });
  },
  okunmamis(since: string) {
    return apiGet<{ count: number }>("/panel/aktiviteler/okunmamis", { since });
  },
  olaylar(patientNo: number) {
    return apiGet<MobileEvent[]>(`/panel/danisanlar/${patientNo}/olaylar`);
  },
  zamanCizelgesi(patientNo: number, hafta = 0) {
    return apiGet<TimelineSlice[]>(`/panel/danisanlar/${patientNo}/zaman-cizelgesi`, { hafta });
  }
};

/* --------------------------------- randevu --------------------------------- */

export const appointmentsApi = {
  listele(from: string, to: string) {
    return apiGet<Appointment[]>("/panel/randevular", { from, to });
  },
  ekle(draft: AppointmentDraft) {
    return apiPost<Appointment>("/panel/randevular", {
      patientNo: draft.patientId,
      patient: draft.patient,
      date: draft.date,
      time: draft.time,
      type: draft.type,
      status: draft.status
    });
  },
  guncelle(id: string, patch: Partial<AppointmentDraft>) {
    return apiPatch<Appointment>(`/panel/randevular/${id}`, patch);
  },
  sil(id: string) {
    return apiDelete<void>(`/panel/randevular/${id}`);
  },
  yaklasan() {
    return apiGet<{ count: number }>("/panel/randevular/yaklasan");
  },
  calismaSaatleri() {
    return apiGet<ScheduleSettings["workingDays"]>("/panel/calisma-saatleri");
  },
  calismaSaatleriKaydet(days: ScheduleSettings["workingDays"]) {
    return apiPut<ScheduleSettings["workingDays"]>("/panel/calisma-saatleri", days);
  },
  randevuAyarlari() {
    return apiGet<{ defaultDurationMin: 30 | 45 | 60; bufferMin: number }>("/panel/randevu-ayarlari");
  },
  randevuAyarlariKaydet(body: { defaultDurationMin: 30 | 45 | 60; bufferMin: number }) {
    return apiPut<{ defaultDurationMin: 30 | 45 | 60; bufferMin: number }>("/panel/randevu-ayarlari", body);
  },
  talepler(durum: "bekliyor" | "onaylandi" | "reddedildi" = "bekliyor") {
    return apiGet<AppointmentRequest[]>("/panel/randevu-talepleri", { durum });
  },
  talepOnayla(id: string) {
    return apiPost<Appointment>(`/panel/randevu-talepleri/${id}/onayla`);
  },
  talepReddet(id: string) {
    return apiPost<void>(`/panel/randevu-talepleri/${id}/reddet`);
  },
  linkOlustur(patientNo: number) {
    return apiPost<{ token: string; patientId: number; expiresAt: string; url: string }>(
      `/panel/danisanlar/${patientNo}/randevu-linki`
    );
  },
  linkDurumu(patientNo: number) {
    return apiGet<AppointmentLinkState>(`/panel/danisanlar/${patientNo}/randevu-linki`);
  }
};

/* --------------------------------- içgörü ---------------------------------- */

export const insightApi = {
  uyarilar(durum: "aktif" | "cozulmus" | "yoksayilan" = "aktif", severity?: string) {
    return apiGet<PatientAlert[]>("/panel/uyarilar", { durum, severity });
  },
  coz(id: string) {
    return apiPost<{ id: string; isResolved: boolean }>(`/panel/uyarilar/${id}/coz`);
  },
  yoksay(id: string) {
    return apiPost<{ id: string; dismissedAt: string | null }>(`/panel/uyarilar/${id}/yoksay`);
  },
  kurallar() {
    return apiGet<AlertRules>("/panel/uyari-kurallari");
  },
  kurallarKaydet(rules: AlertRules) {
    return apiPut<AlertRules>("/panel/uyari-kurallari", rules);
  },
  oncelik() {
    return apiGet<PriorityEntry[]>("/panel/oncelik");
  },
  dashboard() {
    return apiGet<DashboardData>("/panel/dashboard");
  },
  haftalikRapor(patientNo: number, hafta = 0) {
    return apiGet<WeeklyReportData>(`/panel/danisanlar/${patientNo}/haftalik-rapor`, { hafta });
  },
  raporGonder(patientNo: number, hafta = 0) {
    return apiPost<{ sentAt?: string }>(`/panel/danisanlar/${patientNo}/haftalik-rapor/gonder?hafta=${hafta}`, {
      onay: true
    });
  }
};

/* --------------------------------- mesajlar -------------------------------- */

export const messagesApi = {
  listele(patientNo: number, limit = 8) {
    return apiGet<Message[]>(`/panel/danisanlar/${patientNo}/mesajlar`, { limit });
  },
  gonder(patientNo: number, text: string, templateId?: string) {
    return apiPost<Message>(`/panel/danisanlar/${patientNo}/mesajlar`, {
      text,
      ...(templateId ? { templateId } : {})
    });
  },
  okundu(id: string) {
    return apiPost<{ id: string; readAt: string | null }>(`/panel/mesajlar/${id}/okundu`);
  },
  sablonlar() {
    return apiGet<MessageTemplate[]>("/panel/mesaj-sablonlari");
  }
};

/* -------------------------------- bildirimler ------------------------------ */

export type NotificationsResult = {
  items: AppNotification[];
  lastReadAt: string | null;
  unreadCount: number;
};

export const notificationsApi = {
  listele() {
    return apiGet<NotificationsResult>("/panel/bildirimler");
  },
  okundu(id: string) {
    return apiPost<{ id: string; readAt: string | null }>(`/panel/bildirimler/${id}/okundu`);
  },
  tumOkundu() {
    return apiPost<{ ok: boolean }>("/panel/bildirimler/okundu");
  },
  temizle() {
    return apiDelete<{ ok: boolean }>("/panel/bildirimler");
  }
};

/* ---------------------------------- ayarlar -------------------------------- */

export const settingsApi = {
  profil(body: ClinicSettings["profile"]) {
    return apiPut<ClinicSettings["profile"]>("/panel/ayarlar/profil", body);
  },
  guvenlik(body: ClinicSettings["security"]) {
    return apiPut<ClinicSettings["security"]>("/panel/ayarlar/guvenlik", body);
  },
  beslenme() {
    return apiGet<NutritionSettings>("/panel/ayarlar/beslenme");
  },
  beslenmeKaydet(body: NutritionSettings) {
    return apiPut<NutritionSettings>("/panel/ayarlar/beslenme", body);
  },
  bildirimler() {
    return apiGet<NotificationSettings>("/panel/ayarlar/bildirimler");
  },
  bildirimlerKaydet(body: NotificationSettings) {
    return apiPut<NotificationSettings>("/panel/ayarlar/bildirimler", body);
  },
  calisma(body: ScheduleSettings) {
    return apiPut<ScheduleSettings>("/panel/ayarlar/calisma", body);
  },
  /** Bölüm uçlarını paralel çağırıp birleştirir; hata veren bölüm varsayılanla döner. */
  async tumu(fallback: ClinicSettings, profile: Partial<ClinicSettings["profile"]>): Promise<ClinicSettings> {
    const [nutrition, notifications, workingDays, appointment] = await Promise.allSettled([
      settingsApi.beslenme(),
      settingsApi.bildirimler(),
      appointmentsApi.calismaSaatleri(),
      appointmentsApi.randevuAyarlari()
    ]);
    return {
      profile: { ...fallback.profile, ...profile },
      nutrition: nutrition.status === "fulfilled" ? nutrition.value : fallback.nutrition,
      notifications: notifications.status === "fulfilled" ? notifications.value : fallback.notifications,
      schedule: {
        workingDays:
          workingDays.status === "fulfilled" && Array.isArray(workingDays.value)
            ? workingDays.value
            : fallback.schedule.workingDays,
        defaultDurationMin:
          appointment.status === "fulfilled" ? appointment.value.defaultDurationMin : fallback.schedule.defaultDurationMin,
        bufferMin: appointment.status === "fulfilled" ? appointment.value.bufferMin : fallback.schedule.bufferMin
      },
      security: { ...fallback.security }
    };
  }
};

/* ---------------------------------- KVKK ----------------------------------- */

export const consentApi = {
  kvkk(patientNo: number) {
    return apiGet<KvkkState>(`/panel/danisanlar/${patientNo}/kvkk`);
  },
  silmeTalebi(patientNo: number) {
    return apiPost<{ requestId: string }>(`/panel/danisanlar/${patientNo}/silme-talebi`);
  },
  silmeOnayla(patientNo: number, requestId: string) {
    return apiPost<{ requestId: string }>(`/panel/danisanlar/${patientNo}/silme-talebi/${requestId}/onayla`);
  }
};

/* ------------------------------ herkese açık ------------------------------- */

export type PublicLinkMeta = {
  patientName?: string;
  dietitianName?: string;
  clinicName?: string;
  expiresAt?: string;
  valid?: boolean;
};

export const publicApi = {
  link(token: string) {
    // Herkese açık uç: Authorization gönderilmez.
    return request<PublicLinkMeta>(`/acik/randevu-talebi/${encodeURIComponent(token)}`, { auth: false });
  },
  talepGonder(
    token: string,
    body: { name: string; phone: string; preferredDate: string; preferredTime: string; note?: string }
  ) {
    return request<{ id?: string }>(`/acik/randevu-talebi/${encodeURIComponent(token)}`, {
      method: "POST",
      body,
      auth: false
    });
  },
  durum(token: string) {
    return request<{ status: "bekliyor" | "onaylandi" | "reddedildi" }>(
      `/acik/randevu-talebi/${encodeURIComponent(token)}/durum`,
      { auth: false }
    );
  }
};

export type { MeasurementLike };
