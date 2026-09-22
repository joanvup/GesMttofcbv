import React, { useState, useEffect } from 'react';
import { 
  X, 
  MapPin, 
  Building2, 
  Layers, 
  FileText, 
  Check, 
  AlertCircle,
  Server,
  FlaskConical,
  GraduationCap,
  Briefcase,
  Tv,
  Zap,
  HelpCircle,
  Plus,
  Settings2
} from 'lucide-react';
import { CampusLocation, AreaType } from '../../types';

interface LocationFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (location: CampusLocation, oldName?: string) => void;
  initialLocation?: CampusLocation | null;
  existingLocations: CampusLocation[];
  buildings: string[];
  onOpenBuildingManager?: () => void;
  onAddBuilding?: (name: string) => { success: boolean; message: string };
}

const AREA_TYPE_OPTIONS: Array<{
  value: AreaType;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: 'datacenter', label: 'Data Center / Telecomunicaciones', desc: 'Racks, servidores, switches core y respaldo', icon: Server },
  { value: 'laboratorio', label: 'Laboratorio de Cómputo / TIC', desc: 'Salas de cómputo, robótica e informática', icon: FlaskConical },
  { value: 'aula', label: 'Aula / Biblioteca / Sala de Estudio', desc: 'Salas académicas y consulta estudiantil', icon: GraduationCap },
  { value: 'oficina', label: 'Oficina Administrativa / Sistemas', desc: 'Mesa de ayuda TI y puestos de gestión', icon: Briefcase },
  { value: 'auditorio', label: 'Auditorio / Sala Múltiple', desc: 'Proyección multimedia y conferencias', icon: Tv },
  { value: 'infraestructura', label: 'Infraestructura / Energía / Aire', desc: 'Subestación, UPS, climatización y racks de paso', icon: Zap },
  { value: 'otro', label: 'Otro Ambiente / Depósito', desc: 'Almacén general y espacios auxiliares', icon: HelpCircle },
];

