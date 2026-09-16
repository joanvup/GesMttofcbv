import React from 'react';
import { X, Server, MapPin, Tag, ShieldAlert, CheckCircle2, Wrench, Layers, Clock, Edit2, Archive, FileText } from 'lucide-react';
import { Equipment } from '../../types';
import { MONTH_SHORT_NAMES } from '../../services/storage';

interface EquipmentDetailsModalProps {
  equipment: Equipment | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (equipment: Equipment) => void;
  onToggleStatus: (equipment: Equipment) => void;
  onViewOfficialReport?: (equipment: Equipment) => void;
}

export const EquipmentDetailsModal: React.FC<EquipmentDetailsModalProps> = ({
  equipment,
  isOpen,
  onClose,
  onEdit,
  onToggleStatus,
  onViewOfficialReport,
}) => {
  if (!isOpen || !equipment) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold bg-slate-200 text-slate-800 px-2 py-0.5 rounded">
                  {equipment.code}
                </span>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                    equipment.status === 'activo'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}
                >
                  {equipment.status === 'activo' ? 'Activo en Plan' : 'Dado de Baja Lógica'}
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-800 mt-1">
                {equipment.name}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-400 block font-medium">Ubicación</span>
              <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                {equipment.location}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Marca y Modelo</span>
              <span className="font-semibold text-slate-800 block mt-0.5">
                {equipment.brand || 'No especificada'} {equipment.model ? `(${equipment.model})` : ''}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Número de Serial</span>
              <span className="font-mono text-slate-800 block mt-0.5 font-semibold">
                {equipment.serial || 'Sin serial'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Frecuencia de Mantenimiento</span>
              <span className="font-semibold text-indigo-700 capitalize flex items-center gap-1 mt-0.5">
                <Clock className="w-3.5 h-3.5" />
                {equipment.frequency}
              </span>
            </div>
            <div className="sm:col-span-2">
              <span className="text-slate-400 block font-medium">Observaciones</span>
              <span className="text-slate-700 block mt-0.5 italic">
                {equipment.observations || 'Sin observaciones registradas.'}
              </span>
            </div>
          </div>

          {/* Partes del equipo */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2.5 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-indigo-600" />
              Partes y Componentes del Equipo ({equipment.parts.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {equipment.parts.map((part, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 shadow-2xs"
                >
                  {part}
                </span>
              ))}
            </div>
          </div>

          {/* Tareas de mantenimiento a realizar */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2.5 flex items-center gap-1.5">
              <Wrench className="w-4 h-4 text-indigo-600" />
              Actividades / Tareas de Mantenimiento Preventivo ({equipment.maintenanceTasks.length})
            </h4>
            <div className="space-y-2">
              {equipment.maintenanceTasks.map((task, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2.5 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700"
                >
                  <span className="font-bold text-indigo-600 shrink-0">{index + 1}.</span>
                  <span>{task}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={() => onToggleStatus(equipment)}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition-colors ${
              equipment.status === 'activo'
                ? 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
                : 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            {equipment.status === 'activo' ? 'Dar de Baja Lógica' : 'Reactivar Equipo'}
          </button>

          <div className="flex items-center gap-2">
            {onViewOfficialReport && (
              <button
                type="button"
                id="btn-modal-view-official-sheet"
                onClick={() => {
                  onClose();
                  onViewOfficialReport(equipment);
                }}
                className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Abrir Ficha Técnica Oficial (PA-03-F02) en el módulo de reportes"
              >
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                Ficha Oficial (F02)
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(equipment);
              }}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-2xs transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" />
              Editar Equipo
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-slate-600 hover:text-slate-800 hover:bg-slate-200 text-xs font-semibold rounded-lg transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
