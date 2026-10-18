import React from "react";
import { CheckCheck, MessageSquare, Send, Smartphone } from "lucide-react";
import {
  ingestMobileEvent,
  markMessageRead,
  readMobileEvents,
  sortMobileEventsDesc,
  type MessagePayload,
  type MobileEvent
} from "../../types/mobileData";
import { timeAgoTr } from "../alerts/alertEngine";
import { classNames } from "../settings/classNames";

/** Hazır mesaj şablonları (FAZ 2 · madde 7). */
export const MESSAGE_TEMPLATES = [
  { id: "serbest", label: "Serbest metin", text: "" },
  {
    id: "veri",
    label: "Veri hatırlatma",
    text: "Merhaba! Bugünkü öğün ve su kayıtlarını uygulamaya eklemeyi unutma. Küçük notlar bile takibimizi güçlendiriyor."
  },
  {
    id: "tebrik",
    label: "Tebrik (hedefe ulaşma)",
    text: "Tebrikler! Hedefe adım adım yaklaşıyorsun; istikrarın harika. Böyle devam!"
  },
  {
    id: "randevu",
    label: "Randevu hatırlatma",
    text: "Merhaba! Yaklaşan randevunu hatırlatmak istedim. Uygun olmadığın bir saat varsa bana yazabilirsin."
  },
  {
    id: "odeme",
    label: "Ödeme / paket hatırlatma",
    text: "Merhaba! Takip paketinizin süresi yakında doluyor. Kesintisiz devam edebilmemiz için paket yenileme ödemesini tamamlayabilir misiniz? Sorularınız için buradayım."
  }
] as const;

interface PatientRef {
  id: number;
  name: string;
}

interface Props {
  patients: PatientRef[];
  initialPatientId?: number;
  onClose: () => void;
}

const isOutbound = (event: MobileEvent): boolean =>
  (event.payload as MessagePayload).direction === "dietitian";

/** Panelden danışana uygulama içi mesaj gönderme + okundu bilgisi takibi. */
export const MessageComposer: React.FC<Props> = ({ patients, initialPatientId, onClose }) => {
  const [patientId, setPatientId] = React.useState<number>(() => initialPatientId ?? patients[0]?.id ?? 0);
  const [templateId, setTemplateId] = React.useState<string>("serbest");
  const [text, setText] = React.useState("");
  const [notice, setNotice] = React.useState<string | null>(null);
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

  const history = React.useMemo(() => {
    void version;
    return sortMobileEventsDesc(
      readMobileEvents().filter((event) => event.patientId === patientId && event.type === "message")
    ).slice(0, 8);
  }, [patientId, version]);

  const lastOutboundUnread = history.find((event) => isOutbound(event) && !(event.payload as MessagePayload).readAt);

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const template = MESSAGE_TEMPLATES.find((item) => item.id === id);
    setText(template?.text ?? "");
  };

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed || !patientId) {
      return;
    }
    ingestMobileEvent({
      patientId,
      type: "message",
      timestamp: new Date().toISOString(),
      payload: {
        text: trimmed,
        direction: "dietitian",
        templateId: templateId === "serbest" ? undefined : templateId
      }
    });
    setNotice("Mesaj danışanın mobil uygulamasına iletildi.");
    setText(templateId === "serbest" ? "" : text);
    setVersion((prev) => prev + 1);
  };

  const simulateRead = () => {
    if (!lastOutboundUnread) {
      return;
    }
    markMessageRead(lastOutboundUnread.id);
    setNotice("Danışan mesajı okudu — okundu bilgisi panele yansıdı.");
    setVersion((prev) => prev + 1);
  };

  const openWhatsApp = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(trimmed)}`, "_blank", "noopener,noreferrer");
  };

  const patientName = patients.find((patient) => patient.id === patientId)?.name ?? "";

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="msg-title" onClick={onClose}>
      <div className="modal msg-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title" id="msg-title">
              <MessageSquare size={16} /> Danışana Mesaj
            </h3>
            <p className="muted">Mesaj danışanın mobil uygulamasına düşer; okundu bilgisi burada görünür.</p>
          </div>
          <button type="button" className="btn btn-outline btn-small" onClick={onClose}>
            Kapat
          </button>
        </div>

        <div className="form-grid">
          <div>
            <label className="label" htmlFor="msg-patient">
              Danışan
            </label>
            <select
              id="msg-patient"
              className="input"
              value={patientId}
              onChange={(event) => setPatientId(Number(event.target.value))}
            >
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="msg-template">
              Şablon
            </label>
            <select
              id="msg-template"
              className="input"
              value={templateId}
              onChange={(event) => applyTemplate(event.target.value)}
            >
              {MESSAGE_TEMPLATES.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-full">
            <label className="label" htmlFor="msg-text">
              Mesaj metni
            </label>
            <textarea
              id="msg-text"
              className="input"
              rows={4}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Danışana iletilecek metni yazın…"
            />
            <p className="muted muted-tight">{text.trim().length}/2000 karakter</p>
          </div>
        </div>

        <div className="modal-actions msg-actions">
          <button type="button" className="btn btn-outline" onClick={openWhatsApp} disabled={!text.trim()}>
            WhatsApp ile gönder
          </button>
          <button type="button" className="btn btn-primary" onClick={send} disabled={!text.trim()}>
            <Send size={14} /> Gönder
          </button>
        </div>

        {notice ? (
          <p className="msg-notice" role="status">
            <CheckCheck size={14} /> {notice}
          </p>
        ) : null}

        <div className="msg-history">
          <div className="msg-history-head">
            <h4>
              <Smartphone size={14} /> Mesaj geçmişi{patientName ? ` · ${patientName}` : ""}
            </h4>
            {lastOutboundUnread ? (
              <button type="button" className="btn btn-outline btn-small" onClick={simulateRead}>
                Okundu simüle et (mobil)
              </button>
            ) : null}
          </div>
          {history.length === 0 ? (
            <p className="muted">Bu danışanla henüz mesaj geçmişi yok.</p>
          ) : (
            <ul className="msg-list">
              {history.map((event) => {
                const payload = event.payload as MessagePayload;
                const outbound = isOutbound(event);
                return (
                  <li key={event.id} className={classNames("msg-item", outbound ? "msg-out" : "msg-in")}>
                    <p className="msg-text">{payload.text}</p>
                    <small className="muted">
                      {outbound ? "Panel → Danışan" : "Danışan → Panel"} · {timeAgoTr(event.timestamp)}
                      {outbound ? (payload.readAt ? " · Okundu" : " · İletildi") : ""}
                    </small>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
