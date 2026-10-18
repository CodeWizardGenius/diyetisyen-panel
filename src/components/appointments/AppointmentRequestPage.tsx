import React from "react";
import { CalendarDays, CheckCircle2, Leaf, Send } from "lucide-react";
import { isValidPatientLink } from "../../types/patientLinks";

const APPOINTMENTS_STORAGE_KEY = "dp_appointments";
const PATIENTS_STORAGE_KEY = "dp_patients";
const REQUEST_TYPES = ["Kontrol / Ölçüm", "Online Görüşme", "Plan Revizyonu", "İlk Görüşme"];

interface StoredAppointment {
  id: string;
  patientId?: number;
  patient: string;
  date: string;
  time: string;
  type: string;
  status: "Onaylı" | "Bekliyor";
}

const readPatientName = (patientId: number): string => {
  try {
    const raw = localStorage.getItem(PATIENTS_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) {
      const match = parsed.find(
        (item) => item && typeof item === "object" && (item as { id?: number }).id === patientId
      );
      const name = match ? (match as { name?: unknown }).name : undefined;
      if (typeof name === "string" && name.trim()) {
        return name;
      }
    }
  } catch {
    // depolama kullanılamıyor — varsayılana düş
  }
  return `Danışan #${patientId}`;
};

const appendRequest = (appointment: StoredAppointment): void => {
  let existing: StoredAppointment[] = [];
  try {
    const raw = localStorage.getItem(APPOINTMENTS_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) {
      existing = parsed as StoredAppointment[];
    }
  } catch {
    existing = [];
  }
  localStorage.setItem(APPOINTMENTS_STORAGE_KEY, JSON.stringify([...existing, appointment]));
};

interface Props {
  patientId: number;
  token: string;
}

/** Danışanın kendi randevu talebini oluşturduğu herkese açık sayfa (token'lı link). */
export const AppointmentRequestPage: React.FC<Props> = ({ patientId, token }) => {
  const valid = Number.isInteger(patientId) && patientId > 0 && isValidPatientLink(patientId, token);
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = React.useState(today);
  const [time, setTime] = React.useState("10:00");
  const [type, setType] = React.useState(REQUEST_TYPES[0]);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState("");

  const patientName = valid ? readPatientName(patientId) : "";

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!date || !time || !type) {
      setError("Lütfen tarih, saat ve görüşme türünü seçin.");
      return;
    }
    appendRequest({
      id: `req-${Date.now()}`,
      patientId,
      patient: patientName,
      date,
      time,
      type,
      status: "Bekliyor"
    });
    setError("");
    setSent(true);
  };

  return (
    <div className="request-page">
      <div className="request-card card">
        <header className="request-brand">
          <span className="report-logo" style={{ width: 34, height: 34 }} aria-hidden="true">
            <Leaf size={18} />
          </span>
          <div>
            <strong>NutriCare</strong>
            <span className="muted request-brand-sub">Randevu Talebi</span>
          </div>
        </header>

        {!valid ? (
          <div role="alert">
            <h1 className="request-title">Bağlantı geçersiz</h1>
            <p className="muted">
              Bu randevu talebi bağlantısı geçersiz veya iptal edilmiş. Lütfen diyetisyeninizden güncel bağlantı
              isteyin.
            </p>
          </div>
        ) : sent ? (
          <div role="status" className="request-success">
            <CheckCircle2 size={34} />
            <h1 className="request-title">Talebiniz alındı!</h1>
            <p className="muted">
              <strong>{patientName}</strong> adına {date} · {time} · {type} talebiniz oluşturuldu. Durum:{" "}
              <span className="badge badge-amber">Bekliyor</span> — diyetisyen onayı sonrası kesinleşir.
            </p>
          </div>
        ) : (
          <>
            <h1 className="request-title">Merhaba {patientName}</h1>
            <p className="muted">Aşağıdan uygun olduğunuz gün ve saati seçip talebinizi gönderin.</p>
            <form onSubmit={submit} noValidate>
              <div className="form-grid">
                <div>
                  <label className="label" htmlFor="ar-date">Tarih *</label>
                  <input
                    id="ar-date"
                    type="date"
                    className="input"
                    min={today}
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="ar-time">Saat *</label>
                  <input
                    id="ar-time"
                    type="time"
                    className="input"
                    value={time}
                    onChange={(event) => setTime(event.target.value)}
                  />
                </div>
                <div className="form-full">
                  <label className="label" htmlFor="ar-type">Görüşme Türü *</label>
                  <select
                    id="ar-type"
                    className="input"
                    value={type}
                    onChange={(event) => setType(event.target.value)}
                  >
                    {REQUEST_TYPES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {error ? <p className="field-error">{error}</p> : null}
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">
                  <Send size={14} /> Randevu Talebi Gönder
                </button>
              </div>
            </form>
          </>
        )}

        <footer className="request-foot muted">
          <CalendarDays size={13} /> Talebiniz “Bekliyor” durumunda diyetisyen paneline iletilir.
        </footer>
      </div>
    </div>
  );
};
