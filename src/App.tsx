import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar
} from "recharts";

type PatientStatus = "Aktif" | "Risk";

type Patient = {
  id: number;
  name: string;
  plan: string;
  startDate: string;
  endDate: string;
  compliance: number;
  lastAction: string;
  status: PatientStatus;
};

type AuthSnapshot = {
  token: string | null;
  user: string | null;
  expiresAt: number;
};

const PATIENTS: Patient[] = [
  {
    id: 1,
    name: "Barış Karapelit",
    plan: "2 Haftalık Fit Plan",
    startDate: "2025-11-03",
    endDate: "2025-11-17",
    compliance: 72,
    lastAction: "Bugün 14:05",
    status: "Aktif"
  },
  {
    id: 2,
    name: "Elif Y.",
    plan: "Düşük Karb Plan",
    startDate: "2025-11-01",
    endDate: "2025-11-15",
    compliance: 86,
    lastAction: "Dün 20:11",
    status: "Aktif"
  },
  {
    id: 3,
    name: "Meriç B.",
    plan: "Glütensiz 14G",
    startDate: "2025-10-29",
    endDate: "2025-11-12",
    compliance: 54,
    lastAction: "3 gün önce",
    status: "Risk"
  }
];

const ADHERENCE_SERIES = [
  { day: "1", value: 70 },
  { day: "2", value: 68 },
  { day: "3", value: 72 },
  { day: "4", value: 74 },
  { day: "5", value: 71 },
  { day: "6", value: 76 },
  { day: "7", value: 78 }
];

const MEAL_COMPLETION = [
  { label: "Kahvaltı", done: 85 },
  { label: "Ara 1", done: 78 },
  { label: "Öğle", done: 82 },
  { label: "Ara 2", done: 73 },
  { label: "Akşam", done: 88 },
  { label: "Gece Ara", done: 60 }
];

const LESS_THAN_SIXTY = "<60";
const AUTH_TOKEN_KEY = "dp_auth_token";
const AUTH_USER_KEY = "dp_auth_user";
const AUTH_EXPIRES_KEY = "dp_auth_expires_at";
const DEFAULT_DURATION_MIN = 30;

const MEAL_SCHEDULE: Array<[string, string]> = [
  ["Kahvaltı", "09:00"],
  ["Ara 1", "11:00"],
  ["Öğle", "13:30"],
  ["Ara 2", "16:30"],
  ["Akşam", "19:30"],
  ["Gece Ara", "22:30"]
];

const classNames = (...values: Array<string | false | null | undefined>) =>
  values.filter(Boolean).join(" ");

const formatMMSS = (totalSec: number) => {
  const s = Math.max(0, Math.floor(totalSec));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
};

const getAuthFromStorage = (): AuthSnapshot => {
  if (typeof window === "undefined") {
    return { token: null, user: null, expiresAt: 0 };
  }

  return {
    token: localStorage.getItem(AUTH_TOKEN_KEY),
    user: localStorage.getItem(AUTH_USER_KEY),
    expiresAt: Number(localStorage.getItem(AUTH_EXPIRES_KEY) || 0)
  };
};

const setAuthToStorage = ({ token, user, expiresAt }: AuthSnapshot) => {
  localStorage.setItem(AUTH_TOKEN_KEY, token ?? "");
  localStorage.setItem(AUTH_USER_KEY, user ?? "");
  localStorage.setItem(AUTH_EXPIRES_KEY, String(expiresAt ?? 0));
};

const clearAuthStorage = () => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  localStorage.removeItem(AUTH_EXPIRES_KEY);
};

const StatCard: React.FC<{ title: string; value: string; subtitle: string; icon?: string }> = ({
  title,
  value,
  subtitle,
  icon
}) => (
  <div className="card">
    <h3>
      {icon ? `${icon} ` : ""}
      {title}
    </h3>
    <div className="stat-value">{value}</div>
    <div className="stat-subtitle">{subtitle}</div>
  </div>
);

