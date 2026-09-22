export type EquipmentFrequency = 'mensual' | 'trimestral' | 'semestral' | 'anual' | 'personalizada';

export type EquipmentStatus = 'activo' | 'baja';

export type ExecutionStatus = 'pendiente' | 'ejecutado' | 'atrasado';

export type AreaType = 'aula' | 'laboratorio' | 'datacenter' | 'oficina' | 'auditorio' | 'infraestructura' | 'otro';

export interface CampusLocation {
  id: string;
  name: string; // ej: "Data Center Principal"
  building: string; // ej: "Edificio Administrativo", "Bloque Bachillerato", "Bloque Primaria"
  areaType: AreaType;
  description?: string;
  status: 'activa' | 'inactiva';
  createdAt: string;
  updatedAt: string;
}

export interface Equipment {
  id: string;
  code: string; // ej: AP-01, SW-01, PC-01, PY-01
  name: string;
  location: string;
  brand: string;
  model: string;
  serial: string;
  parts: string[]; // Lista editable de partes/componentes
  maintenanceTasks: string[]; // Lista editable de tareas a realizar
  frequency: EquipmentFrequency;
  customMonths?: number[]; // Meses seleccionados si es 'personalizada' (1 a 12)
  status: EquipmentStatus;
  observations?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnnualPlanMatrix {
  year: number;
  // Map of equipmentId -> array of 12 booleans (index 0 = Ene, index 11 = Dic)
  schedules: Record<string, boolean[]>;
}

export type MaintenanceType = 'preventivo' | 'correctivo';

export interface MaintenanceExecution {
  id: string; // unique ID or `${equipmentId}_${year}_${month}` or `${equipmentId}_corr_${timestamp}`
  equipmentId: string;
  year: number;
  month: number; // 1 to 12
  scheduledDate?: string; // YYYY-MM-DD (debe ser día hábil: lunes a viernes)
  isExecuted: boolean;
  executedDate?: string; // YYYY-MM-DD HH:mm
  responsibleName?: string;
  responsibleRole?: string;
  signatureDataUrl?: string; // Firma capturada en canvas o confirmación digital
  completedTasks: string[]; // Tareas verificadas de la lista de tareas del equipo
  partsReplaced?: string[];
  observations?: string;
  // Campos de Mantenimiento Correctivo
  maintenanceType?: MaintenanceType; // 'preventivo' | 'correctivo'
  failureDescription?: string; // Descripción del problema / falla reportada
  actionTaken?: string; // Solución / Acción correctiva realizada
  downtimeHours?: number; // Tiempo fuera de servicio (horas)
  finalOperationalStatus?: 'operativo' | 'requiere_repuesto' | 'baja'; // Estado final
  createdAt: string;
  updatedAt: string;
}

export interface PlateOcrResult {
  detectedCode?: string;
  detectedBrand?: string;
  detectedModel?: string;
  detectedSerial?: string;
  deviceType?: string;
  specsFound?: string;
  rawText?: string;
}

export interface MaintenanceStats {
  totalScheduled: number;
  totalExecuted: number;
  totalOverdue: number;
  totalPending: number;
  complianceRate: number; // percentage
}

export interface DatabaseBackupMetadata {
  createdAt: string;
  version: string;
  institution: string;
  system: string;
  equipmentCount: {
    total: number;
    active: number;
    inactive: number;
  };
  locationsCount: number;
  buildingsCount: number;
  executionsCount: number;
  annualPlansYears: number[];
}

export interface DatabaseBackupData {
  equipments: Equipment[];
  annualPlans: Record<string, Record<string, boolean[]>>;
  executions: MaintenanceExecution[];
  locations: CampusLocation[];
  buildings: string[];
  technicianSignature?: string | null;
}

export interface DatabaseBackup {
  metadata: DatabaseBackupMetadata;
  data: DatabaseBackupData;
}

