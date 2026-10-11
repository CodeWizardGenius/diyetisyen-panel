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
  Bar,
  Legend
} from "recharts";
import {
  LayoutDashboard,
  Users,
  Salad,
  CalendarDays,
  Bell,
  Settings,
  Search,
  Menu,
  X,
  LogOut,

  Clock,
  CheckCircle2,
  Leaf,
  ChefHat,
  ClipboardList,
  Ruler,
  StickyNote,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Scale,
  Activity,
  UtensilsCrossed,
  Timer,
  Flame,
  Wheat,
  Beef,
  Droplet,
  Printer,
  Plus,
  Trash2,
  GripVertical,
  Calculator,
  FileText
} from "lucide-react";

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

type Measurement = {
  id: string;
  date: string; // ISO YYYY-MM-DD
  weightKg: number;
  heightCm: number;
  bodyFatPercentage: number;
  muscleMassKg: number;
  waistCm: number;
  hipCm: number;
  notes?: string;
};

type BMICategory = "Zayıf" | "Normal" | "Fazla Kilolu" | "Obez";

const calculateBMI = (weightKg: number, heightCm: number): number => {
  if (!weightKg || !heightCm || heightCm <= 0) {
    return 0;
  }
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  return Math.round(bmi * 10) / 10;
};

const getBMICategory = (bmi: number): BMICategory => {
  if (bmi < 18.5) {
    return "Zayıf";
  }
  if (bmi < 25) {
    return "Normal";
  }
  if (bmi < 30) {
    return "Fazla Kilolu";
  }
  return "Obez";
};

const formatDelta = (current: number, previous: number, unit: string, decimals = 1): string => {
  const diff = current - previous;
  if (Math.abs(diff) < 0.0001) {
    return `0 ${unit}`;
  }
  const sign = diff > 0 ? "+" : "-";
  return `${sign}${Math.abs(diff).toFixed(decimals)} ${unit}`;
};

type Sex = "kadin" | "erkek";
type ActivityLevel = "sedanter" | "hafif" | "orta" | "aktif" | "cokAktif";
type WeightGoal = "verme" | "koruma" | "alma";

type BmrInput = {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
};

type MacroSplit = {
  carbsPct: number;
  proteinPct: number;
  fatPct: number;
};

type CalorieTarget = {
  bmr: number;
  tdee: number;
  targetCalories: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
};

const ACTIVITY_FACTORS: Record<ActivityLevel, { factor: number; label: string }> = {
  sedanter: { factor: 1.2, label: "Sedanter (egzersiz yok)" },
  hafif: { factor: 1.375, label: "Hafif (haftada 1-3 gün)" },
  orta: { factor: 1.55, label: "Orta (haftada 3-5 gün)" },
  aktif: { factor: 1.725, label: "Aktif (haftada 6-7 gün)" },
  cokAktif: { factor: 1.9, label: "Çok aktif (günde 2 antrenman)" }
};

const GOAL_ADJUSTMENTS: Record<WeightGoal, { delta: number; label: string; macros: MacroSplit }> = {
  verme: { delta: -500, label: "Kilo verme", macros: { carbsPct: 45, proteinPct: 30, fatPct: 25 } },
  koruma: { delta: 0, label: "Koruma", macros: { carbsPct: 50, proteinPct: 20, fatPct: 30 } },
  alma: { delta: 300, label: "Kilo alma", macros: { carbsPct: 55, proteinPct: 20, fatPct: 25 } }
};

/** Mifflin-St Jeor: erkek +5, kadın -161 */
const calculateBMR = ({ weightKg, heightCm, age, sex }: BmrInput): number => {
  if (!weightKg || !heightCm || !age || weightKg <= 0 || heightCm <= 0 || age <= 0) {
    return 0;
  }
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(sex === "erkek" ? base + 5 : base - 161);
};

