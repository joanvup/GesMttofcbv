import React from 'react';
import { FcbvLogo } from './FcbvLogo';

interface ReportHeaderProps {
  title: string;
  code: string; // ej: "PA – 03 – F01"
  version?: string; // default "3"
  validity?: string; // default "18 - 09 - 24"
  currentPage: number;
  totalPages: number;
}

export const ReportHeader: React.FC<ReportHeaderProps> = ({
  title,
  code,
  version = '3',
  validity = '18 - 09 - 24',
  currentPage,
  totalPages,
}) => {
  return (
    <div className="w-full border-2 border-black flex items-stretch bg-white text-black font-sans text-xs select-none">
      {/* Columna Izquierda: Escudo Institucional */}
      <div className="w-28 shrink-0 p-2 flex items-center justify-center border-r-2 border-black">
        <FcbvLogo size={70} />
      </div>

      {/* Columna Central: Título Oficial */}
      <div className="flex-1 px-4 py-2 flex items-center justify-center text-center border-r-2 border-black">
        <h1 className="text-sm sm:text-base md:text-lg font-black tracking-tight leading-snug uppercase">
          {title}
        </h1>
      </div>

      {/* Columna Derecha: Matriz de Control Documental */}
      <div className="w-44 shrink-0 flex flex-col justify-between divide-y divide-black text-[11px]">
        <div className="px-2.5 py-1 font-bold">
          <span>Cód: {code}</span>
        </div>
        <div className="px-2.5 py-1">
          <span>Versión: {version}</span>
        </div>
        <div className="px-2.5 py-1">
          <span>Vigencia: {validity}</span>
        </div>
        <div className="px-2.5 py-1">
          <span>
            Pág. {currentPage} de {totalPages}
          </span>
        </div>
      </div>
    </div>
  );
};
