import React, { useState } from 'react';
import { 
  Server, 
  CalendarDays, 
  ClipboardCheck, 
  Shield, 
  RotateCcw, 
  Database, 
  CheckCircle2, 
  AlertTriangle,
  HelpCircle,
  X,
  MapPin,
  Trash2,
  FileText
} from 'lucide-react';
import { ClearDataModal } from './ClearDataModal';

export type ActiveTab = 'dashboard' | 'equipos' | 'plan' | 'ejecucion' | 'ubicaciones' | 'reportes' | 'usuarios' | 'database';

interface NavbarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  equipmentsCount: { total: number; active: number };
  interventionsCount: number;
  complianceRate: number;
  overdueCount: number;
  locationsCount: number;
  executionsCount?: number;
  onResetData: () => void;
  onClearData: (options: { preserveLocations: boolean }) => void;
  onOpenBackupRestore: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  equipmentsCount,
  interventionsCount,
  complianceRate,
  overdueCount,
  locationsCount,
  executionsCount = 0,
  onResetData,
  onClearData,
  onOpenBackupRestore,
}) => {
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Fila Principal */}
        <div className="flex items-center justify-between h-16">
          {/* Logo & Institución FCBV */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black tracking-wider shadow-sm border border-indigo-400/30">
              <span className="text-base font-mono">FCBV</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold tracking-tight text-white sm:text-base">
                  Colegio Bilingüe (FCBV)
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 rounded border border-indigo-400/30">
                  Infraestructura & TIC
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Gestión de Mantenimiento Preventivo de Equipos Críticos
              </p>
            </div>
          </div>

          {/* Acciones del Sistema */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-nav-backup-restore"
              onClick={onOpenBackupRestore}
              className="px-2.5 py-1.5 text-indigo-200 hover:text-white bg-indigo-950/80 hover:bg-indigo-900/90 border border-indigo-700/60 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shadow-2xs"
              title="Crear o restaurar una copia de seguridad completa de la base de datos (.json)"
            >
              <Database className="w-4 h-4 text-indigo-400" />
              <span className="hidden sm:inline">Copia de Seguridad</span>
            </button>

            <button
              type="button"
              id="btn-nav-help-guide"
              onClick={() => setShowHelpModal(true)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
              title="Guía y conexión de los 4 módulos"
            >
              <HelpCircle className="w-4 h-4" />
              <span className="hidden md:inline">Guía del Sistema</span>
            </button>

            <button
              type="button"
              id="btn-nav-clear-demo"
              onClick={() => setShowClearConfirm(true)}
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
              title="Limpiar todos los datos demo de la app (iniciar con datos reales)"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden md:inline">Limpiar Demo</span>
            </button>

            <button
              type="button"
              id="btn-nav-reset-demo"
              onClick={() => setShowResetConfirm(true)}
              className="p-2 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
              title="Restaurar datos iniciales de prueba de FCBV"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden md:inline">Restaurar Demo</span>
            </button>
          </div>
        </div>

        {/* Pestañas de Navegación (Equipos | Plan | Ejecución) */}
        <div className="flex space-x-1 border-t border-slate-800/80 pt-1 overflow-x-auto no-scrollbar scroll-smooth">
          {/* Tab 1: Equipos Críticos */}
          <button
            type="button"
            onClick={() => onTabChange('equipos')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'equipos'
                ? 'border-indigo-500 text-white bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            <Server className="w-4 h-4 text-indigo-400" />
            <span>1. Registro de Equipos Críticos</span>
            <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-slate-700 text-slate-300 font-mono">
              {equipmentsCount.active} activos
            </span>
          </button>

          {/* Tab 2: Plan de Mantenimiento */}
          <button
            type="button"
            onClick={() => onTabChange('plan')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'plan'
                ? 'border-indigo-500 text-white bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            <CalendarDays className="w-4 h-4 text-sky-400" />
            <span>2. Plan de Mantenimiento (Cronograma)</span>
            <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-sky-950 text-sky-300 border border-sky-800 font-mono">
              {interventionsCount} marcas "X"
            </span>
          </button>

          {/* Tab 3: Mantenimiento Ejecutado */}
          <button
            type="button"
            onClick={() => onTabChange('ejecucion')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'ejecucion'
                ? 'border-indigo-500 text-white bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            <ClipboardCheck className="w-4 h-4 text-emerald-400" />
            <span>3. Mantenimiento Ejecutado</span>
            <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono">
              {complianceRate}%
            </span>
            {overdueCount > 0 && (
              <span
                title={`${overdueCount} atrasados`}
                className="px-1.5 py-0.5 text-[10px] rounded-full bg-rose-950 text-rose-300 border border-rose-800 font-mono flex items-center gap-0.5"
              >
                <AlertTriangle className="w-3 h-3 text-rose-400" />
                {overdueCount}
              </span>
            )}
          </button>

          {/* Tab 4: Gestión de Ubicaciones */}
          <button
            type="button"
            onClick={() => onTabChange('ubicaciones')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'ubicaciones'
                ? 'border-indigo-500 text-white bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            <MapPin className="w-4 h-4 text-amber-400" />
            <span>4. Ubicaciones del Campus</span>
            <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-amber-950 text-amber-300 border border-amber-800 font-mono">
              {locationsCount} espacios
            </span>
          </button>

          {/* Tab 5: Reportes Oficiales SGC */}
          <button
            type="button"
            id="btn-nav-tab-reportes"
            onClick={() => onTabChange('reportes')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'reportes'
                ? 'border-indigo-500 text-white bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            <FileText className="w-4 h-4 text-purple-400" />
            <span>5. Reportes Oficiales SGC</span>
            <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-purple-950 text-purple-300 border border-purple-800 font-mono">
              F01 • F02 • F03 • F05
            </span>
          </button>
        </div>
      </div>

      {/* Modal de Confirmación de Restaurar Datos */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl border border-slate-200 animate-in fade-in">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-amber-600" />
              Restaurar Datos de Demostración FCBV
            </h3>
            <p className="text-xs text-slate-600 mt-2">
              Esta acción restablecerá los equipos de muestra de FCBV (Access Points, Switches Cisco, Servidores, UPS, Climatización), el cronograma y las ejecuciones iniciales en el almacenamiento local de su navegador.
            </p>
            <div className="flex justify-end gap-2.5 mt-5">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onResetData();
                  setShowResetConfirm(false);
                }}
                className="px-4 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-xs"
              >
                Sí, Restaurar Datos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Ayuda y Flujo Interconectado */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-slate-800 rounded-xl p-6 max-w-xl w-full shadow-2xl border border-slate-200 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-600" />
                Flujo Interconectado del Sistema FCBV
              </h3>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 py-4 text-xs text-slate-600">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <strong className="text-slate-800 block font-semibold mb-1">
                  1. Registro de Equipos Críticos
                </strong>
                Aquí gestiona el inventario técnico (Access Points, Switches, Proyectores, Servidores, UPS, Climatización), sus partes y lista de tareas preventivas. Puede crear, editar, dar de baja lógica o importar masivamente desde Excel (.xlsx).
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <strong className="text-slate-800 block font-semibold mb-1">
                  2. Plan de Mantenimiento (Cronograma Anual)
                </strong>
                Se calcula automáticamente según la frecuencia (mensual, trimestral, semestral o anual). En la matriz de 12 columnas (Ene–Dic), puede hacer clic en cualquier celda para activar o desactivar la marca "X". Exportable a Excel y PDF con diseño institucional.
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <strong className="text-slate-800 block font-semibold mb-1">
                  3. Registro de Mantenimiento Ejecutado
                </strong>
                Alimentado directamente por las marcas "X" del cronograma. Permite agendar una fecha específica dentro de días hábiles (lunes a viernes), completar el checklist de actividades técnicas, capturar la firma digital del técnico en canvas y exportar actas oficiales a Excel y PDF.
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <strong className="text-slate-800 block font-semibold mb-1">
                  4. Gestión de Ubicaciones del Campus
                </strong>
                Administre el catálogo de espacios físicos (bloques, laboratorios, salas de cómputo, data centers, auditorios y depósitos). Al crear o editar equipos críticos puede seleccionar o crear ubicaciones dinámicamente, y al renombrar una ubicación, los activos vinculados se actualizan automáticamente en cascada.
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Limpiar Datos Demo */}
      <ClearDataModal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirmClear={(options) => {
          onClearData(options);
        }}
        equipmentsCount={equipmentsCount.total}
        locationsCount={locationsCount}
        executionsCount={executionsCount}
      />
    </header>
  );
};
