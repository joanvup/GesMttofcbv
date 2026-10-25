import { MaintenanceExecution, RecordStatus } from '../types';

/**
 * Utilidades del ciclo de vida SGC de las actas de mantenimiento.
 *
 * Se comparten entre la vista de ejecución (interfaz), el reporte F05 impreso y
 * la exportación a Excel, para que el estado mostrado sea siempre el mismo en
 * todos los canales.
 */

export type ExecutionActionName = 'approve' | 'close' | 'reopen';

export const RECORD_STATUS_LABELS: Record<RecordStatus, string> = {
  borrador: 'Borrador',
  aprobado: 'Aprobado',
  cerrado: 'Cerrado',
};

export interface SgcSummary {
  total: number;
  borrador: number;
  aprobado: number;
  cerrado: number;
}

/** Estado SGC de un acta, con `borrador` como valor por defecto. */
export function getRecordStatus(execution?: MaintenanceExecution | null): RecordStatus {
  return execution?.recordStatus ?? 'borrador';
}

/** Versión del acta, con 1 como valor por defecto. */
export function getRecordVersion(execution?: MaintenanceExecution | null): number {
  return execution?.recordVersion ?? 1;
}

/** Cuenta las actas por estado SGC. */
export function summarizeSgc(executions: MaintenanceExecution[]): SgcSummary {
  const summary: SgcSummary = { total: executions.length, borrador: 0, aprobado: 0, cerrado: 0 };
  executions.forEach((execution) => {
    summary[getRecordStatus(execution)] += 1;
  });
  return summary;
}

/** Usuario e instante de la última transición registrada en el acta. */
export function getSgcApproval(
  execution: MaintenanceExecution
): { actor?: string; at?: string; action: 'aprobado' | 'cerrado' } | null {
  const status = getRecordStatus(execution);
  if (status === 'cerrado') {
    return { actor: execution.closedBy, at: execution.closedAt, action: 'cerrado' };
  }
  if (status === 'aprobado') {
    return { actor: execution.approvedBy, at: execution.approvedAt, action: 'aprobado' };
  }
  return null;
}

/** Formatea una fecha ISO a `dd-mm-yyyy` (o devuelve el valor si no es válido). */
export function formatSgcDate(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}-${month}-${date.getFullYear()}`;
}

/** Columnas de trazabilidad SGC para la exportación a Excel del F05. */
export function buildSgcExportColumns(execution: MaintenanceExecution): {
  'Estado SGC': string;
  Versión: number;
  'Aprobado por': string;
  'Aprobado el': string;
  'Cerrado por': string;
  'Cerrado el': string;
} {
  return {
    'Estado SGC': RECORD_STATUS_LABELS[getRecordStatus(execution)],
    Versión: getRecordVersion(execution),
    'Aprobado por': execution.approvedBy || '',
    'Aprobado el': formatSgcDate(execution.approvedAt),
    'Cerrado por': execution.closedBy || '',
    'Cerrado el': formatSgcDate(execution.closedAt),
  };
}
