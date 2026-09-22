import React, { useState } from 'react';
import { 
  X, 
  Trash2, 
  AlertTriangle, 
  ArrowRight, 
  Server,
  MapPin,
  Check
} from 'lucide-react';
import { CampusLocation, Equipment } from '../../types';

interface LocationDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  location: CampusLocation | null;
  allLocations: CampusLocation[];
  equipments: Equipment[];
  onConfirmDelete: (locationId: string, reassignToLocationName?: string) => void;
}

export const LocationDeleteModal: React.FC<LocationDeleteModalProps> = ({
  isOpen,
  onClose,
  location,
  allLocations,
  equipments,
  onConfirmDelete,
}) => {
  const [reassignTarget, setReassignTarget] = useState<string>('');

  if (!isOpen || !location) return null;

  // Equipos en esta ubicación
  const affectedEquipments = equipments.filter(
    (eq) => eq.location.toLowerCase() === location.name.toLowerCase()
  );

  // Otras ubicaciones activas disponibles para reasignar
  const availableLocations = allLocations.filter(
    (l) => l.id !== location.id && l.status === 'activa'
  );

  const handleDelete = () => {
    onConfirmDelete(
      location.id,
      reassignTarget.trim() ? reassignTarget : undefined
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-rose-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-100 text-rose-700 rounded-lg">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Eliminar Ubicación
              </h3>
              <p className="text-xs text-rose-700 font-medium">
                Acción permanente sobre el catálogo de ubicaciones
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs text-slate-600">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
              <MapPin className="w-4 h-4 text-indigo-600 shrink-0" />
              {location.name}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {location.building} • {location.areaType}
            </div>
          </div>

          {affectedEquipments.length > 0 ? (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
              <div className="flex items-start gap-2 text-amber-900">
                <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-600 shrink-0" />
                <div>
                  <span className="font-bold block">
                    ¡Atención! Hay {affectedEquipments.length} {affectedEquipments.length === 1 ? 'equipo registrado' : 'equipos registrados'} en este espacio:
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {affectedEquipments.map((eq) => (
                      <span key={eq.id} className="font-mono text-[10px] bg-white border border-amber-300 px-1.5 py-0.5 rounded font-bold text-slate-800">
                        {eq.code}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {availableLocations.length > 0 && (
                <div className="pt-2 border-t border-amber-200/80">
                  <label className="block text-[11px] font-semibold text-amber-900 mb-1">
                    Reasignar automáticamente estos equipos a otra ubicación:
                  </label>
                  <select
                    value={reassignTarget}
                    onChange={(e) => setReassignTarget(e.target.value)}
                    className="w-full py-1.5 px-2.5 text-xs rounded border border-amber-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="">-- No reasignar (conservar nombre de texto) --</option>
                    {availableLocations.map((loc) => (
                      <option key={loc.id} value={loc.name}>
                        {loc.name} ({loc.building})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ) : (
            <p className="text-slate-600">
              Esta ubicación no tiene ningún equipo crítico asignado actualmente. Puede eliminarse de forma segura.
            </p>
          )}

          <p className="text-slate-500 text-[11px]">
            ¿Está seguro de que desea eliminar <strong>"{location.name}"</strong>?
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Confirmar Eliminación
          </button>
        </div>
      </div>
    </div>
  );
};
