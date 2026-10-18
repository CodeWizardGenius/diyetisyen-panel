/**
 * Danışan mobil uygulaması → diyetisyen paneli veri akışı.
 *
 * Bu demo sürümde gerçek bir sunucu yoktur; mobil uygulamadan gelen olaylar
 * `ingestMobileEvent` ile alınır ve tarayıcının yerel deposuna yazılır. Doğrulama
 * "reddetme" değil "işaretleme" mantığıyla çalışır: eksik veya geçersiz alanlar
 * kaydı düşürmez, kayıt `status: "eksik"` ve `issues` ile işaretlenir.
 *
 * Gerçek bir API'ye geçişte yalnızca `ingestMobileEvent` gövdesinin HTTP çağrısına
 * dönüştürülmesi yeterlidir; tipler ve doğrulama kuralları aynen kullanılır.
 */

export type MobileEventType =
  | "meal"
  | "measurement"
  | "water"
  | "activity"
  | "wellbeing"
  | "message"
  | "achievement"
  | "consent";

export type MealKind = "kahvalti" | "ara_ogun" | "ogle" | "ikindi" | "aksam";
export type PlanCompliance = "uygun" | "kismen" | "uygun_degil";
export type WellbeingScore = 1 | 2 | 3 | 4 | 5;

export const MEAL_KINDS: MealKind[] = ["kahvalti", "ara_ogun", "ogle", "ikindi", "aksam"];
export const PLAN_COMPLIANCES: PlanCompliance[] = ["uygun", "kismen", "uygun_degil"];

export const MEAL_KIND_LABELS: Record<MealKind, string> = {
  kahvalti: "Kahvaltı",
  ara_ogun: "Ara Öğün",
  ogle: "Öğle",
  ikindi: "İkindi",
  aksam: "Akşam"
};

export const PLAN_COMPLIANCE_LABELS: Record<PlanCompliance, string> = {
  uygun: "Plana uygun",
  kismen: "Kısmen uygun",
  uygun_degil: "Plana uygun değil"
};

export const MOBILE_EVENT_LABELS: Record<MobileEventType, string> = {
  meal: "Öğün",
  measurement: "Ölçüm",
  water: "Su",
  activity: "Aktivite",
  wellbeing: "His/semptom",
  message: "Mesaj",
  achievement: "Başarı",
  consent: "KVKK"
};

export interface MealPayload {
  mealKind: MealKind;
  planCompliance: PlanCompliance;
  /** Opsiyonel: danışanın eklediği yemek fotoğrafı (URL). */
  photoUrl?: string;
  note?: string;
}

export interface MeasurementPayload {
  /** Haftalık giriş beklenir; alanlardan en az biri dolu olmalıdır. */
  weightKg?: number;
  waistCm?: number;
  hipCm?: number;
}

export interface WaterPayload {
  /** Günlük içilen su (ml). */
  ml: number;
  /** Opsiyonel: danışana özel hedef; yoksa klinik varsayılanı kullanılır. */
  goalMl?: number;
}

export interface ActivityPayload {
  /** Adım sayısı veya egzersiz (tür + dakika). */
  steps?: number;
  exerciseType?: string;
  minutes?: number;
}

export interface WellbeingPayload {
  fullness?: WellbeingScore;
  energy?: WellbeingScore;
  sleepQuality?: WellbeingScore;
  bloating?: WellbeingScore;
}

export interface MessagePayload {
  text: string;
  /** "patient": danışandan gelen serbest metin · "dietitian": panelden gönderilen mesaj */
  direction?: "patient" | "dietitian";
  /** Diyetisyen mesajında kullanılan hazır şablon kimliği (serbest metinde yok). */
  templateId?: string;
  /** Danışanın mesajı okuduğu zaman (ISO). Yoksa mesaj henüz okunmadı. */
  readAt?: string;
}

export interface AchievementPayload {
  /** Rozet adı/kimliği (ör. "7 Gün Seri"). */
  badge: string;
  /** Rozetin gerekçesi: üst üste veri girilen gün sayısı. */
  streakDays?: number;
}

export type ConsentStatus = "granted" | "revoked" | "deletion_requested" | "deleted";

