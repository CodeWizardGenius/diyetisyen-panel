import React from "react";
import { Download, FileJson, FileSpreadsheet, Monitor, Moon, ShieldCheck, Sun, Upload, Eye, EyeOff } from "lucide-react";
import type {
  MeasurementLike,
  SettingsPatient
} from "../../../types/settings";
import { useTheme, type ThemeMode } from "../../../context/ThemeContext";
import { Field, SectionCard } from "../ui";
import { classNames } from "../classNames";
import { z } from "zod";
import type { ExportAuditLog } from "../../../schemas";
import { useToast } from "../../ui/toast";
import { verifyPassword } from "../../../utils/crypto";

export interface ImportResult {
  ok: boolean;
  message: string;
}

interface Props {
  sessionTimeoutMin: number;
  onSessionTimeoutChange: (minutes: number) => void;
  sessionTimeoutError?: string;
  patients: SettingsPatient[];
  getMeasurements: (patientId: number) => MeasurementLike[];
  dietitianName: string;
  /** Yedek JSON'ı uygular; sonucu (başarı/mesaj) döndürür. */
  onImportData: (raw: unknown) => ImportResult;
}

const THEME_OPTIONS: Array<{ value: ThemeMode; label: string; icon: React.ReactNode }> = [
  { value: "light", label: "Açık", icon: <Sun size={15} /> },
  { value: "dark", label: "Koyu", icon: <Moon size={15} /> },
  { value: "system", label: "Sistem", icon: <Monitor size={15} /> }
];

const EXPORT_AUDIT_KEY = "dp_export_audit_log";

const readAuditLog = (): ExportAuditLog[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(EXPORT_AUDIT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeAuditLog = (logs: ExportAuditLog[]): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(EXPORT_AUDIT_KEY, JSON.stringify(logs.slice(-100)));
  } catch {
    // yoksay
  }
};

const downloadFile = (filename: string, content: string, mime: string): void => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

const todayStamp = (): string => new Date().toISOString().slice(0, 10);

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

