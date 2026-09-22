import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Server, Wrench, Layers, HelpCircle, Check, MapPin, ScanLine } from 'lucide-react';
import { Equipment, EquipmentFrequency, EquipmentStatus, CampusLocation } from '../../types';
import { MONTH_SHORT_NAMES } from '../../services/storage';

interface EquipmentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (equipment: Equipment) => void;
  initialEquipment?: Equipment | null;
  locations?: CampusLocation[];
  onQuickCreateLocation?: (location: CampusLocation) => void;
  onOpenScanner?: () => void;
}

const COMMON_PREFIXES = [
  { prefix: 'AP-', label: 'Access Point' },
  { prefix: 'SW-', label: 'Switch de Red' },
  { prefix: 'PC-', label: 'Computador / Laboratorio' },
  { prefix: 'PY-', label: 'Proyector / Pantalla' },
  { prefix: 'SRV-', label: 'Servidor Central' },
  { prefix: 'UPS-', label: 'UPS / Respaldo' },
  { prefix: 'AA-', label: 'Climatización / Aire' },
];

export const EquipmentFormModal: React.FC<EquipmentFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialEquipment,
  locations = [],
  onQuickCreateLocation,
  onOpenScanner,
}) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [isCustomLocation, setIsCustomLocation] = useState(false);
  const [showQuickLocationInput, setShowQuickLocationInput] = useState(false);
  const [quickLocationName, setQuickLocationName] = useState('');
  const [quickLocationBuilding, setQuickLocationBuilding] = useState('Bloque Bachillerato');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [serial, setSerial] = useState('');
  const [frequency, setFrequency] = useState<EquipmentFrequency>('trimestral');
  const [customMonths, setCustomMonths] = useState<number[]>([3, 6, 9, 12]);
  const [status, setStatus] = useState<EquipmentStatus>('activo');
  const [observations, setObservations] = useState('');

  // Partes del equipo (lista editable)
  const [parts, setParts] = useState<string[]>([]);
  const [newPartInput, setNewPartInput] = useState('');

  // Tareas de mantenimiento (lista editable)
  const [tasks, setTasks] = useState<string[]>([]);
  const [newTaskInput, setNewTaskInput] = useState('');

  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (initialEquipment) {
      setCode(initialEquipment.code);
      setName(initialEquipment.name);
      setLocation(initialEquipment.location);
      setBrand(initialEquipment.brand);
      setModel(initialEquipment.model);
      setSerial(initialEquipment.serial);
      setFrequency(initialEquipment.frequency);
      setCustomMonths(initialEquipment.customMonths || [3, 6, 9, 12]);
      setStatus(initialEquipment.status);
      setObservations(initialEquipment.observations || '');
      setParts(initialEquipment.parts || []);
      setTasks(initialEquipment.maintenanceTasks || []);
      // Si la ubicación no está en el catálogo, activar modo personalizado
      const existsInList = locations.some((l) => l.name === initialEquipment.location);
      setIsCustomLocation(!existsInList && Boolean(initialEquipment.location));
    } else {
      // Reset form defaults
      setCode('');
      setName('');
      // Si hay ubicaciones, seleccionar por defecto la primera activa o vacío
      const firstActive = locations.find((l) => l.status === 'activa');
      setLocation(firstActive ? firstActive.name : '');
      setIsCustomLocation(false);
      setShowQuickLocationInput(false);
      setBrand('');
      setModel('');
      setSerial('');
      setFrequency('trimestral');
      setCustomMonths([3, 6, 9, 12]);
      setStatus('activo');
      setObservations('');
      setParts([]);
      setTasks([]);
    }
    setErrorMsg('');
  }, [initialEquipment, isOpen, locations]);

  if (!isOpen) return null;

  const handleAddPart = () => {
    const trimmed = newPartInput.trim();
    if (trimmed && !parts.includes(trimmed)) {
      setParts([...parts, trimmed]);
      setNewPartInput('');
    }
  };

  const handleRemovePart = (index: number) => {
    setParts(parts.filter((_, i) => i !== index));
  };

  const handleAddTask = () => {
    const trimmed = newTaskInput.trim();
    if (trimmed && !tasks.includes(trimmed)) {
      setTasks([...tasks, trimmed]);
      setNewTaskInput('');
    }
  };

  const handleRemoveTask = (index: number) => {
    setTasks(tasks.filter((_, i) => i !== index));
  };

  const toggleCustomMonth = (monthNum: number) => {
    if (customMonths.includes(monthNum)) {
      setCustomMonths(customMonths.filter((m) => m !== monthNum));
    } else {
      setCustomMonths([...customMonths, monthNum].sort((a, b) => a - b));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setErrorMsg('El código del equipo es obligatorio (ej: AP-01, SW-01).');
      return;
    }
    if (!name.trim()) {
      setErrorMsg('El nombre/descripción del equipo es obligatorio.');
      return;
    }
    if (!location.trim()) {
      setErrorMsg('La ubicación del equipo es obligatoria.');
      return;
    }

    const now = new Date().toISOString();
    const equipmentData: Equipment = {
      id: initialEquipment ? initialEquipment.id : `eq-${Date.now()}`,
      code: code.trim().toUpperCase(),
      name: name.trim(),
      location: location.trim(),
      brand: brand.trim(),
      model: model.trim(),
      serial: serial.trim(),
      parts: parts.length > 0 ? parts : ['Componente principal'],
      maintenanceTasks: tasks.length > 0 ? tasks : ['Inspección física y limpieza general preventiva'],
      frequency,
      customMonths: frequency === 'personalizada' ? customMonths : undefined,
      status,
      observations: observations.trim(),
      createdAt: initialEquipment ? initialEquipment.createdAt : now,
      updatedAt: now,
    };

    onSave(equipmentData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Server className="w-5 h-5 text-indigo-600" />
              {initialEquipment ? 'Editar Equipo Crítico' : 'Registrar Nuevo Equipo Crítico'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Sistema de Mantenimiento Preventivo FCBV
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onOpenScanner && (
              <button
                type="button"
                id="btn-modal-equipment-scan"
                onClick={onOpenScanner}
                className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                title="Escanear Código QR o foto de etiqueta con OCR para auto-completar los datos"
              >
                <ScanLine className="w-3.5 h-3.5" />
                <span>Escanear QR / OCR Etiquetas</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {errorMsg}
            </div>
          )}

          {/* Fila 1: Código y Prefijos */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Código del Equipo *
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Ej: AP-01, SW-02, PC-03"
                className="flex-1 px-3.5 py-2 text-sm rounded-lg border border-slate-300 font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
              {/* Prefijos sugeridos */}
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-[11px] text-slate-400 font-medium mr-1">Prefijos:</span>
                {COMMON_PREFIXES.map((item) => (
                  <button
                    key={item.prefix}
                    type="button"
                    onClick={() => {
                      if (!code.startsWith(item.prefix)) {
                        setCode(`${item.prefix}${code.replace(/^[A-Z]+-?/, '') || '01'}`);
                      }
                    }}
                    className="px-2 py-1 text-xs font-mono bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 text-slate-700 rounded border border-slate-200 transition-colors"
                  >
                    {item.prefix}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Fila 2: Nombre y Ubicación */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Descripción / Nombre del Equipo *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Access Point Cisco Catalyst 9115AX"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Ubicación del Equipo *
                </label>
                {onQuickCreateLocation && (
                  <button
                    type="button"
                    onClick={() => setShowQuickLocationInput(!showQuickLocationInput)}
                    className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    {showQuickLocationInput ? 'Cerrar' : '+ Crear Ubicación'}
                  </button>
                )}
              </div>

              {/* Mini formulario rápido para crear nueva ubicación sin salir */}
              {showQuickLocationInput && (
                <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-lg space-y-2 mb-2 animate-in fade-in duration-100">
                  <div className="text-[11px] font-bold text-indigo-900 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    Nueva ubicación para el campus:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={quickLocationName}
                      onChange={(e) => setQuickLocationName(e.target.value)}
                      placeholder="Nombre (ej: Laboratorio Robótica)"
                      className="px-2.5 py-1.5 text-xs rounded border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <input
                      type="text"
                      value={quickLocationBuilding}
                      onChange={(e) => setQuickLocationBuilding(e.target.value)}
                      placeholder="Edificio / Bloque"
                      className="px-2.5 py-1.5 text-xs rounded border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowQuickLocationInput(false)}
                      className="px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-200 rounded"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!quickLocationName.trim()) return;
                        const newLoc: CampusLocation = {
                          id: `loc_${Date.now()}`,
                          name: quickLocationName.trim(),
                          building: quickLocationBuilding.trim() || 'Edificio Administrativo',
                          areaType: 'laboratorio',
                          status: 'activa',
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString(),
                        };
                        if (onQuickCreateLocation) {
                          onQuickCreateLocation(newLoc);
                        }
                        setLocation(newLoc.name);
                        setQuickLocationName('');
                        setShowQuickLocationInput(false);
                      }}
                      className="px-3 py-1 bg-indigo-600 text-white text-[11px] font-semibold rounded hover:bg-indigo-700 transition-colors"
                    >
                      Guardar y Asignar
                    </button>
                  </div>
                </div>
              )}

              {isCustomLocation ? (
                <div className="space-y-1">
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Escriba la ubicación personalizada..."
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setIsCustomLocation(false)}
                    className="text-[11px] text-indigo-600 hover:underline inline-block mt-1"
                  >
                    ← Volver a elegir del catálogo de ubicaciones
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  <select
                    value={location}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setIsCustomLocation(true);
                        setLocation('');
                      } else {
                        setLocation(e.target.value);
                      }
                    }}
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    required
                  >
                    <option value="">-- Seleccionar ubicación del campus --</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.name}>
                        {loc.name} — ({loc.building})
                      </option>
                    ))}
                    <option value="__custom__">+ Otra ubicación personalizada...</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Fila 3: Marca, Modelo, Serial */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Identificación Técnica (Marca / Modelo / Serial)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Marca
                </label>
                <input
                  type="text"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="Ej: Cisco, Dell, Epson"
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Modelo
                </label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="Ej: C9115AXI-A"
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Serial
                </label>
                <input
                  type="text"
                  value={serial}
                  onChange={(e) => setSerial(e.target.value)}
                  placeholder="Ej: FOC241923K4"
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Fila 4: Frecuencia y Estado */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Frecuencia de Mantenimiento *
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as EquipmentFrequency)}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="mensual">Mensual (12 veces al año)</option>
                <option value="trimestral">Trimestral (4 veces: Mar, Jun, Sep, Dic)</option>
                <option value="semestral">Semestral (2 veces: Jun, Dic)</option>
                <option value="anual">Anual (1 vez al año: Nov)</option>
                <option value="personalizada">Personalizada (elegir meses)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Estado Operativo
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as EquipmentStatus)}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="activo">Activo (Operativo en cronograma)</option>
                <option value="baja">Dado de baja (Retirado / Desactivado)</option>
              </select>
            </div>

            {frequency === 'personalizada' && (
              <div className="sm:col-span-2 pt-2 border-t border-slate-200">
                <label className="block text-xs font-medium text-slate-600 mb-2">
                  Seleccione los meses correspondientes en el cronograma:
                </label>
                <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
                  {MONTH_SHORT_NAMES.map((m, idx) => {
                    const monthNum = idx + 1;
                    const isSelected = customMonths.includes(monthNum);
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => toggleCustomMonth(monthNum)}
                        className={`py-1.5 text-xs font-semibold rounded border transition-colors ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Fila 5: Partes del Equipo (Lista editable de ítems) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                Partes y Componentes del Equipo ({parts.length})
              </label>
              <span className="text-[11px] text-slate-400">Presione enter o agregar</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newPartInput}
                onChange={(e) => setNewPartInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddPart();
                  }
                }}
                placeholder="Ej: Fuente de poder PoE, Antena, Ventilador..."
                className="flex-1 px-3.5 py-1.5 text-sm rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={handleAddPart}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-medium flex items-center gap-1 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Agregar parte
              </button>
            </div>
            {parts.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                {parts.map((part, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-white text-slate-700 border border-slate-200 shadow-2xs"
                  >
                    {part}
                    <button
                      type="button"
                      onClick={() => handleRemovePart(index)}
                      className="text-slate-400 hover:text-red-600 ml-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No se han registrado partes específicas.</p>
            )}
          </div>

          {/* Fila 6: Mantenimientos a realizar (Lista editable de tareas) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-indigo-600" />
                Tareas / Actividades de Mantenimiento a Realizar ({tasks.length})
              </label>
              <span className="text-[11px] text-slate-400">Guía de inspección preventiva</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTaskInput}
                onChange={(e) => setNewTaskInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTask();
                  }
                }}
                placeholder="Ej: Limpieza física profunda de ventiladores y polvo..."
                className="flex-1 px-3.5 py-1.5 text-sm rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={handleAddTask}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-medium flex items-center gap-1 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Agregar tarea
              </button>
            </div>
            {tasks.length > 0 ? (
              <div className="space-y-1.5 p-2.5 bg-slate-50 border border-slate-200 rounded-lg max-h-44 overflow-y-auto">
                {tasks.map((task, index) => (
                  <div
                    key={index}
                    className="flex items-start justify-between gap-2 p-2 bg-white rounded border border-slate-200 text-xs text-slate-700"
                  >
                    <span className="font-semibold text-slate-400 mr-1">{index + 1}.</span>
                    <span className="flex-1">{task}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTask(index)}
                      className="text-slate-400 hover:text-red-600 p-0.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No se han registrado tareas de mantenimiento aún.</p>
            )}
          </div>

          {/* Fila 7: Observaciones */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Observaciones Adicionales
            </label>
            <textarea
              rows={2}
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Notas sobre criticidad, recomendaciones del fabricante, garantías..."
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </form>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            {initialEquipment ? 'Guardar Cambios' : 'Registrar Equipo'}
          </button>
        </div>
      </div>
    </div>
  );
};
