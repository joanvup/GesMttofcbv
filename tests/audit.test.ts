import { describe, expect, it, beforeEach } from 'vitest';
import request from 'supertest';
import { app, resetRateLimiters } from '../server';
import { runMigrations } from '../src/db/bootstrap';
import { sqlite } from '../src/db/index';

const ADMIN_PASSWORD = process.env.INITIAL_ADMIN_PASSWORD as string;

async function adminToken(): Promise<string> {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: ADMIN_PASSWORD });
  expect(response.status).toBe(200);
  return response.body.token as string;
}

describe('Migraciones versionadas', () => {
  beforeEach(() => {
    resetRateLimiters();
  });

  it('registra las migraciones aplicadas en schema_migrations', () => {
    const rows = sqlite.prepare('SELECT id, checksum FROM schema_migrations ORDER BY id').all() as Array<{
      id: string;
      checksum: string;
    }>;

    const ids = rows.map((row) => row.id);
    expect(ids).toContain('0001_initial');
    expect(ids).toContain('0002_entity_revisions');
    expect(ids).toContain('0003_audit_log');
    // Cada migración guarda un checksum no vacío.
    for (const row of rows) {
      expect(row.checksum).toMatch(/^[0-9a-f]{16}$/);
    }
  });

  it('es idempotente: una segunda ejecución no vuelve a aplicar nada', () => {
    const result = runMigrations();
    expect(result.applied).toEqual([]);
    expect(result.skipped.length).toBeGreaterThanOrEqual(3);
  });

  it('crea la tabla de auditoría con sus índices', () => {
    const tables = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'audit_log'")
      .all();
    expect(tables.length).toBe(1);

    const indexes = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'audit_log'")
      .all() as Array<{ name: string }>;
    const indexNames = indexes.map((row) => row.name);
    expect(indexNames).toContain('idx_audit_timestamp');
    expect(indexNames).toContain('idx_audit_entity');
    expect(indexNames).toContain('idx_audit_username');
  });
});

describe('Bitácora de auditoría', () => {
  beforeEach(() => {
    resetRateLimiters();
  });

  it('registra un inicio de sesión exitoso', async () => {
    const token = await adminToken();
    const response = await request(app).get('/api/audit').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    const login = response.body.data.find((row: any) => row.action === 'login');
    expect(login).toBeTruthy();
    expect(login.username).toBe('admin');
  });

  it('registra un intento de inicio de sesión fallido sin revelar la contraseña', async () => {
    await request(app).post('/api/auth/login').send({ username: 'admin', password: 'incorrecta' });
    const token = await adminToken();
    const response = await request(app).get('/api/audit').set('Authorization', `Bearer ${token}`);

    const failed = response.body.data.find((row: any) => row.action === 'login_failed');
    expect(failed).toBeTruthy();
    expect(JSON.stringify(failed)).not.toContain('incorrecta');
  });

  it('registra las escrituras de sincronización', async () => {
    const token = await adminToken();
    const current = await request(app).get('/api/sync/buildings').set('Authorization', `Bearer ${token}`);

    const saved = await request(app)
      .post('/api/sync/buildings')
      .set('Authorization', `Bearer ${token}`)
      .send({ data: current.body.data, expectedRevision: current.body.revision });
    expect(saved.status).toBe(200);

    const response = await request(app).get('/api/audit').set('Authorization', `Bearer ${token}`);
    const write = response.body.data.find(
      (row: any) => row.action === 'sync.write' && row.entity === 'buildings'
    );
    expect(write).toBeTruthy();
    expect(write.username).toBe('admin');
  });

  it('filtra por acción y por usuario', async () => {
    const token = await adminToken();
    const response = await request(app)
      .get('/api/audit?action=login&username=admin&limit=5')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThan(0);
    for (const row of response.body.data) {
      expect(row.action).toBe('login');
      expect(row.username).toBe('admin');
    }
  });

  it('exporta la bitácora en JSON y CSV', async () => {
    const token = await adminToken();

    const json = await request(app)
      .get('/api/audit/export?format=json')
      .set('Authorization', `Bearer ${token}`);
    expect(json.status).toBe(200);
    expect(json.headers['content-disposition']).toContain('bitacora_');
    const parsed = JSON.parse(json.text);
    expect(Array.isArray(parsed.records)).toBe(true);

    const csv = await request(app)
      .get('/api/audit/export?format=csv')
      .set('Authorization', `Bearer ${token}`);
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text.split('\r\n')[0]).toBe('timestamp,username,action,entity,entity_id,details');
  });

  it('exige rol administrador', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'revisor', password: process.env.INITIAL_REVISOR_PASSWORD });
    const token = login.body.token as string;

    const response = await request(app).get('/api/audit').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(403);
  });

  it('no expone endpoints de borrado (bitácora inmutable)', async () => {
    const token = await adminToken();
    const response = await request(app).delete('/api/audit').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(404);
  });
});
