import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  FileSpreadsheet, 
  Download, 
  CheckCircle, 
  AlertCircle, 
  ArrowRight,
  MapPin,
  Building2,
  Layers,
  HelpCircle,
  RefreshCw,
  Info
} from 'lucide-react';
import { CampusLocation, AreaType } from '../../types';
import { ExportService } from '../../services/exportService';

interface ExcelImportLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (importedLocations: CampusLocation[]) => void;
  existingLocations: CampusLocation[];
}

export const ExcelImportLocationModal: React.FC<ExcelImportLocationModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
  existingLocations,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload');
  const [updateExisting, setUpdateExisting] = useState<boolean>(true);

  // Mapeo de columnas
  const [mapping, setMapping] = useState<{
    name: string;
    building: string;
    areaType: string;
    description: string;
    status: string;
  }>({
    name: '',
    building: '',
    areaType: '',
    description: '',
    status: '',
  });

  if (!isOpen) return null;

  const normalizeAreaType = (val: any): AreaType => {
    if (!val) return 'otro';
    const s = String(val).toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (s.includes('data') || s.includes('server') || s.includes('servidor') || s.includes('rack')) return 'datacenter';
    if (s.includes('lab') || s.includes('computo') || s.includes('sistemas') || s.includes('informatica')) return 'laboratorio';
    if (s.includes('aula') || s.includes('salon') || s.includes('clase') || s.includes('biblioteca') || s.includes('docente')) return 'aula';
    if (s.includes('oficina') || s.includes('admin') || s.includes('coordinacion') || s.includes('rectoria') || s.includes('ti')) return 'oficina';
    if (s.includes('auditorio') || s.includes('teatro') || s.includes('evento') || s.includes('coliseo')) return 'auditorio';
    if (s.includes('infra') || s.includes('electr') || s.includes('red') || s.includes('planta') || s.includes('subestacion')) return 'infraestructura';
    return 'otro';
  };

  const normalizeStatus = (val: any): 'activa' | 'inactiva' => {
    if (!val) return 'activa';
    const s = String(val).toLowerCase().trim();
    if (s.includes('inactiv') || s.includes('baja') || s.includes('desactiv') || s.includes('no')) return 'inactiva';
    return 'activa';
  };

  const handleFileChange = async (selectedFile: File) => {
    if (!selectedFile) return;
    setErrorMsg('');
    try {
      const rows = await ExportService.parseLocationExcel(selectedFile);
      if (!rows || rows.length === 0) {
        setErrorMsg('El archivo seleccionado no contiene filas de datos o está vacío.');
        return;
      }
      setFile(selectedFile);
      setRawRows(rows);

      // Obtener nombres de columnas del archivo
      const detectedCols = Object.keys(rows[0] || {});
      setColumns(detectedCols);

      // Auto-detección inteligente de encabezados
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
        name: findCol(['nombre', 'ubicacion', 'espacio', 'sala', 'area', 'lugar', 'name']),
        building: findCol(['edificio', 'bloque', 'pabellon', 'sector', 'building']),
        areaType: findCol(['tipo', 'categoria', 'uso', 'areatype', 'clasificacion']),
        description: findCol(['descripcion', 'observacion', 'detalle', 'notas', 'desc']),
        status: findCol(['estado', 'status', 'condicion', 'habilitad']),
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

  // Construir registros procesados para la vista previa
  const processedLocations = rawRows
    .map((row, index) => {
      const nameVal = mapping.name ? String(row[mapping.name] || '').trim() : '';
      if (!nameVal) return null;

      const buildingVal = mapping.building ? String(row[mapping.building] || '').trim() : 'Campus Principal';
      const areaTypeVal = mapping.areaType ? normalizeAreaType(row[mapping.areaType]) : 'otro';
      const descriptionVal = mapping.description ? String(row[mapping.description] || '').trim() : '';
      const statusVal = mapping.status ? normalizeStatus(row[mapping.status]) : 'activa';

      // Verificar si ya existe por nombre
      const existing = existingLocations.find(
        (l) => l.name.toLowerCase().trim() === nameVal.toLowerCase()
      );

      const loc: CampusLocation = {
        id: existing ? existing.id : `loc_${Date.now()}_${index}`,
        name: nameVal,
        building: buildingVal || 'Campus Principal',
        areaType: areaTypeVal,
        description: descriptionVal,
        status: statusVal,
        createdAt: existing ? existing.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      return {
        location: loc,
        isExisting: !!existing,
        existingName: existing ? existing.name : undefined,
      };
    })
    .filter(Boolean) as { location: CampusLocation; isExisting: boolean; existingName?: string }[];

  const handleFinalImport = () => {
    if (processedLocations.length === 0) {
      setErrorMsg('No se detectaron ubicaciones válidas con nombre para importar.');
      return;
    }

    const locationsToSave: CampusLocation[] = [];

    processedLocations.forEach((item) => {
      if (item.isExisting) {
        if (updateExisting) {
          locationsToSave.push(item.location);
        }
      } else {
        locationsToSave.push(item.location);
      }
    });

    onImportSuccess(locationsToSave);
    onClose();
  };

  const handleReset = () => {
    setFile(null);
    setRawRows([]);
    setColumns([]);
    setErrorMsg('');
    setStep('upload');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white text-slate-800 rounded-xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in my-8">
        {/* Encabezado del Modal */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/30">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold flex items-center gap-2">
                Importar Ubicaciones desde Excel
              </h3>
              <p className="text-xs text-slate-400">
                Carga masiva de aulas, laboratorios, bloques y data centers
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Pasos */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center justify-between text-xs">
          <div className="flex items-center gap-6">
            <span
              className={`flex items-center gap-1.5 font-medium ${
                step === 'upload' ? 'text-indigo-600 font-bold' : 'text-slate-500'
              }`}
            >
              <span className="w-5 h-5 rounded-full flex items-center justify-center bg-indigo-100 text-indigo-700 text-[11px] font-bold">
                1
              </span>
              Subir Archivo
            </span>
            <span className="text-slate-300">/</span>
            <span
              className={`flex items-center gap-1.5 font-medium ${
                step === 'mapping' ? 'text-indigo-600 font-bold' : 'text-slate-500'
              }`}
            >
              <span className="w-5 h-5 rounded-full flex items-center justify-center bg-slate-200 text-slate-700 text-[11px] font-bold">
                2
              </span>
              Mapear Columnas
            </span>
            <span className="text-slate-300">/</span>
            <span
              className={`flex items-center gap-1.5 font-medium ${
                step === 'preview' ? 'text-indigo-600 font-bold' : 'text-slate-500'
              }`}
            >
              <span className="w-5 h-5 rounded-full flex items-center justify-center bg-slate-200 text-slate-700 text-[11px] font-bold">
                3
              </span>
              Validar e Importar
            </span>
          </div>

          <button
            type="button"
            onClick={() => ExportService.downloadLocationExcelTemplate()}
            className="text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1.5 hover:underline"
            title="Descargar archivo Excel prediseñado con ejemplos"
          >
            <Download className="w-3.5 h-3.5" />
            Descargar Plantilla Oficial (.xlsx)
          </button>
        </div>

        {/* Contenido según Paso */}
        <div className="p-6">
          {errorMsg && (
            <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block">Atención:</strong>
                <span>{errorMsg}</span>
              </div>
            </div>
          )}

          {/* PASO 1: Subir Archivo */}
          {step === 'upload' && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-indigo-500 hover:bg-indigo-50/20 rounded-xl p-8 text-center cursor-pointer transition-colors"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => e.target.files && handleFileChange(e.target.files[0])}
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-slate-800">
                  Arrastra tu archivo Excel aquí o haz clic para seleccionarlo
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Formatos soportados: .xlsx, .xls o .csv estructurado
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                  <Info className="w-4 h-4 text-indigo-600" />
                  Estructura recomendada del archivo Excel:
                </div>
                <p>
                  El archivo debe contener columnas como: <strong className="text-slate-800">Nombre_Ubicacion</strong>, <strong className="text-slate-800">Edificio_Bloque</strong>, <strong className="text-slate-800">Tipo_Area</strong> (aula, laboratorio, datacenter, oficina, auditorio, infraestructura), <strong className="text-slate-800">Estado</strong> (activa/inactiva) y <strong className="text-slate-800">Descripcion</strong>.
                </p>
              </div>
            </div>
          )}

          {/* PASO 2: Mapear Columnas */}
          {step === 'mapping' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Asignación de Columnas Detectadas
                  </h4>
                  <p className="text-xs text-slate-500">
                    Archivo: <strong className="text-slate-700">{file?.name}</strong> ({rawRows.length} filas encontradas)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  Cambiar archivo
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* Nombre de la Ubicación */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <label className="block font-semibold text-slate-800 mb-1">
                    Nombre del Espacio / Ubicación <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={mapping.name}
                    onChange={(e) => setMapping({ ...mapping, name: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">-- Seleccionar Columna --</option>
                    {columns.map((c) => (
                      <option key={c} value={c}>
                        {c} (ej: "{String(rawRows[0]?.[c] || '').slice(0, 20)}")
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Obligatorio. Identifica la sala, laboratorio o espacio físico.
                  </span>
                </div>

                {/* Edificio / Bloque */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <label className="block font-semibold text-slate-800 mb-1">
                    Edificio / Bloque del Campus
                  </label>
                  <select
                    value={mapping.building}
                    onChange={(e) => setMapping({ ...mapping, building: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">-- No asignar (usar "Campus Principal") --</option>
                    {columns.map((c) => (
                      <option key={c} value={c}>
                        {c} (ej: "{String(rawRows[0]?.[c] || '').slice(0, 20)}")
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Opcional. Si se omite, se asignará a "Campus Principal".
                  </span>
                </div>

                {/* Tipo de Área */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <label className="block font-semibold text-slate-800 mb-1">
                    Tipo de Área o Categoría
                  </label>
                  <select
                    value={mapping.areaType}
                    onChange={(e) => setMapping({ ...mapping, areaType: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">-- No asignar (usar "Otro Ambiente") --</option>
                    {columns.map((c) => (
                      <option key={c} value={c}>
                        {c} (ej: "{String(rawRows[0]?.[c] || '').slice(0, 20)}")
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Auto-clasifica en datacenter, laboratorio, aula, oficina, etc.
                  </span>
                </div>

                {/* Estado */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <label className="block font-semibold text-slate-800 mb-1">
                    Estado Operativo (Activa / Inactiva)
                  </label>
                  <select
                    value={mapping.status}
                    onChange={(e) => setMapping({ ...mapping, status: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">-- No asignar (usar "Activa") --</option>
                    {columns.map((c) => (
                      <option key={c} value={c}>
                        {c} (ej: "{String(rawRows[0]?.[c] || '').slice(0, 20)}")
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Si se omite, se marcará automáticamente como activa.
                  </span>
                </div>

                {/* Descripción */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 md:col-span-2">
                  <label className="block font-semibold text-slate-800 mb-1">
                    Descripción / Observaciones Adicionales
                  </label>
                  <select
                    value={mapping.description}
                    onChange={(e) => setMapping({ ...mapping, description: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">-- Opcional (ninguna) --</option>
                    {columns.map((c) => (
                      <option key={c} value={c}>
                        {c} (ej: "{String(rawRows[0]?.[c] || '').slice(0, 30)}")
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Notas, piso o detalles técnicos del ambiente.
                  </span>
                </div>
              </div>

              {/* Estrategia ante duplicados */}
              <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-lg flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-indigo-900 block">
                    ¿Qué hacer si una ubicación ya existe por nombre?
                  </span>
                  <span className="text-[11px] text-indigo-700">
                    Si el nombre coincide exactamente con una ubicación ya registrada en el sistema.
                  </span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={updateExisting}
                    onChange={(e) => setUpdateExisting(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <span className="font-medium text-slate-800 text-xs">
                    Actualizar información existente
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!mapping.name) {
                      setErrorMsg('Debe seleccionar la columna correspondiente al Nombre de la Ubicación.');
                      return;
                    }
                    setErrorMsg('');
                    setStep('preview');
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5"
                >
                  Continuar a Vista Previa
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* PASO 3: Vista Previa y Validación */}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Vista Previa de Importación ({processedLocations.length} registros listos)
                  </h4>
                  <p className="text-xs text-slate-500">
                    Verifique los datos antes de guardarlos en el catálogo del campus
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full font-semibold">
                    {processedLocations.filter((x) => !x.isExisting).length} Nuevas
                  </span>
                  {processedLocations.filter((x) => x.isExisting).length > 0 && (
                    <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full font-semibold">
                      {processedLocations.filter((x) => x.isExisting).length}{' '}
                      {updateExisting ? 'Se actualizarán' : 'Se omitirán'}
                    </span>
                  )}
                </div>
              </div>

              <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-600 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3 font-semibold">Nombre del Espacio</th>
                      <th className="py-2 px-3 font-semibold">Edificio / Bloque</th>
                      <th className="py-2 px-3 font-semibold">Tipo</th>
                      <th className="py-2 px-3 font-semibold">Estado</th>
                      <th className="py-2 px-3 font-semibold">Tipo de Registro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {processedLocations.map(({ location, isExisting }, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80">
                        <td className="py-2 px-3 font-semibold text-slate-900 font-sans">
                          {location.name}
                        </td>
                        <td className="py-2 px-3 text-slate-600 font-sans">
                          {location.building}
                        </td>
                        <td className="py-2 px-3 font-sans">
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 uppercase">
                            {location.areaType}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-sans">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              location.status === 'activa'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {location.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-sans">
                          {isExisting ? (
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                                updateExisting
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {updateExisting ? 'Actualización' : 'Omitida (Ya existe)'}
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Nueva
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setStep('mapping')}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 font-medium"
                >
                  ← Volver a mapeo
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    id="btn-confirm-import-locations"
                    onClick={handleFinalImport}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Confirmar e Importar {processedLocations.length} Ubicaciones
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
