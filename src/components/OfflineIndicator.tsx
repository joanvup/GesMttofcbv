import React, { useCallback, useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw, CloudUpload, AlertTriangle, Trash2 } from 'lucide-react';
import { StorageService } from '../services/storage';
import type { OutboxOperation } from '../services/offline';

interface OfflineIndicatorProps {
  /** Se invoca tras sincronizar con éxito, para recargar los datos visibles. */
  onSynced?: () => void;
}

const KIND_LABELS: Record<string, string> = {
  equipments: 'Equipos',
  locations: 'Ubicaciones',
  buildings: 'Edificios',
  annualPlans: 'Plan anual',
  executions: 'Ejecuciones',
};

function describeOperation(op: OutboxOperation): string {
  if (op.kind === 'sync' && op.entity) return KIND_LABELS[op.entity] || op.entity;
  if (op.url) return op.url;
  return 'Cambio';
}

/**
 * Indicador de conexión y de la cola de escrituras offline. Permite sincronizar
 * manualmente y descartar operaciones que fallaron por conflicto.
 */
export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ onSynced }) => {
  const [online, setOnline] = useState(() => StorageService.isOnline());
  const [operations, setOperations] = useState<OutboxOperation[]>([]);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setOperations(await StorageService.getPendingOperations());
    } catch {
      /* la cola es best-effort */
    }
  }, []);

  const runSync = useCallback(
    async (notify: boolean) => {
      if (syncing) return;
      setSyncing(true);
      try {
        const result = await StorageService.syncPendingOperations();
        if (notify && result.flushed > 0) onSynced?.();
      } finally {
        setSyncing(false);
        await refresh();
      }
    },
    [onSynced, refresh, syncing]
  );

  // Cargar la cola y suscribirse a sus cambios.
  useEffect(() => {
    // La carga inicial es asíncrona (IndexedDB); el aviso del compilador no aplica.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const unsubscribe = StorageService.subscribeToOutbox(() => {
      void refresh();
    });
    return unsubscribe;
  }, [refresh]);

  // Al entrar (o tras iniciar sesión) intentar vaciar lo que quedó pendiente.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (StorageService.isOnline()) void runSync(true);
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Detectar cambios de conexión y sincronizar automáticamente al reconectar.
  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      void runSync(true);
    };
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [runSync]);

  const pending = operations.filter((op) => op.status === 'pending');
  const failed = operations.filter((op) => op.status === 'failed');
  const total = operations.length;

  // Todo en orden: solo un punto de estado discreto.
  if (online && total === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-slate-500">
        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
        <span>En línea · datos sincronizados</span>
      </div>
    );
  }

  return (
    <div
      className={`mx-3 my-2 rounded-lg border p-3 text-[11px] space-y-2 ${
        online
          ? 'bg-amber-950/40 border-amber-800/60 text-amber-100'
          : 'bg-rose-950/40 border-rose-800/60 text-rose-100'
      }`}
    >
      <div className="flex items-center gap-2 font-semibold">
        {online ? <Wifi className="w-3.5 h-3.5 shrink-0" /> : <WifiOff className="w-3.5 h-3.5 shrink-0" />}
        <span>{online ? 'Cambios pendientes' : 'Sin conexión'}</span>
      </div>

      {!online && (
        <p className="text-rose-200/80 leading-snug">
          Trabajando con los últimos datos guardados. Los cambios se enviarán al recuperar la conexión.
        </p>
      )}

      {total > 0 && (
        <ul className="space-y-1">
          {operations.slice(0, 4).map((op, index) => (
            <li key={op.id ?? index} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 truncate">
                {op.status === 'failed' ? (
                  <AlertTriangle className="w-3 h-3 shrink-0 text-rose-400" />
                ) : (
                  <CloudUpload className="w-3 h-3 shrink-0 opacity-80" />
                )}
                <span className="truncate">{describeOperation(op)}</span>
              </span>
              {op.status === 'failed' && typeof op.id === 'number' && (
                <button
                  type="button"
                  onClick={async () => {
                    await StorageService.discardPendingOperation(op.id!);
                    await refresh();
                  }}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-900/60 hover:bg-rose-900 text-rose-100 shrink-0"
                  title={op.error || 'Descartar este cambio'}
                >
                  <Trash2 className="w-3 h-3" />
                  Descartar
                </button>
              )}
            </li>
          ))}
          {total > 4 && <li className="opacity-70">y {total - 4} más…</li>}
        </ul>
      )}

      {failed.length > 0 && (
        <p className="text-rose-200/80 leading-snug">
          {failed.length} cambio(s) no se pudieron sincronizar (posible conflicto con otro usuario). Revise y
          descarte, o reintente.
        </p>
      )}

      {online && (pending.length > 0 || failed.length > 0) && (
        <button
          type="button"
          onClick={() => runSync(true)}
          disabled={syncing}
          className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded bg-white/10 hover:bg-white/20 font-semibold disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Sincronizando…' : 'Sincronizar ahora'}
        </button>
      )}
    </div>
  );
};
