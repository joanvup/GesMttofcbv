import {
  Equipment,
  AnnualPlanMatrix,
  MaintenanceExecution,
  EquipmentFrequency,
  CampusLocation,
  AreaType,
  DatabaseBackup,
  DatabaseBackupData,
  DatabaseBackupMetadata
} from '../types';

const STORAGE_KEYS = {
  EQUIPMENT: 'fcbv_equipment_list_v1',
  ANNUAL_PLANS: 'fcbv_annual_plans_v1',
  EXECUTIONS: 'fcbv_executions_v1',
  LOCATIONS: 'fcbv_locations_list_v1',
  BUILDINGS: 'fcbv_buildings_list_v1',
};

export const INITIAL_BUILDINGS: string[] = [
  'Edificio Administrativo',
  'Bloque Bachillerato',
  'Bloque Primaria',
  'Edificio Central',
  'Edificio Cultural',
  'Edificio de Servicios',
  'Campus Externo'
];

// Deduce el tipo de área institucional a partir del nombre de la ubicación
export function inferAreaType(name: string): AreaType {
  const s = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (s.includes('data') || s.includes('server') || s.includes('servidor') || s.includes('rack') || s.includes('ups') || s.includes('switch') || s.includes('cableado')) {
    return 'datacenter';
  }
  if (s.includes('lab') || s.includes('computo') || s.includes('sistemas') || s.includes('informatica') || s.includes('fisica') || s.includes('quimica') || s.includes('robotica') || s.includes('maker') || s.includes('stem')) {
    return 'laboratorio';
  }
  if (s.includes('aula') || s.includes('salon') || s.includes('clase') || s.includes('grado') || s.includes('biblioteca') || s.includes('docente') || s.includes('preescolar') || s.includes('primaria') || s.includes('bachillerato')) {
    return 'aula';
  }
  if (s.includes('oficina') || s.includes('admin') || s.includes('coordinacion') || s.includes('rectoria') || s.includes('secretaria') || s.includes('psicologia') || s.includes('sala de juntas') || s.includes('direccion') || s.includes('contabilidad') || s.includes('admision')) {
    return 'oficina';
  }
  if (s.includes('auditorio') || s.includes('teatro') || s.includes('coliseo') || s.includes('cancha') || s.includes('polideportivo') || s.includes('gimnasio') || s.includes('evento')) {
    return 'auditorio';
  }
  if (s.includes('infra') || s.includes('electr') || s.includes('red') || s.includes('planta') || s.includes('subestacion') || s.includes('tablero') || s.includes('bomba') || s.includes('caldera') || s.includes('cuarto')) {
    return 'infraestructura';
  }
  return 'otro';
}

// Deduce el edificio o bloque institucional a partir del nombre de la ubicación
export function inferBuilding(
  locationName: string,
  existingBuildings: string[] = INITIAL_BUILDINGS,
  defaultBuilding: string = 'Edificio Central'
): string {
  const s = locationName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Verificar si menciona un edificio existente
  for (const b of existingBuildings) {
    const bNorm = b.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (s.includes(bNorm)) {
      return b;
    }
  }

  if (s.includes('bachillerato') || s.includes('secundaria') || s.includes('media') || s.includes('decimo') || s.includes('once') || s.includes('bach')) {
    const found = existingBuildings.find((b) => b.toLowerCase().includes('bachillerato'));
    return found || 'Bloque Bachillerato';
  }

  if (s.includes('primaria') || s.includes('preescolar') || s.includes('infantil') || s.includes('kinder') || s.includes('transicion') || s.includes('prim')) {
    const found = existingBuildings.find((b) => b.toLowerCase().includes('primaria'));
    return found || 'Bloque Primaria';
  }

  if (s.includes('admin') || s.includes('rectoria') || s.includes('secretaria') || s.includes('admision') || s.includes('datacenter') || s.includes('server') || s.includes('coordinacion') || s.includes('ti')) {
    const found = existingBuildings.find((b) => b.toLowerCase().includes('admin'));
    return found || 'Edificio Administrativo';
  }

  if (s.includes('biblioteca') || s.includes('auditorio') || s.includes('teatro') || s.includes('cultural') || s.includes('musica') || s.includes('arte') || s.includes('danza')) {
    const found = existingBuildings.find((b) => b.toLowerCase().includes('cultural'));
    return found || 'Edificio Cultural';
  }

  if (s.includes('cafeteria') || s.includes('comedor') || s.includes('enfermeria') || s.includes('mantenimiento') || s.includes('almacen') || s.includes('taller') || s.includes('cocina')) {
    const found = existingBuildings.find((b) => b.toLowerCase().includes('servicio'));
    return found || 'Edificio de Servicios';
  }

  if (s.includes('cancha') || s.includes('patio') || s.includes('exterior') || s.includes('porteria') || s.includes('parqueadero') || s.includes('acceso') || s.includes('coliseo')) {
    const found = existingBuildings.find((b) => b.toLowerCase().includes('externo'));
    return found || 'Campus Externo';
  }

  return defaultBuilding || 'Edificio Central';
}

export const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const MONTH_SHORT_NAMES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