export const CONSENT_STATUSES: ConsentStatus[] = ["granted", "revoked", "deletion_requested", "deleted"];

export const CONSENT_STATUS_LABELS: Record<ConsentStatus, string> = {
  granted: "Onay verildi",
  revoked: "Onay geri çekildi",
  deletion_requested: "Veri silme talebi (bekliyor)",
  deleted: "Mobil veriler silindi"
};

export interface ConsentPayload {
  status: ConsentStatus;
  /** Rıza kapsamı veya talebin açıklaması. */
  scope?: string;
}

export type MobilePayload =
  | MealPayload
  | MeasurementPayload
  | WaterPayload
  | ActivityPayload
  | WellbeingPayload
  | MessagePayload
  | AchievementPayload
  | ConsentPayload;

export interface MobileEvent {
  id: string;
  patientId: number;
  type: MobileEventType;
  /** Verinin ait olduğu zaman (danışan cihazı); yoksa kayıt zamanı kullanılır. */
  timestamp: string;
  /** Panele ulaştığı zaman; gecikmeli/zamansız veriyi tespit için. */
  receivedAt: string;
  payload: MobilePayload;
  status: "ok" | "eksik";
  issues: string[];
}

/** Mobil uygulamadan gelen ham kayıt; alanlar eksik/geçersiz olabilir. */
export interface IncomingMobileEvent {
  id?: string;
  patientId: number;
  type: MobileEventType;
  timestamp?: string;
  receivedAt?: string;
  payload?: Record<string, unknown>;
}

export const MOBILE_EVENTS_STORAGE_KEY = "dp_mobile_events";

/** Mobil veri deposu her değiştiğinde pencere içinde yayılan olay adı. */
export const MOBILE_EVENTS_CHANGED = "dp:mobile-events-changed";
export const DEFAULT_WATER_GOAL_ML = 2000;

const MAX_NOTE_LENGTH = 500;
const MAX_MESSAGE_LENGTH = 2000;

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isScore = (value: unknown): value is WellbeingScore =>
  isFiniteNumber(value) && Number.isInteger(value) && value >= 1 && value <= 5;
const inRange = (value: unknown, min: number, max: number): value is number =>
  isFiniteNumber(value) && value >= min && value <= max;
const isIsoTimestamp = (value: unknown): value is string =>
  typeof value === "string" && !Number.isNaN(Date.parse(value));

/**
 * Olay türüne göre payload doğrulaması. Dönen `issues` boşsa kayıt "ok" sayılır.
 * Eksik alanlar kaydı reddetmez; yalnızca işaretler.
 */
