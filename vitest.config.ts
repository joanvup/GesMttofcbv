import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    // better-sqlite3 es un módulo nativo: usar procesos separados y sin paralelismo
    // evita condiciones de carrera y problemas con el binario.
    pool: 'forks',
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 15000,
    env: {
      TZ: 'America/Bogota',
    },
  },
});
