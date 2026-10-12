import React from "react";
import { CalendarCheck, Clock3 } from "lucide-react";
import type { ClinicSettings } from "../../../types/settings";
import { isValidTime } from "../../../types/settings";
import { Field, SectionCard, Toggle } from "../ui";

interface Props {
  draft: ClinicSettings;
  updateSection: <K extends keyof ClinicSettings>(
    section: K,
    patch: Partial<ClinicSettings[K]>
  ) => void;
}

export const SchedulePanel: React.FC<Props> = ({ draft, updateSection }) => {
  const schedule = draft.schedule;
  const set = (patch: Partial<ClinicSettings["schedule"]>) => updateSection("schedule", patch);

  return (
    <>
      <SectionCard
        title="Haftalık Çalışma Programı"
        description="Randevu ekranında yalnızca açık günler ve saat aralıkları önerilir."
        icon={<CalendarCheck size={15} />}
      >
        <ul className="set-day-list">
          {schedule.workingDays.map((item, index) => (
            <li key={item.day} className="set-day-row">
              <Toggle
                checked={item.enabled}
                onChange={(checked) =>
                  set({
                    workingDays: schedule.workingDays.map((day, dayIndex) =>
                      dayIndex === index ? { ...day, enabled: checked } : day
                    )
                  })
                }
                label={`${item.day} çalışma durumu`}
              />
              <span className="set-day-name">{item.day}</span>
              <input
                type="time"
                className="input set-time"
                value={item.start}
                disabled={!item.enabled}
                onChange={(event) =>
                  set({
                    workingDays: schedule.workingDays.map((day, dayIndex) =>
                      dayIndex === index ? { ...day, start: event.target.value } : day
                    )
                  })
                }
                aria-label={`${item.day} başlangıç`}
              />
              <span className="muted set-day-dash">–</span>
              <input
                type="time"
                className="input set-time"
                value={item.end}
                disabled={!item.enabled}
                onChange={(event) =>
                  set({
                    workingDays: schedule.workingDays.map((day, dayIndex) =>
                      dayIndex === index ? { ...day, end: event.target.value } : day
                    )
                  })
                }
                aria-label={`${item.day} bitiş`}
              />
              {item.enabled && (!isValidTime(item.start) || !isValidTime(item.end)) ? (
                <p className="field-error" role="alert">
                  Saatler HH:MM formatında olmalı.
                </p>
              ) : null}
              {item.enabled && isValidTime(item.start) && isValidTime(item.end) && item.start >= item.end ? (
                <p className="field-error" role="alert">
                  Bitiş saati başlangıçtan sonra olmalı.
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="Seans Süreleri" icon={<Clock3 size={15} />}>
        <div className="set-grid-2">
          <Field
            label="Varsayılan Görüşme Süresi"
            htmlFor="set-duration"
            hint="Yeni randevularda otomatik seçilir."
          >
            <select
              id="set-duration"
              className="input"
              value={schedule.defaultDurationMin}
              onChange={(event) =>
                set({ defaultDurationMin: Number(event.target.value) as 30 | 45 | 60 })
              }
            >
              <option value={30}>30 dakika</option>
              <option value={45}>45 dakika</option>
              <option value={60}>60 dakika</option>
            </select>
          </Field>
          <Field
            label="Randevu Arası Tampon (dk)"
            htmlFor="set-buffer"
            hint="Hazırlık ve gecikme payı."
            error={schedule.bufferMin < 0 || schedule.bufferMin > 60 ? "0–60 dakika aralığında olmalı." : undefined}
          >
            <input
              id="set-buffer"
              type="number"
              min={0}
              max={60}
              step={5}
              className="input set-input-sm"
              value={schedule.bufferMin}
              onChange={(event) => set({ bufferMin: Number(event.target.value) || 0 })}
            />
          </Field>
        </div>
      </SectionCard>
    </>
  );
};
