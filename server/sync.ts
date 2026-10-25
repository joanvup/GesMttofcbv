import { eq } from 'drizzle-orm';
import { db } from '../src/db/index';
import { annualPlans, buildings, entityRevisions, equipments, executions, locations } from '../src/db/schema';

/**
 * Sincronización no destructiva y control de concurrencia.
 *
 * Cada entidad mantiene una revisión que se incrementa en cada escritura.
 * El cliente envía la revisión que leyó y, si ya no coincide, se responde 409.
 */

export const SYNC_ENTITIES = ['equipments', 'locations', 'buildings', 'annualPlans', 'executions'] as const;
export type SyncEntity = (typeof SYNC_ENTITIES)[number];

export const SYNC_ENTITY_SET = new Set<string>(SYNC_ENTITIES);

export class SyncError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'SyncError';
  }
}

// El tipo exacto de la transacción de Drizzle es complejo de exportar; el
// contrato que usamos aquí es el subconjunto de métodos de consulta.
type SyncTx = any;

const nowIso = () => new Date().toISOString();

function requireArray(payload: unknown, label: string): any[] {
  if (!Array.isArray(payload)) {
    throw new SyncError(400, `El cuerpo de ${label} debe ser una lista.`);
  }
  return payload;
}

function requireObject(payload: unknown, label: string): Record<string, any> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new SyncError(400, `El cuerpo de ${label} debe ser un objeto.`);
  }
  return payload as Record<string, any>;
}

