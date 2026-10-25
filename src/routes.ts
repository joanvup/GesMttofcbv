import type { ActiveTab } from './components/Navbar';

/**
 * Rutas URL canónicas de la aplicación (React Router).
 *
 * La pestaña activa se deriva de la URL en lugar de guardarse en estado, de modo
 * que cada módulo es enlazable, recargable y navegable con el historial del
 * navegador.
 */
export const TAB_PATHS: Record<ActiveTab, string> = {
  dashboard: '/panel',
  equipos: '/equipos',
  plan: '/plan',
  ejecucion: '/ejecucion',
  ubicaciones: '/ubicaciones',
  reportes: '/reportes',
  usuarios: '/usuarios',
  database: '/database',
};

const PATH_TABS = Object.fromEntries(
  Object.entries(TAB_PATHS).map(([tab, path]) => [path, tab as ActiveTab])
) as Record<string, ActiveTab>;

/** Pestaña correspondiente a una ruta; `null` si la ruta no es una pestaña conocida. */
export function pathToTab(pathname: string): ActiveTab | null {
  const clean = pathname.replace(/\/+$/, '') || '/';
  return PATH_TABS[clean] ?? null;
}

/** Pestaña por defecto según el rol (el revisor solo ve sus módulos permitidos). */
export function defaultTabForRole(role?: string): ActiveTab {
  return role === 'revisor' ? 'reportes' : 'dashboard';
}

/** Módulos visibles para el rol revisor (solo lectura SGC y reportes). */
export const REVISOR_TABS: readonly ActiveTab[] = ['ejecucion', 'reportes'];
