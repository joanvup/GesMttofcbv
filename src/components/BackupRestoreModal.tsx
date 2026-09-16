import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Database,
  Download,
  Upload,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  FileJson,
  RotateCcw,
  Sparkles,
  Server,
  MapPin,
  Building2,
  Calendar,
  ClipboardCheck,
  ArrowRight,
  HardDrive
} from 'lucide-react';
import { StorageService } from '../services/storage';
import { DatabaseBackup, DatabaseBackupData, DatabaseBackupMetadata } from '../types';

interface BackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreSuccess: (summary: {
    equipmentsCount: number;
    locationsCount: number;
    executionsCount: number;
    years: number[];
  }) => void;
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({
  isOpen,
  onClose,
  onRestoreSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'backup' | 'restore'>('backup');
  const [copied, setCopied] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Estados para la restauración
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [parsedBackup, setParsedBackup] = useState<{
    metadata: DatabaseBackupMetadata;
    data: DatabaseBackupData;
  } | null>(null);
  const [restoreError, setRestoreError] = useState<string>('');
  const [restoreMode, setRestoreMode] = useState<'overwrite' | 'merge'>('overwrite');
  const [autoBackupBeforeRestore, setAutoBackupBeforeRestore] = useState<boolean>(true);
  const [isProcessingRestore, setIsProcessingRestore] = useState<boolean>(false);

  // Estadísticas de la base de datos actual en vivo
  const [currentDbStats, setCurrentDbStats] = useState<DatabaseBackupMetadata>({
    appName: 'FCBV',
    exportDate: '',
    equipmentCount: { total: 0, active: 0 },
    locationsCount: 0,
    buildingsCount: 0,
    executionsCount: 0,
    annualPlansYears: [],
  });

  useEffect(() => {
    if (isOpen) {
      StorageService.createFullBackup().then((backup) => {
        if (backup && backup.metadata) {
          setCurrentDbStats(backup.metadata);
        }
      }).catch((e) => console.error('Error loading DB stats:', e));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Manejador de descarga de copia de seguridad
  const handleDownloadBackup = async () => {
    try {
      const filename = await StorageService.downloadBackupFile();
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4000);
    } catch (err: any) {
      alert(`Error al generar la copia de seguridad: ${err.message}`);
    }
  };

  // Manejador de copia del JSON al portapapeles
  const handleCopyJson = async () => {
    try {
      const backup = await StorageService.createFullBackup();
      await navigator.clipboard.writeText(JSON.stringify(backup, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (e) {
      console.error('Error copying JSON', e);
    }
  };

  // Manejador de carga y análisis de archivo para restauración
  const handleFileChange = (file: File) => {
    if (!file) return;
    setRestoreError('');
    setRestoreFile(file);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);
        const validation = await StorageService.validateBackup(parsed);

        if (!validation.valid || !validation.data || !validation.metadata) {
          setRestoreError(validation.error || 'El archivo seleccionado no corresponde a una copia de seguridad válida.');
          setParsedBackup(null);
          return;
        }

        setParsedBackup({
          metadata: validation.metadata,
          data: validation.data,
        });
      } catch (err: any) {
        setRestoreError(`Error de formato JSON: ${err.message || 'Estructura ilegible'}`);
        setParsedBackup(null);
      }
    };
    reader.onerror = () => {
      setRestoreError('No fue posible leer el archivo seleccionado.');
      setParsedBackup(null);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // Ejecución final de la restauración
  const handleExecuteRestore = async () => {
    if (!parsedBackup) return;

    setIsProcessingRestore(true);
    try {
      // 1. Si está activado, descargar un respaldo preventivo de los datos actuales
      if (autoBackupBeforeRestore) {
        await StorageService.downloadBackupFile(`FCBV_Respaldo_Previo_Restauracion_${Date.now()}.json`);
      }

      // 2. Restaurar la base de datos
      const result = await StorageService.restoreBackup(parsedBackup.data, restoreMode);

      // 3. Notificar a la app principal para refrescar el estado reactivo
      const currentEquipments = await StorageService.getEquipmentList();
      const currentLocations = await StorageService.getLocations();
      const currentExecutions = await StorageService.getExecutions();

      onRestoreSuccess({
        equipmentsCount: currentEquipments.length,
        locationsCount: currentLocations.length,
        executionsCount: currentExecutions.length,
        years: result.restoredPlansYears,
      });

      onClose();
    } catch (err: any) {
      setRestoreError(`Error al restaurar la base de datos: ${err.message}`);
      setIsProcessingRestore(false);
    }
  };

  return (
    <div
      id="modal-backup-restore-db"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="backup-modal-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-800">
        {/* Encabezado del Modal */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 id="backup-modal-title" className="text-base font-bold text-slate-900">
                Copia de Seguridad y Restauración de Base de Datos
              </h3>
              <p className="text-xs text-slate-500">
                Colegio Bilingüe FCBV • Respaldo completo de Equipos, Planes, Ejecuciones y Ubicaciones
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

        {/* Selector de Pestañas (Crear Copia / Restaurar) */}
        <div className="flex border-b border-slate-200 bg-slate-100/70 px-6 pt-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-lg transition-colors border-t-2 ${
              activeTab === 'backup'
                ? 'bg-white text-indigo-700 border-indigo-600 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 border-transparent hover:bg-slate-200/60'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Crear Copia de Seguridad (Exportar)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('restore')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-lg transition-colors border-t-2 ${
              activeTab === 'restore'
                ? 'bg-white text-indigo-700 border-indigo-600 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 border-transparent hover:bg-slate-200/60'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Restaurar Copia de Seguridad (Importar)</span>
          </button>
        </div>

        {/* Contenido según pestaña */}
        <div className="p-6 space-y-5 max-h-[72vh] overflow-y-auto">
          {/* TAB 1: CREAR COPIA DE SEGURIDAD */}
          {activeTab === 'backup' && (
            <div className="space-y-5">
              {/* Tarjeta Informativa de Estado de la Base de Datos */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
                    <HardDrive className="w-4 h-4 text-indigo-600" />
                    Estado Actual de la Base de Datos Institucional
                  </div>
                  <span className="text-[11px] px-2 py-0.5 bg-emerald-100 text-emerald-800 font-semibold rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    En línea (LocalStorage)
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                      <Server className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Equipos Críticos</span>
                    </div>
                    <div className="text-lg font-bold text-slate-900 mt-1 font-mono">
                      {currentDbStats.equipmentCount.total}
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {currentDbStats.equipmentCount.active} activos
                    </span>
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Ubicaciones</span>
                    </div>
                    <div className="text-lg font-bold text-slate-900 mt-1 font-mono">
                      {currentDbStats.locationsCount}
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {currentDbStats.buildingsCount} edificios
                    </span>
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                      <ClipboardCheck className="w-3.5 h-3.5 text-sky-600" />
                      <span>Ejecuciones</span>
                    </div>
                    <div className="text-lg font-bold text-slate-900 mt-1 font-mono">
                      {currentDbStats.executionsCount}
                    </div>
                    <span className="text-[10px] text-slate-400">Órdenes registradas</span>
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                      <Calendar className="w-3.5 h-3.5 text-amber-600" />
                      <span>Cronogramas</span>
                    </div>
                    <div className="text-lg font-bold text-slate-900 mt-1 font-mono">
                      {currentDbStats.annualPlansYears.length}
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {currentDbStats.annualPlansYears.join(', ') || 'Sin años'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Explicación del Contenido de la Copia */}
              <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-4 text-xs text-indigo-950 space-y-2">
                <div className="flex items-center gap-2 font-bold text-indigo-900">
                  <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                  ¿Qué incluye este archivo de copia de seguridad (.json)?
                </div>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-indigo-800 list-disc list-inside">
                  <li>Todos los equipos críticos con códigos, marcas, modelos y tareas.</li>
                  <li>Catálogo institucional de ubicaciones y edificios del campus.</li>
                  <li>Cronograma completo de planes anuales de mantenimiento.</li>
                  <li>Historial de órdenes ejecutadas, bitácoras y firmas digitales.</li>
                </ul>
              </div>

              {/* Mensaje de éxito si ya se descargó */}
              {downloadSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    ¡Copia de seguridad descargada exitosamente en tu carpeta de descargas!
                  </span>
                </div>
              )}

              {/* Botones de acción para crear copia */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  id="btn-download-full-backup"
                  onClick={handleDownloadBackup}
                  className="w-full sm:w-auto flex-1 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Descargar Copia de Seguridad Completa (.json)
                </button>

                <button
                  type="button"
                  id="btn-copy-backup-json"
                  onClick={handleCopyJson}
                  className="w-full sm:w-auto px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs transition-colors flex items-center justify-center gap-2 border border-slate-200"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-slate-500" />
                      <span>Copiar JSON</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: RESTAURAR COPIA DE SEGURIDAD */}
          {activeTab === 'restore' && (
            <div className="space-y-4">
              {/* Zona de Carga de Archivo */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2.5 ${
                  parsedBackup
                    ? 'border-emerald-400 bg-emerald-50/40'
                    : 'border-slate-300 hover:border-indigo-500 bg-slate-50/60 hover:bg-indigo-50/20'
                }`}
              >
                <div
                  className={`p-3 rounded-full border shadow-2xs ${
                    parsedBackup
                      ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                      : 'bg-white text-indigo-600 border-slate-200'
                  }`}
                >
                  {parsedBackup ? <CheckCircle2 className="w-6 h-6" /> : <Upload className="w-6 h-6" />}
                </div>

                {restoreFile ? (
                  <div>
                    <p className="text-xs font-bold text-slate-800 flex items-center justify-center gap-1.5">
                      <FileJson className="w-4 h-4 text-indigo-600" />
                      {restoreFile.name}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {(restoreFile.size / 1024).toFixed(1)} KB • Haga clic para seleccionar otro archivo
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-semibold text-slate-700">
                      Haga clic o arrastre el archivo de copia de seguridad (.json) aquí
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Archivos compatibles: formato oficial de respaldo FCBV (.json)
                    </p>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileChange(e.target.files[0]);
                    }
                  }}
                />
              </div>

              {/* Alerta de Error si falló el parseo */}
              {restoreError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Error al validar la copia de seguridad:</span>
                    <p className="text-[11px] text-rose-700 mt-0.5">{restoreError}</p>
                  </div>
                </div>
              )}

              {/* Previsualización del Contenido del Respaldo Cargado */}
              {parsedBackup && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-emerald-200">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-700" />
                        <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                          Contenido Verificado de la Copia de Seguridad
                        </span>
                      </div>
                      <span className="text-[10px] text-emerald-800 font-mono bg-emerald-100 px-2 py-0.5 rounded">
                        Versión {parsedBackup.metadata.version}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                      <div className="bg-white/90 p-2.5 rounded-lg border border-emerald-200">
                        <span className="text-[11px] text-slate-500 block">Equipos</span>
                        <span className="text-base font-bold text-slate-900 font-mono">
                          {parsedBackup.data.equipments.length}
                        </span>
                      </div>

                      <div className="bg-white/90 p-2.5 rounded-lg border border-emerald-200">
                        <span className="text-[11px] text-slate-500 block">Ubicaciones</span>
                        <span className="text-base font-bold text-slate-900 font-mono">
                          {parsedBackup.data.locations.length}
                        </span>
                      </div>

                      <div className="bg-white/90 p-2.5 rounded-lg border border-emerald-200">
                        <span className="text-[11px] text-slate-500 block">Ejecuciones</span>
                        <span className="text-base font-bold text-slate-900 font-mono">
                          {parsedBackup.data.executions.length}
                        </span>
                      </div>

                      <div className="bg-white/90 p-2.5 rounded-lg border border-emerald-200">
                        <span className="text-[11px] text-slate-500 block">Años Planificados</span>
                        <span className="text-xs font-bold text-slate-900 font-mono">
                          {parsedBackup.metadata.annualPlansYears.join(', ') || 'N/A'}
                        </span>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-600 pt-1">
                      Fecha del respaldo: <strong>{new Date(parsedBackup.metadata.createdAt).toLocaleString()}</strong>
                      {parsedBackup.metadata.institution && (
                        <span> • Institución: <strong>{parsedBackup.metadata.institution}</strong></span>
                      )}
                    </div>
                  </div>

                  {/* Selección del Modo de Restauración */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                      Selecciona el Modo de Restauración
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                          restoreMode === 'overwrite'
                            ? 'bg-indigo-50/60 border-indigo-400 ring-1 ring-indigo-400'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <input
                            type="radio"
                            name="restoreMode"
                            value="overwrite"
                            checked={restoreMode === 'overwrite'}
                            onChange={() => setRestoreMode('overwrite')}
                            className="w-4 h-4 text-indigo-600 mt-0.5"
                          />
                          <div>
                            <span className="text-xs font-bold text-slate-900 block">
                              Reemplazo Completo (Sobrescribir)
                            </span>
                            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                              Sustituye por completo los datos actuales con los del archivo. Recomendado para restaurar una copia fiel.
                            </p>
                          </div>
                        </div>
                      </label>

                      <label
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                          restoreMode === 'merge'
                            ? 'bg-indigo-50/60 border-indigo-400 ring-1 ring-indigo-400'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <input
                            type="radio"
                            name="restoreMode"
                            value="merge"
                            checked={restoreMode === 'merge'}
                            onChange={() => setRestoreMode('merge')}
                            className="w-4 h-4 text-indigo-600 mt-0.5"
                          />
                          <div>
                            <span className="text-xs font-bold text-slate-900 block">
                              Fusión Inteligente (Combinar)
                            </span>
                            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                              Conserva tus datos actuales y añade únicamente los equipos, ubicaciones y órdenes que no existan.
                            </p>
                          </div>
                        </div>
                      </label>
                    </div>

                    {/* Checkbox de Seguridad: Respaldo previo automático */}
                    <div className="pt-2 border-t border-slate-200">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={autoBackupBeforeRestore}
                          onChange={(e) => setAutoBackupBeforeRestore(e.target.checked)}
                          className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                        />
                        <span className="text-xs font-medium text-slate-700">
                          Descargar automáticamente un respaldo de seguridad de mis datos actuales antes de restaurar (recomendado)
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pie de Página con Botones de Cierre / Confirmación */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cerrar
          </button>

          {activeTab === 'restore' && parsedBackup && (
            <button
              type="button"
              id="btn-confirm-restore-db"
              onClick={handleExecuteRestore}
              disabled={isProcessingRestore}
              className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-sm hover:shadow transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              <span>
                {isProcessingRestore
                  ? 'Restaurando...'
                  : `Restaurar Base de Datos (${parsedBackup.data.equipments.length} equipos, ${parsedBackup.data.locations.length} ubicaciones)`}
              </span>
            </button>
          )}

          {activeTab === 'backup' && (
            <button
              type="button"
              onClick={handleDownloadBackup}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm hover:shadow transition-all flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>Descargar .json</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
