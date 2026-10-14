import React from "react";
import {
  AlertOctagon,
  AlertTriangle,
  Bell,
  CalendarClock,
  CheckCircle2,
  Eye,
  Inbox,
  Info,
  MessageCircle,
  Moon,
  Scale,
  Search,
  Settings2,
  Trash2,
  TrendingDown,
  Undo2,
  UtensilsCrossed
} from "lucide-react";
import type { MeasurementLike } from "../../types/settings";
import { loadSettings, saveSettings } from "../../types/settings";
import type { AlertCategory, AlertRules, AlertSeverity, PatientAlert } from "../../types/alerts";
import {
  CATEGORY_META,
  DEFAULT_ALERT_RULES,
  loadAlertRules,
  loadDismissedIds,
  loadResolvedIds,
  rulesFromClinicSettings,
  saveAlertRules,
  saveDismissedIds,
  saveResolvedIds,
  SEVERITY_META
} from "../../types/alerts";
import { buildAlerts, isQuietNow, timeAgoTr, type EnginePatient } from "./alertEngine";
import { AlertRulesPanel } from "./AlertRulesPanel";
import { classNames } from "../settings/classNames";

interface Props {
  patients: EnginePatient[];
  getMeasurements: (patientId: number) => MeasurementLike[];
  onOpenPatient: (patientId: number) => void;
}

type AlertsTab = "inbox" | "rules";
type FeedFilter = "all" | AlertSeverity | "resolved";

/** Ortak alanları Ayarlar > Bildirimler & Risk'e geri yazar; iki ekran aynı değerleri göstersin. */
const syncClinicSettingsWithRules = (rules: AlertRules): void => {
  try {
    const clinic = loadSettings();
    saveSettings({
      ...clinic,
      notifications: {
        ...clinic.notifications,
        complianceThreshold: rules.complianceThreshold,
        missedMealHours: rules.missedMealHours,
        quietStart: rules.quietHoursRange[0],
        quietEnd: rules.quietHoursRange[1]
      }
    });
  } catch {
    // depolama kullanılamıyor — yoksay
  }
};

const SEVERITY_ICON: Record<AlertSeverity, React.ReactNode> = {
  critical: <AlertOctagon size={14} />,
  warning: <AlertTriangle size={14} />,
  info: <Info size={14} />
};

const CATEGORY_ICON: Record<AlertCategory, React.ReactNode> = {
  adherence: <TrendingDown size={12} />,
  missed_meal: <UtensilsCrossed size={12} />,
  plan_expiration: <CalendarClock size={12} />,
  weight_plateau: <Scale size={12} />
};

const MetricChip: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number;
  accent: string;
  active: boolean;
  onClick: () => void;
}> = ({ icon, label, value, accent, active, onClick }) => (
  <button
    type="button"
    className={classNames("metric-chip", active && "metric-chip-active")}
    style={{ ["--accent" as string]: accent }}
    onClick={onClick}
    aria-pressed={active}
  >
    <span className="metric-chip-icon">{icon}</span>
    <span className="metric-chip-text">
      <strong>{value}</strong>
      <small>{label}</small>
    </span>
  </button>
);

