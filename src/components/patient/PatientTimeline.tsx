import React from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { readMobileEvents } from "../../types/mobileData";
import type { MeasurementLike } from "../../types/settings";
import {
  bucketDays,
  formatDayShort,
  formatDayWithWeekday,
  loggedDayCount,
  PLANNED_MEALS_PER_DAY,
  startOfDayMs,
  waterAverage,
  weightChangeIn,
  DAY_MS,
  type WeightPoint,
  mergedWeightPoints
} from "../patientInsights";
import { classNames } from "../settings/classNames";

const VISIBLE_WEEKS = 4;

interface Props {
  patientId: number;
  measurements: MeasurementLike[];
}

const Sparkline: React.FC<{ points: number[] }> = ({ points }) => {
  if (points.length < 2) {
    return null;
  }
  const width = 132;
  const height = 34;
  const pad = 4;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const coords = points
    .map((value, index) => {
      const x = pad + (index / (points.length - 1)) * (width - pad * 2);
      const y = height - pad - ((value - min) / span) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg className="timeline-spark" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Kilo eğrisi">
      <polyline points={coords} fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};

const weightPointsInWeek = (all: WeightPoint[], start: number, end: number): WeightPoint[] =>
  all.filter((point) => {
    const [year, month, day] = point.date.split("-").map(Number);
    const time = new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0).getTime();
    return time >= start && time <= end;
  });

/** Danışan detayı "Zaman Çizelgesi": son 4 hafta, planlanan vs gerçekleşen. */
export const PatientTimeline: React.FC<Props> = ({ patientId, measurements }) => {
  const [weekOffset, setWeekOffset] = React.useState(0);

  const events = React.useMemo(
    () => readMobileEvents().filter((event) => event.patientId === patientId),
    [patientId]
  );

  const now = Date.now();
  const endDay = startOfDayMs(now) - weekOffset * 7 * DAY_MS;
  const startDay = endDay - 6 * DAY_MS;
  const slices = React.useMemo(
    () => bucketDays(events, measurements, startDay, 7),
    [events, measurements, startDay]
  );
  const weights = React.useMemo(() => mergedWeightPoints(events, measurements), [events, measurements]);
  const weekWeights = weightPointsInWeek(weights, startDay, endDay + DAY_MS);

  const mealScores = slices
    .map((slice) => slice.mealCompliance)
    .filter((value): value is number => value !== null);
  const averageCompliance =
    mealScores.length > 0 ? Math.round(mealScores.reduce((sum, value) => sum + value, 0) / mealScores.length) : null;
  const averageWater = waterAverage(slices);
  const change = weightChangeIn(weekWeights, startDay, endDay + DAY_MS);
  const logged = loggedDayCount(slices);
  const weekLabel = `${formatDayShort(slices[0].key)} – ${formatDayShort(slices[6].key)}`;
  const offsetLabel = weekOffset === 0 ? "Bu hafta" : `${weekOffset} hafta önce`;

  return (
    <div className="timeline">
      <div className="timeline-nav">
        <button
          type="button"
          className="btn btn-outline btn-small"
          onClick={() => setWeekOffset((prev) => Math.min(VISIBLE_WEEKS - 1, prev + 1))}
          disabled={weekOffset >= VISIBLE_WEEKS - 1}
          aria-label="Önceki hafta"
        >
          <ChevronLeft size={14} /> Önceki hafta
        </button>
        <div className="timeline-nav-label">
          <CalendarDays size={14} />
          <strong>{weekLabel}</strong>
          <span className="badge badge-slate">{offsetLabel}</span>
        </div>
        <button
          type="button"
          className="btn btn-outline btn-small"
          onClick={() => setWeekOffset((prev) => Math.max(0, prev - 1))}
          disabled={weekOffset === 0}
          aria-label="Sonraki hafta"
        >
          Sonraki hafta <ChevronRight size={14} />
        </button>
      </div>

      <div className="timeline-summary">
        <div className="timeline-stat">
          <span className="muted">Uyum ort.</span>
          <strong>{averageCompliance === null ? "veri yok" : `%${averageCompliance}`}</strong>
        </div>
        <div className="timeline-stat">
          <span className="muted">Kilo değişimi</span>
          <strong>
            {change === null
              ? "veri yok"
              : `${change.delta > 0 ? "+" : ""}${change.delta.toFixed(1)} kg`}
          </strong>
          <Sparkline points={weekWeights.map((point) => point.kg)} />
        </div>
        <div className="timeline-stat">
          <span className="muted">Su ort.</span>
          <strong>{averageWater === null ? "veri yok" : `${averageWater} ml`}</strong>
        </div>
        <div className="timeline-stat">
          <span className="muted">Girilen gün</span>
          <strong>{logged}/7</strong>
        </div>
      </div>

      <div className="timeline-scroll">
        <div className="timeline-grid">
          <div className="timeline-cell timeline-head-cell">Ölçüt</div>
          {slices.map((slice) => (
            <div key={slice.key} className="timeline-cell timeline-head-cell">
              {formatDayWithWeekday(slice.key)}
            </div>
          ))}

          <div className="timeline-cell timeline-row-label">Öğün (plan/gerçek)</div>
          {slices.map((slice) => (
            <div key={`meal-${slice.key}`} className="timeline-cell">
              {slice.mealsLogged === 0 ? (
                <span className="timeline-none">veri yok</span>
              ) : (
                `${PLANNED_MEALS_PER_DAY}/${slice.mealsLogged}`
              )}
            </div>
          ))}

          <div className="timeline-cell timeline-row-label">Plan uyumu</div>
          {slices.map((slice) => (
            <div key={`compliance-${slice.key}`} className="timeline-cell">
              {slice.mealCompliance === null ? (
                <span className="timeline-none">veri yok</span>
              ) : (
                `%${slice.mealCompliance}`
              )}
            </div>
          ))}

          <div className="timeline-cell timeline-row-label">Kilo</div>
          {slices.map((slice) => (
            <div key={`weight-${slice.key}`} className="timeline-cell">
              {slice.weightKg === null ? (
                <span className="timeline-none">veri yok</span>
              ) : (
                `${slice.weightKg} kg`
              )}
            </div>
          ))}

          <div className="timeline-cell timeline-row-label">Su</div>
          {slices.map((slice) => (
            <div key={`water-${slice.key}`} className="timeline-cell">
              {slice.waterMl === null ? (
                <span className="timeline-none">veri yok</span>
              ) : (
                `${slice.waterMl} ml`
              )}
            </div>
          ))}
        </div>
      </div>

      <p className="muted muted-tight">
        Veri olmayan günler "veri yok" olarak gösterilir; 0 sayılmaz. Öğün satırı planlanan/girilen
        sayısını verir.
      </p>
      {change !== null && change.from > 0 ? (
        <p className={classNames("muted", "muted-tight")}>Hafta başı {change.from} kg → hafta sonu {change.to} kg.</p>
      ) : null}
    </div>
  );
};