// Calcula los 12 meses por defecto para una frecuencia
export function getDefaultMonthsForFrequency(
  frequency: EquipmentFrequency,
  customMonths?: number[],
  startMonthIndex?: number
): boolean[] {
  const result = new Array(12).fill(false);

  // Si se proporciona un mes de inicio específico (0=Enero ... 11=Diciembre)
  if (startMonthIndex !== undefined && startMonthIndex >= 0 && startMonthIndex < 12) {
    switch (frequency) {
      case 'mensual':
        for (let m = startMonthIndex; m < 12; m += 1) {
          result[m] = true;
        }
        return result;
      case 'trimestral':
        for (let m = startMonthIndex; m < 12; m += 3) {
          result[m] = true;
        }
        return result;
      case 'semestral':
        for (let m = startMonthIndex; m < 12; m += 6) {
          result[m] = true;
        }
        return result;
      case 'anual':
        result[startMonthIndex] = true;
        return result;
      case 'personalizada':
        if (customMonths && customMonths.length > 0) {
          customMonths.forEach((m) => {
            if (m >= 1 && m <= 12) result[m - 1] = true;
          });
        } else {
          result[startMonthIndex] = true;
        }
        return result;
      default:
        return result;
    }
  }

  // Comportamiento predeterminado histórico cuando no se especifica mes de inicio
  switch (frequency) {
    case 'mensual':
      return new Array(12).fill(true);
    case 'trimestral':
      // Mar, Jun, Sep, Dic (meses 3, 6, 9, 12 -> índices 2, 5, 8, 11)
      result[2] = true;
      result[5] = true;
      result[8] = true;
      result[11] = true;
      return result;
    case 'semestral':
      // Jun, Dic (meses 6, 12 -> índices 5, 11)
      result[5] = true;
      result[11] = true;
      return result;
    case 'anual':
      // Noviembre (mes 11 -> índice 10)
      result[10] = true;
      return result;
    case 'personalizada':
      if (customMonths && customMonths.length > 0) {
        customMonths.forEach((m) => {
          if (m >= 1 && m <= 12) result[m - 1] = true;
        });
      }
      return result;
    default:
      return result;
  }
}

