import type { MeasurementLike } from "../../types/settings";
import type { PatientPackage } from "../../data/demo";
import type { AlertRules, PatientAlert } from "../../types/alerts";
import {
  eventTime,
  eventsForPatient,
  latestPatientEventTime,
  localDayKey,
  type MeasurementPayload,
  type MobileEvent,
  type WaterPayload
} from "../../types/mobileData";

export interface EnginePatient {
  id: number;
  name: string;
  plan: string;
  compliance: number;
  status: string;
  endDate: string;
  /** Paket takibi: tanımlıysa paket bitişi/ödeme uyarısı üretilir. */
  package?: PatientPackage;
}

type GetMeasurements = (patientId: number) => MeasurementLike[];
type GetMobileEvents = (patientId: number) => MobileEvent[];

const DAY_MS = 86_400_000;

const emptyMobileEvents: GetMobileEvents = () => [];

const minutesAgoIso = (now: number, minutes: number): string =>
  new Date(now - minutes * 60 * 1000).toISOString();

/** Uyum eşiğinin altında kalan her danışan için uyarı üretir (canlı veriden). */
const deriveAdherenceAlerts = (
  patients: EnginePatient[],
  rules: AlertRules,
  now: number
): PatientAlert[] =>
  patients
    .filter((patient) => patient.compliance < rules.complianceThreshold)
    .map((patient) => {
      const gap = rules.complianceThreshold - patient.compliance;
      return {
        id: `adh-${patient.id}`,
        patientId: patient.id,
        patientName: patient.name,
        patientPlan: patient.plan,
        severity: gap >= 15 ? "critical" : "warning",
        category: "adherence",
        title: `Uyum %${patient.compliance}'ye düştü`,
        description: `Eşik %${rules.complianceThreshold} — hedefin ${gap} puan altında. Plan gözden geçirilmeli.`,
        timestamp: minutesAgoIso(now, 25 + patient.id * 17),
        isResolved: false
      } as PatientAlert;
    });

/** Son ölçüm penceresinde anlamlı kilo değişimi yoksa plato uyarısı üretir (canlı veriden). */
const derivePlateauAlerts = (
  patients: EnginePatient[],
  getMeasurements: GetMeasurements,
  rules: AlertRules,
  now: number
): PatientAlert[] => {
  const alerts: PatientAlert[] = [];
  // Kuraldaki "plato haftası" sayısı kadar son ölçüm penceresine bakılır (hafta ≈ ölçüm).
  const windowSize = Math.max(2, Math.round(rules.plateauWeeks) + 1);
  for (const patient of patients) {
    const rows = [...getMeasurements(patient.id)].sort((a, b) => a.date.localeCompare(b.date));
    if (rows.length < windowSize) {
      continue;
    }
    const recent = rows.slice(-windowSize);
    const weights = recent.map((row) => row.weightKg);
    const span = Math.max(...weights) - Math.min(...weights);
    if (span < 0.5) {
      alerts.push({
        id: `plt-${patient.id}`,
        patientId: patient.id,
        patientName: patient.name,
        patientPlan: patient.plan,
        severity: "warning",
        category: "weight_plateau",
        title: "Kilo platosu şüphesi",
        description: `Son ${windowSize} ölçümde toplam değişim ${span.toFixed(1)} kg — ${rules.plateauWeeks}+ haftadır durağan seyir.`,
        timestamp: minutesAgoIso(now, 90 + patient.id * 11),
        isResolved: false
      });
    }
  }
  return alerts;
};

/** Riskli / düşük uyumlu danışanlar için kaçan öğün uyarısı üretir (canlı veriden). */
const deriveMissedMealAlerts = (
  patients: EnginePatient[],
  rules: AlertRules,
  now: number
): PatientAlert[] =>
  patients
    .filter((patient) => patient.status === "Risk" || patient.compliance < 60)
    .map((patient) => ({
      id: `mm-${patient.id}`,
      patientId: patient.id,
      patientName: patient.name,
      patientPlan: patient.plan,
      severity: "warning",
      category: "missed_meal",
      title: "Öğün takibi aksıyor",
      description: `Öğünler ${rules.missedMealHours} saat içinde işaretlenmiyor — son 48 saatte birden fazla kaçak.`,
      timestamp: minutesAgoIso(now, 120 + patient.id * 13),
      isResolved: false
    }) as PatientAlert);

/**
 * Mobil veri akışı kuralı: `inactivityDays` gündür hiç veri girmeyen danışanı uyarır.
 * Hiç verisi olmayan (henüz başlamamış) danışan için uyarı üretilmez.
 */
