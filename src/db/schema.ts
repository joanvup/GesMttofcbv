import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull()
});

export const buildings = sqliteTable('buildings', {
  name: text('name').primaryKey()
});

export const locations = sqliteTable('locations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  building: text('building').notNull(),
  areaType: text('area_type').notNull(),
  description: text('description'),
  status: text('status').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
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
  updatedAt: text('updated_at').notNull()
});

export const annualPlans = sqliteTable('annual_plans', {
  id: text('id').primaryKey(),
  equipmentId: text('equipment_id').notNull(),
  year: integer('year').notNull(),
  schedules: text('schedules').notNull() // JSON string array of 12 booleans
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
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull()
});
