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

describe('Endurecimiento de la API', () => {
  beforeEach(() => {
    resetRateLimiters();
  });

  it('no expone el encabezado X-Powered-By', async () => {
    const response = await request(app).get('/api/logo');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('incluye cabeceras de seguridad básicas', async () => {
    const response = await request(app).get('/api/logo');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
  });

  it('responde JSON en rutas de API inexistentes', async () => {
    const response = await request(app).get('/api/ruta-que-no-existe');
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ success: false });
  });

  it('rechaza el escáner de IA sin autenticación', async () => {
    const response = await request(app).post('/api/ai/scan-plate').send({ imageBase64: 'x' });
    expect(response.status).toBe(401);
  });

  it('rechaza el escáner de IA sin imagen aunque haya sesión', async () => {
    const token = await adminToken();
    const response = await request(app)
      .post('/api/ai/scan-plate')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(400);
  });

  it('rechaza la subida de un logo que no es imagen válida', async () => {
    const token = await adminToken();
    const response = await request(app)
      .post('/api/logo')
      .set('Authorization', `Bearer ${token}`)
      .send({
        filename: 'logo.png',
        mimeType: 'image/png',
        imageBase64: `data:image/png;base64,${Buffer.from('<html>no soy un png</html>').toString('base64')}`,
      });

    expect(response.status).toBe(400);
  });

  it('rechaza formatos de logo no permitidos por extensión o MIME', async () => {
    const token = await adminToken();
    const response = await request(app).post('/api/logo').set('Authorization', `Bearer ${token}`).send({
      filename: 'logo.svg',
      mimeType: 'image/svg+xml',
      imageBase64: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
    });

    expect(response.status).toBe(400);
  });

  it('exige autenticación para subir el logo', async () => {
    const response = await request(app).post('/api/logo').send({ filename: 'logo.png', imageBase64: 'x' });
    expect(response.status).toBe(401);
  });

  it('rechaza el login sin usuario o contraseña', async () => {
    const response = await request(app).post('/api/auth/login').send({ username: 'admin' });
    expect(response.status).toBe(400);
  });

  it('limita las solicitudes al escáner de IA por usuario', async () => {
    const token = await adminToken();
    let lastStatus = 0;

    for (let attempt = 1; attempt <= 21; attempt++) {
      const response = await request(app)
        .post('/api/ai/scan-plate')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      lastStatus = response.status;
    }

    expect(lastStatus).toBe(429);
  });
});
