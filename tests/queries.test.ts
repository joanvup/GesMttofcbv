import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { createQueryClient, queryKeys } from '../src/services/queries';

describe('Estado de servidor (TanStack Query)', () => {
  it('crea un cliente de consultas con valores por defecto razonables', () => {
    const client = createQueryClient();
    expect(client).toBeInstanceOf(QueryClient);

    const defaults = client.getDefaultOptions();
    expect(defaults.queries?.staleTime).toBe(30_000);
    expect(defaults.queries?.retry).toBe(1);
    expect(defaults.queries?.refetchOnWindowFocus).toBe(false);
  });

  it('usa claves de consulta estables por entidad', () => {
    expect(queryKeys.equipments).toEqual(['equipments']);
    expect(queryKeys.locations).toEqual(['locations']);
    expect(queryKeys.buildings).toEqual(['buildings']);
    expect(queryKeys.executions).toEqual(['executions']);
  });

  it('incluye el año en la clave del plan anual', () => {
    expect(queryKeys.annualPlan(2026)).toEqual(['annual-plan', 2026]);
    expect(queryKeys.annualPlan(2027)).not.toEqual(queryKeys.annualPlan(2026));
  });
});