export const validateMobilePayload = (type: MobileEventType, payload: Record<string, unknown>): string[] => {
  const issues: string[] = [];
  switch (type) {
    case "meal": {
      if (typeof payload.mealKind !== "string" || !MEAL_KINDS.includes(payload.mealKind as MealKind)) {
        issues.push("Öğün tipi eksik veya geçersiz.");
      }
      if (
        typeof payload.planCompliance !== "string" ||
        !PLAN_COMPLIANCES.includes(payload.planCompliance as PlanCompliance)
      ) {
        issues.push("Plana uygunluk bilgisi eksik veya geçersiz.");
      }
      if (payload.note !== undefined && (typeof payload.note !== "string" || payload.note.length > MAX_NOTE_LENGTH)) {
        issues.push("Not metni geçersiz veya çok uzun.");
      }
      break;
    }
    case "measurement": {
      const hasWeight = payload.weightKg !== undefined;
      const hasWaist = payload.waistCm !== undefined;
      const hasHip = payload.hipCm !== undefined;
      if (!hasWeight && !hasWaist && !hasHip) {
        issues.push("En az bir ölçüm değeri gerekli (kilo, bel veya kalça).");
      }
      if (hasWeight && !inRange(payload.weightKg, 20, 400)) {
        issues.push("Kilo değeri 20–400 kg aralığında olmalı.");
      }
      if (hasWaist && !inRange(payload.waistCm, 30, 250)) {
        issues.push("Bel çevresi 30–250 cm aralığında olmalı.");
      }
      if (hasHip && !inRange(payload.hipCm, 30, 250)) {
        issues.push("Kalça çevresi 30–250 cm aralığında olmalı.");
      }
      break;
    }
    case "water": {
      if (!inRange(payload.ml, 0, 10000)) {
        issues.push("Su miktarı (ml) eksik veya 0–10000 aralığı dışında.");
      }
      if (payload.goalMl !== undefined && !inRange(payload.goalMl, 200, 10000)) {
        issues.push("Su hedefi 200–10000 ml aralığında olmalı.");
      }
      break;
    }
    case "activity": {
      const hasSteps = inRange(payload.steps, 0, 100000);
      const hasExercise =
        typeof payload.exerciseType === "string" &&
        payload.exerciseType.trim() !== "" &&
        inRange(payload.minutes, 0, 1440);
      if (!hasSteps && !hasExercise) {
        issues.push("Aktivite için adım ya da egzersiz (tür + dakika) gerekli.");
      }
      break;
    }
    case "wellbeing": {
      const keys = ["fullness", "energy", "sleepQuality", "bloating"] as const;
      const present = keys.filter((key) => payload[key] !== undefined);
      if (present.length === 0) {
        issues.push("En az bir his/semptom puanı gerekli (tokluk, enerji, uyku, şişkinlik).");
      }
      for (const key of present) {
        if (!isScore(payload[key])) {
          issues.push(`${key} puanı 1–5 aralığında olmalı.`);
        }
      }
      break;
    }
    case "message": {
      if (typeof payload.text !== "string" || payload.text.trim() === "") {
        issues.push("Mesaj metni boş olamaz.");
      } else if (payload.text.length > MAX_MESSAGE_LENGTH) {
        issues.push(`Mesaj en fazla ${MAX_MESSAGE_LENGTH} karakter olabilir.`);
      }
      if (payload.readAt !== undefined && !isIsoTimestamp(payload.readAt)) {
        issues.push("Okundu bilgisi geçersiz bir zaman içeriyor.");
      }
      break;
    }
    case "achievement": {
      if (typeof payload.badge !== "string" || payload.badge.trim() === "") {
        issues.push("Rozet bilgisi eksik.");
      }
      if (payload.streakDays !== undefined && !inRange(payload.streakDays, 0, 3650)) {
        issues.push("Seri gün sayısı geçersiz.");
      }
      break;
    }
    case "consent": {
      if (
        typeof payload.status !== "string" ||
        !CONSENT_STATUSES.includes(payload.status as ConsentStatus)
      ) {
        issues.push("KVKK rıza durumu eksik veya geçersiz.");
      }
      if (payload.scope !== undefined && typeof payload.scope !== "string") {
        issues.push("Rıza kapsamı metin olmalı.");
      }
      break;
    }
    default:
      issues.push("Bilinmeyen veri türü.");
  }
  return issues;
};

/** Ham kaydı normalize eder, eksik alanları işaretler; asla hata fırlatmaz. */
export const normalizeMobileEvent = (incoming: IncomingMobileEvent, now: number = Date.now()): MobileEvent => {
  const receivedAt = isIsoTimestamp(incoming.receivedAt) ? incoming.receivedAt : new Date(now).toISOString();
  const issues: string[] = [];
  let timestamp: string;
  if (isIsoTimestamp(incoming.timestamp)) {
    timestamp = incoming.timestamp;
  } else {
    timestamp = receivedAt;
    issues.push("Zaman damgası eksik — kayıt zamanı kullanıldı.");
  }
  issues.push(...validateMobilePayload(incoming.type, incoming.payload ?? {}));
  return {
    id: incoming.id ?? `ev-${incoming.type}-${incoming.patientId}-${now}-${Math.random().toString(36).slice(2, 8)}`,
    patientId: incoming.patientId,
    type: incoming.type,
    timestamp,
    receivedAt,
    payload: (incoming.payload ?? {}) as MobilePayload,
    status: issues.length > 0 ? "eksik" : "ok",
    issues
  };
};

const readRaw = (): MobileEvent[] => {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(MOBILE_EVENTS_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as MobileEvent[]) : [];
  } catch {
    return [];
  }
};

