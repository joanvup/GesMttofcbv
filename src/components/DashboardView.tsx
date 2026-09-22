import React, { useMemo } from 'react';
import { Equipment, MaintenanceExecution } from '../types';
import { ActiveTab } from './Navbar';
import { 
  Server, 
  CalendarClock, 
  Activity, 
  AlertTriangle, 
  ArrowRight,
  ShieldAlert,
  CheckCircle2
} from 'lucide-react';

interface DashboardViewProps {
  equipments: Equipment[];
  planMatrix: Record<string, boolean[]>;
  executions: MaintenanceExecution[];
  selectedYear: number;
  complianceRate: number;
  onNavigate: (tab: ActiveTab) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  equipments,
  planMatrix,
  executions,
  selectedYear,
  complianceRate,
  onNavigate
}) => {
  const currentMonthIndex = new Date().getMonth(); // 0-11
  
  // 1. Equipos Activos
  const activeEquipments = useMemo(() => equipments.filter(e => e.status === 'activo'), [equipments]);
  
  // 2. Mantenimientos Pendientes (Mes actual y próximo)
  const pendingMaintenances = useMemo(() => {
    let count = 0;
    activeEquipments.forEach(eq => {
      // Revisar mes actual
      if (planMatrix[eq.id]?.[currentMonthIndex]) {
        const exec = executions.find(x => x.equipmentId === eq.id && x.year === selectedYear && x.month === currentMonthIndex + 1);
        if (!exec || !exec.isExecuted) count++;
      }
      // Revisar mes próximo (si está dentro del mismo año)
      if (currentMonthIndex < 11 && planMatrix[eq.id]?.[currentMonthIndex + 1]) {
        const exec = executions.find(x => x.equipmentId === eq.id && x.year === selectedYear && x.month === currentMonthIndex + 2);
        if (!exec || !exec.isExecuted) count++;
      }
    });
    return count;
  }, [activeEquipments, planMatrix, executions, selectedYear, currentMonthIndex]);

  // 3. Alertas: Equipos sin ubicación
  const equipmentsWithoutLocation = useMemo(() => {
    return activeEquipments.filter(e => !e.location || e.location.trim() === '');
  }, [activeEquipments]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Panel de Control</h2>
          <p className="text-sm text-slate-500 mt-1">
            Resumen general del estado de infraestructura y mantenimientos preventivos.
          </p>
        </div>
      </div>

      {/* Grid de Métricas Clave */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Equipos Activos */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-50 rounded-full transition-transform group-hover:scale-110" />
          <div className="relative flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
              <Server className="w-5 h-5" />
            </div>
          </div>
          <div className="relative">
            <h3 className="text-3xl font-black text-slate-800">{activeEquipments.length}</h3>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">Equipos Activos</p>
          </div>
          <button 
            onClick={() => onNavigate('equipos')}
            className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            Ver censo completo <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Card 2: Pendientes */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-50 rounded-full transition-transform group-hover:scale-110" />
          <div className="relative flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
              <CalendarClock className="w-5 h-5" />
            </div>
          </div>
          <div className="relative">
            <h3 className="text-3xl font-black text-slate-800">{pendingMaintenances}</h3>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">Pendientes (30 Días)</p>
          </div>
          <button 
            onClick={() => onNavigate('ejecucion')}
            className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-1.5 text-xs font-bold text-amber-600 hover:text-amber-700 transition-colors"
          >
            Ir a ejecución <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Card 3: Cumplimiento */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-50 rounded-full transition-transform group-hover:scale-110" />
          <div className="relative flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="relative">
            <h3 className="text-3xl font-black text-slate-800">{complianceRate}%</h3>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">Cumplimiento {selectedYear}</p>
          </div>
          <button 
            onClick={() => onNavigate('reportes')}
            className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
          >
            Ver reportes oficiales <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Card 4: Alertas */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col relative overflow-hidden group">
          <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full transition-transform group-hover:scale-110 ${equipmentsWithoutLocation.length > 0 ? 'bg-rose-50' : 'bg-slate-50'}`} />
          <div className="relative flex justify-between items-start mb-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${equipmentsWithoutLocation.length > 0 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-400'}`}>
              {equipmentsWithoutLocation.length > 0 ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
            </div>
          </div>
          <div className="relative">
            <h3 className="text-3xl font-black text-slate-800">{equipmentsWithoutLocation.length}</h3>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">Sin Ubicación</p>
          </div>
          <button 
            onClick={() => onNavigate('equipos')}
            className={`mt-4 pt-4 border-t border-slate-100 flex items-center gap-1.5 text-xs font-bold transition-colors ${equipmentsWithoutLocation.length > 0 ? 'text-rose-600 hover:text-rose-700' : 'text-slate-500 hover:text-slate-600'}`}
          >
            Revisar inventario <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Alertas Detalladas */}
      {equipmentsWithoutLocation.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 flex items-start gap-4 animate-in fade-in slide-in-from-bottom-2">
          <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0 text-rose-600 mt-0.5">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-rose-900">Atención: Hay equipos que requieren actualización</h4>
            <p className="text-xs text-rose-700 mt-1 mb-3 leading-relaxed">
              Se han detectado {equipmentsWithoutLocation.length} equipo(s) activo(s) en el sistema que no tienen una ubicación física asignada. Esto puede generar inconsistencias en los reportes F01 y F02.
            </p>
            <div className="flex flex-wrap gap-2">
              {equipmentsWithoutLocation.slice(0, 5).map(eq => (
                <span key={eq.id} className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold bg-white text-rose-700 border border-rose-200">
                  {eq.code}
                </span>
              ))}
              {equipmentsWithoutLocation.length > 5 && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold bg-rose-100 text-rose-700">
                  +{equipmentsWithoutLocation.length - 5} más
                </span>
              )}
            </div>
            <button 
              onClick={() => onNavigate('equipos')}
              className="mt-4 px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-700 transition-colors shadow-sm"
            >
              Asignar Ubicaciones Ahora
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
