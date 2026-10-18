import React from "react";
import {
  AlertTriangle,
  Award,
  CheckCheck,
  Droplets,
  Footprints,
  Inbox,
  MessageSquare,
  Scale,
  ShieldCheck,
  Smile,
  UtensilsCrossed
} from "lucide-react";
import {
  describeMobileEvent,
  ingestMobileEvents,
  MOBILE_EVENT_LABELS,
  MOBILE_EVENTS_CHANGED,
  readMobileEvents,
  sortMobileEventsDesc,
  type IncomingMobileEvent,
  type MobileEvent,
  type MobileEventType
} from "../../types/mobileData";
import { timeAgoTr } from "../alerts/alertEngine";
import { classNames } from "../settings/classNames";

const FEED_LAST_READ_KEY = "dp_feed_last_read_at";
const FEED_POLL_MS = 15000;
const FEED_LIMIT = 24;

const EVENT_ICON: Record<MobileEventType, React.ReactNode> = {
  meal: <UtensilsCrossed size={15} />,
  measurement: <Scale size={15} />,
  water: <Droplets size={15} />,
  activity: <Footprints size={15} />,
  wellbeing: <Smile size={15} />,
  message: <MessageSquare size={15} />,
  achievement: <Award size={15} />,
  consent: <ShieldCheck size={15} />
};

interface PatientRef {
  id: number;
  name: string;
}

interface Props {
  patients: PatientRef[];
}

type ScenarioKey = "aktif" | "hareketsiz" | "su" | "kilo" | "rozet" | "kvkk" | "silme";

const SCENARIOS: Array<{ key: ScenarioKey; label: string }> = [
  { key: "aktif", label: "Bugün aktif (öğün + su + aktivite)" },
  { key: "hareketsiz", label: "Hareketsiz (4 gündür veri yok)" },
  { key: "su", label: "Su hedefi düşük (son 3 gün)" },
  { key: "kilo", label: "Kilo artışı (3 hafta)" },
  { key: "rozet", label: "Rozet / veri serisi (başarı bildirimi)" },
  { key: "kvkk", label: "KVKK rızası (mobil onay)" },
  { key: "silme", label: "Veri silme talebi (KVKK)" }
];

const isoAt = (now: number, daysAgo: number, hour: number, minute = 0): string => {
  const date = new Date(now);
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};

/** Test/demo amaçlı: seçilen senaryoya göre mobil veri olayları üretir. */
const buildScenarioEvents = (scenario: ScenarioKey, patientId: number, now: number): IncomingMobileEvent[] => {
  switch (scenario) {
    case "aktif":
      return [
        { patientId, type: "meal", timestamp: isoAt(now, 0, 8, 10), payload: { mealKind: "kahvalti", planCompliance: "uygun" } },
        { patientId, type: "meal", timestamp: isoAt(now, 0, 12, 40), payload: { mealKind: "ogle", planCompliance: "uygun", note: "Izgara tavuk + salata" } },
        { patientId, type: "water", timestamp: isoAt(now, 0, 14, 0), payload: { ml: 2200 } },
        { patientId, type: "activity", timestamp: isoAt(now, 0, 18, 0), payload: { steps: 9000, exerciseType: "Yürüyüş", minutes: 30 } },
        { patientId, type: "wellbeing", timestamp: isoAt(now, 0, 21, 0), payload: { energy: 4, sleepQuality: 3, fullness: 4, bloating: 2 } }
      ];
    case "hareketsiz":
      return [
        { patientId, type: "meal", timestamp: isoAt(now, 4, 13, 10), payload: { mealKind: "ogle", planCompliance: "kismen" } },
        { patientId, type: "water", timestamp: isoAt(now, 4, 15, 0), payload: { ml: 1200 } }
      ];
    case "su":
      return [1, 2, 3].map((daysAgo) => ({
        patientId,
        type: "water" as const,
        timestamp: isoAt(now, daysAgo, 20, 0),
        // Eşiğin (2000 ml) belirgin altında: 3 gün üst üste tutturulmadı.
        payload: { ml: 800 }
      }));
    case "kilo":
      return [
        { patientId, type: "measurement", timestamp: isoAt(now, 14, 9, 0), payload: { weightKg: 80 } },
        { patientId, type: "measurement", timestamp: isoAt(now, 7, 9, 0), payload: { weightKg: 81.2 } },
        { patientId, type: "measurement", timestamp: isoAt(now, 0, 9, 0), payload: { weightKg: 82.5 } }
      ];
    case "rozet":
      return [
        { patientId, type: "achievement", timestamp: isoAt(now, 0, 7, 30), payload: { badge: "7 Gün Seri", streakDays: 7 } }
      ];
    case "kvkk":
      return [
        {
          patientId,
          type: "consent",
          timestamp: isoAt(now, 0, 9, 30),
          payload: { status: "granted", scope: "Mobil veri paylaşımı ve panele aktarım" }
        }
      ];
    case "silme":
      return [
        {
          patientId,
          type: "consent",
          timestamp: isoAt(now, 0, 10, 0),
          payload: { status: "deletion_requested", scope: "Tüm mobil verilerimin silinmesini istiyorum" }
        }
      ];
    default:
      return [];
  }
};

