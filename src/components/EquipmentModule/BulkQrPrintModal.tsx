import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Printer, CheckSquare, Square, Filter, Search, MapPin, Sliders, RefreshCw, Copy } from 'lucide-react';
import { Equipment, CampusLocation } from '../../types';
import QRCode from 'qrcode';

interface BulkQrPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipments: Equipment[];
  locations?: CampusLocation[];
  initialSelectedIds?: string[];
}

type LabelFormat = 'ticket-58' | 'ticket-80' | 'grid-sheet';
type QrPayloadType = 'json' | 'code-only';

interface QrItem {
  equipment: Equipment;
  dataUrl: string;
}

export const BulkQrPrintModal: React.FC<BulkQrPrintModalProps> = ({
  isOpen,
  onClose,
  equipments,
  locations = [],
  initialSelectedIds = [],
}) => {
  // Configuración de la etiqueta (según directiva: Encabezado + QR + Código del equipo debajo)
  const [headerText, setHeaderText] = useState('FCBV - SGC');
  const [labelFormat, setLabelFormat] = useState<LabelFormat>('ticket-58');
  const [qrPayloadType, setQrPayloadType] = useState<QrPayloadType>('json');
  const [copiesPerItem, setCopiesPerItem] = useState<number>(1);
  const [qrSize, setQrSize] = useState<'sm' | 'md' | 'lg'>('md');

  // Filtros de selección
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string>('todas');
  const [selectedStatus, setSelectedStatus] = useState<'activos' | 'todos'>('activos');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Generación de QRs en Base64
  const [qrList, setQrList] = useState<QrItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Inicializar selección
  useEffect(() => {
    if (isOpen) {
      if (initialSelectedIds && initialSelectedIds.length > 0) {
        setSelectedIds(new Set(initialSelectedIds));
      } else {
        // Por defecto, preseleccionar todos los equipos activos
        const activeIds = equipments.filter((e) => e.status === 'activo').map((e) => e.id);
        setSelectedIds(new Set(activeIds));
      }
    }
  }, [isOpen, initialSelectedIds, equipments]);

  // Lista de ubicaciones para el filtro
  const locationList = useMemo(() => {
    const set = new Set<string>();
    equipments.forEach((e) => {
      if (e.location) set.add(e.location);
    });
    locations.forEach((l) => {
      if (l.name) set.add(l.name);
    });
    return Array.from(set).sort();
  }, [equipments, locations]);

  // Equipos filtrados disponibles para seleccionar
  const filteredEquipments = useMemo(() => {
    return equipments.filter((eq) => {
      if (selectedStatus === 'activos' && eq.status !== 'activo') {
        return false;
      }
      if (selectedLocation !== 'todas' && eq.location !== selectedLocation) {
        return false;
      }
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const match =
          eq.code.toLowerCase().includes(term) ||
          eq.name.toLowerCase().includes(term) ||
          eq.location.toLowerCase().includes(term) ||
          (eq.serial && eq.serial.toLowerCase().includes(term));
        if (!match) return false;
      }
      return true;
    });
  }, [equipments, selectedStatus, selectedLocation, searchTerm]);

  // Equipos seleccionados actualmente
  const selectedEquipments = useMemo(() => {
    return equipments.filter((eq) => selectedIds.has(eq.id));
  }, [equipments, selectedIds]);

  // Generar QRs para todos los equipos seleccionados
  useEffect(() => {
    let isCancelled = false;

    async function generateQrs() {
      if (!isOpen || selectedEquipments.length === 0) {
        setQrList([]);
        return;
      }

      setIsGenerating(true);
      const items: QrItem[] = [];

      for (const eq of selectedEquipments) {
        if (isCancelled) return;

        let payload = eq.code;
        if (qrPayloadType === 'json') {
          payload = JSON.stringify({
            app: 'FCBV_SGC',
            id: eq.id,
            code: eq.code,
            serial: eq.serial || '',
            name: eq.name,
            loc: eq.location,
          });
        }

        try {
          const dataUrl = await QRCode.toDataURL(payload, {
            width: 320,
            margin: 1,
            color: {
              dark: '#000000',
              light: '#ffffff',
            },
            errorCorrectionLevel: 'M',
          });
          items.push({ equipment: eq, dataUrl });
        } catch (err) {
          console.error('Error generando QR para', eq.code, err);
        }
      }

      if (!isCancelled) {
        setQrList(items);
        setIsGenerating(false);
      }
    }

    generateQrs();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, selectedEquipments, qrPayloadType]);

  // Selección masiva
  const handleSelectAllFiltered = () => {
    const newSet = new Set(selectedIds);
    filteredEquipments.forEach((e) => newSet.add(e.id));
    setSelectedIds(newSet);
  };

  const handleDeselectAllFiltered = () => {
    const newSet = new Set(selectedIds);
    filteredEquipments.forEach((e) => newSet.delete(e.id));
    setSelectedIds(newSet);
  };

  const handleToggleSelectOne = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  // Disparar Impresión Nativa
  const handlePrint = () => {
    if (qrList.length === 0) return;
    window.print();
  };

  if (!isOpen) return null;

  // Clases de tamaño QR según configuración
  const qrPixelSize = qrSize === 'sm' ? 'w-24 h-24' : qrSize === 'lg' ? 'w-40 h-40' : 'w-32 h-32';
  const qrPxPrint = qrSize === 'sm' ? '90px' : qrSize === 'lg' ? '150px' : '120px';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs">
      {/* Estilos CSS dedicados e inyectados exclusivamente para impresión en impresora térmica */}
      <style>{`
        @media print {
          /* Ocultar todo el sitio web excepto el área imprimible */
          body * {
            visibility: hidden !important;
          }
          #qr-thermal-print-container, #qr-thermal-print-container * {
            visibility: visible !important;
          }
          #qr-thermal-print-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }

          /* Formato Ticket 58mm */
          .ticket-58-label {
            width: 48mm !important;
            max-width: 48mm !important;
            margin: 0 auto 4mm auto !important;
            padding: 2mm 1mm !important;
            page-break-after: always !important;
            break-after: page !important;
            box-sizing: border-box !important;
            text-align: center !important;
            background: #fff !important;
            color: #000 !important;
            border: none !important;
          }

          /* Formato Ticket 80mm */
          .ticket-80-label {
            width: 72mm !important;
            max-width: 72mm !important;
            margin: 0 auto 5mm auto !important;
            padding: 3mm 2mm !important;
            page-break-after: always !important;
            break-after: page !important;
            box-sizing: border-box !important;
            text-align: center !important;
            background: #fff !important;
            color: #000 !important;
            border: none !important;
          }

          /* Formato Hoja de Stickers / Grid Carta */
          .grid-sheet-container {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 4mm !important;
            width: 100% !important;
            padding: 5mm !important;
          }
          .grid-sheet-label {
            border: 1px dashed #777 !important;
            padding: 3mm !important;
            page-break-inside: avoid !important;
            text-align: center !important;
            background: #fff !important;
          }

          .print-header-title {
            font-family: Arial, sans-serif !important;
            font-size: 11pt !important;
            font-weight: 800 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.5px !important;
            color: #000000 !important;
            margin-bottom: 2mm !important;
            line-height: 1.1 !important;
          }

          .print-qr-img {
            width: ${qrPxPrint} !important;
            height: ${qrPxPrint} !important;
            margin: 0 auto !important;
            display: block !important;
            image-rendering: pixelated !important;
          }

          .print-code-text {
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 14pt !important;
            font-weight: 900 !important;
            color: #000000 !important;
            margin-top: 2mm !important;
            letter-spacing: 1px !important;
            line-height: 1.1 !important;
          }

          @page {
            margin: 0;
            size: auto;
          }
        }
      `}</style>

      {/* Contenedor Modal */}
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/30 border border-indigo-400/40 rounded-xl text-indigo-300">
              <Printer className="w-5 h-5 text-indigo-200" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Impresión Masiva de Etiquetas QR
                <span className="px-2 py-0.5 bg-indigo-500/30 border border-indigo-400/30 text-indigo-200 rounded-full text-xs font-semibold">
                  Impresoras de Tickets / Térmicas
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                Genera e imprime etiquetas adhesivas físicas con código QR de identificación institucional
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Split en 2 columnas (Configuración/Selección + Vista Previa) */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-0">
          
          {/* Panel Izquierdo: Configuración y Selección (5 Cols) */}
          <div className="lg:col-span-5 border-r border-slate-200 p-4 sm:p-5 overflow-y-auto bg-slate-50/50 space-y-4">
            
            {/* 1. Ajustes del Formato de Etiqueta */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider">
                <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                <span>Formato de Etiqueta</span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Texto del Encabezado:
                </label>
                <input
                  type="text"
                  value={headerText}
                  onChange={(e) => setHeaderText(e.target.value)}
                  placeholder="Ej: FCBV - SGC o INSTITUCIÓN"
                  className="w-full px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Aparece centrado en la parte superior de cada etiqueta.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Tipo de Impresora:
                  </label>
                  <select
                    value={labelFormat}
                    onChange={(e) => setLabelFormat(e.target.value as LabelFormat)}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                  >
                    <option value="ticket-58">Rollo 58 mm (Estándar POS)</option>
                    <option value="ticket-80">Rollo 80 mm (Ancho POS)</option>
                    <option value="grid-sheet">Hoja Adhesiva (Rejilla)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Tamaño del QR:
                  </label>
                  <select
                    value={qrSize}
                    onChange={(e) => setQrSize(e.target.value as 'sm' | 'md' | 'lg')}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                  >
                    <option value="sm">Compacto (25mm)</option>
                    <option value="md">Mediano (32mm)</option>
                    <option value="lg">Grande (40mm)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Copias por Equipo:
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCopiesPerItem(Math.max(1, copiesPerItem - 1))}
                      className="px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded text-xs font-bold text-slate-700"
                    >
                      -
                    </button>
                    <span className="w-8 text-center text-xs font-bold text-slate-800">{copiesPerItem}</span>
                    <button
                      type="button"
                      onClick={() => setCopiesPerItem(Math.min(10, copiesPerItem + 1))}
                      className="px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded text-xs font-bold text-slate-700"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Contenido del QR:
                  </label>
                  <select
                    value={qrPayloadType}
                    onChange={(e) => setQrPayloadType(e.target.value as QrPayloadType)}
                    className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                  >
                    <option value="json">Datos Completos (App)</option>
                    <option value="code-only">Solo Código Texto</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 2. Filtros y Búsqueda de Equipos */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider">
                  <Filter className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Filtro de Equipos</span>
                </div>
                <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                  {selectedIds.size} seleccionados
                </span>
              </div>

              {/* Búsqueda rápida */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por código, nombre, serial..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              {/* Filtro por Ubicación y Estado */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5">Ubicación:</label>
                  <select
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                  >
                    <option value="todas">Todas las ubicaciones</option>
                    {locationList.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5">Estado:</label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value as 'activos' | 'todos')}
                    className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                  >
                    <option value="activos">Solo Activos</option>
                    <option value="todos">Todos (incluye dados de baja)</option>
                  </select>
                </div>
              </div>

              {/* Botones de Selección Rápida */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>Marcar mostrados ({filteredEquipments.length})</span>
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAllFiltered}
                  className="text-slate-500 hover:text-slate-700 font-medium flex items-center gap-1 cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>Desmarcar</span>
                </button>
              </div>
            </div>

            {/* 3. Lista de Casillas de Equipos */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="px-3 py-2 bg-slate-100/70 border-b border-slate-200 text-[11px] font-bold text-slate-600 flex justify-between items-center">
                <span>Equipos ({filteredEquipments.length})</span>
                <span className="text-[10px] font-normal text-slate-500">Selecciona los que desees imprimir</span>
              </div>
              <div className="max-h-52 overflow-y-auto divide-y divide-slate-100">
                {filteredEquipments.length > 0 ? (
                  filteredEquipments.map((eq) => {
                    const isChecked = selectedIds.has(eq.id);
                    return (
                      <label
                        key={eq.id}
                        className={`flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 cursor-pointer transition-colors ${
                          isChecked ? 'bg-indigo-50/50' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSelectOne(eq.id)}
                          className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-0 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-xs text-slate-800">{eq.code}</span>
                            <span className="text-[11px] text-slate-600 truncate">{eq.name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400">
                            <span className="flex items-center gap-0.5 truncate">
                              <MapPin className="w-2.5 h-2.5" />
                              {eq.location}
                            </span>
                            {eq.serial && <span>• S/N: {eq.serial}</span>}
                          </div>
                        </div>
                      </label>
                    );
                  })
                ) : (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No hay equipos con los filtros seleccionados
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Panel Derecho: Vista Previa Real de las Etiquetas (7 Cols) */}
          <div className="lg:col-span-7 p-4 sm:p-5 flex flex-col bg-slate-100/80 overflow-hidden">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Vista Previa de Impresión
                </span>
                <span className="text-[11px] font-semibold bg-white px-2 py-0.5 rounded-full border border-slate-200 text-slate-600">
                  {selectedIds.size * copiesPerItem} etiquetas en total
                </span>
              </div>
              {isGenerating && (
                <div className="flex items-center gap-1.5 text-xs text-indigo-600 font-medium">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Generando QRs...</span>
                </div>
              )}
            </div>

            {/* Contenedor con Scroll de la Vista Previa */}
            <div className="flex-1 overflow-y-auto bg-slate-200/80 rounded-xl p-4 border border-slate-300 flex flex-col items-center">
              
              {/* Estructura que se imprimirá exactamente */}
              <div
                id="qr-thermal-print-container"
                ref={printAreaRef}
                className={
                  labelFormat === 'grid-sheet'
                    ? 'grid grid-cols-2 sm:grid-cols-3 gap-3 w-full'
                    : 'flex flex-col items-center gap-4 w-full'
                }
              >
                {qrList.length > 0 ? (
                  qrList.flatMap(({ equipment, dataUrl }) =>
                    Array.from({ length: copiesPerItem }).map((_, copyIndex) => (
                      <div
                        key={`${equipment.id}-copy-${copyIndex}`}
                        className={`bg-white border border-slate-400 shadow-sm flex flex-col items-center justify-center text-center ${
                          labelFormat === 'ticket-58'
                            ? 'ticket-58-label w-52 p-3 rounded-md'
                            : labelFormat === 'ticket-80'
                            ? 'ticket-80-label w-64 p-4 rounded-md'
                            : 'grid-sheet-label p-3 rounded-md'
                        }`}
                      >
                        {/* 1. ENCABEZADO (Sin "Mantenimiento Preventivo", sólo el encabezado institucional) */}
                        {headerText.trim() && (
                          <div className="print-header-title text-xs sm:text-sm font-black text-black uppercase tracking-wider mb-1.5 select-none">
                            {headerText}
                          </div>
                        )}

                        {/* 2. CÓDIGO QR */}
                        <div className="my-1 flex items-center justify-center">
                          <img
                            src={dataUrl}
                            alt={`QR ${equipment.code}`}
                            className={`print-qr-img ${qrPixelSize} object-contain border border-slate-100`}
                          />
                        </div>

                        {/* 3. CÓDIGO DEL EQUIPO DEBAJO (Destacado en negrita y tipografía mono) */}
                        <div className="print-code-text font-mono text-sm sm:text-base font-black text-black tracking-widest mt-1 select-none">
                          {equipment.code}
                        </div>
                      </div>
                    ))
                  )
                ) : (
                  <div className="py-20 text-center text-slate-400">
                    <Printer className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm font-medium text-slate-600">No hay etiquetas seleccionadas</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Marca al menos un equipo en el panel izquierdo para previsualizar e imprimir.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Ayuda sobre configuración de impresora */}
            <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900 flex items-start gap-2 shrink-0">
              <span className="font-bold">Tip de Impresión:</span>
              <span>
                En la ventana del navegador que se abrirá al dar clic en <b>Imprimir</b>, selecciona tu impresora térmica de tickets y ajusta los <b>Márgenes</b> en "Ninguno" para un corte limpio entre etiquetas.
              </span>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            Total a imprimir: <b className="text-slate-800">{selectedIds.size * copiesPerItem} etiquetas</b>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              id="btn-confirm-print-tickets"
              onClick={handlePrint}
              disabled={selectedIds.size === 0 || isGenerating}
              className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-md flex items-center gap-2 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Lote de Etiquetas ({selectedIds.size * copiesPerItem})</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
