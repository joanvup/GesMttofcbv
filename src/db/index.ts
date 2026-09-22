import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import mysql from 'mysql2/promise';
import * as schema from './schema';

export interface DatabaseConfig {
  engine: 'sqlite' | 'mysql';
  sqlitePath?: string;
  mysql?: {
    host: string;
    port: number;
    user: string;
    password?: string;
    database: string;
    ssl?: boolean;
  };
}

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

export const sqliteFilePath = path.join(uploadsDir, 'database.sqlite');
const configFilePath = path.join(uploadsDir, 'db-config.json');

// Cargar o crear configuración predeterminada (SQLite por defecto)
export function getDbConfig(): DatabaseConfig {
  if (fs.existsSync(configFilePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(configFilePath, 'utf-8'));
      return parsed;
    } catch (e) {
      console.error('Error al leer db-config.json, usando SQLite:', e);
    }
  }
  return {
    engine: 'sqlite',
    sqlitePath: sqliteFilePath
  };
}

export function saveDbConfig(newConfig: DatabaseConfig) {
  fs.writeFileSync(configFilePath, JSON.stringify(newConfig, null, 2), 'utf-8');
}

// SQLite principal
export const sqlite = new Database(sqliteFilePath);
export const db = drizzle(sqlite, { schema });

// Función para probar conectividad MySQL
export async function testMysqlConnection(cfg: {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
  ssl?: boolean;
}): Promise<{ success: boolean; message: string; version?: string }> {
  try {
    const connection = await mysql.createConnection({
      host: cfg.host,
      port: cfg.port || 3306,
      user: cfg.user,
      password: cfg.password || '',
      database: cfg.database,
      ssl: cfg.ssl ? { rejectUnauthorized: false } : undefined,
      connectTimeout: 8000
    });

    const [rows]: any = await connection.query('SELECT VERSION() as version');
    const version = rows && rows[0] ? rows[0].version : 'MySQL Compatible';
    await connection.end();
    return { success: true, message: 'Conexión a MySQL establecida exitosamente.', version };
  } catch (err: any) {
    return { success: false, message: err.message || 'Fallo de conexión a MySQL' };
  }
}

