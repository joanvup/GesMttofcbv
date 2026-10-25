import { QueryClient, useQuery } from '@tanstack/react-query';
import { StorageService } from './storage';

/**
 * Estado de servidor con TanStack Query.
 *
 * Las consultas comparten caché por clave, de modo que varios componentes leen
 * los mismos datos sin repetir peticiones. Las mutaciones (en `App`) actualizan
 * la caché de forma optimista y/o invalidan estas claves para releer del
 * servidor. Se conserva la capa offline de `StorageService`.
 */

export const queryKeys = {
  equipments: ['equipments'] as const,
  locations: ['locations'] as const,
  buildings: ['buildings'] as const,
  executions: ['executions'] as const,
  annualPlan: (year: number) => ['annual-plan', year] as const,
};

/** Cliente compartido: los datos se consideran frescos 30 s para evitar lecturas redundantes. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

export function useEquipments(enabled = true) {
  return useQuery({
    queryKey: queryKeys.equipments,
    queryFn: () => StorageService.getEquipmentList(),
    enabled,
  });
}

export function useAnnualPlan(year: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.annualPlan(year),
    queryFn: () => StorageService.getAnnualPlan(year),
    enabled,
  });
}

export function useExecutions(enabled = true) {
  return useQuery({
    queryKey: queryKeys.executions,
    queryFn: () => StorageService.getExecutions(),
    enabled,
  });
}

export function useLocations(enabled = true) {
  return useQuery({
    queryKey: queryKeys.locations,
    queryFn: () => StorageService.getLocations(),
    enabled,
  });
}

export function useBuildings(enabled = true) {
  return useQuery({
    queryKey: queryKeys.buildings,
    queryFn: () => StorageService.getBuildings(),
    enabled,
  });
}
