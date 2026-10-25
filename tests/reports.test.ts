import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { F05ExecutedMaintenanceReport } from '../src/components/ReportsModule/F05ExecutedMaintenanceReport';
import { Equipment, MaintenanceExecution } from '../src/types';

const equipment: Equipment = {
  id: 'eq_1',
  code: 'AP-01',
  name: 'Aire Acondicionado Sala de Servidores',
  location: 'Data Center Principal',
  brand: 'Marca',
  model: 'Modelo',
  serial: 'SER-1',
  frequency: 'mensual',
  parts: [],
  maintenanceTasks: ['Limpieza de filtros', 'Revisión de gas'],
  observations: '',
  status: 'activo',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function execution(overrides: Partial<MaintenanceExecution>): MaintenanceExecution {
  return {
    id: 'exec_1',
    equipmentId: 'eq_1',
    year: 2026,
    month: 3,
    scheduledDate: '2026-03-10',
    isExecuted: true,
    executedDate: '2026-03-10 09:00',
    responsibleName: 'Técnico FCBV',
    completedTasks: ['Limpieza de filtros'],
    createdAt: '2026-03-10T09:00:00.000Z',
    updatedAt: '2026-03-10T09:00:00.000Z',
    ...overrides,
  };
}

function render(executions: MaintenanceExecution[]): string {
  return renderToStaticMarkup(
    React.createElement(F05ExecutedMaintenanceReport, {
      equipments: [equipment],
      executions,
    })
  );
}

describe('Reporte F05 impreso y estado SGC', () => {
  it('muestra la columna Estado SGC en el encabezado del formato', () => {
    const html = render([]);
    expect(html).toContain('Estado SGC');
    expect(html).toContain('Revisión SGC');
  });

  it('refleja un acta cerrada con su versión y el sello de cierre', () => {
    const html = render([
      execution({
        recordStatus: 'cerrado',
        recordVersion: 3,
        approvedBy: 'revisor',
        approvedAt: '2026-03-12T15:30:00.000Z',
        closedBy: 'admin',
        closedAt: '2026-03-20T09:00:00.000Z',
      }),
    ]);

    expect(html).toContain('Cerrado');
    expect(html).toContain('v3');
    expect(html).toContain('admin');
    expect(html).toContain('20-03-2026');
  });

  it('marca como pendiente de aprobación un acta en borrador', () => {
    const html = render([execution({ recordStatus: 'borrador', recordVersion: 1 })]);
    expect(html).toContain('Borrador');
    expect(html).toContain('Pendiente de aprobación');
  });

  it('resume el estado SGC de las actas del equipo', () => {
    const html = render([
      execution({ id: 'a', recordStatus: 'aprobado', recordVersion: 2 }),
      execution({ id: 'b', recordStatus: 'cerrado', recordVersion: 3 }),
    ]);
    expect(html).toContain('1 cerrada(s)');
    expect(html).toContain('1 aprobada(s)');
    expect(html).toContain('0 en borrador');
  });
});
