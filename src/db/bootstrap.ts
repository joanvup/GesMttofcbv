import { sqlite } from './index';

/**
 * Crea el esquema base si no existe.
 *
 * Es idempotente y sirve como red de seguridad para instalaciones nuevas o
 * restauraciones, sin depender de que `drizzle-kit push` se haya ejecutado.
 * En la Fase 3 será reemplazado por migraciones versionadas.
 */
const SCHEMA_SQL = `
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

CREATE TABLE IF NOT EXISTS entity_revisions (
  entity TEXT PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_executions_equipment ON executions (equipment_id, year, month);
CREATE INDEX IF NOT EXISTS idx_annual_plans_year ON annual_plans (year);
`;

export function ensureSchema(): void {
  sqlite.exec(SCHEMA_SQL);
}
