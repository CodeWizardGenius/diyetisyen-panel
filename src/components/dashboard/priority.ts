/**
 * "Bugün İlgilen" öncelik listesi: danışanları risk skoruna göre sıralar.
 *
 * Skor dört sinyalden oluşur (her biri bağımsız puanlanır, gereksiz tetiklenmez):
 *  1. Veri girilmeyen gün sayısı  → gün başına 10 puan (en fazla 30)
 *  2. Uyum eşiğinin altına düşme  → eşik farkı kadar puan (en fazla 30)
 *  3. Kilo trendi                 → 2 haftada +0,5 kg ve üzeri 15 · durağan seyir 8 puan
 *  4. Aktif uyarı sayısı          → uyarı başına 8 puan (en fazla 24)
 *
 * Veri girilmeyen gün, ölçüm/laboratuvar verisi hiç olmayan danışan için puana
 * dönüşmez (henüz başlamamış danışan "riskli" sayılmaz). Skoru 0 olan danışan
 * listeye hiç girmez.
 */
import type { AlertRules, PatientAlert } from "../../types/alerts";
import type { MobileEvent } from "../../types/mobileData";
import { latestPatientEventTime } from "../../types/mobileData";
import type { MeasurementLike } from "../../types/settings";
import type { EnginePatient } from "../alerts/alertEngine";
import { DAY_MS, dayKeyToMs, mergedWeightPoints, weightChangeIn } from "../patientInsights";

export interface PriorityReason {
  label: string;
  points: number;
}

export interface PriorityEntry {
  patient: EnginePatient;
  score: number;
  /** Puana göre azalan sırada nedenler. */
  reasons: PriorityReason[];
  /** Satırda gösterilen kısa gerekçe: "3 gündür veri yok + uyum %54". */
  summary: string;
}

const NO_DATA_PER_DAY = 10;
const NO_DATA_CAP = 30;
const COMPLIANCE_CAP = 30;
const WEIGHT_GAIN_POINTS = 15;
const PLATEAU_POINTS = 8;
const ALERT_POINTS = 8;
const ALERT_CAP = 24;
const TREND_WINDOW_DAYS = 14;

export const buildPriorityList = (params: {
  patients: EnginePatient[];
  getMobileEvents: (patientId: number) => MobileEvent[];
  getMeasurements: (patientId: number) => MeasurementLike[];
  /** Aktif + çözülmüş tüm uyarılar; çözülenler puana katılmaz. */
  alerts: PatientAlert[];
  rules: AlertRules;
  now?: number;
}): PriorityEntry[] => {
  const { patients, getMobileEvents, getMeasurements, alerts, rules, now = Date.now() } = params;
  const entries: PriorityEntry[] = [];

  for (const patient of patients) {
    const reasons: PriorityReason[] = [];
    const events = getMobileEvents(patient.id);

    // 1) Veri akışı kesildi mi?
    const lastEvent = latestPatientEventTime(events, patient.id);
    if (lastEvent !== null) {
      const days = Math.floor((now - lastEvent) / DAY_MS);
      if (days >= 1) {
        reasons.push({ label: `${days} gündür veri yok`, points: Math.min(days * NO_DATA_PER_DAY, NO_DATA_CAP) });
      }
    }

    // 2) Uyum eşiğinin altında mı?
    const gap = rules.complianceThreshold - patient.compliance;
    if (gap > 0) {
      reasons.push({ label: `uyum %${patient.compliance}`, points: Math.min(gap, COMPLIANCE_CAP) });
    }

    // 3) Kilo trendi (son 2 hafta).
    const weightPoints = mergedWeightPoints(events, getMeasurements(patient.id));
    const from = now - TREND_WINDOW_DAYS * DAY_MS;
    const change = weightChangeIn(weightPoints, from, now + 1);
    if (change && change.delta >= 0.5) {
      reasons.push({ label: `kilo +${change.delta.toFixed(1)} kg (2 hafta)`, points: WEIGHT_GAIN_POINTS });
    } else {
      const inRange = weightPoints.filter((point) => {
        const time = dayKeyToMs(point.date);
        return time >= from && time <= now;
      });
      if (inRange.length >= 3) {
        const span = Math.max(...inRange.map((point) => point.kg)) - Math.min(...inRange.map((point) => point.kg));
        if (span < 0.5) {
          reasons.push({ label: "kilo durağan (2 hafta)", points: PLATEAU_POINTS });
        }
      }
    }

    // 4) Aktif uyarılar.
    const activeAlerts = alerts.filter((alert) => alert.patientId === patient.id && !alert.isResolved);
    if (activeAlerts.length > 0) {
      reasons.push({
        label: `${activeAlerts.length} aktif uyarı`,
        points: Math.min(activeAlerts.length * ALERT_POINTS, ALERT_CAP)
      });
    }

    const score = reasons.reduce((sum, reason) => sum + reason.points, 0);
    if (score <= 0) {
      continue;
    }
    reasons.sort((a, b) => b.points - a.points);
    entries.push({
      patient,
      score,
      reasons,
      summary: reasons
        .slice(0, 2)
        .map((reason) => reason.label)
        .join(" + ")
    });
  }

  return entries.sort((a, b) => b.score - a.score || a.patient.name.localeCompare(b.patient.name, "tr"));
};
