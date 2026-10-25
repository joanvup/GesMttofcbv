import crypto from 'crypto';
import { sqlite } from './index';

/**
 * Migraciones versionadas.
 *
 * Cada migración se aplica una sola vez y queda registrada en
 * `schema_migrations`, junto con un checksum que permite detectar cambios
 * posteriores en migraciones ya aplicadas.
 *
 * Las migraciones iniciales usan `IF NOT EXISTS` a propósito: así una base de
 * datos creada por versiones anteriores (sin tabla de migraciones) se marca
 * como al día sin riesgo de perder datos.
 */

interface Migration {
  id: string;
  description: string;
  sql: string;
}

const MIGRATIONS: Migration[] = [
  {
    id: '0001_initial',
    description: 'Esquema inicial (usuarios, equipos, planes, ejecuciones, sedes)',
    sql: `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS buildings (
  name TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  building TEXT NOT NULL,
  area_type TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS equipments (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  serial TEXT NOT NULL,
  parts TEXT NOT NULL,
  maintenance_tasks TEXT NOT NULL,
  frequency TEXT NOT NULL,
  custom_months TEXT,
  status TEXT NOT NULL,
  observations TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS annual_plans (
  id TEXT PRIMARY KEY,
  equipment_id TEXT NOT NULL,
  year INTEGER NOT NULL,
  schedules TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS executions (
  id TEXT PRIMARY KEY,
  equipment_id TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  scheduled_date TEXT,
  is_executed INTEGER NOT NULL,
  executed_date TEXT,
  responsible_name TEXT,
  responsible_role TEXT,
  signature_data_url TEXT,
  completed_tasks TEXT NOT NULL,
  parts_replaced TEXT,
  observations TEXT,
  maintenance_type TEXT,
  failure_description TEXT,
  action_taken TEXT,
  downtime_hours INTEGER,
  final_operational_status TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_executions_equipment ON executions (equipment_id, year, month);
CREATE INDEX IF NOT EXISTS idx_annual_plans_year ON annual_plans (year);
`,
  },
  {
    id: '0002_entity_revisions',
    description: 'Revisiones por entidad para el bloqueo optimista',
    sql: `
CREATE TABLE IF NOT EXISTS entity_revisions (
  entity TEXT PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);
`,
  },
  {
    id: '0003_audit_log',
    description: 'Bitácora de auditoría para trazabilidad SGC',
    sql: `
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  user_id TEXT,
  username TEXT,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  details TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log (timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log (entity);
CREATE INDEX IF NOT EXISTS idx_audit_username ON audit_log (username);
`,
  },
];

function checksum(sql: string): string {
  return crypto.createHash('sha256').update(sql).digest('hex').slice(0, 16);
}

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

/**
 * Aplica las migraciones pendientes dentro de una transacción por migración.
 * Es idempotente: puede llamarse en cada arranque sin efectos secundarios.
 */
export function runMigrations(): MigrationResult {
  sqlite.exec(`
CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  checksum TEXT NOT NULL,
  applied_at TEXT NOT NULL
);
`);

  const rows = sqlite.prepare('SELECT id, checksum FROM schema_migrations').all() as Array<{
    id: string;
    checksum: string;
  }>;
  const appliedIds = new Map(rows.map((row) => [row.id, row.checksum]));

  const insertMigration = sqlite.prepare(
    'INSERT INTO schema_migrations (id, description, checksum, applied_at) VALUES (?, ?, ?, ?)'
  );

  const applied: string[] = [];
  const skipped: string[] = [];

  for (const migration of MIGRATIONS) {
    const previousChecksum = appliedIds.get(migration.id);

    if (previousChecksum !== undefined) {
      skipped.push(migration.id);
      if (previousChecksum !== checksum(migration.sql)) {
        console.warn(
          `[Migraciones] La migración ${migration.id} cambió después de aplicarse. ` +
            'Cree una migración nueva en lugar de editar una existente.'
        );
      }
      continue;
    }

    const apply = sqlite.transaction(() => {
      sqlite.exec(migration.sql);
      insertMigration.run(
        migration.id,
        migration.description,
        checksum(migration.sql),
        new Date().toISOString()
      );
    });

    apply();
    applied.push(migration.id);
    console.log(`[Migraciones] Aplicada ${migration.id}: ${migration.description}`);
  }

  return { applied, skipped };
}

// Alias heredado: el arranque previo llamaba a `ensureSchema`.
export const ensureSchema = runMigrations;
