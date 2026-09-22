import React, { useState, useMemo, useEffect } from 'react';
import { 
  CalendarClock, 
  Check, 
  X, 
  Filter, 
  AlertCircle, 
  Calendar, 
  Sparkles, 
  Layers, 
  CheckSquare, 
  Square, 
  RotateCcw,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Info,
  Users,
  MapPin,
  Clock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  CalendarDays,
  Hash
} from 'lucide-react';
import { Equipment, EquipmentFrequency } from '../../types';
import { MONTH_SHORT_NAMES, MONTH_NAMES, getDefaultMonthsForFrequency } from '../../services/storage';
import { calculateSmartSchedule, SmartScheduleResult } from '../../services/scheduler';
import { SmartSchedulePreview } from './SmartSchedulePreview';

export type BulkApplyMode = 'replace' | 'add' | 'remove' | 'frequencyDefaults';

export interface BulkScheduleConfig {
  equipmentIds: string[];
  monthsToApply: boolean[];
  mode: BulkApplyMode;
  frequencyOverride?: EquipmentFrequency;
  updateEquipmentFrequencyRecord: boolean;
  startMonthIndex?: number;
  perEquipmentSchedules?: Record<string, boolean[]>;
  scheduledExecutions?: {
    equipmentId: string;
    year: number;
    month: number;
    scheduledDate: string;
  }[];
}

interface BulkScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedYear: number;
  equipments: Equipment[];
  preSelectedEquipmentIds?: string[];
  planMatrix: Record<string, boolean[]>;
  onApply: (config: BulkScheduleConfig) => void;
  locations?: string[];
}

type StrategyType = 'frequencyDefaults' | 'preset' | 'custom' | 'clear';

interface PresetOption {
  id: string;
  name: string;
  description: string;
  months: number[]; // 0-indexed (0=Ene, 11=Dic)
  recommendedFrequency?: EquipmentFrequency;
}

const PRESET_OPTIONS: PresetOption[] = [
  {
    id: 'monthly',
    name: 'Mensual (Todos los meses)',
    description: '12 intervenciones al año (Ene - Dic)',
    months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    recommendedFrequency: 'mensual',
  },
  {
    id: 'quarterly_std',
    name: 'Trimestral Estándar',
    description: '4 intervenciones: Marzo, Junio, Septiembre, Diciembre',
    months: [2, 5, 8, 11],
    recommendedFrequency: 'trimestral',
  },
  {
    id: 'quarterly_alt',
    name: 'Trimestral Alterno (Inicio de año)',
    description: '4 intervenciones: Enero, Abril, Julio, Octubre',
    months: [0, 3, 6, 9],
    recommendedFrequency: 'trimestral',
  },
  {
    id: 'semiannual_std',
    name: 'Semestral Estándar',
    description: '2 intervenciones: Junio y Diciembre',
    months: [5, 11],
    recommendedFrequency: 'semestral',
  },
  {
    id: 'semiannual_vacation',
    name: 'Semestral Vacaciones Escolares',
    description: '2 intervenciones: Enero y Julio',
    months: [0, 6],
    recommendedFrequency: 'semestral',
  },
  {
    id: 'bimonthly_even',
    name: 'Bimestral (Meses Pares)',
    description: '6 intervenciones: Feb, Abr, Jun, Ago, Oct, Dic',
    months: [1, 3, 5, 7, 9, 11],
    recommendedFrequency: 'personalizada',
  },
  {
    id: 'annual_nov',
    name: 'Anual (Noviembre)',
    description: '1 intervención al año: Noviembre',
    months: [10],
    recommendedFrequency: 'anual',
  },
  {
    id: 'annual_dec',
    name: 'Anual (Diciembre)',
    description: '1 intervención al año: Cierre en Diciembre',
    months: [11],
    recommendedFrequency: 'anual',
  },
];

