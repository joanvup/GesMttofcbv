import React from 'react';
import { Equipment, MaintenanceExecution } from '../../types';
import { ReportHeader } from './ReportHeader';

interface F05ExecutedMaintenanceReportProps {
  equipments: Equipment[];
  executions: MaintenanceExecution[];
  technicianSignature?: string | null;
}

// Firma vectorial de respaldo cursiva institucional cuando no hay imagen raster
const DefaultSignatureSvg: React.FC<{ name?: string }> = () => (
  <svg
    viewBox="0 0 160 50"
    className="w-24 h-9 mx-auto text-slate-800"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M 12,38 C 22,12 30,8 36,26 C 42,42 46,14 54,20 C 62,26 68,34 76,28 C 84,22 92,12 100,24 C 108,36 116,40 128,32 C 140,24 148,18 152,22 M 25,36 L 140,36"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const F05ExecutedMaintenanceReport: React.FC<F05ExecutedMaintenanceReportProps> = ({
  equipments,
  executions,
  technicianSignature,
}) => {
  const TOTAL_ROWS_PER_SHEET = 24;

  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-12 font-sans text-black">
      {equipments.map((eq) => {
        // Encontrar las ejecuciones de este equipo específico
        const eqExecutions = executions.filter(
          (ex) => ex.equipmentId === eq.id && ex.isExecuted
        );

        // Generar las filas restantes en blanco hasta completar la hoja estándar
        const remainingBlankRowsCount = Math.max(
          1,
          TOTAL_ROWS_PER_SHEET - eqExecutions.length
        );
        const blankRows = Array.from({ length: remainingBlankRowsCount });

        const displayName = `${eq.name} - ${eq.location || 'Campus General'}`;

        return (
          <div
            key={eq.id}
            className="bg-white p-6 sm:p-10 shadow-lg print:shadow-none border border-slate-200 print:border-none mx-auto max-w-[850px] min-h-[1050px] flex flex-col justify-between print:min-h-0 print:p-0 page-break-after-always"
          >
            <div>
              {/* Encabezado Institucional FCBV */}
              <ReportHeader
                title="REGISTRO DE MANTENIMIENTO EJECUTADO DE EQUIPOS"
                code="PA – 03 – F05"
                version="3"
                validity="18 - 09 - 24"
                currentPage={1}
                totalPages={1}
              />

              {/* Sub-encabezado: Identificación del Equipo */}
              <div className="mt-4 border-2 border-black text-xs overflow-hidden">
                <div className="grid grid-cols-12 bg-slate-200/80 font-bold border-b border-black text-left text-[11px]">
                  <div className="col-span-3 py-1.5 px-3 border-r border-black uppercase">
                    Código
                  </div>
                  <div className="col-span-9 py-1.5 px-3 uppercase">
                    Nombre del Equipo
                  </div>
                </div>
                <div className="grid grid-cols-12 bg-white font-semibold text-xs min-h-[30px] items-center">
                  <div className="col-span-3 py-1.5 px-3 border-r border-black font-mono font-bold">
                    {eq.code}
                  </div>
                  <div className="col-span-9 py-1.5 px-3 font-medium">
                    {displayName}
                  </div>
                </div>
              </div>

              {/* Tabla de Registros Ejecutados */}
              <div className="mt-3 border-2 border-black overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-200/80 font-bold border-b border-black text-[11px] text-center">
                      <th className="py-1.5 px-2 border-r border-black w-28 uppercase">
                        Fecha
                      </th>
                      <th className="py-1.5 px-3 border-r border-black uppercase text-left">
                        Descripción del Mantenimiento
                      </th>
                      <th className="py-1.5 px-2 border-r border-black w-36 uppercase">
                        Firma Elaboró
                      </th>
                      <th className="py-1.5 px-2 w-36 uppercase">
                        Firma Revisó
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black bg-white text-black">
                    {/* Filas con ejecuciones reales */}
                    {eqExecutions.map((ex) => {
                      const descriptionText =
                        ex.completedTasks && ex.completedTasks.length > 0
                          ? ex.completedTasks.join(', ')
                          : eq.maintenanceTasks.join(', ') || 'Mantenimiento Preventivo General';

                      const sigToUse = ex.signatureDataUrl || technicianSignature;

                      return (
                        <tr key={ex.id} className="min-h-[36px]">
                          <td className="py-1 px-2 border-r border-black text-center font-mono text-[11px] font-semibold align-middle">
                            {formatDate(ex.executedDate || ex.scheduledDate)}
                          </td>
                          <td className="py-1 px-3 border-r border-black text-[11px] leading-snug align-middle">
                            {descriptionText}
                          </td>
                          <td className="py-0.5 px-2 border-r border-black text-center align-middle">
                            {sigToUse ? (
                              <img
                                src={sigToUse}
                                alt="Firma Elaboró"
                                className="h-8 max-w-[120px] mx-auto object-contain"
                              />
                            ) : (
                              <DefaultSignatureSvg />
                            )}
                          </td>
                          <td className="py-0.5 px-2 text-center align-middle">
                            {sigToUse ? (
                              <img
                                src={sigToUse}
                                alt="Firma Revisó"
                                className="h-8 max-w-[120px] mx-auto object-contain"
                              />
                            ) : (
                              <DefaultSignatureSvg />
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Filas pautadas vacías para completar el formato institucional físico */}
                    {blankRows.map((_, idx) => (
                      <tr key={`blank-row-${idx}`} className="h-[32px]">
                        <td className="py-1 px-2 border-r border-black">&nbsp;</td>
                        <td className="py-1 px-3 border-r border-black">&nbsp;</td>
                        <td className="py-1 px-2 border-r border-black">&nbsp;</td>
                        <td className="py-1 px-2">&nbsp;</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pie de página normativo */}
            <div className="mt-6 pt-3 text-center text-[10px] text-slate-600 tracking-wide select-none">
              Una vez impreso este documento se considera copia no controlada
            </div>
          </div>
        );
      })}

      {equipments.length === 0 && (
        <div className="bg-white p-12 text-center text-slate-500 rounded-xl border border-slate-200">
          No hay equipos seleccionados para generar el registro de mantenimiento ejecutado.
        </div>
      )}
    </div>
  );
};
