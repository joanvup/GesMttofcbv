import crypto from 'crypto';
import { and, desc, gte, lte, eq } from 'drizzle-orm';
import { db } from '../src/db/index';
import { auditLog } from '../src/db/schema';

/**
 * Bitácora de auditoría (trazabilidad SGC).
 *
 * Es de solo escritura desde la aplicación: se insertan filas y se consultan,
 * pero nunca se editan ni se eliminan por API. Así queda una traza íntegra de
 * quién hizo qué, cuándo y sobre qué registro.
 */

export interface AuditEventInput {
  action: string;
  entity?: string | null;
  entityId?: string | null;
  details?: unknown;
}

export interface AuditRecord {
  id: string;
  timestamp: string;
  userId: string | null;
  username: string | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  details: any;
}

export interface AuditFilters {
  limit?: number;
  entity?: string;
  username?: string;
  action?: string;
  from?: string;
  to?: string;
}

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 100;

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Extrae usuario/IP del request sin acoplarse a un tipo concreto de Express.
 * Si no hay sesión (p. ej. un login fallido) se guarda como anónimo.
 */
function actorFrom(req: any): { userId: string | null; username: string | null } {
  const user = req?.user;
  return {
    userId: user?.id ? String(user.id) : null,
    username: user?.username ? String(user.username) : null,
  };
}

/**
 * Registra un evento de auditoría. Nunca lanza: un fallo de auditoría no debe
 * tumbar la operación de negocio que lo origina.
 */
export function recordAudit(req: any, event: AuditEventInput): void {
  try {
    const { userId, username } = actorFrom(req);
    db.insert(auditLog)
      .values({
        id: crypto.randomUUID(),
        timestamp: nowIso(),
        userId,
        username,
        action: event.action,
        entity: event.entity ?? null,
        entityId: event.entityId ?? null,
        details: event.details === undefined ? null : JSON.stringify(event.details),
      })
      .run();
  } catch (error) {
    console.error('[Auditoría] No se pudo registrar el evento:', error);
  }
}

/** Normaliza una fecha de filtro; acepta ISO completo o solo fecha (YYYY-MM-DD). */
function normalizeFrom(value?: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return value.length === 10 ? `${value}T00:00:00.000Z` : date.toISOString();
}

function normalizeTo(value?: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  if (value.length === 10) {
    return `${value}T23:59:59.999Z`;
  }
  return date.toISOString();
}

function buildConditions(filters: AuditFilters) {
  const conditions: any[] = [];
  if (filters.entity) conditions.push(eq(auditLog.entity, filters.entity));
  if (filters.username) conditions.push(eq(auditLog.username, filters.username));
  if (filters.action) conditions.push(eq(auditLog.action, filters.action));

  const from = normalizeFrom(filters.from);
  const to = normalizeTo(filters.to);
  if (from) conditions.push(gte(auditLog.timestamp, from));
  if (to) conditions.push(lte(auditLog.timestamp, to));

  return conditions;
}

function parseDetails(raw: string | null): any {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export function listAudit(filters: AuditFilters = {}): AuditRecord[] {
  const limit = Math.min(Math.max(Number(filters.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const conditions = buildConditions(filters);

  const rows = db
    .select()
    .from(auditLog)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(auditLog.timestamp))
    .limit(limit)
    .all();

  return rows.map((row) => ({
    id: row.id,
    timestamp: row.timestamp,
    userId: row.userId,
    username: row.username,
    action: row.action,
    entity: row.entity,
    entityId: row.entityId,
    details: parseDetails(row.details),
  }));
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return `"${text.replace(/"/g, '""')}"`;
}

/** Exporta la bitácora a JSON o CSV (para adjuntar a informes del SGC). */
export function exportAudit(filters: AuditFilters = {}, format: 'json' | 'csv' = 'json'): string {
  const records = listAudit({ ...filters, limit: MAX_LIMIT });

  if (format === 'csv') {
    const header = ['timestamp', 'username', 'action', 'entity', 'entity_id', 'details'];
    const lines = records.map((record) =>
      [record.timestamp, record.username, record.action, record.entity, record.entityId, record.details]
        .map(csvEscape)
        .join(',')
    );
    return [header.join(','), ...lines].join('\r\n');
  }

  return JSON.stringify({ generatedAt: nowIso(), total: records.length, records }, null, 2);
}

/** Resumen para la interfaz: acciones y usuarios distintos presentes. */
export function auditSummary(): { actions: string[]; usernames: string[]; total: number } {
  const rows = db.select().from(auditLog).all();
  const actions = new Set<string>();
  const usernames = new Set<string>();
  for (const row of rows) {
    if (row.action) actions.add(row.action);
    if (row.username) usernames.add(row.username);
  }
  return {
    actions: [...actions].sort(),
    usernames: [...usernames].sort(),
    total: rows.length,
  };
}
