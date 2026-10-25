import { describe, expect, it, beforeEach } from 'vitest';
import request from 'supertest';
import { app, resetRateLimiters } from '../server';
import { sqlite } from '../src/db/index';

const ADMIN_PASSWORD = process.env.INITIAL_ADMIN_PASSWORD as string;
const REVISOR_PASSWORD = process.env.INITIAL_REVISOR_PASSWORD as string;

async function tokenFor(username: 'admin' | 'revisor', password: string): Promise<string> {
  const response = await request(app).post('/api/auth/login').send({ username, password });
  expect(response.status).toBe(200);
  return response.body.token as string;
}

const adminToken = () => tokenFor('admin', ADMIN_PASSWORD);
const revisorToken = () => tokenFor('revisor', REVISOR_PASSWORD);

async function listExecutions(token: string): Promise<any[]> {
  const response = await request(app).get('/api/sync/executions').set('Authorization', `Bearer ${token}`);
  expect(response.status).toBe(200);
  return response.body.data as any[];
}

async function saveExecutions(token: string, data: any[]) {
  return request(app).post('/api/sync/executions').set('Authorization', `Bearer ${token}`).send({ data });
}

async function getExecution(token: string, id: string): Promise<any> {
  const list = await listExecutions(token);
  return list.find((row) => row.id === id);
}

let sequence = 0;
function uniqueId(): string {
  sequence += 1;
  return `exec_test_${Date.now()}_${sequence}`;
}