function asText(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function asJsonArray(value: unknown): string {
  return JSON.stringify(Array.isArray(value) ? value : []);
}

function asOptionalJsonArray(value: unknown): string | null {
  return Array.isArray(value) ? JSON.stringify(value) : null;
}

function deleteMissing(tx: SyncTx, table: any, keepIds: Set<string>, idColumn: any): void {
  const rows: any[] = tx.select().from(table).all();
  for (const row of rows) {
    if (!keepIds.has(row.id)) {
      tx.delete(table).where(eq(idColumn, row.id)).run();
    }
  }
}

function replaceEquipments(tx: SyncTx, payload: unknown): void {
  const items = requireArray(payload, 'equipos');
  const desired: any[] = [];
  const seenCodes = new Set<string>();

  for (const item of items) {
    const code = asText(item?.code).toUpperCase().trim();
    const id = asText(item?.id);
    if (!code) throw new SyncError(400, 'Todos los equipos deben tener un código.');
    if (!id) throw new SyncError(400, `El equipo ${code} no tiene identificador.`);
    // Se conserva el comportamiento histórico: el primer código gana.
    if (seenCodes.has(code)) continue;
    seenCodes.add(code);

    desired.push({
      id,
      code,
      name: asText(item?.name),
      location: asText(item?.location),
      brand: asText(item?.brand),
      model: asText(item?.model),
      serial: asText(item?.serial),
      parts: asJsonArray(item?.parts),
      maintenanceTasks: asJsonArray(item?.maintenanceTasks),
      frequency: asText(item?.frequency, 'mensual'),
      customMonths: asOptionalJsonArray(item?.customMonths),
      status: asText(item?.status, 'activo'),
      observations: item?.observations ?? null,
      createdAt: asText(item?.createdAt, nowIso()),
      updatedAt: asText(item?.updatedAt, nowIso()),
    });
  }

  const existing: any[] = tx.select().from(equipments).all();
  const existingById = new Map(existing.map((row) => [row.id, row]));
  const keepIds = new Set(desired.map((item) => item.id));

  deleteMissing(tx, equipments, keepIds, equipments.id);

  // Los códigos son UNIQUE: se apartan temporalmente los que cambian para
  // evitar colisiones al intercambiar códigos entre dos equipos.
  let stagingIndex = 0;
  for (const item of desired) {
    const current = existingById.get(item.id);
    if (current && current.code !== item.code) {
      tx.update(equipments)
        .set({ code: `__sync_tmp_${stagingIndex}_${item.id}` })
        .where(eq(equipments.id, item.id))
        .run();
      stagingIndex += 1;
    }
  }

  for (const item of desired) {
    if (existingById.has(item.id)) {
      tx.update(equipments).set(item).where(eq(equipments.id, item.id)).run();
    } else {
      tx.insert(equipments).values(item).run();
    }
  }
}

function replaceLocations(tx: SyncTx, payload: unknown): void {
  const items = requireArray(payload, 'ubicaciones');
  const desired: any[] = [];
  const seenIds = new Set<string>();

  for (const item of items) {
    const id = asText(item?.id);
    if (!id) throw new SyncError(400, 'Todas las ubicaciones deben tener identificador.');
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    desired.push({
      id,
      name: asText(item?.name),
      building: asText(item?.building),
      areaType: asText(item?.areaType, 'otro'),
      description: item?.description ?? null,
      status: asText(item?.status, 'activa'),
      createdAt: asText(item?.createdAt, nowIso()),
      updatedAt: asText(item?.updatedAt, nowIso()),
    });
  }

  const existingIds = new Set(
    tx
      .select()
      .from(locations)
      .all()
      .map((row: any) => row.id)
  );
  deleteMissing(tx, locations, seenIds, locations.id);

  for (const item of desired) {
    if (existingIds.has(item.id)) {
      tx.update(locations).set(item).where(eq(locations.id, item.id)).run();
    } else {
      tx.insert(locations).values(item).run();
    }
  }
}

function replaceBuildings(tx: SyncTx, payload: unknown): void {
  const items = requireArray(payload, 'edificios');
  const desired: string[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const name = asText(item).trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    desired.push(name);
  }

  const existing: any[] = tx.select().from(buildings).all();
  for (const row of existing) {
    if (!seen.has(row.name)) {
      tx.delete(buildings).where(eq(buildings.name, row.name)).run();
    }
  }

  const existingNames = new Set(existing.map((row) => row.name));
  for (const name of desired) {
    if (!existingNames.has(name)) {
      tx.insert(buildings).values({ name }).run();
    }
  }
}

function replaceAnnualPlans(tx: SyncTx, payload: unknown): void {
  const plans = requireObject(payload, 'planes anuales');
  const desired: any[] = [];
  const seenIds = new Set<string>();

  for (const [yearText, yearData] of Object.entries(plans)) {
    const year = Number(yearText);
    if (!Number.isInteger(year) || year < 1900 || year > 3000) {
      throw new SyncError(400, `Año inválido en el plan anual: ${yearText}`);
    }

    const schedulesByEquipment = requireObject(yearData, `plan ${yearText}`);
    for (const [equipmentId, schedules] of Object.entries(schedulesByEquipment)) {
      if (!Array.isArray(schedules) || schedules.length !== 12) {
        throw new SyncError(400, `El cronograma de ${equipmentId} (${year}) debe tener 12 meses.`);
      }
      const id = `${year}_${equipmentId}`;
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      desired.push({
        id,
        equipmentId,
        year,
        schedules: JSON.stringify(schedules.map(Boolean)),
      });
    }
  }

  const existingIds = new Set(
    tx
      .select()
      .from(annualPlans)
      .all()
      .map((row: any) => row.id)
  );
  deleteMissing(tx, annualPlans, seenIds, annualPlans.id);

  for (const item of desired) {
    if (existingIds.has(item.id)) {
      tx.update(annualPlans).set(item).where(eq(annualPlans.id, item.id)).run();
    } else {
      tx.insert(annualPlans).values(item).run();
    }
  }
}

function replaceExecutions(tx: SyncTx, payload: unknown): void {
  const items = requireArray(payload, 'ejecuciones');
  const desired: any[] = [];
  const seenIds = new Set<string>();

  for (const item of items) {
    const id = asText(item?.id);
    if (!id) throw new SyncError(400, 'Todas las ejecuciones deben tener identificador.');
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    desired.push({
      id,
      equipmentId: asText(item?.equipmentId),
      year: Number(item?.year) || new Date().getFullYear(),
      month: Number(item?.month) || 1,
      scheduledDate: item?.scheduledDate ?? null,
      isExecuted: Boolean(item?.isExecuted),
      executedDate: item?.executedDate ?? null,
      responsibleName: item?.responsibleName ?? null,
      responsibleRole: item?.responsibleRole ?? null,
      signatureDataUrl: item?.signatureDataUrl ?? null,
      completedTasks: asJsonArray(item?.completedTasks),
      partsReplaced: asOptionalJsonArray(item?.partsReplaced),
      observations: item?.observations ?? null,
      maintenanceType: item?.maintenanceType || 'preventivo',
      failureDescription: item?.failureDescription ?? null,
      actionTaken: item?.actionTaken ?? null,
      downtimeHours: item?.downtimeHours === undefined ? null : item.downtimeHours,
      finalOperationalStatus: item?.finalOperationalStatus ?? null,
      createdAt: asText(item?.createdAt, nowIso()),
      updatedAt: asText(item?.updatedAt, nowIso()),
    });
  }

  const existingIds = new Set(
    tx
      .select()
      .from(executions)
      .all()
      .map((row: any) => row.id)
  );
  deleteMissing(tx, executions, seenIds, executions.id);

  for (const item of desired) {
    if (existingIds.has(item.id)) {
      tx.update(executions).set(item).where(eq(executions.id, item.id)).run();
    } else {
      tx.insert(executions).values(item).run();
    }
  }
}

/**
 * Aplica el reemplazo lógico de una entidad: inserta/actualiza lo recibido y
 * elimina únicamente los registros que ya no están en la lista.
 */
export function applySyncEntity(tx: SyncTx, entity: SyncEntity, payload: unknown): void {
  switch (entity) {
    case 'equipments':
      replaceEquipments(tx, payload);
      break;
    case 'locations':
      replaceLocations(tx, payload);
      break;
    case 'buildings':
      replaceBuildings(tx, payload);
      break;
    case 'annualPlans':
      replaceAnnualPlans(tx, payload);
      break;
    case 'executions':
      replaceExecutions(tx, payload);
      break;
    default:
      throw new SyncError(404, `Entidad de sincronización no válida: ${entity}`);
  }
}

export function getEntityRevision(entity: string): number {
  const row = db.select().from(entityRevisions).where(eq(entityRevisions.entity, entity)).get();
  return row?.revision ?? 0;
}

export function bumpEntityRevision(tx: SyncTx, entity: string, username?: string): number {
  const current = tx.select().from(entityRevisions).where(eq(entityRevisions.entity, entity)).get();
  const revision = (current?.revision ?? 0) + 1;
  const updatedAt = nowIso();

  if (current) {
    tx.update(entityRevisions)
      .set({ revision, updatedAt, updatedBy: username ?? null })
      .where(eq(entityRevisions.entity, entity))
      .run();
  } else {
    tx.insert(entityRevisions)
      .values({ entity, revision, updatedAt, updatedBy: username ?? null })
      .run();
  }

  return revision;
}

export function isSyncEntity(value: string): value is SyncEntity {
  return SYNC_ENTITY_SET.has(value);
}
