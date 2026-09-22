import React, { useState, useRef, useMemo } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle,
  AlertCircle,
  MapPin,
  Building2,
  Sparkles,
  Check,
} from 'lucide-react';
import { Equipment, EquipmentFrequency, EquipmentStatus, CampusLocation, AreaType } from '../../types';
import { ExportService } from '../../services/exportService';
import { inferAreaType, inferBuilding, INITIAL_BUILDINGS } from '../../services/storage';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (newEquipments: Equipment[], newLocations?: CampusLocation[]) => void;
  existingLocations?: CampusLocation[];
  existingBuildings?: string[];
}

const AREA_TYPE_LABELS: Record<AreaType, string> = {
  datacenter: 'Data Center',
  laboratorio: 'Laboratorio',
  aula: 'Aula / Salón',
  oficina: 'Oficina',
  auditorio: 'Auditorio',
  infraestructura: 'Infraestructura',
  otro: 'General / Otro',
};

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
  existingLocations = [],
  existingBuildings = [],
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [step, setStep] = useState<'upload' | 'mapping'>('upload');

  // Configuración de creación automática de ubicaciones
  const [autoCreateLocations, setAutoCreateLocations] = useState<boolean>(true);
  const [defaultBuilding, setDefaultBuilding] = useState<string>(
    existingBuildings[0] || INITIAL_BUILDINGS[0] || 'Edificio Central'
  );

  // Mapeo de columnas
  const [mapping, setMapping] = useState<{
    code: string;
    name: string;
    location: string;
    building: string;
    areaType: string;
    brand: string;
    model: string;
    serial: string;
    frequency: string;
    parts: string;
    tasks: string;
    status: string;
    observations: string;
  }>({
    code: '',
    name: '',
    location: '',
    building: '',
    areaType: '',
    brand: '',
    model: '',
    serial: '',
    frequency: '',
    parts: '',
    tasks: '',
    status: '',
    observations: '',
  });

  // Lista de edificios disponibles
  const availableBuildings = useMemo(() => {
    const set = new Set<string>();
    existingBuildings.forEach((b) => set.add(b));
    INITIAL_BUILDINGS.forEach((b) => set.add(b));
    return Array.from(set);
  }, [existingBuildings]);

  // Detección y resumen de ubicaciones en el archivo
  const distinctLocationsPreview = useMemo(() => {
    if (!rawRows.length || !mapping.location) return [];

    const existingNamesMap = new Map<string, CampusLocation>();
    existingLocations.forEach((l) =>
      existingNamesMap.set(l.name.toLowerCase().trim(), l)
    );

    const locMap = new Map<
      string,
      {
        name: string;
        equipmentCount: number;
        isNew: boolean;
        inferredBuilding: string;
        inferredAreaType: AreaType;
      }
    >();

    rawRows.forEach((row) => {
      const rawLoc = row[mapping.location];
      const locName = (rawLoc ? String(rawLoc) : 'Campus General').trim();
      if (!locName) return;

      const key = locName.toLowerCase();
      const existing = existingNamesMap.get(key);

      const rawBuilding = mapping.building ? String(row[mapping.building] || '').trim() : '';
      const rawAreaType = mapping.areaType ? String(row[mapping.areaType] || '').trim() : '';

      const inferredBuilding =
        rawBuilding ||
        inferBuilding(locName, availableBuildings, defaultBuilding || 'Edificio Central');
      const inferredAreaType = rawAreaType
        ? inferAreaType(rawAreaType)
        : inferAreaType(locName);

      if (locMap.has(key)) {
        locMap.get(key)!.equipmentCount++;
      } else {
        locMap.set(key, {
          name: existing ? existing.name : locName,
          equipmentCount: 1,
          isNew: !existing,
          inferredBuilding: existing ? existing.building : inferredBuilding,
          inferredAreaType: existing ? existing.areaType : inferredAreaType,
        });
      }
    });

    return Array.from(locMap.values());
  }, [
    rawRows,
    mapping.location,
    mapping.building,
    mapping.areaType,
    existingLocations,
    availableBuildings,
    defaultBuilding,
  ]);

  const newLocationsCount = useMemo(() => {
    return distinctLocationsPreview.filter((l) => l.isNew).length;
  }, [distinctLocationsPreview]);

  if (!isOpen) return null;

  const handleFileChange = async (selectedFile: File) => {
    if (!selectedFile) return;
    setErrorMsg('');
    try {
      const rows = await ExportService.parseEquipmentExcel(selectedFile);
      if (!rows || rows.length === 0) {
        setErrorMsg('El archivo seleccionado no contiene filas de datos o está vacío.');
        return;
      }
      setFile(selectedFile);
      setRawRows(rows);

      // Obtener nombres de columnas del archivo
      const detectedCols = Object.keys(rows[0] || {});
      setColumns(detectedCols);

      // Auto-detección inteligente de columnas
      const findCol = (keywords: string[]): string => {
        for (const col of detectedCols) {
          const lower = col.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          if (keywords.some((k) => lower.includes(k))) {
            return col;
          }
        }
        return '';
      };

      setMapping({
        code: findCol(['codigo', 'code', 'id', 'tag']),
        name: findCol(['nombre', 'descripcion', 'equipo', 'name', 'desc']),
        location: findCol(['ubicacion', 'area', 'lugar', 'location', 'sala', 'espacio']),
        building: findCol(['edificio', 'bloque', 'pabellon', 'sector', 'building']),
        areaType: findCol(['tipo', 'categoria', 'uso', 'areatype', 'clasificacion']),
        brand: findCol(['marca', 'brand', 'fabricante']),
        model: findCol(['modelo', 'model']),
        serial: findCol(['serial', 'serie', 'sn']),
        frequency: findCol(['frecuencia', 'periodicidad', 'frec']),
        parts: findCol(['partes', 'componentes', 'piezas']),
        tasks: findCol(['tareas', 'mantenimiento', 'actividades', 'procedimiento']),
        status: findCol(['estado', 'status', 'condicion']),
        observations: findCol(['observaciones', 'notas', 'comentarios', 'observacion']),
      });

      setStep('mapping');
    } catch (err: any) {
      setErrorMsg(`Error al procesar el archivo Excel: ${err.message || 'Formato no soportado'}`);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const parseFrequency = (val: any): EquipmentFrequency => {
    if (!val) return 'trimestral';
    const str = String(val).toLowerCase().trim();
    if (str.includes('mensual')) return 'mensual';
    if (str.includes('trimestral')) return 'trimestral';
    if (str.includes('semestral')) return 'semestral';
    if (str.includes('anual')) return 'anual';
    return 'trimestral';
  };

  const parseStatus = (val: any): EquipmentStatus => {
    if (!val) return 'activo';
    const str = String(val).toLowerCase().trim();
    if (str.includes('baja') || str.includes('inactivo') || str.includes('retirado')) return 'baja';
    return 'activo';
  };

  const parseList = (val: any): string[] => {
    if (!val) return [];
    return String(val)
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
  };

  const handleConfirmImport = () => {
    if (!mapping.code || !mapping.name) {
      setErrorMsg('Debe mapear al menos las columnas de Código y Nombre del equipo.');
      return;
    }

    const now = new Date().toISOString();
    const importedEquipments: Equipment[] = rawRows
      .filter((row) => row[mapping.code] && String(row[mapping.code]).trim() !== '')
      .map((row, index) => {
        const code = String(row[mapping.code]).trim().toUpperCase();
        const name = String(row[mapping.name] || 'Equipo sin nombre').trim();
        const location = String(row[mapping.location] || 'Campus General').trim();
        const brand = String(row[mapping.brand] || '').trim();
        const model = String(row[mapping.model] || '').trim();
        const serial = String(row[mapping.serial] || '').trim();
        const frequency = parseFrequency(row[mapping.frequency]);
        const status = parseStatus(row[mapping.status]);
        const parts = parseList(row[mapping.parts]);
        const tasks = parseList(row[mapping.tasks]);
        const observations = String(row[mapping.observations] || '').trim();

        return {
          id: `eq-import-${Date.now()}-${index}`,
          code,
          name,
          location,
          brand,
          model,
          serial,
          parts: parts.length > 0 ? parts : ['Componente principal'],
          maintenanceTasks: tasks.length > 0 ? tasks : ['Inspección y limpieza preventiva'],
          frequency,
          status,
          observations,
          createdAt: now,
          updatedAt: now,
        };
      });

    if (importedEquipments.length === 0) {
      setErrorMsg('No se encontraron filas válidas con código de equipo.');
      return;
    }

    // Preparar nuevas ubicaciones para creación automática si está activado
    let newLocationsToCreate: CampusLocation[] = [];
    if (autoCreateLocations) {
      newLocationsToCreate = distinctLocationsPreview
        .filter((l) => l.isNew)
        .map((l, index) => ({
          id: `loc_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 6)}`,
          name: l.name,
          building: l.inferredBuilding || defaultBuilding || 'Edificio Central',
          areaType: l.inferredAreaType,
          description: `Ubicación creada automáticamente al importar equipos críticos vía Excel.`,
          status: 'activa' as const,
          createdAt: now,
          updatedAt: now,
        }));
    }

    onImportSuccess(importedEquipments, newLocationsToCreate);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Importar Equipos Críticos desde Excel (.xlsx)
              </h3>
              <p className="text-xs text-slate-500">
                Colegio FCBV — Con creación automática de ubicaciones en el campus
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

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {step === 'upload' && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl p-8 text-center cursor-pointer bg-slate-50/50 hover:bg-indigo-50/30 transition-all flex flex-col items-center justify-center gap-3"
              >
                <div className="p-3 bg-white shadow-xs rounded-full border border-slate-200 text-indigo-600">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    Haga clic para subir o arrastre el archivo Excel aquí
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Formatos admitidos: .xlsx, .xls
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileChange(e.target.files[0]);
                    }
                  }}
                />
              </div>

              {/* Plantilla modelo */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex items-center justify-between">
                <div className="text-xs text-slate-600">
                  <span className="font-semibold text-slate-800">¿No tienes el formato oficial?</span>
                  <p className="text-slate-500">Descarga la plantilla con ejemplos, ubicaciones y columnas requeridas.</p>
                </div>
                <button
                  type="button"
                  onClick={() => ExportService.downloadEquipmentExcelTemplate()}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-600" />
                  Descargar Plantilla
                </button>
              </div>

              <div className="bg-indigo-50/60 border border-indigo-100 rounded-lg p-3 text-xs text-indigo-900 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                <div>
                  <span className="font-semibold">Creación automática de ubicaciones:</span>
                  <p className="text-indigo-700 text-[11px] mt-0.5 leading-relaxed">
                    Si el archivo contiene ubicaciones nuevas (ej: <em>Sala de Profesores, Laboratorio de Robótica</em>), el sistema las dará de alta automáticamente en el módulo de Ubicaciones del campus, asignándoles su edificio correspondiente.
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === 'mapping' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div className="text-xs text-slate-600">
                  Archivo cargado: <strong className="text-slate-800">{file?.name}</strong> ({rawRows.length} filas detectadas)
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setRawRows([]);
                    setStep('upload');
                  }}
                  className="text-xs text-indigo-600 hover:underline font-medium"
                >
                  Cambiar archivo
                </button>
              </div>

              {/* Sección 1: Mapeo de columnas principales */}
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-2">
                  1. Mapeo de columnas del archivo Excel:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {[
                    { key: 'code', label: 'Código del Equipo *', required: true },
                    { key: 'name', label: 'Descripción / Nombre *', required: true },
                    { key: 'location', label: 'Ubicación / Espacio *', required: true },
                    { key: 'building', label: 'Edificio / Bloque (Opcional)', required: false },
                    { key: 'areaType', label: 'Tipo de Área (Opcional)', required: false },
                    { key: 'brand', label: 'Marca', required: false },
                    { key: 'model', label: 'Modelo', required: false },
                    { key: 'serial', label: 'Serial', required: false },
                    { key: 'frequency', label: 'Frecuencia (mensual, trimestral...)', required: false },
                    { key: 'status', label: 'Estado (activo / baja)', required: false },
                    { key: 'parts', label: 'Partes (separadas por coma)', required: false },
                    { key: 'tasks', label: 'Tareas de Mantenimiento', required: false },
                    { key: 'observations', label: 'Observaciones', required: false },
                  ].map((item) => (
                    <div key={item.key} className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        {item.label}
                      </label>
                      <select
                        value={(mapping as any)[item.key] || ''}
                        onChange={(e) =>
                          setMapping({ ...mapping, [item.key]: e.target.value })
                        }
                        className="w-full text-xs px-2 py-1 rounded border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="">-- No mapear / Por defecto --</option>
                        {columns.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sección 2: Configuración de Creación Automática de Ubicaciones */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-emerald-200/60">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-200 text-emerald-800 rounded-lg">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                        2. Creación Automática de Ubicaciones en el Campus
                      </h4>
                      <p className="text-[11px] text-emerald-700">
                        Garantiza que todos los equipos queden vinculados a ubicaciones registradas
                      </p>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer select-none self-start sm:self-auto bg-white/80 px-2.5 py-1 rounded-lg border border-emerald-300 shadow-2xs">
                    <input
                      type="checkbox"
                      checked={autoCreateLocations}
                      onChange={(e) => setAutoCreateLocations(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                    />
                    <span className="text-xs font-bold text-emerald-900">
                      Crear ubicaciones automáticamente
                    </span>
                  </label>
                </div>

                {autoCreateLocations && (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2 text-slate-700">
                        <Building2 className="w-4 h-4 text-emerald-700 shrink-0" />
                        <span className="font-semibold text-xs">Edificio predeterminado para nuevas ubicaciones:</span>
                      </div>
                      <select
                        value={defaultBuilding}
                        onChange={(e) => setDefaultBuilding(e.target.value)}
                        className="text-xs px-2.5 py-1 rounded border border-emerald-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                      >
                        {availableBuildings.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Resumen de detección de ubicaciones */}
                    {mapping.location && distinctLocationsPreview.length > 0 && (
                      <div className="bg-white/90 rounded-lg p-3 border border-emerald-200 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-700">
                            Resumen de ubicaciones detectadas en el Excel:
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full font-medium">
                              {distinctLocationsPreview.length} ubicaciones en total
                            </span>
                            {newLocationsCount > 0 ? (
                              <span className="text-[11px] px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-emerald-600" />
                                {newLocationsCount} nueva(s) se crearán
                              </span>
                            ) : (
                              <span className="text-[11px] px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full font-medium flex items-center gap-1">
                                <Check className="w-3 h-3 text-blue-600" />
                                Todas ya existen
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Lista de nuevas ubicaciones que se darán de alta */}
                        {newLocationsCount > 0 ? (
                          <div className="space-y-1 pt-1">
                            <span className="text-[11px] text-slate-500 block">
                              Nuevas ubicaciones que se darán de alta automáticamente en el catálogo FCBV:
                            </span>
                            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pt-1">
                              {distinctLocationsPreview
                                .filter((l) => l.isNew)
                                .map((l) => (
                                  <div
                                    key={l.name}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-300 rounded-md text-[11px] text-emerald-900"
                                  >
                                    <MapPin className="w-3 h-3 text-emerald-600" />
                                    <span className="font-bold">{l.name}</span>
                                    <span className="text-slate-400">•</span>
                                    <span className="text-slate-600 text-[10px]">
                                      {l.inferredBuilding} ({AREA_TYPE_LABELS[l.inferredAreaType]})
                                    </span>
                                    <span className="bg-emerald-200/80 text-emerald-800 text-[10px] px-1 rounded font-bold">
                                      {l.equipmentCount} eq.
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-500 italic">
                            Todas las ubicaciones del archivo Excel corresponden a ubicaciones previamente dadas de alta en el campus.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {step === 'mapping' && (
              <span>
                {rawRows.length} equipos listos para importar
                {autoCreateLocations && newLocationsCount > 0 && (
                  <strong className="text-emerald-700 ml-1">
                    • {newLocationsCount} nueva(s) ubicación(es) se crearán
                  </strong>
                )}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            {step === 'mapping' && (
              <button
                type="button"
                onClick={handleConfirmImport}
                className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" />
                Procesar e Importar {rawRows.length} Equipos
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
