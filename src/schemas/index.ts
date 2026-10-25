import { z } from "zod";

export const PatientPackageSchema = z.object({
  name: z.string().min(1).max(100),
  sessionsTotal: z.number().int().positive().max(1000),
  sessionsLeft: z.number().int().nonnegative().max(1000),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const PatientSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(100),
  plan: z.string().min(1).max(100),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  compliance: z.number().int().min(0).max(100),
  lastAction: z.string().min(1),
  status: z.enum(["Aktif", "Risk"]),
  package: PatientPackageSchema.optional(),
});

export const PatientsArraySchema = z.array(PatientSchema);

export const MobileEventSchema = z.object({
  id: z.string().min(1),
  patientId: z.number().int().positive(),
  type: z.enum(["meal", "measurement", "water", "activity", "wellbeing", "message", "achievement", "consent"]),
  timestamp: z.string().datetime(),
  receivedAt: z.string().datetime(),
  payload: z.record(z.string(), z.unknown()),
  status: z.enum(["ok", "eksik"]),
  issues: z.array(z.string()),
});

export const MobileEventsArraySchema = z.array(MobileEventSchema);

export const AppointmentSchema = z.object({
  id: z.string().min(1),
  patientId: z.number().int().positive().optional(),
  patient: z.string().min(1).max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  type: z.string().min(1).max(50),
  status: z.enum(["Onaylı", "Bekliyor"]),
});

export const AppointmentsArraySchema = z.array(AppointmentSchema);

export const PatientPlanItemSchema = z.object({
  day: z.number().int().min(1).max(14),
  meal: z.string().min(1).max(50),
  calories: z.number().int().min(0).max(5000),
  proteinG: z.number().min(0).max(500),
  carbsG: z.number().min(0).max(500),
  fatG: z.number().min(0).max(500),
  completed: z.boolean().default(false),
});

export const PatientPlanSchema = z.object({
  id: z.number().int().positive().optional(),
  templateName: z.string().min(1).max(100),
  patientId: z.number().int().positive(),
  items: z.array(PatientPlanItemSchema),
  macros: z.object({
    calories: z.number().int().min(800).max(5000),
    protein: z.number().int().min(0).max(100),
    carbs: z.number().int().min(0).max(100),
    fat: z.number().int().min(0).max(100),
  }).optional(),
  notes: z.string().max(2000).optional(),
  repeat: z.boolean().default(false),
  profile: z.string().optional(),
  activity: z.string().optional(),
  goal: z.string().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export const PatientPlansMapSchema = z.record(z.string(), PatientPlanSchema);

export const AlertRuleSchema = z.object({
  weightGainThresholdKg: z.number().min(0.1).max(10).default(1.5),
  inactivityDaysThreshold: z.number().int().min(1).max(30).default(2),
  waterTargetMl: z.number().int().min(500).max(10000).default(2000),
  complianceThreshold: z.number().int().min(1).max(100).default(70),
  packageExpiryNoticeDays: z.number().int().min(0).max(30).default(7),
});

export const AuthSnapshotSchema = z.object({
  token: z.string().min(1),
  user: z.string().email(),
  expiresAt: z.number().int().positive(),
});

export const PatientLinkTokenSchema = z.object({
  patientId: z.number().int().positive(),
  dietitianId: z.number().int().positive().optional(),
  expiresAt: z.string().datetime(),
  used: z.boolean().default(false),
});

export const PatientLinksMapSchema = z.record(z.string(), PatientLinkTokenSchema);

export const ExportAuditLogSchema = z.object({
  id: z.string(),
  timestamp: z.string().datetime(),
  dietitian: z.string().min(1),
  type: z.enum(["json", "csv"]),
  patientCount: z.number().int().nonnegative(),
  measurementCount: z.number().int().nonnegative(),
});

export const ExportAuditLogArraySchema = z.array(ExportAuditLogSchema);

export type Patient = z.infer<typeof PatientSchema>;
export type MobileEvent = z.infer<typeof MobileEventSchema>;
export type Appointment = z.infer<typeof AppointmentSchema>;
export type PatientPlan = z.infer<typeof PatientPlanSchema>;
export type AlertRules = z.infer<typeof AlertRuleSchema>;
export type AuthSnapshot = z.infer<typeof AuthSnapshotSchema>;
export type PatientLinkToken = z.infer<typeof PatientLinkTokenSchema>;
export type ExportAuditLog = z.infer<typeof ExportAuditLogSchema>;

export const validateOrRepair = <T>(schema: z.ZodSchema<T>, data: unknown, fallback: T): { data: T; repaired: boolean; issues: string[] } => {
  const result = schema.safeParse(data);
  if (result.success) {
    return { data: result.data, repaired: false, issues: [] };
  }
  const issues = result.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`);
  console.warn("[Schema Validation] Veri onarıldı:", issues);
  return { data: fallback, repaired: true, issues };
};