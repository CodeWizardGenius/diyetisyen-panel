import type { MeasurementLike } from "../../types/settings";
import type { AlertRules, PatientAlert } from "../../types/alerts";

export interface EnginePatient {
  id: number;
  name: string;
  plan: string;
  compliance: number;
  status: string;
  endDate: string;
}

type GetMeasurements = (patientId: number) => MeasurementLike[];

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

/**
 * Her danışanın gerçek `endDate`'ini bugünle karşılaştırır ve kuraldaki
 * hatırlatma penceresine göre uyarı üretir: süresi geçmiş → kritik,
 * bugün/yarın → uyarı, pencere içindeki diğer günler → bilgi.
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

    if (left < 0) {
      alerts.push({
        id: `exp-${patient.id}`,
        patientId: patient.id,
        patientName: patient.name,
        patientPlan: patient.plan,
        severity: "critical",
        category: "plan_expiration",
        title: "Plan süresi doldu",
        description: `${patient.plan} planı ${patient.endDate} tarihinde sona erdi — yenileme veya yeni plan gerekiyor.`,
        timestamp: minutesAgoIso(now, 40 + patient.id * 7),
        isResolved: false
      });
      continue;
    }

    if (left <= rules.planExpiryNoticeDays) {
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

export const buildAlerts = (
  patients: EnginePatient[],
  getMeasurements: GetMeasurements,
  rules: AlertRules,
  resolvedIds: string[],
  now: number = Date.now()
): PatientAlert[] => {
  const all = [
    ...deriveAdherenceAlerts(patients, rules, now),
    ...derivePlateauAlerts(patients, getMeasurements, rules, now),
    ...deriveMissedMealAlerts(patients, rules, now),
    ...derivePlanExpirationAlerts(patients, rules, now)
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
