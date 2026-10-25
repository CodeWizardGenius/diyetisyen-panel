import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Patient } from "../data/demo";
import type { AuthSnapshot } from "../schemas";

const AUTH_STORAGE_KEY = "dp_auth";
const PATIENTS_STORAGE_KEY = "dp_patients";

interface AuthState {
  auth: AuthSnapshot | null;
  isAuthed: boolean;
  remainingSec: number;
  setAuth: (auth: AuthSnapshot | null) => void;
  setIsAuthed: (isAuthed: boolean) => void;
  setRemainingSec: (sec: number) => void;
  logout: (clearLocalData?: boolean) => void;
}

interface PatientState {
  patients: Patient[];
  selectedPatient: Patient | null;
  showDetail: boolean;
  patientModalOpen: boolean;
  editingPatient: Patient | null;
  patientToDelete: Patient | null;
  setPatients: (patients: Patient[]) => void;
  addPatient: (patient: Patient) => void;
  updatePatient: (id: number, data: Partial<Patient>) => void;
  deletePatient: (id: number) => void;
  setSelectedPatient: (patient: Patient | null) => void;
  setShowDetail: (show: boolean) => void;
  setPatientModalOpen: (open: boolean) => void;
  setEditingPatient: (patient: Patient | null) => void;
  setPatientToDelete: (patient: Patient | null) => void;
}

interface UIState {
  tab: "dashboard" | "patients" | "plans" | "appointments" | "alerts" | "settings";
  query: string;
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  composerOpen: boolean;
  composerPatientId: number | null;
  reportPatient: Patient | null;
  priorityApptPatientId: number | null;
  setTab: (tab: UIState["tab"]) => void;
  setQuery: (query: string) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setMobileNavOpen: (open: boolean) => void;
  setComposerOpen: (open: boolean, patientId?: number) => void;
  setReportPatient: (patient: Patient | null) => void;
  setPriorityApptPatientId: (id: number | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      auth: null,
      isAuthed: false,
      remainingSec: 0,
      setAuth: (auth) => set({ auth, isAuthed: !!auth }),
      setIsAuthed: (isAuthed) => set({ isAuthed }),
      setRemainingSec: (remainingSec) => set({ remainingSec }),
      logout: (clearLocalData = false) => set({ auth: null, isAuthed: false, remainingSec: 0 }),
    }),
    {
      name: AUTH_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ auth: state.auth }),
    }
  )
);

export const usePatientStore = create<PatientState>()(
  persist(
    (set) => ({
      patients: [],
      selectedPatient: null,
      showDetail: false,
      patientModalOpen: false,
      editingPatient: null,
      patientToDelete: null,
      setPatients: (patients) => set({ patients }),
      addPatient: (patient) => set((state) => ({ patients: [...state.patients, patient] })),
      updatePatient: (id, data) => set((state) => ({
        patients: state.patients.map((p) => p.id === id ? { ...p, ...data } : p)
      })),
      deletePatient: (id) => set((state) => ({
        patients: state.patients.filter((p) => p.id !== id)
      })),
      setSelectedPatient: (selectedPatient) => set({ selectedPatient }),
      setShowDetail: (showDetail) => set({ showDetail }),
      setPatientModalOpen: (patientModalOpen) => set({ patientModalOpen }),
      setEditingPatient: (editingPatient) => set({ editingPatient }),
      setPatientToDelete: (patientToDelete) => set({ patientToDelete }),
    }),
    {
      name: PATIENTS_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ patients: state.patients }),
    }
  )
);

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      tab: "dashboard",
      query: "",
      sidebarCollapsed: false,
      mobileNavOpen: false,
      composerOpen: false,
      composerPatientId: null,
      reportPatient: null,
      priorityApptPatientId: null,
      setTab: (tab) => set({ tab }),
      setQuery: (query) => set({ query }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
      setComposerOpen: (composerOpen, composerPatientId) => set({ composerOpen, composerPatientId: composerPatientId ?? null }),
      setReportPatient: (reportPatient) => set({ reportPatient }),
      setPriorityApptPatientId: (priorityApptPatientId) => set({ priorityApptPatientId }),
    }),
    {
      name: "dp_ui",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);

export const useAppStore = () => {
  const auth = useAuthStore();
  const patients = usePatientStore();
  const ui = useUIStore();
  return { ...auth, ...patients, ...ui };
};