import { Equipment, EquipmentFrequency } from '../types';
import { MONTH_NAMES, MONTH_SHORT_NAMES } from './storage';

export interface DailyScheduleSlot {
  dayIndex: number; // 1, 2, 3...
  date: Date;
  dateStr: string; // YYYY-MM-DD
  dayName: string; // Lunes, Martes...
  formattedDate: string; // ej: Lun 01/06/2026
  monthIndex: number; // 0-11
  monthName: string;
  year: number;
  equipments: {
    equipment: Equipment;
    assignedOrder: number;
  }[];
  locationsSummary: string[];
}

export interface EquipmentSmartAssignment {
  equipmentId: string;
  equipment: Equipment;
  firstDateStr: string;
  firstMonthIndex: number; // 0-11
  monthsSchedule: boolean[]; // Array de 12 booleanos para el año
  executionDates: {
    month: number; // 1-12
    scheduledDate: string; // YYYY-MM-DD
  }[];
}

export interface SmartScheduleResult {
  dailySlots: DailyScheduleSlot[];
  assignments: EquipmentSmartAssignment[];
  planMatrix: Record<string, boolean[]>;
  scheduledExecutions: {
    equipmentId: string;
    year: number;
    month: number;
    scheduledDate: string;
  }[];
  stats: {
    totalEquipments: number;
    totalDays: number;
    startDateStr: string;
    endDateStr: string;
    monthsImpacted: {
      monthIndex: number;
      monthName: string;
      year: number;
      count: number;
    }[];
    spansMultipleMonths: boolean;
    totalInterventionsInYear: number;
  };
}

export interface SmartScheduleOptions {
  year: number;
  startMonthIndex: number; // 0-11
  startDay?: number; // Día del mes (1-31), opcional. Si no se pasa, primer día hábil.
  maxPerDay?: number; // Por defecto 6
  includeSaturdays?: boolean; // Por defecto false (solo Lunes a Viernes)
  groupByLocation?: boolean; // Por defecto true
}

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const SHORT_DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// Verifica si una fecha cae en día hábil según la configuración
export function isWorkingDay(date: Date, includeSaturdays: boolean = false): boolean {
  const day = date.getDay();
  if (includeSaturdays) {
    return day >= 1 && day <= 6; // Lunes a Sábado
  }
  return day >= 1 && day <= 5; // Lunes a Viernes
}

