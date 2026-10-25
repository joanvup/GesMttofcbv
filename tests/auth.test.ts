import { describe, expect, it, beforeEach } from 'vitest';
import request from 'supertest';
import { app, resetRateLimiters } from '../server';

const ADMIN_PASSWORD = process.env.INITIAL_ADMIN_PASSWORD as string;

async function loginAsAdmin() {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: ADMIN_PASSWORD });

  expect(response.status).toBe(200);
  return response.body.token as string;
}

describe('Autenticación', () => {
  beforeEach(() => {
    resetRateLimiters();
  });

  it('rechaza credenciales incorrectas con 401', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'contraseña-incorrecta' });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it('rechaza usuarios inexistentes con 401', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'no-existe', password: 'loquesea1234' });

    expect(response.status).toBe(401);
  });

  it('devuelve token y rol al iniciar sesión correctamente', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: ADMIN_PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.user).toMatchObject({ username: 'admin', role: 'admin' });
    // La respuesta nunca debe incluir el hash de la contraseña
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
  });

  it('protege /api/auth/me sin token', async () => {
    const response = await request(app).get('/api/auth/me');
    expect(response.status).toBe(401);
  });

  it('protege /api/auth/me con un token inválido', async () => {
    const response = await request(app).get('/api/auth/me').set('Authorization', 'Bearer token-falso');
    expect(response.status).toBe(401);
  });

  it('devuelve el usuario autenticado con un token válido', async () => {
    const token = await loginAsAdmin();
    const response = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({ username: 'admin', role: 'admin' });
  });

  it('bloquea con 429 tras superar el límite de intentos de login', async () => {
    for (let attempt = 1; attempt <= 10; attempt++) {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'incorrecta' });
      expect(response.status).toBe(401);
    }

    const blocked = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'incorrecta' });

    expect(blocked.status).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();
  });
});