// Crea un acta nueva a través de la sincronización (como lo haría el cliente).
async function createExecution(token: string, overrides: Record<string, any> = {}): Promise<string> {
  const existing = await listExecutions(token);
  const id = (overrides.id as string) || uniqueId();
  const now = new Date().toISOString();
  const record = {
    id,
    equipmentId: 'eq_test',
    year: 2026,
    month: 1,
    scheduledDate: '2026-01-15',
    isExecuted: true,
    executedDate: '2026-01-15 10:00',
    responsibleName: 'Técnico de Prueba',
    responsibleRole: 'Técnico FCBV',
    completedTasks: ['tarea-1'],
    observations: 'Sin novedades',
    maintenanceType: 'preventivo',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
  const response = await saveExecutions(token, [...existing, record]);
  expect(response.status).toBe(200);
  return id;
}

describe('Migración 0004: ciclo de vida SGC de las actas', () => {
  beforeEach(() => {
    resetRateLimiters();
  });

  it('registra la migración 0004_sgc_lifecycle', () => {
    const rows = sqlite.prepare('SELECT id FROM schema_migrations').all() as Array<{ id: string }>;
    expect(rows.map((row) => row.id)).toContain('0004_sgc_lifecycle');
  });

  it('añade las columnas del ciclo de vida a la tabla executions', () => {
    const columns = (sqlite.prepare('PRAGMA table_info(executions)').all() as Array<{ name: string }>).map(
      (row) => row.name
    );
    expect(columns).toEqual(
      expect.arrayContaining([
        'record_status',
        'record_version',
        'approved_by',
        'approved_at',
        'closed_by',
        'closed_at',
      ])
    );
  });
});

describe('Ciclo de vida SGC de las actas', () => {
  beforeEach(() => {
    resetRateLimiters();
  });

  it('crea un acta nueva en estado borrador y versión 1', async () => {
    const token = await adminToken();
    const id = await createExecution(token);

    const stored = await getExecution(token, id);
    expect(stored.recordStatus).toBe('borrador');
    expect(stored.recordVersion).toBe(1);
    expect(stored.approvedBy).toBeNull();
    expect(stored.closedBy).toBeNull();
  });

  it('ignora el estado SGC enviado por el cliente al sincronizar', async () => {
    const token = await adminToken();
    const id = await createExecution(token, {
      recordStatus: 'cerrado',
      recordVersion: 99,
      approvedBy: 'intruso',
    });

    const stored = await getExecution(token, id);
    expect(stored.recordStatus).toBe('borrador');
    expect(stored.recordVersion).toBe(1);
    expect(stored.approvedBy).toBeNull();
  });

  it('permite reenviar el contenido sin cambios sin bloquear el acta', async () => {
    const token = await adminToken();
    const id = await createExecution(token);

    const current = await listExecutions(token);
    const response = await saveExecutions(token, current);
    expect(response.status).toBe(200);
    expect((await getExecution(token, id)).recordStatus).toBe('borrador');
  });

  it('aprueba un acta (revisor) subiendo la versión y registrando auditoría', async () => {
    const admin = await adminToken();
    const revisor = await revisorToken();
    const id = await createExecution(admin);

    const response = await request(app)
      .post(`/api/executions/${id}/approve`)
      .set('Authorization', `Bearer ${revisor}`);
    expect(response.status).toBe(200);

    const stored = await getExecution(admin, id);
    expect(stored.recordStatus).toBe('aprobado');
    expect(stored.recordVersion).toBe(2);
    expect(stored.approvedBy).toBe('revisor');
    expect(stored.approvedAt).toBeTruthy();

    const audit = await request(app)
      .get('/api/audit?action=execution.approve')
      .set('Authorization', `Bearer ${admin}`);
    const entry = audit.body.data.find((row: any) => row.entityId === id);
    expect(entry).toBeTruthy();
    expect(entry.username).toBe('revisor');
  });

  it('rechaza modificar el contenido de un acta aprobada (409 RECORD_LOCKED)', async () => {
    const admin = await adminToken();
    const id = await createExecution(admin);
    await request(app).post(`/api/executions/${id}/approve`).set('Authorization', `Bearer ${admin}`);

    const current = await listExecutions(admin);
    const mutated = current.map((row) =>
      row.id === id ? { ...row, observations: 'Cambio no permitido' } : row
    );
    const response = await saveExecutions(admin, mutated);

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('RECORD_LOCKED');
    expect((await getExecution(admin, id)).observations).toBe('Sin novedades');
  });

  it('no permite aprobar un acta que no está en borrador', async () => {
    const admin = await adminToken();
    const id = await createExecution(admin);

    await request(app).post(`/api/executions/${id}/approve`).set('Authorization', `Bearer ${admin}`);
    const second = await request(app)
      .post(`/api/executions/${id}/approve`)
      .set('Authorization', `Bearer ${admin}`);

    expect(second.status).toBe(409);
    expect(second.body.code).toBeUndefined();
  });

  it('no permite cerrar un acta que no fue aprobada', async () => {
    const admin = await adminToken();
    const id = await createExecution(admin);

    const response = await request(app)
      .post(`/api/executions/${id}/close`)
      .set('Authorization', `Bearer ${admin}`);
    expect(response.status).toBe(409);
  });

  it('cierra un acta aprobada y bloquea su contenido', async () => {
    const admin = await adminToken();
    const id = await createExecution(admin);

    await request(app).post(`/api/executions/${id}/approve`).set('Authorization', `Bearer ${admin}`);
    const closed = await request(app)
      .post(`/api/executions/${id}/close`)
      .set('Authorization', `Bearer ${admin}`);
    expect(closed.status).toBe(200);

    const stored = await getExecution(admin, id);
    expect(stored.recordStatus).toBe('cerrado');
    expect(stored.recordVersion).toBe(3);
    expect(stored.closedBy).toBe('admin');

    const current = await listExecutions(admin);
    const mutated = current.map((row) =>
      row.id === id ? { ...row, observations: 'Intento de edición' } : row
    );
    const response = await saveExecutions(admin, mutated);
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('RECORD_LOCKED');
  });

  it('no permite eliminar un acta cerrada mediante la sincronización', async () => {
    const admin = await adminToken();
    const id = await createExecution(admin);
    await request(app).post(`/api/executions/${id}/approve`).set('Authorization', `Bearer ${admin}`);
    await request(app).post(`/api/executions/${id}/close`).set('Authorization', `Bearer ${admin}`);

    const current = await listExecutions(admin);
    const withoutRecord = current.filter((row) => row.id !== id);
    const response = await saveExecutions(admin, withoutRecord);

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('RECORD_LOCKED');
    expect(await getExecution(admin, id)).toBeTruthy();
  });

  it('solo el administrador puede reabrir un acta', async () => {
    const admin = await adminToken();
    const revisor = await revisorToken();
    const id = await createExecution(admin);
    await request(app).post(`/api/executions/${id}/approve`).set('Authorization', `Bearer ${admin}`);

    const forbidden = await request(app)
      .post(`/api/executions/${id}/reopen`)
      .set('Authorization', `Bearer ${revisor}`);
    expect(forbidden.status).toBe(403);

    const reopened = await request(app)
      .post(`/api/executions/${id}/reopen`)
      .set('Authorization', `Bearer ${admin}`);
    expect(reopened.status).toBe(200);

    const stored = await getExecution(admin, id);
    expect(stored.recordStatus).toBe('borrador');
    expect(stored.recordVersion).toBe(3);
    expect(stored.approvedBy).toBeNull();
    expect(stored.approvedAt).toBeNull();
    expect(stored.closedBy).toBeNull();
    expect(stored.closedAt).toBeNull();
  });

  it('permite editar el contenido tras reabrir un acta cerrada', async () => {
    const admin = await adminToken();
    const id = await createExecution(admin);
    await request(app).post(`/api/executions/${id}/approve`).set('Authorization', `Bearer ${admin}`);
    await request(app).post(`/api/executions/${id}/close`).set('Authorization', `Bearer ${admin}`);
    await request(app).post(`/api/executions/${id}/reopen`).set('Authorization', `Bearer ${admin}`);

    const current = await listExecutions(admin);
    const mutated = current.map((row) =>
      row.id === id ? { ...row, observations: 'Corrección tras reapertura' } : row
    );
    const response = await saveExecutions(admin, mutated);

    expect(response.status).toBe(200);
    expect((await getExecution(admin, id)).observations).toBe('Corrección tras reapertura');
  });

  it('devuelve 404 al transicionar un acta inexistente', async () => {
    const admin = await adminToken();
    const response = await request(app)
      .post('/api/executions/no-existe/approve')
      .set('Authorization', `Bearer ${admin}`);
    expect(response.status).toBe(404);
  });
});
