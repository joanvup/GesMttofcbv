import { describe, expect, it } from 'vitest';
import { loadServerEnv } from '../server/env';

const VALID_SECRET = 'a'.repeat(32);

describe('Validación de variables de entorno', () => {
  it('acepta una configuración mínima válida', () => {
    const env = loadServerEnv({ JWT_SECRET: VALID_SECRET } as NodeJS.ProcessEnv);

    expect(env.jwtSecret).toBe(VALID_SECRET);
    expect(env.port).toBe(3000);
    expect(env.nodeEnv).toBe('development');
    expect(env.dbEngine).toBe('sqlite');
    expect(env.isProduction).toBe(false);
  });

  it('exige JWT_SECRET', () => {
    expect(() => loadServerEnv({} as NodeJS.ProcessEnv)).toThrow(/JWT_SECRET es obligatorio/);
  });

  it('rechaza un JWT_SECRET demasiado corto', () => {
    expect(() => loadServerEnv({ JWT_SECRET: 'corto' } as NodeJS.ProcessEnv)).toThrow(
      /al menos 32 caracteres/
    );
  });

  it('rechaza un PORT inválido', () => {
    expect(() => loadServerEnv({ JWT_SECRET: VALID_SECRET, PORT: 'abc' } as NodeJS.ProcessEnv)).toThrow(
      /PORT debe ser/
    );
  });

  it('rechaza un NODE_ENV desconocido', () => {
    expect(() =>
      loadServerEnv({ JWT_SECRET: VALID_SECRET, NODE_ENV: 'staging' } as NodeJS.ProcessEnv)
    ).toThrow(/NODE_ENV debe ser/);
  });

  it('rechaza un DB_ENGINE desconocido', () => {
    expect(() =>
      loadServerEnv({ JWT_SECRET: VALID_SECRET, DB_ENGINE: 'oracle' } as NodeJS.ProcessEnv)
    ).toThrow(/DB_ENGINE debe ser/);
  });

  it('rechaza contraseñas iniciales demasiado cortas', () => {
    expect(() =>
      loadServerEnv({ JWT_SECRET: VALID_SECRET, INITIAL_ADMIN_PASSWORD: '123' } as NodeJS.ProcessEnv)
    ).toThrow(/INITIAL_ADMIN_PASSWORD debe tener al menos/);
  });

  it('acumula varios errores en un solo mensaje', () => {
    try {
      loadServerEnv({ PORT: 'x', DB_ENGINE: 'x' } as NodeJS.ProcessEnv);
      expect.unreachable('Debería haber lanzado un error');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toMatch(/JWT_SECRET/);
      expect(message).toMatch(/PORT/);
      expect(message).toMatch(/DB_ENGINE/);
    }
  });

  it('fuerza el puerto 3000 en Cloud Run', () => {
    const env = loadServerEnv({
      JWT_SECRET: VALID_SECRET,
      PORT: '8080',
      K_SERVICE: 'svc',
    } as NodeJS.ProcessEnv);
    expect(env.port).toBe(3000);
    expect(env.isCloudRun).toBe(true);
  });

  it('marca producción correctamente', () => {
    const env = loadServerEnv({ JWT_SECRET: VALID_SECRET, NODE_ENV: 'production' } as NodeJS.ProcessEnv);
    expect(env.isProduction).toBe(true);
    expect(env.nodeEnv).toBe('production');
  });
});
