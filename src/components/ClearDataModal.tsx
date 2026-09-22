import React, { useState } from 'react';
import { Trash2, AlertTriangle, CheckCircle2, RotateCcw, X, Building, Server, CalendarDays, ShieldAlert } from 'lucide-react';

interface ClearDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmClear: (options: { preserveLocations: boolean }) => void;
  equipmentsCount: number;
  locationsCount: number;
  executionsCount: number;
}

export const ClearDataModal: React.FC<ClearDataModalProps> = ({
  isOpen,
  onClose,
  onConfirmClear,
  equipmentsCount,
  locationsCount,
  executionsCount,
}) => {
  const [preserveLocations, setPreserveLocations] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  if (!isOpen) return null;

  const handleExecuteClear = () => {
    setIsConfirming(true);
    setTimeout(() => {
      onConfirmClear({ preserveLocations });
      setIsConfirming(false);
      onClose();
    }, 250);
  };

  return (
    <div 
      id="modal-clear-demo-data"
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="clear-modal-title"
    >
      <div className="bg-white text-slate-800 rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
        {/* Cabecera con alerta visual */}
        <div className="bg-rose-50 border-b border-rose-100 p-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 id="clear-modal-title" className="text-base font-bold text-rose-950">
                Limpiar Datos de Demostración
              </h3>
              <p className="text-xs text-rose-700 mt-0.5">
                Vaciar la aplicación para iniciar con datos reales del colegio
              </p>
            </div>
          </div>
          <button
            type="button"
            id="btn-close-clear-modal"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-rose-100/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo del Modal */}
        <div className="p-6 space-y-5">
          <div className="text-xs text-slate-600 space-y-2">
            <p>
              Esta acción eliminará los registros de prueba precargados para que pueda configurar el sistema desde cero con el inventario y cronograma oficial del <strong>Colegio Bilingüe (FCBV)</strong>.
            </p>
          </div>

          {/* Resumen de los datos que se van a eliminar */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Registros que se limpiarán:
            </span>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200/80 shadow-2xs">
                <Server className="w-4 h-4 text-indigo-500 shrink-0" />
                <div>
                  <strong className="text-slate-800 font-semibold">{equipmentsCount}</strong>
                  <span className="text-slate-500 block text-[11px]">Equipos Críticos</span>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200/80 shadow-2xs">
                <CalendarDays className="w-4 h-4 text-sky-500 shrink-0" />
                <div>
                  <strong className="text-slate-800 font-semibold">12 Meses</strong>
                  <span className="text-slate-500 block text-[11px]">Cronograma Anual</span>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200/80 shadow-2xs">
                <ShieldAlert className="w-4 h-4 text-emerald-500 shrink-0" />
                <div>
                  <strong className="text-slate-800 font-semibold">{executionsCount}</strong>
                  <span className="text-slate-500 block text-[11px]">Actas de Ejecución</span>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200/80 shadow-2xs">
                <Building className="w-4 h-4 text-amber-500 shrink-0" />
                <div>
                  <strong className="text-slate-800 font-semibold">
                    {preserveLocations ? '0 (Conservadas)' : `${locationsCount}`}
                  </strong>
                  <span className="text-slate-500 block text-[11px]">Ubicaciones del Campus</span>
                </div>
              </div>
            </div>
          </div>

          {/* Opción para conservar el catálogo de ubicaciones */}
          <div className="p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-xl">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                id="checkbox-preserve-locations"
                checked={preserveLocations}
                onChange={(e) => setPreserveLocations(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div className="text-xs">
                <span className="font-semibold text-slate-800">
                  Conservar el catálogo de Ubicaciones del Campus ({locationsCount} espacios)
                </span>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Marque esta casilla si desea conservar los edificios, salas de cómputo y laboratorios para reutilizarlos con sus equipos reales.
                </p>
              </div>
            </label>
          </div>

          {/* Advertencia informativa de seguridad */}
          <div className="flex items-start gap-2.5 p-3 text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span>
                Recomendación: Puede descargar previamente una <strong>Copia de Seguridad (.json)</strong> completa desde la barra superior. Si desea recuperar los datos de ejemplo más adelante, también podrá usar el botón <strong>"Restaurar Demo"</strong>.
              </span>
            </div>
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-end gap-3">
          <button
            type="button"
            id="btn-cancel-clear-data"
            onClick={onClose}
            disabled={isConfirming}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            id="btn-confirm-clear-data"
            onClick={handleExecuteClear}
            disabled={isConfirming}
            className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            <span>{isConfirming ? 'Limpiando...' : 'Sí, Limpiar Datos Demo'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
