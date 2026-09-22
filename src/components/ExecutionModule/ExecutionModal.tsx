import React, { useState, useEffect } from 'react';
import { 
  X, 
  Calendar, 
  CheckSquare, 
  Square, 
  Check, 
  AlertCircle, 
  User, 
  PenTool, 
  Clock, 
  Wrench,
  Layers,
  FileCheck2,
  CalendarCheck
} from 'lucide-react';
import { Equipment, MaintenanceExecution } from '../../types';
import { MONTH_NAMES, isBusinessDay, getFirstBusinessDayOfMonth } from '../../services/storage';
import { SignaturePad } from '../SignaturePad';

interface ExecutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipment: Equipment | null;
  year: number;
  month: number;
  existingExecution?: MaintenanceExecution | null;
  onSave: (execution: MaintenanceExecution) => void;
}

export const ExecutionModal: React.FC<ExecutionModalProps> = ({
  isOpen,
  onClose,
  equipment,
  year,
  month,
  existingExecution,
  onSave,
}) => {
  const [scheduledDate, setScheduledDate] = useState('');
  const [isExecuted, setIsExecuted] = useState(false);
  const [executedDate, setExecutedDate] = useState('');
  const [responsibleName, setResponsibleName] = useState('');
  const [responsibleRole, setResponsibleRole] = useState('');
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | undefined>(undefined);
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [partsReplacedInput, setPartsReplacedInput] = useState('');
  const [partsReplaced, setPartsReplaced] = useState<string[]>([]);
  const [observations, setObservations] = useState('');
  const [dateWarning, setDateWarning] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen && equipment) {
      if (existingExecution) {
        setScheduledDate(existingExecution.scheduledDate || '');
        setIsExecuted(existingExecution.isExecuted);
        setExecutedDate(
          existingExecution.executedDate || new Date().toISOString().slice(0, 16).replace('T', ' ')
        );
        setResponsibleName(existingExecution.responsibleName || '');
        setResponsibleRole(existingExecution.responsibleRole || 'Técnico de Mantenimiento FCBV');
        setSignatureDataUrl(existingExecution.signatureDataUrl);
        setCompletedTasks(existingExecution.completedTasks || []);
        setPartsReplaced(existingExecution.partsReplaced || []);
        setObservations(existingExecution.observations || '');
      } else {
        // Sugerir primer día hábil del mes por defecto
        const defaultDate = getFirstBusinessDayOfMonth(year, month);
        setScheduledDate(defaultDate);
        setIsExecuted(false);
        setExecutedDate(new Date().toISOString().slice(0, 16).replace('T', ' '));
        setResponsibleName('');
        setResponsibleRole('Técnico de Mantenimiento FCBV');
        setSignatureDataUrl(undefined);
        setCompletedTasks([]);
        setPartsReplaced([]);
        setObservations('');
      }
      setDateWarning('');
      setErrorMsg('');
    }
  }, [isOpen, equipment, existingExecution, year, month]);

  if (!isOpen || !equipment) return null;

  // Validación de día hábil
  const handleDateChange = (newDate: string) => {
    setScheduledDate(newDate);
    if (!newDate) {
      setDateWarning('');
      return;
    }

    // Verificar si cae en el mes y año correctos
    const parts = newDate.split('-');
    if (parts.length === 3) {
      const selYear = parseInt(parts[0], 10);
      const selMonth = parseInt(parts[1], 10);
      if (selYear !== year || selMonth !== month) {
        setDateWarning(`Atención: La fecha debe corresponder al mes de ${MONTH_NAMES[month - 1]} de ${year}.`);
        return;
      }
    }

    // Verificar si es día hábil (lunes a viernes)
    if (!isBusinessDay(newDate)) {
      setDateWarning('⚠️ La fecha seleccionada es fin de semana (sábado o domingo). Debe ser un día hábil (lunes a viernes).');
    } else {
      setDateWarning('');
    }
  };

  const handleToggleTask = (task: string) => {
    if (completedTasks.includes(task)) {
      setCompletedTasks(completedTasks.filter((t) => t !== task));
    } else {
      setCompletedTasks([...completedTasks, task]);
    }
  };

  const handleSelectAllTasks = () => {
    if (completedTasks.length === equipment.maintenanceTasks.length) {
      setCompletedTasks([]);
    } else {
      setCompletedTasks([...equipment.maintenanceTasks]);
    }
  };

  const handleAddPartReplaced = () => {
    const trimmed = partsReplacedInput.trim();
    if (trimmed && !partsReplaced.includes(trimmed)) {
      setPartsReplaced([...partsReplaced, trimmed]);
      setPartsReplacedInput('');
    }
  };

  const handleRemovePartReplaced = (idx: number) => {
    setPartsReplaced(partsReplaced.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!scheduledDate) {
      setErrorMsg('Por favor defina la fecha programada para el mantenimiento.');
      return;
    }

    if (!isBusinessDay(scheduledDate)) {
      setErrorMsg('La fecha programada debe ser un día hábil (lunes a viernes).');
      return;
    }

    if (isExecuted) {
      if (!responsibleName.trim()) {
        setErrorMsg('Debe ingresar el nombre del técnico responsable para certificar la ejecución.');
        return;
      }
      if (!signatureDataUrl) {
        setErrorMsg('Es requerida la firma digital del responsable para registrar el mantenimiento como ejecutado.');
        return;
      }
    }

    const now = new Date().toISOString();
    const executionData: MaintenanceExecution = {
      id: existingExecution ? existingExecution.id : `exec_${equipment.id}_${year}_${month}`,
      equipmentId: equipment.id,
      year,
      month,
      scheduledDate,
      isExecuted,
      executedDate: isExecuted ? executedDate : undefined,
      responsibleName: isExecuted ? responsibleName.trim() : undefined,
      responsibleRole: isExecuted ? responsibleRole.trim() : undefined,
      signatureDataUrl: isExecuted ? signatureDataUrl : undefined,
      completedTasks,
      partsReplaced: partsReplaced.length > 0 ? partsReplaced : undefined,
      observations: observations.trim(),
      createdAt: existingExecution ? existingExecution.createdAt : now,
      updatedAt: now,
    };

    onSave(executionData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-xs bg-slate-200 text-slate-800 px-2 py-0.5 rounded">
                  {equipment.code}
                </span>
                <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                  {MONTH_NAMES[month - 1]} {year}
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-800 mt-1">
                {equipment.name}
              </h3>
              <p className="text-xs text-slate-500">{equipment.location}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Sección 1: Programación de Fecha Hábil */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <CalendarCheck className="w-4 h-4 text-indigo-600" />
                Fecha Programada (Día Hábil: Lunes a Viernes) *
              </label>
              <button
                type="button"
                onClick={() => {
                  const fbd = getFirstBusinessDayOfMonth(year, month);
                  handleDateChange(fbd);
                }}
                className="text-[11px] text-indigo-600 hover:underline font-medium"
              >
                Sugerir primer día hábil
              </button>
            </div>

            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              required
            />

            {dateWarning ? (
              <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                {dateWarning}
              </p>
            ) : scheduledDate && (
              <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                Día hábil válido (lunes a viernes).
              </p>
            )}
          </div>

          {/* Sección 2: Checklist de Tareas a Realizar */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-indigo-600" />
                Checklist de Tareas de Mantenimiento ({completedTasks.length} / {equipment.maintenanceTasks.length})
              </label>
              <button
                type="button"
                onClick={handleSelectAllTasks}
                className="text-xs text-indigo-600 hover:underline font-medium"
              >
                {completedTasks.length === equipment.maintenanceTasks.length
                  ? 'Desmarcar todas'
                  : 'Marcar todas como realizadas'}
              </button>
            </div>

            <div className="space-y-1.5 p-3 bg-slate-50 border border-slate-200 rounded-xl max-h-48 overflow-y-auto">
              {equipment.maintenanceTasks.map((task, idx) => {
                const isChecked = completedTasks.includes(task);
                return (
                  <label
                    key={idx}
                    onClick={() => handleToggleTask(task)}
                    className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-colors text-xs ${
                      isChecked
                        ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <span className="leading-snug">{task}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Sección 3: Marcar como Ejecutado */}
          <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-200 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-bold text-slate-800 block">
                  ¿Mantenimiento Ejecutado y Completado?
                </span>
                <span className="text-xs text-slate-500">
                  Active esta casilla al finalizar la intervención preventiva
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isExecuted}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsExecuted(checked);
                    if (checked && completedTasks.length === 0) {
                      // Autocompletar tareas si marca ejecutado
                      setCompletedTasks([...equipment.maintenanceTasks]);
                    }
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {/* Campos condicionales de ejecución */}
            {isExecuted && (
              <div className="space-y-4 pt-3 border-t border-indigo-100 animate-in fade-in duration-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Fecha y Hora Real de Ejecución *
                    </label>
                    <input
                      type="text"
                      value={executedDate}
                      onChange={(e) => setExecutedDate(e.target.value)}
                      placeholder="YYYY-MM-DD HH:mm"
                      className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      required={isExecuted}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nombre del Técnico Responsable *
                    </label>
                    <input
                      type="text"
                      value={responsibleName}
                      onChange={(e) => setResponsibleName(e.target.value)}
                      placeholder="Ej: Ing. Carlos Mendoza"
                      className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      required={isExecuted}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Cargo / Documento de Identificación
                  </label>
                  <input
                    type="text"
                    value={responsibleRole}
                    onChange={(e) => setResponsibleRole(e.target.value)}
                    placeholder="Ej: Líder de Infraestructura y Mantenimiento FCBV"
                    className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* Repuestos / Piezas reemplazadas */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Repuestos o Piezas Reemplazadas (si aplica)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={partsReplacedInput}
                      onChange={(e) => setPartsReplacedInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddPartReplaced();
                        }
                      }}
                      placeholder="Ej: Filtro de aire nuevo, Patch cord..."
                      className="flex-1 px-3 py-1 text-xs rounded border border-slate-300 bg-white text-slate-800 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddPartReplaced}
                      className="px-2.5 py-1 bg-slate-800 text-white rounded text-xs hover:bg-slate-900"
                    >
                      Agregar
                    </button>
                  </div>
                  {partsReplaced.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {partsReplaced.map((p, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] bg-white border border-slate-200 rounded">
                          {p}
                          <button type="button" onClick={() => handleRemovePartReplaced(i)} className="text-slate-400 hover:text-red-600">
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Firma Digital en Canvas */}
                <SignaturePad
                  initialSignature={signatureDataUrl}
                  onSave={(dataUrl) => setSignatureDataUrl(dataUrl)}
                  onClear={() => setSignatureDataUrl(undefined)}
                />
              </div>
            )}
          </div>

          {/* Sección 4: Observaciones generales */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Observaciones Técnicas / Hallazgos
            </label>
            <textarea
              rows={2}
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Estado general post-mantenimiento, mediciones de voltaje, temperatura, recomendaciones..."
              className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </form>

        {/* Footer */}
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
            Guardar Registro
          </button>
        </div>
      </div>
    </div>
  );
};
