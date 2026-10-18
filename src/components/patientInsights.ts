/**
 * Zaman çizelgesi, öncelik listesi ve randevu özetinin ORTAK hesaplamaları.
 *
 * Mobil veri olayları ile paneldeki ölçüm kayıtlarını birleştirip günlük kırılım,
 * haftalık uyum ve kilo trendi üretir. "Veri yok" durumu `null` ile temsil edilir;
 * hiçbir yerde 0'a düşürülmez (0 sanılmasın).
 */
import type {
  MealPayload,
  MeasurementPayload,
  MobileEvent,
  WaterPayload,
  PlanCompliance
} from "../types/mobileData";
import { eventTime, localDayKey } from "../types/mobileData";
import type { MeasurementLike } from "../types/settings";

export const DAY_MS = 86_400_000;

/** 14 günlük çizelgedeki günlük öğün sayısı (planlanan). */
export const PLANNED_MEALS_PER_DAY = 6;

/** Plana uygunluk → 0–100 puan. */
export const MEAL_COMPLIANCE_SCORE: Record<PlanCompliance, number> = {
  uygun: 100,
  kismen: 50,
  uygun_degil: 0
};

export const startOfDayMs = (time: number): number => {
  const date = new Date(time);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};

export const dayKeyFromMs = (time: number): string => localDayKey(new Date(time).toISOString());

/** Gün anahtarını (YYYY-MM-DD) yerel gün ortasına çevirir. */
export const dayKeyToMs = (key: string): number => {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0).getTime();
};

export interface WeightPoint {
  date: string;
  kg: number;
}