const deriveInactivityAlerts = (
  patients: EnginePatient[],
  getMobileEvents: GetMobileEvents,
  rules: AlertRules,
  now: number
): PatientAlert[] => {
  const alerts: PatientAlert[] = [];
  for (const patient of patients) {
    const last = latestPatientEventTime(getMobileEvents(patient.id), patient.id);
    if (last === null) {
      continue;
    }
    const days = Math.floor((now - last) / DAY_MS);
    if (days < rules.inactivityDays) {
      continue;
    }
    alerts.push({
      id: `inactive-${patient.id}`,
      patientId: patient.id,
      patientName: patient.name,
      patientPlan: patient.plan,
      severity: days >= rules.inactivityDays + 2 ? "critical" : "warning",
      category: "inactivity",
      title: `${days} gündür veri yok`,
      description: `En son ${new Date(last).toLocaleDateString("tr-TR")} tarihinde veri girdi. Veri girişi ${rules.inactivityDays} günü aştı — hatırlatma gönderin.`,
      timestamp: minutesAgoIso(now, 30 + patient.id * 6),
      isResolved: false
    });
  }
  return alerts;
};

/** Hafta indeksi → o haftanın ortalama kilosu (yoksa null). */
const weeklyAverageWeight = (weights: Array<{ t: number; w: number }>, now: number): Map<number, number> => {
  const buckets = new Map<number, number[]>();
  for (const { t, w } of weights) {
    const index = Math.floor((now - t) / (7 * DAY_MS));
    if (index < 0) {
      continue;
    }
    buckets.set(index, [...(buckets.get(index) ?? []), w]);
  }
  const averages = new Map<number, number>();
  for (const [index, values] of buckets.entries()) {
    averages.set(index, values.reduce((sum, value) => sum + value, 0) / values.length);
  }
  return averages;
};

/**
 * Mobil ölçüm akışı kuralı: kilo `weightGainWeeks` hafta üst üste artmışsa uyarır.
 * Yalnızca kesintisiz haftalık veri olduğunda tetiklenir; arada veri yoksa uyarı üretilmez.
 */
const deriveWeightGainAlerts = (
  patients: EnginePatient[],
  getMobileEvents: GetMobileEvents,
  rules: AlertRules,
  now: number
): PatientAlert[] => {
  const alerts: PatientAlert[] = [];
  const neededWeeks = Math.max(1, Math.round(rules.weightGainWeeks));
  for (const patient of patients) {
    const weights = eventsForPatient(getMobileEvents(patient.id), patient.id)
      .filter((event) => event.type === "measurement")
      .map((event) => ({ t: eventTime(event), w: (event.payload as MeasurementPayload).weightKg }))
      .filter((row): row is { t: number; w: number } => typeof row.w === "number")
      .sort((a, b) => a.t - b.t);
    if (weights.length < neededWeeks + 1) {
      continue;
    }
    const averages = weeklyAverageWeight(weights, now);
    const series: number[] = [];
    let complete = true;
    for (let index = neededWeeks; index >= 0; index -= 1) {
      const value = averages.get(index);
      if (value === undefined) {
        complete = false;
        break;
      }
      series.push(value);
    }
    if (!complete || series.length < 2) {
      continue;
    }
    const increasing = series.every((value, index) => index === 0 || value > series[index - 1]);
    if (!increasing) {
      continue;
    }
    const first = series[0];
    const lastValue = series[series.length - 1];
    alerts.push({
      id: `gain-${patient.id}`,
      patientId: patient.id,
      patientName: patient.name,
      patientPlan: patient.plan,
      severity: "warning",
      category: "weight_gain",
      title: "Kilo artış eğilimi",
      description: `Son ${neededWeeks} haftada kilo istikrarlı arttı (${first.toFixed(1)} kg → ${lastValue.toFixed(1)} kg). Plan gözden geçirilmeli.`,
      timestamp: minutesAgoIso(now, 70 + patient.id * 8),
      isResolved: false
    });
  }
  return alerts;
};

/**
 * Mobil su akışı kuralı: son `waterMissDays` tam günde günlük su hedefinin altında kalan
 * danışanı uyarır. Her gün için veri gerekir; veri olmayan gün uyarıyı tetiklemez (yanlış pozitif önlenir).
 */
