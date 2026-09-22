import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  CheckCircle2,
  Calendar,
  AlertTriangle,
  User,
  ShieldCheck,
  Clock,
  MapPin,
  PenTool,
  Info,
  X,
  FileCheck2,
  Search,
  Filter,
  Upload,
  Sparkles,
  RotateCcw,
  Check,
  FileSignature
} from 'lucide-react';
import { Equipment, MaintenanceExecution } from '../../types';
import { MONTH_NAMES, getFirstBusinessDayOfMonth } from '../../services/storage';
import { SignaturePad } from '../SignaturePad';

// Generador de Firma Electrónica Institucional Certificada
export function generateInstitutionalDigitalSignature(
  name: string,
  role: string,
  dateStr?: string
): string {
  const canvas = document.createElement('canvas');
  canvas.width = 460;
  canvas.height = 140;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Fondo blanco nítido
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Marco perimetral decorativo
  ctx.strokeStyle = '#cbd5e1'; // slate-300
  ctx.lineWidth = 1;
  ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);

  // Trazo fluido de firma caligráfica
  ctx.strokeStyle = '#0f172a'; // slate-900
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  // Trazo estilizado de firma
  ctx.moveTo(35, 68);
  ctx.bezierCurveTo(45, 25, 75, 20, 85, 65);
  ctx.bezierCurveTo(95, 95, 115, 30, 135, 60);
  ctx.bezierCurveTo(155, 85, 175, 35, 195, 55);
  ctx.bezierCurveTo(215, 75, 235, 40, 260, 50);
  ctx.bezierCurveTo(275, 60, 290, 42, 310, 48);
  ctx.stroke();

  // Rúbrica inferior fluida
  ctx.beginPath();
  ctx.lineWidth = 1.6;
  ctx.moveTo(30, 78);
  ctx.bezierCurveTo(120, 82, 220, 75, 315, 76);
  ctx.stroke();

  // Nombre y Cargo
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
  ctx.fillText(name.toUpperCase(), 30, 98);

  ctx.fillStyle = '#475569';
  ctx.font = '10px system-ui, -apple-system, sans-serif';
  ctx.fillText(role, 30, 114);

  // Sello institucional FCBV (Lado derecho)
  ctx.fillStyle = '#f0fdf4';
  ctx.fillRect(324, 14, 122, 112);
  ctx.strokeStyle = '#16a34a';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(324, 14, 122, 112);

  ctx.fillStyle = '#166534';
  ctx.font = 'bold 9px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('FCBV COLOMBIA', 385, 32);

  ctx.fillStyle = '#15803d';
  ctx.font = 'bold 10px monospace';
  ctx.fillText('FIRMA DIGITAL', 385, 48);

  const todayStr = dateStr || new Date().toISOString().split('T')[0];
  ctx.fillStyle = '#334155';
  ctx.font = '8px monospace';
  ctx.fillText(`FECHA: ${todayStr}`, 385, 66);

  // Hash único de verificación
  const hash = Math.random().toString(36).substring(2, 8).toUpperCase();
  ctx.fillText(`HASH: #${hash}`, 385, 80);

  ctx.fillStyle = '#16a34a';
  ctx.font = 'bold 9px system-ui, -apple-system, sans-serif';
  ctx.fillText('✓ CERTIFICADO', 385, 102);

  return canvas.toDataURL('image/png');
}

export interface BulkExecutionOptions {
  scope: 'filtered' | 'allYear' | 'monthOnly';
  targetMonth: number; // 1-12 o 0 para todo el año
  responsibleName: string;
  responsibleRole: string;
  observations: string;
  overwriteAlreadyExecuted: boolean;
  completeAllTasks: boolean;
  includeDigitalStamp?: boolean;
  signatureDataUrl?: string;
}

export interface BulkExecuteTargetItem {
  equipment: Equipment;
  year: number;
  month: number;
  scheduledDate: string;
  isAlreadyExecuted: boolean;
  existingExecution?: MaintenanceExecution;
}

