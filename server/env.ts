import 'dotenv/config';

/**
 * Validación centralizada de variables de entorno.
 *
 * Falla rápido y con un mensaje claro si la configuración es inválida,
 * en lugar de arrancar con valores por defecto inseguros.
 */

export interface ServerEnv {
  nodeEnv: 'development' | 'test' | 'production';
  isProduction: boolean;
  isTest: boolean;
  isCloudRun: boolean;
  port: number;
  jwtSecret: string;
  geminiApiKey?: string;
  initialAdminPassword?: string;
  initialRevisorPassword?: string;
  dbEngine: 'sqlite' | 'mysql';
  sqlitePath?: string;
  backupDir?: string;
  backupRetention: number;
  backupIntervalHours: number;
}

const MIN_JWT_SECRET_LENGTH = 32;
const MIN_INITIAL_PASSWORD_LENGTH = 12;

function parsePort(raw: string | undefined, errors: string[]): number {
  if (raw === undefined || raw.trim() === '') return 3000;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    errors.push(`PORT debe ser un número entero entre 1 y 65535 (valor recibido: "${raw}").`);
    return 3000;
  }
  return value;
}

function parseNodeEnv(raw: string | undefined, errors: string[]): ServerEnv['nodeEnv'] {
  const value = (raw || 'development').trim();
  if (value === 'development' || value === 'test' || value === 'production') return value;
  errors.push(`NODE_ENV debe ser "development", "test" o "production" (valor recibido: "${value}").`);
  return 'development';
}

function parseDbEngine(raw: string | undefined, errors: string[]): ServerEnv['dbEngine'] {
  const value = (raw || 'sqlite').trim().toLowerCase();
  if (value === 'sqlite' || value === 'mysql') return value;
  errors.push(`DB_ENGINE debe ser "sqlite" o "mysql" (valor recibido: "${value}").`);
  return 'sqlite';
}

function parsePositiveInt(
  name: string,
  raw: string | undefined,
  fallback: number,
  errors: string[],
  max = 10000
): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > max) {
    errors.push(`${name} debe ser un número entero entre 1 y ${max} (valor recibido: "${raw}").`);
    return fallback;
  }
  return value;
}

function optionalPassword(name: string, raw: string | undefined, errors: string[]): string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  if (value.length < MIN_INITIAL_PASSWORD_LENGTH) {
    errors.push(`${name} debe tener al menos ${MIN_INITIAL_PASSWORD_LENGTH} caracteres si se define.`);
  }
  return value;
}

/**
 * Construye y valida la configuración del servidor.
 * Lanza un error con todos los problemas encontrados para corregirlos de una vez.
 */
export function loadServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  const errors: string[] = [];

  const nodeEnv = parseNodeEnv(source.NODE_ENV, errors);
  const isCloudRun = Boolean(source.K_SERVICE);
  const port = isCloudRun ? 3000 : parsePort(source.PORT, errors);

  const jwtSecret = source.JWT_SECRET?.trim();
  if (!jwtSecret) {
    errors.push(
      "JWT_SECRET es obligatorio. Genere uno con: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  } else if (jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
    errors.push(
      `JWT_SECRET debe tener al menos ${MIN_JWT_SECRET_LENGTH} caracteres (actual: ${jwtSecret.length}).`
    );
  }

  const geminiApiKey = source.GEMINI_API_KEY?.trim() || undefined;
  const initialAdminPassword = optionalPassword(
    'INITIAL_ADMIN_PASSWORD',
    source.INITIAL_ADMIN_PASSWORD,
    errors
  );
  const initialRevisorPassword = optionalPassword(
    'INITIAL_REVISOR_PASSWORD',
    source.INITIAL_REVISOR_PASSWORD,
    errors
  );
  const dbEngine = parseDbEngine(source.DB_ENGINE, errors);
  const sqlitePath = source.SQLITE_PATH?.trim() || undefined;
  const backupDir = source.BACKUP_DIR?.trim() || undefined;
  const backupRetention = parsePositiveInt('BACKUP_RETENTION', source.BACKUP_RETENTION, 14, errors, 365);
  const backupIntervalHours = parsePositiveInt(
    'BACKUP_INTERVAL_HOURS',
    source.BACKUP_INTERVAL_HOURS,
    24,
    errors,
    720
  );

  if (errors.length > 0) {
    throw new Error(['Configuración de entorno inválida:', ...errors.map((e) => ` - ${e}`)].join('\n'));
  }

  return {
    nodeEnv,
    isProduction: nodeEnv === 'production',
    isTest: nodeEnv === 'test',
    isCloudRun,
    port,
    jwtSecret: jwtSecret as string,
    geminiApiKey,
    initialAdminPassword,
    initialRevisorPassword,
    dbEngine,
    sqlitePath,
    backupDir,
    backupRetention,
    backupIntervalHours,
  };
}

function loadOrExit(): ServerEnv {
  try {
    return loadServerEnv();
  } catch (error) {
    console.error(`[FATAL] ${(error as Error).message}`);
    console.error('Revise el archivo .env (puede tomar .env.example como base).');
    process.exit(1);
  }
}

export const env: ServerEnv = loadOrExit();
