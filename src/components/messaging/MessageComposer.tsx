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
import { IS_HTTP, errorMessage, messagesApi, notifyServerData, subscribeServerData } from "../../api";

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

type ComposerTemplate = { id: string; label: string; text: string };

const DEFAULT_COMPOSER_TEMPLATES: ComposerTemplate[] = MESSAGE_TEMPLATES.map((template) => ({
  id: template.id,
  label: template.label,
  text: template.text
}));

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
  const [templates, setTemplates] = React.useState<ComposerTemplate[]>(DEFAULT_COMPOSER_TEMPLATES);
  const [text, setText] = React.useState("");
  const [notice, setNotice] = React.useState<string | null>(null);
  const [version, setVersion] = React.useState(0);
  const [serverMessages, setServerMessages] = React.useState<Array<{ id: string; text: string; direction: "patient" | "dietitian"; sentAt: string; readAt: string | null }>>([]);

  React.useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // http modunda şablonlar sunucudan gelir; istek düşerse sabit listeye dönülür.
  React.useEffect(() => {
    if (!IS_HTTP) {
      return undefined;
    }
    let alive = true;
    void messagesApi
      .sablonlar()
      .then((list) => {
        if (!alive || !Array.isArray(list) || list.length === 0) return;
        setTemplates(
          list.map((template) => ({ id: template.id, label: template.name, text: template.body }))
        );
      })
      .catch(() => {
        if (alive) setTemplates(DEFAULT_COMPOSER_TEMPLATES);
      });
    return () => {
      alive = false;
    };
  }, []);

  React.useEffect(() => {
    if (!IS_HTTP) {
      return;
    }
    const unsubscribe = subscribeServerData(() => setVersion((prev) => prev + 1));
    let alive = true;
    void messagesApi
      .listele(patientId, 8)
      .then((list) => {
        if (alive) setServerMessages(list);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [patientId, version]);

  const view = React.useMemo(() => {
    if (IS_HTTP) {
      return serverMessages;
    }
    void version;
    return sortMobileEventsDesc(
      readMobileEvents().filter((event) => event.patientId === patientId && event.type === "message")
    )
      .slice(0, 8)
      .map((event) => ({
        id: event.id,
        text: (event.payload as MessagePayload).text,
        direction: (event.payload as MessagePayload).direction === "dietitian" ? ("dietitian" as const) : ("patient" as const),
        sentAt: event.timestamp,
        readAt: (event.payload as MessagePayload).readAt ?? null
      }));
  }, [patientId, version, serverMessages]);

  const lastOutboundUnread = view.find((item) => item.direction === "dietitian" && !item.readAt);

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const template = templates.find((item) => item.id === id);
    setText(template?.text ?? "");
  };

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed || !patientId) {
      return;
    }
    if (IS_HTTP) {
      void messagesApi
        .gonder(patientId, trimmed, templateId === "serbest" ? undefined : templateId)
        .then(() => {
          setNotice("Mesaj danışanın mobil uygulamasına iletildi.");
          setText(templateId === "serbest" ? "" : text);
          notifyServerData();
          setVersion((prev) => prev + 1);
        })
        .catch((error: unknown) => setNotice(errorMessage(error)));
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
    if (IS_HTTP) {
      void messagesApi
        .okundu(lastOutboundUnread.id)
        .then(() => {
          setNotice("Okundu bilgisi güncellendi.");
          notifyServerData();
          setVersion((prev) => prev + 1);
        })
        .catch((error: unknown) => setNotice(errorMessage(error)));
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
              {templates.map((template) => (
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
          {view.length === 0 ? (
            <p className="muted">Bu danışanla henüz mesaj geçmişi yok.</p>
          ) : (
            <ul className="msg-list">
              {view.map((item) => {
                const outbound = item.direction === "dietitian";
                return (
                  <li key={item.id} className={classNames("msg-item", outbound ? "msg-out" : "msg-in")}>
                    <p className="msg-text">{item.text}</p>
                    <small className="muted">
                      {outbound ? "Panel → Danışan" : "Danışan → Panel"} · {timeAgoTr(item.sentAt)}
                      {outbound ? (item.readAt ? " · Okundu" : " · İletildi") : ""}
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
