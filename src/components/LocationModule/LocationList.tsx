import React, { useState, useMemo } from 'react';
import { 
  MapPin, 
  Plus, 
  Search, 
  Filter, 
  Building2, 
  Server, 
  FlaskConical, 
  GraduationCap, 
  Briefcase, 
  Tv, 
  Zap, 
  HelpCircle, 
  Edit3, 
  Trash2, 
  Eye, 
  CheckCircle2, 
  AlertCircle,
  Layers,
  ArrowUpDown,
  Upload,
  FileSpreadsheet
} from 'lucide-react';
import { CampusLocation, Equipment, AreaType } from '../../types';
import { LocationFormModal } from './LocationFormModal';
import { LocationDetailsModal } from './LocationDetailsModal';
import { LocationDeleteModal } from './LocationDeleteModal';
import { ExcelImportLocationModal } from './ExcelImportLocationModal';
import { BuildingManagerModal } from './BuildingManagerModal';
import { ExportService } from '../../services/exportService';

interface LocationListProps {
  locations: CampusLocation[];
  equipments: Equipment[];
  buildings: string[];
  onSaveLocation: (location: CampusLocation, oldName?: string) => void;
  onDeleteLocation: (locationId: string, reassignToLocationName?: string) => void;
  onViewEquipment?: (equipment: Equipment) => void;
  onImportLocations?: (importedLocations: CampusLocation[]) => void;
  onAddBuilding: (name: string) => { success: boolean; message: string };
  onRenameBuilding: (oldName: string, newName: string) => { success: boolean; message: string; affectedLocationsCount: number };
  onDeleteBuilding: (name: string, reassignTo?: string) => { success: boolean; message: string; affectedLocationsCount: number };
  onResetBuildings?: () => void;
}