const Progress: React.FC<{ value: number }> = ({ value }) => (
  <div className="progress">
    <span style={{ width: `${value}%` }} />
  </div>
);

const PatientRow: React.FC<{ patient: Patient; onOpen: (patient: Patient) => void }> = ({
  patient,
  onOpen
}) => (
  <tr>
    <td style={{ fontWeight: 600 }}>{patient.name}</td>
    <td>{patient.plan}</td>
    <td>
      {patient.startDate} → {patient.endDate}
    </td>
    <td>
      <div className="table-progress-cell">
        <Progress value={patient.compliance} />
        <span className="table-progress-value">%{patient.compliance}</span>
      </div>
    </td>
    <td>{patient.lastAction}</td>
    <td>
      <span className={classNames("badge", patient.status === "Risk" && "badge-alert")}>
        {patient.status}
      </span>
    </td>
    <td style={{ textAlign: "right" }}>
      <button className="btn btn-outline btn-small" onClick={() => onOpen(patient)}>
        Detay
      </button>
    </td>
  </tr>
);

const PatientCard: React.FC<{ patient: Patient; onOpen: (patient: Patient) => void }> = ({
  patient,
  onOpen
}) => (
  <div className="card patient-card">
    <div className="patient-card-header">
      <strong>{patient.name}</strong>
      <span className={classNames("badge", patient.status === "Risk" && "badge-alert")}>
        {patient.status}
      </span>
    </div>
    <div>
      <label className="label">Plan</label>
      <div>{patient.plan}</div>
    </div>
    <div className="patient-card-grid">
      <div>
        <span className="muted">Başlangıç</span>
        <div className="value-strong">{patient.startDate}</div>
      </div>
      <div>
        <span className="muted">Bitiş</span>
        <div className="value-strong">{patient.endDate}</div>
      </div>
    </div>
    <div>
      <label className="label">Uyum</label>
      <div className="patient-card-progress">
        <Progress value={patient.compliance} />
        <span className="table-progress-value">%{patient.compliance}</span>
      </div>
    </div>
    <div className="card-actions">
      <button className="btn btn-primary" onClick={() => onOpen(patient)}>
        Görüntüle
      </button>
      <button className="btn btn-outline">Plan Ata</button>
    </div>
  </div>
);

