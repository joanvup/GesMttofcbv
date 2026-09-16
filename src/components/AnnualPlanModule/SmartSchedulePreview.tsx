import React, { useState, useMemo } from 'react';
import { 
  CalendarClock, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Layers, 
  Search, 
  CalendarDays,
  ArrowRight,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Tag
} from 'lucide-react';
import { SmartScheduleResult, DailyScheduleSlot } from '../../services/scheduler';

interface SmartSchedulePreviewProps {
  smartSchedule: SmartScheduleResult;
  maxPerDay: number;
  startMonthName: string;
  selectedYear: number;
}

export const SmartSchedulePreview: React.FC<SmartSchedulePreviewProps> = ({
  smartSchedule,
  maxPerDay,
  startMonthName,
  selectedYear,
}) => {
  const [activeTab, setActiveTab] = useState<'days' | 'locations'>('days');
  const [filterQuery, setFilterQuery] = useState('');
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  const { stats, dailySlots } = smartSchedule;

  // Filtrado de jornadas por texto
  const filteredSlots = useMemo(() => {
    if (!filterQuery.trim()) return dailySlots;
    const q = filterQuery.toLowerCase().trim();
    return dailySlots.filter((slot) => {
      const matchDay = slot.formattedDate.toLowerCase().includes(q) || slot.dayName.toLowerCase().includes(q);
      const matchLoc = slot.locationsSummary.some((l) => l.toLowerCase().includes(q));
      const matchEq = slot.equipments.some(
        (item) =>
          item.equipment.code.toLowerCase().includes(q) ||
          item.equipment.name.toLowerCase().includes(q)
      );
      return matchDay || matchLoc || matchEq;
    });
  }, [dailySlots, filterQuery]);

  // Agrupación por ubicación para la pestaña correspondiente
  const locationGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        location: string;
        count: number;
        equipments: { code: string; name: string; assignedDate: string }[];
        dates: Set<string>;
      }
    >();

    dailySlots.forEach((slot) => {
      slot.equipments.forEach((item) => {
        const loc = item.equipment.location || 'Sin Ubicación';
        if (!map.has(loc)) {
          map.set(loc, {
            location: loc,
            count: 0,
            equipments: [],
            dates: new Set(),
          });
        }
        const g = map.get(loc)!;
        g.count++;
        g.equipments.push({
          code: item.equipment.code,
          name: item.equipment.name,
          assignedDate: slot.formattedDate,
        });
        g.dates.add(slot.formattedDate);
      });
    });

    return Array.from(map.values()).sort((a, b) => a.location.localeCompare(b.location));
  }, [dailySlots]);

  if (stats.totalEquipments === 0) {
    return (
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-500 text-xs">
        Selecciona equipos para ver la simulación de programación inteligente.
      </div>
    );
  }

  return (
    <div className="space-y-3 bg-slate-50/80 p-3.5 rounded-xl border border-indigo-100">
      {/* 1. Métricas clave de la nivelación */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="p-2.5 bg-white rounded-lg border border-slate-200 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Equipos a Programar</span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-base font-black text-slate-900 font-mono">{stats.totalEquipments}</span>
            <span className="text-[10px] text-slate-500">equipos</span>
          </div>
        </div>

        <div className="p-2.5 bg-white rounded-lg border border-slate-200 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Jornadas Hábiles</span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-base font-black text-indigo-700 font-mono">{stats.totalDays}</span>
            <span className="text-[10px] text-slate-500">días hábiles</span>
          </div>
        </div>

        <div className="p-2.5 bg-white rounded-lg border border-slate-200 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Capacidad Máxima</span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-base font-black text-emerald-700 font-mono">{maxPerDay}</span>
            <span className="text-[10px] text-slate-500">equipos / día</span>
          </div>
        </div>

        <div className="p-2.5 bg-white rounded-lg border border-slate-200 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Intervenciones {selectedYear}</span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-base font-black text-indigo-900 font-mono">{stats.totalInterventionsInYear}</span>
            <span className="text-[10px] text-slate-500">en el año</span>
          </div>
        </div>
      </div>

      {/* 2. Banner de Análisis de Capacidad y Desborde de Mes */}
      {stats.spansMultipleMonths ? (
        <div className="p-3 bg-amber-50/90 border border-amber-300/80 rounded-xl text-xs text-amber-900 space-y-2">
          <div className="flex items-start gap-2 font-bold text-amber-950">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span>Distribución Multimes por Capacidad Operativa</span>
              <p className="font-normal text-[11px] text-amber-800 mt-0.5">
                Al asignar máximo <strong>{maxPerDay} equipos por día hábil</strong> (Lunes a Viernes), los{' '}
                <strong>{stats.totalEquipments} equipos</strong> requieren <strong>{stats.totalDays} jornadas de trabajo</strong>. Como en{' '}
                <strong>{startMonthName}</strong> no alcanzan todos los días hábiles disponibles sin saturar la jornada, la asignación
                continúa automáticamente en el siguiente mes:
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {stats.monthsImpacted.map((m, idx) => (
              <React.Fragment key={m.monthIndex}>
                <div className="px-2.5 py-1 bg-white border border-amber-300 rounded-lg shadow-2xs flex items-center gap-1.5 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-slate-800">{m.monthName}:</span>
                  <span className="font-mono text-amber-700 font-bold">{m.count} equipos</span>
                </div>
                {idx < stats.monthsImpacted.length - 1 && (
                  <ArrowRight className="w-3.5 h-3.5 text-amber-500" />
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="text-[10px] text-amber-800 bg-amber-100/50 p-2 rounded-lg">
            💡 <em>Regla de negocio cumplida:</em> Los equipos asignados en el mes siguiente (ej. {stats.monthsImpacted[1]?.monthName})
            inician su ciclo de mantenimiento en dicho mes, proyectando sus futuras fechas periódicas según su frecuencia.
          </div>
        </div>
      ) : (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-emerald-950">Capacidad Operativa Óptima</span>
            <p className="text-[11px] text-emerald-800 mt-0.5">
              Todos los <strong>{stats.totalEquipments} equipos</strong> se programan en{' '}
              <strong>{startMonthName} {selectedYear}</strong> a lo largo de <strong>{stats.totalDays} jornadas de Lunes a Viernes</strong>{' '}
              sin sobrepasar el límite de {maxPerDay} equipos diarios.
            </p>
          </div>
        </div>
      )}

      {/* 3. Navegación por pestañas de la simulación */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/80">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('days')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'days'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Jornadas Día a Día ({dailySlots.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('locations')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'locations'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Por Ubicación ({locationGroups.length})</span>
          </button>
        </div>

        {activeTab === 'days' && dailySlots.length > 5 && (
          <div className="relative w-44">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Buscar jornada o equipo..."
              className="w-full pl-8 pr-2 py-1 bg-white border border-slate-200 rounded-md text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        )}
      </div>

      {/* 4. Contenido de las pestañas */}
      {activeTab === 'days' && (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {filteredSlots.map((slot, index) => {
            const isExpanded = expandedDay === slot.dayIndex;
            const prevSlot = index > 0 ? filteredSlots[index - 1] : null;
            const isNewMonth = prevSlot && prevSlot.monthIndex !== slot.monthIndex;

            return (
              <React.Fragment key={slot.dayIndex}>
                {/* Separador visual al cambiar de mes */}
                {isNewMonth && (
                  <div className="py-1.5 px-3 bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-700 text-white rounded-lg flex items-center justify-between text-[11px] font-bold shadow-2xs my-2">
                    <div className="flex items-center gap-1.5">
                      <CalendarClock className="w-3.5 h-3.5 text-indigo-200" />
                      <span>Transición automática: Continuación en {slot.monthName} {slot.year}</span>
                    </div>
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-mono">
                      Mes {slot.monthIndex + 1}
                    </span>
                  </div>
                )}

                <div className="bg-white rounded-xl border border-slate-200 hover:border-indigo-300 transition-all shadow-2xs overflow-hidden">
                  <div
                    onClick={() => setExpandedDay(isExpanded ? null : slot.dayIndex)}
                    className="p-3 flex items-center justify-between gap-3 cursor-pointer select-none bg-slate-50/50 hover:bg-indigo-50/40"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-indigo-100/80 border border-indigo-200 text-indigo-800 flex items-center justify-center font-mono font-bold text-xs shrink-0">
                        {slot.dayIndex}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900">{slot.formattedDate}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                            {slot.dayName}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {slot.monthName}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate max-w-xs">{slot.locationsSummary.join(' • ')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                          slot.equipments.length >= maxPerDay
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        }`}
                      >
                        {slot.equipments.length} / {maxPerDay} equipos
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Lista de equipos asignados en este día */}
                  {isExpanded && (
                    <div className="p-3 pt-2 border-t border-slate-100 bg-white">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">
                        Equipos programados para esta jornada:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {slot.equipments.map(({ equipment, assignedOrder }) => (
                          <div
                            key={equipment.id}
                            className="p-2 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-[10px] font-mono font-bold text-slate-400">
                                #{assignedOrder}
                              </span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-indigo-900">{equipment.code}</span>
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800 capitalize font-medium">
                                    {equipment.frequency}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-600 truncate">{equipment.name}</p>
                              </div>
                            </div>
                            <span className="text-[10px] text-slate-500 truncate max-w-[120px] text-right">
                              {equipment.location}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {activeTab === 'locations' && (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {locationGroups.map((group) => (
            <div
              key={group.location}
              className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span className="font-bold text-xs text-slate-900">{group.location}</span>
                </div>
                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-bold text-[11px] rounded-full border border-indigo-200">
                  {group.count} {group.count === 1 ? 'equipo' : 'equipos'}
                </span>
              </div>

              <div className="flex flex-wrap gap-1 text-[10px]">
                <span className="text-slate-400 self-center mr-1">Jornadas asignadas:</span>
                {Array.from(group.dates).map((d) => (
                  <span
                    key={d}
                    className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-medium border border-slate-200"
                  >
                    {d}
                  </span>
                ))}
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {group.equipments.map((eq) => (
                  <span
                    key={eq.code}
                    className="px-2 py-1 bg-slate-50 rounded border border-slate-200 text-[11px] text-slate-700 font-mono font-medium"
                  >
                    {eq.code} <span className="text-slate-400 font-sans">({eq.assignedDate})</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