const AlertCard: React.FC<{
  alert: PatientAlert;
  onResolve: (id: string) => void;
  onReopen: (id: string) => void;
  onWhatsApp: (alert: PatientAlert) => void;
  onDelete: (id: string) => void;
  onView: (patientId: number) => void;
}> = ({ alert, onResolve, onReopen, onWhatsApp, onDelete, onView }) => {
  const accent = SEVERITY_META[alert.severity].accent;
  return (
    <article
      className={classNames("inbox-card", alert.isResolved && "inbox-card-resolved")}
      style={{ borderLeftColor: accent }}
    >
      <div className="inbox-avatar">
        <span className="avatar">{alert.patientName.charAt(0)}</span>
        <span className="inbox-avatar-badge" style={{ background: accent }}>
          {SEVERITY_ICON[alert.severity]}
        </span>
      </div>

      <div className="inbox-body">
        <div className="inbox-meta">
          <strong className="inbox-patient">{alert.patientName}</strong>
          <span className="tag tag-plan">{alert.patientPlan}</span>
          <span className="tag tag-sev" style={{ color: accent, borderColor: accent }}>
            {SEVERITY_ICON[alert.severity]}
            {SEVERITY_META[alert.severity].label}
          </span>
          <span className="tag tag-cat">
            {CATEGORY_ICON[alert.category]}
            {CATEGORY_META[alert.category].label}
          </span>
          <span className="muted inbox-time">{timeAgoTr(alert.timestamp)}</span>
        </div>
        <strong className="inbox-title">{alert.title}</strong>
        <p className="inbox-desc muted">{alert.description}</p>
      </div>

      <div className="inbox-actions">
        <button type="button" className="btn btn-outline btn-small" onClick={() => onView(alert.patientId)}>
          <Eye size={14} /> İncele
        </button>
        <button type="button" className="btn btn-outline btn-small" onClick={() => onWhatsApp(alert)}>
          <MessageCircle size={14} /> WhatsApp
        </button>
        {alert.isResolved ? (
          <button type="button" className="btn btn-outline btn-small" onClick={() => onReopen(alert.id)}>
            <Undo2 size={14} /> Geri Al
          </button>
        ) : (
          <button type="button" className="btn btn-primary btn-small" onClick={() => onResolve(alert.id)}>
            <CheckCircle2 size={14} /> Çözüldü
          </button>
        )}
        <button
          type="button"
          className="icon-btn inbox-delete"
          aria-label="Uyarıyı sil"
          onClick={() => onDelete(alert.id)}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </article>
  );
};

