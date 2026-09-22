import React from 'react';
import { Equipment } from '../../types';
import { ReportHeader } from './ReportHeader';

interface F02TechnicalSheetReportProps {
  equipments: Equipment[];
}

export const F02TechnicalSheetReport: React.FC<F02TechnicalSheetReportProps> = ({
  equipments,
}) => {
  const formatFrequencyLabel = (freq: string): string => {
    switch (freq) {
      case 'mensual':
        return 'MENSUAL';
      case 'trimestral':
        return 'TRIMESTRAL (4 VECES AL AÑO)';
      case 'semestral':
        return 'SEMESTRAL (CADA 6 MESES)';
      case 'anual':
        return '1 AÑO';
      default:
        return String(freq).toUpperCase();
    }
  };

  return (
    <div className="space-y-12 font-sans text-black">
      {equipments.map((eq, index) => {
        // Preparar partes (mínimo 10 celdas para mantener la grilla idéntica al formato)
        const partsList = eq.parts && eq.parts.length > 0 ? eq.parts : ['Componente principal'];
        const totalPartCells = Math.max(12, Math.ceil(partsList.length / 2) * 2);
        const partRows: string[][] = [];
        for (let i = 0; i < totalPartCells; i += 2) {
          partRows.push([partsList[i] || '', partsList[i + 1] || '']);
        }

        // Preparar mantenimientos a efectuar (mínimo 6 celdas)
        const tasksList =
          eq.maintenanceTasks && eq.maintenanceTasks.length > 0
            ? eq.maintenanceTasks
            : ['Inspección y limpieza preventiva general'];
        const totalTaskCells = Math.max(6, Math.ceil(tasksList.length / 2) * 2);
        const taskRows: string[][] = [];
        for (let i = 0; i < totalTaskCells; i += 2) {
          taskRows.push([tasksList[i] || '', tasksList[i + 1] || '']);
        }

        return (
          <div
            key={eq.id}
            className="bg-white p-6 sm:p-10 shadow-lg print:shadow-none border border-slate-200 print:border-none mx-auto max-w-[850px] min-h-[1050px] flex flex-col justify-between print:min-h-0 print:p-0 page-break-after-always"
          >
            <div>
              {/* Encabezado Institucional FCBV */}
              <ReportHeader
                title="FICHA TÉCNICA"
                code="PA – 03 – F02"
                version="3"
                validity="18 - 09 - 24"
                currentPage={1}
                totalPages={1}
              />

              {/* Cuadro de Código */}
              <div className="mt-4 w-36 border-2 border-black text-center text-xs">
                <div className="bg-slate-200/80 font-bold py-1 border-b border-black uppercase text-[11px]">
                  CÓDIGO
                </div>
                <div className="py-1.5 font-bold font-mono text-sm tracking-wide bg-white">
                  {eq.code}
                </div>
              </div>

              {/* Bloque 1: Descripción y Área/Ubicación */}
              <div className="mt-3 border-2 border-black text-xs">
                <div className="grid grid-cols-12 bg-slate-200/80 font-bold border-b border-black text-center text-[11px]">
                  <div className="col-span-7 py-1.5 border-r border-black uppercase">
                    DESCRIPCIÓN DEL EQUIPO
                  </div>
                  <div className="col-span-5 py-1.5 uppercase">
                    ÁREA / UBICACIÓN
                  </div>
                </div>
                <div className="grid grid-cols-12 text-center text-xs font-semibold bg-white min-h-[28px] items-center">
                  <div className="col-span-7 py-2 px-3 border-r border-black">
                    {eq.name}
                  </div>
                  <div className="col-span-5 py-2 px-3">
                    {eq.location || 'Campus General'}
                  </div>
                </div>
              </div>

              {/* Bloque 2: Fabricante, Modelo, Serial */}
              <div className="mt-2.5 border-2 border-black text-xs">
                <div className="grid grid-cols-3 bg-slate-200/80 font-bold border-b border-black text-center text-[11px]">
                  <div className="py-1.5 border-r border-black uppercase">
                    FABRICANTE (MARCA)
                  </div>
                  <div className="py-1.5 border-r border-black uppercase">
                    MODELO
                  </div>
                  <div className="py-1.5 uppercase">
                    SERIAL
                  </div>
                </div>
                <div className="grid grid-cols-3 text-center text-xs font-semibold bg-white min-h-[28px] items-center">
                  <div className="py-2 px-2 border-r border-black font-medium uppercase">
                    {eq.brand || 'N/A'}
                  </div>
                  <div className="py-2 px-2 border-r border-black font-medium">
                    {eq.model || 'N/A'}
                  </div>
                  <div className="py-2 px-2 font-mono font-medium text-[11px] break-all">
                    {eq.serial || 'S/N'}
                  </div>
                </div>
              </div>

              {/* Bloque 3: Partes del Equipo */}
              <div className="mt-2.5 border-2 border-black text-xs">
                <div className="bg-slate-200/80 font-bold border-b border-black py-1.5 text-center text-[11px] uppercase">
                  PARTES DEL EQUIPO
                </div>
                <div className="divide-y divide-black bg-white">
                  {partRows.map((row, rIdx) => (
                    <div key={`part-row-${rIdx}`} className="grid grid-cols-2 text-[11px] min-h-[24px]">
                      <div className="py-1 px-3 border-r border-black uppercase font-medium">
                        {row[0]}
                      </div>
                      <div className="py-1 px-3 uppercase font-medium">
                        {row[1]}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bloque 4: Mantenimientos a Efectuar */}
              <div className="mt-2.5 border-2 border-black text-xs">
                <div className="bg-slate-200/80 font-bold border-b border-black py-1.5 text-center text-[11px] uppercase">
                  MANTENIMIENTOS A EFECTUAR
                </div>
                <div className="divide-y divide-black bg-white">
                  {taskRows.map((row, rIdx) => (
                    <div key={`task-row-${rIdx}`} className="grid grid-cols-2 text-[11px] min-h-[24px]">
                      <div className="py-1 px-3 border-r border-black uppercase font-medium">
                        {row[0]}
                      </div>
                      <div className="py-1 px-3 uppercase font-medium">
                        {row[1]}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bloque 5: Frecuencia de Mantenimiento */}
              <div className="mt-2.5 border-2 border-black text-xs grid grid-cols-12 items-stretch">
                <div className="col-span-4 bg-slate-200/80 font-bold py-1.5 px-3 border-r border-black text-center text-[11px] uppercase flex items-center justify-center">
                  FRECUENCIA MTTO
                </div>
                <div className="col-span-8 py-1.5 px-4 font-bold text-center text-xs uppercase flex items-center justify-center bg-white">
                  {formatFrequencyLabel(eq.frequency)}
                </div>
              </div>

              {/* Bloque 6: Observaciones Generales */}
              <div className="mt-2.5 border-2 border-black text-xs">
                <div className="bg-slate-200/80 font-bold border-b border-black py-1.5 text-center text-[11px] uppercase">
                  OBSERVACIONES GENERALES
                </div>
                <div className="p-3 min-h-[90px] bg-white text-xs leading-relaxed">
                  {eq.observations ? (
                    <p className="whitespace-pre-line">{eq.observations}</p>
                  ) : (
                    <span className="text-slate-400 italic text-[11px] print:hidden">
                      Sin observaciones registradas.
                    </span>
                  )}
                </div>
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
          No hay equipos seleccionados para generar la ficha técnica.
        </div>
      )}
    </div>
  );
};