// Formatea fecha a YYYY-MM-DD
export function formatIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Formatea fecha legible: ej "Lun 01/06/2026"
export function formatReadableDate(date: Date): string {
  const dayName = SHORT_DAY_NAMES[date.getDay()];
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${dayName} ${d}/${m}/${y}`;
}

// Obtiene el primer día hábil de un mes
export function getFirstWorkingDayOfMonth(year: number, monthIndex: number, includeSaturdays: boolean = false): number {
  for (let day = 1; day <= 31; day++) {
    const d = new Date(year, monthIndex, day);
    if (d.getMonth() !== monthIndex) break;
    if (isWorkingDay(d, includeSaturdays)) {
      return day;
    }
  }
  return 1;
}

// Encuentra el día hábil más cercano en un mes futuro para mantener el ciclo
export function findNearestWorkingDayInMonth(
  year: number,
  targetMonthIndex: number,
  targetDayOfMonth: number,
  includeSaturdays: boolean = false
): string {
  const daysInMonth = new Date(year, targetMonthIndex + 1, 0).getDate();
  const clampedDay = Math.min(targetDayOfMonth, daysInMonth);

  // Probar el mismo día
  const exact = new Date(year, targetMonthIndex, clampedDay);
  if (isWorkingDay(exact, includeSaturdays)) {
    return formatIsoDate(exact);
  }

  // Si cae fin de semana, buscar el día hábil más cercano hacia adelante o atrás
  for (let offset = 1; offset <= 5; offset++) {
    // Intentar hacia adelante
    if (clampedDay + offset <= daysInMonth) {
      const fwd = new Date(year, targetMonthIndex, clampedDay + offset);
      if (isWorkingDay(fwd, includeSaturdays)) return formatIsoDate(fwd);
    }
    // Intentar hacia atrás
    if (clampedDay - offset >= 1) {
      const bwd = new Date(year, targetMonthIndex, clampedDay - offset);
      if (isWorkingDay(bwd, includeSaturdays)) return formatIsoDate(bwd);
    }
  }

  return formatIsoDate(exact);
}

/**
 * Calcula la programación inteligente y nivelada de mantenimiento preventivo:
 * 1. Agrupa por ubicación física para optimizar desplazamiento de técnicos.
 * 2. Asigna en días hábiles (Lunes a Viernes) respetando el tope de 6 equipos/día.
 * 3. Si un mes se completa, avanza de manera fluida al siguiente mes.
 * 4. Calcula la matriz anual y las fechas proyectadas según la frecuencia de cada equipo.
 */
export function calculateSmartSchedule(
  equipments: Equipment[],
  options: SmartScheduleOptions
): SmartScheduleResult {
  const {
    year,
    startMonthIndex,
    maxPerDay = 6,
    includeSaturdays = false,
    groupByLocation = true,
  } = options;

  if (equipments.length === 0) {
    return {
      dailySlots: [],
      assignments: [],
      planMatrix: {},
      scheduledExecutions: [],
      stats: {
        totalEquipments: 0,
        totalDays: 0,
        startDateStr: '',
        endDateStr: '',
        monthsImpacted: [],
        spansMultipleMonths: false,
        totalInterventionsInYear: 0,
      },
    };
  }

  // 1. Determinar el día de inicio
  const startDay = options.startDay !== undefined && options.startDay >= 1
    ? options.startDay
    : getFirstWorkingDayOfMonth(year, startMonthIndex, includeSaturdays);

  // 2. Ordenar equipos por ubicación y luego por código
  const sortedEquipments = [...equipments].sort((a, b) => {
    if (groupByLocation) {
      const locComp = (a.location || '').localeCompare(b.location || '', undefined, { numeric: true });
      if (locComp !== 0) return locComp;
    }
    return (a.code || '').localeCompare(b.code || '', undefined, { numeric: true });
  });

  // 3. Generador de días hábiles continuos
  let currentDate = new Date(year, startMonthIndex, startDay);
  // Asegurar que comience en día hábil
  while (!isWorkingDay(currentDate, includeSaturdays)) {
    currentDate.setDate(currentDate.getDate() + 1);
  }

  const dailySlots: DailyScheduleSlot[] = [];
  const assignments: EquipmentSmartAssignment[] = [];
  const planMatrix: Record<string, boolean[]> = {};
  const scheduledExecutions: {
    equipmentId: string;
    year: number;
    month: number;
    scheduledDate: string;
  }[] = [];

  let currentSlotEquipments: { equipment: Equipment; assignedOrder: number }[] = [];
  let dayCounter = 1;

  for (let i = 0; i < sortedEquipments.length; i++) {
    const eq = sortedEquipments[i];
    const orderInDay = currentSlotEquipments.length + 1;
    currentSlotEquipments.push({ equipment: eq, assignedOrder: orderInDay });

    const assignedDate = new Date(currentDate);
    const assignedDateStr = formatIsoDate(assignedDate);
    const firstMonthIndex = assignedDate.getMonth(); // 0-11
    const dayOfMonth = assignedDate.getDate();

    // Calcular el cronograma anual de 12 meses según su frecuencia a partir de firstMonthIndex
    const monthsSchedule = new Array(12).fill(false);
    const executionDates: { month: number; scheduledDate: string }[] = [];

    // Primer mes asignado
    if (firstMonthIndex < 12) {
      monthsSchedule[firstMonthIndex] = true;
      executionDates.push({
        month: firstMonthIndex + 1,
        scheduledDate: assignedDateStr,
      });
      scheduledExecutions.push({
        equipmentId: eq.id,
        year: assignedDate.getFullYear(),
        month: firstMonthIndex + 1,
        scheduledDate: assignedDateStr,
      });
    }

    // Calcular ciclos subsecuentes en el mismo año
    const freq: EquipmentFrequency = eq.frequency;
    if (freq === 'mensual') {
      for (let m = firstMonthIndex + 1; m < 12; m++) {
        monthsSchedule[m] = true;
        const projectedDate = findNearestWorkingDayInMonth(year, m, dayOfMonth, includeSaturdays);
        executionDates.push({ month: m + 1, scheduledDate: projectedDate });
        scheduledExecutions.push({
          equipmentId: eq.id,
          year,
          month: m + 1,
          scheduledDate: projectedDate,
        });
      }
    } else if (freq === 'trimestral') {
      for (let m = firstMonthIndex + 3; m < 12; m += 3) {
        monthsSchedule[m] = true;
        const projectedDate = findNearestWorkingDayInMonth(year, m, dayOfMonth, includeSaturdays);
        executionDates.push({ month: m + 1, scheduledDate: projectedDate });
        scheduledExecutions.push({
          equipmentId: eq.id,
          year,
          month: m + 1,
          scheduledDate: projectedDate,
        });
      }
    } else if (freq === 'semestral') {
      for (let m = firstMonthIndex + 6; m < 12; m += 6) {
        monthsSchedule[m] = true;
        const projectedDate = findNearestWorkingDayInMonth(year, m, dayOfMonth, includeSaturdays);
        executionDates.push({ month: m + 1, scheduledDate: projectedDate });
        scheduledExecutions.push({
          equipmentId: eq.id,
          year,
          month: m + 1,
          scheduledDate: projectedDate,
        });
      }
    } else if (freq === 'anual') {
      // Solo 1 intervención en el año (la que ya se programó)
    } else if (freq === 'personalizada') {
      if (eq.customMonths && eq.customMonths.length > 0) {
        eq.customMonths.forEach((monthNum) => {
          const mIdx = monthNum - 1;
          if (mIdx >= 0 && mIdx < 12) {
            monthsSchedule[mIdx] = true;
            if (mIdx !== firstMonthIndex) {
              const projectedDate = findNearestWorkingDayInMonth(year, mIdx, dayOfMonth, includeSaturdays);
              executionDates.push({ month: monthNum, scheduledDate: projectedDate });
              scheduledExecutions.push({
                equipmentId: eq.id,
                year,
                month: monthNum,
                scheduledDate: projectedDate,
              });
            }
          }
        });
      }
    }

    planMatrix[eq.id] = monthsSchedule;
    assignments.push({
      equipmentId: eq.id,
      equipment: eq,
      firstDateStr: assignedDateStr,
      firstMonthIndex,
      monthsSchedule,
      executionDates,
    });

    // Si se llenó el cupo del día (maxPerDay) o es el último equipo
    const isSlotFull = currentSlotEquipments.length >= maxPerDay;
    const isLastEquipment = i === sortedEquipments.length - 1;

    if (isSlotFull || isLastEquipment) {
      const locSet = new Set<string>();
      currentSlotEquipments.forEach((item) => {
        if (item.equipment.location) locSet.add(item.equipment.location);
      });

      dailySlots.push({
        dayIndex: dayCounter,
        date: new Date(currentDate),
        dateStr: formatIsoDate(currentDate),
        dayName: DAY_NAMES[currentDate.getDay()],
        formattedDate: formatReadableDate(currentDate),
        monthIndex: currentDate.getMonth(),
        monthName: MONTH_NAMES[currentDate.getMonth()],
        year: currentDate.getFullYear(),
        equipments: [...currentSlotEquipments],
        locationsSummary: Array.from(locSet),
      });

      dayCounter++;
      currentSlotEquipments = [];

      // Avanzar al siguiente día hábil
      if (!isLastEquipment) {
        do {
          currentDate.setDate(currentDate.getDate() + 1);
        } while (!isWorkingDay(currentDate, includeSaturdays));
      }
    }
  }

  // 4. Calcular estadísticas de impacto
  const monthCountMap = new Map<number, number>();
  dailySlots.forEach((slot) => {
    slot.equipments.forEach(() => {
      const current = monthCountMap.get(slot.monthIndex) || 0;
      monthCountMap.set(slot.monthIndex, current + 1);
    });
  });

  const monthsImpacted = Array.from(monthCountMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([mIdx, count]) => ({
      monthIndex: mIdx,
      monthName: MONTH_NAMES[mIdx],
      year,
      count,
    }));

  let totalInterventionsInYear = 0;
  Object.values(planMatrix).forEach((schedule) => {
    totalInterventionsInYear += schedule.filter(Boolean).length;
  });

  const startDateStr = dailySlots.length > 0 ? dailySlots[0].dateStr : '';
  const endDateStr = dailySlots.length > 0 ? dailySlots[dailySlots.length - 1].dateStr : '';

  return {
    dailySlots,
    assignments,
    planMatrix,
    scheduledExecutions,
    stats: {
      totalEquipments: equipments.length,
      totalDays: dailySlots.length,
      startDateStr,
      endDateStr,
      monthsImpacted,
      spansMultipleMonths: monthsImpacted.length > 1,
      totalInterventionsInYear,
    },
  };
}
