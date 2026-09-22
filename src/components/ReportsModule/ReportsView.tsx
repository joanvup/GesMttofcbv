import React, { useState, useMemo } from 'react';
import {
  FileText,
  Printer,
  Download,
  Filter,
  Search,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  Server,
  Building2,
  MapPin,
  Eye,
  SlidersHorizontal,
  Info
} from 'lucide-react';
import { Equipment, MaintenanceExecution, CampusLocation } from '../../types';
import { F01EquipmentListReport } from './F01EquipmentListReport';
import { F02TechnicalSheetReport } from './F02TechnicalSheetReport';
import { F03MaintenanceScheduleReport } from './F03MaintenanceScheduleReport';
import { F05ExecutedMaintenanceReport } from './F05ExecutedMaintenanceReport';
import { ExportService } from '../../services/exportService';

import { LogoManager } from './LogoManager';

export type ReportFormatId = 'F01' | 'F02' | 'F03' | 'F05';

interface ReportsViewProps {
  equipments: Equipment[];
  planMatrix: Record<string, boolean[]>;
  executions: MaintenanceExecution[];
  selectedYear: number;
  onYearChange: (year: number) => void;
  locations: CampusLocation[];
  technicianSignature?: string | null;
  initialFormat?: ReportFormatId;
  initialEquipmentId?: string;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  equipments,
  planMatrix,
  executions,
  selectedYear,
  onYearChange,
  locations,
  technicianSignature,
  initialFormat = 'F01',
  initialEquipmentId = 'todos',
}) => {
  // Selector de formato
  const [selectedFormat, setSelectedFormat] = useState<ReportFormatId>(initialFormat);

  // Filtros
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [locationFilter, setLocationFilter] = useState<string>('todos');
  const [singleEquipmentId, setSingleEquipmentId] = useState<string>(initialEquipmentId);

  // Extraer lista única de ubicaciones para el filtro
  const availableLocations = useMemo(() => {
    const locSet = new Set<string>();
    equipments.forEach((e) => {
      if (e.location) locSet.add(e.location);
    });
    return Array.from(locSet).sort();
  }, [equipments]);

  const user = JSON.parse(localStorage.getItem('fcbv_user') || 'null');
  const isAdmin = user?.role === 'admin';

  // Filtrado de equipos aplicable
  const filteredEquipments = useMemo(() => {
    return equipments.filter((eq) => {
      // Filtro por equipo específico (para F02 y F05)
      if (singleEquipmentId !== 'todos' && eq.id !== singleEquipmentId) {
        return false;
      }

      // Filtro por ubicación
      if (locationFilter !== 'todos' && eq.location !== locationFilter) {
        return false;
      }

      // Filtro por texto de búsqueda
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const codeMatch = eq.code.toLowerCase().includes(q);
        const nameMatch = eq.name.toLowerCase().includes(q);
        const locMatch = eq.location?.toLowerCase().includes(q) || false;
        const brandMatch = eq.brand?.toLowerCase().includes(q) || false;
        if (!codeMatch && !nameMatch && !locMatch && !brandMatch) {
          return false;
        }
      }

      return true;
    });
  }, [equipments, singleEquipmentId, locationFilter, searchQuery]);

  // Ejecución de impresión nativa (dispara el cuadro de diálogo de guardado PDF)
  const handlePrint = () => {
    window.print();
  };

  // Descarga en formato Excel según el reporte activo
  const handleExportExcel = () => {
    switch (selectedFormat) {
      case 'F01':
        ExportService.exportPA03F01ToExcel(filteredEquipments);
        break;
      case 'F02':
        ExportService.exportPA03F02ToExcel(filteredEquipments);
        break;
      case 'F03':
        ExportService.exportPA03F03ToExcel(selectedYear, filteredEquipments, planMatrix);
        break;
      case 'F05':
        ExportService.exportPA03F05ToExcel(filteredEquipments, executions);
        break;
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Barra de Título y Presentación del Módulo (Oculta en impresión) */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 uppercase tracking-wider mb-1">
            <Layers className="w-4 h-4" />
            Sistema de Gestión de Calidad (SGC) • FCBV
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Generador de Reportes Oficiales
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Formatos institucionales homologados bajo la norma PA-03 (Versión 3, Vigencia 18-09-24) de la Fundación Colegio Bilingüe de Valledupar. Listos para impresión en papel membretado, guardado en PDF o exportación a Excel.
          </p>
        </div>

        {/* Botón Principal de Impresión */}
        <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0">
          <button
            type="button"
            id="btn-export-report-excel"
            onClick={handleExportExcel}
            className="flex-1 md:flex-none px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200 flex items-center justify-center gap-2 shadow-2xs"
            title="Exportar datos del reporte a hoja de cálculo Excel (.xlsx)"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Descargar Excel</span>
          </button>

          <button
            type="button"
            id="btn-print-report-official"
            onClick={handlePrint}
            className="flex-1 md:flex-none px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            title="Imprimir formato o Guardar como PDF"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir / PDF</span>
          </button>
        </div>
      </div>

      {/* Selector de Pestañas de Formatos Oficiales (Oculto en impresión) */}
      <div className="bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1.5">
          {/* F01 */}
          <button
            type="button"
            id="btn-tab-report-f01"
            onClick={() => {
              setSelectedFormat('F01');
              setSingleEquipmentId('todos');
            }}
            className={`p-3 rounded-xl text-left transition-all flex items-start gap-3 border cursor-pointer ${
              selectedFormat === 'F01'
                ? 'bg-white text-indigo-900 border-indigo-300 shadow-xs ring-1 ring-indigo-400'
                : 'bg-transparent text-slate-600 border-transparent hover:bg-white/60'
            }`}
          >
            <div
              className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                selectedFormat === 'F01' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200/70 text-slate-500'
              }`}
            >
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider block text-indigo-600">
                PA – 03 – F01
              </span>
              <span className="text-xs font-bold text-slate-900 block truncate">
                Listado Equipos Críticos
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Censo institucional tabular
              </span>
            </div>
          </button>

          {/* F02 */}
          <button
            type="button"
            id="btn-tab-report-f02"
            onClick={() => setSelectedFormat('F02')}
            className={`p-3 rounded-xl text-left transition-all flex items-start gap-3 border cursor-pointer ${
              selectedFormat === 'F02'
                ? 'bg-white text-indigo-900 border-indigo-300 shadow-xs ring-1 ring-indigo-400'
                : 'bg-transparent text-slate-600 border-transparent hover:bg-white/60'
            }`}
          >
            <div
              className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                selectedFormat === 'F02' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200/70 text-slate-500'
              }`}
            >
              <Server className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider block text-indigo-600">
                PA – 03 – F02
              </span>
              <span className="text-xs font-bold text-slate-900 block truncate">
                Ficha Técnica de Equipos
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Especificaciones, partes y tareas
              </span>
            </div>
          </button>

          {/* F03 */}
          <button
            type="button"
            id="btn-tab-report-f03"
            onClick={() => {
              setSelectedFormat('F03');
              setSingleEquipmentId('todos');
            }}
            className={`p-3 rounded-xl text-left transition-all flex items-start gap-3 border cursor-pointer ${
              selectedFormat === 'F03'
                ? 'bg-white text-indigo-900 border-indigo-300 shadow-xs ring-1 ring-indigo-400'
                : 'bg-transparent text-slate-600 border-transparent hover:bg-white/60'
            }`}
          >
            <div
              className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                selectedFormat === 'F03' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200/70 text-slate-500'
              }`}
            >
              <Calendar className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider block text-indigo-600">
                PA – 03 – F03
              </span>
              <span className="text-xs font-bold text-slate-900 block truncate">
                Programación de Mttos
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Matriz anual preventiva de 12 meses
              </span>
            </div>
          </button>

          {/* F05 */}
          <button
            type="button"
            id="btn-tab-report-f05"
            onClick={() => setSelectedFormat('F05')}
            className={`p-3 rounded-xl text-left transition-all flex items-start gap-3 border cursor-pointer ${
              selectedFormat === 'F05'
                ? 'bg-white text-indigo-900 border-indigo-300 shadow-xs ring-1 ring-indigo-400'
                : 'bg-transparent text-slate-600 border-transparent hover:bg-white/60'
            }`}
          >
            <div
              className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                selectedFormat === 'F05' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200/70 text-slate-500'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider block text-indigo-600">
                PA – 03 – F05
              </span>
              <span className="text-xs font-bold text-slate-900 block truncate">
                Registro de Mtto Ejecutado
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Bitácora de intervenciones y firmas
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Barra de Filtros y Configuración de Reporte (Oculta en impresión) */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700 print:hidden">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Selector de Alcance para F02 y F05 (Individual o Masivo) */}
          {(selectedFormat === 'F02' || selectedFormat === 'F05') && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-semibold text-[11px]">Equipo:</span>
              <select
                id="select-report-equipment"
                value={singleEquipmentId}
                onChange={(e) => setSingleEquipmentId(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-indigo-500 max-w-[200px]"
              >
                <option value="todos">Todos los equipos ({equipments.length})</option>
                {equipments.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.code} • {eq.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Selector de Año para F03 */}
          {selectedFormat === 'F03' && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-semibold text-[11px]">Año del Cronograma:</span>
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                {[2025, 2026, 2027].map((yr) => (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => onYearChange(yr)}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
                      selectedYear === yr
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {yr}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Filtro por Ubicación */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-semibold text-[11px]">Ubicación:</span>
            <select
              id="select-report-location"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-indigo-500 max-w-[170px]"
            >
              <option value="todos">Todas las áreas</option>
              {availableLocations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          {/* Buscador de Texto */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="input-search-reports"
              placeholder="Buscar por código o nombre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 w-44 sm:w-56"
            />
          </div>
        </div>

        {/* Resumen de Registros a Generar */}
        <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-indigo-600" />
          <span>
            Generando reporte para <strong>{filteredEquipments.length}</strong> de <strong>{equipments.length}</strong> equipos.
          </span>
        </div>
      </div>

      {isAdmin && (
        <div className="print:hidden">
          <LogoManager />
        </div>
      )}

      {/* Contenedor del Documento Oficial (Área de Impresión) */}
      <div id="app-printable-report" className="w-full">
        {selectedFormat === 'F01' && (
          <F01EquipmentListReport equipments={filteredEquipments} />
        )}

        {selectedFormat === 'F02' && (
          <F02TechnicalSheetReport equipments={filteredEquipments} />
        )}

        {selectedFormat === 'F03' && (
          <F03MaintenanceScheduleReport
            equipments={filteredEquipments}
            planMatrix={planMatrix}
            selectedYear={selectedYear}
          />
        )}

        {selectedFormat === 'F05' && (
          <F05ExecutedMaintenanceReport
            equipments={filteredEquipments}
            executions={executions}
            technicianSignature={technicianSignature}
          />
        )}
      </div>
    </div>
  );
};
