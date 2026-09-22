import React, { useMemo } from 'react';
import { Equipment } from '../../types';
import { ReportHeader } from './ReportHeader';

interface F01EquipmentListReportProps {
  equipments: Equipment[];
  rowsPerPage?: number;
}

export const F01EquipmentListReport: React.FC<F01EquipmentListReportProps> = ({
  equipments,
  rowsPerPage = 36,
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
          key={`page-${pageIndex}`}
          className="bg-white p-6 sm:p-10 shadow-lg print:shadow-none border border-slate-200 print:border-none mx-auto max-w-[850px] min-h-[1050px] flex flex-col justify-between print:min-h-0 print:p-0 page-break-after-always"
        >
          {/* Header oficial FCBV */}
          <div>
            <ReportHeader
              title="LISTADO DE EQUIPOS CRÍTICOS"
              code="PA – 03 – F01"
              version="3"
              validity="18 - 09 - 24"
              currentPage={pageIndex + 1}
              totalPages={totalPages}
            />

            {/* Tabla de Equipos Críticos */}
            <div className="mt-5 border-2 border-black overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-black text-white font-bold text-xs uppercase tracking-wider">
                    <th className="py-2 px-3 border-r border-black w-28 text-center font-bold">
                      Codigo
                    </th>
                    <th className="py-2 px-3 border-r border-black font-bold">
                      Nombre
                    </th>
                    <th className="py-2 px-3 w-56 font-bold">
                      Ubicación
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/60 text-black">
                  {pageEquipments.map((eq) => (
                    <tr
                      key={eq.id}
                      className="hover:bg-slate-100/60 print:hover:bg-transparent"
                    >
                      <td className="py-1.5 px-3 border-r border-black/60 font-semibold font-mono text-[11px] text-center">
                        {eq.code}
                      </td>
                      <td className="py-1.5 px-3 border-r border-black/60 text-[11px] font-medium">
                        {eq.name}
                      </td>
                      <td className="py-1.5 px-3 text-[11px] text-slate-900">
                        {eq.location || 'Campus General'}
                      </td>
                    </tr>
                  ))}

                  {pageEquipments.length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="py-8 text-center text-xs text-slate-500 italic"
                      >
                        No hay equipos críticos registrados para mostrar.
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