/** Mobil kilo girişleri + paneldeki ölçüm kayıtları: birleşik, artan tarihli kilo serisi. */
export const mergedWeightPoints = (events: MobileEvent[], measurements: MeasurementLike[]): WeightPoint[] => {
  const byDate = new Map<string, number>();
  for (const measurement of measurements) {
    if (typeof measurement.weightKg === "number" && measurement.weightKg > 0) {
      byDate.set(measurement.date, measurement.weightKg);
    }
  }
  // Aynı gün hem panelde hem mobilde kayıt varsa mobil (daha güncel) kazanır.
  for (const event of events) {
    if (event.type !== "measurement") {
      continue;
    }
    const weight = (event.payload as MeasurementPayload).weightKg;
    if (typeof weight === "number" && weight > 0) {
      byDate.set(localDayKey(event.timestamp), weight);
    }
  }
  return [...byDate.entries()]
    .map(([date, kg]) => ({ date, kg }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

export interface MealComplianceSummary {
  /** 0–100; hiç öğün kaydı yoksa null ("veri yok"). */
  score: number | null;
  meals: number;
  compliant: number;
  partial: number;
  offPlan: number;
}

/** [fromMs, toMs) aralığındaki öğün kayıtlarının plana uygunluk özeti. */
export const mealComplianceInRange = (
  events: MobileEvent[],
  fromMs: number,
  toMs: number
): MealComplianceSummary => {
  let compliant = 0;
  let partial = 0;
  let offPlan = 0;
  for (const event of events) {
    if (event.type !== "meal") {
      continue;
    }
    const time = eventTime(event);
    if (time < fromMs || time >= toMs) {
      continue;
    }
    const compliance = (event.payload as MealPayload).planCompliance;
    if (compliance === "uygun") {
      compliant += 1;
    } else if (compliance === "kismen") {
      partial += 1;
    } else if (compliance === "uygun_degil") {
      offPlan += 1;
    }
  }
  const meals = compliant + partial + offPlan;
  const score = meals > 0 ? Math.round((compliant * 100 + partial * 50) / meals) : null;
  return { score, meals, compliant, partial, offPlan };
};

export interface DaySlice {
  key: string;
  start: number;
  mealsLogged: number;
  /** Günün öğün uygunluğu; kayıt yoksa null. */
  mealCompliance: number | null;
  /** Günün toplam suyu (ml); kayıt yoksa null. */
  waterMl: number | null;
  /** Günün kilosu; kayıt yoksa null. */
  weightKg: number | null;
  /** O gün herhangi bir veri girildi mi? */
  hasData: boolean;
}

/** `startMs` gününden itibaren `dayCount` günlük kırılım üretir. */
export const bucketDays = (
  events: MobileEvent[],
  measurements: MeasurementLike[],
  startMs: number,
  dayCount: number
): DaySlice[] => {
  const slices: DaySlice[] = [];
  for (let index = 0; index < dayCount; index += 1) {
    const dayStart = startOfDayMs(startMs) + index * DAY_MS;
    slices.push({
      key: dayKeyFromMs(dayStart),
      start: dayStart,
      mealsLogged: 0,
      mealCompliance: null,
      waterMl: null,
      weightKg: null,
      hasData: false
    });
  }
  const positionOf = new Map(slices.map((slice, index) => [slice.key, index]));
  const mealScores = new Map<string, number[]>();

  for (const event of events) {
    const position = positionOf.get(localDayKey(event.timestamp));
    if (position === undefined) {
      continue;
    }
    const slice = slices[position];
    slice.hasData = true;
    if (event.type === "meal") {
      slice.mealsLogged += 1;
      const compliance = (event.payload as MealPayload).planCompliance;
      if (compliance in MEAL_COMPLIANCE_SCORE) {
        mealScores.set(slice.key, [...(mealScores.get(slice.key) ?? []), MEAL_COMPLIANCE_SCORE[compliance]]);
      }
    } else if (event.type === "water") {
      const ml = (event.payload as WaterPayload).ml;
      if (typeof ml === "number") {
        slice.waterMl = (slice.waterMl ?? 0) + ml;
      }
    } else if (event.type === "measurement") {
      const weight = (event.payload as MeasurementPayload).weightKg;
      if (typeof weight === "number") {
        slice.weightKg = weight;
      }
    }
  }

  for (const slice of slices) {
    const scores = mealScores.get(slice.key);
    if (scores && scores.length > 0) {
      slice.mealCompliance = Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length);
    }
    if (slice.weightKg === null) {
      const panelMeasurement = measurements.find((measurement) => measurement.date === slice.key);
      if (panelMeasurement && typeof panelMeasurement.weightKg === "number") {
        slice.weightKg = panelMeasurement.weightKg;
        slice.hasData = true;
      }
    }
  }
  return slices;
};

/** Yalnızca veri girilmiş günlerin su ortalaması; hiç veri yoksa null. */
export const waterAverage = (slices: DaySlice[]): number | null => {
  const values = slices.map((slice) => slice.waterMl).filter((value): value is number => value !== null);
  return values.length > 0 ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
};

export const loggedDayCount = (slices: DaySlice[]): number => slices.filter((slice) => slice.hasData).length;

export interface WeightChange {
  from: number;
  delta: number;
  to: number;
}

/** [fromMs, toMs) aralığındaki ilk–son kilo farkı; 2'den az ölçüm varsa null. */
export const weightChangeIn = (points: WeightPoint[], fromMs: number, toMs: number): WeightChange | null => {
  const inRange = points.filter((point) => {
    const time = dayKeyToMs(point.date);
    return time >= fromMs && time < toMs;
  });
  if (inRange.length < 2) {
    return null;
  }
  const first = inRange[0];
  const last = inRange[inRange.length - 1];
  return { from: first.kg, to: last.kg, delta: Math.round((last.kg - first.kg) * 10) / 10 };
};

/** Son `days` günde (bugün dahil) veri girilmeyen gün sayısı. */
export const daysWithoutData = (events: MobileEvent[], days: number, now: number): number => {
  const windowStart = startOfDayMs(now) - (days - 1) * DAY_MS;
  const seen = new Set<string>();
  for (const event of events) {
    const key = localDayKey(event.timestamp);
    const dayStart = startOfDayMs(dayKeyToMs(key));
    if (dayStart >= windowStart) {
      seen.add(key);
    }
  }
  return Math.max(0, days - seen.size);
};

/** Haftalık öğün uygunluğu; index 0 = son 7 gün. */
export const mealComplianceByWeek = (
  events: MobileEvent[],
  now: number,
  weeks: number
): Array<{ week: number; score: number | null; meals: number }> => {
  const output: Array<{ week: number; score: number | null; meals: number }> = [];
  for (let week = 0; week < weeks; week += 1) {
    const to = now - week * 7 * DAY_MS;
    const from = to - 7 * DAY_MS;
    const summary = mealComplianceInRange(events, from, to);
    output.push({ week, score: summary.score, meals: summary.meals });
  }
  return output;
};

/** Gün anahtarını "6 Eki" biçiminde kısaltır. */
export const formatDayShort = (key: string): string =>
  new Date(dayKeyToMs(key)).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });

export const formatDayWithWeekday = (key: string): string =>
  new Date(dayKeyToMs(key)).toLocaleDateString("tr-TR", { weekday: "short", day: "numeric" });
