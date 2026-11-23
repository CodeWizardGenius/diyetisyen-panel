import React from "react";
import { CalendarDays, CheckCircle2, Leaf, Send } from "lucide-react";
import { isValidPatientLink, markPatientLinkUsed } from "../../types/patientLinks";
import { IS_HTTP, errorMessage, publicApi } from "../../api";

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
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = React.useState(today);
  const [time, setTime] = React.useState("10:00");
  const [type, setType] = React.useState(REQUEST_TYPES[0]);
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [note, setNote] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [metaState, setMetaState] = React.useState<
    | { status: "loading" }
    | { status: "invalid" }
    | { status: "ready"; patientName: string; dietitianName?: string; expiresAt?: string }
  >(() => (IS_HTTP ? { status: "loading" } : { status: "invalid" }));

  React.useEffect(() => {
    if (!IS_HTTP) {
      const valid = Number.isInteger(patientId) && patientId > 0 && isValidPatientLink(patientId, token);
      setMetaState(
        valid
          ? { status: "ready", patientName: readPatientName(patientId) }
          : { status: "invalid" }
      );
      return;
    }
    let alive = true;
    void publicApi
      .link(token)
      .then((meta) => {
        if (!alive) return;
        setMetaState({
          status: "ready",
          patientName: meta.patientName ?? "Danışan",
          ...(meta.dietitianName ? { dietitianName: meta.dietitianName } : {}),
          ...(meta.expiresAt ? { expiresAt: meta.expiresAt } : {})
        });
      })
      .catch(() => {
        if (alive) setMetaState({ status: "invalid" });
      });
    return () => {
      alive = false;
    };
  }, [patientId, token]);

  const valid = metaState.status === "ready";
  const patientName = metaState.status === "ready" ? metaState.patientName : "";

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!date || !time) {
      setError("Lütfen tarih ve saat seçin.");
      return;
    }
    if (IS_HTTP) {
      if (name.trim().length < 1 || phone.trim().length < 5) {
        setError("Lütfen ad soyad ve telefon bilgisini girin.");
        return;
      }
      setPending(true);
      setError("");
      void publicApi
        .talepGonder(token, {
          name: name.trim(),
          phone: phone.trim(),
          preferredDate: date,
          preferredTime: time,
          ...(note.trim() ? { note: `${type} · ${note.trim()}` } : { note: type })
        })
        .then(() => setSent(true))
        .catch((submitError: unknown) => setError(errorMessage(submitError)))
        .finally(() => setPending(false));
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
    markPatientLinkUsed(patientId);
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

        {metaState.status === "loading" ? (
          <p className="muted">Bağlantı kontrol ediliyor…</p>
        ) : !valid ? (
          <div role="alert">
            <h1 className="request-title">Bağlantı geçersiz</h1>
            <p className="muted">
              Bu randevu talebi bağlantısı geçersiz, süresi dolmuş veya daha önce kullanılmış. Lütfen
              diyetisyeninizden güncel bağlantı isteyin.
            </p>
          </div>
        ) : sent ? (
          <div role="status" className="request-success">
            <CheckCircle2 size={34} />
            <h1 className="request-title">Talebiniz alındı!</h1>
            <p className="muted">
              {date} · {time} için talebiniz oluşturuldu. Durum:{" "}
              <span className="badge badge-amber">Bekliyor</span> — diyetisyen onayı sonrası kesinleşir.
            </p>
          </div>
        ) : (
          <>
            <h1 className="request-title">Merhaba {patientName}</h1>
            <p className="muted">
              Aşağıdan uygun olduğunuz gün ve saati seçip talebinizi gönderin.
              {metaState.status === "ready" && metaState.dietitianName
                ? ` Diyetisyen: ${metaState.dietitianName}.`
                : ""}
            </p>
            <form onSubmit={submit} noValidate>
              <div className="form-grid">
                {IS_HTTP ? (
                  <>
                    <div>
                      <label className="label" htmlFor="ar-name">Ad Soyad *</label>
                      <input
                        id="ar-name"
                        className="input"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        maxLength={100}
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor="ar-phone">Telefon *</label>
                      <input
                        id="ar-phone"
                        className="input"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        inputMode="tel"
                        maxLength={20}
                      />
                    </div>
                  </>
                ) : null}
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
                {IS_HTTP ? (
                  <div className="form-full">
                    <label className="label" htmlFor="ar-note">Not</label>
                    <textarea
                      id="ar-note"
                      className="input"
                      rows={3}
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      maxLength={2000}
                    />
                  </div>
                ) : null}
              </div>
              {error ? <p className="field-error">{error}</p> : null}
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary" disabled={pending}>
                  <Send size={14} /> {pending ? "Gönderiliyor…" : "Randevu Talebi Gönder"}
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
