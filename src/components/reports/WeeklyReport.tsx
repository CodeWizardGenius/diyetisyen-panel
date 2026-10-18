import React from "react";
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  Droplets,
  Printer,
  Scale,
  Send,
  TrendingDown,
  TrendingUp,
  UtensilsCrossed,
  X
} from "lucide-react";
import type { Patient } from "../../data/demo";
import { buildAlerts } from "../alerts/alertEngine";
import {
  loadAlertRules,
  loadDismissedIds,
  loadResolvedIds,
  rulesFromClinicSettings
} from "../../types/alerts";
import { ingestMobileEvent, readMobileEvents, type MobileEvent } from "../../types/mobileData";
import { loadSettings, type MeasurementLike } from "../../types/settings";
import {
  bucketDays,
  DAY_MS,
  dayKeyFromMs,
  formatDayWithWeekday,
  loggedDayCount,
  mealComplianceInRange,
  mergedWeightPoints,
  waterAverage,
  weightChangeIn
} from "../patientInsights";
import { classNames } from "../settings/classNames";

const REPORT_SENT_KEY = "dp_report_sent_v1";

/** Haftanın başlangıcı (pazartesi 00:00, yerel). */
const startOfWeekMs = (time: number): number => {
  const date = new Date(time);
  const dayOfWeek = (date.getDay() + 6) % 7;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - dayOfWeek).getTime();
};

const readSentMap = (): Record<string, string> => {
  try {
    const raw = localStorage.getItem(REPORT_SENT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
};

const markReportSent = (key: string, at: string): void => {
  try {
    localStorage.setItem(REPORT_SENT_KEY, JSON.stringify({ ...readSentMap(), [key]: at }));
  } catch {
    // depolama kullanılamıyor — yoksay
  }
};

/** NutriCare marka logosu (önizleme + yazdırma). */
const NutriCareLogo: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <span className="report-logo" style={{ width: size, height: size }} aria-hidden="true">
    <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} fill="none">
      <path
        d="M12 21c-4.5-1.6-7.5-5.4-7.5-9.8C4.5 7 8 4 12 3c4 1 7.5 4 7.5 8.2 0 4.4-3 8.2-7.5 9.8Z"
        fill="#ffffff"
        opacity="0.92"
      />
      <path d="M12 8v9M12 12c1.6-2.4 3.2-3.4 5-3.8M12 15c-1.6-2.4-3.2-3.4-5-3.8" stroke="#0f766e" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  </span>
);

interface Props {
  patient: Patient;
  measurements: MeasurementLike[];
  onClose: () => void;
}

