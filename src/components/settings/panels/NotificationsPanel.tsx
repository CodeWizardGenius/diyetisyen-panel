import React from "react";
import { AlertTriangle, Bell, MoonStar, Plus, Trash2 } from "lucide-react";
import type { ClinicSettings } from "../../../types/settings";
import { isValidTime } from "../../../types/settings";
import { Field, SectionCard } from "../ui";

interface Props {
  draft: ClinicSettings;
  updateSection: <K extends keyof ClinicSettings>(
    section: K,
    patch: Partial<ClinicSettings[K]>
  ) => void;
}

const uid = (): string => `rem-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

export const NotificationsPanel: React.FC<Props> = ({ draft, updateSection }) => {
  const notifications = draft.notifications;
  const set = (patch: Partial<ClinicSettings["notifications"]>) =>
    updateSection("notifications", patch);

  return (
    <>
      <SectionCard
        title="Öğün Hatırlatma Saatleri"
        description="Danışanlara gönderilecek hatırlatma bildirimlerinin saatleri."
        icon={<Bell size={15} />}
      >
        <ul className="set-slot-list">
          {notifications.reminderSlots.map((slot) => (
            <li key={slot.id} className="set-slot-row">
              <input
                className="input"
                value={slot.label}
                onChange={(event) =>
                  set({
                    reminderSlots: notifications.reminderSlots.map((item) =>
                      item.id === slot.id ? { ...item, label: event.target.value } : item
                    )
                  })
                }
                aria-label="Hatırlatma adı"
              />
              <input
                type="time"
                className="input set-time"
                value={slot.time}
                onChange={(event) =>
                  set({
                    reminderSlots: notifications.reminderSlots.map((item) =>
                      item.id === slot.id ? { ...item, time: event.target.value } : item
                    )
                  })
                }
                aria-label={`${slot.label} hatırlatma saati`}
              />
              <button
                type="button"
                className="icon-btn icon-btn-danger"
                aria-label={`${slot.label} hatırlatmasını sil`}
                onClick={() =>
                  set({
                    reminderSlots: notifications.reminderSlots.filter((item) => item.id !== slot.id)
                  })
                }
              >
                <Trash2 size={14} />
              </button>
              {!isValidTime(slot.time) ? (
                <p className="field-error" role="alert">
                  Saat HH:MM formatında olmalı.
                </p>
              ) : null}
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="btn btn-outline btn-small"
          onClick={() =>
            set({
              reminderSlots: [
                ...notifications.reminderSlots,
                { id: uid(), label: "Yeni Hatırlatma", time: "12:00" }
              ]
            })
          }
        >
          <Plus size={14} /> Hatırlatma Ekle
        </button>
      </SectionCard>

      <SectionCard
        title="Risk Eşikleri"
        description="Bu değerlerin dışında kalan danışanlar Uyarılar ekranında ve rozetlerde öne çıkar."
        icon={<AlertTriangle size={15} />}
      >
        <div className="set-grid-2">
          <Field
            label="Uyum Uyarı Eşiği (%)"
            htmlFor="set-compliance"
            hint="Uyum bu değerin altına düşerse uyarı üretilir."
            error={
              notifications.complianceThreshold < 0 || notifications.complianceThreshold > 100
                ? "0–100 aralığında olmalı."
                : undefined
            }
          >
            <input
              id="set-compliance"
              type="number"
              min={0}
              max={100}
              className="input set-input-sm"
              value={notifications.complianceThreshold}
              onChange={(event) => set({ complianceThreshold: Number(event.target.value) || 0 })}
            />
          </Field>
          <Field
            label="İşaretlenmeyen Öğün (saat)"
            htmlFor="set-missed"
            hint="Öğün saatinden bu süre sonra hâlâ işaretlenmediyse uyar."
            error={
              notifications.missedMealHours < 1 || notifications.missedMealHours > 24
                ? "1–24 saat aralığında olmalı."
                : undefined
            }
          >
            <input
              id="set-missed"
              type="number"
              min={1}
              max={24}
              className="input set-input-sm"
              value={notifications.missedMealHours}
              onChange={(event) => set({ missedMealHours: Number(event.target.value) || 0 })}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title="Sessiz Saatler"
        description="Bu aralıkta otomatik bildirim gönderilmez. Gece yarısını aşabilir (örn. 23:00 – 08:00)."
        icon={<MoonStar size={15} />}
      >
        <div className="set-grid-2">
          <Field
            label="Başlangıç"
            htmlFor="set-quiet-start"
            error={!isValidTime(notifications.quietStart) ? "Saat HH:MM formatında olmalı." : undefined}
          >
            <input
              id="set-quiet-start"
              type="time"
              className="input"
              value={notifications.quietStart}
              onChange={(event) => set({ quietStart: event.target.value })}
            />
          </Field>
          <Field
            label="Bitiş"
            htmlFor="set-quiet-end"
            error={!isValidTime(notifications.quietEnd) ? "Saat HH:MM formatında olmalı." : undefined}
          >
            <input
              id="set-quiet-end"
              type="time"
              className="input"
              value={notifications.quietEnd}
              onChange={(event) => set({ quietEnd: event.target.value })}
            />
          </Field>
        </div>
      </SectionCard>
    </>
  );
};
