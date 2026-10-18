import React from "react";
import { ArrowRight, CalendarPlus, MessageSquare, Target } from "lucide-react";
import type { PriorityEntry } from "./priority";
import { classNames } from "../settings/classNames";

interface Props {
  entries: PriorityEntry[];
  onOpen: (patientId: number) => void;
  onMessage: (patientId: number) => void;
  onAppointment: (patientId: number) => void;
}

const scoreTone = (score: number): string => {
  if (score >= 40) {
    return "priority-score-critical";
  }
  if (score >= 20) {
    return "priority-score-warning";
  }
  return "priority-score-info";
};

/** Dashboard üst bölümü: risk skoruna göre sıralı "Bugün İlgilen" listesi. */
export const PriorityList: React.FC<Props> = ({ entries, onOpen, onMessage, onAppointment }) => (
  <div className="card priority-card">
    <div className="card-head">
      <h3>
        <Target size={16} /> Bugün İlgilen
      </h3>
      <span className="muted">
        {entries.length > 0 ? `${entries.length} danışan öncelikli` : "Acil müdahale yok"}
      </span>
    </div>
    <p className="muted">Risk skoruna göre sıralanır; skoru 0 olan danışanlar listede görünmez.</p>

    {entries.length === 0 ? (
      <p className="muted" role="status">
        Bugün acil müdahale gerektiren danışan yok. Akışı izlemeye devam edin.
      </p>
    ) : (
      <ul className="priority-list">
        {entries.map((entry) => (
          <li key={entry.patient.id} className="priority-item">
            <span className="avatar">{entry.patient.name.charAt(0)}</span>
            <div className="priority-body">
              <p className="priority-name">
                {entry.patient.name}
                <span className="muted"> · {entry.patient.plan}</span>
              </p>
              <p className="priority-reason">{entry.summary}</p>
              <div className="priority-chips">
                {entry.reasons.slice(0, 3).map((reason) => (
                  <span key={reason.label} className="priority-chip">
                    {reason.label}
                  </span>
                ))}
              </div>
            </div>
            <span className={classNames("priority-score", scoreTone(entry.score))} title="Risk skoru">
              {entry.score}
            </span>
            <div className="priority-actions">
              <button type="button" className="btn btn-outline btn-small" onClick={() => onMessage(entry.patient.id)}>
                <MessageSquare size={14} /> Mesaj
              </button>
              <button
                type="button"
                className="btn btn-outline btn-small"
                onClick={() => onAppointment(entry.patient.id)}
              >
                <CalendarPlus size={14} /> Randevu
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={`${entry.patient.name} detayını aç`}
                onClick={() => onOpen(entry.patient.id)}
              >
                <ArrowRight size={16} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    )}
  </div>
);
