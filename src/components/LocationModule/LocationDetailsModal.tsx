import React from 'react';
import { 
  X, 
  MapPin, 
  Building2, 
  Edit3, 
  Server, 
  CheckCircle2, 
  AlertCircle,
  FlaskConical,
  GraduationCap,
  Briefcase,
  Tv,
  Zap,
  HelpCircle,
  Calendar,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { CampusLocation, Equipment, AreaType } from '../../types';

interface LocationDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  location: CampusLocation | null;
  equipments: Equipment[];
  onEdit: (location: CampusLocation) => void;
  onViewEquipment?: (equipment: Equipment) => void;
}

const getAreaTypeIcon = (type: AreaType) => {
  switch (type) {
    case 'datacenter':
      return Server;
    case 'laboratorio':
      return FlaskConical;
    case 'aula':
      return GraduationCap;
    case 'oficina':
      return Briefcase;
    case 'auditorio':
      return Tv;
    case 'infraestructura':
      return Zap;
    default:
      return HelpCircle;
  }
};

const getAreaTypeLabel = (type: AreaType): string => {
  switch (type) {
    case 'datacenter':
      return 'Data Center / Telecomunicaciones';
    case 'laboratorio':
      return 'Laboratorio de Cómputo / TIC';
    case 'aula':
      return 'Aula / Biblioteca';
    case 'oficina':
      return 'Oficina Administrativa';
    case 'auditorio':
      return 'Auditorio / Eventos';
    case 'infraestructura':
      return 'Infraestructura / Energía';
    default:
      return 'Otro Ambiente';
  }
};

export const LocationDetailsModal: React.FC<LocationDetailsModalProps> = ({
  isOpen,
  onClose,
  location,
  equipments,
  onEdit,
  onViewEquipment,
}) => {
  if (!isOpen || !location) return null;

  const IconComponent = getAreaTypeIcon(location.areaType);
  const locationEquipments = equipments.filter((eq) => eq.location.toLowerCase() === location.name.toLowerCase());
  const activeCount = locationEquipments.filter((eq) => eq.status === 'activo').length;
  const bajaCount = locationEquipments.filter((eq) => eq.status === 'baja').length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl">
              <IconComponent className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                  {location.building}
                </span>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                    location.status === 'activa'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-100 text-slate-500 border-slate-300'
                  }`}
                >
                  {location.status === 'activa' ? 'Activa' : 'Inactiva'}
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-800 mt-1">
                {location.name}
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
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Metadata Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Tipo de Ambiente
              </span>
              <span className="text-xs font-bold text-slate-800 mt-1 block">
                {getAreaTypeLabel(location.areaType)}
              </span>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Equipos Críticos Activos
              </span>
              <span className="text-base font-bold text-indigo-700 mt-0.5 block font-mono">
                {activeCount} {activeCount === 1 ? 'equipo' : 'equipos'}
              </span>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Total Registrados
              </span>
              <span className="text-base font-bold text-slate-800 mt-0.5 block font-mono">
                {locationEquipments.length} {bajaCount > 0 && `(${bajaCount} de baja)`}
              </span>
            </div>
          </div>

          {/* Descripción */}
          {location.description && (
            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Descripción y Condiciones de Acceso
              </span>
              <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                {location.description}
              </p>
            </div>
          )}

          {/* Equipos asignados a esta ubicación */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Server className="w-4 h-4 text-indigo-600" />
                Equipos Críticos en esta Ubicación ({locationEquipments.length})
              </h4>
            </div>

            {locationEquipments.length > 0 ? (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                      <th className="py-2.5 px-3">Código</th>
                      <th className="py-2.5 px-3">Nombre / Marca</th>
                      <th className="py-2.5 px-3">Frecuencia</th>
                      <th className="py-2.5 px-3 text-center">Estado</th>
                      {onViewEquipment && <th className="py-2.5 px-3 text-right">Ver</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {locationEquipments.map((eq) => (
                      <tr key={eq.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                          <span className="px-2 py-0.5 bg-slate-100 border border-slate-300 rounded text-xs">
                            {eq.code}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-800">{eq.name}</div>
                          <div className="text-[10px] text-slate-400">
                            {eq.brand} {eq.model && `• ${eq.model}`} {eq.serial && `• S/N: ${eq.serial}`}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 capitalize text-slate-600">
                          {eq.frequency}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              eq.status === 'activo'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-400 border-slate-200'
                            }`}
                          >
                            {eq.status === 'activo' ? 'Activo' : 'Baja'}
                          </span>
                        </td>
                        {onViewEquipment && (
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onViewEquipment(eq);
                              }}
                              className="p-1 text-slate-400 hover:text-indigo-600 transition-colors rounded"
                              title="Ver ficha del equipo"
                            >
                              <ArrowUpRight className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl text-slate-400">
                <Server className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-semibold text-slate-600">
                  No hay equipos registrados actualmente en esta ubicación
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Al registrar o editar un equipo crítico, puede seleccionar "{location.name}" como su ubicación.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-mono">
            ID: {location.id}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(location);
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Editar Ubicación
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
