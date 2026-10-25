import { describe, expect, it } from 'vitest';
import { REVISOR_TABS, TAB_PATHS, defaultTabForRole, pathToTab } from '../src/routes';

describe('Rutas de navegación (React Router)', () => {
  it('define una ruta distinta para cada pestaña', () => {
    const paths = Object.values(TAB_PATHS);
    expect(new Set(paths).size).toBe(paths.length);
    // Todas las rutas son absolutas.
    paths.forEach((path) => expect(path.startsWith('/')).toBe(true));
  });

  it('traduce cada ruta a su pestaña', () => {
    expect(pathToTab('/equipos')).toBe('equipos');
    expect(pathToTab('/plan')).toBe('plan');
    expect(pathToTab('/ejecucion')).toBe('ejecucion');
    expect(pathToTab('/reportes')).toBe('reportes');
  });

  it('normaliza la barra final y detecta rutas desconocidas', () => {
    expect(pathToTab('/plan/')).toBe('plan');
    expect(pathToTab('/')).toBeNull();
    expect(pathToTab('/no-existe')).toBeNull();
  });

  it('asigna la pestaña por defecto según el rol', () => {
    expect(defaultTabForRole('admin')).toBe('dashboard');
    expect(defaultTabForRole('revisor')).toBe('reportes');
    expect(defaultTabForRole(undefined)).toBe('dashboard');
  });

  it('limita los módulos del revisor a ejecución y reportes', () => {
    expect([...REVISOR_TABS]).toEqual(['ejecucion', 'reportes']);
  });
});