const writeRaw = (events: MobileEvent[]): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.setItem(MOBILE_EVENTS_STORAGE_KEY, JSON.stringify(events));
    window.dispatchEvent(new CustomEvent(MOBILE_EVENTS_CHANGED));
  } catch {
    // depolama kullanılamıyor — yoksay
  }
};

export const readMobileEvents = (): MobileEvent[] => readRaw();

/** Yeni olay(lar)ı depolar; normalize edilmiş kayıtları döndürür. */
export const ingestMobileEvent = (incoming: IncomingMobileEvent, now: number = Date.now()): MobileEvent => {
  const event = normalizeMobileEvent(incoming, now);
  writeRaw([...readRaw(), event]);
  return event;
};

export const ingestMobileEvents = (incomings: IncomingMobileEvent[], now: number = Date.now()): MobileEvent[] => {
  const normalized = incomings.map((incoming) => normalizeMobileEvent(incoming, now));
  writeRaw([...readRaw(), ...normalized]);
  return normalized;
};

export const removePatientMobileEvents = (patientId: number): void => {
  const next = readRaw().filter((event) => event.patientId !== patientId);
  writeRaw(next);
};

export const clearMobileEvents = (): void => {
  writeRaw([]);
};

/**
 * Danışanın mesajı okuduğunu işaretler (mobil uygulamadaki "okundu" bilgisinin
 * panele yansımasını taklit eder). Bulunamazsa null döner.
 */
export const markMessageRead = (eventId: string, at: number = Date.now()): MobileEvent | null => {
  const events = readRaw();
  const index = events.findIndex((event) => event.id === eventId && event.type === "message");
  if (index === -1) {
    return null;
  }
  const current = events[index];
  const updated: MobileEvent = {
    ...current,
    payload: { ...(current.payload as MessagePayload), readAt: new Date(at).toISOString() }
  };
  events[index] = updated;
  writeRaw(events);
  return updated;
};

/** Danışana gönderilmiş (panel → mobil) mesajlar, en yeni önce. */
export const outboundMessagesFor = (patientId: number): MobileEvent[] =>
  sortMobileEventsDesc(
    eventsForPatient(readRaw(), patientId).filter(
      (event) => event.type === "message" && (event.payload as MessagePayload).direction === "dietitian"
    )
  );

/** Sıralamada "en yeni" için kullanılan etkin zaman (ait olduğu zaman, yoksa kayıt zamanı). */
export const eventTime = (event: MobileEvent): number => Date.parse(event.timestamp) || Date.parse(event.receivedAt) || 0;

export const sortMobileEventsDesc = (events: MobileEvent[]): MobileEvent[] =>
  [...events].sort((a, b) => eventTime(b) - eventTime(a));

export const eventsForPatient = (events: MobileEvent[], patientId: number): MobileEvent[] =>
  events.filter((event) => event.patientId === patientId);

/** Danışanın en son veri giriş zamanı (ms); hiç yoksa null. */
export const latestPatientEventTime = (events: MobileEvent[], patientId: number): number | null => {
  const times = eventsForPatient(events, patientId).map(eventTime);
  return times.length > 0 ? Math.max(...times) : null;
};

/** Danışanın en güncel KVKK rıza olayı; hiç kayıt yoksa null (onay alınmadı). */
export const latestConsentFor = (events: MobileEvent[], patientId: number): MobileEvent | null => {
  const consents = eventsForPatient(events, patientId).filter((event) => event.type === "consent");
  return consents.length > 0 ? sortMobileEventsDesc(consents)[0] : null;
};

/** Rıza durumunu tek etikete indirger: "granted" | "revoked" | "deletion_requested" | null. */
export const consentStatusOf = (events: MobileEvent[], patientId: number): ConsentStatus | null => {
  const latest = latestConsentFor(events, patientId);
  if (!latest) {
    return null;
  }
  const status = (latest.payload as ConsentPayload).status;
  return CONSENT_STATUSES.includes(status) ? status : null;
};

