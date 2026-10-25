import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull(),
});

export const buildings = sqliteTable('buildings', {
  name: text('name').primaryKey(),
});

export const locations = sqliteTable('locations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  building: text('building').notNull(),
  areaType: text('area_type').notNull(),
  description: text('description'),
  status: text('status').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const equipments = sqliteTable('equipments', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  location: text('location').notNull(),
  brand: text('brand').notNull(),
  model: text('model').notNull(),
  serial: text('serial').notNull(),
  parts: text('parts').notNull(), // JSON string array
  maintenanceTasks: text('maintenance_tasks').notNull(), // JSON string array
  frequency: text('frequency').notNull(),
  customMonths: text('custom_months'), // JSON number array
  status: text('status').notNull(),
  observations: text('observations'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const annualPlans = sqliteTable('annual_plans', {
  id: text('id').primaryKey(),
  equipmentId: text('equipment_id').notNull(),
  year: integer('year').notNull(),
  schedules: text('schedules').notNull(), // JSON string array of 12 booleans
});

export const executions = sqliteTable('executions', {
  id: text('id').primaryKey(),
  equipmentId: text('equipment_id').notNull(),
  year: integer('year').notNull(),
  month: integer('month').notNull(),
  scheduledDate: text('scheduled_date'),
  isExecuted: integer('is_executed', { mode: 'boolean' }).notNull(),
  executedDate: text('executed_date'),
  responsibleName: text('responsible_name'),
  responsibleRole: text('responsible_role'),
  signatureDataUrl: text('signature_data_url'),
  completedTasks: text('completed_tasks').notNull(), // JSON string array
  partsReplaced: text('parts_replaced'), // JSON string array
  observations: text('observations'),
  maintenanceType: text('maintenance_type'),
  failureDescription: text('failure_description'),
  actionTaken: text('action_taken'),
  downtimeHours: integer('downtime_hours'),
  finalOperationalStatus: text('final_operational_status'),
  // Ciclo de vida SGC del acta (gestionado por el servidor)
  recordStatus: text('record_status').notNull().default('borrador'),
  recordVersion: integer('record_version').notNull().default(1),
  approvedBy: text('approved_by'),
  approvedAt: text('approved_at'),
  closedBy: text('closed_by'),
  closedAt: text('closed_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

// Revisión por entidad sincronizada: base del bloqueo optimista.
// Cada escritura incrementa el contador y el cliente debe enviar la revisión
// que leyó; si no coincide, la API responde 409 en lugar de sobrescribir.
export const entityRevisions = sqliteTable('entity_revisions', {
  entity: text('entity').primaryKey(),
  revision: integer('revision').notNull().default(0),
  updatedAt: text('updated_at').notNull(),
  updatedBy: text('updated_by'),
});

// Bitácora de auditoría (trazabilidad SGC).
// Es inmutable desde la aplicación: solo se insertan filas, nunca se editan
// ni se eliminan por API. Registra quién hizo qué y sobre qué entidad.
export const auditLog = sqliteTable('audit_log', {
  id: text('id').primaryKey(),
  timestamp: text('timestamp').notNull(),
  userId: text('user_id'),
  username: text('username'),
  action: text('action').notNull(),
  entity: text('entity'),
  entityId: text('entity_id'),
  details: text('details'), // JSON
});