export const AlertsView: React.FC<Props> = ({ patients, getMeasurements, onOpenPatient }) => {
  const [tab, setTab] = React.useState<AlertsTab>("inbox");
  const [rules, setRules] = React.useState<AlertRules>(() => loadAlertRules(rulesFromClinicSettings()));
  const [savedRules, setSavedRules] = React.useState<AlertRules>(() => loadAlertRules(rulesFromClinicSettings()));
  const [resolvedIds, setResolvedIds] = React.useState<string[]>(() => loadResolvedIds());
  const [dismissedIds, setDismissedIds] = React.useState<string[]>(() => loadDismissedIds());
  const [filter, setFilter] = React.useState<FeedFilter>("all");
  const [query, setQuery] = React.useState("");
  const [toast, setToast] = React.useState<string | null>(null);
  const toastTimer = React.useRef<number | undefined>(undefined);

  React.useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const showToast = React.useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const alerts = React.useMemo(() => {
    const dismissed = new Set(dismissedIds);
    return buildAlerts(patients, getMeasurements, savedRules, resolvedIds).filter(
      (alert) => !dismissed.has(alert.id)
    );
  }, [patients, getMeasurements, savedRules, resolvedIds, dismissedIds]);

  const quietActive = React.useMemo(
    () => isQuietNow(savedRules.quietHoursRange, savedRules.quietHoursEnabled),
    [savedRules]
  );

  const counts = React.useMemo(() => {
    const active = alerts.filter((alert) => !alert.isResolved);
    return {
      critical: active.filter((alert) => alert.severity === "critical").length,
      warning: active.filter((alert) => alert.severity === "warning").length,
      info: active.filter((alert) => alert.severity === "info").length,
      resolved: alerts.filter((alert) => alert.isResolved).length,
      total: active.length
    };
  }, [alerts]);

  const visible = React.useMemo(() => {
    const lower = query.trim().toLowerCase();
    return alerts.filter((alert) => {
      if (lower && !`${alert.patientName} ${alert.title} ${alert.description}`.toLowerCase().includes(lower)) {
        return false;
      }
      if (filter === "resolved") {
        return alert.isResolved;
      }
      if (alert.isResolved) {
        return false;
      }
      if (filter === "all") {
        return true;
      }
      return alert.severity === filter;
    });
  }, [alerts, filter, query]);

  const patchRules = React.useCallback((patch: Partial<AlertRules>) => {
    setRules((prev) => ({ ...prev, ...patch }));
  }, []);

  const isRulesDirty = React.useMemo(
    () => JSON.stringify(rules) !== JSON.stringify(savedRules),
    [rules, savedRules]
  );

  const handleSaveRules = React.useCallback(() => {
    saveAlertRules(rules);
    syncClinicSettingsWithRules(rules);
    setSavedRules({ ...rules });
    showToast("Kurallar kaydedildi — uyarı akışı güncellendi.");
  }, [rules, showToast]);

  const handleResetRules = React.useCallback(() => {
    const next = { ...DEFAULT_ALERT_RULES };
    saveAlertRules(next);
    syncClinicSettingsWithRules(next);
    setRules(next);
    setSavedRules(next);
    showToast("Kurallar varsayılanlara sıfırlandı.");
  }, [showToast]);

  const handleResolve = React.useCallback(
    (id: string) => {
      setResolvedIds((prev) => {
        const next = prev.includes(id) ? prev : [...prev, id];
        saveResolvedIds(next);
        return next;
      });
      showToast("Uyarı çözüldü olarak işaretlendi.");
    },
    [showToast]
  );

  const handleReopen = React.useCallback(
    (id: string) => {
      setResolvedIds((prev) => {
        const next = prev.filter((item) => item !== id);
        saveResolvedIds(next);
        return next;
      });
      showToast("Uyarı tekrar aktifleştirildi.");
    },
    [showToast]
  );

  const handleDelete = React.useCallback(
    (id: string) => {
      setDismissedIds((prev) => {
        const next = prev.includes(id) ? prev : [...prev, id];
        saveDismissedIds(next);
        return next;
      });
      showToast("Uyarı silindi.");
    },
    [showToast]
  );

  const handleDeleteResolved = React.useCallback(() => {
    const resolvedAlertIds = alerts.filter((alert) => alert.isResolved).map((alert) => alert.id);
    if (resolvedAlertIds.length === 0) {
      showToast("Silinecek çözülmüş uyarı yok.");
      return;
    }
    setDismissedIds((prev) => {
      const next = Array.from(new Set([...prev, ...resolvedAlertIds]));
      saveDismissedIds(next);
      return next;
    });
    showToast(`${resolvedAlertIds.length} çözülmüş uyarı silindi.`);
  }, [alerts, showToast]);

  const handleDeleteAll = React.useCallback(() => {
    if (alerts.length === 0) {
      return;
    }
    if (!window.confirm(`${alerts.length} uyarının tümü silinsin mi? Bu işlem geri alınamaz.`)) {
      return;
    }
    const allIds = alerts.map((alert) => alert.id);
    setDismissedIds((prev) => {
      const next = Array.from(new Set([...prev, ...allIds]));
      saveDismissedIds(next);
      return next;
    });
    showToast("Tüm uyarılar silindi.");
  }, [alerts, showToast]);

  const handleWhatsApp = React.useCallback(
    (alert: PatientAlert) => {
      // Danışan telefonu tutulmadığından alıcı WhatsApp'ta seçilir; mesaj önceden doldurulur.
      const text = `Merhaba ${alert.patientName}, ${alert.title}. ${alert.description}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
      showToast(`${alert.patientName} için WhatsApp mesajı yeni sekmede açıldı.`);
    },
    [showToast]
  );

  const metrics: Array<{ key: FeedFilter; icon: React.ReactNode; label: string; value: number; accent: string }> = [
    { key: "critical", icon: <AlertOctagon size={16} />, label: "Kritik Risk", value: counts.critical, accent: "#ef4444" },
    { key: "warning", icon: <AlertTriangle size={16} />, label: "Öğün & Plato Takibi", value: counts.warning, accent: "#f59e0b" },
    { key: "info", icon: <Info size={16} />, label: "Bilgi & Plan Bitişi", value: counts.info, accent: "#3b82f6" },
    { key: "resolved", icon: <CheckCircle2 size={16} />, label: "Çözülen", value: counts.resolved, accent: "#10b981" }
  ];

  const filterPills: Array<{ key: FeedFilter; label: string }> = [
    { key: "all", label: "Tümü" },
    { key: "critical", label: "Kritik" },
    { key: "warning", label: "Dikkat" },
    { key: "info", label: "Bilgi" },
    { key: "resolved", label: `Çözülenler (${counts.resolved})` }
  ];

  return (
    <div className="alerts-shell">
      <header className="alerts-head">
        <div className="alerts-head-text">
          <h2>Uyarı &amp; Risk Merkezi</h2>
          <p className="muted">Danışan risklerini tek gelen kutusunda izleyin, eşik ve otomasyonları yönetin.</p>
        </div>
        <div className="segmented" role="tablist" aria-label="Uyarı görünümü">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "inbox"}
            className={classNames("segmented-item", tab === "inbox" && "active")}
            onClick={() => setTab("inbox")}
          >
            <Inbox size={15} /> Aktif Bildirimler
            <span className="segmented-count">{counts.total}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "rules"}
            className={classNames("segmented-item", tab === "rules" && "active")}
            onClick={() => setTab("rules")}
          >
            <Settings2 size={15} /> Kural &amp; Otomasyonlar
          </button>
        </div>
      </header>

      {tab === "inbox" ? (
        <div className="alerts-inbox">
          <div className="metric-strip">
            {metrics.map((metric) => (
              <MetricChip
                key={metric.key}
                icon={metric.icon}
                label={metric.label}
                value={metric.value}
                accent={metric.accent}
                active={filter === metric.key}
                onClick={() => setFilter((prev) => (prev === metric.key ? "all" : metric.key))}
              />
            ))}
          </div>

          {quietActive ? (
            <div className="quiet-banner" role="status">
              <Moon size={15} />
              Sessiz saatler aktif ({savedRules.quietHoursRange[0]} – {savedRules.quietHoursRange[1]}) — otomatik
              bildirimler duraklatıldı, akış kaydı sürüyor.
            </div>
          ) : null}

          {toast ? (
            <div className="toast" role="status">
              <CheckCircle2 size={16} />
              {toast}
            </div>
          ) : null}

          <div className="alerts-toolbar">
            <div className="search alerts-search">
              <Search size={15} className="search-icon" />
              <input
                placeholder="Hasta, başlık veya açıklama ara..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Uyarı ara"
              />
            </div>
            <div className="filter-pills" role="group" aria-label="Uyarı filtresi">
              {filterPills.map((pill) => (
                <button
                  key={pill.key}
                  type="button"
                  className={classNames("filter-pill", filter === pill.key && "active")}
                  onClick={() => setFilter(pill.key)}
                >
                  {pill.label}
                </button>
              ))}
            </div>
            <div className="toolbar-actions">
              <button
                type="button"
                className="btn btn-outline btn-small"
                onClick={handleDeleteResolved}
                disabled={counts.resolved === 0}
              >
                <Trash2 size={14} /> Çözülenleri Sil
              </button>
              <button
                type="button"
                className="btn btn-danger btn-small"
                onClick={handleDeleteAll}
                disabled={alerts.length === 0}
              >
                <Trash2 size={14} /> Tümünü Sil
              </button>
            </div>
          </div>

          <div className="alerts-feed">
            {visible.length === 0 ? (
              <div className="card alerts-empty">
                <Bell size={20} />
                <strong>Uyarı bulunamadı</strong>
                <p className="muted">Filtreleri gevşetin veya tüm danışanlar eşiklerin üzerinde.</p>
              </div>
            ) : (
              visible.map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onResolve={handleResolve}
                  onReopen={handleReopen}
                  onWhatsApp={handleWhatsApp}
                  onDelete={handleDelete}
                  onView={onOpenPatient}
                />
              ))
            )}
          </div>
        </div>
      ) : (
        <AlertRulesPanel
          rules={rules}
          onChange={patchRules}
          onSave={handleSaveRules}
          onReset={handleResetRules}
          isDirty={isRulesDirty}
        />
      )}
    </div>
  );
};
