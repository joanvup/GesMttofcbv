import React, { useState, useEffect } from 'react';
import {
  Database,
  Server,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  HelpCircle,
  Globe,
  Archive,
  Download,
  Trash2,
  ShieldCheck,
  Clock,
  FilePlus2,
  ScrollText,
  FileDown,
} from 'lucide-react';
import type { ServerBackupInfo, ServerBackupSettings, AuditRecord, AuditSummary } from '../types';
import { StorageService } from '../services/storage';

interface DbConfig {
  engine: 'sqlite' | 'mysql';
  sqlitePath?: string;
  mysql?: {
    host: string;
    port: number;
    user: string;
    database: string;
    ssl?: boolean;
    hasPassword?: boolean;
  };
}

interface DbStats {
  engine: string;
  sqlitePath: string;
  sqliteSizeKB: number;
  totalEquipments: number;
  totalLocations: number;
  totalExecutions: number;
  totalPlans: number;
  totalUsers: number;
}

export const DatabaseSettings: React.FC = () => {
  const [config, setConfig] = useState<DbConfig | null>(null);
  const [stats, setStats] = useState<DbStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Formulario MySQL
  const [selectedEngine, setSelectedEngine] = useState<'sqlite' | 'mysql'>('sqlite');
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState(3306);
  const [user, setUser] = useState('root');
  const [password, setPassword] = useState('');
  const [database, setDatabase] = useState('fcbv_maintenance');
  const [ssl, setSsl] = useState(false);

  // Estados de acciones
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<any | null>(null);

  // Copias de seguridad del servidor
  const [backups, setBackups] = useState<ServerBackupInfo[]>([]);
  const [backupSettings, setBackupSettings] = useState<ServerBackupSettings | null>(null);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [backupMessage, setBackupMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Bitácora de auditoría
  const [auditRecords, setAuditRecords] = useState<AuditRecord[]>([]);
  const [auditSummary, setAuditSummary] = useState<AuditSummary | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilters, setAuditFilters] = useState({
    action: '',
    username: '',
    entity: '',
    from: '',
    to: '',
  });

  const token = localStorage.getItem('fcbv_token');

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/database/config', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setConfig(data.config);
        setStats(data.stats);
        setSelectedEngine(data.config.engine || 'sqlite');
        if (data.config.mysql) {
          setHost(data.config.mysql.host || 'localhost');
          setPort(data.config.mysql.port || 3306);
          setUser(data.config.mysql.user || 'root');
          setDatabase(data.config.mysql.database || 'fcbv_maintenance');
          setSsl(Boolean(data.config.mysql.ssl));
        }
      }
    } catch (err) {
      console.error('Error fetching database config:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchBackups();
    fetchAudit();
  }, []);

  const fetchBackups = async () => {
    try {
      setBackupsLoading(true);
      const { backups: list, settings } = await StorageService.listServerBackups();
      setBackups(list);
      setBackupSettings(settings);
    } catch (err) {
      console.error('Error fetching backups:', err);
    } finally {
      setBackupsLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    setCreatingBackup(true);
    setBackupMessage(null);
    try {
      const backup = await StorageService.createServerBackup('manual');
      setBackupMessage({ type: 'success', text: `Copia creada: ${backup.filename}` });
      await fetchBackups();
    } catch (err: any) {
      setBackupMessage({ type: 'error', text: err.message || 'No se pudo crear la copia.' });
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleDownloadBackup = async (filename: string) => {
    setBackupMessage(null);
    try {
      await StorageService.downloadServerBackup(filename);
    } catch (err: any) {
      setBackupMessage({ type: 'error', text: err.message || 'No se pudo descargar la copia.' });
    }
  };

  const handleDeleteBackup = async (filename: string) => {
    if (!confirm(`¿Eliminar la copia de seguridad "${filename}"? Esta acción no se puede deshacer.`)) return;
    setBackupMessage(null);
    try {
      await StorageService.deleteServerBackup(filename);
      setBackupMessage({ type: 'success', text: 'Copia eliminada.' });
      await fetchBackups();
    } catch (err: any) {
      setBackupMessage({ type: 'error', text: err.message || 'No se pudo eliminar la copia.' });
    }
  };

  const formatBackupDate = (iso: string) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const formatAuditDate = (iso: string) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'medium' });
  };

  const fetchAudit = async () => {
    try {
      setAuditLoading(true);
      const { records, summary } = await StorageService.listAudit(auditFilters);
      setAuditRecords(records);
      setAuditSummary(summary);
    } catch (err) {
      console.error('Error fetching audit log:', err);
    } finally {
      setAuditLoading(false);
    }
  };

  const handleExportAudit = async (format: 'json' | 'csv') => {
    try {
      await StorageService.downloadAudit(format, auditFilters);
    } catch (err: any) {
      console.error('Error exporting audit log:', err);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/database/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ host, port, user, password, database, ssl }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Error al conectar' });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    setSaveMessage(null);
    try {
      const res = await fetch('/api/database/save-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          engine: selectedEngine,
          mysqlConfig: { host, port, user, password, database, ssl },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveMessage({ type: 'success', text: 'Configuración actualizada correctamente.' });
        fetchConfig();
      } else {
        setSaveMessage({ type: 'error', text: data.error || 'Error al guardar.' });
      }
    } catch (err: any) {
      setSaveMessage({ type: 'error', text: err.message || 'Error al procesar la solicitud.' });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleMigrate = async () => {
    if (
      !confirm(
        '¿Deseas iniciar la migración completa de los datos desde SQLite hacia MySQL? Se crearán las tablas e insertarán todos los registros.'
      )
    ) {
      return;
    }

    setMigrating(true);
    setMigrationResult(null);
    try {
      const res = await fetch('/api/database/migrate-to-mysql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ host, port, user, password, database, ssl }),
      });
      const data = await res.json();
      setMigrationResult(data);
      if (data.success) {
        fetchConfig();
      }
    } catch (err: any) {
      setMigrationResult({ success: false, message: err.message || 'Fallo durante la migración' });
    } finally {
      setMigrating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500 gap-3">
        <RefreshCw className="w-5 h-5 animate-spin text-indigo-600" />
        <span>Cargando configuración de la base de datos...</span>
      </div>
    );
  }

  const activeEngine = config?.engine || 'sqlite';

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Encabezado Principal */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 shadow-sm">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Motor de Base de Datos y Persistencia</h2>
              <p className="text-sm text-slate-500">
                Gestione el almacenamiento centralizado del servidor: SQLite embebido o Servidor MySQL remoto.
              </p>
            </div>
          </div>
        </div>

        {/* Estado actual del motor */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Motor Activo:</span>
          <span className="text-sm font-bold text-slate-800 uppercase px-2 py-0.5 rounded bg-white border border-slate-200">
            {activeEngine}
          </span>
        </div>
      </div>

      {/* Tarjetas de Estadísticas en el Servidor */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Equipos Críticos</span>
          <p className="text-2xl font-bold text-slate-800 mt-1">{stats?.totalEquipments || 0}</p>
          <span className="text-xs text-emerald-600 font-medium">En base de datos</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Ubicaciones del Campus</span>
          <p className="text-2xl font-bold text-slate-800 mt-1">{stats?.totalLocations || 0}</p>
          <span className="text-xs text-indigo-600 font-medium">Catálogo físico</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Mantenimientos Ejecutados</span>
          <p className="text-2xl font-bold text-slate-800 mt-1">{stats?.totalExecutions || 0}</p>
          <span className="text-xs text-blue-600 font-medium">Con firmas y actas</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Planes Anuales</span>
          <p className="text-2xl font-bold text-slate-800 mt-1">{stats?.totalPlans || 0}</p>
          <span className="text-xs text-amber-600 font-medium">Cronogramas</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs col-span-2 md:col-span-1">
          <span className="text-xs text-slate-500 font-medium">Peso Archivo SQLite</span>
          <p className="text-2xl font-bold text-slate-800 mt-1">{stats?.sqliteSizeKB || 0} KB</p>
          <span className="text-xs text-slate-400 font-mono truncate block" title={stats?.sqlitePath}>
            database.sqlite
          </span>
        </div>
      </div>

      {/* Selector de Arquitectura */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Opción 1: SQLite */}
        <div
          onClick={() => setSelectedEngine('sqlite')}
          className={`cursor-pointer rounded-2xl p-6 border transition-all ${
            selectedEngine === 'sqlite'
              ? 'bg-indigo-50/40 border-indigo-500 ring-2 ring-indigo-500/20 shadow-md'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  SQLite (Base Local en Servidor)
                  {activeEngine === 'sqlite' && (
                    <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">
                      Activo
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Almacenamiento ACID nativo con cero configuración y alta velocidad.
                </p>
              </div>
            </div>
            <input
              type="radio"
              name="engine"
              checked={selectedEngine === 'sqlite'}
              onChange={() => setSelectedEngine('sqlite')}
              className="mt-1 text-indigo-600 focus:ring-indigo-500"
            />
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-600 space-y-2">
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Ubicación del archivo:</span>
              <span className="font-mono text-slate-700 text-[11px] truncate max-w-xs">
                {stats?.sqlitePath}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Rendimiento:</span>
              <span className="font-semibold text-emerald-600">Sub-milisegundo (In-Process)</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Mantenimiento:</span>
              <span className="font-medium text-slate-700">Respaldos JSON y copias de archivo directo</span>
            </div>
          </div>
        </div>

        {/* Opción 2: MySQL */}
        <div
          onClick={() => setSelectedEngine('mysql')}
          className={`cursor-pointer rounded-2xl p-6 border transition-all ${
            selectedEngine === 'mysql'
              ? 'bg-indigo-50/40 border-indigo-500 ring-2 ring-indigo-500/20 shadow-md'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  MySQL Server / MariaDB
                  {activeEngine === 'mysql' && (
                    <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">
                      Activo
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Conexión a servidor corporativo centralizado (AWS RDS, Cloud SQL, Servidor Físico).
                </p>
              </div>
            </div>
            <input
              type="radio"
              name="engine"
              checked={selectedEngine === 'mysql'}
              onChange={() => setSelectedEngine('mysql')}
              className="mt-1 text-indigo-600 focus:ring-indigo-500"
            />
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-600 space-y-2">
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Concurrencia:</span>
              <span className="font-semibold text-indigo-600">Escalable a múltiples instancias</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Seguridad:</span>
              <span className="font-medium text-slate-700">SSL/TLS y control de accesos por IP</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Estado de migración:</span>
              <span className="font-medium text-amber-600">Listo para exportar esquema y datos</span>
            </div>
          </div>
        </div>
      </div>

      {/* Formulario de Configuración de MySQL */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <Globe className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-800">Parámetros de Conexión a Servidor MySQL</h3>
          </div>
          <span className="text-xs text-slate-500 font-medium bg-slate-100 px-3 py-1 rounded-full">
            Puerto estándar: 3306
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Host o Servidor Remoto</label>
            <input
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="p. ej. 192.168.1.100 o db.colegio.edu.co"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Puerto</label>
            <input
              type="number"
              value={port}
              onChange={(e) => setPort(Number(e.target.value))}
              placeholder="3306"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Nombre de la Base de Datos</label>
            <input
              type="text"
              value={database}
              onChange={(e) => setDatabase(e.target.value)}
              placeholder="fcbv_maintenance"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Usuario de MySQL</label>
            <input
              type="text"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              placeholder="root o fcbv_user"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-3 pt-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={ssl}
                onChange={(e) => setSsl(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
              <span className="text-xs font-semibold text-slate-700">Habilitar conexión segura SSL/TLS</span>
            </label>
          </div>
        </div>

        {/* Acciones de Verificación y Guardado */}
        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testingConnection}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${testingConnection ? 'animate-spin' : ''}`} />
              {testingConnection ? 'Probando conexión...' : 'Probar Conexión MySQL'}
            </button>

            <button
              type="button"
              onClick={handleSaveConfig}
              disabled={savingConfig}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              {savingConfig ? 'Guardando...' : 'Guardar Preferencias de Motor'}
            </button>
          </div>

          {/* Botón de Migración Instantánea */}
          <button
            type="button"
            onClick={handleMigrate}
            disabled={migrating}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 shadow-xs disabled:opacity-50"
          >
            <ArrowRight className="w-4 h-4" />
            {migrating ? 'Migrando registros...' : 'Migrar SQLite a MySQL'}
          </button>
        </div>

        {/* Feedback de Prueba de Conexión */}
        {testResult && (
          <div
            className={`p-3.5 rounded-xl border flex items-center gap-2 text-xs font-medium ${
              testResult.success
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{testResult.message}</span>
          </div>
        )}

        {/* Feedback de Guardado */}
        {saveMessage && (
          <div
            className={`p-3.5 rounded-xl border flex items-center gap-2 text-xs font-medium ${
              saveMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveMessage.text}</span>
          </div>
        )}

        {/* Feedback de Migración */}
        {migrationResult && (
          <div
            className={`p-4 rounded-xl border space-y-2 ${
              migrationResult.success
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : 'bg-rose-50 text-rose-900 border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-sm">
              {migrationResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600" />
              )}
              <span>{migrationResult.message}</span>
            </div>

            {migrationResult.counts && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs">
                <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                  <span className="text-slate-500 block">Equipos:</span>
                  <span className="font-bold text-emerald-700">
                    {migrationResult.counts.equipments} registros
                  </span>
                </div>
                <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                  <span className="text-slate-500 block">Ubicaciones:</span>
                  <span className="font-bold text-emerald-700">
                    {migrationResult.counts.locations} espacios
                  </span>
                </div>
                <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                  <span className="text-slate-500 block">Ejecuciones:</span>
                  <span className="font-bold text-emerald-700">
                    {migrationResult.counts.executions} actas
                  </span>
                </div>
                <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                  <span className="text-slate-500 block">Planes:</span>
                  <span className="font-bold text-emerald-700">
                    {migrationResult.counts.annualPlans} cronogramas
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Copias de seguridad del servidor */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <Archive className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="font-bold text-slate-800">Copias de Seguridad del Servidor</h3>
              <p className="text-xs text-slate-500">
                Se crea una copia automática del archivo SQLite cada {backupSettings?.intervalHours ?? 24}{' '}
                horas y se conservan las últimas {backupSettings?.retention ?? 14}. También se genera una
                copia antes de vaciar o restaurar datos.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchBackups}
              disabled={backupsLoading}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${backupsLoading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
            <button
              type="button"
              onClick={handleCreateBackup}
              disabled={creatingBackup}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              <FilePlus2 className="w-4 h-4" />
              {creatingBackup ? 'Creando...' : 'Crear copia ahora'}
            </button>
          </div>
        </div>

        {backupSettings && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <span className="text-slate-500 block">Estado</span>
                <span className="font-semibold text-slate-800">
                  {backupSettings.enabled ? 'Activas' : 'No disponibles (BD en memoria)'}
                </span>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
              <div>
                <span className="text-slate-500 block">Frecuencia</span>
                <span className="font-semibold text-slate-800">
                  Cada {backupSettings.intervalHours} horas
                </span>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-amber-600 shrink-0" />
              <div className="min-w-0">
                <span className="text-slate-500 block">Carpeta</span>
                <span
                  className="font-mono text-[11px] text-slate-700 truncate block"
                  title={backupSettings.directory}
                >
                  {backupSettings.directory}
                </span>
              </div>
            </div>
          </div>
        )}

        {backupMessage && (
          <div
            className={`p-3.5 rounded-xl border flex items-center gap-2 text-xs font-medium ${
              backupMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {backupMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{backupMessage.text}</span>
          </div>
        )}

        {backups.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">
            {backupsLoading
              ? 'Cargando copias de seguridad...'
              : 'Todavía no hay copias de seguridad registradas.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <th className="py-2 pr-3 font-semibold">Archivo</th>
                  <th className="py-2 pr-3 font-semibold">Fecha</th>
                  <th className="py-2 pr-3 font-semibold">Tipo</th>
                  <th className="py-2 pr-3 font-semibold">Tamaño</th>
                  <th className="py-2 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((backup) => (
                  <tr key={backup.filename} className="border-b border-slate-50 last:border-0">
                    <td
                      className="py-2.5 pr-3 font-mono text-[11px] text-slate-700 max-w-[22rem] truncate"
                      title={backup.filename}
                    >
                      {backup.filename}
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-slate-600 whitespace-nowrap">
                      {formatBackupDate(backup.createdAt)}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          backup.automatic ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {backup.automatic ? 'Automática' : backup.reason}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-slate-600 whitespace-nowrap">
                      {backup.sizeKB} KB
                    </td>
                    <td className="py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleDownloadBackup(backup.filename)}
                          title="Descargar copia"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBackup(backup.filename)}
                          title="Eliminar copia"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bitácora de auditoría (trazabilidad SGC) */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <ScrollText className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="font-bold text-slate-800">Bitácora de Auditoría (SGC)</h3>
              <p className="text-xs text-slate-500">
                Registro inmutable de {auditSummary?.total ?? 0} eventos: inicios de sesión, cambios de
                usuarios, sincronización de datos, copias de seguridad y configuración.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleExportAudit('csv')}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2"
            >
              <FileDown className="w-4 h-4" />
              CSV
            </button>
            <button
              type="button"
              onClick={() => handleExportAudit('json')}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2"
            >
              <FileDown className="w-4 h-4" />
              JSON
            </button>
            <button
              type="button"
              onClick={fetchAudit}
              disabled={auditLoading}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${auditLoading ? 'animate-spin' : ''}`} />
              Consultar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Acción</label>
            <select
              value={auditFilters.action}
              onChange={(e) => setAuditFilters({ ...auditFilters, action: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Todas</option>
              {(auditSummary?.actions ?? []).map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Usuario</label>
            <select
              value={auditFilters.username}
              onChange={(e) => setAuditFilters({ ...auditFilters, username: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Todos</option>
              {(auditSummary?.usernames ?? []).map((username) => (
                <option key={username} value={username}>
                  {username}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Entidad</label>
            <input
              type="text"
              value={auditFilters.entity}
              onChange={(e) => setAuditFilters({ ...auditFilters, entity: e.target.value })}
              placeholder="p. ej. equipments"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Desde</label>
            <input
              type="date"
              value={auditFilters.from}
              onChange={(e) => setAuditFilters({ ...auditFilters, from: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Hasta</label>
            <input
              type="date"
              value={auditFilters.to}
              onChange={(e) => setAuditFilters({ ...auditFilters, to: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {auditRecords.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">
            {auditLoading ? 'Consultando bitácora...' : 'No hay eventos que coincidan con el filtro.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <th className="py-2 pr-3 font-semibold">Fecha</th>
                  <th className="py-2 pr-3 font-semibold">Usuario</th>
                  <th className="py-2 pr-3 font-semibold">Acción</th>
                  <th className="py-2 pr-3 font-semibold">Entidad</th>
                  <th className="py-2 font-semibold">Detalles</th>
                </tr>
              </thead>
              <tbody>
                {auditRecords.map((record) => (
                  <tr key={record.id} className="border-b border-slate-50 last:border-0 align-top">
                    <td className="py-2.5 pr-3 text-xs text-slate-600 whitespace-nowrap">
                      {formatAuditDate(record.timestamp)}
                    </td>
                    <td className="py-2.5 pr-3 text-xs font-semibold text-slate-700">
                      {record.username ?? 'anónimo'}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 whitespace-nowrap">
                        {record.action}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-slate-600">
                      {record.entity ?? '—'}
                      {record.entityId ? (
                        <span
                          className="block font-mono text-[10px] text-slate-400 truncate max-w-[14rem]"
                          title={record.entityId}
                        >
                          {record.entityId}
                        </span>
                      ) : null}
                    </td>
                    <td
                      className="py-2.5 text-[11px] font-mono text-slate-500 max-w-[24rem] truncate"
                      title={record.details ? JSON.stringify(record.details) : ''}
                    >
                      {record.details ? JSON.stringify(record.details) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Guía informativa de respaldo y persistencia */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-xs text-slate-600 flex items-start gap-3">
        <HelpCircle className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-slate-800">
            Garantía de Persistencia Centralizada (No dependiente de localStorage):
          </p>
          <p>
            Toda la información del Censo de Equipos, Planes Anuales, Registro de Mantenimientos, Catálogo de
            Áreas y Firmas se guarda de manera inmediata en la base de datos relacional del servidor. Si el
            usuario borra la caché del navegador o ingresa desde otro dispositivo o computadora en el colegio,
            todos los datos permanecerán íntegros y sincronizados.
          </p>
        </div>
      </div>
    </div>
  );
};
