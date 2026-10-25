import { describe, expect, it } from 'vitest';
import { MaintenanceExecution } from '../src/types';
import {
  buildSgcExportColumns,
  formatSgcDate,
  getRecordStatus,
  getRecordVersion,
  getSgcApproval,
  summarizeSgc,
} from '../src/services/sgc';

function makeExecution(overrides: Partial<MaintenanceExecution> = {}): MaintenanceExecution {
  return {
    id: 'exec_1',
    equipmentId: 'eq_1',
    year: 2026,
    month: 3,
    isExecuted: true,
    completedTasks: [],
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('Estado SGC de las actas', () => {
  it('asume borrador y versión 1 cuando el acta no trae metadatos SGC', () => {
    const execution = makeExecution();
    expect(getRecordStatus(execution)).toBe('borrador');
    expect(getRecordVersion(execution)).toBe(1);
    expect(getRecordStatus(null)).toBe('borrador');
    expect(getRecordVersion(undefined)).toBe(1);
  });

  it('resume las actas por estado', () => {
    const summary = summarizeSgc([
      makeExecution({ id: 'a', recordStatus: 'borrador' }),
      makeExecution({ id: 'b', recordStatus: 'aprobado' }),
      makeExecution({ id: 'c', recordStatus: 'aprobado' }),
      makeExecution({ id: 'd', recordStatus: 'cerrado' }),
    ]);

    expect(summary).toEqual({ total: 4, borrador: 1, aprobado: 2, cerrado: 1 });
  });

  it('no reporta aprobación mientras el acta está en borrador', () => {
    const execution = makeExecution({ recordStatus: 'borrador', approvedBy: 'intruso' });
    expect(getSgcApproval(execution)).toBeNull();
  });

  it('reporta la aprobación de un acta aprobada', () => {
    const execution = makeExecution({
      recordStatus: 'aprobado',
      approvedBy: 'revisor',
      approvedAt: '2026-03-12T15:30:00.000Z',
    });
    expect(getSgcApproval(execution)).toEqual({
      actor: 'revisor',
      at: '2026-03-12T15:30:00.000Z',
      action: 'aprobado',
    });
  });

  it('prioriza el cierre cuando el acta ya está cerrada', () => {
    const execution = makeExecution({
      recordStatus: 'cerrado',
      approvedBy: 'revisor',
      approvedAt: '2026-03-12T15:30:00.000Z',
      closedBy: 'admin',
      closedAt: '2026-03-20T09:00:00.000Z',
    });
    expect(getSgcApproval(execution)).toEqual({
      actor: 'admin',
      at: '2026-03-20T09:00:00.000Z',
      action: 'cerrado',
    });
  });

  it('formatea las fechas SGC como dd-mm-yyyy', () => {
    expect(formatSgcDate('2026-03-12T15:30:00.000Z')).toBe('12-03-2026');
    expect(formatSgcDate(undefined)).toBe('');
    // Un valor no parseable se devuelve tal cual, sin romper el reporte.
    expect(formatSgcDate('sin-fecha')).toBe('sin-fecha');
  });

  it('construye las columnas de trazabilidad para Excel', () => {
    const columns = buildSgcExportColumns(
      makeExecution({
        recordStatus: 'cerrado',
        recordVersion: 3,
        approvedBy: 'revisor',
        approvedAt: '2026-03-12T15:30:00.000Z',
        closedBy: 'admin',
        closedAt: '2026-03-20T09:00:00.000Z',
      })
    );

    expect(columns).toEqual({
      'Estado SGC': 'Cerrado',
      Versión: 3,
      'Aprobado por': 'revisor',
      'Aprobado el': '12-03-2026',
      'Cerrado por': 'admin',
      'Cerrado el': '20-03-2026',
    });
  });

  it('deja vacías las columnas SGC de un acta en borrador', () => {
    const columns = buildSgcExportColumns(makeExecution());
    expect(columns['Estado SGC']).toBe('Borrador');
    expect(columns.Versión).toBe(1);
    expect(columns['Aprobado por']).toBe('');
    expect(columns['Cerrado el']).toBe('');
  });
});
