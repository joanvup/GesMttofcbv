/**
 * Soporte offline de bajo nivel.
 *
 * Mantiene dos cosas en IndexedDB (con respaldo en memoria para entornos sin
 * IndexedDB, como las pruebas en Node):
 *
 * - `cache`: espejo local de las entidades sincronizadas, para poder leer datos
 *   y reflejar cambios optimistas aunque no haya conexión.
 * - `outbox`: cola de escrituras pendientes que se envían al servidor cuando se
 *   recupera la conexión.
 *
 * Este módulo no conoce `fetch`: la orquestación de red vive en `storage.ts`.
 */

export type OutboxKind = 'sync' | 'request';

export interface OutboxOperation {
  id?: number;
  kind: OutboxKind;
  /** Para operaciones `sync`: entidad/colección sincronizada. */
  entity?: string;
  /** Para operaciones `sync`: lista completa que se desea persistir. */
  data?: unknown;
  /** Revisión conocida al encolar, para el bloqueo optimista al reenviar. */
  expectedRevision?: number;
  /** Para operaciones `request`: endpoint directo. */
  url?: string;
  method?: string;
  body?: unknown;
  createdAt: string;
  status: 'pending' | 'failed';
  error?: string;
  attempts: number;
}

export type NewOutboxOperation = Omit<OutboxOperation, 'id' | 'createdAt' | 'status' | 'attempts'>;

const DB_NAME = 'fcbv_offline';
const DB_VERSION = 1;
const CACHE_STORE = 'cache';
const OUTBOX_STORE = 'outbox';

interface CachedRecord {
  key: string;
  data: unknown;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Respaldo en memoria (Node/pruebas o navegadores sin IndexedDB)
// ---------------------------------------------------------------------------

const memory = {
  cache: new Map<string, CachedRecord>(),
  outbox: new Map<number, OutboxOperation>(),
  nextId: 1,
};

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined' && indexedDB !== null;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(CACHE_STORE)) {
          db.createObjectStore(CACHE_STORE, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
          db.createObjectStore(OUTBOX_STORE, { keyPath: 'id', autoIncrement: true });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const request = action(tx.objectStore(storeName));
    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => reject(request.error);
  });
}

// ---------------------------------------------------------------------------
// Notificaciones de cambio (para refrescar la interfaz)
// ---------------------------------------------------------------------------

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeOutbox(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyOutboxChange(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* un listener no debe romper a los demás */
    }
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('fcbv:outbox-change'));
  }
}

/** Indica si el navegador reporta conexión (en Node se asume conectado). */
export function isOnline(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean') return true;
  return navigator.onLine;
}

// ---------------------------------------------------------------------------
// Espejo local de entidades
// ---------------------------------------------------------------------------

export async function cacheEntity(entity: string, data: unknown): Promise<void> {
  const record: CachedRecord = { key: entity, data, updatedAt: new Date().toISOString() };
  if (!hasIndexedDb()) {
    memory.cache.set(entity, record);
    return;
  }
  try {
    await withStore(CACHE_STORE, 'readwrite', (store) => store.put(record));
  } catch {
    // Si IndexedDB falla en tiempo de ejecución, degradar a memoria.
    memory.cache.set(entity, record);
  }
}

export async function readCachedEntity<T>(entity: string): Promise<T | undefined> {
  let record: CachedRecord | undefined;
  if (!hasIndexedDb()) {
    record = memory.cache.get(entity);
  } else {
    try {
      record = await withStore<CachedRecord | undefined>(CACHE_STORE, 'readonly', (store) =>
        store.get(entity)
      );
    } catch {
      record = memory.cache.get(entity);
    }
  }
  return record ? (record.data as T) : undefined;
}

// ---------------------------------------------------------------------------
// Cola de escrituras pendientes (outbox)
// ---------------------------------------------------------------------------

export async function enqueueOperation(op: NewOutboxOperation): Promise<number> {
  const full: OutboxOperation = {
    ...op,
    createdAt: new Date().toISOString(),
    status: 'pending',
    attempts: 0,
  };

  let id: number;
  if (!hasIndexedDb()) {
    id = memory.nextId;
    memory.nextId += 1;
  } else {
    try {
      id = await withStore<number>(OUTBOX_STORE, 'readwrite', (store) => store.add(full));
    } catch {
      id = memory.nextId;
      memory.nextId += 1;
    }
  }
  memory.outbox.set(id, { ...full, id });
  notifyOutboxChange();
  return id;
}

export async function listOperations(): Promise<OutboxOperation[]> {
  let ops: OutboxOperation[];
  if (hasIndexedDb()) {
    try {
      ops = await withStore<OutboxOperation[]>(OUTBOX_STORE, 'readonly', (store) => store.getAll());
    } catch {
      ops = Array.from(memory.outbox.values());
    }
  } else {
    ops = Array.from(memory.outbox.values());
  }
  return ops.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
}

export async function updateOperation(id: number, patch: Partial<OutboxOperation>): Promise<void> {
  const current = memory.outbox.get(id);
  if (current) memory.outbox.set(id, { ...current, ...patch });
  if (!hasIndexedDb()) return;
  try {
    const stored = await withStore<OutboxOperation | undefined>(OUTBOX_STORE, 'readonly', (store) =>
      store.get(id)
    );
    if (stored) {
      await withStore(OUTBOX_STORE, 'readwrite', (store) => store.put({ ...stored, ...patch }));
    }
  } catch {
    /* el respaldo en memoria ya quedó actualizado */
  }
}

export async function deleteOperation(id: number): Promise<void> {
  memory.outbox.delete(id);
  if (!hasIndexedDb()) return;
  try {
    await withStore(OUTBOX_STORE, 'readwrite', (store) => store.delete(id));
  } catch {
    /* el respaldo en memoria ya quedó actualizado */
  }
}

export async function clearOperations(): Promise<void> {
  memory.outbox.clear();
  if (!hasIndexedDb()) return;
  try {
    await withStore(OUTBOX_STORE, 'readwrite', (store) => store.clear());
  } catch {
    /* el respaldo en memoria ya quedó actualizado */
  }
}

/** Borra el espejo local (por ejemplo, al cerrar sesión). */
export async function clearCache(): Promise<void> {
  memory.cache.clear();
  if (!hasIndexedDb()) return;
  try {
    await withStore(CACHE_STORE, 'readwrite', (store) => store.clear());
  } catch {
    /* el respaldo en memoria ya quedó actualizado */
  }
}