/** ISO zaman damgasından yerel gün anahtarı (YYYY-MM-DD). */
export const localDayKey = (iso: string): string => {
  const date = new Date(iso);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

/** Bir olayı akışta okunabilir tek satıra çevirir. */
export const describeMobileEvent = (event: MobileEvent): string => {
  switch (event.type) {
    case "meal": {
      const payload = event.payload as MealPayload;
      const kind = payload.mealKind ? MEAL_KIND_LABELS[payload.mealKind] : "öğün";
      if (payload.planCompliance === "uygun") return `${kind} yemeğini plana uygun kaydetti.`;
      if (payload.planCompliance === "kismen") return `${kind} yemeğini kısmen uygun kaydetti.`;
      if (payload.planCompliance === "uygun_degil") return `${kind} yemeğini plana uygun olmayan şekilde kaydetti.`;
      return `${kind} kaydetti.`;
    }
    case "measurement": {
      const payload = event.payload as MeasurementPayload;
      const parts: string[] = [];
      if (payload.weightKg !== undefined) parts.push(`kilo: ${payload.weightKg} kg`);
      if (payload.waistCm !== undefined) parts.push(`bel: ${payload.waistCm} cm`);
      if (payload.hipCm !== undefined) parts.push(`kalça: ${payload.hipCm} cm`);
      return parts.length > 0 ? `ölçüm girdi — ${parts.join(", ")}.` : "ölçüm girdi.";
    }
    case "water": {
      const payload = event.payload as WaterPayload;
      return typeof payload.ml === "number" ? `su girdi: ${payload.ml} ml.` : "su girdi.";
    }
    case "activity": {
      const payload = event.payload as ActivityPayload;
      if (typeof payload.steps === "number") return `aktivite girdi: ${payload.steps} adım.`;
      if (payload.exerciseType) return `aktivite girdi: ${payload.exerciseType}${payload.minutes ? ` (${payload.minutes} dk)` : ""}.`;
      return "aktivite girdi.";
    }
    case "wellbeing": {
      const payload = event.payload as WellbeingPayload;
      const parts: string[] = [];
      if (payload.energy !== undefined) parts.push(`enerji ${payload.energy}/5`);
      if (payload.sleepQuality !== undefined) parts.push(`uyku ${payload.sleepQuality}/5`);
      if (payload.fullness !== undefined) parts.push(`tokluk ${payload.fullness}/5`);
      if (payload.bloating !== undefined) parts.push(`şişkinlik ${payload.bloating}/5`);
      return parts.length > 0 ? `his/semptom girdi — ${parts.join(", ")}.` : "his/semptom girdi.";
    }
    case "message": {
      const payload = event.payload as MessagePayload;
      return payload.direction === "dietitian" ? "için mesaj gönderildi." : "mesaj gönderdi.";
    }
    case "achievement": {
      const payload = event.payload as AchievementPayload;
      const streak = typeof payload.streakDays === "number" ? ` (${payload.streakDays} gün üst üste)` : "";
      return `yeni rozet kazandı: ${payload.badge || "veri serisi"}${streak}.`;
    }
    case "consent": {
      const payload = event.payload as ConsentPayload;
      if (payload.status === "granted") return "KVKK kapsamında veri paylaşımına onay verdi.";
      if (payload.status === "revoked") return "KVKK rızasını geri çekti.";
      if (payload.status === "deletion_requested") return "verilerinin silinmesini talep etti.";
      if (payload.status === "deleted") return "verileri KVKK talebiyle silindi.";
      return "KVKK rızası güncellendi.";
    }
    default:
      return "veri girdi.";
  }
};

/** Her veri türü için örnek payload ve doğrulama kuralı (dokümantasyon + test verisi). */
export const MOBILE_EVENT_EXAMPLES: Record<MobileEventType, { payload: Record<string, unknown>; rule: string }> = {
  meal: {
    payload: { mealKind: "ogle", planCompliance: "uygun", note: "Tavuk + salata", photoUrl: "https://.../ogun.jpg" },
    rule: "öğün tipi (kahvaltı/ara öğün/öğle/ikindi/akşam) ve plana uygunluk zorunlu; fotoğraf ve not opsiyonel."
  },
  measurement: {
    payload: { weightKg: 78.2, waistCm: 92, hipCm: 104 },
    rule: "en az bir değer (kilo 20–400, bel/kalça 30–250 cm); haftalık giriş beklenir."
  },
  water: {
    payload: { ml: 1750, goalMl: 2000 },
    rule: "ml zorunlu (0–10000); hedef opsiyonel (200–10000)."
  },
  activity: {
    payload: { steps: 8200, exerciseType: "Yürüyüş", minutes: 40 },
    rule: "adım (0–100000) ya da egzersiz türü + dakika (0–1440) gerekli."
  },
  wellbeing: {
    payload: { fullness: 4, energy: 3, sleepQuality: 2, bloating: 3 },
    rule: "en az bir puan; her puan 1–5 aralığında."
  },
  message: {
    payload: { text: "Bugün tatlıya kaçtım, moralim bozuk.", direction: "patient" },
    rule: "boş olamaz, en fazla 2000 karakter."
  },
  achievement: {
    payload: { badge: "7 Gün Seri", streakDays: 7 },
    rule: "rozet adı zorunlu; seri gün sayısı opsiyonel (0–3650)."
  },
  consent: {
    payload: { status: "granted", scope: "Mobil veri paylaşımı ve panele aktarım" },
    rule: "durum zorunlu: granted | revoked | deletion_requested | deleted; kapsam metni opsiyonel."
  }
};

/**
 * İlk açılışta akışı ve uyarı motorunu beslemek için örnek mobil veri üretir.
 * Depoda kayıt varsa hiçbir şey yapmaz.
 */
export const seedMobileDataIfEmpty = (now: number = Date.now()): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (localStorage.getItem(MOBILE_EVENTS_STORAGE_KEY) !== null) {
      return;
    }
  } catch {
    return;
  }
  const iso = (daysAgo: number, hour: number, minute: number): string => {
    const date = new Date(now);
    date.setDate(date.getDate() - daysAgo);
    date.setHours(hour, minute, 0, 0);
    return date.toISOString();
  };
  const seed: IncomingMobileEvent[] = [
    // Barış Karapelit — bugün aktif
    { patientId: 1, type: "meal", timestamp: iso(0, 8, 15), payload: { mealKind: "kahvalti", planCompliance: "uygun", note: "Yumurta + tam buğday" } },
    { patientId: 1, type: "meal", timestamp: iso(0, 12, 40), payload: { mealKind: "ogle", planCompliance: "uygun" } },
    { patientId: 1, type: "water", timestamp: iso(0, 14, 5), payload: { ml: 1500, goalMl: 2500 } },
    { patientId: 1, type: "activity", timestamp: iso(0, 18, 20), payload: { steps: 8200, minutes: 35, exerciseType: "Yürüyüş" } },
    // Elif Y. — bugün öğle kaydı
    { patientId: 2, type: "meal", timestamp: iso(0, 12, 40), payload: { mealKind: "ogle", planCompliance: "uygun", note: "Mercimek + salata" } },
    { patientId: 2, type: "water", timestamp: iso(0, 13, 10), payload: { ml: 2000 } },
    { patientId: 2, type: "wellbeing", timestamp: iso(0, 20, 30), payload: { fullness: 4, energy: 4, sleepQuality: 3, bloating: 2 } },
    // Meriç B. — 3 gündür veri yok (hareketsizlik kuralı planlı örnek)
    { patientId: 3, type: "meal", timestamp: iso(3, 13, 10), payload: { mealKind: "ogle", planCompliance: "uygun_degil", note: "Fast food" } },
    { patientId: 3, type: "meal", timestamp: iso(3, 19, 30), payload: { mealKind: "aksam", planCompliance: "kismen" } },
    { patientId: 3, type: "measurement", timestamp: iso(3, 9, 0), payload: { weightKg: 74.3, waistCm: 88.5 } },
    // KVKK: Barış ve Elif onaylı; Meriç'ten onay yok (örnek senaryo).
    { patientId: 1, type: "consent", timestamp: iso(30, 10, 0), payload: { status: "granted", scope: "Mobil veri paylaşımı ve panele aktarım" } },
    { patientId: 2, type: "consent", timestamp: iso(21, 10, 0), payload: { status: "granted", scope: "Mobil veri paylaşımı ve panele aktarım" } }
  ];
  ingestMobileEvents(seed, now);
};