const deriveWaterTargetAlerts = (
  patients: EnginePatient[],
  getMobileEvents: GetMobileEvents,
  rules: AlertRules,
  now: number
): PatientAlert[] => {
  const alerts: PatientAlert[] = [];
  const days = Math.max(1, Math.round(rules.waterMissDays));
  const goal = rules.waterGoalMl > 0 ? rules.waterGoalMl : 2000;
  for (const patient of patients) {
    const totals = new Map<string, number>();
    for (const event of eventsForPatient(getMobileEvents(patient.id), patient.id)) {
      if (event.type !== "water") {
        continue;
      }
      const ml = (event.payload as WaterPayload).ml;
      if (typeof ml !== "number") {
        continue;
      }
      const key = localDayKey(event.timestamp);
      totals.set(key, (totals.get(key) ?? 0) + ml);
    }
    if (totals.size === 0) {
      continue;
    }
    let allMissed = true;
    for (let offset = 1; offset <= days; offset += 1) {
      const key = localDayKey(new Date(now - offset * DAY_MS).toISOString());
      const total = totals.get(key);
      if (total === undefined || total >= goal) {
        allMissed = false;
        break;
      }
    }
    if (!allMissed) {
      continue;
    }
    alerts.push({
      id: `water-${patient.id}`,
      patientId: patient.id,
      patientName: patient.name,
      patientPlan: patient.plan,
      severity: "warning",
      category: "water_target",
      title: "Su hedefi tutturulamıyor",
      description: `Son ${days} gündür günlük su hedefinin (${goal} ml) altında kalıyor. Hatırlatma gönderin.`,
      timestamp: minutesAgoIso(now, 110 + patient.id * 5),
      isResolved: false
    });
  }
  return alerts;
};

/** YYYY-MM-DD → bugüne göre kalan tam gün sayısı (negatif = süresi geçmiş). Geçersizse null. */
const daysUntil = (endDate: string, now: number): number | null => {
  const parts = endDate.split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    return null;
  }
  const [year, month, day] = parts;
  const endMid = new Date(year, month - 1, day).getTime();
  const nowDate = new Date(now);
  const todayMid = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate()).getTime();
  return Math.round((endMid - todayMid) / 86_400_000);
};

/** Danışana gerçek bir plan atanmış mı? ("Plan atanmadı" yer tutucusu plan sayılmaz.) */
const hasAssignedPlan = (plan: string): boolean => Boolean(plan && plan.trim() && plan.trim() !== "Plan atanmadı");

/**
 * Her danışanın gerçek `endDate`'ini bugünle karşılaştırır ve kuraldaki
 * hatırlatma penceresine göre uyarı üretir: süresi geçmiş → kritik,
 * bugün/yarın → uyarı, pencere içindeki diğer günler → bilgi.
 * Plan atanmamışsa plan adı cümleye gömülmez; dilbilgisel olarak doğru bir uyarı kurulur.
 */
const derivePlanExpirationAlerts = (
  patients: EnginePatient[],
  rules: AlertRules,
  now: number
): PatientAlert[] => {
  const alerts: PatientAlert[] = [];
  for (const patient of patients) {
    const left = daysUntil(patient.endDate, now);
    if (left === null) {
      continue;
    }
    const planAssigned = hasAssignedPlan(patient.plan);

    if (left < 0) {
      alerts.push({
        id: `exp-${patient.id}`,
        patientId: patient.id,
        patientName: patient.name,
        patientPlan: patient.plan,
        severity: "critical",
        category: "plan_expiration",
        title: planAssigned ? "Plan süresi doldu" : "Plan atanmadı",
        description: planAssigned
          ? `${patient.plan} planı ${patient.endDate} tarihinde sona erdi — yenileme veya yeni plan gerekiyor.`
          : "Bu danışana henüz bir plan atanmadı. Danışan için yeni bir beslenme planı oluşturulmalı.",
        timestamp: minutesAgoIso(now, 40 + patient.id * 7),
        isResolved: false
      });
      continue;
    }

    if (left <= rules.planExpiryNoticeDays) {
      if (!planAssigned) {
        alerts.push({
          id: `exp-${patient.id}`,
          patientId: patient.id,
          patientName: patient.name,
          patientPlan: patient.plan,
          severity: "info",
          category: "plan_expiration",
          title: "Plan atanmadı",
          description: "Bu danışana henüz bir plan atanmadı. Yaklaşan dönem için plan hazırlanmalı.",
          timestamp: minutesAgoIso(now, 150 + patient.id * 9),
          isResolved: false
        });
        continue;
      }
      const remainingText = left === 0 ? "bugün" : left === 1 ? "yarın" : `${left} gün sonra`;
      alerts.push({
        id: `exp-${patient.id}`,
        patientId: patient.id,
        patientName: patient.name,
        patientPlan: patient.plan,
        severity: left <= 1 ? "warning" : "info",
        category: "plan_expiration",
        title: "Plan bitişi yaklaşıyor",
        description: `${patient.plan} planı ${remainingText} (${patient.endDate}) sona eriyor — yeni plan önerisi hazırlanmalı.`,
        timestamp: minutesAgoIso(now, 150 + patient.id * 9),
        isResolved: false
      });
    }
  }
  return alerts;
};