const csvCell = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && /^\s*[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const csvRow = (values: unknown[]): string => values.map(csvCell).join(";");

const ImportPayloadSchema = z.object({
  exportedAt: z.string().datetime().optional(),
  exportedBy: z.string().optional(),
  patients: z.array(z.object({
    id: z.number().int().positive(),
    name: z.string().min(1).max(100),
    plan: z.string().min(1).max(100),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    compliance: z.number().int().min(0).max(100),
    lastAction: z.string().min(1),
    status: z.enum(["Aktif", "Risk"]),
    package: z.object({
      name: z.string().min(1).max(100),
      sessionsTotal: z.number().int().positive().max(1000),
      sessionsLeft: z.number().int().nonnegative().max(1000),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).optional(),
    measurements: z.array(z.object({
      id: z.string().min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      weightKg: z.number().min(20).max(400).optional(),
      heightCm: z.number().min(50).max(250).optional(),
      bodyFatPercentage: z.number().min(0).max(100).optional(),
      muscleMassKg: z.number().min(0).max(200).optional(),
      waistCm: z.number().min(30).max(250).optional(),
      hipCm: z.number().min(30).max(250).optional(),
      notes: z.string().max(2000).optional(),
      patientId: z.number().int().positive().optional(),
      patientName: z.string().optional(),
    })).optional(),
  }))
}).strict();

export const SecurityPanel: React.FC<Props> = ({
  sessionTimeoutMin,
  onSessionTimeoutChange,
  sessionTimeoutError,
  patients,
  getMeasurements,
  dietitianName,
  onImportData
}) => {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { showToast } = useToast();
  const [exported, setExported] = React.useState<string | null>(null);
  const [importMsg, setImportMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [showExportAuth, setShowExportAuth] = React.useState<{ type: "json" | "csv"; resolve: (pwd: string) => void } | null>(null);
  const [authPassword, setAuthPassword] = React.useState("");
  const [authError, setAuthError] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setImportMsg({ ok: false, text: "Dosya çok büyük — en fazla 5 MB'lık bir JSON yedeği seçin." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed: unknown = JSON.parse(String(reader.result));
        const validation = ImportPayloadSchema.safeParse(parsed);
        if (!validation.success) {
          const issues = validation.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
          setImportMsg({ ok: false, text: `Yedek şeması geçersiz: ${issues}` });
          return;
        }
        if (!window.confirm(
          "Yedek içe aktarılsın mı? Mevcut danışan ve ölçüm verileri bu yedekle değiştirilecek; danışanlara ait planlar, notlar, hatırlatma saatleri ve öğün çizelgeleri silinecek."
        )) {
          return;
        }
        const result = onImportData(parsed);
        setImportMsg({ ok: result.ok, text: result.message });
        if (result.ok) showToast("Yedek başarıyla içe aktarıldı", "success");
      } catch {
        setImportMsg({ ok: false, text: "Dosya okunamadı — geçerli bir JSON yedeği seçin." });
      }
    };
    reader.onerror = () => setImportMsg({ ok: false, text: "Dosya okunamadı." });
    reader.readAsText(file);
  };

  const logExport = (type: "json" | "csv", patientCount: number, measurementCount: number) => {
    const logs = readAuditLog();
    const entry: ExportAuditLog = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      dietitian: dietitianName,
      type,
      patientCount,
      measurementCount,
    };
    writeAuditLog([...logs, entry]);
  };

  const measureCounts = () => {
    let measurementCount = 0;
    patients.forEach((p) => { measurementCount += getMeasurements(p.id).length; });
    return { patientCount: patients.length, measurementCount };
  };

  const requestExportAuth = (type: "json" | "csv"): Promise<string> => {
    return new Promise((resolve) => {
      setAuthPassword("");
      setAuthError("");
      setShowExportAuth({ type, resolve });
    });
  };

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showExportAuth) return;
    const stored = localStorage.getItem("dp_auth_user_hash");
    if (!stored) {
      setAuthError("Şifre doğrulaması yapılamadı — önce giriş yapın.");
      return;
    }
    verifyPassword(authPassword, stored).then((ok) => {
      if (ok) {
        showExportAuth.resolve(authPassword);
        setShowExportAuth(null);
      } else {
        setAuthError("Şifre yanlış.");
      }
    });
  };

  const handleAuthCancel = () => {
    if (showExportAuth) {
      showExportAuth.resolve("");
      setShowExportAuth(null);
    }
  };

  const performExport = async (type: "json" | "csv") => {
    const pwd = await requestExportAuth(type);
    if (!pwd) return;
    const { patientCount, measurementCount } = measureCounts();
    if (type === "json") {
      const payload = {
        exportedAt: new Date().toISOString(),
        exportedBy: dietitianName,
        patients: patients.map((patient) => ({
          ...patient,
          measurements: getMeasurements(patient.id).map((measurement) => ({
            ...measurement,
            patientId: patient.id,
            patientName: patient.name
          }))
        }))
      };
      downloadFile(
        `danisanlar-yedek-${todayStamp()}.json`,
        JSON.stringify(payload, null, 2),
        "application/json;charset=utf-8"
      );
    } else {
      const header = "danisan_id;danisan;plan;uyum;durum;tarih;kilo_kg;boy_cm;yag_yuzde;kas_kg;bel_cm;kalca_cm;not";
      const lines = patients.flatMap((patient) => {
        const rows = getMeasurements(patient.id);
        const base = [patient.id, patient.name, patient.plan, patient.compliance, patient.status];
        if (rows.length === 0) {
          return [csvRow([...base, "", "", "", "", "", "", "", ""])];
        }
        return rows.map((m) =>
          csvRow([
            ...base,
            m.date,
            m.weightKg,
            m.heightCm,
            m.bodyFatPercentage,
            m.muscleMassKg,
            m.waistCm,
            m.hipCm,
            m.notes ?? ""
          ])
        );
      });
      downloadFile(
        `danisanlar-yedek-${todayStamp()}.csv`,
        `﻿${[header, ...lines].join("\n")}`,
        "text/csv;charset=utf-8"
      );
    }
    logExport(type, patientCount, measurementCount);
    setExported(`${type.toUpperCase()} yedeği indirildi.`);
    showToast(`${type.toUpperCase()} dışa aktarıldı (${patientCount} danışan, ${measurementCount} ölçüm)`, "success");
  };

  return (
    <>
      <SectionCard
        title="Oturum Güvenliği"
        description="Değişiklik Kaydet'e bastığınızda yeni süre mevcut oturuma da uygulanır."
        icon={<ShieldCheck size={15} />}
      >
        <Field
          label="Oturum Zaman Aşımı (dakika)"
          htmlFor="set-timeout"
          hint="Hareketsiz kalınan bu sürenin sonunda otomatik çıkış yapılır. Paylaşımlı bir bilgisayardaysanız profil menüsündeki “Paylaşımlı bilgisayardan çıkış yap” seçeneği danışan verilerini bu tarayıcıdan da siler."
          error={sessionTimeoutError}
        >
          <input
            id="set-timeout"
            type="number"
            min={5}
            max={180}
            className="input set-input-sm"
            value={sessionTimeoutMin}
            onChange={(event) => onSessionTimeoutChange(Number(event.target.value) || 0)}
          />
        </Field>
      </SectionCard>

      <SectionCard
        title="Tema"
        description="Panelin görünümü anında değişir ve tarayıcıda hatırlanır. Diğer sekmeleri etkilemez."
        icon={resolvedTheme === "dark" ? <Moon size={15} /> : <Sun size={15} />}
      >
        <div className="set-theme-group" role="radiogroup" aria-label="Tema tercihi">
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={theme === option.value}
              className={classNames("set-theme-card", theme === option.value && "active")}
              onClick={() => setTheme(option.value)}
            >
              {option.icon}
              {option.label}
            </button>
          ))}
        </div>
        {theme === "system" ? (
          <p className="muted muted-spaced">
            Sistem teması kullanılıyor — şu an {resolvedTheme === "dark" ? "koyu" : "açık"} görünümde.
          </p>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Danışan Verilerini Yedekle"
        description="Tüm danışanlar ve ölçüm geçmişleri — dışa aktarın veya bir yedekten geri yükleyin."
        icon={<Download size={15} />}
      >
        <div className="card-actions">
          <button type="button" className="btn btn-outline btn-small" onClick={() => performExport("json")}>
            <FileJson size={14} /> JSON İndir
          </button>
          <button type="button" className="btn btn-outline btn-small" onClick={() => performExport("csv")}>
            <FileSpreadsheet size={14} /> CSV İndir
          </button>
          <button type="button" className="btn btn-outline btn-small" onClick={() => fileInputRef.current?.click()}>
            <Upload size={14} /> JSON Yükle
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="visually-hidden"
            onChange={handleImportFile}
            aria-hidden="true"
            tabIndex={-1}
          />
        </div>
        {exported ? <p className="muted muted-spaced">{exported}</p> : null}
        {importMsg ? (
          <p className={classNames("muted-spaced", importMsg.ok ? "import-ok" : "field-error")} role="status">
            {importMsg.text}
          </p>
        ) : null}
      </SectionCard>

      {showExportAuth && (
        <div className="modal-overlay" onClick={handleAuthCancel} role="dialog" aria-modal="true" aria-labelledby="export-auth-title">
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <header className="modal-head">
              <h2 id="export-auth-title">{showExportAuth.type.toUpperCase()} Dışa Aktarımı — Şifre Doğrulama</h2>
              <button type="button" className="icon-btn" onClick={handleAuthCancel} aria-label="Kapat">×</button>
            </header>
            <form onSubmit={handleAuthSubmit}>
              {/* Erişilebilirlik: tarayıcılar şifre alanının yanında (gizli de olsa) bir kullanıcı adı alanı bekler. */}
              <input
                type="text"
                name="username"
                autoComplete="username"
                className="visually-hidden"
                defaultValue={typeof window !== "undefined" ? localStorage.getItem("dp_auth_user") ?? "" : ""}
                tabIndex={-1}
                aria-hidden="true"
              />
              <div className="form-full">
                <label className="label" htmlFor="export-auth-pwd">Mevcut oturum şifrenizi girin</label>
                <div className="password-input-wrapper">
                  <input
                    id="export-auth-pwd"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    className="input"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                  <button type="button" className="icon-btn password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {authError && <p className="field-error" role="alert">{authError}</p>}
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={handleAuthCancel}>İptal</button>
                <button type="submit" className="btn btn-primary">Doğrula ve İndir</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};