export const LocationFormModal: React.FC<LocationFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialLocation,
  existingLocations,
  buildings,
  onOpenBuildingManager,
  onAddBuilding,
}) => {
  const [name, setName] = useState('');
  const [building, setBuilding] = useState(buildings[0] || 'Edificio Administrativo');
  const [isAddingNewBuilding, setIsAddingNewBuilding] = useState(false);
  const [inlineNewBuilding, setInlineNewBuilding] = useState('');
  const [areaType, setAreaType] = useState<AreaType>('laboratorio');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'activa' | 'inactiva'>('activa');
  const [errorMsg, setErrorMsg] = useState('');
  const [buildingMsg, setBuildingMsg] = useState('');

  // Asegurar que si initialLocation tiene un edificio no presente en la lista, esté disponible
  const allAvailableBuildings = React.useMemo(() => {
    const list = [...buildings];
    if (initialLocation && initialLocation.building && !list.includes(initialLocation.building)) {
      list.push(initialLocation.building);
    }
    return list;
  }, [buildings, initialLocation]);

  useEffect(() => {
    if (initialLocation) {
      setName(initialLocation.name);
      setBuilding(initialLocation.building);
      setAreaType(initialLocation.areaType);
      setDescription(initialLocation.description || '');
      setStatus(initialLocation.status);
    } else {
      setName('');
      setBuilding(allAvailableBuildings[0] || 'Edificio Administrativo');
      setAreaType('laboratorio');
      setDescription('');
      setStatus('activa');
    }
    setIsAddingNewBuilding(false);
    setInlineNewBuilding('');
    setErrorMsg('');
    setBuildingMsg('');
  }, [initialLocation, isOpen, allAvailableBuildings]);

  if (!isOpen) return null;

  const handleCreateInlineBuilding = () => {
    const trimmed = inlineNewBuilding.trim();
    if (!trimmed) {
      setBuildingMsg('Escriba el nombre del nuevo edificio.');
      return;
    }

    if (onAddBuilding) {
      const res = onAddBuilding(trimmed);
      if (!res.success) {
        setBuildingMsg(res.message);
        return;
      }
    }

    setBuilding(trimmed);
    setInlineNewBuilding('');
    setIsAddingNewBuilding(false);
    setBuildingMsg(`Edificio "${trimmed}" seleccionado.`);
    setTimeout(() => setBuildingMsg(''), 2500);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMsg('El nombre de la ubicación es obligatorio.');
      return;
    }

    const finalBuilding = building.trim();
    if (!finalBuilding) {
      setErrorMsg('Debe seleccionar o especificar el edificio o bloque.');
      return;
    }

    // Validar nombre duplicado (excluyendo la misma ubicación si se está editando)
    const isDuplicate = existingLocations.some(
      (loc) => loc.name.toLowerCase() === trimmedName.toLowerCase() && loc.id !== initialLocation?.id
    );

    if (isDuplicate) {
      setErrorMsg(`Ya existe una ubicación registrada con el nombre "${trimmedName}".`);
      return;
    }

    const now = new Date().toISOString();
    const locationData: CampusLocation = {
      id: initialLocation ? initialLocation.id : `loc_${Date.now()}`,
      name: trimmedName,
      building: finalBuilding,
      areaType,
      description: description.trim(),
      status,
      createdAt: initialLocation ? initialLocation.createdAt : now,
      updatedAt: now,
    };

    onSave(locationData, initialLocation ? initialLocation.name : undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                {initialLocation ? 'Editar Ubicación del Campus' : 'Registrar Nueva Ubicación'}
              </h3>
              <p className="text-xs text-slate-500">
                {initialLocation
                  ? 'Modifique los datos del espacio y mantenga actualizados los equipos asociados.'
                  : 'Defina un nuevo espacio físico o técnico para alojar equipos críticos.'}
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

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Nombre de la Ubicación */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Nombre de la Ubicación / Espacio *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Sala de Cómputo Bachillerato 3, Data Center Secundario..."
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              required
            />
            {initialLocation && initialLocation.name !== name && name.trim() && (
              <p className="text-[11px] text-amber-700 bg-amber-50 p-1.5 rounded border border-amber-200 mt-1">
                ℹ️ Al cambiar el nombre de esta ubicación, todos los equipos asignados a "{initialLocation.name}" se actualizarán automáticamente a "{name}".
              </p>
            )}
          </div>

          {/* Edificio / Bloque (Editable) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Edificio / Bloque Institucional *
              </label>
              {onOpenBuildingManager && (
                <button
                  type="button"
                  onClick={onOpenBuildingManager}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 hover:underline"
                  title="Abrir ventana para editar, renombrar o agregar edificios institucionales"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  Editar lista de edificios
                </button>
              )}
            </div>

            {buildingMsg && (
              <p className="text-[11px] text-emerald-700 bg-emerald-50 p-1.5 rounded border border-emerald-200 mb-2">
                {buildingMsg}
              </p>
            )}

            {/* Opciones de Edificios */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-2">
              {allAvailableBuildings.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => {
                    setBuilding(b);
                    setIsAddingNewBuilding(false);
                  }}
                  className={`px-2.5 py-1.5 text-xs rounded-lg border text-left transition-colors font-medium truncate flex items-center justify-between ${
                    building === b && !isAddingNewBuilding
                      ? 'bg-indigo-50 border-indigo-400 text-indigo-700 font-semibold shadow-2xs'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                  title={b}
                >
                  <span className="truncate">{b}</span>
                  {building === b && !isAddingNewBuilding && (
                    <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0 ml-1" />
                  )}
                </button>
              ))}

              {/* Botón para añadir nuevo edificio directamente */}
              <button
                type="button"
                onClick={() => setIsAddingNewBuilding(!isAddingNewBuilding)}
                className={`px-2.5 py-1.5 text-xs rounded-lg border border-dashed text-left transition-colors font-semibold flex items-center gap-1.5 ${
                  isAddingNewBuilding
                    ? 'bg-indigo-100 border-indigo-400 text-indigo-800'
                    : 'bg-white border-indigo-300 text-indigo-700 hover:bg-indigo-50/60'
                }`}
              >
                <Plus className="w-3.5 h-3.5 text-indigo-600" />
                <span>+ Nuevo Edificio</span>
              </button>
            </div>

            {/* Formulario Inline para agregar un nuevo edificio */}
            {isAddingNewBuilding && (
              <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-lg space-y-2 mt-2">
                <label className="block text-[11px] font-semibold text-indigo-900">
                  Nombre del nuevo Edificio o Bloque:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inlineNewBuilding}
                    onChange={(e) => setInlineNewBuilding(e.target.value)}
                    placeholder="Ej: Bloque Secundaria, Pabellón de Artes..."
                    className="flex-1 px-3 py-1.5 text-xs bg-white rounded-lg border border-indigo-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCreateInlineBuilding();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleCreateInlineBuilding}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 shadow-2xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Guardar y Usar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingNewBuilding(false);
                      setInlineNewBuilding('');
                    }}
                    className="px-2 py-1.5 text-slate-500 hover:text-slate-700 text-xs rounded-lg hover:bg-indigo-100 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Tipo de Ambiente / Área */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Tipo de Ambiente / Categoría de Uso *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1">
              {AREA_TYPE_OPTIONS.map((opt) => {
                const IconComponent = opt.icon;
                const isSelected = areaType === opt.value;
                return (
                  <label
                    key={opt.value}
                    onClick={() => setAreaType(opt.value)}
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-400 text-indigo-900 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`p-1.5 rounded-md mt-0.5 shrink-0 ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold block">{opt.label}</span>
                      <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">{opt.desc}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Estado de la Ubicación */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Estado Operativo
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                <input
                  type="radio"
                  name="location_status"
                  value="activa"
                  checked={status === 'activa'}
                  onChange={() => setStatus('activa')}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Activa (disponible para asignación)
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                <input
                  type="radio"
                  name="location_status"
                  value="inactiva"
                  checked={status === 'inactiva'}
                  onChange={() => setStatus('inactiva')}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span className="inline-flex items-center gap-1 text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  Inactiva (en remodelación o fuera de uso)
                </span>
              </label>
            </div>
          </div>

          {/* Descripción y Notas de Acceso */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Descripción y Condiciones de Acceso
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Acceso con llave custodiada en coordinación de sistemas. Cuenta con aire acondicionado independiente y tomacorrientes regulados..."
              className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            {initialLocation ? 'Guardar Cambios' : 'Registrar Ubicación'}
          </button>
        </div>
      </div>
    </div>
  );
};