/** Haftalık otomatik takip raporu: önizleme + onay → danışana gönderim. */
export const WeeklyReport: React.FC<Props> = ({ patient, measurements, onClose }) => {
  const [weekOffset, setWeekOffset] = React.useState(0);
  const [approved, setApproved] = React.useState(false);
  const [sentAt, setSentAt] = React.useState<string | null>(null);
  const [version, setVersion] = React.useState(0);

  React.useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const report = React.useMemo(() => {
    const now = Date.now();
    const events: MobileEvent[] = readMobileEvents().filter((event) => event.patientId === patient.id);
    const fromMs = startOfWeekMs(now) - weekOffset * 7 * DAY_MS;
    const toMs = fromMs + 7 * DAY_MS;

    const slices = bucketDays(events, measurements, fromMs, 7);
    const compliance = mealComplianceInRange(events, fromMs, toMs);
    const previous = mealComplianceInRange(events, fromMs - 7 * DAY_MS, fromMs);
    const trend =
      compliance.score !== null && previous.score !== null ? compliance.score - previous.score : null;

    const rules = loadAlertRules(rulesFromClinicSettings());
    const resolved = new Set(loadResolvedIds());
    const dismissed = new Set(loadDismissedIds());
    const alerts = buildAlerts(
      [
        {
          id: patient.id,
          name: patient.name,
          plan: patient.plan,
          compliance: patient.compliance,
          status: patient.status,
          endDate: patient.endDate,
          package: patient.package
        }
      ],
      () => measurements,
      rules,
      [...resolved],
      now,
      () => events
    ).filter((alert) => !dismissed.has(alert.id) && !alert.isResolved);

    const weightPoints = mergedWeightPoints(events, measurements);
    const weight = weightChangeIn(weightPoints, fromMs, toMs);
    const waterAvg = waterAverage(slices);
    const logged = loggedDayCount(slices);
    const settings = loadSettings();

    const rangeLabel = `${new Date(fromMs).toLocaleDateString("tr-TR", { day: "numeric", month: "long" })} – ${new Date(
      toMs - DAY_MS
    ).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}`;

    return {
      events,
      fromMs,
      toMs,
      slices,
      compliance,
      trend,
      previous,
      alerts,
      rules,
      weight,
      waterAvg,
      logged,
      settings,
      rangeLabel,
      generatedAt: new Date(now)
    };
  }, [patient, measurements, weekOffset, version]);

  const reportKey = `${patient.id}:${dayKeyFromMs(report.fromMs)}`;
  const alreadySentAt = sentAt ?? readSentMap()[reportKey] ?? null;
  const canSend = approved && !alreadySentAt;

  const sendReport = () => {
    if (!canSend) {
      return;
    }
    const scoreText = report.compliance.score === null ? "veri yok" : `%${report.compliance.score}`;
    const waterText = report.waterAvg === null ? "su kaydı yok" : `su ort. ${report.waterAvg} ml`;
    const weightText =
      report.weight === null ? "kilo verisi yetersiz" : `kilo değişimi ${report.weight.delta > 0 ? "+" : ""}${report.weight.delta.toFixed(1)} kg`;
    ingestMobileEvent({
      patientId: patient.id,
      type: "message",
      timestamp: new Date().toISOString(),
      payload: {
        direction: "dietitian",
        templateId: "haftalik-rapor",
        text: `Haftalık takip raporunuz hazır (${report.rangeLabel}). Öğün uyumu: ${scoreText}, ${waterText}, ${weightText}. Detaylar için panelinizden raporu inceleyebilirsiniz.`
      }
    });
    const at = new Date().toISOString();
    markReportSent(reportKey, at);
    setSentAt(at);
    setVersion((current) => current + 1);
  };

  const scoreText = (score: number | null): string => (score === null ? "veri yok" : `%${score}`);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="report-title" onClick={onClose}>
      <div className="modal summary-modal report-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header no-print">
          <div>
            <h3 className="modal-title" id="report-title">
              Haftalık Rapor
            </h3>
            <p className="muted">Önizleyin, onaylayın ve danışana gönderin. Onay olmadan gönderim kapalıdır.</p>
          </div>
          <div className="summary-toolbar">
            <button
              type="button"
              className="icon-btn"
              aria-label="Önceki hafta"
              onClick={() => {
                setWeekOffset((offset) => offset + 1);
                setApproved(false);
                setSentAt(null);
              }}
            >
              ‹
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label="Sonraki hafta"
              disabled={weekOffset === 0}
              onClick={() => {
                setWeekOffset((offset) => Math.max(0, offset - 1));
                setApproved(false);
                setSentAt(null);
              }}
            >
              ›
            </button>
            <button type="button" className="btn btn-outline btn-small" onClick={() => window.print()}>
              <Printer size={14} /> Yazdır / PDF
            </button>
            <button type="button" className="icon-btn" aria-label="Kapat" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="summary-print-area report-sheet">
          <header className="summary-brand report-brand">
            <span className="report-brand-main">
              <NutriCareLogo />
              <span className="report-brand-text">
                <strong>NutriCare</strong>
                <span>{report.settings.profile.clinicName} · Haftalık Takip Raporu</span>
              </span>
            </span>
            <span className="report-week no-print-keep">{report.rangeLabel}</span>
          </header>

          <p className="summary-meta">
            <strong>{patient.name}</strong> · {patient.plan} · {report.rangeLabel}
            {patient.package ? ` · ${patient.package.name} (kalan ${patient.package.sessionsLeft} seans)` : ""}
          </p>

          <div className="summary-grid">
            <div className="summary-stat">
              <span className="muted">Öğün uyumu</span>
              <strong>{scoreText(report.compliance.score)}</strong>
              <small className="muted">
                {report.trend === null
                  ? `${report.compliance.meals} öğün kaydı`
                  : report.trend >= 0
                  ? `önceki hafta ${scoreText(report.previous.score)} — iyileşme`
                  : `önceki hafta ${scoreText(report.previous.score)} — düşüş`}
              </small>
            </div>
            <div className="summary-stat">
              <span className="muted">Su tüketimi (ort.)</span>
              <strong>
                <Droplets size={14} />
                {report.waterAvg === null ? "veri yok" : `${report.waterAvg} ml`}
              </strong>
              <small className="muted">hedef {report.rules.waterGoalMl} ml / gün</small>
            </div>
            <div className="summary-stat">
              <span className="muted">Kilo değişimi</span>
              <strong className={report.weight && report.weight.delta <= 0 ? "summary-up" : undefined}>
                <Scale size={14} />
                {report.weight === null
                  ? "veri yok"
                  : `${report.weight.delta > 0 ? "+" : ""}${report.weight.delta.toFixed(1)} kg`}
              </strong>
              <small className="muted">
                {report.weight === null ? "yeterli ölçüm yok" : `${report.weight.from} kg → ${report.weight.to} kg`}
              </small>
            </div>
            <div className="summary-stat">
              <span className="muted">Veri girilen gün</span>
              <strong>
                <CalendarDays size={14} />
                {report.logged}/7
              </strong>
              <small className="muted">{report.compliance.meals} öğün kaydı</small>
            </div>
          </div>

          <section className="report-breakdown">
            <h4>
              <UtensilsCrossed size={14} /> Günlük kırılım
            </h4>
            <table className="report-table">
              <thead>
                <tr>
                  <th>Gün</th>
                  <th>Öğün</th>
                  <th>Uyum</th>
                  <th>Su</th>
                  <th>Kilo</th>
                </tr>
              </thead>
              <tbody>
                {report.slices.map((slice) => (
                  <tr key={slice.key}>
                    <td>{formatDayWithWeekday(slice.key)}</td>
                    <td>{slice.mealsLogged > 0 ? slice.mealsLogged : "—"}</td>
                    <td>{slice.mealCompliance === null ? "—" : `%${slice.mealCompliance}`}</td>
                    <td>{slice.waterMl === null ? "—" : `${slice.waterMl} ml`}</td>
                    <td>{slice.weightKg === null ? "—" : `${slice.weightKg} kg`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="summary-alerts">
            <h4>
              <Bell size={14} /> Aktif uyarılar
            </h4>
            {report.alerts.length === 0 ? (
              <p className="muted">Bu hafta için aktif uyarı bulunmuyor.</p>
            ) : (
              <ul>
                {report.alerts.map((alert) => (
                  <li key={alert.id}>
                    <span
                      className={`badge badge-${
                        alert.severity === "critical" ? "rose" : alert.severity === "warning" ? "amber" : "slate"
                      }`}
                    >
                      {alert.severity === "critical" ? "Kritik" : alert.severity === "warning" ? "Uyarı" : "Bilgi"}
                    </span>{" "}
                    <strong>{alert.title}</strong>
                    <span className="muted"> — {alert.description}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <footer className="summary-foot muted">
            {report.settings.profile.dietitianName} · {report.settings.profile.clinicName} · Üretim:{" "}
            {report.generatedAt.toLocaleString("tr-TR")}
          </footer>
        </div>

        <div className="report-actions no-print">
          <label className="report-approve">
            <input
              type="checkbox"
              id="report-approve"
              checked={approved}
              disabled={Boolean(alreadySentAt)}
              onChange={(event) => setApproved(event.target.checked)}
            />
            <span>Raporu kontrol ettim, danışana gönderilmesini onaylıyorum.</span>
          </label>
          <div className="report-actions-right">
            {alreadySentAt ? (
              <span className="report-sent" role="status">
                <CheckCircle2 size={14} /> Gönderildi · {new Date(alreadySentAt).toLocaleString("tr-TR")}
              </span>
            ) : null}
            <button
              type="button"
              className={classNames("btn", "btn-primary", !canSend && "btn-disabled")}
              disabled={!canSend}
              onClick={sendReport}
              title={approved ? "Danışana gönder" : "Önce onay kutusunu işaretleyin"}
            >
              <Send size={14} /> {alreadySentAt ? "Gönderildi" : "Onayla ve Gönder"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
