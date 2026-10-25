import fs from 'fs';
import path from 'path';
import { sqlite, sqliteFilePath } from '../src/db/index';
import { env } from './env';

/**
 * Copias de seguridad del archivo SQLite.
 *
 * Se usa la API de respaldo en caliente de better-sqlite3, que produce un
 * archivo consistente aunque el servidor esté atendiendo peticiones.
 */

export interface BackupInfo {
  filename: string;
  sizeKB: number;
  createdAt: string;
  reason: string;
  automatic: boolean;
}

export interface BackupSettingsInfo {
  directory: string;
  retention: number;
  intervalHours: number;
  enabled: boolean;
}

const BACKUP_PREFIX = 'fcbv_backup_';
const BACKUP_EXTENSION = '.sqlite';
const BACKUP_NAME_PATTERN = /^fcbv_backup_(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})_(.+)\.sqlite$/;
const IS_MEMORY_DB = sqliteFilePath === ':memory:' || sqliteFilePath.startsWith('file:');

export class BackupUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupUnavailableError';
  }
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function timestampForFilename(date: Date): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
  );
}

function sanitizeReason(reason: string): string {
  const clean = reason
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
  return clean || 'manual';
}

export function getBackupDir(): string {
  return env.backupDir ? path.resolve(env.backupDir) : path.join(process.cwd(), 'backups');
}

function ensureBackupDir(): string {
  const dir = getBackupDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getBackupSettings(): BackupSettingsInfo {
  return {
    directory: getBackupDir(),
    retention: env.backupRetention,
    intervalHours: env.backupIntervalHours,
    enabled: !IS_MEMORY_DB,
  };
}

export function listBackups(): BackupInfo[] {
  const dir = getBackupDir();
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .map((filename) => {
      const match = BACKUP_NAME_PATTERN.exec(filename);
      if (!match) return null;

      const stats = fs.statSync(path.join(dir, filename));
      const [, datePart, timePart, reason] = match;
      const createdAt = new Date(`${datePart}T${timePart.replace(/-/g, ':')}`);

      return {
        filename,
        sizeKB: Math.max(1, Math.round(stats.size / 1024)),
        // Si la fecha del nombre no fuese válida, se usa la del sistema de archivos.
        createdAt: Number.isNaN(createdAt.getTime()) ? stats.mtime.toISOString() : createdAt.toISOString(),
        reason,
        automatic: reason === 'automatico',
      };
    })
    .filter((backup): backup is BackupInfo => backup !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function pruneBackups(retention: number = env.backupRetention): string[] {
  const backups = listBackups();
  const removed: string[] = [];

  for (const backup of backups.slice(retention)) {
    try {
      fs.unlinkSync(path.join(getBackupDir(), backup.filename));
      removed.push(backup.filename);
    } catch (error) {
      console.error(`[Backup] No se pudo eliminar ${backup.filename}:`, error);
    }
  }

  return removed;
}

export async function createBackup(reason: string = 'manual'): Promise<BackupInfo> {
  if (IS_MEMORY_DB) {
    throw new BackupUnavailableError(
      'Las copias de seguridad no están disponibles cuando la base de datos está en memoria.'
    );
  }

  const dir = ensureBackupDir();
  const baseName = `${BACKUP_PREFIX}${timestampForFilename(new Date())}_${sanitizeReason(reason)}`;

  // Evita sobrescribir si se crean dos copias en el mismo segundo.
  let filename = `${baseName}${BACKUP_EXTENSION}`;
  let suffix = 1;
  while (fs.existsSync(path.join(dir, filename))) {
    filename = `${baseName}-${suffix}${BACKUP_EXTENSION}`;
    suffix += 1;
  }

  const destination = path.join(dir, filename);
  await sqlite.backup(destination);

  pruneBackups();

  const stats = fs.statSync(destination);
  return {
    filename,
    sizeKB: Math.max(1, Math.round(stats.size / 1024)),
    createdAt: new Date().toISOString(),
    reason: sanitizeReason(reason),
    automatic: false,
  };
}

/**
 * Devuelve la ruta absoluta de una copia, validando que el nombre no permita
 * salir del directorio de respaldos.
 */
export function resolveBackupPath(filename: string): string | null {
  if (!BACKUP_NAME_PATTERN.test(filename)) return null;

  const dir = path.resolve(getBackupDir());
  const fullPath = path.resolve(dir, filename);

  if (path.dirname(fullPath) !== dir) return null;
  if (!fs.existsSync(fullPath)) return null;

  return fullPath;
}

export function deleteBackup(filename: string): boolean {
  const fullPath = resolveBackupPath(filename);
  if (!fullPath) return false;
  fs.unlinkSync(fullPath);
  return true;
}

let backupTimer: NodeJS.Timeout | null = null;
let checkRunning = false;

/**
 * Programa copias automáticas cada `BACKUP_INTERVAL_HOURS`.
 *
 * La comprobación se hace cada hora (o con el intervalo configurado si es
 * menor) para que un reinicio no retrase indefinidamente la siguiente copia.
 */
export function startAutomaticBackups(): void {
  if (IS_MEMORY_DB) {
    console.log('[Backup] Base de datos en memoria: copias automáticas desactivadas.');
    return;
  }
  if (backupTimer) return;

  const intervalMs = env.backupIntervalHours * 60 * 60 * 1000;
  const tickMs = Math.min(intervalMs, 60 * 60 * 1000);

  const runCheck = async () => {
    if (checkRunning) return;
    checkRunning = true;
    try {
      const [latest] = listBackups();
      const lastTime = latest ? new Date(latest.createdAt).getTime() : 0;
      if (!latest || Date.now() - lastTime >= intervalMs) {
        const backup = await createBackup('automatico');
        console.log(`[Backup] Copia automática creada: ${backup.filename} (${backup.sizeKB} KB)`);
      }
      pruneBackups();
    } catch (error) {
      console.error('[Backup] Error al crear la copia automática:', error);
    } finally {
      checkRunning = false;
    }
  };

  void runCheck();
  backupTimer = setInterval(runCheck, tickMs);
  // No impide que el proceso termine (por ejemplo, en pruebas o al apagar PM2).
  backupTimer.unref?.();
}

export function stopAutomaticBackups(): void {
  if (backupTimer) {
    clearInterval(backupTimer);
    backupTimer = null;
  }
}