const MealGrid: React.FC = () => {
  const days = React.useMemo(() => Array.from({ length: 14 }, (_, i) => i + 1), []);
  const meals = ["Kahvaltı", "Ara 1", "Öğle", "Ara 2", "Akşam"];
  const completion = React.useMemo(
    () =>
      days.map(() =>
        meals.map(() => ({
          done: Math.random() > 0.3
        }))
      ),
    [days, meals]
  );

  return (
    <div className="table-scroll">
      <table className="meal-grid">
        <thead>
          <tr>
            <th>Gün</th>
            {meals.map((meal) => (
              <th key={meal}>{meal}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((day, dayIndex) => (
            <tr key={day}>
              <td className="value-strong">{day}</td>
              {meals.map((meal, mealIndex) => (
                <td key={meal}>
                  <label className="checkbox-row">
                    <input type="checkbox" defaultChecked={completion[dayIndex][mealIndex].done} />
                    <span className="muted">Tamamlandı</span>
                  </label>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const PatientDetailDrawer: React.FC<{
  patient: Patient | null;
  onClose: () => void;
}> = ({ patient, onClose }) => {
  if (!patient) {
    return null;
  }

  return (
    <div className="drawer" role="dialog" aria-modal="true">
      <div className="drawer-panel">
        <div className="drawer-header">
          <div>
            <p className="muted drawer-subtitle">Hasta Detay</p>
            <h2 className="drawer-title">
              {patient.name}
              <span className="drawer-title-secondary"> · {patient.plan}</span>
            </h2>
          </div>
          <button className="btn btn-outline" onClick={onClose}>
            Kapat
          </button>
        </div>

        <div className="drawer-body">
          <div className="card">
            <h3>14 Günlük Çizelge</h3>
            <MealGrid />
          </div>

          <div className="card">
            <h3>Bildirim Saatleri</h3>
            <div className="drawer-form">
              {MEAL_SCHEDULE.map(([labelText, time]) => (
                <div key={labelText} className="drawer-form-row">
                  <label className="label">{labelText}</label>
                  <input className="input" defaultValue={time} />
                </div>
              ))}
              <div>
                <button className="btn btn-primary btn-small">Kaydet</button>
              </div>
            </div>
          </div>

          <div className="card">
            <h3>Plan Atama</h3>
            <div className="drawer-plan-grid">
              <div>
                <label className="label">Plan Şablonu</label>
                <select className="input">
                  <option>2 Haftalık Fit Plan</option>
                  <option>Düşük Karbonhidrat</option>
                  <option>Glütensiz 14G</option>
                </select>
              </div>
              <div>
                <label className="label">Başlangıç Tarihi</label>
                <input type="date" className="input" defaultValue={patient.startDate} />
              </div>
              <div>
                <label className="label">Döngü (gün)</label>
                <input type="number" className="input" defaultValue={14} />
              </div>
              <div className="drawer-plan-action">
                <button className="btn btn-primary">Ata / Güncelle</button>
              </div>
            </div>
          </div>

          <div className="card">
            <h3>Öğün Günlüğü (Son 7 Gün)</h3>
            <div className="drawer-week-grid">
              {Array.from({ length: 7 }, (_, index) => (
                <div key={index} className="week-chip">
                  <p className="muted">Gün {index + 1}</p>
                  <div className="week-chip-grid">
                    {["K", "A1", "Ö", "A2", "A"].map((meal) => (
                      <span key={meal} className="week-chip-cell">
                        {meal} ✅
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

type PlanItem = { id: string; label: string };

const DnDPlanEditor: React.FC = () => {
  const [items, setItems] = React.useState<PlanItem[]>([
    { id: "k", label: "Kahvaltı: 1 haşlanmış yumurta" },
    { id: "a1", label: "Ara 1: 1 fincan sade kahve" },
    { id: "o", label: "Öğle: 1 kase mevsim salata + 1 dilim tam buğday" },
    { id: "a2", label: "Ara 2: 6 adet badem" },
    { id: "a", label: "Akşam: Izgara tavuk + salata" }
  ]);
  const [repeat, setRepeat] = React.useState({ every: 14, unit: "day" });

  const handleDragStart = React.useCallback((event: React.DragEvent<HTMLLIElement>, id: string) => {
    event.dataTransfer.setData("text/plain", id);
  }, []);

  const handleDrop = React.useCallback(
    (event: React.DragEvent<HTMLLIElement>, index: number) => {
      event.preventDefault();
      const id = event.dataTransfer.getData("text/plain");
      const from = items.findIndex((item) => item.id === id);
      if (from === -1) {
        return;
      }

      const next = [...items];
      const [moved] = next.splice(from, 1);
      next.splice(index, 0, moved);
      setItems(next);
    },
    [items]
  );

  const handleDragOver = React.useCallback((event: React.DragEvent<HTMLLIElement>) => {
    event.preventDefault();
  }, []);

  return (
    <div className="card">
      <h3>Plan Şablonu Editörü (Sürükle-Bırak)</h3>
      <div className="editor-grid">
        <div className="editor-board">
          <p className="muted">Öğeleri sürükleyerek sıralamayı değiştirin.</p>
          <ul className="editor-list">
            {items.map((item, index) => (
              <li
                key={item.id}
                draggable
                onDragStart={(event) => handleDragStart(event, item.id)}
                onDrop={(event) => handleDrop(event, index)}
                onDragOver={handleDragOver}
                className="editor-item"
              >
                {index + 1}. {item.label}
              </li>
            ))}
          </ul>
        </div>
        <div className="editor-sidebar">
          <div>
            <label className="label">Tekrar Kuralı</label>
            <div className="editor-repeat">
              <input
                type="number"
                className="input"
                value={repeat.every}
                onChange={(event) =>
                  setRepeat((prev) => ({
                    ...prev,
                    every: Number(event.target.value)
                  }))
                }
              />
              <select
                className="input"
                value={repeat.unit}
                onChange={(event) =>
                  setRepeat((prev) => ({
                    ...prev,
                    unit: event.target.value
                  }))
                }
              >
                <option value="day">gün</option>
                <option value="week">hafta</option>
              </select>
            </div>
            <p className="muted">Örn: 14 gün döngü ile tekrar et.</p>
          </div>
          <div>
            <label className="label">Şablon Adı</label>
            <input className="input" defaultValue="2 Haftalık Fit Plan" />
          </div>
          <div className="card-actions">
            <button className="btn btn-primary">Kaydet</button>
            <button className="btn btn-outline">Yeni Olarak Kaydet</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const AlertRulesForm: React.FC = () => (
  <div className="card">
    <h3>Uyarı Kuralları</h3>
    <div className="alert-grid">
      <div>
        <label className="label">Uyum Eşiği (%)</label>
        <input type="number" className="input" defaultValue={70} />
        <p className="muted muted-spaced">Altına düşerse uyarı oluştur.</p>
      </div>
      <div>
        <label className="label">İşaretlenmeyen Öğün (saat)</label>
        <input type="number" className="input" defaultValue={4} />
        <p className="muted muted-spaced">Öğünden sonra şu kadar saat içinde tamamlanmadıysa.</p>
      </div>
      <div>
        <label className="label">Plan Bitiş Hatırlatma (gün)</label>
        <input type="number" className="input" defaultValue={2} />
        <p className="muted muted-spaced">Bitişe bu kadar gün kala uyar.</p>
      </div>
    </div>

    <div className="divider" />

    <div className="card-bordered">
      <p className="card-bordered-title">Sessize Alma</p>
      <div className="alert-checkbox-grid">
        {["Gece 23:00-07:00", "Hafta sonu", "Tatiller"].map((labelText, index) => (
          <label key={labelText} className="checkbox-row">
            <input type="checkbox" defaultChecked={index === 0} />
            <span>{labelText}</span>
          </label>
        ))}
      </div>
    </div>

    <div className="card-bordered">
      <p className="card-bordered-title">Otomatik Senaryolar</p>
      <ul className="scenario-list">
        <li>
          <span>48 saatte 3 öğün kaçtı → Hastaya push bildirimi</span>
          <button className="btn btn-outline btn-small">Düzenle</button>
        </li>
        <li>
          <span>Uyum {LESS_THAN_SIXTY} → Diyetisyene e-posta</span>
          <button className="btn btn-outline btn-small">Düzenle</button>
        </li>
        <li>
          <span>Plan bitişine 1 gün → Yeni plan öner</span>
          <button className="btn btn-outline btn-small">Düzenle</button>
        </li>
      </ul>
    </div>

    <div className="card-actions">
      <button className="btn btn-primary">Kaydet</button>
      <button className="btn btn-outline">Varsayılanlara Dön</button>
    </div>
  </div>
);

const LoginScreen: React.FC<{ onLogin: (email: string, password: string) => void }> = ({
  onLogin
}) => {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const canSubmit = email.trim() !== "" && password.trim() !== "";

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canSubmit) {
      onLogin(email, password);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="card login-card">
        <h2 className="login-title">Giriş Yap</h2>
        <form className="login-form" onSubmit={handleSubmit}>
          <div>
            <label className="label">E-posta</label>
            <input
              className="input"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="label">Şifre</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={!canSubmit}>
            Giriş
          </button>
          <p className="muted login-hint">Demo: Herhangi bir e-posta/şifre kabul edilir.</p>
        </form>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [query, setQuery] = React.useState("");
  const [tab, setTab] = React.useState<"dashboard" | "patients" | "plans" | "alerts" | "settings">(
    "dashboard"
  );
  const [selectedPatient, setSelectedPatient] = React.useState<Patient | null>(null);
  const [showDetail, setShowDetail] = React.useState(false);

  const [auth, setAuth] = React.useState<AuthSnapshot>(() => getAuthFromStorage());
  const [isAuthed, setIsAuthed] = React.useState(() => {
    const snapshot = getAuthFromStorage();
    return Boolean(snapshot.token) && snapshot.expiresAt > Date.now();
  });
  const [remainingSec, setRemainingSec] = React.useState(() => {
    const snapshot = getAuthFromStorage();
    return Math.max(0, Math.floor((snapshot.expiresAt - Date.now()) / 1000));
  });

  const handleLogout = React.useCallback(() => {
    clearAuthStorage();
    setAuth({ token: null, user: null, expiresAt: 0 });
    setIsAuthed(false);
    setRemainingSec(0);
  }, []);

  const extendSession = React.useCallback(
    (minutes = 15) => {
      if (!isAuthed) {
        return;
      }

      const expiration = Date.now() + minutes * 60 * 1000;
      const next: AuthSnapshot = {
        token: auth.token ?? "demo-token",
        user: auth.user ?? "user",
        expiresAt: expiration
      };
      setAuthToStorage(next);
      setAuth(next);
      setRemainingSec(Math.floor((expiration - Date.now()) / 1000));
    },
    [auth, isAuthed]
  );

  React.useEffect(() => {
    if (!isAuthed) {
      return;
    }

    const timer = window.setInterval(() => {
      const snapshot = getAuthFromStorage();
      const diff = Math.floor((snapshot.expiresAt - Date.now()) / 1000);
      setRemainingSec(Math.max(0, diff));

      if (!snapshot.expiresAt || snapshot.expiresAt <= Date.now()) {
        window.clearInterval(timer);
        handleLogout();
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isAuthed, handleLogout]);

  React.useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if ([AUTH_TOKEN_KEY, AUTH_USER_KEY, AUTH_EXPIRES_KEY].includes(event.key ?? "")) {
        const next = getAuthFromStorage();
        const valid = Boolean(next.token) && next.expiresAt > Date.now();
        setAuth(next);
        setIsAuthed(valid);
        setRemainingSec(Math.max(0, Math.floor((next.expiresAt - Date.now()) / 1000)));
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const filteredPatients = React.useMemo(() => {
    const lower = query.trim().toLowerCase();
    if (!lower) {
      return PATIENTS;
    }
    return PATIENTS.filter((patient) => patient.name.toLowerCase().includes(lower));
  }, [query]);

  const handleLogin = React.useCallback((email: string, password: string) => {
    if (!email || !password) {
      return;
    }
    const expiration = Date.now() + DEFAULT_DURATION_MIN * 60 * 1000;
    const next: AuthSnapshot = {
      token: "demo-token",
      user: email,
      expiresAt: expiration
    };
    setAuthToStorage(next);
    setAuth(next);
    setIsAuthed(true);
    setRemainingSec(Math.floor((expiration - Date.now()) / 1000));
  }, []);

  const openDetail = React.useCallback((patient: Patient) => {
    setSelectedPatient(patient);
    setShowDetail(true);
  }, []);

  const closeDetail = React.useCallback(() => {
    setShowDetail(false);
  }, []);

  if (!isAuthed) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="layout">
      <header>
        <div className="topbar">
          <div className="topbar-logo">
            ☑️ Diyetisyen Paneli
            {auth.user ? <span className="topbar-user">· {auth.user}</span> : null}
          </div>
          <div className="spacer" />
          <div className="search">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              placeholder="Hasta ara..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <button className="btn btn-outline" onClick={() => extendSession(15)}>
            Oturumu Uzat ({formatMMSS(remainingSec)})
          </button>
          <button className="btn btn-outline">Bildirimler</button>
          <button className="btn btn-outline" onClick={handleLogout}>
            Çıkış
          </button>
        </div>
      </header>

      <main>
        <div className="tabs">
          <button className={tab === "dashboard" ? "active" : undefined} onClick={() => setTab("dashboard")}>
            Dashboard
          </button>
          <button className={tab === "patients" ? "active" : undefined} onClick={() => setTab("patients")}>
            Hastalar
          </button>
          <button className={tab === "plans" ? "active" : undefined} onClick={() => setTab("plans")}>
            Planlar
          </button>
          <button className={tab === "alerts" ? "active" : undefined} onClick={() => setTab("alerts")}>
            Uyarılar
          </button>
          <button className={tab === "settings" ? "active" : undefined} onClick={() => setTab("settings")}>
            Ayarlar
          </button>
        </div>

        {tab === "dashboard" && (
          <section className="tab-panel">
            <div className="grid grid-md-4">
              <StatCard title="Toplam Hasta" value="48" subtitle="Bu ay +6" icon="👥" />
              <StatCard title="Ortalama Uyum" value="%76" subtitle="Son 7 gün" icon="✅" />
              <StatCard title="Devam Eden Plan" value="23" subtitle="14 günlük" icon="⏱" />
              <StatCard title="Bugün Tamamlanan" value="112" subtitle="Öğün" icon="📅" />
            </div>

            <div className="grid grid-lg-5 dashboard-charts">
              <div className="card chart-card span-3">
                <h3>7 Günlük Uyum Yüzdesi</h3>
                <div className="chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={ADHERENCE_SERIES}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card chart-card span-2">
                <h3>Öğün Tamamlama Dağılımı</h3>
                <div className="chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={MEAL_COMPLETION}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Bar dataKey="done" fill="#818cf8" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="card">
              <h3>Hızlı Hasta Görünümü</h3>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Hasta</th>
                      <th>Plan</th>
                      <th>Tarih</th>
                      <th>Uyum</th>
                      <th>Son İşlem</th>
                      <th>Durum</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPatients.map((patient) => (
                      <PatientRow key={patient.id} patient={patient} onOpen={openDetail} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {tab === "patients" && (
          <section className="tab-panel">
            <div className="patients-grid">
              {filteredPatients.map((patient) => (
                <PatientCard key={patient.id} patient={patient} onOpen={openDetail} />
              ))}
            </div>
          </section>
        )}

        {tab === "plans" && (
          <section className="tab-panel">
            <DnDPlanEditor />
          </section>
        )}

        {tab === "alerts" && (
          <section className="tab-panel">
            <AlertRulesForm />
          </section>
        )}

        {tab === "settings" && (
          <section className="tab-panel">
            <div className="card">
              <h3>Genel Ayarlar</h3>
              <div className="settings-grid">
                <div>
                  <label className="label">Bildirim Saatleri (Varsayılan)</label>
                  <div className="settings-time-grid">
                    {["09:00", "11:00", "13:30", "16:30", "19:30", "22:30"].map((time) => (
                      <input key={time} defaultValue={time} className="input" />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="label">Uyum Eşiği (%)</label>
                  <div className="settings-threshold">
                    <input type="number" defaultValue={70} className="input" />
                    <span className="muted">Altında uyarı üret</span>
                  </div>
                </div>
              </div>
              <div className="card-actions">
                <button className="btn btn-primary">Kaydet</button>
                <button className="btn btn-outline">Sıfırla</button>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer>© {new Date().getFullYear()} Diyetisyen Paneli · Mockup</footer>

      {showDetail ? <PatientDetailDrawer patient={selectedPatient} onClose={closeDetail} /> : null}
    </div>
  );
};

if (typeof window !== "undefined") {
  try {
    console.assert(LESS_THAN_SIXTY === "<60", "LESS_THAN_SIXTY sabiti beklenen değerde değil");
    console.assert(formatMMSS(61) === "01:01", "formatMMSS(61) => 01:01 olmalı");
    console.assert(formatMMSS(0) === "00:00", "formatMMSS(0) => 00:00 olmalı");
    console.assert(formatMMSS(3599) === "59:59", "formatMMSS(3599) => 59:59 olmalı");
  } catch (error) {
    // no-op
  }
}

export default App;