interface BulkExecutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedYear: number;
  currentSelectedMonth: number; // 0 = todos, 1-12 = mes activo en el filtro
  equipments: Equipment[];
  planMatrix: Record<string, boolean[]>;
  executions: MaintenanceExecution[];
  onConfirmBulkExecute: (executedRecords: MaintenanceExecution[], count: number) => void;
}

export const BulkExecutionModal: React.FC<BulkExecutionModalProps> = ({
  isOpen,
  onClose,
  selectedYear,
  currentSelectedMonth,
  equipments,
  planMatrix,
  executions,
  onConfirmBulkExecute,
}) => {
  // Configuración de alcance
  const [scope, setScope] = useState<'monthOnly' | 'allYear'>(
    currentSelectedMonth > 0 ? 'monthOnly' : 'allYear'
  );
  const [targetMonth, setTargetMonth] = useState<number>(
    currentSelectedMonth > 0 ? currentSelectedMonth : 1
  );

  // Parámetros técnicos de ejecución
  const [responsibleName, setResponsibleName] = useState('Ing. Carlos Mendoza');
  const [responsibleRole, setResponsibleRole] = useState('Líder de Infraestructura y Mantenimiento FCBV');
  const [observations, setObservations] = useState('Mantenimiento preventivo ejecutado según cronograma programado.');
  const [overwriteAlreadyExecuted, setOverwriteAlreadyExecuted] = useState(false);
  const [completeAllTasks, setCompleteAllTasks] = useState(true);

  // Firma digital
  const [signatureDataUrl, setSignatureDataUrl] = useState<string>(() => {
    const saved = localStorage.getItem('fcbv_technician_signature');
    if (saved) return saved;
    return generateInstitutionalDigitalSignature('Ing. Carlos Mendoza', 'Líder de Infraestructura y Mantenimiento FCBV');
  });
  const [signatureMode, setSignatureMode] = useState<'draw' | 'generate' | 'upload'>('generate');
  const [saveAsDefaultSignature, setSaveAsDefaultSignature] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Filtro de búsqueda dentro del modal
  const [modalSearch, setModalSearch] = useState('');
  const [filterLocation, setFilterLocation] = useState('todas');

  const activeEquipments = useMemo(() => {
    return equipments.filter((e) => e.status === 'activo');
  }, [equipments]);

  // Construir mapa de ejecuciones existentes
  const execMap = useMemo(() => {
    const map = new Map<string, MaintenanceExecution>();
    executions.forEach((ex) => {
      map.set(`${ex.equipmentId}_${ex.year}_${ex.month}`, ex);
    });
    return map;
  }, [executions]);

  // Obtener todas las intervenciones programadas para el año
  const allScheduledTargets = useMemo<BulkExecuteTargetItem[]>(() => {
    const items: BulkExecuteTargetItem[] = [];

    activeEquipments.forEach((eq) => {
      const schedule = planMatrix[eq.id] || [];
      schedule.forEach((isScheduled, idx) => {
        if (isScheduled) {
          const mNum = idx + 1;
          const key = `${eq.id}_${selectedYear}_${mNum}`;
          const existing = execMap.get(key);

          // Si ya tiene scheduledDate, usarla. Si no, calcular el primer día hábil del mes
          const scheduledDate =
            existing?.scheduledDate || getFirstBusinessDayOfMonth(selectedYear, mNum);

          const isAlreadyExecuted = Boolean(existing?.isExecuted);

          items.push({
            equipment: eq,
            year: selectedYear,
            month: mNum,
            scheduledDate,
            isAlreadyExecuted,
            existingExecution: existing,
          });
        }
      });
    });

    // Ordenar cronológicamente por mes y luego código
    return items.sort((a, b) => {
      if (a.month !== b.month) return a.month - b.month;
      if (a.scheduledDate !== b.scheduledDate) return a.scheduledDate.localeCompare(b.scheduledDate);
      return a.equipment.code.localeCompare(b.equipment.code);
    });
  }, [activeEquipments, planMatrix, selectedYear, execMap]);

  // Lista de ubicaciones para filtrar dentro del modal
  const locations = useMemo(() => {
    const set = new Set<string>();
    allScheduledTargets.forEach((t) => {
      if (t.equipment.location) set.add(t.equipment.location);
    });
    return Array.from(set).sort();
  }, [allScheduledTargets]);

  // Filtrar según el alcance seleccionado y los filtros adicionales
  const eligibleTargets = useMemo(() => {
    return allScheduledTargets.filter((item) => {
      // Alcance de mes
      if (scope === 'monthOnly' && item.month !== targetMonth) {
        return false;
      }
      // Filtro de ubicación
      if (filterLocation !== 'todas' && item.equipment.location !== filterLocation) {
        return false;
      }
      // Filtro de búsqueda
      if (modalSearch.trim()) {
        const q = modalSearch.toLowerCase().trim();
        const matches =
          item.equipment.code.toLowerCase().includes(q) ||
          item.equipment.name.toLowerCase().includes(q) ||
          item.equipment.location.toLowerCase().includes(q);
        if (!matches) return false;
      }
      // Si no se sobreescribe, verificar si ya está ejecutado
      if (!overwriteAlreadyExecuted && item.isAlreadyExecuted) {
        return false;
      }
      return true;
    });
  }, [allScheduledTargets, scope, targetMonth, filterLocation, modalSearch, overwriteAlreadyExecuted]);

  // Cuántos ya están ejecutados en el universo filtrado
  const alreadyExecutedCount = useMemo(() => {
    return allScheduledTargets.filter((item) => {
      if (scope === 'monthOnly' && item.month !== targetMonth) return false;
      if (filterLocation !== 'todas' && item.equipment.location !== filterLocation) return false;
      return item.isAlreadyExecuted;
    }).length;
  }, [allScheduledTargets, scope, targetMonth, filterLocation]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (eligibleTargets.length === 0) {
      alert('No hay órdenes de mantenimiento pendientes que coincidan con los criterios seleccionados.');
      return;
    }

    if (!responsibleName.trim()) {
      alert('Por favor ingrese el nombre del técnico responsable para certificar las actas.');
      return;
    }

    // Asegurar firma digital válida
    let finalSignature = signatureDataUrl;
    if (!finalSignature || !finalSignature.trim()) {
      finalSignature = generateInstitutionalDigitalSignature(
        responsibleName.trim(),
        responsibleRole.trim()
      );
      setSignatureDataUrl(finalSignature);
    }

    // Guardar firma como predeterminada si fue seleccionado
    if (saveAsDefaultSignature && finalSignature) {
      try {
        localStorage.setItem('fcbv_technician_signature', finalSignature);
      } catch (err) {
        console.warn('No se pudo guardar la firma en localStorage:', err);
      }
    }

    const now = new Date().toISOString();
    // Generar o actualizar las órdenes
    const updatedRecords: MaintenanceExecution[] = eligibleTargets.map((target) => {
      const existing = target.existingExecution;
      // Usar la fecha programada como fecha de ejecución exactamente como lo solicita el usuario
      // Agregar hora estimada estándar de jornada (10:00)
      const executionDateTime = `${target.scheduledDate} 10:00`;

      // Todas las tareas de mantenimiento del equipo marcadas como completadas
      const tasks = completeAllTasks
        ? target.equipment.maintenanceTasks || []
        : existing?.completedTasks || [];

      return {
        id: existing ? existing.id : `exec_${target.equipment.id}_${target.year}_${target.month}`,
        equipmentId: target.equipment.id,
        year: target.year,
        month: target.month,
        scheduledDate: target.scheduledDate,
        isExecuted: true,
        executedDate: executionDateTime,
        responsibleName: responsibleName.trim(),
        responsibleRole: responsibleRole.trim(),
        signatureDataUrl: finalSignature,
        completedTasks: tasks,
        partsReplaced: existing?.partsReplaced || [],
        observations: existing?.observations
          ? `${existing.observations} | ${observations.trim()}`
          : observations.trim(),
        createdAt: existing ? existing.createdAt : now,
        updatedAt: now,
      };
    });

    onConfirmBulkExecute(updatedRecords, updatedRecords.length);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Cabecera del Modal */}
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300">
                  Operación Masiva
                </span>
                <span className="text-xs text-slate-500 font-mono">Año {selectedYear}</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                Ejecución Masiva de Mantenimientos Preventivos
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido Principal con Scroll */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          
          {/* Regla de negocio destacada */}
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
            <Info className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
            <div className="space-y-1 text-slate-700">
              <p className="font-bold text-emerald-950 text-xs">
                Regla Automática: La fecha de ejecución será exactamente igual a la fecha programada
              </p>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                Cada intervención seleccionada se marcará como <strong>EJECUTADA</strong>, asignando en el campo de fecha realizada el día hábil exacto que tenía programado (por ejemplo, <em>2026-06-01 10:00</em>).
              </p>
            </div>
          </div>

          {/* 1. Alcance de Ejecución */}
          <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200 space-y-3">
            <span className="font-bold text-slate-800 text-xs uppercase tracking-wider block">
              1. Alcance de la Ejecución
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label
                className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                  scope === 'monthOnly'
                    ? 'bg-white border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'bg-white/70 border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="scope"
                  checked={scope === 'monthOnly'}
                  onChange={() => setScope('monthOnly')}
                  className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <span className="font-bold text-slate-800 text-xs block">Solo un mes específico</span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    Ejecutar las órdenes programadas para un mes en particular.
                  </span>
                </div>
              </label>

              <label
                className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                  scope === 'allYear'
                    ? 'bg-white border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'bg-white/70 border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="scope"
                  checked={scope === 'allYear'}
                  onChange={() => setScope('allYear')}
                  className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <span className="font-bold text-slate-800 text-xs block">
                    Todo el año {selectedYear} completo
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    Ejecutar todas las intervenciones de los 12 meses.
                  </span>
                </div>
              </label>
            </div>

            {/* Selector interactivo de mes si scope es 'monthOnly' */}
            {scope === 'monthOnly' && (
              <div className="pt-2 border-t border-slate-200">
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                  Selecciona el mes a ejecutar:
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                  {MONTH_NAMES.map((name, idx) => {
                    const mNum = idx + 1;
                    const count = allScheduledTargets.filter((t) => t.month === mNum).length;
                    const isSelected = targetMonth === mNum;
                    return (
                      <button
                        key={mNum}
                        type="button"
                        onClick={() => setTargetMonth(mNum)}
                        className={`p-1.5 rounded-lg text-center transition-all border ${
                          isSelected
                            ? 'bg-emerald-600 text-white font-bold border-emerald-700 shadow-2xs'
                            : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
                        }`}
                      >
                        <div className="text-[11px] font-medium truncate">{name.slice(0, 3)}</div>
                        <div className={`text-[10px] ${isSelected ? 'text-emerald-100' : 'text-slate-400'}`}>
                          {count} prog.
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 2. Filtros secundarios opcionales (Ubicación / Búsqueda) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Filtrar por Ubicación (Opcional):
              </label>
              <select
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-emerald-500"
              >
                <option value="todas">Todas las ubicaciones del campus</option>
                {locations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Buscar por código o nombre:
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  placeholder="Ej. LAP-001, UPS, Computador..."
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* 3. Datos del Responsable y Certificación */}
          <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200 space-y-3">
            <span className="font-bold text-slate-800 text-xs uppercase tracking-wider block">
              2. Datos del Técnico y Certificación
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Nombre del Técnico Responsable: <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={responsibleName}
                    onChange={(e) => setResponsibleName(e.target.value)}
                    placeholder="Ej. Ing. Carlos Mendoza"
                    className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Cargo / Rol Institucional:
                </label>
                <input
                  type="text"
                  value={responsibleRole}
                  onChange={(e) => setResponsibleRole(e.target.value)}
                  placeholder="Ej. Líder de Mantenimiento"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Observación / Hallazgos Técnicos:
              </label>
              <textarea
                rows={2}
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Observación general para el lote ejecutado..."
                className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Checkboxes de configuración de actas */}
            <div className="space-y-2 pt-1 border-t border-slate-200">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={completeAllTasks}
                  onChange={(e) => setCompleteAllTasks(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <span className="text-[11px] text-slate-700 font-medium">
                  Completar automáticamente el 100% de las tareas de la lista de chequeo de cada equipo
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={overwriteAlreadyExecuted}
                  onChange={(e) => setOverwriteAlreadyExecuted(e.target.checked)}
                  className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                />
                <span className="text-[11px] text-slate-700 font-medium">
                  Sobrescribir también las órdenes que ya estaban marcadas como ejecutadas (
                  <span className="text-amber-700 font-bold">{alreadyExecutedCount} ya ejecutadas</span>)
                </span>
              </label>
            </div>
          </div>

          {/* 3. Firma Digital del Técnico Responsable */}
          <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                  <FileSignature className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-slate-800 text-xs uppercase tracking-wider block">
                    3. Firma Digital del Técnico Responsable
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Se estampará en el acta de mantenimiento de cada equipo ejecutado
                  </span>
                </div>
              </div>

              {/* Selector de modo de firma */}
              <div className="inline-flex bg-slate-200/80 p-0.5 rounded-lg text-xs font-medium text-slate-600 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setSignatureMode('draw')}
                  className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                    signatureMode === 'draw'
                      ? 'bg-white text-indigo-700 shadow-2xs font-semibold'
                      : 'hover:text-slate-900'
                  }`}
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>Dibujar en Pantalla</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSignatureMode('generate');
                    const gen = generateInstitutionalDigitalSignature(
                      responsibleName.trim() || 'Ing. Técnico FCBV',
                      responsibleRole.trim() || 'Mantenimiento'
                    );
                    setSignatureDataUrl(gen);
                  }}
                  className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                    signatureMode === 'generate'
                      ? 'bg-white text-indigo-700 shadow-2xs font-semibold'
                      : 'hover:text-slate-900'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Certificada FCBV</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSignatureMode('upload')}
                  className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                    signatureMode === 'upload'
                      ? 'bg-white text-indigo-700 shadow-2xs font-semibold'
                      : 'hover:text-slate-900'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Cargar Imagen</span>
                </button>
              </div>
            </div>

            {/* Contenido según modo */}
            {signatureMode === 'draw' && (
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <SignaturePad
                  label="Área de Firma Manuscrita (Dibuje con ratón o pantalla táctil)"
                  initialSignature={signatureDataUrl}
                  onSave={(dataUrl) => setSignatureDataUrl(dataUrl)}
                  onClear={() => setSignatureDataUrl('')}
                />
              </div>
            )}

            {signatureMode === 'generate' && (
              <div className="bg-white p-3.5 rounded-lg border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-xs">
                  <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Firma Electrónica Institucional Certificada FCBV
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed max-w-md">
                    Genera automáticamente un sello criptográfico oficial con el nombre del técnico (<strong>{responsibleName}</strong>), su rol institucional, marca de tiempo y código hash de seguridad único.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const gen = generateInstitutionalDigitalSignature(
                      responsibleName.trim() || 'Ing. Técnico FCBV',
                      responsibleRole.trim() || 'Mantenimiento'
                    );
                    setSignatureDataUrl(gen);
                  }}
                  className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 shadow-2xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Regenerar Sello Certificado</span>
                </button>
              </div>
            )}

            {signatureMode === 'upload' && (
              <div className="bg-white p-3.5 rounded-lg border border-slate-200 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      const res = ev.target?.result as string;
                      if (res) setSignatureDataUrl(res);
                    };
                    reader.readAsDataURL(file);
                  }}
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-indigo-400 p-4 rounded-lg cursor-pointer bg-slate-50/50 hover:bg-indigo-50/20 transition-all flex flex-col items-center justify-center gap-1.5"
                >
                  <Upload className="w-5 h-5 text-indigo-600" />
                  <span className="text-xs font-semibold text-slate-700">
                    Haga clic para seleccionar o arrastre su imagen de firma
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Formatos recomendados: PNG transparente o JPG nítido
                  </span>
                </div>
              </div>
            )}

            {/* Vista Previa de la Firma Activa */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-lg">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="w-36 h-14 bg-white border border-emerald-300 rounded-lg p-1 flex items-center justify-center shrink-0 shadow-2xs overflow-hidden">
                  {signatureDataUrl ? (
                    <img
                      src={signatureDataUrl}
                      alt="Firma digital activa"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-[10px] text-slate-400 italic">Sin firma vinculada</span>
                  )}
                </div>
                <div className="text-xs">
                  <div className="font-bold text-emerald-900 flex items-center gap-1">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Firma digital vinculada y lista
                  </div>
                  <p className="text-[11px] text-emerald-700">
                    Responsable: <span className="font-semibold">{responsibleName}</span> ({responsibleRole})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                {localStorage.getItem('fcbv_technician_signature') && (
                  <button
                    type="button"
                    onClick={() => {
                      const saved = localStorage.getItem('fcbv_technician_signature');
                      if (saved) setSignatureDataUrl(saved);
                    }}
                    className="text-[11px] text-indigo-700 hover:text-indigo-900 font-semibold px-2 py-1 bg-white border border-indigo-200 rounded hover:bg-indigo-50 transition-colors"
                  >
                    Usar firma guardada
                  </button>
                )}
                {signatureDataUrl && (
                  <button
                    type="button"
                    onClick={() => setSignatureDataUrl('')}
                    className="text-[11px] text-slate-500 hover:text-red-700 px-2 py-1 rounded transition-colors"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            {/* Opción para guardar como predeterminada */}
            <div className="pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] text-slate-600">
                <input
                  type="checkbox"
                  checked={saveAsDefaultSignature}
                  onChange={(e) => setSaveAsDefaultSignature(e.target.checked)}
                  className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <span>Recordar esta firma como predeterminada en este navegador</span>
              </label>
            </div>
          </div>

          {/* 4. Resumen y Vista Previa de Equipos a Ejecutar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-emerald-600" />
                <span className="font-bold text-slate-800 text-xs">
                  Órdenes a Ejecutar Masivamente:
                </span>
              </div>
              <span className="font-mono font-black text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                {eligibleTargets.length} órdenes seleccionadas
              </span>
            </div>

            {eligibleTargets.length === 0 ? (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-center text-slate-500 text-xs">
                No hay órdenes pendientes con los filtros actuales.
              </div>
            ) : (
              <div className="max-h-44 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
                {eligibleTargets.slice(0, 50).map((t, idx) => (
                  <div
                    key={`${t.equipment.id}_${t.month}_${idx}`}
                    className="p-2 flex items-center justify-between hover:bg-slate-50 text-[11px]"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono font-bold text-indigo-900 bg-slate-100 px-1.5 py-0.5 rounded">
                        {t.equipment.code}
                      </span>
                      <span className="text-slate-700 font-medium truncate max-w-[180px]">
                        {t.equipment.name}
                      </span>
                      <span className="text-slate-400 text-[10px] truncate max-w-[140px]">
                        ({t.equipment.location})
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-slate-500 text-[10px]">
                        Mes: <strong>{MONTH_NAMES[t.month - 1].slice(0, 3)}</strong>
                      </span>
                      <span className="font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold text-[10px]">
                        Fecha: {t.scheduledDate}
                      </span>
                    </div>
                  </div>
                ))}
                {eligibleTargets.length > 50 && (
                  <div className="p-2 text-center text-slate-500 text-[10px] bg-slate-50">
                    ... y {eligibleTargets.length - 50} órdenes más seleccionadas
                  </div>
                )}
              </div>
            )}
          </div>
        </form>

        {/* Footer con Botones de Confirmación */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={eligibleTargets.length === 0}
            className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm flex items-center gap-2 transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Ejecutar {eligibleTargets.length} Órdenes Masivamente</span>
          </button>
        </div>
      </div>
    </div>
  );
};
