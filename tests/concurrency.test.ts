import { describe, expect, it, beforeEach } from 'vitest';
import request from 'supertest';
import { app, resetRateLimiters } from '../server';

const ADMIN_PASSWORD = process.env.INITIAL_ADMIN_PASSWORD as string;

async function adminToken(): Promise<string> {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: ADMIN_PASSWORD });
  expect(response.status).toBe(200);
  return response.body.token as string;
}

async function getEntity(token: string, entity: string) {
  const response = await request(app).get(`/api/sync/${entity}`).set('Authorization', `Bearer ${token}`);
  expect(response.status).toBe(200);
  return response.body as { success: boolean; data: any; revision: number };
}

async function postEntity(token: string, entity: string, body: unknown) {
  return request(app)
    .post(`/api/sync/${entity}`)
    .set('Authorization', `Bearer ${token}`)
    .send(body as any);
}

describe('Bloqueo optimista de sincronización', () => {
  beforeEach(() => {
    resetRateLimiters();
  });

  it('la lectura devuelve una revisión numérica y un ETag', async () => {
    const token = await adminToken();
    const response = await request(app).get('/api/sync/equipments').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(typeof response.body.revision).toBe('number');
    expect(response.headers.etag).toBe(`"rev-${response.body.revision}"`);
  });

  it('rechaza una escritura con una revisión desactualizada (409)', async () => {
    const token = await adminToken();
    const { revision } = await getEntity(token, 'locations');

    // Otra sesión escribe primero e incrementa la revisión.
    const first = await postEntity(token, 'locations', { data: [], expectedRevision: revision });
    expect(first.status).toBe(200);

    const stale = await postEntity(token, 'locations', { data: [], expectedRevision: revision });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('SYNC_CONFLICT');
    expect(typeof stale.body.revision).toBe('number');
  });

  it('acepta la escritura cuando la revisión coincide e incrementa el contador', async () => {
    const token = await adminToken();
    const { data, revision } = await getEntity(token, 'buildings');

    const response = await postEntity(token, 'buildings', { data, expectedRevision: revision });
    expect(response.status).toBe(200);
    expect(response.body.revision).toBe(revision + 1);
  });

  it('sigue aceptando el cuerpo plano anterior (compatibilidad)', async () => {
    const token = await adminToken();
    const { data } = await getEntity(token, 'buildings');

    const response = await request(app)
      .post('/api/sync/buildings')
      .set('Authorization', `Bearer ${token}`)
      .send(data);

    expect(response.status).toBe(200);
    expect(typeof response.body.revision).toBe('number');
  });

  it('rechaza un cuerpo que no es una lista para equipos', async () => {
    const token = await adminToken();
    const response = await postEntity(token, 'equipments', { data: { no: 'es lista' }, expectedRevision: 0 });
    expect(response.status).toBe(400);
  });

  it('valida que cada cronograma anual tenga 12 meses', async () => {
    const token = await adminToken();
    const response = await postEntity(token, 'annualPlans', {
      data: { 2026: { 'eq-x': [true, false] } },
      expectedRevision: 0,
    });
    expect(response.status).toBe(400);
  });
});

describe('Sincronización no destructiva', () => {
  beforeEach(() => {
    resetRateLimiters();
  });

  it('actualiza en sitio y conserva createdAt, sin reinsertar todo', async () => {
    const token = await adminToken();
    const { data, revision } = await getEntity(token, 'equipments');
    expect(data.length).toBeGreaterThan(1);

    const target = data[0];
    const untouched = data[1];
    const updated = [{ ...target, name: 'Nombre actualizado en prueba' }, ...data.slice(1)];

    const response = await postEntity(token, 'equipments', { data: updated, expectedRevision: revision });
    expect(response.status).toBe(200);

    const after = await getEntity(token, 'equipments');
    expect(after.data).toHaveLength(data.length);
    expect(after.data[0].name).toBe('Nombre actualizado en prueba');
    // El otro equipo no se recreó: conserva su createdAt original.
    expect(after.data[1].createdAt).toBe(untouched.createdAt);
  });

  it('elimina únicamente los registros ausentes en la lista', async () => {
    const token = await adminToken();
    const { data, revision } = await getEntity(token, 'locations');

    // Añade una ubicación de prueba y vuelve a leer para tener la revisión vigente.
    const created = {
      id: 'loc-test-nodestructive',
      name: 'Ubicación de prueba',
      building: 'Edificio Administrativo',
      areaType: 'oficina',
      status: 'activa',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const added = await postEntity(token, 'locations', {
      data: [...data, created],
      expectedRevision: revision,
    });
    expect(added.status).toBe(200);

    const current = await getEntity(token, 'locations');
    expect(current.data.find((l: any) => l.id === created.id)).toBeTruthy();

    const removed = await postEntity(token, 'locations', {
      data: current.data.filter((l: any) => l.id !== created.id),
      expectedRevision: current.revision,
    });
    expect(removed.status).toBe(200);

    const final = await getEntity(token, 'locations');
    expect(final.data.find((l: any) => l.id === created.id)).toBeUndefined();
    expect(final.data.length).toBe(data.length);
  });
});

describe('Copias de seguridad del servidor', () => {
  beforeEach(() => {
    resetRateLimiters();
  });

  it('lista las copias e informa que están desactivadas en memoria', async () => {
    const token = await adminToken();
    const response = await request(app).get('/api/database/backups').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.settings.enabled).toBe(false);
  });

  it('no permite crear copias cuando la base está en memoria', async () => {
    const token = await adminToken();
    const response = await request(app)
      .post('/api/database/backups')
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'manual' });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
  });

  it('rechaza nombres de archivo con rutas', async () => {
    const token = await adminToken();
    const response = await request(app)
      .get('/api/database/backups/..%2Fdatabase.sqlite')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
  });

  it('exige rol administrador para gestionar copias', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'revisor', password: process.env.INITIAL_REVISOR_PASSWORD });
    const token = login.body.token as string;

    const response = await request(app).get('/api/database/backups').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(403);
  });
});
