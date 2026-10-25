import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageService } from '../src/services/storage';
import { clearCache, clearOperations } from '../src/services/offline';

function jsonResponse(body: any, status = 200) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as any;
}

// Stubs mínimos del navegador: el entorno de pruebas es Node.
function stubBrowser(online: boolean) {
  vi.stubGlobal('localStorage', {
    getItem: () => 'test-token',
    setItem: () => {},
    removeItem: () => {},
  });
  vi.stubGlobal('navigator', { onLine: online });
}

const sampleExecutions = [
  {
    id: 'exec_offline_1',
    equipmentId: 'eq_1',
    year: 2026,
    month: 2,
    isExecuted: true,
    completedTasks: [],
    createdAt: '2026-02-01T08:00:00.000Z',
    updatedAt: '2026-02-01T08:00:00.000Z',
  },
];

describe('Soporte offline (espejo local + cola de escritura)', () => {
  beforeEach(async () => {
    await clearOperations();
    await clearCache();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    await clearOperations();
    await clearCache();
  });

  it('encola una escritura cuando no hay conexión y la refleja en local', async () => {
    stubBrowser(false);
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch')))
    );

    // No debe lanzar: el cambio queda en la cola.
    await StorageService.saveExecutions(sampleExecutions);

    const pending = await StorageService.getPendingOperations();
    expect(pending).toHaveLength(1);
    expect(pending[0].kind).toBe('sync');
    expect(pending[0].entity).toBe('executions');

    // La lectura offline devuelve el espejo local con el cambio optimista.
    const cached = await StorageService.getExecutions();
    expect(cached).toHaveLength(1);
    expect(cached[0].id).toBe('exec_offline_1');
  });

  it('vacía la cola al recuperar la conexión', async () => {
    stubBrowser(false);
    const offlineFetch = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')));
    vi.stubGlobal('fetch', offlineFetch);
    await StorageService.saveExecutions(sampleExecutions);

    // Reconexión: el POST de sincronización responde con una nueva revisión.
    stubBrowser(true);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ success: true, revision: 7 }))
    );

    const result = await StorageService.syncPendingOperations();
    expect(result.flushed).toBe(1);
    expect(result.failed).toBe(0);
    expect(await StorageService.getPendingOperations()).toHaveLength(0);
  });

  it('cachea las lecturas del servidor para poder usarlas sin conexión', async () => {
    stubBrowser(true);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: any) => {
        if (init?.method === 'POST') return jsonResponse({ success: true, revision: 2 });
        return jsonResponse({ success: true, revision: 1, data: [{ id: 'eq_cache', code: 'AP-01' }] });
      })
    );

    const online = await StorageService.getEquipmentList();
    expect(online).toHaveLength(1);

    // Ahora sin conexión: debe devolver la última copia.
    stubBrowser(false);
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch')))
    );
    const offline = await StorageService.getEquipmentList();
    expect(offline).toHaveLength(1);
    expect(offline[0].code).toBe('AP-01');
  });

  it('marca como fallida una operación rechazada por conflicto, sin aplicarla en silencio', async () => {
    stubBrowser(false);
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch')))
    );
    await StorageService.saveExecutions(sampleExecutions);

    stubBrowser(true);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ success: false, error: 'Otro usuario modificó', revision: 9 }, 409))
    );

    const result = await StorageService.syncPendingOperations();
    expect(result.failed).toBe(1);
    const pending = await StorageService.getPendingOperations();
    expect(pending).toHaveLength(1);
    expect(pending[0].status).toBe('failed');
    expect(pending[0].error).toContain('Otro usuario');
  });

  it('permite descartar una operación fallida', async () => {
    stubBrowser(false);
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch')))
    );
    await StorageService.saveExecutions(sampleExecutions);

    stubBrowser(true);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ success: false, error: 'Conflicto', revision: 3 }, 409))
    );
    await StorageService.syncPendingOperations();

    const [op] = await StorageService.getPendingOperations();
    await StorageService.discardPendingOperation(op.id!);
    expect(await StorageService.getPendingOperations()).toHaveLength(0);
  });

  it('rechaza en línea las transiciones SGC cuando no hay conexión', async () => {
    stubBrowser(false);
    const fetchSpy = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')));
    vi.stubGlobal('fetch', fetchSpy);

    await expect(StorageService.approveExecution('exec_1')).rejects.toThrow(/Sin conexión/);
    await expect(StorageService.closeExecution('exec_1')).rejects.toThrow(/Sin conexión/);
    await expect(StorageService.reopenExecution('exec_1')).rejects.toThrow(/Sin conexión/);
    // No se debe intentar la petición sin conexión.
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