const readLastReadAt = (): number => {
  if (typeof window === "undefined") {
    return 0;
  }
  return Number(localStorage.getItem(FEED_LAST_READ_KEY) ?? 0) || 0;
};

/** Dashboard'daki canlı veri akışı: son mobil veri girişleri + okunmamış sayacı. */
export const ActivityFeed: React.FC<Props> = ({ patients }) => {
  const [events, setEvents] = React.useState<MobileEvent[]>(() => sortMobileEventsDesc(readMobileEvents()));
  const [lastReadAt, setLastReadAt] = React.useState<number>(() => readLastReadAt());
  const [scenario, setScenario] = React.useState<ScenarioKey>("aktif");
  const [simPatientId, setSimPatientId] = React.useState<number>(() => patients[0]?.id ?? 0);
  const [simMsg, setSimMsg] = React.useState<string | null>(null);

  const refresh = React.useCallback(() => {
    setEvents(sortMobileEventsDesc(readMobileEvents()));
  }, []);

  // Yeni veri anında görünsün: panel içi değişiklik olayı + periyodik yoklama + sekmeler arası "storage" olayı.
  React.useEffect(() => {
    const timer = window.setInterval(refresh, FEED_POLL_MS);
    window.addEventListener("storage", refresh);
    window.addEventListener(MOBILE_EVENTS_CHANGED, refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("storage", refresh);
      window.removeEventListener(MOBILE_EVENTS_CHANGED, refresh);
    };
  }, [refresh]);

  const nameOf = React.useCallback(
    (patientId: number) => patients.find((patient) => patient.id === patientId)?.name ?? `Danışan #${patientId}`,
    [patients]
  );

  const unread = React.useMemo(
    () => events.filter((event) => Date.parse(event.receivedAt) > lastReadAt).length,
    [events, lastReadAt]
  );

  const markAllRead = () => {
    const now = Date.now();
    try {
      localStorage.setItem(FEED_LAST_READ_KEY, String(now));
    } catch {
      // depolama kullanılamıyor — yoksay
    }
    setLastReadAt(now);
  };

  const inject = () => {
    if (!simPatientId) {
      return;
    }
    const created = ingestMobileEvents(buildScenarioEvents(scenario, simPatientId, Date.now()));
    refresh();
    setSimMsg(`${created.length} adet örnek veri eklendi — aşağıdaki akışta görünür.`);
  };

  const visible = events.slice(0, FEED_LIMIT);

  return (
    <div className="card feed-card">
      <div className="card-head">
        <h3>
          <Inbox size={16} /> Canlı Aktivite Akışı
        </h3>
        <div className="feed-head-actions">
          {unread > 0 ? <span className="count-badge" aria-label={`${unread} okunmamış veri`}>{unread}</span> : null}
          <button
            type="button"
            className="btn btn-link btn-small"
            onClick={markAllRead}
            disabled={unread === 0}
          >
            <CheckCheck size={14} /> Okundu işaretle
          </button>
        </div>
      </div>
      <p className="muted">Danışan mobil uygulamasından gelen son veri girişleri (en yeni üstte).</p>

      <details className="feed-sim">
        <summary>Demo veri üret (mobil veri simülasyonu)</summary>
        <div className="feed-sim-row">
          <select
            className="input"
            aria-label="Simülasyon danışanı"
            value={simPatientId}
            onChange={(event) => setSimPatientId(Number(event.target.value))}
          >
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.name}
              </option>
            ))}
          </select>
          <select
            className="input"
            aria-label="Simülasyon senaryosu"
            value={scenario}
            onChange={(event) => setScenario(event.target.value as ScenarioKey)}
          >
            {SCENARIOS.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-outline btn-small" onClick={inject}>
            Ekle
          </button>
        </div>
        {simMsg ? <p className="muted muted-tight">{simMsg}</p> : null}
      </details>

      {visible.length === 0 ? (
        <p className="muted">Henüz mobil veri yok. Danışanlar veri girdikçe burada görünecek.</p>
      ) : (
        <ul className="feed-list">
          {visible.map((event) => {
            const isUnread = Date.parse(event.receivedAt) > lastReadAt;
            return (
              <li key={event.id} className={isUnread ? "feed-item feed-item-unread" : "feed-item"}>
                <span className={classNames("feed-icon", `feed-icon-${event.type}`)}>{EVENT_ICON[event.type]}</span>
                <div className="feed-body">
                  <p className="feed-text">
                    <strong>{nameOf(event.patientId)}</strong> {describeMobileEvent(event)}
                  </p>
                  <small className="muted feed-meta">
                    {MOBILE_EVENT_LABELS[event.type]} · {timeAgoTr(event.timestamp)}
                    {event.status === "eksik" ? (
                      <span className="feed-flag" title={event.issues.join(" ")}>
                        <AlertTriangle size={12} /> eksik veri
                      </span>
                    ) : null}
                  </small>
                </div>
                {isUnread ? <span className="feed-dot" aria-hidden="true" /> : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};