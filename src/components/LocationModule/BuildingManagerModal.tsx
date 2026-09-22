import React, { useState } from 'react';
import { 
  X, 
  Building2, 
  Plus, 
  Edit3, 
  Trash2, 
  Check, 
  AlertCircle, 
  RotateCcw,
  MapPin,
  ArrowRight,
  Info
} from 'lucide-react';
import { CampusLocation } from '../../types';
import { INITIAL_BUILDINGS } from '../../services/storage';

interface BuildingManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  buildings: string[];
  locations: CampusLocation[];
  onAddBuilding: (name: string) => { success: boolean; message: string };
  onRenameBuilding: (oldName: string, newName: string) => { success: boolean; message: string; affectedLocationsCount: number };
  onDeleteBuilding: (name: string, reassignTo?: string) => { success: boolean; message: string; affectedLocationsCount: number };
  onResetBuildings?: () => void;
}

export const BuildingManagerModal: React.FC<BuildingManagerModalProps> = ({
  isOpen,
  onClose,
  buildings,
  locations,
  onAddBuilding,
  onRenameBuilding,
  onDeleteBuilding,
  onResetBuildings,
}) => {
  const [newBuildingName, setNewBuildingName] = useState('');
  const [editingBuilding, setEditingBuilding] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Estado para confirmación de eliminación con reasignación
  const [deletingBuilding, setDeletingBuilding] = useState<string | null>(null);
  const [reassignTarget, setReassignTarget] = useState<string>('');

  if (!isOpen) return null;

  // Mapa de ubicaciones asociadas por edificio
  const locationsCountByBuilding = buildings.reduce((acc, b) => {
    const count = locations.filter(
      (l) => l.building && l.building.toLowerCase().trim() === b.toLowerCase().trim()
    ).length;
    acc[b] = count;
    return acc;
  }, {} as Record<string, number>);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    const trimmed = newBuildingName.trim();
    if (!trimmed) {
      setErrorMsg('Escriba un nombre para el nuevo edificio o bloque.');
      return;
    }

    const res = onAddBuilding(trimmed);
    if (!res.success) {
      setErrorMsg(res.message);
    } else {
      setSuccessMsg(res.message);
      setNewBuildingName('');
    }
  };

  const startEditing = (b: string) => {
    setEditingBuilding(b);
    setEditName(b);
    setErrorMsg('');
    setSuccessMsg('');
    setDeletingBuilding(null);
  };

  const handleSaveRename = (oldName: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    const trimmed = editName.trim();
    if (!trimmed) {
      setErrorMsg('El nombre no puede estar vacío.');
      return;
    }
    if (trimmed.toLowerCase() === oldName.toLowerCase()) {
      setEditingBuilding(null);
      return;
    }

    const res = onRenameBuilding(oldName, trimmed);
    if (!res.success) {
      setErrorMsg(res.message);
    } else {
      setSuccessMsg(res.message);
      setEditingBuilding(null);
    }
  };

  const startDeleting = (b: string) => {
    const affectedCount = locationsCountByBuilding[b] || 0;
    setDeletingBuilding(b);
    setEditingBuilding(null);
    setErrorMsg('');
    setSuccessMsg('');
    // Elegir el primer edificio restante como destino sugerido
    const remaining = buildings.filter((item) => item !== b);
    setReassignTarget(remaining[0] || 'Campus Principal');
  };

  const handleConfirmDelete = () => {
    if (!deletingBuilding) return;
    const res = onDeleteBuilding(deletingBuilding, reassignTarget);
    if (!res.success) {
      setErrorMsg(res.message);
    } else {
      setSuccessMsg(res.message);
      setDeletingBuilding(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Encabezado */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Gestionar Edificios y Bloques Institucionales
              </h3>
              <p className="text-xs text-slate-500">
                Agregue, renombre o ajuste los pabellones y sectores del campus
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensajes de feedback */}
        {(errorMsg || successMsg) && (
          <div className="px-6 pt-4">
            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-start gap-2">
                <Check className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}
          </div>
        )}

        {/* Formulario Agregar Nuevo Edificio */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <form onSubmit={handleAdd} className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Agregar Nuevo Edificio / Bloque
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newBuildingName}
                onChange={(e) => {
                  setNewBuildingName(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="Ej: Pabellón de Ciencias, Bloque Preescolar, Polideportivo..."
                className="flex-1 px-3.5 py-2 text-xs rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Agregar
              </button>
            </div>
          </form>
        </div>

        {/* Lista de Edificios Registrados */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              Edificios y Bloques Registrados ({buildings.length})
            </span>
            <span className="text-[11px] text-slate-400">
              Ubicaciones asociadas
            </span>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs">
            {buildings.map((b) => {
              const isEditing = editingBuilding === b;
              const isDeleting = deletingBuilding === b;
              const locationCount = locationsCountByBuilding[b] || 0;

              if (isDeleting) {
                return (
                  <div key={b} className="p-4 bg-rose-50/70 border-l-4 border-rose-500 space-y-3 text-xs">
                    <div className="flex items-start gap-2 text-rose-900 font-semibold">
                      <AlertCircle className="w-4 h-4 mt-0.5 text-rose-600 shrink-0" />
                      <div>
                        <p>¿Eliminar el edificio "{b}"?</p>
                        {locationCount > 0 ? (
                          <p className="font-normal text-rose-700 mt-1">
                            Hay <strong>{locationCount}</strong> ubicaciones registradas en este edificio. Seleccione a qué edificio desea reasignarlas:
                          </p>
                        ) : (
                          <p className="font-normal text-rose-700 mt-1">
                            Este edificio no tiene ubicaciones vinculadas actualmente.
                          </p>
                        )}
                      </div>
                    </div>

                    {locationCount > 0 && (
                      <div className="space-y-1">
                        <label className="block text-[11px] font-semibold text-slate-700">
                          Reasignar ubicaciones a:
                        </label>
                        <select
                          value={reassignTarget}
                          onChange={(e) => setReassignTarget(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-rose-500 focus:outline-none"
                        >
                          {buildings
                            .filter((item) => item !== b)
                            .map((other) => (
                              <option key={other} value={other}>
                                {other}
                              </option>
                            ))}
                        </select>
                      </div>
                    )}

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setDeletingBuilding(null)}
                        className="px-3 py-1 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded text-xs"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmDelete}
                        className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold shadow-xs flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Confirmar Eliminación
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={b}
                  className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                >
                  {isEditing ? (
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                        className="flex-1 px-2.5 py-1 text-xs rounded border border-indigo-500 text-slate-800 focus:outline-none ring-1 ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveRename(b)}
                        className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors"
                        title="Guardar nombre"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingBuilding(null)}
                        className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded transition-colors"
                        title="Cancelar"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="text-xs font-semibold text-slate-800 truncate">
                          {b}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                            locationCount > 0
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                          title={`${locationCount} ubicaciones en este edificio`}
                        >
                          {locationCount} {locationCount === 1 ? 'ubicación' : 'ubicaciones'}
                        </span>

                        <button
                          type="button"
                          onClick={() => startEditing(b)}
                          className="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-slate-100 transition-colors"
                          title="Editar nombre del edificio"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => startDeleting(b)}
                          disabled={buildings.length <= 1}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title={
                            buildings.length <= 1
                              ? 'No se puede eliminar el único edificio'
                              : 'Eliminar edificio'
                          }
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[11px] text-slate-600 flex items-start gap-2">
            <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <span>
              Al renombrar un edificio o bloque, todas las salas, laboratorios y oficinas vinculadas a ese edificio se actualizan de forma instantánea.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          {onResetBuildings ? (
            <button
              type="button"
              onClick={() => {
                if (confirm('¿Desea restaurar los edificios sugeridos por defecto de FCBV?')) {
                  onResetBuildings();
                  setSuccessMsg('Edificios institucionales restaurados a los valores sugeridos.');
                }
              }}
              className="text-slate-500 hover:text-slate-700 text-xs font-medium flex items-center gap-1 hover:underline"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restaurar Edificios Sugeridos
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            Listo / Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
