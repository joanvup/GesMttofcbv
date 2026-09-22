import React, { useMemo } from 'react';
import { Equipment } from '../../types';
import { ReportHeader } from './ReportHeader';

interface F03MaintenanceScheduleReportProps {
  equipments: Equipment[];
  planMatrix: Record<string, boolean[]>;
  selectedYear: number;
  rowsPerPage?: number;
}

const MONTH_NAMES = [
  'Ene.',
  'Feb.',
  'Mar.',
  'Abr.',
  'May.',
  'Jun.',
  'Jul.',
  'Ago.',
  'Sep.',
  'Oct.',
  'Nov.',
  'Dic.',
];

export const F03MaintenanceScheduleReport: React.FC<F03MaintenanceScheduleReportProps> = ({
  equipments,
  planMatrix,
  selectedYear,
  rowsPerPage = 33,
}) => {
  // Paginación exacta para impresión
  const pages = useMemo(() => {
    if (!equipments || equipments.length === 0) return [[]];
    const result: Equipment[][] = [];
    for (let i = 0; i < equipments.length; i += rowsPerPage) {
      result.push(equipments.slice(i, i + rowsPerPage));
    }
    return result;
  }, [equipments, rowsPerPage]);

  const totalPages = pages.length;

  return (
    <div className="space-y-8 font-sans text-black">
      {pages.map((pageEquipments, pageIndex) => (
        <div
          key={`f03-page-${pageIndex}`}
          className="bg-white p-6 sm:p-10 shadow-lg print:shadow-none border border-slate-200 print:border-none mx-auto max-w-[900px] min-h-[1050px] flex flex-col justify-between print:min-h-0 print:p-0 page-break-after-always"
        >
          <div>
            {/* Encabezado Institucional FCBV */}
            <ReportHeader
              title="PROGRAMACIÓN DE MANTENIMIENTO PREVENTIVO DE EQUIPOS"
              code="PA – 03 – F03"
              version="3"
              validity="18 - 09 - 24"
              currentPage={pageIndex + 1}
              totalPages={totalPages}
            />

            {/* Tabla Matriz Anual de Cronograma */}
            <div className="mt-5 border-2 border-black overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  {/* Fila 1 de encabezado */}
                  <tr className="bg-slate-100 border-b border-black text-black">
                    <th
                      rowSpan={2}
                      className="py-1.5 px-2 border-r border-black w-18 text-center font-bold text-[11px]"
                    >
                      Código
                    </th>
                    <th
                      rowSpan={2}
                      className="py-1.5 px-3 border-r border-black font-bold text-[11px]"
                    >
                      Nombre del Equipo
                    </th>
                    <th
                      colSpan={12}
                      className="py-1 px-2 text-center font-bold border-b border-black text-xs bg-slate-200/80 uppercase"
                    >
                      Año: {selectedYear}
                    </th>
                  </tr>
                  {/* Fila 2: Los 12 meses */}
                  <tr className="bg-slate-50 border-b border-black text-[10px] text-center font-bold">
                    {MONTH_NAMES.map((m, idx) => (
                      <th
                        key={m}
                        className={`py-1 px-1 w-7 font-bold ${
                          idx < 11 ? 'border-r border-black' : ''
                        }`}
                      >
                        {m}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/60 text-black">
                  {pageEquipments.map((eq) => {
                    const schedule = planMatrix[eq.id] || new Array(12).fill(false);
                    const displayName = `${eq.name} - ${eq.location || 'Campus General'}`;

                    return (
                      <tr
                        key={eq.id}
                        className="hover:bg-slate-100/60 print:hover:bg-transparent"
                      >
                        <td className="py-1 px-1.5 border-r border-black/60 font-semibold font-mono text-[10px] text-center">
                          {eq.code}
                        </td>
                        <td className="py-1 px-2.5 border-r border-black/60 text-[10px] font-medium truncate max-w-[280px]">
                          {displayName}
                        </td>
                        {schedule.map((isScheduled, mIdx) => (
                          <td
                            key={`month-${mIdx}`}
                            className={`py-1 px-0.5 text-center text-xs font-black select-none ${
                              mIdx < 11 ? 'border-r border-black/60' : ''
                            } ${isScheduled ? 'bg-slate-100/80 font-mono text-black' : ''}`}
                          >
                            {isScheduled ? 'X' : ''}
                          </td>
                        ))}
                      </tr>
                    );
                  })}

                  {pageEquipments.length === 0 && (
                    <tr>
                      <td
                        colSpan={14}
                        className="py-8 text-center text-xs text-slate-500 italic"
                      >
                        No hay equipos programados para el año {selectedYear}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pie de página normativo */}
          <div className="mt-6 pt-3 text-center text-[10px] text-slate-600 tracking-wide select-none">
            Una vez impreso este documento se considera copia no controlada
          </div>
        </div>
      ))}
    </div>
  );
};