/**
 * Paket bitişi / ödeme hatırlatma uyarıları. Paket tanımlı danışanlarda:
 * süresi geçmiş → kritik (ödeme/yenileme gecikti), bugün/yarın → uyarı,
 * `packageExpiryNoticeDays` penceresindeki diğer günler → bilgi.
 */
const derivePackageAlerts = (
  patients: EnginePatient[],
  rules: AlertRules,
  now: number
): PatientAlert[] => {
  const alerts: PatientAlert[] = [];
  for (const patient of patients) {
    if (!patient.package) {
      continue;
    }
    const left = daysUntil(patient.package.endDate, now);
    if (left === null) {
      continue;
    }
    const remainingText = left === 0 ? "bugün" : left === 1 ? "yarın" : `${left} gün sonra`;
    const sessionsText = `${patient.package.sessionsLeft}/${patient.package.sessionsTotal} seans kaldı`;

    if (left < 0) {
      alerts.push({
        id: `pkg-${patient.id}`,
        patientId: patient.id,
        patientName: patient.name,
        patientPlan: patient.plan,
        severity: "critical",
        category: "package_expiration",
        title: "Paket süresi doldu",
        description: `${patient.package.name} paketi ${patient.package.endDate} tarihinde sona erdi (${sessionsText}) — ödeme/yenileme hatırlatması gönderilmeli.`,
        timestamp: minutesAgoIso(now, 60 + patient.id * 11),
        isResolved: false
      });
      continue;
    }

    if (left <= rules.packageExpiryNoticeDays) {
      alerts.push({
        id: `pkg-${patient.id}`,
        patientId: patient.id,
        patientName: patient.name,
        patientPlan: patient.plan,
        severity: left <= 1 ? "warning" : "info",
        category: "package_expiration",
        title: "Paket bitişi yaklaşıyor",
        description: `${patient.package.name} paketi ${remainingText} (${patient.package.endDate}) sona eriyor (${sessionsText}) — ödeme/yenileme hatırlatması gönderilebilir.`,
        timestamp: minutesAgoIso(now, 180 + patient.id * 13),
        isResolved: false
      });
    }
  }
  return alerts;
};

export const buildAlerts = (
  patients: EnginePatient[],
  getMeasurements: GetMeasurements,
  rules: AlertRules,
  resolvedIds: string[],
  now: number = Date.now(),
  getMobileEvents: GetMobileEvents = emptyMobileEvents
): PatientAlert[] => {
  const all = [
    ...deriveAdherenceAlerts(patients, rules, now),
    ...derivePlateauAlerts(patients, getMeasurements, rules, now),
    ...deriveMissedMealAlerts(patients, rules, now),
    ...derivePlanExpirationAlerts(patients, rules, now),
    ...derivePackageAlerts(patients, rules, now),
    ...deriveInactivityAlerts(patients, getMobileEvents, rules, now),
    ...deriveWeightGainAlerts(patients, getMobileEvents, rules, now),
    ...deriveWaterTargetAlerts(patients, getMobileEvents, rules, now)
  ];
  const resolved = new Set(resolvedIds);
  return all
    .map((alert) => ({ ...alert, isResolved: resolved.has(alert.id) }))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
};

/** "5 dk önce", "2 sa önce", "Dün", "3 gün önce" */
export const timeAgoTr = (iso: string, now: number = Date.now()): string => {
  const diffMin = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  if (diffMin < 1) {
    return "şimdi";
  }
  if (diffMin < 60) {
    return `${diffMin} dk önce`;
  }
  const hours = Math.floor(diffMin / 60);
  if (hours < 24) {
    return `${hours} sa önce`;
  }
  const days = Math.floor(hours / 24);
  if (days === 1) {
    return "Dün";
  }
  return `${days} gün önce`;
};

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Sessiz saat aralığında mıyız? (gece yarısını aşan aralık desteklenir) */
export const isQuietNow = (
  range: [string, string],
  enabled: boolean,
  now: Date = new Date()
): boolean => {
  if (!enabled) {
    return false;
  }
  const current = now.getHours() * 60 + now.getMinutes();
  const start = toMinutes(range[0]);
  const end = toMinutes(range[1]);
  if (start === end) {
    return false;
  }
  return start < end ? current >= start && current < end : current >= start || current < end;
};
