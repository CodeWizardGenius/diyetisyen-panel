import React from "react";
import { Bell, CalendarClock, MessageSquare, Printer, Scale, TrendingDown, TrendingUp, X } from "lucide-react";
import type { Patient } from "../../data/demo";
import { buildAlerts } from "../alerts/alertEngine";
import {
  loadAlertRules,
  loadDismissedIds,
  loadResolvedIds,
  rulesFromClinicSettings
} from "../../types/alerts";
import type { MobileEvent } from "../../types/mobileData";
import type { MeasurementLike } from "../../types/settings";
import {
  daysWithoutData,
  mealComplianceByWeek,
  mergedWeightPoints,
  weightChangeIn
} from "../patientInsights";

const SUMMARY_WINDOW_DAYS = 14;

/** Özet kartının ihtiyaç duyduğu randevu alanları (App'teki tam tiple uyumlu). */
interface SummaryAppointment {
  patientId?: number;
  patient: string;
  date: string;
  time: string;
  type: string;
}

interface Props {
  appointment: SummaryAppointment;
  patient?: Patient;
  getMeasurements: (patientId: number) => MeasurementLike[];
  getMobileEvents: (patientId: number) => MobileEvent[];
  onClose: () => void;
  onMessage?: (patientId: number) => void;
}

const scoreText = (score: number | null): string => (score === null ? "veri yok" : `%${score}`);

/** Randevu satırındaki "Özet": son 2 haftanın tek kartta, yazdırılabilir görünümü. */
export const AppointmentSummary: React.FC<Props> = ({
  appointment,
  patient,
  getMeasurements,
  getMobileEvents,
  onClose,
  onMessage
}) => {
  React.useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const summary = React.useMemo(() => {
    const patientId = patient?.id ?? appointment.patientId;
    const events = patientId !== undefined ? getMobileEvents(patientId) : [];
    const now = Date.now();
    const weeks = mealComplianceByWeek(events, now, 2);
    const current = weeks[0];
    const previous = weeks[1];
    const trend =
      current.score !== null && previous.score !== null ? current.score - previous.score : null;
    const weightPoints = patientId !== undefined ? mergedWeightPoints(events, getMeasurements(patientId)) : [];
    const weight = weightChangeIn(weightPoints, now - SUMMARY_WINDOW_DAYS * 86_400_000, now + 1);
    const noDataDays = daysWithoutData(events, SUMMARY_WINDOW_DAYS, now);

    const rules = loadAlertRules(rulesFromClinicSettings());
    const resolved = new Set(loadResolvedIds());
    const dismissed = new Set(loadDismissedIds());
    const alerts =
      patient !== undefined
        ? buildAlerts(
            [
              {
                id: patient.id,
                name: patient.name,
                plan: patient.plan,
                compliance: patient.compliance,
                status: patient.status,
                endDate: patient.endDate
              }
            ],
            getMeasurements,
            rules,
            [...resolved],
            now,
            getMobileEvents
          )
            .filter((alert) => !dismissed.has(alert.id) && !alert.isResolved)
            .sort((a, b) => a.severity.localeCompare(b.severity))
        : [];

    return { current, previous, trend, weight, noDataDays, alerts, generatedAt: new Date(now) };
  }, [appointment.patientId, patient, getMeasurements, getMobileEvents]);

  const patientName = patient?.name ?? appointment.patient;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="summary-title" onClick={onClose}>
      <div className="modal summary-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header no-print">
          <div>
            <h3 className="modal-title" id="summary-title">
              Randevu Öncesi Özet
            </h3>
            <p className="muted">Son 2 haftanın özeti; randevu öncesi hızlı durum kartı.</p>
          </div>
          <div className="summary-toolbar">
            {onMessage && patient ? (
              <button type="button" className="btn btn-outline btn-small" onClick={() => onMessage(patient.id)}>
                <MessageSquare size={14} /> Mesaj
              </button>
            ) : null}
            <button type="button" className="btn btn-primary btn-small" onClick={() => window.print()}>
              <Printer size={14} /> Yazdır / PDF
            </button>
            <button type="button" className="icon-btn" aria-label="Kapat" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="summary-print-area">
          <header className="summary-brand">
            <strong>NutriCare</strong>
            <span>Diyetisyen Paneli · Randevu Öncesi Özet</span>
          </header>
          <p className="summary-meta">
            <strong>{patientName}</strong> · {appointment.date} {appointment.time} · {appointment.type}
            {patient ? ` · ${patient.plan}` : ""}
          </p>

          <div className="summary-grid">
            <div className="summary-stat">
              <span className="muted">Uyum trendi (2 hafta)</span>
              {summary.trend === null ? (
                <strong>veri yok</strong>
              ) : (
                <strong className={summary.trend >= 0 ? "summary-up" : "summary-down"}>
                  {summary.trend >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {scoreText(summary.previous.score)} → {scoreText(summary.current.score)}
                </strong>
              )}
              <small className="muted">son 7 gün / önceki 7 gün</small>
            </div>
            <div className="summary-stat">
              <span className="muted">Kilo değişimi</span>
              <strong>
                <Scale size={14} />
                {summary.weight === null
                  ? "veri yok"
                  : `${summary.weight.delta > 0 ? "+" : ""}${summary.weight.delta.toFixed(1)} kg`}
              </strong>
              <small className="muted">
                {summary.weight === null ? "2 haftada yeterli ölçüm yok" : `${summary.weight.from} kg → ${summary.weight.to} kg`}
              </small>
            </div>
            <div className="summary-stat">
              <span className="muted">Veri girilmeyen gün</span>
              <strong>
                <CalendarClock size={14} />
                {summary.noDataDays}/14
              </strong>
              <small className="muted">son 2 hafta</small>
            </div>
            <div className="summary-stat">
              <span className="muted">Aktif uyarı</span>
              <strong>
                <Bell size={14} />
                {summary.alerts.length}
              </strong>
              <small className="muted">{summary.alerts.length === 0 ? "uyarı yok" : "ilgilenilmeli"}</small>
            </div>
          </div>

          <section className="summary-alerts">
            <h4>Aktif uyarılar</h4>
            {summary.alerts.length === 0 ? (
              <p className="muted">Bu danışan için aktif uyarı bulunmuyor.</p>
            ) : (
              <ul>
                {summary.alerts.map((alert) => (
                  <li key={alert.id}>
                    <span className={`badge badge-${alert.severity === "critical" ? "rose" : alert.severity === "warning" ? "amber" : "slate"}`}>
                      {alert.severity === "critical" ? "Kritik" : alert.severity === "warning" ? "Uyarı" : "Bilgi"}
                    </span>
                    <strong>{alert.title}</strong>
                    <span className="muted"> — {alert.description}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <footer className="summary-foot muted">
            Üretim: {summary.generatedAt.toLocaleString("tr-TR")} · Kaynak: mobil veri akışı + panel ölçümleri
          </footer>
        </div>
      </div>
    </div>
  );
};
