import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calendar, 
  Download, 
  FileSpreadsheet, 
  RotateCcw, 
  Search, 
  Check, 
  Info,
  CalendarDays,
  Sparkles, 
  ChevronLeft, 
  ChevronRight, 
  TrendingUp, 
  MapPin,
  CalendarClock,
  SlidersHorizontal,
  CheckSquare,
  Square,
  Filter,
  Layers,
  X
} from 'lucide-react';
import { Equipment, MaintenanceExecution } from '../../types';
import { MONTH_SHORT_NAMES, MONTH_NAMES, getDefaultMonthsForFrequency, StorageService } from '../../services/storage';
import { ExportService } from '../../services/exportService';
import { BulkScheduleModal, BulkScheduleConfig } from './BulkScheduleModal';
import { BulkExecutionModal } from '../ExecutionModule/BulkExecutionModal';

interface AnnualPlanViewProps {
  equipments: Equipment[];
  selectedYear: number;
  onYearChange: (year: number) => void;
  planMatrix: Record<string, boolean[]>;
  onToggleMonth: (equipmentId: string, monthIndex: number) => void;
  onResetPlanToDefaults: () => void;
  onBulkUpdatePlan?: (
    updatedPlan: Record<string, boolean[]>,
    updatedEquipments?: Equipment[],
    message?: string,
    updatedExecutions?: MaintenanceExecution[]
  ) => void;
  initialSelectedEquipmentIds?: string[];
  initialOpenBulkModal?: boolean;
  onClearInitialBulkOpen?: () => void;
  executions?: MaintenanceExecution[];
  onBulkSaveExecutions?: (executedList: MaintenanceExecution[], count: number) => void;
}