// Función para migrar todo el contenido de SQLite a MySQL
export async function migrateSqliteToMysql(cfg: {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
  ssl?: boolean;
}): Promise<{
  success: boolean;
  message: string;
  counts?: {
    users: number;
    buildings: number;
    locations: number;
    equipments: number;
    annualPlans: number;
    executions: number;
    settings: number;
  };
}> {
  let connection: mysql.Connection | null = null;
  try {
    connection = await mysql.createConnection({
      host: cfg.host,
      port: cfg.port || 3306,
      user: cfg.user,
      password: cfg.password || '',
      database: cfg.database,
      ssl: cfg.ssl ? { rejectUnauthorized: false } : undefined,
      multipleStatements: true,
      connectTimeout: 10000
    });

    // 1. Crear tablas en MySQL si no existen
    const ddl = `
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(100) PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(150) NOT NULL,
        role VARCHAR(50) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

      CREATE TABLE IF NOT EXISTS buildings (
        name VARCHAR(150) PRIMARY KEY
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

      CREATE TABLE IF NOT EXISTS locations (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        building VARCHAR(150) NOT NULL,
        area_type VARCHAR(50) NOT NULL,
        description TEXT,
        status VARCHAR(50) NOT NULL,
        created_at VARCHAR(50) NOT NULL,
        updated_at VARCHAR(50) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

      CREATE TABLE IF NOT EXISTS equipments (
        id VARCHAR(100) PRIMARY KEY,
        code VARCHAR(100) NOT NULL UNIQUE,
        name VARCHAR(200) NOT NULL,
        location VARCHAR(150) NOT NULL,
        brand VARCHAR(100) NOT NULL,
        model VARCHAR(100) NOT NULL,
        serial VARCHAR(100) NOT NULL,
        parts LONGTEXT NOT NULL,
        maintenance_tasks LONGTEXT NOT NULL,
        frequency VARCHAR(50) NOT NULL,
        custom_months TEXT,
        status VARCHAR(50) NOT NULL,
        observations TEXT,
        created_at VARCHAR(50) NOT NULL,
        updated_at VARCHAR(50) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

      CREATE TABLE IF NOT EXISTS annual_plans (
        id VARCHAR(150) PRIMARY KEY,
        equipment_id VARCHAR(100) NOT NULL,
        year INT NOT NULL,
        schedules LONGTEXT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

      CREATE TABLE IF NOT EXISTS executions (
        id VARCHAR(100) PRIMARY KEY,
        equipment_id VARCHAR(100) NOT NULL,
        year INT NOT NULL,
        month INT NOT NULL,
        scheduled_date VARCHAR(50),
        is_executed TINYINT(1) NOT NULL,
        executed_date VARCHAR(50),
        responsible_name VARCHAR(150),
        responsible_role VARCHAR(150),
        signature_data_url LONGTEXT,
        completed_tasks LONGTEXT NOT NULL,
        parts_replaced LONGTEXT,
        observations TEXT,
        maintenance_type VARCHAR(50) DEFAULT 'preventivo',
        failure_description TEXT,
        action_taken TEXT,
        downtime_hours INT,
        final_operational_status VARCHAR(50),
        created_at VARCHAR(50) NOT NULL,
        updated_at VARCHAR(50) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

      CREATE TABLE IF NOT EXISTS settings (
        \`key\` VARCHAR(100) PRIMARY KEY,
        value LONGTEXT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;

    await connection.query(ddl);

    // 2. Extraer datos actuales de SQLite
    const allUsers = db.select().from(schema.users).all();
    const allBuildings = db.select().from(schema.buildings).all();
    const allLocations = db.select().from(schema.locations).all();
    const allEquipments = db.select().from(schema.equipments).all();
    const allPlans = db.select().from(schema.annualPlans).all();
    const allExecutions = db.select().from(schema.executions).all();
    const allSettings = db.select().from(schema.settings).all();

    // 3. Limpiar e insertar en MySQL
    await connection.query('SET FOREIGN_KEY_CHECKS = 0;');
    await connection.query('TRUNCATE TABLE users; TRUNCATE TABLE buildings; TRUNCATE TABLE locations; TRUNCATE TABLE equipments; TRUNCATE TABLE annual_plans; TRUNCATE TABLE executions; TRUNCATE TABLE settings;');
    await connection.query('SET FOREIGN_KEY_CHECKS = 1;');

    for (const u of allUsers) {
      await connection.query(
        'INSERT INTO users (id, username, password_hash, name, role) VALUES (?, ?, ?, ?, ?)',
        [u.id, u.username, u.passwordHash, u.name, u.role]
      );
    }

    for (const b of allBuildings) {
      await connection.query(
        'INSERT INTO buildings (name) VALUES (?)',
        [b.name]
      );
    }

    for (const l of allLocations) {
      await connection.query(
        'INSERT INTO locations (id, name, building, area_type, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [l.id, l.name, l.building, l.areaType, l.description, l.status, l.createdAt, l.updatedAt]
      );
    }

    for (const eq of allEquipments) {
      await connection.query(
        'INSERT INTO equipments (id, code, name, location, brand, model, serial, parts, maintenance_tasks, frequency, custom_months, status, observations, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [eq.id, eq.code, eq.name, eq.location, eq.brand, eq.model, eq.serial, eq.parts, eq.maintenanceTasks, eq.frequency, eq.customMonths, eq.status, eq.observations, eq.createdAt, eq.updatedAt]
      );
    }

    for (const p of allPlans) {
      await connection.query(
        'INSERT INTO annual_plans (id, equipment_id, year, schedules) VALUES (?, ?, ?, ?)',
        [p.id, p.equipmentId, p.year, p.schedules]
      );
    }

    for (const ex of allExecutions) {
      await connection.query(
        'INSERT INTO executions (id, equipment_id, year, month, scheduled_date, is_executed, executed_date, responsible_name, responsible_role, signature_data_url, completed_tasks, parts_replaced, observations, maintenance_type, failure_description, action_taken, downtime_hours, final_operational_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [ex.id, ex.equipmentId, ex.year, ex.month, ex.scheduledDate, ex.isExecuted ? 1 : 0, ex.executedDate, ex.responsibleName, ex.responsibleRole, ex.signatureDataUrl, ex.completedTasks, ex.partsReplaced, ex.observations, ex.maintenanceType || 'preventivo', ex.failureDescription || null, ex.actionTaken || null, ex.downtimeHours || null, ex.finalOperationalStatus || null, ex.createdAt, ex.updatedAt]
      );
    }

    for (const s of allSettings) {
      await connection.query(
        'INSERT INTO settings (\`key\`, value) VALUES (?, ?)',
        [s.key, s.value]
      );
    }

    await connection.end();

    return {
      success: true,
      message: 'Migración a MySQL completada con éxito.',
      counts: {
        users: allUsers.length,
        buildings: allBuildings.length,
        locations: allLocations.length,
        equipments: allEquipments.length,
        annualPlans: allPlans.length,
        executions: allExecutions.length,
        settings: allSettings.length
      }
    };
  } catch (err: any) {
    if (connection) {
      try { await connection.end(); } catch (e) {}
    }
    return {
      success: false,
      message: err.message || 'Error durante la migración hacia MySQL'
    };
  }
}
