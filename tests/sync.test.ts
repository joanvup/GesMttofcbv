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

describe('Sincronización de datos', () => {
  beforeEach(() => {
    resetRateLimiters();
  });

  it('devuelve los equipos iniciales sembrados', async () => {
    const token = await tokenFor('admin', ADMIN_PASSWORD);
    const response = await request(app).get('/api/sync/equipments').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeGreaterThan(0);
    // Los campos JSON deben llegar ya deserializados
    expect(Array.isArray(response.body.data[0].parts)).toBe(true);
    expect(Array.isArray(response.body.data[0].maintenanceTasks)).toBe(true);
  });

  it('permite al administrador guardar y recuperar equipos', async () => {
    const token = await tokenFor('admin', ADMIN_PASSWORD);
    const current = await request(app).get('/api/sync/equipments').set('Authorization', `Bearer ${token}`);

    const nuevo = {
      id: 'eq-test-01',
      code: 'TEST-01',
      name: 'Equipo de prueba',
      location: 'Data Center Principal',
      brand: 'TestBrand',
      model: 'TestModel',
      serial: 'SN-TEST-01',
      parts: ['Parte A'],
      maintenanceTasks: ['Tarea A'],
      frequency: 'mensual',
      status: 'activo',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const saved = await request(app)
      .post('/api/sync/equipments')
      .set('Authorization', `Bearer ${token}`)
      .send([...current.body.data, nuevo]);

    expect(saved.status).toBe(200);

    const reloaded = await request(app).get('/api/sync/equipments').set('Authorization', `Bearer ${token}`);
    const found = reloaded.body.data.find((e: { id: string }) => e.id === nuevo.id);
    expect(found).toMatchObject({ code: 'TEST-01', name: 'Equipo de prueba', frequency: 'mensual' });
  });

  it('impide que el rol revisor modifique datos', async () => {
    const token = await tokenFor('revisor', REVISOR_PASSWORD);
    const response = await request(app)
      .post('/api/sync/equipments')
      .set('Authorization', `Bearer ${token}`)
      .send([]);

    expect(response.status).toBe(403);
  });

  it('exige autenticación para leer datos', async () => {
    const response = await request(app).get('/api/sync/equipments');
    expect(response.status).toBe(401);
  });

  it('rechaza entidades de sincronización desconocidas', async () => {
    const token = await tokenFor('admin', ADMIN_PASSWORD);
    const response = await request(app)
      .get('/api/sync/entidad-inexistente')
      .set('Authorization', `Bearer ${token}`);

    expect([400, 404]).toContain(response.status);
  });
});
