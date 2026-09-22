import React, { useState, useEffect } from 'react';
import { 
  X, 
  Wrench, 
  AlertTriangle, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  User, 
  Layers, 
  Plus, 
  Trash2,
  PenTool,
  HelpCircle,
  ShieldAlert
} from 'lucide-react';
import { Equipment, MaintenanceExecution } from '../../types';
import { SignaturePad } from '../SignaturePad';

interface CorrectiveMaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipment: Equipment | null;
  onSave: (execution: MaintenanceExecution) => void;
  initialExecution?: MaintenanceExecution | null;
}

export const CorrectiveMaintenanceModal: React.FC<CorrectiveMaintenanceModalProps> = ({
  isOpen,
  onClose,
  equipment,
  onSave,
  initialExecution,
}) => {
  const [executedDate, setExecutedDate] = useState('');
  const [failureDescription, setFailureDescription] = useState('');
  const [actionTaken, setActionTaken] = useState('');
  const [downtimeHours, setDowntimeHours] = useState<number>(1);
  const [finalStatus, setFinalStatus] = useState<'operativo' | 'requiere_repuesto' | 'baja'>('operativo');
  const [responsibleName, setResponsibleName] = useState('');
  const [responsibleRole, setResponsibleRole] = useState('Técnico de Mantenimiento FCBV');
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | undefined>(undefined);
  const [partsReplaced, setPartsReplaced] = useState<string[]>([]);
  const [newPartInput, setNewPartInput] = useState('');
  const [observations, setObservations] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen && equipment) {
      if (initialExecution) {
        setExecutedDate(initialExecution.executedDate || new Date().toISOString().slice(0, 16).replace('T', ' '));
        setFailureDescription(initialExecution.failureDescription || '');
        setActionTaken(initialExecution.actionTaken || '');
        setDowntimeHours(initialExecution.downtimeHours || 1);
        setFinalStatus(initialExecution.finalOperationalStatus || 'operativo');
        setResponsibleName(initialExecution.responsibleName || '');
        setResponsibleRole(initialExecution.responsibleRole || 'Técnico de Mantenimiento FCBV');
        setSignatureDataUrl(initialExecution.signatureDataUrl);
        setPartsReplaced(initialExecution.partsReplaced || []);
        setObservations(initialExecution.observations || '');
      } else {
        const now = new Date();
        setExecutedDate(now.toISOString().slice(0, 16).replace('T', ' '));
        setFailureDescription('');
        setActionTaken('');
        setDowntimeHours(1);
        setFinalStatus('operativo');
        setResponsibleName('Técnico de Mantenimiento FCBV');
        setResponsibleRole('Técnico FCBV');
        setSignatureDataUrl(undefined);
        setPartsReplaced([]);
        setObservations('');
      }
      setErrorMsg('');
    }
  }, [isOpen, equipment, initialExecution]);

  if (!isOpen || !equipment) return null;

  const handleAddPart = () => {
    const trimmed = newPartInput.trim();
    if (trimmed && !partsReplaced.includes(trimmed)) {
      setPartsReplaced([...partsReplaced, trimmed]);
      setNewPartInput('');
    }
  };

  const handleRemovePart = (index: number) => {
    setPartsReplaced(partsReplaced.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!failureDescription.trim()) {
      setErrorMsg('Debe detallar la falla o avería reportada en el equipo.');
      return;
    }
    if (!actionTaken.trim()) {
      setErrorMsg('Debe indicar la acción correctiva realizada o solución aplicada.');
      return;
    }
    if (!responsibleName.trim()) {
      setErrorMsg('Debe indicar el nombre del técnico responsable.');
      return;
    }

    const now = new Date();
    const executionYear = executedDate ? parseInt(executedDate.substring(0, 4), 10) : now.getFullYear();
    const executionMonth = executedDate ? parseInt(executedDate.substring(5, 7), 10) : (now.getMonth() + 1);

    const correctiveExecution: MaintenanceExecution = {
      id: initialExecution?.id || `corr_${equipment.id}_${Date.now()}`,
      equipmentId: equipment.id,
      year: isNaN(executionYear) ? now.getFullYear() : executionYear,
      month: isNaN(executionMonth) ? (now.getMonth() + 1) : executionMonth,
      scheduledDate: executedDate ? executedDate.split(' ')[0] : now.toISOString().split('T')[0],
      isExecuted: true,
      executedDate: executedDate || now.toISOString().slice(0, 16).replace('T', ' '),
      responsibleName: responsibleName.trim(),
      responsibleRole: responsibleRole.trim(),
      signatureDataUrl,
      completedTasks: [`Corrección de avería: ${failureDescription.trim().slice(0, 60)}`],
      partsReplaced,
      observations: observations.trim(),
      maintenanceType: 'correctivo',
      failureDescription: failureDescription.trim(),
      actionTaken: actionTaken.trim(),
      downtimeHours: Number(downtimeHours) || 0,
      finalOperationalStatus: finalStatus,
      createdAt: initialExecution?.createdAt || now.toISOString(),
      updatedAt: now.toISOString(),
    };

    onSave(correctiveExecution);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 via-rose-600 to-amber-700 px-6 py-4 flex items-center justify-between text-white shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Registro de Mantenimiento Correctivo</h2>
              <p className="text-xs text-amber-100">Atención de fallas, averías y reparaciones inmediatas</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Equipment Context Banner */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[11px]">
              {equipment.code}
            </span>
            <span className="font-semibold text-slate-800">{equipment.name}</span>
          </div>
          <div className="flex items-center gap-3 text-slate-600">
            <span><strong>Ubicación:</strong> {equipment.location}</span>
            <span><strong>Marca/Modelo:</strong> {equipment.brand} {equipment.model}</span>
            {equipment.serial && (
              <span className="font-mono text-slate-500">S/N: {equipment.serial}</span>
            )}
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Fecha / Hora y Tiempo fuera de servicio */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Fecha y Hora de la Intervención *
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={executedDate}
                  onChange={(e) => setExecutedDate(e.target.value)}
                  placeholder="YYYY-MM-DD HH:mm"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                  required
                />
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tiempo Fuera de Servicio (Horas de Inactividad)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={downtimeHours}
                  onChange={(e) => setDowntimeHours(parseFloat(e.target.value) || 0)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>
            </div>
          </div>

          {/* Falla Reportada */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Descripción de la Falla / Avería Reportada *
            </label>
            <textarea
              rows={3}
              value={failureDescription}
              onChange={(e) => setFailureDescription(e.target.value)}
              placeholder="Ej. El switch del Bloque Bachillerato perdió conectividad en los puertos 1 a 12 tras tormenta eléctrica; LED de enlace parpadeando en ámbar..."
              className="w-full p-3 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder:text-slate-400"
              required
            />
          </div>

          {/* Acción Correctiva Realizada */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Acción Correctiva Realizada / Solución Aplicada *
            </label>
            <textarea
              rows={3}
              value={actionTaken}
              onChange={(e) => setActionTaken(e.target.value)}
              placeholder="Ej. Se reemplazó la fuente de alimentación redundante, se reiniciaron los módulos PoE y se verificó paso de tráfico sin pérdida de paquetes..."
              className="w-full p-3 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder:text-slate-400"
              required
            />
          </div>

          {/* Repuestos / Piezas Reemplazadas */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Repuestos o Insumos Reemplazados (Opcional)
            </label>
            <div className="flex gap-2 mb-2">
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
                placeholder="Ej. Fuente de poder 350W, Cable de parcheo Cat6, etc."
                className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="button"
                onClick={handleAddPart}
                className="px-3 py-2 bg-slate-800 text-white rounded-lg text-xs font-medium hover:bg-slate-700 transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar
              </button>
            </div>
            {partsReplaced.length > 0 && (
              <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                {partsReplaced.map((part, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-900 border border-amber-200 text-xs rounded-md"
                  >
                    <span>{part}</span>
                    <button
                      type="button"
                      onClick={() => handleRemovePart(index)}
                      className="text-amber-700 hover:text-rose-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Estado Final del Equipo */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Estado Operativo Final del Equipo
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <label className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${
                finalStatus === 'operativo'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}>
                <input
                  type="radio"
                  name="finalStatus"
                  value="operativo"
                  checked={finalStatus === 'operativo'}
                  onChange={() => setFinalStatus('operativo')}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <span>✓ 100% Operativo</span>
              </label>

              <label className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${
                finalStatus === 'requiere_repuesto'
                  ? 'border-amber-500 bg-amber-50 text-amber-900 font-semibold'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}>
                <input
                  type="radio"
                  name="finalStatus"
                  value="requiere_repuesto"
                  checked={finalStatus === 'requiere_repuesto'}
                  onChange={() => setFinalStatus('requiere_repuesto')}
                  className="text-amber-600 focus:ring-amber-500"
                />
                <span>⚠️ Requiere Repuesto</span>
              </label>

              <label className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${
                finalStatus === 'baja'
                  ? 'border-rose-500 bg-rose-50 text-rose-900 font-semibold'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}>
                <input
                  type="radio"
                  name="finalStatus"
                  value="baja"
                  checked={finalStatus === 'baja'}
                  onChange={() => setFinalStatus('baja')}
                  className="text-rose-600 focus:ring-rose-500"
                />
                <span>⛔ Proponer Baja</span>
              </label>
            </div>
          </div>

          {/* Técnico Responsable */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nombre del Técnico Responsable *
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={responsibleName}
                  onChange={(e) => setResponsibleName(e.target.value)}
                  placeholder="Ej. Ing. Carlos Mendoza"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cargo / Rol Institucional
              </label>
              <input
                type="text"
                value={responsibleRole}
                onChange={(e) => setResponsibleRole(e.target.value)}
                placeholder="Ej. Soporte Técnico TI / Infraestructura"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Firma Digital */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <PenTool className="w-3.5 h-3.5 text-amber-600" />
              Firma Digital del Técnico Ejecutor
            </label>
            <SignaturePad
              initialSignature={signatureDataUrl}
              onSave={(dataUrl) => setSignatureDataUrl(dataUrl)}
              onClear={() => setSignatureDataUrl(undefined)}
            />
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Observaciones Adicionales o Recomendaciones
            </label>
            <textarea
              rows={2}
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Notas sobre garantías, proveedor o recomendaciones para evitar reincidencia..."
              className="w-full p-2.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-rose-600 text-white rounded-lg text-xs font-bold shadow-md hover:from-amber-700 hover:to-rose-700 transition-all flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Guardar Mantenimiento Correctivo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
