import { describe, expect, it, beforeEach } from 'vitest';
import request from 'supertest';
import { app, resetRateLimiters } from '../server';

const ADMIN_PASSWORD = process.env.INITIAL_ADMIN_PASSWORD as string;
const REVISOR_PASSWORD = process.env.INITIAL_REVISOR_PASSWORD as string;

async function tokenFor(username: string, password: string): Promise<string> {
  const response = await request(app).post('/api/auth/login').send({ username, password });
  expect(response.status).toBe(200);
  return response.body.token as string;
}

// Recursos REST por entidad (el alias `/api/sync/:entity` se conserva aparte).
const RESOURCE_PATHS = [
  '/api/equipments',
  '/api/locations',
  '/api/buildings',
  '/api/annual-plans',
  '/api/executions',
];

describe('Endpoints REST por recurso', () => {
  beforeEach(() => {
    resetRateLimiters();
  });

  for (const path of RESOURCE_PATHS) {
    it(`GET ${path} devuelve datos, revisión y ETag`, async () => {
      const token = await tokenFor('admin', ADMIN_PASSWORD);
      const response = await request(app).get(path).set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('data');
      expect(typeof response.body.revision).toBe('number');
      expect(response.headers.etag).toBe(`"rev-${response.body.revision}"`);
    });
  }

  it('PUT /api/equipments guarda y recupera un equipo (bloqueo optimista)', async () => {
    const token = await tokenFor('admin', ADMIN_PASSWORD);
    const current = await request(app).get('/api/equipments').set('Authorization', `Bearer ${token}`);

    const nuevo = {
      id: 'eq-rest-01',
      code: 'REST-01',
      name: 'Equipo REST',
      location: 'Data Center Principal',
      brand: 'TestBrand',
      model: 'TestModel',
      serial: 'SN-REST-01',
      parts: ['Parte A'],
      maintenanceTasks: ['Tarea A'],
      frequency: 'mensual',
      status: 'activo',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const saved = await request(app)
      .put('/api/equipments')
      .set('Authorization', `Bearer ${token}`)
      .send({ data: [...current.body.data, nuevo], expectedRevision: current.body.revision });

    expect(saved.status).toBe(200);
    expect(saved.body.revision).toBe(current.body.revision + 1);

    const reloaded = await request(app).get('/api/equipments').set('Authorization', `Bearer ${token}`);
    const found = reloaded.body.data.find((e: { id: string }) => e.id === nuevo.id);
    expect(found).toMatchObject({ code: 'REST-01', name: 'Equipo REST' });
  });

  it('PUT con revisión desactualizada responde 409 SYNC_CONFLICT', async () => {
    const token = await tokenFor('admin', ADMIN_PASSWORD);
    const first = await request(app).get('/api/buildings').set('Authorization', `Bearer ${token}`);

    const write = await request(app)
      .put('/api/buildings')
      .set('Authorization', `Bearer ${token}`)
      .send({ data: first.body.data, expectedRevision: first.body.revision });
    expect(write.status).toBe(200);

    const stale = await request(app)
      .put('/api/buildings')
      .set('Authorization', `Bearer ${token}`)
      .send({ data: first.body.data, expectedRevision: first.body.revision });

    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('SYNC_CONFLICT');
  });

  it('el rol revisor no puede escribir por REST', async () => {
    const token = await tokenFor('revisor', REVISOR_PASSWORD);
    const response = await request(app)
      .put('/api/equipments')
      .set('Authorization', `Bearer ${token}`)
      .send({ data: [], expectedRevision: 0 });

    expect(response.status).toBe(403);
  });

  it('exige autenticación en REST', async () => {
    const response = await request(app).get('/api/equipments');
    expect(response.status).toBe(401);
  });

  it('mantiene el alias heredado /api/sync/:entity', async () => {
    const token = await tokenFor('admin', ADMIN_PASSWORD);
    const rest = await request(app).get('/api/equipments').set('Authorization', `Bearer ${token}`);
    const legacy = await request(app).get('/api/sync/equipments').set('Authorization', `Bearer ${token}`);

    expect(legacy.status).toBe(200);
    expect(legacy.body.revision).toBe(rest.body.revision);
    expect(legacy.body.data.length).toBe(rest.body.data.length);
  });
});
