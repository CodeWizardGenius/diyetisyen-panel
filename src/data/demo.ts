/**
 * Panelin ve tanıtım sayfasının (landing) ortak demo verisi.
 * Tek kaynak: hem varsayılan danışan listesi hem de landing önizlemesi buradan beslenir,
 * böylece örnek isimler ve yüzdeler tutarlı kalır.
 */

export type PatientStatus = "Aktif" | "Risk";

export type Patient = {
  id: number;
  name: string;
  plan: string;
  startDate: string;
  endDate: string;
  compliance: number;
  lastAction: string;
  status: PatientStatus;
};

export const DEMO_PATIENTS: Patient[] = [
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

/** Dashboard ve landing önizlemesinde kullanılan demo özet değerleri. */
export const DEMO_STATS = {
  total: DEMO_PATIENTS.length,
  active: DEMO_PATIENTS.filter((patient) => patient.status === "Aktif").length,
  risk: DEMO_PATIENTS.filter((patient) => patient.status === "Risk").length,
  avgCompliance:
    DEMO_PATIENTS.length > 0
      ? Math.round(
          DEMO_PATIENTS.reduce((sum, patient) => sum + patient.compliance, 0) / DEMO_PATIENTS.length
        )
      : 0
};