import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  FileSpreadsheet, 
  Download, 
  Edit3, 
  Eye, 
  Archive, 
  RefreshCw, 
  Layers, 
  Wrench, 
  MapPin, 
  CheckCircle,
  AlertTriangle,
  Server,
  Upload,
  CalendarClock,
  SlidersHorizontal,
  CheckSquare,
  Square,
  X,
  ScanLine
} from 'lucide-react';
import { Equipment, EquipmentStatus, EquipmentFrequency, CampusLocation } from '../../types';
import { ExportService } from '../../services/exportService';

interface EquipmentListProps {
  equipments: Equipment[];
  allLocations?: CampusLocation[];
  onAddEquipment: () => void;
  onEditEquipment: (equipment: Equipment) => void;
  onViewEquipment: (equipment: Equipment) => void;
  onToggleStatus: (equipment: Equipment) => void;
  onOpenImportModal: () => void;
  onNavigateToLocations?: () => void;
  onBulkSchedule?: (equipmentIds: string[]) => void;
  onBulkChangeFrequency?: (equipmentIds: string[], frequency: EquipmentFrequency) => void;
  onOpenScanner?: () => void;
}

export const EquipmentList: React.FC<EquipmentListProps> = ({
  equipments,
  allLocations = [],
  onAddEquipment,
  onEditEquipment,
  onViewEquipment,
  onToggleStatus,
  onOpenImportModal,
  onNavigateToLocations,
  onBulkSchedule,
  onBulkChangeFrequency,
  onOpenScanner,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('todas');
  const [selectedStatus, setSelectedStatus] = useState<'todos' | EquipmentStatus>('todos');
  const [selectedFrequency, setSelectedFrequency] = useState<'todas' | EquipmentFrequency>('todas');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Obtener ubicaciones únicas combinando las existentes en equipos y las del catálogo
  const locations = useMemo(() => {
    const locSet = new Set<string>();
    equipments.forEach((eq) => {
      if (eq.location) locSet.add(eq.location);
    });
    allLocations.forEach((l) => {
      if (l.name) locSet.add(l.name);
    });
    return Array.from(locSet).sort();
  }, [equipments, allLocations]);

  // Filtrado
  const filteredEquipments = useMemo(() => {
    return equipments.filter((eq) => {
      // Búsqueda por texto (código, nombre, marca, modelo, serial)
      if (searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        const matches =
          eq.code.toLowerCase().includes(term) ||
          eq.name.toLowerCase().includes(term) ||
          eq.location.toLowerCase().includes(term) ||
          eq.brand.toLowerCase().includes(term) ||
          eq.model.toLowerCase().includes(term) ||
          eq.serial.toLowerCase().includes(term);
        if (!matches) return false;
      }

      // Filtro por ubicación
      if (selectedLocation !== 'todas' && eq.location !== selectedLocation) {
        return false;
      }

      // Filtro por estado
      if (selectedStatus !== 'todos' && eq.status !== selectedStatus) {
        return false;
      }

      // Filtro por frecuencia
      if (selectedFrequency !== 'todas' && eq.frequency !== selectedFrequency) {
        return false;
      }

      return true;
    });
  }, [equipments, searchTerm, selectedLocation, selectedStatus, selectedFrequency]);

  // Contadores
  const totalActivos = equipments.filter((e) => e.status === 'activo').length;
  const totalBaja = equipments.filter((e) => e.status === 'baja').length;

  // Selección masiva
  const isAllFilteredSelected = useMemo(() => {
    return (
      filteredEquipments.length > 0 &&
      filteredEquipments.every((e) => selectedIds.has(e.id))
    );
  }, [filteredEquipments, selectedIds]);

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredEquipments.forEach((e) => next.delete(e.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredEquipments.forEach((e) => next.add(e.id));
        return next;
      });
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Barra superior de acciones y métricas rápidas */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2.5">
            <Server className="w-6 h-6 text-indigo-600" />
            Registro de Equipos Críticos
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Inventario técnico, partes componentes y matriz de tareas de mantenimiento del Colegio FCBV
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {onBulkSchedule && (
            <button
              type="button"
              id="btn-equipment-bulk-schedule"
              onClick={() => {
                const ids =
                  selectedIds.size > 0
                    ? Array.from(selectedIds)
                    : filteredEquipments.filter((e) => e.status === 'activo').map((e) => e.id);
                onBulkSchedule(ids);
              }}
              className="px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg flex items-center gap-1.5 transition-all shadow-xs"
              title="Programar mantenimientos masivamente en el Plan Anual"
            >
              <CalendarClock className="w-4 h-4" />
              <span>Programación Masiva</span>
              {selectedIds.size > 0 && (
                <span className="px-1.5 py-0.2 text-[10px] font-bold bg-white text-indigo-700 rounded-full">
                  {selectedIds.size}
                </span>
              )}
            </button>
          )}
          {onNavigateToLocations && (
            <button
              type="button"
              onClick={onNavigateToLocations}
              className="px-3.5 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg flex items-center gap-1.5 transition-colors"
              title="Ir al módulo de Ubicaciones del Campus"
            >
              <MapPin className="w-4 h-4 text-indigo-600" />
              <span>Ver Ubicaciones</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => ExportService.downloadEquipmentExcelTemplate()}
            title="Descargar plantilla de Excel para importación"
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-4 h-4 text-slate-500" />
            Plantilla Excel
          </button>
          <button
            type="button"
            onClick={onOpenImportModal}
            className="px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Importar Excel (.xlsx)
          </button>
          {onOpenScanner && (
            <button
              type="button"
              id="btn-equipment-scan"
              onClick={onOpenScanner}
              className="px-3.5 py-2 text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-lg shadow-xs hover:shadow transition-all flex items-center gap-1.5"
              title="Escanear Código QR, Barras, Serial o Foto de Etiqueta con OCR"
            >
              <ScanLine className="w-4 h-4" />
              <span>Escanear QR / OCR Etiquetas</span>
            </button>
          )}
          <button
            type="button"
            onClick={onAddEquipment}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs hover:shadow transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Nuevo Equipo Crítico
          </button>
        </div>
      </div>

      {/* Tarjetas de estado rápido */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">Total Equipos</span>
          <span className="text-2xl font-bold text-slate-800 mt-1 block">{equipments.length}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-2xs">
          <span className="text-xs font-medium text-emerald-700 uppercase tracking-wider block">Activos en Plan</span>
          <span className="text-2xl font-bold text-emerald-700 mt-1 block">{totalActivos}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">Dados de Baja</span>
          <span className="text-2xl font-bold text-slate-600 mt-1 block">{totalBaja}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-indigo-200 shadow-2xs">
          <span className="text-xs font-medium text-indigo-700 uppercase tracking-wider block">Ubicaciones</span>
          <span className="text-2xl font-bold text-indigo-700 mt-1 block">{locations.length}</span>
        </div>
      </div>

      {/* Controles de Filtros y Búsqueda */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Búsqueda por texto libre */}
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por código (ej: AP-01), nombre, marca, serial o ubicación..."
              className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400"
            />
          </div>

          {/* Filtro por Ubicación */}
          <div className="w-full md:w-56">
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full py-2 px-3 text-sm rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="todas">Todas las ubicaciones ({locations.length})</option>
              {locations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Estado */}
          <div className="w-full md:w-44">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              className="w-full py-2 px-3 text-sm rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="todos">Todos los estados</option>
              <option value="activo">Solo Activos</option>
              <option value="baja">Dados de Baja</option>
            </select>
          </div>

          {/* Filtro por Frecuencia */}
          <div className="w-full md:w-44">
            <select
              value={selectedFrequency}
              onChange={(e) => setSelectedFrequency(e.target.value as any)}
              className="w-full py-2 px-3 text-sm rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="todas">Todas las frecuencias</option>
              <option value="mensual">Mensual</option>
              <option value="trimestral">Trimestral</option>
              <option value="semestral">Semestral</option>
              <option value="anual">Anual</option>
              <option value="personalizada">Personalizada</option>
            </select>
          </div>
        </div>

        {/* Resumen de resultados y reset de filtros */}
        {(searchTerm || selectedLocation !== 'todas' || selectedStatus !== 'todos' || selectedFrequency !== 'todas') && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
            <span>
              Mostrando <strong>{filteredEquipments.length}</strong> de {equipments.length} equipos
            </span>
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSelectedLocation('todas');
                setSelectedStatus('todos');
                setSelectedFrequency('todas');
              }}
              className="text-indigo-600 hover:underline font-medium"
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {/* BARRA FLOTANTE DE SELECCIÓN MASIVA */}
      {selectedIds.size > 0 && (
        <div className="p-3.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-xl shadow-lg border border-indigo-700/50 flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold">
              {selectedIds.size}
            </span>
            <div>
              <span className="text-xs font-bold text-white block">
                {selectedIds.size} {selectedIds.size === 1 ? 'equipo seleccionado' : 'equipos seleccionados'}
              </span>
              <span className="text-[11px] text-slate-300">
                Acciones masivas disponibles para este lote
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onBulkSchedule && (
              <button
                type="button"
                id="btn-bulk-schedule-selection"
                onClick={() => onBulkSchedule(Array.from(selectedIds))}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                <CalendarClock className="w-4 h-4" />
                <span>Programar Mantenimientos (Año)</span>
              </button>
            )}

            {onBulkChangeFrequency && (
              <div className="flex items-center gap-1 bg-slate-800/90 px-2 py-1 rounded-lg border border-slate-700">
                <span className="text-[10px] uppercase font-semibold text-slate-400 mr-1">Frecuencia:</span>
                {(['mensual', 'trimestral', 'semestral', 'anual'] as EquipmentFrequency[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => onBulkChangeFrequency(Array.from(selectedIds), f)}
                    className="px-2 py-0.5 text-[10px] font-semibold bg-slate-700 hover:bg-indigo-600 text-slate-200 hover:text-white rounded transition-colors capitalize"
                    title={`Cambiar a ${f} para los equipos seleccionados`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors ml-1"
              title="Deseleccionar todos"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Tabla de Equipos Críticos */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllFilteredSelected}
                    onChange={handleToggleSelectAll}
                    title={isAllFilteredSelected ? 'Deseleccionar visibles' : 'Seleccionar visibles'}
                    className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 cursor-pointer focus:ring-0"
                  />
                </th>
                <th className="py-3 px-4">Código</th>
                <th className="py-3 px-4">Equipo / Descripción</th>
                <th className="py-3 px-4">Ubicación</th>
                <th className="py-3 px-4">Marca / Modelo</th>
                <th className="py-3 px-4">Frecuencia</th>
                <th className="py-3 px-4 text-center">Partes & Tareas</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredEquipments.length > 0 ? (
                filteredEquipments.map((eq) => {
                  const isActivo = eq.status === 'activo';
                  const isSelected = selectedIds.has(eq.id);

                  return (
                    <tr
                      key={eq.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? 'bg-indigo-50/70' : !isActivo ? 'bg-slate-50/50 opacity-75' : ''
                      }`}
                    >
                      <td className="py-3.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectOne(eq.id)}
                          className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 cursor-pointer focus:ring-0"
                        />
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800 whitespace-nowrap">
                        <span className="px-2 py-1 bg-slate-100 border border-slate-300 rounded text-xs">
                          {eq.code}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{eq.name}</div>
                        {eq.serial && (
                          <div className="text-[11px] text-slate-400 font-mono">S/N: {eq.serial}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span className="truncate max-w-[180px]">{eq.location}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                        <span>{eq.brand || '-'}</span>
                        {eq.model && <span className="text-slate-400 ml-1">({eq.model})</span>}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200 capitalize">
                          {eq.frequency}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-2 text-slate-500">
                          <span title={`${eq.parts.length} partes registradas`} className="flex items-center gap-0.5">
                            <Layers className="w-3.5 h-3.5 text-slate-400" />
                            {eq.parts.length}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span title={`${eq.maintenanceTasks.length} tareas de mantenimiento`} className="flex items-center gap-0.5">
                            <Wrench className="w-3.5 h-3.5 text-indigo-500" />
                            {eq.maintenanceTasks.length}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                            isActivo
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}
                        >
                          {isActivo ? 'Activo' : 'Dado de baja'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onViewEquipment(eq)}
                            title="Ver ficha técnica completa"
                            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditEquipment(eq)}
                            title="Editar equipo"
                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onToggleStatus(eq)}
                            title={isActivo ? 'Dar de baja (baja lógica)' : 'Reactivar equipo'}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isActivo
                                ? 'text-slate-500 hover:text-rose-600 hover:bg-rose-50'
                                : 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'
                            }`}
                          >
                            {isActivo ? <Archive className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-14 text-center text-slate-400">
                    <Server className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                    <p className="text-base font-semibold text-slate-700">
                      {equipments.length === 0 
                        ? 'No hay equipos críticos registrados' 
                        : 'No se encontraron equipos críticos con los filtros aplicados'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto">
                      {equipments.length === 0
                        ? 'La base de datos está limpia. Registre el primer equipo técnico o importe el inventario institucional desde una plantilla Excel.'
                        : 'Ajuste los filtros de búsqueda, estado o ubicación para visualizar los equipos.'}
                    </p>
                    {equipments.length === 0 && (
                      <div className="flex items-center justify-center gap-3 mt-4">
                        <button
                          type="button"
                          onClick={onAddEquipment}
                          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
                        >
                          <Plus className="w-4 h-4" />
                          Registrar Primer Equipo
                        </button>
                        <button
                          type="button"
                          onClick={onOpenImportModal}
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
    </div>
  );
};