export const BulkScheduleModal: React.FC<BulkScheduleModalProps> = ({
  isOpen,
  onClose,
  selectedYear,
  equipments,
  preSelectedEquipmentIds = [],
  planMatrix,
  onApply,
  locations = [],
}) => {
  // Solo equipos activos participan
  const activeEquipments = useMemo(() => {
    return equipments.filter((e) => e.status === 'activo');
  }, [equipments]);

  // Selección de alcance (Target)
  const [targetScope, setTargetScope] = useState<'selected' | 'all' | 'byLocation' | 'byFrequency'>(
    preSelectedEquipmentIds.length > 0 ? 'selected' : 'all'
  );
  const [selectedLocation, setSelectedLocation] = useState<string>('todas');
  const [selectedFrequencyFilter, setSelectedFrequencyFilter] = useState<string>('todas');
  const [scopeSearchTerm, setScopeSearchTerm] = useState('');
  const [showTargetList, setShowTargetList] = useState(false);

  // Estrategia de programación
  const [strategy, setStrategy] = useState<StrategyType>('frequencyDefaults');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('quarterly_std');
  const [customMonths, setCustomMonths] = useState<boolean[]>(new Array(12).fill(false));
  const [startMonthIndex, setStartMonthIndex] = useState<number>(0); // 0=Enero ... 11=Diciembre
  const [applyMode, setApplyMode] = useState<BulkApplyMode>('replace');
  const [updateFrequencyRecord, setUpdateFrequencyRecord] = useState<boolean>(false);

  // Parámetros de nivelación inteligente (Lunes a Viernes, máx 6 por día agrupado por ubicación)
  const [maxPerDay, setMaxPerDay] = useState<number>(6);
  const [includeSaturdays, setIncludeSaturdays] = useState<boolean>(false);
  const [groupByLocation, setGroupByLocation] = useState<boolean>(true);
  const [syncScheduledDates, setSyncScheduledDates] = useState<boolean>(true);

  // Inicializar estado cuando se abre
  useEffect(() => {
    if (isOpen) {
      if (preSelectedEquipmentIds.length > 0) {
        setTargetScope('selected');
      } else {
        setTargetScope('all');
      }
      setStrategy('frequencyDefaults');
      setSelectedPresetId('quarterly_std');
      setStartMonthIndex(0);
      setApplyMode('replace');
      setUpdateFrequencyRecord(false);
      setShowTargetList(false);
      setScopeSearchTerm('');
      setMaxPerDay(6);
      setIncludeSaturdays(false);
      setGroupByLocation(true);
      setSyncScheduledDates(true);

      // Inicializar customMonths con trimestral por defecto
      const initialMonths = new Array(12).fill(false);
      initialMonths[2] = true;
      initialMonths[5] = true;
      initialMonths[8] = true;
      initialMonths[11] = true;
      setCustomMonths(initialMonths);
    }
  }, [isOpen, preSelectedEquipmentIds]);

  // Calcular lista de equipos objetivo según el alcance seleccionado
  const targetEquipments = useMemo(() => {
    let list: Equipment[] = [];

    if (targetScope === 'selected') {
      const selectedSet = new Set(preSelectedEquipmentIds);
      list = activeEquipments.filter((eq) => selectedSet.has(eq.id));
    } else if (targetScope === 'all') {
      list = [...activeEquipments];
    } else if (targetScope === 'byLocation') {
      list = selectedLocation === 'todas'
        ? [...activeEquipments]
        : activeEquipments.filter((eq) => eq.location === selectedLocation);
    } else if (targetScope === 'byFrequency') {
      list = selectedFrequencyFilter === 'todas'
        ? [...activeEquipments]
        : activeEquipments.filter((eq) => eq.frequency === selectedFrequencyFilter);
    }

    // Filtrar opcionalmente por búsqueda rápida
    if (scopeSearchTerm.trim()) {
      const term = scopeSearchTerm.toLowerCase().trim();
      list = list.filter(
        (eq) =>
          eq.code.toLowerCase().includes(term) ||
          eq.name.toLowerCase().includes(term) ||
          eq.location.toLowerCase().includes(term)
      );
    }

    return list;
  }, [
    activeEquipments,
    targetScope,
    preSelectedEquipmentIds,
    selectedLocation,
    selectedFrequencyFilter,
    scopeSearchTerm,
  ]);

  // Manejar presets
  const handleSelectPreset = (preset: PresetOption) => {
    setSelectedPresetId(preset.id);
    const months = new Array(12).fill(false);
    preset.months.forEach((mIdx) => {
      if (mIdx >= 0 && mIdx < 12) months[mIdx] = true;
    });
    setCustomMonths(months);
  };

  // Toggles de selección manual de meses
  const toggleCustomMonth = (monthIdx: number) => {
    setCustomMonths((prev) => {
      const copy = [...prev];
      copy[monthIdx] = !copy[monthIdx];
      return copy;
    });
  };

  const handleSelectAllMonths = (selectAll: boolean) => {
    setCustomMonths(new Array(12).fill(selectAll));
  };

  const handleApplyPresetPattern = (pattern: 'semester1' | 'semester2' | 'even' | 'odd' | 'vacations') => {
    const arr = new Array(12).fill(false);
    if (pattern === 'semester1') {
      for (let i = 0; i < 6; i++) arr[i] = true;
    } else if (pattern === 'semester2') {
      for (let i = 6; i < 12; i++) arr[i] = true;
    } else if (pattern === 'even') {
      // Meses pares: Feb (1), Abr (3), Jun (5), Ago (7), Oct (9), Dic (11)
      [1, 3, 5, 7, 9, 11].forEach((i) => (arr[i] = true));
    } else if (pattern === 'odd') {
      // Meses impares: Ene (0), Mar (2), May (4), Jul (6), Sep (8), Nov (10)
      [0, 2, 4, 6, 8, 10].forEach((i) => (arr[i] = true));
    } else if (pattern === 'vacations') {
      // Ene (0), Jun (5), Jul (6), Dic (11)
      [0, 5, 6, 11].forEach((i) => (arr[i] = true));
    }
    setCustomMonths(arr);
  };

  // Calcular meses que se van a aplicar según la estrategia
  const effectiveMonths = useMemo(() => {
    if (strategy === 'clear') {
      return new Array(12).fill(false);
    }
    if (strategy === 'custom') {
      return customMonths;
    }
    if (strategy === 'preset') {
      const preset = PRESET_OPTIONS.find((p) => p.id === selectedPresetId);
      const arr = new Array(12).fill(false);
      if (preset) {
        preset.months.forEach((m) => {
          arr[m] = true;
        });
      }
      return arr;
    }
    // Para 'frequencyDefaults', cada equipo tiene sus propios meses
    return new Array(12).fill(false);
  }, [strategy, selectedPresetId, customMonths]);

  // Cálculo de la programación inteligente nivelada (Lunes a Viernes, máx per day, por ubicación)
  const smartSchedule = useMemo<SmartScheduleResult>(() => {
    return calculateSmartSchedule(targetEquipments, {
      year: selectedYear,
      startMonthIndex,
      maxPerDay,
      includeSaturdays,
      groupByLocation,
    });
  }, [targetEquipments, selectedYear, startMonthIndex, maxPerDay, includeSaturdays, groupByLocation]);

  // Conteo de intervenciones proyectadas
  const projectedStats = useMemo(() => {
    const equipmentCount = targetEquipments.length;
    if (equipmentCount === 0) return { totalInterventions: 0, monthsSummary: 'Ningún equipo seleccionado' };

    if (strategy === 'clear') {
      return {
        totalInterventions: 0,
        monthsSummary: 'Se eliminarán todas las programaciones para estos equipos',
      };
    }

    if (strategy === 'frequencyDefaults') {
      const { stats } = smartSchedule;
      const monthNames = stats.monthsImpacted.map((m) => `${m.monthName} (${m.count} eq)`).join(', ');
      return {
        totalInterventions: stats.totalInterventionsInYear,
        monthsSummary: stats.spansMultipleMonths
          ? `Distribuido en ${monthNames} (${stats.totalDays} jornadas de Lu-Vi)`
          : `Iniciando en ${MONTH_NAMES[startMonthIndex]} (${stats.totalDays} jornadas de Lu-Vi)`,
      };
    }

    const marksCount = effectiveMonths.filter(Boolean).length;
    const selectedMonthNames = MONTH_SHORT_NAMES.filter((_, idx) => effectiveMonths[idx]).join(', ');

    return {
      totalInterventions: equipmentCount * marksCount,
      monthsSummary: marksCount > 0 ? selectedMonthNames : 'Ningún mes marcado',
    };
  }, [targetEquipments, strategy, effectiveMonths, startMonthIndex, smartSchedule]);

  // Ejecutar aplicación
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (targetEquipments.length === 0) return;

    const equipmentIds = targetEquipments.map((e) => e.id);
    let finalMode: BulkApplyMode = applyMode;
    let monthsToApply = effectiveMonths;
    let frequencyOverride: EquipmentFrequency | undefined;

    if (strategy === 'frequencyDefaults') {
      onApply({
        equipmentIds,
        monthsToApply: new Array(12).fill(false),
        mode: 'frequencyDefaults',
        frequencyOverride: undefined,
        updateEquipmentFrequencyRecord: false,
        startMonthIndex,
        perEquipmentSchedules: smartSchedule.planMatrix,
        scheduledExecutions: syncScheduledDates ? smartSchedule.scheduledExecutions : undefined,
      });
      onClose();
      return;
    } else if (strategy === 'clear') {
      finalMode = 'replace';
      monthsToApply = new Array(12).fill(false);
    } else if (strategy === 'preset') {
      const currentPreset = PRESET_OPTIONS.find((p) => p.id === selectedPresetId);
      if (updateFrequencyRecord && currentPreset?.recommendedFrequency) {
        frequencyOverride = currentPreset.recommendedFrequency;
      }
    }

    onApply({
      equipmentIds,
      monthsToApply,
      mode: finalMode,
      frequencyOverride,
      updateEquipmentFrequencyRecord: updateFrequencyRecord && !!frequencyOverride,
      startMonthIndex: undefined,
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/40 border border-indigo-400/30 rounded-xl text-indigo-300">
              <CalendarClock className="w-5 h-5 text-indigo-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">Programación Masiva de Mantenimientos</h3>
                <span className="px-2 py-0.5 text-xs font-mono font-bold bg-indigo-500/30 text-indigo-200 rounded border border-indigo-400/30">
                  Año {selectedYear}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Configure cronogramas en lote para múltiples equipos técnicos sin hacer clic celda por celda
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario / Contenido con Scroll */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* SECCIÓN 1: ALCANCE DE EQUIPOS (¿A QUIÉNES APLICAR?) */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-600" />
                1. Alcance de Equipos Objetivo
              </label>
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                {targetEquipments.length} equipos seleccionados
              </span>
            </div>

            {/* Opciones de Alcance */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Opción A: Equipos previamente marcados */}
              <button
                type="button"
                onClick={() => setTargetScope('selected')}
                disabled={preSelectedEquipmentIds.length === 0}
                className={`p-3 rounded-xl border text-left transition-all ${
                  targetScope === 'selected'
                    ? 'bg-indigo-50 border-indigo-400 text-indigo-900 shadow-2xs'
                    : preSelectedEquipmentIds.length === 0
                    ? 'bg-slate-100 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">Equipos Marcados en la Tabla</span>
                  {targetScope === 'selected' && <Check className="w-4 h-4 text-indigo-600" />}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {preSelectedEquipmentIds.length > 0
                    ? `${preSelectedEquipmentIds.length} equipos seleccionados con casillas`
                    : 'No hay equipos seleccionados en la tabla'}
                </p>
              </button>

              {/* Opción B: Todos los equipos activos */}
              <button
                type="button"
                onClick={() => setTargetScope('all')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  targetScope === 'all'
                    ? 'bg-indigo-50 border-indigo-400 text-indigo-900 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">Todos los Equipos Activos</span>
                  {targetScope === 'all' && <Check className="w-4 h-4 text-indigo-600" />}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Aplica al total del inventario activo ({activeEquipments.length} equipos)
                </p>
              </button>

              {/* Opción C: Filtrar por Ubicación / Espacio */}
              <button
                type="button"
                onClick={() => setTargetScope('byLocation')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  targetScope === 'byLocation'
                    ? 'bg-indigo-50 border-indigo-400 text-indigo-900 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">Por Ubicación / Espacio</span>
                  {targetScope === 'byLocation' && <Check className="w-4 h-4 text-indigo-600" />}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Programar todos los equipos de un laboratorio, data center o aula
                </p>
              </button>

              {/* Opción D: Filtrar por Frecuencia Actual */}
              <button
                type="button"
                onClick={() => setTargetScope('byFrequency')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  targetScope === 'byFrequency'
                    ? 'bg-indigo-50 border-indigo-400 text-indigo-900 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">Por Frecuencia de Ficha</span>
                  {targetScope === 'byFrequency' && <Check className="w-4 h-4 text-indigo-600" />}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Seleccionar solo equipos de tipo mensual, trimestral, etc.
                </p>
              </button>
            </div>

            {/* Selectores dependientes de la opción elegida */}
            {targetScope === 'byLocation' && (
              <div className="pt-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Seleccione la Ubicación del Campus:
                </label>
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="w-full py-1.5 px-3 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="todas">Todas las ubicaciones ({locations.length})</option>
                  {locations.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {targetScope === 'byFrequency' && (
              <div className="pt-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Seleccione la Frecuencia Actual:
                </label>
                <select
                  value={selectedFrequencyFilter}
                  onChange={(e) => setSelectedFrequencyFilter(e.target.value)}
                  className="w-full py-1.5 px-3 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="todas">Todas las frecuencias</option>
                  <option value="mensual">Solo equipos Mensuales</option>
                  <option value="trimestral">Solo equipos Trimestrales</option>
                  <option value="semestral">Solo equipos Semestrales</option>
                  <option value="anual">Solo equipos Anuales</option>
                  <option value="personalizada">Solo equipos con Frecuencia Personalizada</option>
                </select>
              </div>
            )}

            {/* Vista previa colapsable de los equipos que serán afectados */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowTargetList(!showTargetList)}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
              >
                {showTargetList ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {showTargetList ? 'Ocultar listado de equipos' : `Ver listado de los ${targetEquipments.length} equipos afectados`}
              </button>

              {showTargetList && (
                <div className="mt-2 p-2.5 bg-white border border-slate-200 rounded-lg max-h-40 overflow-y-auto space-y-1 text-xs">
                  <div className="mb-2">
                    <input
                      type="text"
                      value={scopeSearchTerm}
                      onChange={(e) => setScopeSearchTerm(e.target.value)}
                      placeholder="Filtrar equipos en esta lista..."
                      className="w-full px-2.5 py-1 text-xs rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  {targetEquipments.map((eq) => (
                    <div key={eq.id} className="flex items-center justify-between py-1 px-2 hover:bg-slate-50 rounded">
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-mono font-bold text-slate-800 text-[11px] bg-slate-100 px-1.5 py-0.5 rounded">
                          {eq.code}
                        </span>
                        <span className="truncate text-slate-700">{eq.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 shrink-0">
                        <span className="capitalize">{eq.frequency}</span>
                        <span>•</span>
                        <span className="truncate max-w-[120px]">{eq.location}</span>
                      </div>
                    </div>
                  ))}
                  {targetEquipments.length === 0 && (
                    <p className="text-center py-3 text-slate-400 text-xs">
                      No hay equipos que coincidan con los criterios seleccionados.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* SECCIÓN 2: ESTRATEGIA / PATRÓN DE PROGRAMACIÓN */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
              2. Estrategia de Programación
            </label>

            {/* Pestañas de Estrategia */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setStrategy('frequencyDefaults')}
                className={`p-3 rounded-xl border text-center transition-all ${
                  strategy === 'frequencyDefaults'
                    ? 'bg-indigo-50 border-indigo-400 text-indigo-900 font-bold shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Sparkles className="w-4 h-4 mx-auto mb-1 text-indigo-600" />
                <span className="text-xs block">Según Frecuencia de Ficha</span>
                <span className="text-[10px] text-slate-500 font-normal block mt-0.5">Automático</span>
              </button>

              <button
                type="button"
                onClick={() => setStrategy('preset')}
                className={`p-3 rounded-xl border text-center transition-all ${
                  strategy === 'preset'
                    ? 'bg-indigo-50 border-indigo-400 text-indigo-900 font-bold shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Calendar className="w-4 h-4 mx-auto mb-1 text-indigo-600" />
                <span className="text-xs block">Cadencia Predefinida</span>
                <span className="text-[10px] text-slate-500 font-normal block mt-0.5">Trimestral, Mensual...</span>
              </button>

              <button
                type="button"
                onClick={() => setStrategy('custom')}
                className={`p-3 rounded-xl border text-center transition-all ${
                  strategy === 'custom'
                    ? 'bg-indigo-50 border-indigo-400 text-indigo-900 font-bold shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <CheckSquare className="w-4 h-4 mx-auto mb-1 text-indigo-600" />
                <span className="text-xs block">Meses Específicos</span>
                <span className="text-[10px] text-slate-500 font-normal block mt-0.5">Selección manual</span>
              </button>

              <button
                type="button"
                onClick={() => setStrategy('clear')}
                className={`p-3 rounded-xl border text-center transition-all ${
                  strategy === 'clear'
                    ? 'bg-rose-50 border-rose-400 text-rose-900 font-bold shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <RotateCcw className="w-4 h-4 mx-auto mb-1 text-rose-600" />
                <span className="text-xs block">Desprogramar / Limpiar</span>
                <span className="text-[10px] text-slate-500 font-normal block mt-0.5">Quitar marcas "X"</span>
              </button>
            </div>

            {/* Detalle según Estrategia */}
            {strategy === 'frequencyDefaults' && (
              <div className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-xl text-xs space-y-4">
                {/* 1. Selector de Mes de Inicio */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-indigo-600" />
                      Mes en que inicia la programación
                    </label>
                    <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-100/80 px-2.5 py-0.5 rounded-full border border-indigo-200">
                      Inicia en {MONTH_NAMES[startMonthIndex]} {selectedYear}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mb-2.5">
                    Indica el mes donde comenzará la asignación de intervenciones. El sistema asignará fechas en días hábiles (Lunes a Viernes) y continuará en el siguiente mes si no alcanza la capacidad.
                  </p>

                  {/* Selector interactivo de los 12 meses */}
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                    {MONTH_SHORT_NAMES.map((mName, idx) => {
                      const isSelected = startMonthIndex === idx;
                      return (
                        <button
                          key={idx}
                          type="button"
                          id={`btn-select-start-month-${idx}`}
                          onClick={() => setStartMonthIndex(idx)}
                          className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex flex-col items-center justify-center border ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs ring-2 ring-indigo-300'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                          }`}
                        >
                          <span className="text-[10px] uppercase font-mono tracking-wider opacity-75">
                            Mes {idx + 1 < 10 ? `0${idx + 1}` : idx + 1}
                          </span>
                          <span className="text-xs font-bold mt-0.5">{mName}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Reglas de Capacidad Operativa y Nivelación */}
                <div className="p-3.5 bg-white border border-indigo-100 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 font-bold text-slate-800 text-xs pb-1 border-b border-slate-100">
                    <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
                    <span>Parámetros de Capacidad Operativa y Nivelación</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Capacidad Diaria (Máx equipos por día) */}
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-800 text-xs block">Capacidad diaria</span>
                        <span className="text-[11px] text-slate-500 block">Máx. equipos por jornada</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={maxPerDay <= 1}
                          onClick={() => setMaxPerDay((prev) => Math.max(1, prev - 1))}
                          className="w-7 h-7 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40 flex items-center justify-center text-sm shadow-2xs"
                        >
                          -
                        </button>
                        <span className="w-8 text-center font-mono font-black text-sm text-indigo-700">
                          {maxPerDay}
                        </span>
                        <button
                          type="button"
                          disabled={maxPerDay >= 15}
                          onClick={() => setMaxPerDay((prev) => Math.min(15, prev + 1))}
                          className="w-7 h-7 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40 flex items-center justify-center text-sm shadow-2xs"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Días laborales: Lunes a Viernes vs Sábados */}
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-800 text-xs block">Días hábiles</span>
                        <span className="text-[11px] text-slate-500 block">
                          {includeSaturdays ? 'Lunes a Sábado' : 'Lunes a Viernes (Estándar)'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIncludeSaturdays(!includeSaturdays)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                          includeSaturdays
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        }`}
                      >
                        {includeSaturdays ? '+ Sábados' : 'Solo Lu-Vi'}
                      </button>
                    </div>
                  </div>

                  {/* Opciones booleanas de optimización */}
                  <div className="space-y-2 pt-1 text-xs">
                    <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded-lg hover:bg-indigo-50/50 transition-colors">
                      <input
                        type="checkbox"
                        checked={groupByLocation}
                        onChange={(e) => setGroupByLocation(e.target.checked)}
                        className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-bold text-slate-800 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                          Agrupar equipos por Ubicación física (Recomendado)
                        </span>
                        <p className="text-slate-500 text-[11px] mt-0.5">
                          Ordena los equipos por laboratorio, datacenter o aula para que el técnico trabaje en un mismo espacio y minimice traslados.
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded-lg hover:bg-indigo-50/50 transition-colors">
                      <input
                        type="checkbox"
                        checked={syncScheduledDates}
                        onChange={(e) => setSyncScheduledDates(e.target.checked)}
                        className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-bold text-slate-800 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Sincronizar fechas exactas en el Registro de Ejecución
                        </span>
                        <p className="text-slate-500 text-[11px] mt-0.5">
                          Fija el día exacto de cada intervención (ej. 2026-06-01) en las órdenes de mantenimiento preventivo.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* 3. Simulación Interactiva y Desglose de Jornadas Día a Día */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                      <CalendarClock className="w-4 h-4 text-indigo-600" />
                      <span>Simulación y Cronograma Proyectado:</span>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      Calculado en tiempo real según {targetEquipments.length} equipos
                    </span>
                  </div>

                  <SmartSchedulePreview
                    smartSchedule={smartSchedule}
                    maxPerDay={maxPerDay}
                    startMonthName={MONTH_NAMES[startMonthIndex]}
                    selectedYear={selectedYear}
                  />
                </div>
              </div>
            )}

            {strategy === 'preset' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                  {PRESET_OPTIONS.map((preset) => {
                    const isSelected = selectedPresetId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectPreset(preset)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'bg-indigo-50 border-indigo-400 text-indigo-900 font-medium shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold">{preset.name}</span>
                          {isSelected && <Check className="w-4 h-4 text-indigo-600" />}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">{preset.description}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {preset.months.map((m) => (
                            <span
                              key={m}
                              className="px-1.5 py-0.5 bg-indigo-100/80 text-indigo-800 text-[10px] font-bold font-mono rounded"
                            >
                              {MONTH_SHORT_NAMES[m]}
                            </span>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Opción para actualizar la ficha técnica del equipo */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-800">
                      Actualizar también la frecuencia en la ficha de los equipos
                    </span>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Cambia la propiedad oficial del equipo (ej: a Trimestral o Semestral) en la base de datos
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={updateFrequencyRecord}
                    onChange={(e) => setUpdateFrequencyRecord(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                  />
                </div>
              </div>
            )}

            {strategy === 'custom' && (
              <div className="space-y-3 bg-white p-4 border border-slate-200 rounded-xl">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 text-xs">
                  <span className="font-semibold text-slate-700">Seleccione los meses del año {selectedYear}:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleSelectAllMonths(true)}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-[11px] font-medium text-slate-700"
                    >
                      Marcar Todos
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectAllMonths(false)}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-[11px] font-medium text-slate-700"
                    >
                      Desmarcar
                    </button>
                  </div>
                </div>

                {/* Botones de patrones rápidos */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[11px] text-slate-400 self-center mr-1">Patrones rápidos:</span>
                  <button
                    type="button"
                    onClick={() => handleApplyPresetPattern('semester1')}
                    className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[11px] font-medium border border-indigo-200"
                  >
                    1er Semestre (Ene-Jun)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPresetPattern('semester2')}
                    className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[11px] font-medium border border-indigo-200"
                  >
                    2do Semestre (Jul-Dic)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPresetPattern('vacations')}
                    className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[11px] font-medium border border-indigo-200"
                  >
                    Vacaciones Escolares
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPresetPattern('even')}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium"
                  >
                    Meses Pares
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPresetPattern('odd')}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium"
                  >
                    Meses Impares
                  </button>
                </div>

                {/* Grid interactivo de los 12 meses */}
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 pt-2">
                  {MONTH_SHORT_NAMES.map((name, idx) => {
                    const isChecked = customMonths[idx];
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => toggleCustomMonth(idx)}
                        className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center ${
                          isChecked
                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs font-bold'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span className="text-xs font-mono font-bold">{name}</span>
                        <span className={`text-[10px] mt-0.5 ${isChecked ? 'text-indigo-100' : 'text-slate-400'}`}>
                          Mes {idx + 1}
                        </span>
                        <span className="mt-1 font-mono font-black text-xs">
                          {isChecked ? 'X' : '·'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {strategy === 'clear' && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-1.5 text-rose-900">
                <div className="flex items-center gap-2 font-bold text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  <span>Limpiar cronograma de los equipos seleccionados</span>
                </div>
                <p className="text-rose-700 text-[11px]">
                  Se desmarcarán todos los 12 meses (marcas "X") en el año {selectedYear} para los {targetEquipments.length} equipos objetivo.
                </p>
              </div>
            )}
          </div>

          {/* SECCIÓN 3: MODO DE APLICACIÓN */}
          {strategy !== 'clear' && strategy !== 'frequencyDefaults' && (
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                3. Modo de Aplicación en el Cronograma
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setApplyMode('replace')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    applyMode === 'replace'
                      ? 'bg-indigo-50 border-indigo-400 text-indigo-900 font-semibold'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-xs block">Reemplazar Todo</span>
                  <span className="text-[10px] text-slate-500 font-normal block mt-0.5">
                    Sobrescribe los 12 meses (Recomendado)
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setApplyMode('add')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    applyMode === 'add'
                      ? 'bg-indigo-50 border-indigo-400 text-indigo-900 font-semibold'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-xs block">Adicionar Meses</span>
                  <span className="text-[10px] text-slate-500 font-normal block mt-0.5">
                    Conserva las marcas existentes y suma las nuevas
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setApplyMode('remove')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    applyMode === 'remove'
                      ? 'bg-indigo-50 border-indigo-400 text-indigo-900 font-semibold'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-xs block">Quitar Meses</span>
                  <span className="text-[10px] text-slate-500 font-normal block mt-0.5">
                    Elimina solo de los meses seleccionados
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* RESUMEN PREVIO */}
          <div className="p-4 bg-slate-900 text-white rounded-xl border border-slate-800 space-y-2">
            <span className="text-[11px] uppercase tracking-wider text-indigo-400 font-bold block">
              Resumen de Programación Masiva ({selectedYear})
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-400 text-[11px] block">Equipos a procesar:</span>
                <span className="text-base font-bold font-mono text-white">{targetEquipments.length}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[11px] block">Intervenciones proyectadas:</span>
                <span className="text-base font-bold font-mono text-indigo-300">
                  {projectedStats.totalInterventions}
                </span>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <span className="text-slate-400 text-[11px] block">Meses involucrados:</span>
                <span className="text-xs font-semibold text-slate-200 truncate block" title={projectedStats.monthsSummary}>
                  {projectedStats.monthsSummary}
                </span>
              </div>
            </div>
          </div>
        </form>

        {/* Footer con Acciones */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={targetEquipments.length === 0}
            className={`px-5 py-2.5 rounded-lg text-xs font-bold text-white shadow-sm flex items-center gap-2 transition-all ${
              targetEquipments.length === 0
                ? 'bg-slate-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 active:scale-98'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>Aplicar Programación a {targetEquipments.length} Equipos</span>
          </button>
        </div>
      </div>
    </div>
  );
};