const getAreaTypeInfo = (type: AreaType) => {
  switch (type) {
    case 'datacenter':
      return { label: 'Data Center', icon: Server, badgeColor: 'bg-purple-50 text-purple-700 border-purple-200' };
    case 'laboratorio':
      return { label: 'Laboratorio Cómputo', icon: FlaskConical, badgeColor: 'bg-blue-50 text-blue-700 border-blue-200' };
    case 'aula':
      return { label: 'Aula / Biblioteca', icon: GraduationCap, badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'oficina':
      return { label: 'Oficina TI / Admin', icon: Briefcase, badgeColor: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'auditorio':
      return { label: 'Auditorio / Eventos', icon: Tv, badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    case 'infraestructura':
      return { label: 'Infraestructura', icon: Zap, badgeColor: 'bg-rose-50 text-rose-700 border-rose-200' };
    default:
      return { label: 'Otro Ambiente', icon: HelpCircle, badgeColor: 'bg-slate-50 text-slate-700 border-slate-200' };
  }
};

export const LocationList: React.FC<LocationListProps> = ({
  locations,
  equipments,
  buildings,
  onSaveLocation,
  onDeleteLocation,
  onViewEquipment,
  onImportLocations,
  onAddBuilding,
  onRenameBuilding,
  onDeleteBuilding,
  onResetBuildings,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBuilding, setSelectedBuilding] = useState('todos');
  const [selectedAreaType, setSelectedAreaType] = useState('todos');
  const [selectedStatus, setSelectedStatus] = useState('todos');

  // Modales
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isBuildingManagerOpen, setIsBuildingManagerOpen] = useState(false);
  const [locationToEdit, setLocationToEdit] = useState<CampusLocation | null>(null);
  const [locationToView, setLocationToView] = useState<CampusLocation | null>(null);
  const [locationToDelete, setLocationToDelete] = useState<CampusLocation | null>(null);

  // Lista de edificios consolidada (catálogo institucional + cualquier edificio en ubicaciones existentes)
  const allBuildings = useMemo(() => {
    const set = new Set<string>(buildings);
    locations.forEach((loc) => {
      if (loc.building && loc.building.trim()) set.add(loc.building.trim());
    });
    return Array.from(set).sort();
  }, [buildings, locations]);

  // Mapa de conteo de equipos por ubicación
  const equipmentCountMap = useMemo(() => {
    const map = new Map<string, { total: number; active: number }>();
    equipments.forEach((eq) => {
      const key = eq.location.toLowerCase().trim();
      const current = map.get(key) || { total: 0, active: 0 };
      current.total++;
      if (eq.status === 'activo') current.active++;
      map.set(key, current);
    });
    return map;
  }, [equipments]);

  // Filtrado de ubicaciones
  const filteredLocations = useMemo(() => {
    return locations.filter((loc) => {
      // Filtro por edificio
      if (selectedBuilding !== 'todos' && loc.building !== selectedBuilding) {
        return false;
      }
      // Filtro por tipo de área
      if (selectedAreaType !== 'todos' && loc.areaType !== selectedAreaType) {
        return false;
      }
      // Filtro por estado
      if (selectedStatus !== 'todos' && loc.status !== selectedStatus) {
        return false;
      }
      // Búsqueda por texto
      if (searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        const matches =
          loc.name.toLowerCase().includes(term) ||
          loc.building.toLowerCase().includes(term) ||
          (loc.description && loc.description.toLowerCase().includes(term)) ||
          loc.areaType.toLowerCase().includes(term);
        if (!matches) return false;
      }
      return true;
    });
  }, [locations, selectedBuilding, selectedAreaType, selectedStatus, searchTerm]);

  // Métricas
  const stats = useMemo(() => {
    const total = locations.length;
    const activas = locations.filter((l) => l.status === 'activa').length;
    let locationsWithEquipments = 0;
    let totalLinkedEquipments = 0;

    locations.forEach((loc) => {
      const counts = equipmentCountMap.get(loc.name.toLowerCase().trim());
      if (counts && counts.total > 0) {
        locationsWithEquipments++;
        totalLinkedEquipments += counts.total;
      }
    });

    return { total, activas, locationsWithEquipments, totalLinkedEquipments };
  }, [locations, equipmentCountMap]);

  return (
    <div className="space-y-6">
      {/* Header del Módulo de Ubicaciones */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
              Infraestructura Física
            </span>
            <span className="text-xs text-slate-400">• Colegio Bilingüe FCBV</span>
          </div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2.5 mt-1">
            <MapPin className="w-6 h-6 text-indigo-600" />
            Gestión de Ubicaciones del Campus
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Catálogo de edificios, salas de cómputo, data centers y dependencias donde se encuentran instalados los equipos críticos
          </p>
        </div>

        {/* Acciones de Ubicaciones */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            id="btn-manage-buildings"
            onClick={() => setIsBuildingManagerOpen(true)}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 text-xs font-semibold rounded-lg shadow-2xs hover:shadow-xs transition-all flex items-center gap-1.5"
            title="Gestionar, editar nombres o agregar nuevos edificios y bloques del campus"
          >
            <Building2 className="w-4 h-4 text-indigo-600" />
            Editar Edificios ({allBuildings.length})
          </button>

          <button
            type="button"
            id="btn-import-locations-excel"
            onClick={() => setIsImportOpen(true)}
            className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-1.5"
            title="Importar ubicaciones masivamente desde un archivo Excel (.xlsx)"
          >
            <Upload className="w-4 h-4" />
            Importar Excel
          </button>

          <button
            type="button"
            id="btn-export-locations-excel"
            onClick={() => ExportService.exportLocationsToExcel(locations, equipments)}
            disabled={locations.length === 0}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold rounded-lg shadow-2xs hover:shadow-xs transition-all flex items-center gap-1.5"
            title="Exportar catálogo actual de ubicaciones a archivo Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Exportar Excel
          </button>

          <button
            type="button"
            id="btn-add-location"
            onClick={() => {
              setLocationToEdit(null);
              setIsFormOpen(true);
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Nueva Ubicación
          </button>
        </div>
      </div>

      {/* Tarjetas de Métricas KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Ubicaciones</span>
          <span className="text-2xl font-bold text-slate-800 mt-1 block font-mono">{stats.total}</span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">{allBuildings.length} bloques / edificios</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-700 uppercase tracking-wider">Activas</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <span className="text-2xl font-bold text-emerald-700 mt-1 block font-mono">{stats.activas}</span>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Habilitadas para asignación</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-indigo-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-indigo-700 uppercase tracking-wider">Con Equipos</span>
            <Server className="w-4 h-4 text-indigo-600" />
          </div>
          <span className="text-2xl font-bold text-indigo-700 mt-1 block font-mono">
            {stats.locationsWithEquipments}
          </span>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Albergan activos críticos</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Equipos Ubicados</span>
          <span className="text-2xl font-bold text-slate-800 mt-1 block font-mono">
            {stats.totalLinkedEquipments}
          </span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Total en inventario FCBV</span>
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
              placeholder="Buscar por nombre de ubicación, edificio, descripción..."
              className="w-full pl-10 pr-4 py-2 text-xs rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Filtro por Edificio */}
          <div className="w-full md:w-56">
            <select
              value={selectedBuilding}
              onChange={(e) => setSelectedBuilding(e.target.value)}
              className="w-full py-2 px-3 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="todos">Todos los edificios ({allBuildings.length})</option>
              {allBuildings.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Tipo de Área */}
          <div className="w-full md:w-48">
            <select
              value={selectedAreaType}
              onChange={(e) => setSelectedAreaType(e.target.value)}
              className="w-full py-2 px-3 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="todos">Todos los tipos de área</option>
              <option value="datacenter">Data Center</option>
              <option value="laboratorio">Laboratorio Cómputo</option>
              <option value="aula">Aula / Biblioteca</option>
              <option value="oficina">Oficina TI</option>
              <option value="auditorio">Auditorio</option>
              <option value="infraestructura">Infraestructura</option>
              <option value="otro">Otro Ambiente</option>
            </select>
          </div>

          {/* Filtro por Estado */}
          <div className="w-full md:w-40">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full py-2 px-3 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="todos">Todos los estados</option>
              <option value="activa">Solo Activas</option>
              <option value="inactiva">Solo Inactivas</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabla de Ubicaciones */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Ubicación / Espacio</th>
                <th className="py-3 px-4">Edificio / Bloque</th>
                <th className="py-3 px-3">Tipo de Ambiente</th>
                <th className="py-3 px-3 text-center">Equipos Asignados</th>
                <th className="py-3 px-3 text-center">Estado</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredLocations.length > 0 ? (
                filteredLocations.map((loc) => {
                  const areaInfo = getAreaTypeInfo(loc.areaType);
                  const AreaIcon = areaInfo.icon;
                  const counts = equipmentCountMap.get(loc.name.toLowerCase().trim()) || { total: 0, active: 0 };

                  return (
                    <tr key={loc.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Nombre y descripción */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-start gap-2.5">
                          <div className="p-1.5 bg-slate-100 text-slate-600 rounded-md mt-0.5 shrink-0">
                            <MapPin className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={() => setLocationToView(loc)}
                              className="font-bold text-slate-800 hover:text-indigo-600 text-left transition-colors"
                            >
                              {loc.name}
                            </button>
                            {loc.description && (
                              <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1 max-w-md">
                                {loc.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Edificio / Bloque */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 text-xs">
                          {loc.building}
                        </span>
                      </td>

                      {/* Tipo de Ambiente */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border ${areaInfo.badgeColor}`}>
                          <AreaIcon className="w-3.5 h-3.5" />
                          {areaInfo.label}
                        </span>
                      </td>

                      {/* Equipos Asignados */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        {counts.total > 0 ? (
                          <button
                            type="button"
                            onClick={() => setLocationToView(loc)}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors"
                            title="Ver equipos asignados a esta ubicación"
                          >
                            <Server className="w-3 h-3 text-indigo-500" />
                            {counts.total} {counts.total === 1 ? 'equipo' : 'equipos'}
                          </button>
                        ) : (
                          <span className="text-slate-300 text-xs font-mono">0 equipos</span>
                        )}
                      </td>

                      {/* Estado */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                            loc.status === 'activa'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border-slate-300'
                          }`}
                        >
                          {loc.status === 'activa' && <CheckCircle2 className="w-3 h-3" />}
                          {loc.status === 'activa' ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>

                      {/* Acciones */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setLocationToView(loc)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Ver detalle y equipos asociados"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setLocationToEdit(loc);
                              setIsFormOpen(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Editar ubicación"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setLocationToDelete(loc)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Eliminar ubicación"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-slate-400">
                    <MapPin className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                    <p className="text-base font-semibold text-slate-700">
                      {locations.length === 0
                        ? 'No hay ubicaciones registradas en el campus'
                        : 'No se encontraron ubicaciones que coincidan con los filtros'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto">
                      {locations.length === 0
                        ? 'El catálogo de espacios físicos está vacío. Registre los edificios, salas de informática o laboratorios de la institución.'
                        : 'Intente limpiar los filtros de búsqueda, bloque o tipo de área.'}
                    </p>
                    {locations.length === 0 && (
                      <div className="flex items-center justify-center gap-3 mt-4">
                        <button
                          type="button"
                          onClick={() => {
                            setLocationToEdit(null);
                            setIsFormOpen(true);
                          }}
                          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
                        >
                          <Plus className="w-4 h-4" />
                          Registrar Primera Ubicación
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsImportOpen(true)}
                          className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
                        >
                          <Upload className="w-4 h-4" />
                          Importar desde Excel
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Formulario (Crear / Editar) */}
      {isFormOpen && (
        <LocationFormModal
          isOpen={isFormOpen}
          onClose={() => {
            setIsFormOpen(false);
            setLocationToEdit(null);
          }}
          onSave={onSaveLocation}
          initialLocation={locationToEdit}
          existingLocations={locations}
          buildings={allBuildings}
          onOpenBuildingManager={() => setIsBuildingManagerOpen(true)}
          onAddBuilding={onAddBuilding}
        />
      )}

      {/* Modal de Gestión de Edificios / Bloques */}
      {isBuildingManagerOpen && (
        <BuildingManagerModal
          isOpen={isBuildingManagerOpen}
          onClose={() => setIsBuildingManagerOpen(false)}
          buildings={allBuildings}
          locations={locations}
          onAddBuilding={onAddBuilding}
          onRenameBuilding={onRenameBuilding}
          onDeleteBuilding={onDeleteBuilding}
          onResetBuildings={onResetBuildings}
        />
      )}

      {/* Modal Detalle de Ubicación */}
      {locationToView && (
        <LocationDetailsModal
          isOpen={Boolean(locationToView)}
          onClose={() => setLocationToView(null)}
          location={locationToView}
          equipments={equipments}
          onEdit={(loc) => {
            setLocationToView(null);
            setLocationToEdit(loc);
            setIsFormOpen(true);
          }}
          onViewEquipment={onViewEquipment}
        />
      )}

      {/* Modal Confirmar Eliminación */}
      {locationToDelete && (
        <LocationDeleteModal
          isOpen={Boolean(locationToDelete)}
          onClose={() => setLocationToDelete(null)}
          location={locationToDelete}
          allLocations={locations}
          equipments={equipments}
          onConfirmDelete={onDeleteLocation}
        />
      )}

      {/* Modal de Importación desde Excel */}
      {isImportOpen && (
        <ExcelImportLocationModal
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          existingLocations={locations}
          onImportSuccess={(newLocs) => {
            if (onImportLocations) {
              onImportLocations(newLocs);
            }
          }}
        />
      )}
    </div>
  );
};
