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
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'SyncError';
  }
}

export const RECORD_LOCKED_CODE = 'RECORD_LOCKED';

// Campos de contenido del acta. Excluye deliberadamente los datos del ciclo de
// vida SGC (record_status, record_version, approved_*, closed_*) y las marcas de
// tiempo, que gestiona el servidor.
const EXECUTION_CONTENT_KEYS = [
  'equipmentId',
  'year',
  'month',
  'scheduledDate',
  'isExecuted',
  'executedDate',
  'responsibleName',
  'responsibleRole',
  'signatureDataUrl',
  'completedTasks',
  'partsReplaced',
  'observations',
  'maintenanceType',
  'failureDescription',
  'actionTaken',
  'downtimeHours',
  'finalOperationalStatus',
] as const;

// Normaliza un valor para comparar contenido: undefined y cadena vacía equivalen
// a null, de modo que pequeñas diferencias de forma no cuenten como edición.
function normalizeContentValue(value: unknown): unknown {
  if (value === undefined || value === '') return null;
  return value;
}

function contentSignature(record: any): string {
  return JSON.stringify(EXECUTION_CONTENT_KEYS.map((key) => normalizeContentValue(record?.[key])));
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

  const existing: any[] = tx.select().from(executions).all();
  const existingById = new Map(existing.map((row) => [row.id, row]));

  // Las actas cerradas no se eliminan: primero deben reabrirse (queda en la bitácora).
  for (const row of existing) {
    if (!seenIds.has(row.id) && row.recordStatus === 'cerrado') {
      throw new SyncError(
        409,
        `El acta ${row.id} está cerrada y no puede eliminarse. Reábrala antes de quitarla.`,
        RECORD_LOCKED_CODE
      );
    }
  }
  deleteMissing(tx, executions, seenIds, executions.id);

  for (const item of desired) {
    const stored = existingById.get(item.id);
    const now = nowIso();

    if (!stored) {
      // Acta nueva: entra en borrador con versión 1.
      tx.insert(executions)
        .values({ ...item, recordStatus: 'borrador', recordVersion: 1, updatedAt: now })
        .run();
      continue;
    }

    // Solo se comparan campos de contenido: las marcas del ciclo de vida SGC y
    // las fechas de auditoría no cuentan como edición.
    if (contentSignature(stored) !== contentSignature(item)) {
      if (stored.recordStatus === 'cerrado') {
        throw new SyncError(
          409,
          `El acta ${item.id} está cerrada y no puede modificarse. Reábrala para editarla.`,
          RECORD_LOCKED_CODE
        );
      }
      if (stored.recordStatus === 'aprobado') {
        throw new SyncError(
          409,
          `El acta ${item.id} está aprobada y no puede modificarse. Reábrala para editarla.`,
          RECORD_LOCKED_CODE
        );
      }
    }

    // Actualiza el contenido conservando createdAt y las marcas SGC del servidor.
    tx.update(executions)
      .set({ ...item, createdAt: stored.createdAt, updatedAt: now })
      .where(eq(executions.id, item.id))
      .run();
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

// ---------------------------------------------------------------------------
// Ciclo de vida SGC de las actas
// ---------------------------------------------------------------------------

export type ExecutionAction = 'approve' | 'close' | 'reopen';
export type ExecutionRecordStatus = 'borrador' | 'aprobado' | 'cerrado';

/**
 * Aplica una transición de estado del acta y devuelve la fila actualizada.
 * El servidor es la única autoridad sobre el estado y la versión: el cliente
 * nunca puede fijarlos directamente.
 */
export function transitionExecution(id: string, action: ExecutionAction, username: string | null): any {
  const stored = db.select().from(executions).where(eq(executions.id, id)).get();
  if (!stored) throw new SyncError(404, 'Acta de mantenimiento no encontrada.');

  const now = nowIso();
  const version = (stored.recordVersion ?? 1) + 1;
  const base = { recordVersion: version, updatedAt: now };

  if (action === 'approve') {
    if (stored.recordStatus !== 'borrador') {
      throw new SyncError(409, 'Solo se pueden aprobar actas en estado borrador.');
    }
    db.update(executions)
      .set({ ...base, recordStatus: 'aprobado', approvedBy: username, approvedAt: now })
      .where(eq(executions.id, id))
      .run();
  } else if (action === 'close') {
    if (stored.recordStatus !== 'aprobado') {
      throw new SyncError(409, 'Solo se pueden cerrar actas previamente aprobadas.');
    }
    db.update(executions)
      .set({ ...base, recordStatus: 'cerrado', closedBy: username, closedAt: now })
      .where(eq(executions.id, id))
      .run();
  } else {
    if (stored.recordStatus === 'borrador') {
      throw new SyncError(409, 'El acta ya se encuentra en estado borrador.');
    }
    // Reabrir limpia las marcas de aprobación/cierre; la versión sigue subiendo.
    db.update(executions)
      .set({
        ...base,
        recordStatus: 'borrador',
        approvedBy: null,
        approvedAt: null,
        closedBy: null,
        closedAt: null,
      })
      .where(eq(executions.id, id))
      .run();
  }

  return db.select().from(executions).where(eq(executions.id, id)).get();
}