// Verifica si una fecha es día hábil (lunes=1 a viernes=5)
export function isBusinessDay(dateStr: string): boolean {
  if (!dateStr) return false;
  // Parse date safely
  const parts = dateStr.split('-');
  if (parts.length !== 3) return false;
  const date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

// Obtiene el primer día hábil de un mes y año dados (YYYY-MM-DD)
export function getFirstBusinessDayOfMonth(year: number, month: number): string {
  for (let day = 1; day <= 31; day++) {
    const d = new Date(year, month - 1, day);
    if (d.getMonth() !== month - 1) break;
    const dayOfWeek = d.getDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      const dd = String(day).padStart(2, '0');
      const mm = String(month).padStart(2, '0');
      return `${year}-${mm}-${dd}`;
    }
  }
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

// Seed inicial representativo para el Colegio FCBV
const INITIAL_EQUIPMENTS: Equipment[] = [
  {
    id: 'eq-ap-01',
    code: 'AP-01',
    name: 'Access Point Wi-Fi 6 Cisco Catalyst 9115AX',
    location: 'Sala de Cómputo Bachillerato 1',
    brand: 'Cisco',
    model: 'C9115AXI-A',
    serial: 'FOC241923K4',
    parts: ['Fuente de alimentación PoE', 'Antenas omnidireccionales', 'Puerto RJ-45 Gigabit', 'Chasis de disipación'],
    maintenanceTasks: [
      'Limpieza externa y remoción de polvo en rendijas de ventilación',
      'Inspección del cableado estructurado Cat6A y conector RJ45',
      'Verificación de potencia de transmisión y canal de radio',
      'Actualización/comprobación de firmware en Cisco DNA Spaces',
      'Prueba de velocidad y cobertura con analizador de espectro'
    ],
    frequency: 'trimestral',
    status: 'activo',
    observations: 'Equipo crítico para exámenes virtuales Cambridge y pruebas Saber 11.',
    createdAt: '2025-01-10T08:00:00.000Z',
    updatedAt: '2025-01-10T08:00:00.000Z',
  },
  {
    id: 'eq-sw-01',
    code: 'SW-01',
    name: 'Switch Core Capa 3 Cisco Catalyst 3850 48P PoE+',
    location: 'Data Center Principal - Rack A1',
    brand: 'Cisco',
    model: 'WS-C3850-48P-L',
    serial: 'FCW1948B03L',
    parts: ['Fuentes redundantes duales 1100W', 'Módulo de 4 ventiladores extractores', 'Módulo uplink 10G SFP+', 'Tarjeta de apilamiento StackWise-480'],
    maintenanceTasks: [
      'Aspirado de tolvas y limpieza profunda de ventiladores',
      'Inspección termográfica de fuentes de alimentación PoE',
      'Revisión de logs del sistema y errores CRC en puertos troncales',
      'Respaldo de la configuración Running-Config a servidor TFTP',
      'Prueba de conmutación por falla de fuente redundante'
    ],
    frequency: 'semestral',
    status: 'activo',
    observations: 'Columna vertebral de la red de todo el campus escolar.',
    createdAt: '2025-01-12T09:30:00.000Z',
    updatedAt: '2025-01-12T09:30:00.000Z',
  },
  {
    id: 'eq-pc-01',
    code: 'PC-01',
    name: 'Estación de Trabajo Servidor de Dominio / Active Directory',
    location: 'Oficina de Sistemas y Tecnología',
    brand: 'Dell',
    model: 'OptiPlex 7090 Tower',
    serial: '8GK3TX2',
    parts: ['Procesador Intel Core i7-11700', '32GB RAM DDR4 Kingston', 'Arreglo RAID 1 NVMe 1TB', 'Fuente de poder 80 Plus Gold 500W'],
    maintenanceTasks: [
      'Limpieza física interna, lubricación de ventiladores y cambio de pasta térmica',
      'Verificación del estado de salud SMART de discos SSD NVMe',
      'Limpieza de archivos temporales y optimización de base de datos AD',
      'Comprobación de copia de seguridad local y en nube',
      'Prueba de reinicio controlado y servicios DNS/DHCP'
    ],
    frequency: 'trimestral',
    status: 'activo',
    observations: 'Autentica a todos los docentes, administrativos y estudiantes del colegio.',
    createdAt: '2025-01-15T11:00:00.000Z',
    updatedAt: '2025-01-15T11:00:00.000Z',
  },
  {
    id: 'eq-py-01',
    code: 'PY-01',
    name: 'Proyector Interactivo Láser Epson BrightLink 735Fi',
    location: 'Auditorio Principal San Lucas',
    brand: 'Epson',
    model: 'BrightLink 735Fi',
    serial: 'X79K019482',
    parts: ['Fuente de luz láser', 'Módulo óptico ultra corto', 'Filtro de aire electrostático', 'Sensores táctiles interactivos Finger-touch'],
    maintenanceTasks: [
      'Extracción y soplado del filtro de aire y conducto óptico',
      'Limpieza de lente con solución óptica antiestática',
      'Calibración de los lápices interactivos y alineación de la imagen',
      'Revisión del número de horas del motor láser y temperatura de operación',
      'Ajuste mecánico del soporte de montaje en pared'
    ],
    frequency: 'trimestral',
    status: 'activo',
    observations: 'Utilizado para asambleas de padres, grados y eventos institucionales.',
    createdAt: '2025-01-18T14:20:00.000Z',
    updatedAt: '2025-01-18T14:20:00.000Z',
  },
  {
    id: 'eq-ups-01',
    code: 'UPS-01',
    name: 'Sistema de Energía Ininterrumpida Online APC Smart-UPS RT 10kVA',
    location: 'Data Center Principal - Sala de Respaldo Eléctrico',
    brand: 'APC by Schneider Electric',
    model: 'SRT10KXLI',
    serial: 'AS1934293810',
    parts: ['Banco de 32 baterías 12V 9Ah VRLA', 'Módulo inversor estático', 'Bypass automático y manual', 'Tarjeta de gestión de red SNMP AP9631'],
    maintenanceTasks: [
      'Medición de voltaje individual y resistencia interna por cada celda de batería',
      'Inspección termográfica de bornes de conexión y torque de tornillería',
      'Simulación de corte de energía con transferencia a modo batería bajo carga real',
      'Prueba de sensores de temperatura y humedad ambiental de la sala',
      'Limpieza de ventiladores y revisión de alarmas en el log SNMP'
    ],
    frequency: 'mensual',
    status: 'activo',
    observations: 'Protege servidores de calificaciones, conmutación de red y telefonía IP.',
    createdAt: '2025-01-20T10:00:00.000Z',
    updatedAt: '2025-01-20T10:00:00.000Z',
  },
  {
    id: 'eq-aa-01',
    code: 'AA-01',
    name: 'Unidad de Climatización de Precisión InRow 5TR',
    location: 'Data Center Principal',
    brand: 'Liebert Emerson',
    model: 'CRV-CR020',
    serial: 'EM1840291-C',
    parts: ['Compresor Scroll digital', 'Filtros de aire MERV 11', 'Bomba de drenaje de condensado', 'Ventiladores EC de velocidad variable'],
    maintenanceTasks: [
      'Lavado y desinfección de serpentines evaporador y condensador',
      'Sustitución/lavado de filtros de aire de partículas finas',
      'Medición de presiones de gas refrigerante R-410A y recalentamiento',
      'Verificación y prueba del flotador de la bomba de drenaje de condensado',
      'Calibración de sonda de temperatura y control digital'
    ],
    frequency: 'mensual',
    status: 'activo',
    observations: 'Mantiene temperatura constante a 20°C y 50% humedad en servidores.',
    createdAt: '2025-01-22T08:30:00.000Z',
    updatedAt: '2025-01-22T08:30:00.000Z',
  },
  {
    id: 'eq-sw-02',
    code: 'SW-02',
    name: 'Switch de Distribución Cisco SG350-28P Gigabit PoE',
    location: 'Edificio Primaria - Rack Piso 2',
    brand: 'Cisco',
    model: 'SG350-28P',
    serial: 'DNI2209124A',
    parts: ['Fuente de alimentación integrada', '2 Ventiladores laterales', '24 Puertos 10/100/1000 + 2 SFP'],
    maintenanceTasks: [
      'Soplado de polvo y verificación de giro libre de ventiladores',
      'Revisión física del patch cord y marcado de puertos',
      'Comprobación de consumo de potencia PoE por puerto',
      'Copia de seguridad del archivo de configuración'
    ],
    frequency: 'semestral',
    status: 'activo',
    observations: 'Alimenta las cámaras de seguridad y puntos de acceso del bloque de primaria.',
    createdAt: '2025-02-01T09:00:00.000Z',
    updatedAt: '2025-02-01T09:00:00.000Z',
  },
  {
    id: 'eq-py-02',
    code: 'PY-02',
    name: 'Proyector Multimedia BenQ MX560 (Antiguo)',
    location: 'Depósito General de Tecnología',
    brand: 'BenQ',
    model: 'MX560',
    serial: 'PDD1837482',
    parts: ['Lámpara de mercurio 200W', 'Rueda de color DLP', 'Balasto electrónico'],
    maintenanceTasks: ['Inspección general de componentes'],
    frequency: 'anual',
    status: 'baja',
    observations: 'Equipo dado de baja por fin de vida útil y falla en balasto.',
    createdAt: '2024-03-01T09:00:00.000Z',
    updatedAt: '2024-11-15T10:00:00.000Z',
  },
];

export const INITIAL_LOCATIONS: CampusLocation[] = [
  {
    id: 'loc-dc-01',
    name: 'Data Center Principal',
    building: 'Edificio Administrativo',
    areaType: 'datacenter',
    description: 'Sala de servidores central, control de temperatura de precisión y acceso con tarjeta biométrica.',
    status: 'activa',
    createdAt: '2025-01-01T08:00:00.000Z',
    updatedAt: '2025-01-01T08:00:00.000Z',
  },
  {
    id: 'loc-dc-02',
    name: 'Data Center Principal - Rack A1',
    building: 'Edificio Administrativo',
    areaType: 'datacenter',
    description: 'Rack principal de telecomunicaciones, patch panels y switches de capa 3.',
    status: 'activa',
    createdAt: '2025-01-01T08:00:00.000Z',
    updatedAt: '2025-01-01T08:00:00.000Z',
  },
  {
    id: 'loc-dc-03',
    name: 'Data Center Principal - Sala de Respaldo Eléctrico',
    building: 'Edificio Administrativo',
    areaType: 'infraestructura',
    description: 'Bancos de baterías, UPS online 10kVA y tableros regulados de energía.',
    status: 'activa',
    createdAt: '2025-01-01T08:00:00.000Z',
    updatedAt: '2025-01-01T08:00:00.000Z',
  },
  {
    id: 'loc-bach-01',
    name: 'Sala de Cómputo Bachillerato 1',
    building: 'Bloque Bachillerato',
    areaType: 'laboratorio',
    description: '30 estaciones para estudiantes de secundaria y exámenes virtuales Cambridge.',
    status: 'activa',
    createdAt: '2025-01-02T08:00:00.000Z',
    updatedAt: '2025-01-02T08:00:00.000Z',
  },
  {
    id: 'loc-bach-02',
    name: 'Sala de Cómputo Bachillerato 2',
    building: 'Bloque Bachillerato',
    areaType: 'laboratorio',
    description: 'Laboratorio de robótica, informática avanzada y diseño digital.',
    status: 'activa',
    createdAt: '2025-01-02T08:00:00.000Z',
    updatedAt: '2025-01-02T08:00:00.000Z',
  },
  {
    id: 'loc-prim-01',
    name: 'Laboratorio de Primaria',
    building: 'Bloque Primaria',
    areaType: 'laboratorio',
    description: 'Aulas de tecnología para estudiantes de educación primaria.',
    status: 'activa',
    createdAt: '2025-01-03T08:00:00.000Z',
    updatedAt: '2025-01-03T08:00:00.000Z',
  },
  {
    id: 'loc-prim-02',
    name: 'Edificio Primaria - Rack Piso 2',
    building: 'Bloque Primaria',
    areaType: 'infraestructura',
    description: 'Armario de red para interconexión de cámaras de seguridad y APs de primaria.',
    status: 'activa',
    createdAt: '2025-01-03T08:00:00.000Z',
    updatedAt: '2025-01-03T08:00:00.000Z',
  },
  {
    id: 'loc-aud-01',
    name: 'Auditorio Principal San Lucas',
    building: 'Edificio Central',
    areaType: 'auditorio',
    description: 'Espacio multifuncional para grados, asambleas de padres y eventos institucionales.',
    status: 'activa',
    createdAt: '2025-01-04T08:00:00.000Z',
    updatedAt: '2025-01-04T08:00:00.000Z',
  },
  {
    id: 'loc-adm-01',
    name: 'Oficina de Sistemas y Tecnología',
    building: 'Edificio Administrativo',
    areaType: 'oficina',
    description: 'Taller de soporte técnico, mesa de ayuda y servidores de dominio local.',
    status: 'activa',
    createdAt: '2025-01-05T08:00:00.000Z',
    updatedAt: '2025-01-05T08:00:00.000Z',
  },
  {
    id: 'loc-dep-01',
    name: 'Depósito General de Tecnología',
    building: 'Edificio de Servicios',
    areaType: 'otro',
    description: 'Almacenamiento de equipos dados de baja, repuestos y herramientas.',
    status: 'activa',
    createdAt: '2025-01-05T08:00:00.000Z',
    updatedAt: '2025-01-05T08:00:00.000Z',
  },
  {
    id: 'loc-bib-01',
    name: 'Biblioteca General',
    building: 'Edificio Cultural',
    areaType: 'aula',
    description: 'Área de consulta académica y estaciones de trabajo para investigación.',
    status: 'activa',
    createdAt: '2025-01-06T08:00:00.000Z',
    updatedAt: '2025-01-06T08:00:00.000Z',
  },
  {
    id: 'loc-ext-01',
    name: 'Caseta de Generación y Subestación',
    building: 'Campus Externo',
    areaType: 'infraestructura',
    description: 'Planta eléctrica diésel y sistema de conmutación de energía de emergencia.',
    status: 'activa',
    createdAt: '2025-01-06T08:00:00.000Z',
    updatedAt: '2025-01-06T08:00:00.000Z',
  },
];

const IS_CLEARED_KEY = 'fcbv_is_cleared_v1';

const INITIAL_EXECUTIONS_SEED: MaintenanceExecution[] = [
  {
    id: 'exec_eq-ups-01_2026_1',
    equipmentId: 'eq-ups-01',
    year: 2026,
    month: 1,
    scheduledDate: '2026-01-16',
    isExecuted: true,
    executedDate: '2026-01-16 10:45',
    responsibleName: 'Ing. Carlos Mendoza',
    responsibleRole: 'Líder de Infraestructura y Mantenimiento FCBV',
    signatureDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    completedTasks: [
      'Medición de voltaje individual y resistencia interna por cada celda de batería',
      'Inspección termográfica de bornes de conexión y torque de tornillería',
      'Limpieza de ventiladores y revisión de alarmas en el log SNMP'
    ],
    observations: 'Baterías operando al 98% de capacidad nominal. Sin alarmas en el bus.',
    createdAt: '2026-01-16T10:45:00.000Z',
    updatedAt: '2026-01-16T10:45:00.000Z',
  },
  {
    id: 'exec_eq-aa-01_2026_1',
    equipmentId: 'eq-aa-01',
    year: 2026,
    month: 1,
    scheduledDate: '2026-01-23',
    isExecuted: true,
    executedDate: '2026-01-23 15:30',
    responsibleName: 'Téc. Andrés Peña',
    responsibleRole: 'Técnico Especialista Climatización',
    signatureDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    completedTasks: [
      'Lavado y desinfección de serpentines evaporador y condensador',
      'Sustitución/lavado de filtros de aire de partículas finas',
      'Calibración de sonda de temperatura y control digital'
    ],
    observations: 'Filtros reemplazados por repuestos nuevos MERV 11.',
    partsReplaced: ['2x Filtros MERV 11'],
    createdAt: '2026-01-23T15:30:00.000Z',
    updatedAt: '2026-01-23T15:30:00.000Z',
  },
  {
    id: 'exec_eq-ap-01_2026_3',
    equipmentId: 'eq-ap-01',
    year: 2026,
    month: 3,
    scheduledDate: '2026-03-12',
    isExecuted: true,
    executedDate: '2026-03-12 11:15',
    responsibleName: 'Ing. Carlos Mendoza',
    responsibleRole: 'Líder de Infraestructura y Mantenimiento FCBV',
    signatureDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    completedTasks: [
      'Limpieza externa y remoción de polvo en rendijas de ventilación',
      'Inspección del cableado estructurado Cat6A y conector RJ45',
      'Verificación de potencia de transmisión y canal de radio',
      'Prueba de velocidad y cobertura con analizador de espectro'
    ],
    observations: 'Firmware verificado versión 17.9.4a. Cobertura óptima.',
    createdAt: '2026-03-12T11:15:00.000Z',
    updatedAt: '2026-03-12T11:15:00.000Z',
  }
];

// Helper para obtener el almacenamiento local

const getAuthHeaders = () => {
  const token = localStorage.getItem('fcbv_token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

const apiCall = async (url: string, method: string = 'GET', body?: any) => {
  const res = await fetch(url, { method, headers: getAuthHeaders(), body: body ? JSON.stringify(body) : undefined });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'API Error');
  return data.data !== undefined ? data.data : data;
};

export const StorageService = {
  async getEquipmentList(): Promise<Equipment[]> {
    try { return await apiCall('/api/sync/equipments'); } catch(e) { console.error(e); return []; }
  },

  async saveEquipmentList(list: Equipment[]): Promise<void> {
    try { await apiCall('/api/sync/equipments', 'POST', list); } catch(e) { console.error(e); throw e; }
  },

  // Obtiene la matriz anual para un año específico
  async getAnnualPlan(year: number): Promise<Record<string, boolean[]>> {
    try { 
       const plans = await apiCall('/api/sync/annualPlans'); 
       if (plans[year]) return plans[year];
       // Generar automáticamente a partir de los equipos registrados
       const equipments = await this.getEquipmentList();
       const newPlanForYear: Record<string, boolean[]> = {};
       equipments.forEach((eq: any) => {
         if (eq.status === 'activo') {
           newPlanForYear[eq.id] = getDefaultMonthsForFrequency(eq.frequency, eq.customMonths);
         } else {
           newPlanForYear[eq.id] = new Array(12).fill(false);
         }
       });
       plans[year] = newPlanForYear;
       await this.saveAllAnnualPlans(plans);
       return newPlanForYear;
    } catch(e) { console.error(e); return {}; }
  },

  async saveAnnualPlan(year: number, plan: Record<string, boolean[]>): Promise<void> {
    try { 
      const plans = await apiCall('/api/sync/annualPlans');
      plans[year] = plan;
      await apiCall('/api/sync/annualPlans', 'POST', plans); 
    } catch(e) { console.error(e); throw e; }
  },

  // Sincroniza un equipo en el plan anual cuando se crea, edita o cambia su frecuencia
  async syncEquipmentInPlan(equipment: Equipment, year: number): Promise<void> {
    const plan = await this.getAnnualPlan(year);
    if (equipment.status === 'baja') {
      plan[equipment.id] = new Array(12).fill(false);
    } else if (!plan[equipment.id] || plan[equipment.id].length !== 12) {
      plan[equipment.id] = getDefaultMonthsForFrequency(equipment.frequency, equipment.customMonths);
    }
    await this.saveAnnualPlan(year, plan);
  },

  // Actualiza masivamente la frecuencia de una lista de equipos
  async updateEquipmentsFrequency(equipmentIds: string[], newFrequency: EquipmentFrequency): Promise<Equipment[]> {
    const list = await this.getEquipmentList();
    const idSet = new Set(equipmentIds);
    const updated = list.map((eq) => {
      if (idSet.has(eq.id)) {
        return {
          ...eq,
          frequency: newFrequency,
          updatedAt: new Date().toISOString(),
        };
      }
      return eq;
    });
    await this.saveEquipmentList(updated);
    return updated;
  },

  // Obtiene todas las ejecuciones registradas
  async getExecutions(): Promise<MaintenanceExecution[]> {
    try { return await apiCall('/api/sync/executions'); } catch(e) { console.error(e); return []; }
  },

  async saveExecutions(list: MaintenanceExecution[]): Promise<void> {
    try { await apiCall('/api/sync/executions', 'POST', list); } catch(e) { console.error(e); throw e; }
  },

  // Guarda o actualiza un registro individual de ejecución
  async upsertExecution(execution: MaintenanceExecution): Promise<void> {
    const list = await this.getExecutions();
    const index = list.findIndex(
      (e) => e.equipmentId === execution.equipmentId && e.year === execution.year && e.month === execution.month
    );
    if (index >= 0) {
      list[index] = { ...list[index], ...execution, updatedAt: new Date().toISOString() };
    } else {
      list.push({ ...execution, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    await this.saveExecutions(list);
  },

  // Calcula el estado actual de una tarea de mantenimiento: 'ejecutado' | 'atrasado' | 'pendiente'
  calculateStatus(
    execution: MaintenanceExecution | undefined,
    year: number,
    month: number
  ): 'ejecutado' | 'atrasado' | 'pendiente' {
    if (execution && execution.isExecuted) {
      return 'ejecutado';
    }

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1; // 1 to 12
    const currentDayStr = today.toISOString().split('T')[0];

    // Si tiene fecha programada y esa fecha ya pasó respecto a hoy
    if (execution && execution.scheduledDate) {
      if (execution.scheduledDate < currentDayStr) {
        return 'atrasado';
      }
      return 'pendiente';
    }

    // Si no tiene fecha programada específica aún:
    // Si el año es anterior al actual, está atrasado
    if (year < currentYear) return 'atrasado';
    // Si el año es el actual y el mes ya concluyó, está atrasado
    if (year === currentYear && month < currentMonth) return 'atrasado';

    return 'pendiente';
  },

  // Obtiene la lista de ubicaciones del campus
  async getLocations(): Promise<CampusLocation[]> {
    try { return await apiCall('/api/sync/locations'); } catch(e) { console.error(e); return []; }
  },

  async saveLocations(list: CampusLocation[]): Promise<void> {
    try { await apiCall('/api/sync/locations', 'POST', list); } catch(e) { console.error(e); throw e; }
  },

  // Guarda o actualiza una ubicación y actualiza equipos en cascada si se renombró
  async upsertLocation(location: CampusLocation, oldName?: string): Promise<void> {
    const list = await this.getLocations();
    const index = list.findIndex((l) => l.id === location.id);
    if (index >= 0) {
      list[index] = { ...list[index], ...location, updatedAt: new Date().toISOString() };
    } else {
      list.push({ ...location, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    await this.saveLocations(list);

    // Si el nombre de la ubicación cambió, sincronizar en los equipos asignados a la ubicación anterior
    if (oldName && oldName.trim() !== location.name.trim()) {
      const equipments = await this.getEquipmentList();
      let modified = false;
      const updatedEquipments = equipments.map((eq) => {
        if (eq.location === oldName.trim()) {
          modified = true;
          return { ...eq, location: location.name.trim(), updatedAt: new Date().toISOString() };
        }
        return eq;
      });
      if (modified) {
        await this.saveEquipmentList(updatedEquipments);
      }
    }
  },

  // Elimina una ubicación
  async deleteLocation(locationId: string): Promise<{ success: boolean; message: string; affectedEquipmentsCount: number }> {
    const list = await this.getLocations();
    const target = list.find((l) => l.id === locationId);
    if (!target) {
      return { success: false, message: 'Ubicación no encontrada.', affectedEquipmentsCount: 0 };
    }

    const equipments = await this.getEquipmentList();
    const affected = equipments.filter((eq) => eq.location === target.name);

    const updatedList = list.filter((l) => l.id !== locationId);
    await await this.saveLocations(updatedList);

    return { 
      success: true, 
      message: `Ubicación "${target.name}" eliminada correctamente.`, 
      affectedEquipmentsCount: affected.length 
    };
  },

  // Asegura que una lista de ubicaciones existan en el campus; si no existen, las crea automáticamente
  async ensureLocationsExist(locationsToCheck: { name: string; building?: string; areaType?: AreaType; description?: string; }[]): Promise<{ createdLocations: CampusLocation[]; allLocations: CampusLocation[] }> {
    const list = await this.getLocations();
    const existingMap = new Map<string, CampusLocation>();
    list.forEach((l) => existingMap.set(l.name.toLowerCase().trim(), l));

    const currentBuildings = this.getBuildings();
    const buildingsSet = new Set<string>(currentBuildings);
    let buildingsModified = false;

    const createdLocations: CampusLocation[] = [];
    const now = new Date().toISOString();

    locationsToCheck.forEach((item, index) => {
      const trimmedName = item.name ? item.name.trim() : '';
      if (!trimmedName) return;
      const key = trimmedName.toLowerCase();

      if (!existingMap.has(key)) {
        const areaType: AreaType = item.areaType || inferAreaType(trimmedName);
        const building: string = (item.building && item.building.trim())
          ? item.building.trim()
          : inferBuilding(trimmedName, currentBuildings);

        // Si el edificio es nuevo, registrarlo en el catálogo institucional
        if (building && !buildingsSet.has(building)) {
          buildingsSet.add(building);
          buildingsModified = true;
        }

        const newLoc: CampusLocation = {
          id: `loc_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 6)}`,
          name: trimmedName,
          building: building || 'Edificio Central',
          areaType,
          description: item.description || `Ubicación creada automáticamente al importar equipos críticos vía Excel.`,
          status: 'activa',
          createdAt: now,
          updatedAt: now,
        };

        list.push(newLoc);
        existingMap.set(key, newLoc);
        createdLocations.push(newLoc);
      }
    });

    if (createdLocations.length > 0) {
       this.saveLocations(list);
    }

    if (buildingsModified) {
       this.saveBuildings(Array.from(buildingsSet));
    }

    return { createdLocations, allLocations: list };
  },

  // --------------------------------------------------------------------------
  // GESTIÓN DE EDIFICIOS Y BLOQUES INSTITUCIONALES (EDITABLES)
  // --------------------------------------------------------------------------
  async getBuildings(): Promise<string[]> {
    try { return await apiCall('/api/sync/buildings'); } catch(e) { console.error(e); return []; }
  },

  async saveBuildings(list: string[]): Promise<void> {
    try { await apiCall('/api/sync/buildings', 'POST', list); } catch(e) { console.error(e); }
  },

  async addBuilding(name: string): Promise<{ success: boolean; message: string; buildings: string[] }> {
    const trimmed = name.trim();
    if (!trimmed) {
      return { success: false, message: 'El nombre del edificio no puede estar vacío.', buildings: this.getBuildings() };
    }
    const list =  this.getBuildings();
    if (list.some((b) => b.toLowerCase() === trimmed.toLowerCase())) {
      return { success: false, message: `El edificio o bloque "${trimmed}" ya existe en el catálogo.`, buildings: list };
    }
    const updated = [...list, trimmed];
     this.saveBuildings(updated);
    return { success: true, message: `Edificio o bloque "${trimmed}" agregado con éxito.`, buildings: updated };
  },

  async renameBuilding(oldName: string, newName: string): Promise<{ success: boolean; message: string; buildings: string[]; affectedLocationsCount: number }> {
    const trimmedOld = oldName.trim();
    const trimmedNew = newName.trim();
    if (!trimmedNew) {
      return { success: false, message: 'El nuevo nombre no puede estar vacío.', buildings: this.getBuildings(), affectedLocationsCount: 0 };
    }
    const list =  this.getBuildings();
    if (trimmedOld.toLowerCase() !== trimmedNew.toLowerCase() && list.some((b) => b.toLowerCase() === trimmedNew.toLowerCase())) {
      return { success: false, message: `Ya existe un edificio con el nombre "${trimmedNew}".`, buildings: list, affectedLocationsCount: 0 };
    }

    const updatedBuildings = list.map((b) => (b.toLowerCase() === trimmedOld.toLowerCase() ? trimmedNew : b));
     this.saveBuildings(updatedBuildings);

    // Sincronizar en cascada todas las ubicaciones asociadas al edificio
    const locations =  this.getLocations();
    let affected = 0;
    const updatedLocations = locations.map((loc) => {
      if (loc.building.toLowerCase() === trimmedOld.toLowerCase()) {
        affected++;
        return { ...loc, building: trimmedNew, updatedAt: new Date().toISOString() };
      }
      return loc;
    });

    if (affected > 0) {
       this.saveLocations(updatedLocations);
    }

    return {
      success: true,
      message: `Edificio renombrado a "${trimmedNew}". Se actualizaron ${affected} ubicaciones asociadas.`,
      buildings: updatedBuildings,
      affectedLocationsCount: affected,
    };
  },

  async deleteBuilding(name: string, reassignTo?: string): Promise<{ success: boolean; message: string; buildings: string[]; affectedLocationsCount: number }> {
    const trimmed = name.trim();
    const list = await this.getBuildings();
    const updatedBuildings = list.filter((b) => b.toLowerCase() !== trimmed.toLowerCase());
     this.saveBuildings(updatedBuildings);

    // Si hay ubicaciones asociadas, reasignarlas
    const locations =  this.getLocations();
    let affected = 0;
    const targetReassign = reassignTo && reassignTo.trim() ? reassignTo.trim() : (updatedBuildings[0] || 'Campus Principal');

    const updatedLocations = locations.map((loc) => {
      if (loc.building.toLowerCase() === trimmed.toLowerCase()) {
        affected++;
        return { ...loc, building: targetReassign, updatedAt: new Date().toISOString() };
      }
      return loc;
    });

    if (affected > 0) {
       this.saveLocations(updatedLocations);
    }

    return {
      success: true,
      message: `Edificio "${trimmed}" eliminado.${affected > 0 ? ` Se reasignaron ${affected} ubicaciones a "${targetReassign}".` : ''}`,
      buildings: updatedBuildings,
      affectedLocationsCount: affected,
    };
  },

  // Limpia todos los datos demo de la app para que el usuario pueda empezar desde cero con datos reales
  async clearAllData(options?: { preserveLocations?: boolean }): Promise<{ clearedEquipments: number; clearedLocations: number; clearedExecutions: number; }> {
    try {
      const res = await apiCall('/api/database/clear-data', 'POST', options);
      return {
        clearedEquipments: res.clearedEquipments || 0,
        clearedLocations: res.clearedLocations || 0,
        clearedExecutions: res.clearedExecutions || 0,
      };
    } catch (e: any) {
      console.error(e);
      return { clearedEquipments: 0, clearedLocations: 0, clearedExecutions: 0 };
    }
  },

  // Restaura los datos de demostración si el usuario lo desea
  async resetToDefault(): Promise<void> {
    try {
      await apiCall('/api/database/reset-to-default', 'POST');
    } catch (e: any) {
      console.error(e);
    }
  },

  INITIAL_BUILDINGS,

  // Verifica si hay datos cargados en el sistema
  async hasAnyData(): Promise<boolean> {
    return (await this.getEquipmentList()).length > 0 || (await this.getLocations()).length > 0 || (await this.getExecutions()).length > 0;
  },

  // --------------------------------------------------------------------------
  // COPIAS DE SEGURIDAD Y RESTAURACIÓN (BACKUP & RESTORE)
  // --------------------------------------------------------------------------
  getAllAnnualPlans(): Record<string, Record<string, boolean[]>> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ANNUAL_PLANS);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      console.error('Error loading all annual plans', e);
      return {};
    }
  },

  async saveAllAnnualPlans(plans: Record<string, Record<string, boolean[]>>): Promise<void> {
    try { await apiCall('/api/sync/annualPlans', 'POST', plans); } catch(e) { console.error(e); }
  },

  async createFullBackup(): Promise<DatabaseBackup> {
    const equipments = await this.getEquipmentList();
    const annualPlans = await apiCall('/api/sync/annualPlans');
    const executions = await this.getExecutions();
    const locations = await this.getLocations();
    const buildings = await this.getBuildings();
    const technicianSignature = localStorage.getItem('fcbv_technician_signature');

    const years = Object.keys(annualPlans)
      .map(Number)
      .filter((n) => !isNaN(n))
      .sort((a, b) => a - b);

    const activeEquipments = equipments.filter((e) => e.status === 'activo').length;

    const metadata: DatabaseBackupMetadata = {
      createdAt: new Date().toISOString(),
      version: '1.0.0',
      institution: 'Colegio Bilingüe FCBV',
      system: 'Sistema de Mantenimiento Preventivo de Equipos Críticos',
      equipmentCount: {
        total: equipments.length,
        active: activeEquipments,
        inactive: equipments.length - activeEquipments,
      },
      locationsCount: locations.length,
      buildingsCount: buildings.length,
      executionsCount: executions.length,
      annualPlansYears: years,
    };

    const data: DatabaseBackupData = {
      equipments,
      annualPlans,
      executions,
      locations,
      buildings,
      technicianSignature,
    };

    return { metadata, data };
  },

  async downloadBackupFile(customFilename?: string): Promise<string> {
    const backup = await this.createFullBackup();
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
    const filename = customFilename || `FCBV_Respaldo_BaseDatos_${dateStr}.json`;

    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return filename;
  },

  async validateBackup(jsonContent: any): Promise<{
    valid: boolean;
    error?: string;
    metadata?: DatabaseBackupMetadata;
    data?: DatabaseBackupData;
  }> {
    if (!jsonContent || typeof jsonContent !== 'object') {
      return { valid: false, error: 'El archivo no contiene una estructura JSON válida.' };
    }

    // Soporte para estructura estandarizada { metadata, data } o estructura directa
    const dataPayload: any = jsonContent.data ? jsonContent.data : jsonContent;

    if (!Array.isArray(dataPayload.equipments) && !Array.isArray(dataPayload.locations)) {
      return {
        valid: false,
        error: 'El archivo de respaldo no contiene datos de Equipos ni de Ubicaciones válidos.',
      };
    }

    const equipments: Equipment[] = Array.isArray(dataPayload.equipments) ? dataPayload.equipments : [];
    const locations: CampusLocation[] = Array.isArray(dataPayload.locations) ? dataPayload.locations : [];
    const executions: MaintenanceExecution[] = Array.isArray(dataPayload.executions) ? dataPayload.executions : [];
    const buildings: string[] = Array.isArray(dataPayload.buildings) ? dataPayload.buildings : [];
    const annualPlans: Record<string, Record<string, boolean[]>> =
      dataPayload.annualPlans && typeof dataPayload.annualPlans === 'object' ? dataPayload.annualPlans : {};
    const technicianSignature = dataPayload.technicianSignature || null;

    const years = Object.keys(annualPlans)
      .map(Number)
      .filter((n) => !isNaN(n))
      .sort((a, b) => a - b);

    const activeCount = equipments.filter((e) => e.status === 'activo').length;

    const metadata: DatabaseBackupMetadata = jsonContent.metadata && typeof jsonContent.metadata === 'object'
      ? {
          createdAt: jsonContent.metadata.createdAt || new Date().toISOString(),
          version: jsonContent.metadata.version || '1.0.0',
          institution: jsonContent.metadata.institution || 'Colegio Bilingüe FCBV',
          system: jsonContent.metadata.system || 'Sistema de Mantenimiento Preventivo de Equipos Críticos',
          equipmentCount: {
            total: equipments.length,
            active: activeCount,
            inactive: equipments.length - activeCount,
          },
          locationsCount: locations.length,
          buildingsCount: buildings.length,
          executionsCount: executions.length,
          annualPlansYears: years,
        }
      : {
          createdAt: new Date().toISOString(),
          version: '1.0.0',
          institution: 'Colegio Bilingüe FCBV',
          system: 'Sistema de Mantenimiento Preventivo de Equipos Críticos',
          equipmentCount: {
            total: equipments.length,
            active: activeCount,
            inactive: equipments.length - activeCount,
          },
          locationsCount: locations.length,
          buildingsCount: buildings.length,
          executionsCount: executions.length,
          annualPlansYears: years,
        };

    const cleanData: DatabaseBackupData = {
      equipments,
      locations,
      executions,
      buildings,
      annualPlans,
      technicianSignature,
    };

    return {
      valid: true,
      metadata,
      data: cleanData,
    };
  },

  async restoreBackup(backupData: DatabaseBackupData, mode: 'overwrite' | 'merge' = 'overwrite'): Promise<{ success: boolean; restoredEquipments: number; restoredLocations: number; restoredExecutions: number; restoredPlansYears: number[]; }> {
    try {
      localStorage.removeItem(IS_CLEARED_KEY);

      if (mode === 'overwrite') {
        await this.saveEquipmentList(backupData.equipments);
        await this.saveLocations(backupData.locations);
        await this.saveBuildings(backupData.buildings.length > 0 ? backupData.buildings : INITIAL_BUILDINGS);
        await this.saveExecutions(backupData.executions);
        await this.saveAllAnnualPlans(backupData.annualPlans);

        if (backupData.technicianSignature) {
          await this.saveTechnicianSignature(backupData.technicianSignature);
        }

        const years = Object.keys(backupData.annualPlans).map(Number).filter((n) => !isNaN(n));

        return {
          success: true,
          restoredEquipments: backupData.equipments.length,
          restoredLocations: backupData.locations.length,
          restoredExecutions: backupData.executions.length,
          restoredPlansYears: years,
        };
      } else {
        // Modo Fusión (Merge inteligente)
        // 1. Equipos
        const currentEquipments = await this.getEquipmentList();
        const eqCodeMap = new Map<string, Equipment>();
        currentEquipments.forEach((eq) => eqCodeMap.set(eq.code.toUpperCase().trim(), eq));

        let addedEquipments = 0;
        backupData.equipments.forEach((backupEq) => {
          const key = backupEq.code.toUpperCase().trim();
          if (!eqCodeMap.has(key)) {
            eqCodeMap.set(key, backupEq);
            addedEquipments++;
          }
        });
        const mergedEquipments = Array.from(eqCodeMap.values());
        await this.saveEquipmentList(mergedEquipments);

        // 2. Ubicaciones
        const currentLocations = await this.getLocations();
        const locNameMap = new Map<string, CampusLocation>();
        currentLocations.forEach((loc) => locNameMap.set(loc.name.toLowerCase().trim(), loc));

        let addedLocations = 0;
        backupData.locations.forEach((backupLoc) => {
          const key = backupLoc.name.toLowerCase().trim();
          if (!locNameMap.has(key)) {
            locNameMap.set(key, backupLoc);
            addedLocations++;
          }
        });
        const mergedLocations = Array.from(locNameMap.values());
        await this.saveLocations(mergedLocations);

        // 3. Edificios
        const currentBuildings = await this.getBuildings();
        const buildingSet = new Set<string>([...currentBuildings, ...backupData.buildings]);
        await this.saveBuildings(Array.from(buildingSet));

        // 4. Ejecuciones
        const currentExecutions = await this.getExecutions();
        const execMap = new Map<string, MaintenanceExecution>();
        currentExecutions.forEach((ex) => execMap.set(ex.id, ex));

        let addedExecutions = 0;
        backupData.executions.forEach((backupEx) => {
          if (!execMap.has(backupEx.id)) {
            execMap.set(backupEx.id, backupEx);
            addedExecutions++;
          }
        });
        const mergedExecutions = Array.from(execMap.values());
        await this.saveExecutions(mergedExecutions);

        // 5. Planes Anuales
        const currentPlans = await apiCall('/api/sync/annualPlans');
        Object.entries(backupData.annualPlans).forEach(([yearKey, yearSchedule]) => {
          if (!currentPlans[yearKey]) {
            currentPlans[yearKey] = yearSchedule;
          } else {
            currentPlans[yearKey] = {
              ...currentPlans[yearKey],
              ...yearSchedule,
            };
          }
        });
        await this.saveAllAnnualPlans(currentPlans);

        if (backupData.technicianSignature) {
          const currentSignature = await this.getTechnicianSignature();
          if (!currentSignature) {
            await this.saveTechnicianSignature(backupData.technicianSignature);
          }
        }

        const years = Object.keys(currentPlans).map(Number).filter((n) => !isNaN(n));

        return {
          success: true,
          restoredEquipments: addedEquipments,
          restoredLocations: addedLocations,
          restoredExecutions: addedExecutions,
          restoredPlansYears: years,
        };
      }
    } catch (err) {
      console.error('Error during database restore', err);
      throw err;
    }
  },

  // Obtiene la firma del técnico almacenada
  async getTechnicianSignature(): Promise<string | null> {
    try {
      const res = await fetch('/api/settings/fcbv_technician_signature', { headers: getAuthHeaders() });
      const data = await res.json();
      return data.success ? data.value : null;
    } catch(e) { return null; }
  },

  // Guarda la firma del técnico
  async saveTechnicianSignature(signatureDataUrl: string): Promise<void> {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ key: 'fcbv_technician_signature', value: signatureDataUrl })
      });
    } catch(e) { console.error(e); }
  },
};