export const AnnualPlanView: React.FC<AnnualPlanViewProps> = ({
  equipments,
  selectedYear,
  onYearChange,
  planMatrix,
  onToggleMonth,
  onResetPlanToDefaults,
  onBulkUpdatePlan,
  initialSelectedEquipmentIds = [],
  initialOpenBulkModal = false,
  onClearInitialBulkOpen,
  executions = [],
  onBulkSaveExecutions,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('todas');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Selección múltiple para acciones masivas
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<Set<string>>(
    new Set(initialSelectedEquipmentIds)
  );
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(initialOpenBulkModal);
  const [isBulkExecuteModalOpen, setIsBulkExecuteModalOpen] = useState(false);

  // Escuchar props iniciales si vienen desde otra pestaña (ej. desde Equipos)
  useEffect(() => {
    if (initialSelectedEquipmentIds && initialSelectedEquipmentIds.length > 0) {
      setSelectedEquipmentIds(new Set(initialSelectedEquipmentIds));
    }
    if (initialOpenBulkModal) {
      setIsBulkModalOpen(true);
      if (onClearInitialBulkOpen) onClearInitialBulkOpen();
    }
  }, [initialSelectedEquipmentIds, initialOpenBulkModal, onClearInitialBulkOpen]);

  // Solo equipos activos están en el plan
  const activeEquipments = useMemo(() => {
    return equipments.filter((e) => e.status === 'activo');
  }, [equipments]);

  // Lista de ubicaciones
  const locations = useMemo(() => {
    const locSet = new Set<string>();
    activeEquipments.forEach((eq) => {
      if (eq.location) locSet.add(eq.location);
    });
    return Array.from(locSet).sort();
  }, [activeEquipments]);

  // Filtrado
  const filteredEquipments = useMemo(() => {
    return activeEquipments.filter((eq) => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        const matches =
          eq.code.toLowerCase().includes(term) ||
          eq.name.toLowerCase().includes(term) ||
          eq.location.toLowerCase().includes(term);
        if (!matches) return false;
      }
      if (selectedLocation !== 'todas' && eq.location !== selectedLocation) {
        return false;
      }
      return true;
    });
  }, [activeEquipments, searchTerm, selectedLocation]);

  // Manejadores de selección masiva
  const isAllFilteredSelected = useMemo(() => {
    return (
      filteredEquipments.length > 0 &&
      filteredEquipments.every((e) => selectedEquipmentIds.has(e.id))
    );
  }, [filteredEquipments, selectedEquipmentIds]);

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      setSelectedEquipmentIds((prev) => {
        const next = new Set(prev);
        filteredEquipments.forEach((e) => next.delete(e.id));
        return next;
      });
    } else {
      setSelectedEquipmentIds((prev) => {
        const next = new Set(prev);
        filteredEquipments.forEach((e) => next.add(e.id));
        return next;
      });
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedEquipmentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Totales mensuales
  const monthlyTotals = useMemo(() => {
    const totals = new Array(12).fill(0);
    activeEquipments.forEach((eq) => {
      const schedule = planMatrix[eq.id] || [];
      schedule.forEach((isScheduled, idx) => {
        if (isScheduled) totals[idx]++;
      });
    });
    return totals;
  }, [activeEquipments, planMatrix]);

  const grandTotal = useMemo(() => {
    return monthlyTotals.reduce((a, b) => a + b, 0);
  }, [monthlyTotals]);

  // Mes con mayor carga
  const peakMonthIndex = useMemo(() => {
    let max = -1;
    let maxIdx = 0;
    monthlyTotals.forEach((val, idx) => {
      if (val > max) {
        max = val;
        maxIdx = idx;
      }
    });
    return maxIdx;
  }, [monthlyTotals]);

  // Aplicar programación masiva desde el modal
  const handleApplyBulkSchedule = (config: BulkScheduleConfig) => {
    if (!onBulkUpdatePlan) return;

    const newPlan = { ...planMatrix };
    let updatedEquipmentsList: Equipment[] | undefined;

    if (config.updateEquipmentFrequencyRecord && config.frequencyOverride) {
      updatedEquipmentsList = equipments.map((eq) => {
        if (config.equipmentIds.includes(eq.id)) {
          return {
            ...eq,
            frequency: config.frequencyOverride!,
            updatedAt: new Date().toISOString(),
          };
        }
        return eq;
      });
    }

    config.equipmentIds.forEach((id) => {
      const eq = equipments.find((e) => e.id === id);
      if (!eq) return;

      if (config.perEquipmentSchedules && config.perEquipmentSchedules[id]) {
        newPlan[id] = [...config.perEquipmentSchedules[id]];
      } else if (config.mode === 'frequencyDefaults') {
        newPlan[id] = getDefaultMonthsForFrequency(eq.frequency, eq.customMonths, config.startMonthIndex);
      } else if (config.mode === 'replace') {
        newPlan[id] = [...config.monthsToApply];
      } else if (config.mode === 'add') {
        const current = newPlan[id] || new Array(12).fill(false);
        newPlan[id] = current.map((val, idx) => val || config.monthsToApply[idx]);
      } else if (config.mode === 'remove') {
        const current = newPlan[id] || new Array(12).fill(false);
        newPlan[id] = current.map((val, idx) => (config.monthsToApply[idx] ? false : val));
      }
    });

    let updatedExecutionsList: MaintenanceExecution[] | undefined;
    if (config.scheduledExecutions && config.scheduledExecutions.length > 0) {
      // We will pass executions from props instead or skip because it should be loaded
      const execMap = new Map<string, MaintenanceExecution>();
      executions.forEach((ex) => execMap.set(`${ex.equipmentId}_${ex.year}_${ex.month}`, { ...ex }));

      config.scheduledExecutions.forEach((item) => {
        const key = `${item.equipmentId}_${item.year}_${item.month}`;
        const existing = execMap.get(key);
        if (existing) {
          if (!existing.isExecuted) {
            existing.scheduledDate = item.scheduledDate;
            existing.updatedAt = new Date().toISOString();
          }
        } else {
          execMap.set(key, {
            id: `exec_${item.equipmentId}_${item.year}_${item.month}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            equipmentId: item.equipmentId,
            year: item.year,
            month: item.month,
            scheduledDate: item.scheduledDate,
            isExecuted: false,
            completedTasks: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      });
      updatedExecutionsList = Array.from(execMap.values());
    }

    const startMonthDetail =
      config.mode === 'frequencyDefaults' && config.startMonthIndex !== undefined
        ? ` con nivelación inteligente iniciando en ${MONTH_NAMES[config.startMonthIndex]}`
        : '';

    onBulkUpdatePlan(
      newPlan,
      updatedEquipmentsList,
      `Programación masiva aplicada a ${config.equipmentIds.length} equipos para el año ${selectedYear}${startMonthDetail}.`,
      updatedExecutionsList
    );
  };

  // Acciones rápidas para los seleccionados (1 clic)
  const handleQuickApplyPreset = (preset: 'quarterly' | 'semiannual' | 'monthly' | 'defaults' | 'clear') => {
    if (!onBulkUpdatePlan || selectedEquipmentIds.size === 0) return;

    const ids: string[] = Array.from(selectedEquipmentIds);
    const newPlan: Record<string, boolean[]> = { ...planMatrix };

    let presetMonths = new Array(12).fill(false);
    let label = '';

    if (preset === 'quarterly') {
      presetMonths = [false, false, true, false, false, true, false, false, true, false, false, true]; // Mar, Jun, Sep, Dic
      label = 'Trimestral (Mar, Jun, Sep, Dic)';
      ids.forEach((id) => {
        newPlan[id] = [...presetMonths];
      });
    } else if (preset === 'semiannual') {
      presetMonths = [false, false, false, false, false, true, false, false, false, false, false, true]; // Jun, Dic
      label = 'Semestral (Jun, Dic)';
      ids.forEach((id) => {
        newPlan[id] = [...presetMonths];
      });
    } else if (preset === 'monthly') {
      presetMonths = new Array(12).fill(true);
      label = 'Mensual (12 meses)';
      ids.forEach((id) => {
        newPlan[id] = [...presetMonths];
      });
    } else if (preset === 'defaults') {
      label = 'Frecuencia oficial de cada ficha';
      ids.forEach((id) => {
        const eq = equipments.find((e) => e.id === id);
        if (eq) {
          newPlan[id] = getDefaultMonthsForFrequency(eq.frequency, eq.customMonths);
        }
      });
    } else if (preset === 'clear') {
      label = 'Desprogramado / Limpio';
      ids.forEach((id) => {
        newPlan[id] = new Array(12).fill(false);
      });
    }

    onBulkUpdatePlan(
      newPlan,
      undefined,
      `Programación rápida "${label}" aplicada a ${ids.length} equipos.`
    );
  };

  // Acción rápida en columna de mes (programar/desprogramar ese mes para los seleccionados o visibles)
  const handleToggleColumnForSelection = (monthIndex: number) => {
    if (!onBulkUpdatePlan) return;
    const targetIds: string[] =
      selectedEquipmentIds.size > 0
        ? Array.from(selectedEquipmentIds)
        : filteredEquipments.map((e) => e.id);

    if (targetIds.length === 0) return;

    // Verificar si la mayoría ya lo tiene programado
    const scheduledCount = targetIds.filter((id) => planMatrix[id]?.[monthIndex]).length;
    const turnOn = scheduledCount < targetIds.length / 2;

    const newPlan: Record<string, boolean[]> = { ...planMatrix };
    targetIds.forEach((id) => {
      const current = newPlan[id] || new Array(12).fill(false);
      const copy = [...current];
      copy[monthIndex] = turnOn;
      newPlan[id] = copy;
    });

    const actionText = turnOn ? 'Programado' : 'Desprogramado';
    onBulkUpdatePlan(
      newPlan,
      undefined,
      `${actionText} ${MONTH_NAMES[monthIndex]} para ${targetIds.length} equipos.`
    );
  };

  return (
    <div className="space-y-6">
      {/* Header del Plan Anual */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
              Cronograma Institucional
            </span>
            <span className="text-xs text-slate-400">• FCBV Infraestructura</span>
          </div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2.5 mt-1">
            <CalendarDays className="w-6 h-6 text-indigo-600" />
            Plan Anual de Mantenimiento Preventivo
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Matriz anual interactiva (Ene–Dic). Haga clic en cualquier celda para activar/desactivar o use la programación masiva por lotes.
          </p>
        </div>

        {/* Selector de Año, Programación Masiva y Exportaciones */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Selector de año */}
          <div className="inline-flex items-center bg-slate-100 p-1 rounded-lg border border-slate-300">
            <button
              type="button"
              onClick={() => onYearChange(selectedYear - 1)}
              className="p-1 hover:bg-white rounded text-slate-600 transition-colors"
              title="Año anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-3 py-0.5 font-bold font-mono text-base text-slate-800">
              {selectedYear}
            </div>
            <button
              type="button"
              onClick={() => onYearChange(selectedYear + 1)}
              className="p-1 hover:bg-white rounded text-slate-600 transition-colors"
              title="Año siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Botón Principal: PROGRAMACIÓN MASIVA */}
          <button
            type="button"
            id="btn-open-bulk-schedule"
            onClick={() => setIsBulkModalOpen(true)}
            className="px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg flex items-center gap-1.5 transition-all shadow-xs"
            title="Abrir asistente de programación masiva de mantenimientos"
          >
            <CalendarClock className="w-4 h-4" />
            <span>Programación Masiva</span>
            {selectedEquipmentIds.size > 0 && (
              <span className="ml-1 px-1.5 py-0.2 text-[10px] font-bold bg-white text-indigo-700 rounded-full">
                {selectedEquipmentIds.size}
              </span>
            )}
          </button>

          {/* Botón de Ejecutar Masivamente */}
          <button
            type="button"
            id="btn-open-bulk-execute-from-plan"
            onClick={() => setIsBulkExecuteModalOpen(true)}
            className="px-3.5 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg flex items-center gap-1.5 transition-all shadow-2xs"
            title="Ejecutar masivamente mantenimientos asignando la fecha programada como fecha de ejecución"
          >
            <Check className="w-4 h-4 text-emerald-600" />
            <span>Ejecutar Masivamente</span>
          </button>

          <button
            type="button"
            onClick={() => ExportService.exportAnnualPlanToExcel(selectedYear, equipments, planMatrix)}
            className="px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Excel
          </button>

          <button
            type="button"
            onClick={() => ExportService.exportAnnualPlanToPDF(selectedYear, equipments, planMatrix)}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <Download className="w-4 h-4 text-slate-500" />
            PDF
          </button>

          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            title="Recalcular automáticamente según la frecuencia de cada equipo"
            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Alerta de confirmación de restablecimiento */}
      {showResetConfirm && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900 animate-in fade-in">
          <div>
            <span className="font-bold">¿Desea restablecer el cronograma de {selectedYear}?</span>
            <p className="text-amber-700 mt-0.5">
              Se volverán a calcular los meses automáticamente según la frecuencia (mensual, trimestral, semestral, anual) de cada equipo.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowResetConfirm(false)}
              className="px-3 py-1 bg-white border border-amber-300 rounded text-amber-800 hover:bg-amber-100"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                onResetPlanToDefaults();
                setShowResetConfirm(false);
              }}
              className="px-3 py-1 bg-amber-700 text-white rounded hover:bg-amber-800 font-semibold"
            >
              Sí, Restablecer
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards del Plan */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">Equipos en Cronograma</span>
          <span className="text-2xl font-bold text-slate-800 mt-1 block">{activeEquipments.length}</span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Excluye dados de baja</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-indigo-200 shadow-2xs">
          <span className="text-xs font-medium text-indigo-700 uppercase tracking-wider block">Intervenciones {selectedYear}</span>
          <span className="text-2xl font-bold text-indigo-700 mt-1 block">{grandTotal}</span>
          <span className="text-[11px] text-indigo-600 mt-0.5 block">Total de marcas "X"</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">Mes con Mayor Carga</span>
          <span className="text-xl font-bold text-slate-800 mt-1 block">
            {MONTH_NAMES[peakMonthIndex]} ({monthlyTotals[peakMonthIndex]})
          </span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Mantenimientos programados</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-2xs">
          <span className="text-xs font-medium text-emerald-700 uppercase tracking-wider block">Programación Masiva</span>
          <div className="flex items-center gap-1.5 mt-1">
            <Sparkles className="w-5 h-5 text-emerald-600" />
            <span className="text-sm font-bold text-emerald-700">Por Lotes Activa</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Seleccione equipos con casillas</span>
        </div>
      </div>

      {/* Barra de Filtros rápidos */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="flex-1 w-full relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filtrar por código o nombre de equipo..."
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="w-full sm:w-64">
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="w-full py-1.5 px-3 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="todas">Todas las ubicaciones ({locations.length})</option>
            {locations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-slate-500 whitespace-nowrap">
          Mostrando <strong>{filteredEquipments.length}</strong> de {activeEquipments.length} equipos
        </div>
      </div>

      {/* BARRA FLOTANTE / CONTEXTUAL DE ACCIÓN MASIVA (Cuando hay equipos seleccionados) */}
      {selectedEquipmentIds.size > 0 && (
        <div className="p-3.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-xl shadow-lg border border-indigo-700/50 flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold">
              {selectedEquipmentIds.size}
            </span>
            <div>
              <span className="text-xs font-bold text-white block">
                {selectedEquipmentIds.size} {selectedEquipmentIds.size === 1 ? 'equipo seleccionado' : 'equipos seleccionados'}
              </span>
              <span className="text-[11px] text-slate-300">
                Aplique programación en lote a estos equipos
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsBulkModalOpen(true)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Configurar Masivamente</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickApplyPreset('quarterly')}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-200 border border-indigo-900/50 rounded-lg text-xs font-medium transition-colors"
              title="Programar Trimestral (Mar, Jun, Sep, Dic)"
            >
              Trimestral (4x)
            </button>

            <button
              type="button"
              onClick={() => handleQuickApplyPreset('semiannual')}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-200 border border-indigo-900/50 rounded-lg text-xs font-medium transition-colors"
              title="Programar Semestral (Jun, Dic)"
            >
              Semestral (2x)
            </button>

            <button
              type="button"
              onClick={() => handleQuickApplyPreset('defaults')}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-200 border border-indigo-900/50 rounded-lg text-xs font-medium transition-colors"
              title="Aplicar frecuencia oficial de la ficha de cada equipo"
            >
              Frecuencia Ficha
            </button>

            <button
              type="button"
              onClick={() => handleQuickApplyPreset('clear')}
              className="px-2.5 py-1.5 bg-rose-950/70 hover:bg-rose-900 text-rose-200 border border-rose-900/50 rounded-lg text-xs font-medium transition-colors"
              title="Desprogramar todos los meses en los equipos seleccionados"
            >
              Desprogramar
            </button>

            <button
              type="button"
              onClick={() => setSelectedEquipmentIds(new Set())}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors ml-1"
              title="Deseleccionar todos"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Matriz del Plan Anual (Cronograma Anual) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white font-semibold uppercase tracking-wider text-[11px]">
                {/* Casilla de selección masiva */}
                <th className="py-3 px-3 w-10 text-center sticky left-0 bg-slate-900 z-20">
                  <input
                    type="checkbox"
                    checked={isAllFilteredSelected}
                    onChange={handleToggleSelectAll}
                    title={isAllFilteredSelected ? 'Deseleccionar visibles' : 'Seleccionar todos los visibles'}
                    className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-600 bg-slate-800 cursor-pointer focus:ring-0"
                  />
                </th>
                <th className="py-3 px-3 w-20 sticky left-10 bg-slate-900 z-10">Código</th>
                <th className="py-3 px-4 min-w-[200px]">Equipo / Descripción</th>
                <th className="py-3 px-3 min-w-[130px]">Ubicación</th>
                <th className="py-3 px-2.5 text-center w-16">Frec.</th>
                {MONTH_SHORT_NAMES.map((m, idx) => (
                  <th key={m} className="py-2 px-1 text-center w-12 font-bold group">
                    <div className="flex flex-col items-center justify-center">
                      <span>{m}</span>
                      <button
                        type="button"
                        onClick={() => handleToggleColumnForSelection(idx)}
                        title={`Clic para programar/desprogramar ${m} en ${
                          selectedEquipmentIds.size > 0
                            ? `los ${selectedEquipmentIds.size} equipos seleccionados`
                            : `todos los ${filteredEquipments.length} equipos visibles`
                        }`}
                        className="text-[9px] font-normal text-slate-400 hover:text-indigo-300 hover:bg-slate-800 px-1 rounded transition-colors"
                      >
                        ± lote
                      </button>
                    </div>
                  </th>
                ))}
                <th className="py-3 px-2 text-center w-14 bg-slate-800">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredEquipments.length > 0 ? (
                filteredEquipments.map((eq) => {
                  const schedule = planMatrix[eq.id] || new Array(12).fill(false);
                  const totalEquipo = schedule.filter(Boolean).length;
                  const isRowSelected = selectedEquipmentIds.has(eq.id);

                  return (
                    <tr
                      key={eq.id}
                      className={`transition-colors ${
                        isRowSelected
                          ? 'bg-indigo-50/60 hover:bg-indigo-50'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {/* Checkbox de selección individual */}
                      <td className={`py-2.5 px-3 text-center sticky left-0 z-20 border-r border-slate-100 ${
                        isRowSelected ? 'bg-indigo-50/90' : 'bg-white'
                      }`}>
                        <input
                          type="checkbox"
                          checked={isRowSelected}
                          onChange={() => handleToggleSelectOne(eq.id)}
                          className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 cursor-pointer focus:ring-0"
                        />
                      </td>

                      {/* Código */}
                      <td className={`py-2.5 px-3 font-mono font-bold text-slate-800 sticky left-10 whitespace-nowrap z-10 border-r border-slate-100 ${
                        isRowSelected ? 'bg-indigo-50/90' : 'bg-white'
                      }`}>
                        <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px]">
                          {eq.code}
                        </span>
                      </td>

                      {/* Nombre */}
                      <td className="py-2.5 px-4 font-medium text-slate-800">
                        <div className="truncate max-w-[240px]" title={eq.name}>
                          {eq.name}
                        </div>
                      </td>

                      {/* Ubicación */}
                      <td className="py-2.5 px-3 text-slate-600">
                        <div className="truncate max-w-[150px]" title={eq.location}>
                          {eq.location}
                        </div>
                      </td>

                      {/* Frecuencia */}
                      <td className="py-2.5 px-2 text-center whitespace-nowrap">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase">
                          {eq.frequency.substring(0, 4)}
                        </span>
                      </td>

                      {/* 12 Meses interactivos con marca "X" */}
                      {schedule.map((isScheduled, monthIdx) => (
                        <td key={monthIdx} className="py-2 px-1 text-center border-l border-slate-100">
                          <button
                            type="button"
                            onClick={() => onToggleMonth(eq.id, monthIdx)}
                            title={`${eq.code} - ${MONTH_NAMES[monthIdx]} ${selectedYear}: Clic para ${
                              isScheduled ? 'eliminar del plan' : 'programar mantenimiento'
                            }`}
                            className={`w-8 h-8 rounded font-mono font-black text-sm flex items-center justify-center mx-auto transition-all ${
                              isScheduled
                                ? 'bg-sky-100 text-sky-900 border border-sky-400 hover:bg-rose-100 hover:text-rose-800 hover:border-rose-400 shadow-2xs'
                                : 'text-slate-300 hover:bg-slate-100 hover:text-slate-600'
                            }`}
                          >
                            {isScheduled ? 'X' : '·'}
                          </button>
                        </td>
                      ))}

                      {/* Total año por equipo */}
                      <td className="py-2.5 px-2 text-center font-bold font-mono text-slate-800 bg-slate-50/80 border-l border-slate-200">
                        {totalEquipo}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={18} className="py-10 text-center text-slate-400">
                    No se encontraron equipos activos para el cronograma.
                  </td>
                </tr>
              )}
            </tbody>

            {/* Fila de Totales por Mes */}
            <tfoot>
              <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-800">
                <td colSpan={5} className="py-3 px-4 text-right uppercase tracking-wider text-xs">
                  Total Mantenimientos Programados / Mes:
                </td>
                {monthlyTotals.map((tot, idx) => (
                  <td key={idx} className="py-3 px-1 text-center font-mono text-xs border-l border-slate-200">
                    <div className="font-bold">{tot}</div>
                    {/* Mini barra de distribución */}
                    <div className="w-6 h-1.5 bg-slate-200 rounded-full mx-auto mt-1 overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full"
                        style={{
                          width: `${Math.min(100, Math.round((tot / (Math.max(...monthlyTotals) || 1)) * 100))}%`,
                        }}
                      />
                    </div>
                  </td>
                ))}
                <td className="py-3 px-2 text-center font-mono text-sm text-indigo-700 bg-indigo-50 border-l border-slate-300">
                  {grandTotal}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Modal de Programación Masiva */}
      {isBulkModalOpen && (
        <BulkScheduleModal
          isOpen={isBulkModalOpen}
          onClose={() => setIsBulkModalOpen(false)}
          selectedYear={selectedYear}
          equipments={equipments}
          preSelectedEquipmentIds={Array.from(selectedEquipmentIds)}
          planMatrix={planMatrix}
          onApply={handleApplyBulkSchedule}
          locations={locations}
        />
      )}

      {/* Modal de Ejecución Masiva */}
      {isBulkExecuteModalOpen && (
        <BulkExecutionModal
          isOpen={isBulkExecuteModalOpen}
          onClose={() => setIsBulkExecuteModalOpen(false)}
          selectedYear={selectedYear}
          currentSelectedMonth={0}
          equipments={equipments}
          planMatrix={planMatrix}
          executions={executions}
          onConfirmBulkExecute={(records, count) => {
            if (onBulkSaveExecutions) {
              onBulkSaveExecutions(records, count);
            }
          }}
        />
      )}
    </div>
  );
};
