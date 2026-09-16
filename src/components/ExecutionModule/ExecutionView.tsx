import React, { useState, useMemo } from 'react';
import { 
  ClipboardCheck, 
  Search, 
  Filter, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Download, 
  FileSpreadsheet, 
  Edit3, 
  FileCheck, 
  UserCheck, 
  ChevronLeft, 
  ChevronRight,
  ShieldCheck,
  Check,
  PlayCircle,
  Zap
} from 'lucide-react';
import { Equipment, MaintenanceExecution, ExecutionStatus } from '../../types';
import { MONTH_NAMES, MONTH_SHORT_NAMES, StorageService, isBusinessDay } from '../../services/storage';
import { ExportService } from '../../services/exportService';
import { ExecutionModal } from './ExecutionModal';
import { BulkExecutionModal } from './BulkExecutionModal';

interface ExecutionViewProps {
  equipments: Equipment[];
  selectedYear: number;
  onYearChange: (year: number) => void;
  planMatrix: Record<string, boolean[]>;
  executions: MaintenanceExecution[];
  onSaveExecution: (execution: MaintenanceExecution) => void;
  onBulkSaveExecutions?: (executedList: MaintenanceExecution[], count: number) => void;
}

export const ExecutionView: React.FC<ExecutionViewProps> = ({
  equipments,
  selectedYear,
  onYearChange,
  planMatrix,
  executions,
  onSaveExecution,
  onBulkSaveExecutions,
}) => {
  const [selectedMonth, setSelectedMonth] = useState<number>(0); // 0 = Todos los meses
  const [selectedStatus, setSelectedStatus] = useState<string>('todos'); // 'todos' | 'pendiente' | 'ejecutado' | 'atrasado'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('todas');
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  // Modal de edición de ejecución
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    equipment: Equipment | null;
    month: number;
    existingExecution: MaintenanceExecution | null;
  }>({
    isOpen: false,
    equipment: null,
    month: 1,
    existingExecution: null,
  });

  // Mapa de equipos activos
  const activeEquipments = useMemo(() => {
    return equipments.filter((e) => e.status === 'activo');
  }, [equipments]);

  const eqMap = useMemo(() => {
    return new Map<string, Equipment>(equipments.map((e) => [e.id, e]));
  }, [equipments]);

  // Construir la lista completa de mantenimientos derivados del Plan Anual
  const scheduledItems = useMemo(() => {
    const items: Array<{
      equipment: Equipment;
      year: number;
      month: number;
      execution?: MaintenanceExecution;
      status: 'ejecutado' | 'atrasado' | 'pendiente';
    }> = [];

    activeEquipments.forEach((eq) => {
      const schedule = planMatrix[eq.id] || [];
      schedule.forEach((isScheduled, idx) => {
        if (isScheduled) {
          const monthNum = idx + 1;
          // Buscar si existe un registro de ejecución guardado
          const existing = executions.find(
            (ex) => ex.equipmentId === eq.id && ex.year === selectedYear && ex.month === monthNum
          );
          const status = StorageService.calculateStatus(existing, selectedYear, monthNum);
          items.push({
            equipment: eq,
            year: selectedYear,
            month: monthNum,
            execution: existing,
            status,
          });
        }
      });
    });

    // Ordenar cronológicamente por mes y luego por código
    return items.sort((a, b) => {
      if (a.month !== b.month) return a.month - b.month;
      return a.equipment.code.localeCompare(b.equipment.code);
    });
  }, [activeEquipments, planMatrix, executions, selectedYear]);

  // Lista de ubicaciones para filtro
  const locations = useMemo(() => {
    const locSet = new Set<string>();
    activeEquipments.forEach((eq) => {
      if (eq.location) locSet.add(eq.location);
    });
    return Array.from(locSet).sort();
  }, [activeEquipments]);

  // Filtrado de items
  const filteredItems = useMemo(() => {
    return scheduledItems.filter((item) => {
      // Filtro por mes
      if (selectedMonth !== 0 && item.month !== selectedMonth) {
        return false;
      }
      // Filtro por estado
      if (selectedStatus !== 'todos' && item.status !== selectedStatus) {
        return false;
      }
      // Filtro por ubicación
      if (selectedLocation !== 'todas' && item.equipment.location !== selectedLocation) {
        return false;
      }
      // Búsqueda por texto
      if (searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        const matches =
          item.equipment.code.toLowerCase().includes(term) ||
          item.equipment.name.toLowerCase().includes(term) ||
          item.equipment.location.toLowerCase().includes(term) ||
          (item.execution?.responsibleName && item.execution.responsibleName.toLowerCase().includes(term));
        if (!matches) return false;
      }
      return true;
    });
  }, [scheduledItems, selectedMonth, selectedStatus, selectedLocation, searchTerm]);

  // Métricas generales de cumplimiento
  const stats = useMemo(() => {
    const total = scheduledItems.length;
    const ejecutados = scheduledItems.filter((i) => i.status === 'ejecutado').length;
    const atrasados = scheduledItems.filter((i) => i.status === 'atrasado').length;
    const pendientes = scheduledItems.filter((i) => i.status === 'pendiente').length;
    const complianceRate = total > 0 ? Math.round((ejecutados / total) * 100) : 0;

    return { total, ejecutados, atrasados, pendientes, complianceRate };
  }, [scheduledItems]);

  const handleOpenModal = (item: typeof scheduledItems[0]) => {
    setModalState({
      isOpen: true,
      equipment: item.equipment,
      month: item.month,
      existingExecution: item.execution || null,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header del Módulo */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              Control de Cumplimiento
            </span>
            <span className="text-xs text-slate-400">• FCBV Operaciones</span>
          </div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2.5 mt-1">
            <ClipboardCheck className="w-6 h-6 text-indigo-600" />
            Registro de Mantenimiento Ejecutado
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Gestión de fechas específicas (días hábiles), checklist de tareas, firmas digitales y estado de ejecución
          </p>
        </div>

        {/* Controles de Año y Exportación */}
        <div className="flex flex-wrap items-center gap-3">
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

          <button
            type="button"
            id="btn-open-bulk-execute"
            onClick={() => setIsBulkModalOpen(true)}
            className="px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg flex items-center gap-1.5 transition-all shadow-xs"
            title="Ejecutar masivamente las órdenes de mantenimiento usando su fecha programada"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Ejecutar Masivamente</span>
            {stats.pendientes + stats.atrasados > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] bg-emerald-900/40 text-emerald-100 rounded-full font-mono">
                {stats.pendientes + stats.atrasados}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() =>
              ExportService.exportExecutionsToExcel(
                selectedYear,
                executions,
                equipments,
                selectedMonth,
                selectedStatus
              )
            }
            className="px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Exportar Excel (.xlsx)
          </button>

          <button
            type="button"
            onClick={() =>
              ExportService.exportExecutionsToPDF(
                selectedYear,
                executions,
                equipments,
                selectedMonth,
                selectedStatus
              )
            }
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <Download className="w-4 h-4 text-slate-500" />
            Exportar PDF Oficial
          </button>
        </div>
      </div>

      {/* Tarjetas de Métricas KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {/* Cumplimiento Global */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Cumplimiento</span>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              {stats.complianceRate}%
            </span>
          </div>
          <span className="text-2xl font-bold text-slate-800 mt-1 block">
            {stats.ejecutados} / {stats.total}
          </span>
          <div className="w-full bg-slate-100 h-2 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-emerald-600 h-full rounded-full transition-all duration-300"
              style={{ width: `${stats.complianceRate}%` }}
            />
          </div>
        </div>

        {/* Ejecutados */}
        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-700 uppercase tracking-wider">Ejecutados</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <span className="text-2xl font-bold text-emerald-700 mt-1 block">{stats.ejecutados}</span>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Con firma y fecha verificada</span>
        </div>

        {/* Pendientes */}
        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-800 uppercase tracking-wider">Pendientes</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <span className="text-2xl font-bold text-amber-800 mt-1 block">{stats.pendientes}</span>
          <span className="text-[11px] text-slate-500 mt-0.5 block">En calendario de trabajo</span>
        </div>

        {/* Atrasados */}
        <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-rose-800 uppercase tracking-wider">Atrasados</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <span className="text-2xl font-bold text-rose-800 mt-1 block">{stats.atrasados}</span>
          <span className="text-[11px] text-rose-600 mt-0.5 block">Requiere atención prioritaria</span>
        </div>
      </div>

      {/* Barra de Filtros interactivos */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Búsqueda */}
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por código, equipo, ubicación o técnico..."
              className="w-full pl-10 pr-4 py-2 text-xs rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Selector de Mes */}
          <div className="w-full md:w-48">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
              className="w-full py-2 px-3 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value={0}>Todos los meses ({scheduledItems.length})</option>
              {MONTH_NAMES.map((m, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Selector de Estado */}
          <div className="w-full md:w-44">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full py-2 px-3 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            >
              <option value="todos">Todos los estados</option>
              <option value="pendiente">Solo Pendientes</option>
              <option value="ejecutado">Solo Ejecutados</option>
              <option value="atrasado">Solo Atrasados</option>
            </select>
          </div>

          {/* Selector de Ubicación */}
          <div className="w-full md:w-52">
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full py-2 px-3 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="todas">Todas las ubicaciones ({locations.length})</option>
              {locations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Meses en píldoras horizontales para acceso rápido */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 pt-1 border-t border-slate-100 text-xs">
          <span className="text-slate-400 text-[11px] font-medium mr-1 shrink-0">Mes:</span>
          <button
            type="button"
            onClick={() => setSelectedMonth(0)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-colors ${
              selectedMonth === 0
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todos
          </button>
          {MONTH_SHORT_NAMES.map((m, idx) => {
            const mNum = idx + 1;
            const countInMonth = scheduledItems.filter((i) => i.month === mNum).length;
            const isSelected = selectedMonth === mNum;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setSelectedMonth(mNum)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-colors ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {m} {countInMonth > 0 && <span className="opacity-75">({countInMonth})</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tabla de Mantenimientos Programados / Ejecutados */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3">Código</th>
                <th className="py-3 px-4">Equipo / Ubicación</th>
                <th className="py-3 px-3 text-center">Mes</th>
                <th className="py-3 px-3">Fecha Programada</th>
                <th className="py-3 px-3 text-center">Estado</th>
                <th className="py-3 px-3">Ejecución & Responsable</th>
                <th className="py-3 px-3 text-center">Firma Digital</th>
                <th className="py-3 px-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredItems.length > 0 ? (
                filteredItems.map((item, idx) => {
                  const hasSignature = Boolean(item.execution?.signatureDataUrl);
                  const isExecuted = item.status === 'ejecutado';
                  const isOverdue = item.status === 'atrasado';

                  return (
                    <tr
                      key={`${item.equipment.id}_${item.month}_${idx}`}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      {/* Código */}
                      <td className="py-3 px-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                        <span className="px-2 py-1 bg-slate-100 border border-slate-300 rounded text-xs">
                          {item.equipment.code}
                        </span>
                      </td>

                      {/* Nombre y Ubicación */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{item.equipment.name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{item.equipment.location}</div>
                      </td>

                      {/* Mes */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {MONTH_NAMES[item.month - 1]}
                        </span>
                      </td>

                      {/* Fecha Programada (Día hábil) */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {item.execution?.scheduledDate ? (
                          <div className="font-mono text-xs text-slate-800 font-medium">
                            {item.execution.scheduledDate}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Sin fecha fijada</span>
                        )}
                      </td>

                      {/* Estado */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {isExecuted && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Ejecutado
                          </span>
                        )}
                        {isOverdue && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Atrasado
                          </span>
                        )}
                        {!isExecuted && !isOverdue && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            <Clock className="w-3.5 h-3.5" />
                            Pendiente
                          </span>
                        )}
                      </td>

                      {/* Ejecución & Responsable */}
                      <td className="py-3 px-3">
                        {isExecuted ? (
                          <div>
                            <div className="font-medium text-slate-800 flex items-center gap-1">
                              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                              {item.execution?.responsibleName || 'Técnico registrado'}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {item.execution?.executedDate || '-'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">Pendiente de ejecución</span>
                        )}
                      </td>

                      {/* Firma Digital Preview */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {hasSignature ? (
                          <div className="inline-flex flex-col items-center">
                            <div className="w-16 h-7 border border-slate-200 rounded bg-white p-0.5 shadow-2xs overflow-hidden">
                              <img
                                src={item.execution?.signatureDataUrl}
                                alt="Firma digital"
                                className="w-full h-full object-contain"
                              />
                            </div>
                            <span className="text-[9px] text-emerald-700 font-medium mt-0.5">
                              Certificada
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300 text-xs">-</span>
                        )}
                      </td>

                      {/* Acción */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenModal(item)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 ml-auto transition-all ${
                            isExecuted
                              ? 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                              : 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-700 shadow-2xs'
                          }`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          {isExecuted ? 'Ver / Editar Acta' : 'Programar / Ejecutar'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <ClipboardCheck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm font-medium text-slate-600">
                      No hay mantenimientos que coincidan con los filtros
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Ajuste los filtros de mes o estado, o asegúrese de que haya equipos con "X" en el Plan Anual.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Ejecución Individual */}
      {modalState.isOpen && (
        <ExecutionModal
          isOpen={modalState.isOpen}
          onClose={() =>
            setModalState({
              isOpen: false,
              equipment: null,
              month: 1,
              existingExecution: null,
            })
          }
          equipment={modalState.equipment}
          year={selectedYear}
          month={modalState.month}
          existingExecution={modalState.existingExecution}
          onSave={(savedExecution) => {
            onSaveExecution(savedExecution);
          }}
        />
      )}

      {/* Modal de Ejecución Masiva */}
      {isBulkModalOpen && (
        <BulkExecutionModal
          isOpen={isBulkModalOpen}
          onClose={() => setIsBulkModalOpen(false)}
          selectedYear={selectedYear}
          currentSelectedMonth={selectedMonth}
          equipments={equipments}
          planMatrix={planMatrix}
          executions={executions}
          onConfirmBulkExecute={(records, count) => {
            if (onBulkSaveExecutions) {
              onBulkSaveExecutions(records, count);
            } else {
              // Fallback: guardar uno a uno
              records.forEach((r) => onSaveExecution(r));
            }
          }}
        />
      )}
    </div>
  );
};