const calculateTargets = (
  input: BmrInput,
  activity: ActivityLevel,
  goal: WeightGoal,
  macros: MacroSplit
): CalorieTarget => {
  const bmr = calculateBMR(input);
  const tdee = Math.round(bmr * ACTIVITY_FACTORS[activity].factor);
  const targetCalories = Math.max(1200, tdee + GOAL_ADJUSTMENTS[goal].delta);
  const total = macros.carbsPct + macros.proteinPct + macros.fatPct;
  const safe = total > 0 ? total : 100;
  const carbsG = Math.round(((targetCalories * macros.carbsPct) / safe / 4) * 10) / 10;
  const proteinG = Math.round(((targetCalories * macros.proteinPct) / safe / 4) * 10) / 10;
  const fatG = Math.round(((targetCalories * macros.fatPct) / safe / 9) * 10) / 10;
  return { bmr, tdee, targetCalories, carbsG, proteinG, fatG };
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

const MOCK_MEASUREMENTS: Record<number, Measurement[]> = {
  1: [
    { id: "m1-1", date: "2025-10-06", weightKg: 88.4, heightCm: 178, bodyFatPercentage: 27.5, muscleMassKg: 60.2, waistCm: 102, hipCm: 108, notes: "Başlangıç ölçümü" },
    { id: "m1-2", date: "2025-10-13", weightKg: 87.1, heightCm: 178, bodyFatPercentage: 26.8, muscleMassKg: 60.5, waistCm: 100.5, hipCm: 107, notes: "" },
    { id: "m1-3", date: "2025-10-20", weightKg: 86.0, heightCm: 178, bodyFatPercentage: 26.1, muscleMassKg: 60.8, waistCm: 99, hipCm: 106, notes: "" },
    { id: "m1-4", date: "2025-10-27", weightKg: 85.2, heightCm: 178, bodyFatPercentage: 25.4, muscleMassKg: 61.1, waistCm: 98, hipCm: 105, notes: "Bel çevresinde iyi düşüş" },
    { id: "m1-5", date: "2025-11-03", weightKg: 83.8, heightCm: 178, bodyFatPercentage: 24.6, muscleMassKg: 61.4, waistCm: 96.5, hipCm: 104, notes: "" }
  ],
  2: [
    { id: "m2-1", date: "2025-10-11", weightKg: 64.2, heightCm: 165, bodyFatPercentage: 24.0, muscleMassKg: 46.0, waistCm: 78, hipCm: 96, notes: "Başlangıç" },
    { id: "m2-2", date: "2025-10-18", weightKg: 63.5, heightCm: 165, bodyFatPercentage: 23.4, muscleMassKg: 46.2, waistCm: 77, hipCm: 95.5, notes: "" },
    { id: "m2-3", date: "2025-10-25", weightKg: 62.8, heightCm: 165, bodyFatPercentage: 22.9, muscleMassKg: 46.3, waistCm: 76, hipCm: 95, notes: "" },
    { id: "m2-4", date: "2025-11-01", weightKg: 62.1, heightCm: 165, bodyFatPercentage: 22.1, muscleMassKg: 46.5, waistCm: 75, hipCm: 94, notes: "" }
  ],
  3: [
    { id: "m3-1", date: "2025-10-08", weightKg: 74.0, heightCm: 170, bodyFatPercentage: 29.0, muscleMassKg: 49.5, waistCm: 88, hipCm: 102, notes: "Başlangıç" },
    { id: "m3-2", date: "2025-10-15", weightKg: 74.3, heightCm: 170, bodyFatPercentage: 29.2, muscleMassKg: 49.4, waistCm: 88.5, hipCm: 102.5, notes: "Uyum düşük, artış var" },
    { id: "m3-3", date: "2025-10-29", weightKg: 73.6, heightCm: 170, bodyFatPercentage: 28.6, muscleMassKg: 49.6, waistCm: 87.5, hipCm: 101.5, notes: "" }
  ]
};

const getInitialMeasurements = (patientId: number): Measurement[] => {
  const seed = MOCK_MEASUREMENTS[patientId];
  if (seed) {
    return [...seed].sort((a, b) => a.date.localeCompare(b.date));
  }
  return [];
};

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

type AppTab = "dashboard" | "patients" | "plans" | "appointments" | "alerts" | "settings";

const StatCard: React.FC<{
  title: string;
  value: string;
  subtitle: string;
  icon?: React.ReactNode;
  tone?: "emerald" | "mint" | "amber" | "rose" | "slate";
}> = ({ title, value, subtitle, icon, tone = "emerald" }) => (
  <div className="card stat-card">
    <div className="stat-head">
      <span className={classNames("stat-icon", `stat-${tone}`)}>{icon}</span>
      <h3>{title}</h3>
    </div>
    <div className="stat-value">{value}</div>
    <div className="stat-subtitle">{subtitle}</div>
  </div>
);

const Progress: React.FC<{ value: number }> = ({ value }) => (
  <div className="progress">
    <span style={{ width: `${value}%` }} />
  </div>
);

const StatusBadge: React.FC<{ status: PatientStatus }> = ({ status }) => (
  <span className={classNames("badge", status === "Risk" ? "badge-rose" : "badge-emerald")}>
    {status === "Risk" ? <TrendingDown size={12} /> : <CheckCircle2 size={12} />}
    {status}
  </span>
);

const PatientRow: React.FC<{ patient: Patient; onOpen: (patient: Patient) => void }> = ({
  patient,
  onOpen
}) => (
  <tr>
    <td style={{ fontWeight: 600 }}>
      <span className="cell-user">
        <span className="avatar">{patient.name.charAt(0)}</span>
        {patient.name}
      </span>
    </td>
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
      <StatusBadge status={patient.status} />
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
      <span className="cell-user">
        <span className="avatar">{patient.name.charAt(0)}</span>
        <strong>{patient.name}</strong>
      </span>
      <StatusBadge status={patient.status} />
    </div>
    <div>
      <label className="label">Plan</label>
      <div className="value-strong">{patient.plan}</div>
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

type MeasurementFormValues = {
  date: string;
  weightKg: string;
  heightCm: string;
  bodyFatPercentage: string;
  muscleMassKg: string;
  waistCm: string;
  hipCm: string;
  notes: string;
};

type MeasurementFormErrors = Partial<Record<keyof MeasurementFormValues, string>>;

const EMPTY_MEASUREMENT_FORM: MeasurementFormValues = {
  date: new Date().toISOString().slice(0, 10),
  weightKg: "",
  heightCm: "",
  bodyFatPercentage: "",
  muscleMassKg: "",
  waistCm: "",
  hipCm: "",
  notes: ""
};

const validateMeasurementForm = (values: MeasurementFormValues): MeasurementFormErrors => {
  const errors: MeasurementFormErrors = {};
  if (!values.date) {
    errors.date = "Tarih zorunludur.";
  } else if (values.date > new Date().toISOString().slice(0, 10)) {
    errors.date = "Tarih gelecekte olamaz.";
  }

  const checkNumber = (
    key: keyof MeasurementFormValues,
    label: string,
    min: number,
    max: number,
    required = true
  ) => {
    const raw = values[key].trim();
    if (!raw) {
      if (required) {
        errors[key] = `${label} zorunludur.`;
      }
      return;
    }
    const num = Number(raw.replace(",", "."));
    if (!Number.isFinite(num)) {
      errors[key] = `${label} sayısal olmalıdır.`;
    } else if (num < min || num > max) {
      errors[key] = `${label} ${min}-${max} aralığında olmalıdır.`;
    }
  };

  checkNumber("weightKg", "Kilo (kg)", 30, 300);
  checkNumber("heightCm", "Boy (cm)", 100, 250);
  checkNumber("bodyFatPercentage", "Vücut yağ oranı (%)", 3, 75);
  checkNumber("muscleMassKg", "Kas kütlesi (kg)", 10, 150);
  checkNumber("waistCm", "Bel çevresi (cm)", 40, 200);
  checkNumber("hipCm", "Kalça çevresi (cm)", 40, 200);

  if (values.notes && values.notes.length > 280) {
    errors.notes = "Not en fazla 280 karakter olabilir.";
  }

  return errors;
};

const toMeasurement = (values: MeasurementFormValues): Measurement => ({
  id: `m-${Date.now()}`,
  date: values.date,
  weightKg: Number(values.weightKg.replace(",", ".")),
  heightCm: Number(values.heightCm.replace(",", ".")),
  bodyFatPercentage: Number(values.bodyFatPercentage.replace(",", ".")),
  muscleMassKg: Number(values.muscleMassKg.replace(",", ".")),
  waistCm: Number(values.waistCm.replace(",", ".")),
  hipCm: Number(values.hipCm.replace(",", ".")),
  notes: values.notes.trim()
});

const MeasurementDeltaCard: React.FC<{ current?: Measurement; previous?: Measurement }> = ({
  current,
  previous
}) => {
  if (!current || !previous) {
    return (
      <div className="card delta-card">
        <h3>Son Ölçüm Farkı</h3>
        <p className="muted">Karşılaştırma için en az 2 ölçüm gerekli.</p>
      </div>
    );
  }

  const deltas = [
    {
      label: "Kilo",
      text: formatDelta(current.weightKg, previous.weightKg, "kg"),
      value: current.weightKg - previous.weightKg,
      invert: false
    },
    {
      label: "Yağ Oranı",
      text: formatDelta(current.bodyFatPercentage, previous.bodyFatPercentage, "% yağ"),
      value: current.bodyFatPercentage - previous.bodyFatPercentage,
      invert: false
    },
    {
      label: "Kas",
      text: formatDelta(current.muscleMassKg, previous.muscleMassKg, "kg kas"),
      value: current.muscleMassKg - previous.muscleMassKg,
      invert: true
    },
    {
      label: "Bel",
      text: formatDelta(current.waistCm, previous.waistCm, "cm"),
      value: current.waistCm - previous.waistCm,
      invert: false
    }
  ];

  return (
    <div className="card delta-card">
      <h3>
        Son Ölçüm Farkı <span className="muted">· {previous.date} → {current.date}</span>
      </h3>
      <div className="delta-grid">
        {deltas.map((delta) => {
          const isZero = Math.abs(delta.value) < 0.0001;
          const isGood = isZero ? null : delta.invert ? delta.value > 0 : delta.value < 0;
          return (
            <div
              key={delta.label}
              className={classNames(
                "delta-chip",
                isZero ? "delta-neutral" : isGood ? "delta-good" : "delta-bad"
              )}
            >
              <span className="delta-label">{delta.label}</span>
              <strong className="delta-value">{delta.text}</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const MeasurementChart: React.FC<{ measurements: Measurement[] }> = ({ measurements }) => {
  const data = React.useMemo(
    () =>
      [...measurements]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((m) => ({
          date: m.date.slice(5),
          fullDate: m.date,
          weightKg: m.weightKg,
          bodyFatPercentage: m.bodyFatPercentage
        })),
    [measurements]
  );

  if (data.length === 0) {
    return (
      <div className="card">
        <h3>Kilo & Yağ Oranı Gelişimi</h3>
        <p className="muted">Grafik için henüz ölçüm bulunmuyor. İlk ölçümü ekleyin.</p>
      </div>
    );
  }

  return (
    <div className="card chart-card">
      <h3>Kilo & Yağ Oranı Gelişimi</h3>
      <div className="chart chart-tall">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis
              yAxisId="weight"
              orientation="left"
              tick={{ fontSize: 12 }}
              label={{ value: "kg", angle: -90, position: "insideLeft", fontSize: 12 }}
            />
            <YAxis
              yAxisId="fat"
              orientation="right"
              tick={{ fontSize: 12 }}
              domain={["auto", "auto"]}
              label={{ value: "% yağ", angle: 90, position: "insideRight", fontSize: 12 }}
            />
            <Tooltip
              labelFormatter={(_, payload) =>
                payload && payload.length > 0 ? String(payload[0]?.payload?.fullDate ?? "") : ""
              }
            />
            <Legend />
            <Line
              yAxisId="weight"
              type="monotone"
              dataKey="weightKg"
              name="Kilo (kg)"
              stroke="#059669"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line
              yAxisId="fat"
              type="monotone"
              dataKey="bodyFatPercentage"
              name="Yağ (%)"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const MeasurementEntryModal: React.FC<{
  initialHeight?: number;
  onClose: () => void;
  onSubmit: (measurement: Measurement) => void;
}> = ({ initialHeight, onClose, onSubmit }) => {
  const [values, setValues] = React.useState<MeasurementFormValues>(() => ({
    ...EMPTY_MEASUREMENT_FORM,
    heightCm: initialHeight ? String(initialHeight) : ""
  }));
  const [errors, setErrors] = React.useState<MeasurementFormErrors>({});
  const [touched, setTouched] = React.useState(false);

  const setField = (key: keyof MeasurementFormValues) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setValues((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validation = validateMeasurementForm(values);
    setErrors(validation);
    setTouched(true);
    if (Object.keys(validation).length > 0) {
      return;
    }
    onSubmit(toMeasurement(values));
    onClose();
  };

  const liveBMI =
    values.weightKg && values.heightCm && !Number.isNaN(Number(values.weightKg)) && !Number.isNaN(Number(values.heightCm))
      ? calculateBMI(Number(String(values.weightKg).replace(",", ".")), Number(String(values.heightCm).replace(",", ".")))
      : 0;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Yeni Ölçüm Ekle</h3>
            <p className="muted">Seans ölçümünü kaydedin. Tüm sayısal alanlar zorunludur.</p>
          </div>
          <button className="btn btn-outline btn-small" onClick={onClose}>
            Kapat
          </button>
        </div>
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-grid">
            <div>
              <label className="label" htmlFor="m-date">Tarih *</label>
              <input id="m-date" type="date" className="input" value={values.date} onChange={setField("date")} />
              {touched && errors.date ? <p className="field-error">{errors.date}</p> : null}
            </div>
            <div>
              <label className="label" htmlFor="m-weight">Kilo (kg) *</label>
              <input id="m-weight" type="number" step="0.1" min={30} max={300} className="input" placeholder="örn. 83.5" value={values.weightKg} onChange={setField("weightKg")} />
              {touched && errors.weightKg ? <p className="field-error">{errors.weightKg}</p> : null}
            </div>
            <div>
              <label className="label" htmlFor="m-height">Boy (cm) *</label>
              <input id="m-height" type="number" step="0.5" min={100} max={250} className="input" placeholder="örn. 178" value={values.heightCm} onChange={setField("heightCm")} />
              {touched && errors.heightCm ? <p className="field-error">{errors.heightCm}</p> : null}
            </div>
            <div>
              <label className="label" htmlFor="m-fat">Vücut Yağ Oranı (%) *</label>
              <input id="m-fat" type="number" step="0.1" min={3} max={75} className="input" placeholder="örn. 24.6" value={values.bodyFatPercentage} onChange={setField("bodyFatPercentage")} />
              {touched && errors.bodyFatPercentage ? <p className="field-error">{errors.bodyFatPercentage}</p> : null}
            </div>
            <div>
              <label className="label" htmlFor="m-muscle">Kas Kütlesi (kg) *</label>
              <input id="m-muscle" type="number" step="0.1" min={10} max={150} className="input" placeholder="örn. 61.4" value={values.muscleMassKg} onChange={setField("muscleMassKg")} />
              {touched && errors.muscleMassKg ? <p className="field-error">{errors.muscleMassKg}</p> : null}
            </div>
            <div>
              <label className="label" htmlFor="m-waist">Bel (cm) *</label>
              <input id="m-waist" type="number" step="0.5" min={40} max={200} className="input" placeholder="örn. 96.5" value={values.waistCm} onChange={setField("waistCm")} />
              {touched && errors.waistCm ? <p className="field-error">{errors.waistCm}</p> : null}
            </div>
            <div>
              <label className="label" htmlFor="m-hip">Kalça (cm) *</label>
              <input id="m-hip" type="number" step="0.5" min={40} max={200} className="input" placeholder="örn. 104" value={values.hipCm} onChange={setField("hipCm")} />
              {touched && errors.hipCm ? <p className="field-error">{errors.hipCm}</p> : null}
            </div>
            <div>
              <label className="label">Tahmini VKİ</label>
              <div className="bmi-preview">
                {liveBMI > 0 ? (
                  <>
                    <strong>{liveBMI}</strong>
                    <span className="badge">{getBMICategory(liveBMI)}</span>
                  </>
                ) : (
                  <span className="muted">Kilo ve boy girin</span>
                )}
              </div>
            </div>
          </div>
          <div className="form-full">
            <label className="label" htmlFor="m-notes">Notlar</label>
            <textarea id="m-notes" className="input" rows={3} placeholder="Seans notu (opsiyonel)" value={values.notes} onChange={setField("notes")} />
            {touched && errors.notes ? <p className="field-error">{errors.notes}</p> : null}
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Vazgeç
            </button>
            <button type="submit" className="btn btn-primary">
              Ölçümü Kaydet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const MeasurementsTab: React.FC<{ patient: Patient }> = ({ patient }) => {
  const [measurements, setMeasurements] = React.useState<Measurement[]>(() =>
    getInitialMeasurements(patient.id)
  );
  const [showModal, setShowModal] = React.useState(false);

  React.useEffect(() => {
    setMeasurements(getInitialMeasurements(patient.id));
    setShowModal(false);
  }, [patient.id]);

  const sorted = React.useMemo(
    () => [...measurements].sort((a, b) => a.date.localeCompare(b.date)),
    [measurements]
  );
  const latest = sorted.length > 0 ? sorted[sorted.length - 1] : undefined;
  const previous = sorted.length > 1 ? sorted[sorted.length - 2] : undefined;
  const latestBMI = latest ? calculateBMI(latest.weightKg, latest.heightCm) : 0;
  const latestCategory = latestBMI ? getBMICategory(latestBMI) : null;

  const handleAdd = React.useCallback((measurement: Measurement) => {
    setMeasurements((prev) =>
      [...prev, measurement].sort((a, b) => a.date.localeCompare(b.date))
    );
  }, []);

  return (
    <div className="measurements">
      <div className="card measurements-summary">
        <div>
          <h3>Ölçüm ve Gelişim Takibi</h3>
          <p className="muted">
            {sorted.length > 0
              ? `Toplam ${sorted.length} ölçüm · Son ölçüm: ${latest?.date}`
              : "Henüz ölçüm girilmedi."}
          </p>
        </div>
        <div className="measurements-summary-side">
          {latest ? (
            <div className="bmi-badge">
              <span className="muted">VKİ</span>
              <strong>{latestBMI}</strong>
              {latestCategory ? <span className="badge">{latestCategory}</span> : null}
            </div>
          ) : null}
          <button className="btn btn-primary btn-small" onClick={() => setShowModal(true)}>
            + Yeni Ölçüm
          </button>
        </div>
      </div>

      <MeasurementDeltaCard current={latest} previous={previous} />
      <MeasurementChart measurements={sorted} />

      <div className="card">
        <h3>Ölçüm Geçmişi</h3>
        {sorted.length === 0 ? (
          <p className="muted">Kayıtlı ölçüm yok.</p>
        ) : (
          <div className="table-scroll">
            <table className="measurement-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Kilo</th>
                  <th>Boy</th>
                  <th>VKİ</th>
                  <th>Yağ %</th>
                  <th>Kas</th>
                  <th>Bel</th>
                  <th>Kalça</th>
                  <th>Not</th>
                </tr>
              </thead>
              <tbody>
                {[...sorted].reverse().map((m) => {
                  const bmi = calculateBMI(m.weightKg, m.heightCm);
                  return (
                    <tr key={m.id}>
                      <td className="value-strong">{m.date}</td>
                      <td>{m.weightKg.toFixed(1)} kg</td>
                      <td>{m.heightCm} cm</td>
                      <td>
                        {bmi} <span className="muted">({getBMICategory(bmi)})</span>
                      </td>
                      <td>%{m.bodyFatPercentage.toFixed(1)}</td>
                      <td>{m.muscleMassKg.toFixed(1)} kg</td>
                      <td>{m.waistCm} cm</td>
                      <td>{m.hipCm} cm</td>
                      <td className="muted">{m.notes || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal ? (
        <MeasurementEntryModal
          initialHeight={latest?.heightCm}
          onClose={() => setShowModal(false)}
          onSubmit={handleAdd}
        />
      ) : null}
    </div>
  );
};

type DrawerTab = "ozet" | "plan" | "olcum" | "bildirim";

const DRAWER_TABS: Array<{ key: DrawerTab; label: string; icon: React.ReactNode }> = [
  { key: "ozet", label: "Özet", icon: <ClipboardList size={15} /> },
  { key: "plan", label: "14 Günlük Plan", icon: <UtensilsCrossed size={15} /> },
  { key: "olcum", label: "Ölçüm & Değerler", icon: <Scale size={15} /> },
  { key: "bildirim", label: "Bildirimler & Notlar", icon: <Bell size={15} /> }
];

const PatientDetailDrawer: React.FC<{
  patient: Patient | null;
  onClose: () => void;
}> = ({ patient, onClose }) => {
  const [drawerTab, setDrawerTab] = React.useState<DrawerTab>("ozet");
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    setDrawerTab("ozet");
  }, [patient?.id]);

  React.useEffect(() => {
    if (patient) {
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }
    setVisible(false);
    return undefined;
  }, [patient]);

  React.useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  if (!patient) {
    return null;
  }

  return (
    <div className="drawer" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className={classNames("drawer-panel", visible && "drawer-panel-visible")}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="drawer-header">
          <div className="drawer-identity">
            <span className="avatar avatar-emerald avatar-lg">{patient.name.charAt(0)}</span>
            <div>
              <p className="muted drawer-subtitle">Hasta Detay</p>
              <h2 className="drawer-title">
                {patient.name}
                <span className="drawer-title-secondary"> · {patient.plan}</span>
              </h2>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Kapat">
            <X size={18} />
          </button>
        </div>

        <div className="drawer-tabs" role="tablist" aria-label="Hasta detay sekmeleri">
          {DRAWER_TABS.map((item) => (
            <button
              key={item.key}
              role="tab"
              aria-selected={drawerTab === item.key}
              className={drawerTab === item.key ? "active" : undefined}
              onClick={() => setDrawerTab(item.key)}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>

        <div className="drawer-body">
          {drawerTab === "ozet" ? <DrawerSummary patient={patient} /> : null}
          {drawerTab === "plan" ? <DrawerPlanTab patient={patient} /> : null}
          {drawerTab === "olcum" ? <MeasurementsTab patient={patient} /> : null}
          {drawerTab === "bildirim" ? <DrawerNotificationsTab patient={patient} /> : null}
        </div>
      </div>
    </div>
  );
};

type PlanItem = {
  id: string;
  label: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

const DEFAULT_PLAN_ITEMS: PlanItem[] = [
  { id: "k", label: "Kahvaltı: 1 haşlanmış yumurta + 2 dilim tam buğday + domates-salatalık", calories: 350, proteinG: 22, carbsG: 32, fatG: 14 },
  { id: "a1", label: "Ara 1: 1 fincan sade kahve + 1 küçük elma", calories: 120, proteinG: 3, carbsG: 24, fatG: 2 },
  { id: "o", label: "Öğle: 1 kase mevsim salata + 1 dilim tam buğday + 100 g ızgara tavuk", calories: 450, proteinG: 32, carbsG: 42, fatG: 15 },
  { id: "a2", label: "Ara 2: 6 adet badem + 1 bardak ayran", calories: 180, proteinG: 8, carbsG: 10, fatG: 12 },
  { id: "a", label: "Akşam: Izgara tavuk (120 g) + bol salata + 1 tatlı kaşığı zeytinyağı", calories: 500, proteinG: 40, carbsG: 20, fatG: 22 }
];

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const buildDietPrintHtml = (opts: {
  dietitian: string;
  patient: string;
  templateName: string;
  date: string;
  notes: string;
  bmr: number;
  tdee: number;
  targetCalories: number;
  macros: MacroSplit;
  macroGrams: { carbsG: number; proteinG: number; fatG: number };
  items: PlanItem[];
  totals: { calories: number; proteinG: number; carbsG: number; fatG: number };
}): string => {
  const rows = opts.items
    .map(
      (item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(item.label)}</td>
        <td>${item.calories}</td>
        <td>${item.proteinG} g</td>
        <td>${item.carbsG} g</td>
        <td>${item.fatG} g</td>
      </tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(opts.templateName)} - ${escapeHtml(opts.patient)}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 40px; }
  .brand { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #059669; padding-bottom: 12px; }
  .brand h1 { margin: 0; font-size: 22px; color: #059669; }
  .brand small { color: #64748b; }
  .meta { display: flex; gap: 24px; margin: 16px 0; font-size: 13px; }
  .meta strong { display: block; font-size: 11px; color: #64748b; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 12px; }
  th { background: #ecfdf5; color: #065f46; text-align: left; padding: 8px; border: 1px solid #a7f3d0; }
  td { padding: 8px; border: 1px solid #e2e8f0; }
  .totals td { font-weight: bold; background: #f8fafc; }
  .targets { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; font-size: 13px; margin-top: 12px; }
  .notes { margin-top: 16px; font-size: 13px; }
  footer { margin-top: 28px; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  @media print { body { margin: 12mm; } }
</style>
</head>
<body>
  <div class="brand">
    <div><h1>NutriCare</h1><small>Diyetisyen Paneli · Kişisel Diyet Programı</small></div>
    <div><small>${escapeHtml(opts.date)}</small></div>
  </div>
  <div class="meta">
    <div><strong>Diyetisyen</strong>${escapeHtml(opts.dietitian)}</div>
    <div><strong>Danışan</strong>${escapeHtml(opts.patient)}</div>
    <div><strong>Program</strong>${escapeHtml(opts.templateName)}</div>
  </div>
  <div class="targets">
    Hedef: <strong>${opts.targetCalories} kcal/gün</strong> (BMR ${opts.bmr} · TDEE ${opts.tdee}) ·
    Karbonhidrat %${opts.macros.carbsPct} (${opts.macroGrams.carbsG} g) ·
    Protein %${opts.macros.proteinPct} (${opts.macroGrams.proteinG} g) ·
    Yağ %${opts.macros.fatPct} (${opts.macroGrams.fatG} g)
  </div>
  <table>
    <thead><tr><th>#</th><th>Öğün</th><th>Kalori (kcal)</th><th>Protein</th><th>Karb.</th><th>Yağ</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr class="totals"><td></td><td>Toplam</td><td>${opts.totals.calories} kcal</td><td>${opts.totals.proteinG} g</td><td>${opts.totals.carbsG} g</td><td>${opts.totals.fatG} g</td></tr></tfoot>
  </table>
  ${opts.notes ? `<div class="notes"><strong>Notlar:</strong> ${escapeHtml(opts.notes)}</div>` : ""}
  <footer>Bu liste bilgilendirme amaçlıdır · ${escapeHtml(opts.dietitian)} · NutriCare</footer>
</body>
</html>`;
};

const TargetBar: React.FC<{
  icon: React.ReactNode;
  label: string;
  planned: number;
  target: number;
  unit: string;
}> = ({ icon, label, planned, target, unit }) => {
  const pct = target > 0 ? Math.min(100, Math.round((planned / target) * 100)) : 0;
  const diff = Math.round((planned - target) * 10) / 10;
  const inRange = target > 0 && Math.abs(planned - target) <= target * 0.1;
  return (
    <div className="target-bar">
      <div className="target-bar-head">
        <span className="target-bar-label">
          {icon} {label}
        </span>
        <span className="target-bar-values">
          <strong>{planned}</strong> / {target} {unit}
        </span>
      </div>
      <div className="target-track">
        <span
          className={inRange ? "target-fill target-fill-good" : "target-fill"}
          style={{ width: `${pct}%` }}
        />
      </div>
      <small className={diff <= 0 ? "muted" : "text-bad"}>
        {diff === 0 ? "Hedef tutturuldu" : diff < 0 ? `${Math.abs(diff)} ${unit} eksik` : `${diff} ${unit} fazla`}
        {` · %${pct}`}
      </small>
    </div>
  );
};

const DnDPlanEditor: React.FC = () => {
  const [items, setItems] = React.useState<PlanItem[]>(DEFAULT_PLAN_ITEMS);
  const [repeat, setRepeat] = React.useState({ every: 14, unit: "day" });
  const [templateName, setTemplateName] = React.useState("2 Haftalık Fit Plan");
  const [dietitian, setDietitian] = React.useState("Uzm. Dyt. NutriCare");
  const [patientId, setPatientId] = React.useState<number>(PATIENTS[0]?.id ?? 1);
  const [notes, setNotes] = React.useState("Bol su tüketin (günde en az 2 lt). Öğün saatlerine uymaya özen gösterin.");

  const [profile, setProfile] = React.useState<BmrInput>({ weightKg: 70, heightCm: 170, age: 35, sex: "kadin" });
  const [activity, setActivity] = React.useState<ActivityLevel>("orta");
  const [goal, setGoal] = React.useState<WeightGoal>("verme");
  const [macros, setMacros] = React.useState<MacroSplit>(GOAL_ADJUSTMENTS.verme.macros);

  const targets = React.useMemo(
    () => calculateTargets(profile, activity, goal, macros),
    [profile, activity, goal, macros]
  );

  const totals = React.useMemo(
    () =>
      items.reduce(
        (acc, item) => ({
          calories: acc.calories + (Number(item.calories) || 0),
          proteinG: Math.round((acc.proteinG + (Number(item.proteinG) || 0)) * 10) / 10,
          carbsG: Math.round((acc.carbsG + (Number(item.carbsG) || 0)) * 10) / 10,
          fatG: Math.round((acc.fatG + (Number(item.fatG) || 0)) * 10) / 10
        }),
        { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
      ),
    [items]
  );

  const macroSum = macros.carbsPct + macros.proteinPct + macros.fatPct;

  const handleGoalChange = (next: WeightGoal) => {
    setGoal(next);
    setMacros({ ...GOAL_ADJUSTMENTS[next].macros });
  };

  const updateItem = (id: string, patch: Partial<PlanItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { id: `yeni-${Date.now()}`, label: "Yeni öğün: açıklamayı yazın", calories: 200, proteinG: 10, carbsG: 20, fatG: 8 }
    ]);
  };

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

  const handlePdfExport = () => {
    const patient = PATIENTS.find((p) => p.id === patientId);
    const html = buildDietPrintHtml({
      dietitian: dietitian.trim() || "Uzm. Diyetisyen",
      patient: patient?.name ?? "Danışan",
      templateName: templateName.trim() || "Diyet Programı",
      date: new Date().toLocaleDateString("tr-TR"),
      notes: notes.trim(),
      bmr: targets.bmr,
      tdee: targets.tdee,
      targetCalories: targets.targetCalories,
      macros,
      macroGrams: { carbsG: targets.carbsG, proteinG: targets.proteinG, fatG: targets.fatG },
      items,
      totals
    });
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) {
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    window.setTimeout(() => win.print(), 400);
  };

  const setProfileField = (key: keyof BmrInput) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const raw = event.target.value;
    setProfile((prev) => ({
      ...prev,
      [key]: key === "sex" ? (raw as Sex) : Math.max(0, Number(raw) || 0)
    }));
  };

  return (
    <div className="planner-stack">
      <div className="card">
        <div className="card-head">
          <h3>
            <Calculator size={15} /> BMR & Hedef Kalori Hesaplayıcı
          </h3>
          <span className="badge badge-emerald">Mifflin-St Jeor</span>
        </div>
        <div className="calc-grid">
          <div>
            <label className="label">Kilo (kg)</label>
            <input type="number" min={30} max={300} className="input" value={profile.weightKg || ""} onChange={setProfileField("weightKg")} />
          </div>
          <div>
            <label className="label">Boy (cm)</label>
            <input type="number" min={100} max={250} className="input" value={profile.heightCm || ""} onChange={setProfileField("heightCm")} />
          </div>
          <div>
            <label className="label">Yaş</label>
            <input type="number" min={10} max={100} className="input" value={profile.age || ""} onChange={setProfileField("age")} />
          </div>
          <div>
            <label className="label">Cinsiyet</label>
            <select className="input" value={profile.sex} onChange={setProfileField("sex")}>
              <option value="kadin">Kadın</option>
              <option value="erkek">Erkek</option>
            </select>
          </div>
          <div>
            <label className="label">Aktivite</label>
            <select className="input" value={activity} onChange={(event) => setActivity(event.target.value as ActivityLevel)}>
              {(Object.keys(ACTIVITY_FACTORS) as ActivityLevel[]).map((key) => (
                <option key={key} value={key}>
                  {ACTIVITY_FACTORS[key].label} × {ACTIVITY_FACTORS[key].factor}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Hedef</label>
            <select
              className="input"
              value={goal}
              onChange={(event) => handleGoalChange(event.target.value as WeightGoal)}
            >
              <option value="verme">Kilo verme (−500 kcal)</option>
              <option value="koruma">Koruma (±0 kcal)</option>
              <option value="alma">Kilo alma (+300 kcal)</option>
            </select>
          </div>
        </div>
        <div className="calc-results">
          <div className="calc-chip">
            <span className="muted">BMR</span>
            <strong>{targets.bmr} kcal</strong>
          </div>
          <div className="calc-chip">
            <span className="muted">TDEE</span>
            <strong>{targets.tdee} kcal</strong>
          </div>
          <div className="calc-chip calc-chip-primary">
            <span className="muted">Günlük Hedef</span>
            <strong>{targets.targetCalories} kcal</strong>
          </div>
          <div className="macro-edit">
            <div>
              <label className="label">Karb %</label>
              <input type="number" min={0} max={100} className="input" value={macros.carbsPct} onChange={(event) => setMacros((prev) => ({ ...prev, carbsPct: Number(event.target.value) || 0 }))} />
            </div>
            <div>
              <label className="label">Protein %</label>
              <input type="number" min={0} max={100} className="input" value={macros.proteinPct} onChange={(event) => setMacros((prev) => ({ ...prev, proteinPct: Number(event.target.value) || 0 }))} />
            </div>
            <div>
              <label className="label">Yağ %</label>
              <input type="number" min={0} max={100} className="input" value={macros.fatPct} onChange={(event) => setMacros((prev) => ({ ...prev, fatPct: Number(event.target.value) || 0 }))} />
            </div>
          </div>
        </div>
        {macroSum !== 100 ? (
          <p className="field-error">Makro yüzdeleri toplamı %{macroSum} — hedef %{100} olmalı, gramlar oransal hesaplanır.</p>
        ) : (
          <p className="muted muted-spaced">
            Hedef dağılım: {targets.carbsG} g karbonhidrat · {targets.proteinG} g protein · {targets.fatG} g yağ
          </p>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h3>
            <Flame size={15} /> Günlük Özet — Planlanan / Hedef
          </h3>
          <span className="muted">{totals.calories} / {targets.targetCalories} kcal</span>
        </div>
        <div className="target-grid">
          <TargetBar icon={<Flame size={14} />} label="Kalori" planned={totals.calories} target={targets.targetCalories} unit="kcal" />
          <TargetBar icon={<Beef size={14} />} label="Protein" planned={totals.proteinG} target={targets.proteinG} unit="g" />
          <TargetBar icon={<Wheat size={14} />} label="Karbonhidrat" planned={totals.carbsG} target={targets.carbsG} unit="g" />
          <TargetBar icon={<Droplet size={14} />} label="Yağ" planned={totals.fatG} target={targets.fatG} unit="g" />
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>
            <ChefHat size={15} /> Öğün Oluşturucu (Sürükle-Bırak)
          </h3>
          <button className="btn btn-outline btn-small" onClick={addItem}>
            <Plus size={14} /> Öğün Ekle
          </button>
        </div>
        <div className="editor-grid">
          <div className="editor-board">
            <p className="muted">Öğeleri sürükleyerek sıralamayı değiştirin, değerleri satır içinde düzenleyin.</p>
            <ul className="editor-list">
              {items.map((item, index) => (
                <li
                  key={item.id}
                  draggable
                  onDragStart={(event) => handleDragStart(event, item.id)}
                  onDrop={(event) => handleDrop(event, index)}
                  onDragOver={handleDragOver}
                  className="editor-item editor-item-meal"
                >
                  <div className="meal-row-head">
                    <span className="drag-handle">
                      <GripVertical size={14} /> {index + 1}
                    </span>
                    <button className="icon-btn icon-btn-danger" onClick={() => removeItem(item.id)} aria-label="Öğünü sil">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <input
                    className="input"
                    value={item.label}
                    onChange={(event) => updateItem(item.id, { label: event.target.value })}
                    aria-label="Öğün açıklaması"
                  />
                  <div className="meal-macros">
                    <div>
                      <label className="label">Kalori</label>
                      <input type="number" min={0} max={3000} className="input" value={item.calories} onChange={(event) => updateItem(item.id, { calories: Number(event.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className="label">Protein (g)</label>
                      <input type="number" min={0} max={300} step="0.5" className="input" value={item.proteinG} onChange={(event) => updateItem(item.id, { proteinG: Number(event.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className="label">Karb (g)</label>
                      <input type="number" min={0} max={500} step="0.5" className="input" value={item.carbsG} onChange={(event) => updateItem(item.id, { carbsG: Number(event.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className="label">Yağ (g)</label>
                      <input type="number" min={0} max={300} step="0.5" className="input" value={item.fatG} onChange={(event) => updateItem(item.id, { fatG: Number(event.target.value) || 0 })} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="editor-sidebar">
            <div>
              <label className="label">Danışan</label>
              <select className="input" value={patientId} onChange={(event) => setPatientId(Number(event.target.value))}>
                {PATIENTS.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Diyetisyen</label>
              <input className="input" value={dietitian} onChange={(event) => setDietitian(event.target.value)} />
            </div>
            <div>
              <label className="label">Şablon Adı</label>
              <input className="input" value={templateName} onChange={(event) => setTemplateName(event.target.value)} />
            </div>
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
              <label className="label">Danışan Notları</label>
              <textarea className="input" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
            </div>
            <div className="card-actions">
              <button className="btn btn-primary" onClick={handlePdfExport}>
                <Printer size={15} /> Diyet Listesini PDF İndir
              </button>
              <button className="btn btn-outline">
                <FileText size={15} /> Kaydet
              </button>
            </div>
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

const MOCK_APPOINTMENTS = [
  { id: "r1", patient: "Barış Karapelit", date: "2025-11-12", time: "10:30", type: "Kontrol / Ölçüm", status: "Onaylı" },
  { id: "r2", patient: "Elif Y.", date: "2025-11-12", time: "11:30", type: "Online Görüşme", status: "Bekliyor" },
  { id: "r3", patient: "Meriç B.", date: "2025-11-13", time: "14:00", type: "Plan Revizyonu", status: "Onaylı" },
  { id: "r4", patient: "Elif Y.", date: "2025-11-15", time: "09:30", type: "Kontrol / Ölçüm", status: "Bekliyor" }
];

const MOCK_NOTIFICATIONS = [
  { id: "n1", title: "Uyum uyarısı", detail: "Meriç B. uyumu %54'e düştü.", time: "10 dk önce", tone: "rose" },
  { id: "n2", title: "Öğün atlandı", detail: "Barış Karapelit akşam öğününü işaretlemedi.", time: "1 sa önce", tone: "amber" },
  { id: "n3", title: "Plan bitişi", detail: "Glütensiz 14G planı 2 gün içinde bitiyor.", time: "3 sa önce", tone: "slate" }
];

const NAV_ITEMS: Array<{ key: AppTab; label: string; icon: React.ReactNode }> = [
  { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
  { key: "patients", label: "Hastalar", icon: <Users size={18} /> },
  { key: "plans", label: "Diyet Planları", icon: <Salad size={18} /> },
  { key: "appointments", label: "Randevular", icon: <CalendarDays size={18} /> },
  { key: "alerts", label: "Uyarılar", icon: <Bell size={18} /> },
  { key: "settings", label: "Ayarlar", icon: <Settings size={18} /> }
];

const Sidebar: React.FC<{
  tab: AppTab;
  onNavigate: (tab: AppTab) => void;
  collapsed: boolean;
  onToggle: () => void;
  riskCount: number;
}> = ({ tab, onNavigate, collapsed, onToggle, riskCount }) => (
  <aside className={classNames("sidebar", collapsed && "sidebar-collapsed")}>
    <div className="sidebar-brand">
      <span className="sidebar-logo">
        <Leaf size={20} />
      </span>
      {!collapsed && (
        <span className="sidebar-brand-text">
          <strong>NutriCare</strong>
          <small>Diyetisyen Paneli</small>
        </span>
      )}
      <button className="icon-btn sidebar-toggle" onClick={onToggle} aria-label="Menüyü daralt/genişlet">
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </div>
    <nav className="sidebar-nav">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.key}
          className={classNames("sidebar-item", tab === item.key && "active")}
          onClick={() => onNavigate(item.key)}
          title={item.label}
        >
          <span className="sidebar-item-icon">{item.icon}</span>
          {!collapsed && <span className="sidebar-item-label">{item.label}</span>}
          {!collapsed && item.key === "patients" && riskCount > 0 && (
            <span className="count-badge">{riskCount}</span>
          )}
          {collapsed && item.key === "patients" && riskCount > 0 && (
            <span className="count-dot" />
          )}
        </button>
      ))}
    </nav>
    {!collapsed && (
      <div className="sidebar-foot">
        <div className="sidebar-wellness">
          <Activity size={16} />
          <div>
            <strong>Ortalama Uyum %76</strong>
            <small>Son 7 gün · stabil</small>
          </div>
        </div>
      </div>
    )}
  </aside>
);

const TopHeader: React.FC<{
  query: string;
  onQuery: (value: string) => void;
  user: string | null;
  remainingSec: number;
  onExtend: () => void;
  onLogout: () => void;
  onMenuToggle: () => void;
}> = ({ query, onQuery, user, remainingSec, onExtend, onLogout, onMenuToggle }) => {
  const [showNotifications, setShowNotifications] = React.useState(false);
  const [showProfile, setShowProfile] = React.useState(false);
  const headerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
        setShowProfile(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <header className="topheader" ref={headerRef}>
      <button className="icon-btn menu-btn" onClick={onMenuToggle} aria-label="Menü">
        <Menu size={18} />
      </button>
      <div className="search">
        <Search size={16} className="search-icon" />
        <input placeholder="Hasta ara..." value={query} onChange={(event) => onQuery(event.target.value)} />
      </div>
      <div className="spacer" />
      <span className="session-chip">
        <Timer size={14} />
        {formatMMSS(remainingSec)}
      </span>
      <div className="popover-wrap">
        <button
          className="icon-btn"
          onClick={() => {
            setShowNotifications((prev) => !prev);
            setShowProfile(false);
          }}
          aria-label="Bildirimler"
        >
          <Bell size={18} />
          <span className="ping-dot" />
        </button>
        {showNotifications ? (
          <div className="popover">
            <div className="popover-head">
              <strong>Bildirimler</strong>
              <span className="muted">{MOCK_NOTIFICATIONS.length} yeni</span>
            </div>
            <ul className="popover-list">
              {MOCK_NOTIFICATIONS.map((n) => (
                <li key={n.id} className="popover-item">
                  <span className={classNames("tone-dot", `tone-${n.tone}`)} />
                  <div>
                    <strong>{n.title}</strong>
                    <p className="muted">{n.detail}</p>
                    <small className="muted">{n.time}</small>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <div className="popover-wrap">
        <button
          className="profile-btn"
          onClick={() => {
            setShowProfile((prev) => !prev);
            setShowNotifications(false);
          }}
        >
          <span className="avatar avatar-emerald">
            {(user ?? "D").charAt(0).toUpperCase()}
          </span>
          <span className="profile-meta">
            <strong>{user ?? "Diyetisyen"}</strong>
            <small>Uzman Diyetisyen</small>
          </span>
        </button>
        {showProfile ? (
          <div className="popover popover-right">
            <div className="popover-head">
              <span className="avatar avatar-emerald">{(user ?? "D").charAt(0).toUpperCase()}</span>
              <div>
                <strong>{user ?? "Diyetisyen"}</strong>
                <p className="muted">Uzman Diyetisyen</p>
              </div>
            </div>
            <div className="popover-actions">
              <button className="btn btn-outline btn-small" onClick={onExtend}>
                <Clock size={14} /> Oturumu Uzat
              </button>
              <button className="btn btn-outline btn-small" onClick={onLogout}>
                <LogOut size={14} /> Çıkış
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
};

const AppointmentsView: React.FC = () => (
  <div className="card">
    <div className="card-head">
      <h3>
        <CalendarDays size={16} /> Yaklaşan Randevular
      </h3>
      <button className="btn btn-primary btn-small">+ Yeni Randevu</button>
    </div>
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Hasta</th>
            <th>Tarih</th>
            <th>Saat</th>
            <th>Tür</th>
            <th>Durum</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {MOCK_APPOINTMENTS.map((appt) => (
            <tr key={appt.id}>
              <td style={{ fontWeight: 600 }}>{appt.patient}</td>
              <td>{appt.date}</td>
              <td>{appt.time}</td>
              <td>{appt.type}</td>
              <td>
                <span className={classNames("badge", appt.status === "Onaylı" ? "badge-emerald" : "badge-amber")}>
                  {appt.status}
                </span>
              </td>
              <td style={{ textAlign: "right" }}>
                <button className="btn btn-outline btn-small">Düzenle</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const DrawerSummary: React.FC<{ patient: Patient }> = ({ patient }) => {
  const measurements = React.useMemo(() => getInitialMeasurements(patient.id), [patient.id]);
  const latest = measurements.length > 0 ? measurements[measurements.length - 1] : undefined;
  const previous = measurements.length > 1 ? measurements[measurements.length - 2] : undefined;
  const bmi = latest ? calculateBMI(latest.weightKg, latest.heightCm) : 0;

  return (
    <div className="drawer-stack">
      <div className="card patient-hero">
        <span className="avatar avatar-lg">{patient.name.charAt(0)}</span>
        <div>
          <h3 className="patient-hero-name">{patient.name}</h3>
          <p className="muted">{patient.plan} · {patient.startDate} → {patient.endDate}</p>
          <div className="hero-badges">
            <StatusBadge status={patient.status} />
            {bmi > 0 ? <span className="badge badge-slate">VKİ {bmi} · {getBMICategory(bmi)}</span> : null}
          </div>
        </div>
        <div className="hero-compliance">
          <span className="muted">Uyum</span>
          <strong>%{patient.compliance}</strong>
          <Progress value={patient.compliance} />
        </div>
      </div>
      <div className="grid grid-3">
        <div className="card mini-stat">
          <span className="stat-icon stat-emerald"><Scale size={16} /></span>
          <small className="muted">Son Kilo</small>
          <strong>{latest ? `${latest.weightKg.toFixed(1)} kg` : "—"}</strong>
          {latest && previous ? (
            <small className={latest.weightKg <= previous.weightKg ? "text-good" : "text-bad"}>
              {formatDelta(latest.weightKg, previous.weightKg, "kg")}
            </small>
          ) : null}
        </div>
        <div className="card mini-stat">
          <span className="stat-icon stat-mint"><Activity size={16} /></span>
          <small className="muted">Yağ Oranı</small>
          <strong>{latest ? `%${latest.bodyFatPercentage.toFixed(1)}` : "—"}</strong>
          {latest && previous ? (
            <small className={latest.bodyFatPercentage <= previous.bodyFatPercentage ? "text-good" : "text-bad"}>
              {formatDelta(latest.bodyFatPercentage, previous.bodyFatPercentage, "%")}
            </small>
          ) : null}
        </div>
        <div className="card mini-stat">
          <span className="stat-icon stat-amber"><Ruler size={16} /></span>
          <small className="muted">Bel / Kalça</small>
          <strong>{latest ? `${latest.waistCm} / ${latest.hipCm} cm` : "—"}</strong>
          <small className="muted">{latest ? latest.date : "ölçüm yok"}</small>
        </div>
      </div>
      <div className="card">
        <h3><ClipboardList size={15} /> Son İşlem</h3>
        <p className="muted">{patient.lastAction} · {measurements.length} ölçüm kaydı</p>
      </div>
    </div>
  );
};

const DrawerPlanTab: React.FC<{ patient: Patient }> = ({ patient }) => (
  <div className="drawer-stack">
    <div className="card">
      <h3><UtensilsCrossed size={15} /> 14 Günlük Çizelge</h3>
      <MealGrid />
    </div>
    <div className="card">
      <h3><ChefHat size={15} /> Plan Atama</h3>
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
                  {meal} <CheckCircle2 size={12} className="text-good" />
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const DrawerNotificationsTab: React.FC<{ patient: Patient }> = ({ patient }) => {
  const [notes, setNotes] = React.useState(
    `${patient.name} için seans notu: uyum takibi ve ölçüm hedefleri gözden geçirildi.`
  );
  const [saved, setSaved] = React.useState(false);

  return (
    <div className="drawer-stack">
      <div className="card">
        <h3><Bell size={15} /> Bildirim Saatleri</h3>
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
        <h3><StickyNote size={15} /> Diyetisyen Notları</h3>
        <textarea
          className="input"
          rows={4}
          value={notes}
          onChange={(event) => {
            setNotes(event.target.value);
            setSaved(false);
          }}
        />
        <div className="card-actions card-actions-spaced">
          <span className="muted">{saved ? "Kaydedildi." : "Taslak düzenleniyor..."}</span>
          <button className="btn btn-primary btn-small" onClick={() => setSaved(true)}>
            Notu Kaydet
          </button>
        </div>
      </div>
      <div className="card">
        <h3>Uyarı Geçmişi</h3>
        <ul className="scenario-list">
          <li><span>Uyum %60 altına düştü → e-posta gönderildi</span><span className="badge badge-amber">Takipte</span></li>
          <li><span>48 saatte 3 öğün kaçtı → push bildirimi</span><span className="badge badge-emerald">Çözüldü</span></li>
        </ul>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [query, setQuery] = React.useState("");
  const [tab, setTab] = React.useState<AppTab>(
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

  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const riskCount = React.useMemo(() => PATIENTS.filter((p) => p.status === "Risk").length, []);

  if (!isAuthed) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const pageTitles: Record<AppTab, { title: string; desc: string }> = {
    dashboard: { title: "Dashboard", desc: "Uyum, öğünler ve hasta özeti" },
    patients: { title: "Hastalar", desc: "Tüm danışanlar ve uyum durumları" },
    plans: { title: "Diyet Planları", desc: "Şablonları sürükle-bırak ile düzenleyin" },
    appointments: { title: "Randevular", desc: "Kontrol ve görüşme takvimi" },
    alerts: { title: "Uyarılar", desc: "Eşikler, sessize alma ve otomasyon" },
    settings: { title: "Ayarlar", desc: "Varsayılan bildirim ve eşik ayarları" }
  };

  return (
    <div className="layout app-shell">
      <Sidebar
        tab={tab}
        onNavigate={(next) => {
          setTab(next);
          setMobileNavOpen(false);
        }}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((prev) => !prev)}
        riskCount={riskCount}
      />
      {mobileNavOpen ? <div className="sidebar-scrim" onClick={() => setMobileNavOpen(false)} /> : null}

      <div className="main-column">
        <TopHeader
          query={query}
          onQuery={setQuery}
          user={auth.user}
          remainingSec={remainingSec}
          onExtend={() => extendSession(15)}
          onLogout={handleLogout}
          onMenuToggle={() => {
            if (window.innerWidth < 960) {
              setMobileNavOpen((prev) => !prev);
            } else {
              setSidebarCollapsed((prev) => !prev);
            }
          }}
        />

        <main className="content">
          <div className="page-head">
            <div>
              <h1>{pageTitles[tab].title}</h1>
              <p className="muted">{pageTitles[tab].desc}</p>
            </div>
            {tab === "patients" ? (
              <span className="badge badge-rose"><TrendingDown size={12} /> {riskCount} riskli hasta</span>
            ) : null}
          </div>

          {tab === "dashboard" && (
            <section className="tab-panel">
              <div className="grid grid-md-4">
                <StatCard title="Toplam Hasta" value="48" subtitle="Bu ay +6" tone="emerald" icon={<Users size={18} />} />
                <StatCard title="Ortalama Uyum" value="%76" subtitle="Son 7 gün" tone="mint" icon={<CheckCircle2 size={18} />} />
                <StatCard title="Devam Eden Plan" value="23" subtitle="14 günlük" tone="slate" icon={<Clock size={18} />} />
                <StatCard title="Bugün Tamamlanan" value="112" subtitle="Öğün" tone="amber" icon={<CalendarDays size={18} />} />
              </div>

              <div className="grid grid-lg-5 dashboard-charts">
                <div className="card chart-card span-3">
                  <div className="card-head">
                    <h3><Activity size={15} /> 7 Günlük Uyum Yüzdesi</h3>
                    <span className="badge badge-emerald"><TrendingUp size={12} /> +%8</span>
                  </div>
                  <div className="chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={ADHERENCE_SERIES}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="value" stroke="#059669" strokeWidth={2.5} dot={{ r: 3, fill: "#059669" }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="card chart-card span-2">
                  <div className="card-head">
                    <h3><UtensilsCrossed size={15} /> Öğün Tamamlama Dağılımı</h3>
                  </div>
                  <div className="chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={MEAL_COMPLETION}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-12} dy={8} height={52} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="done" fill="#10b981" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-head">
                  <h3>Hızlı Hasta Görünümü</h3>
                  <span className="muted">{filteredPatients.length} kayıt</span>
                </div>
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

          {tab === "appointments" && (
            <section className="tab-panel">
              <AppointmentsView />
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
                <div className="card-head">
                  <h3><Settings size={15} /> Genel Ayarlar</h3>
                </div>
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

        <footer className="app-footer">© {new Date().getFullYear()} NutriCare · Diyetisyen Paneli</footer>

        {showDetail ? <PatientDetailDrawer patient={selectedPatient} onClose={closeDetail} /> : null}
      </div>
    </div>
  );
};

if (typeof window !== "undefined") {
  try {
    console.assert(LESS_THAN_SIXTY === "<60", "LESS_THAN_SIXTY sabiti beklenen değerde değil");
    console.assert(formatMMSS(61) === "01:01", "formatMMSS(61) => 01:01 olmalı");
    console.assert(formatMMSS(0) === "00:00", "formatMMSS(0) => 00:00 olmalı");
    console.assert(formatMMSS(3599) === "59:59", "formatMMSS(3599) => 59:59 olmalı");
    console.assert(calculateBMI(83.8, 178) === 26.4, "calculateBMI(83.8,178) => 26.4 olmalı");
    console.assert(getBMICategory(17.3) === "Zayıf", "17.3 => Zayıf olmalı");
    console.assert(getBMICategory(23.6) === "Normal", "23.6 => Normal olmalı");
    console.assert(getBMICategory(26.4) === "Fazla Kilolu", "26.4 => Fazla Kilolu olmalı");
    console.assert(getBMICategory(32.1) === "Obez", "32.1 => Obez olmalı");
    console.assert(calculateBMR({ weightKg: 70, heightCm: 170, age: 30, sex: "erkek" }) === 1618, "BMR erkek 70/170/30 => 1618 olmalı");
    console.assert(calculateBMR({ weightKg: 70, heightCm: 170, age: 30, sex: "kadin" }) === 1452, "BMR kadın 70/170/30 => 1452 olmalı");
    console.assert(
      calculateTargets({ weightKg: 70, heightCm: 170, age: 30, sex: "erkek" }, "orta", "koruma", { carbsPct: 50, proteinPct: 20, fatPct: 30 }).targetCalories === 2508,
      "TDEE 1618x1.55 koruma => 2508 olmalı"
    );
  } catch (error) {
    // no-op
  }
}

export default App;

