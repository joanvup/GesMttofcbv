import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { GoogleGenAI, Type } from '@google/genai';
import { env } from './server/env';
import {
  db,
  getDbConfig,
  saveDbConfig,
  testMysqlConnection,
  migrateSqliteToMysql,
  sqliteFilePath,
} from './src/db/index';
import { ensureSchema } from './src/db/bootstrap';
import { users, equipments, annualPlans, executions, locations, buildings, settings } from './src/db/schema';
import { eq } from 'drizzle-orm';
import {
  INITIAL_EQUIPMENTS,
  INITIAL_LOCATIONS,
  INITIAL_BUILDINGS,
  INITIAL_EXECUTIONS_SEED,
} from './src/seeds/initialData';
import {
  SyncError,
  applySyncEntity,
  bumpEntityRevision,
  getEntityRevision,
  isSyncEntity,
  transitionExecution,
  type SyncEntity,
} from './server/sync';
import {
  BackupUnavailableError,
  createBackup,
  deleteBackup,
  getBackupSettings,
  listBackups,
  resolveBackupPath,
  startAutomaticBackups,
} from './server/backup';
import { auditSummary, exportAudit, listAudit, recordAudit } from './server/audit';

export const app = express();
const JWT_SECRET: string = env.jwtSecret;

app.disable('x-powered-by');

// Despliegue detrás de nginx en el mismo host: se confía en un único proxy local
// para que req.ip sea la IP real del cliente. Sin esto, el límite de intentos de
// login (que agrupa por IP) se compartiría entre todo el colegio.
app.set('trust proxy', 1);

// Cabeceras de seguridad básicas (sin CSP para no romper el HMR de Vite en desarrollo)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const META_FILE = path.join(UPLOADS_DIR, 'logo-meta.json');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Inicializar DB de Usuarios
function generateTemporaryPassword(): string {
  return crypto.randomBytes(12).toString('base64url');
}

function initUsersDb() {
  const existingAdmin = db.select().from(users).where(eq(users.username, 'admin')).get();
  if (existingAdmin) return;

  const adminPassword = env.initialAdminPassword || generateTemporaryPassword();
  const revisorPassword = env.initialRevisorPassword;

  const seedUsers: any[] = [
    {
      id: '1',
      username: 'admin',
      passwordHash: bcrypt.hashSync(adminPassword, 12),
      name: 'Administrador Principal',
      role: 'admin',
    },
  ];

  if (revisorPassword) {
    seedUsers.push({
      id: '2',
      username: 'revisor',
      passwordHash: bcrypt.hashSync(revisorPassword, 12),
      name: 'Revisor SGC',
      role: 'revisor',
    });
  }

  db.insert(users).values(seedUsers).run();

  if (!env.initialAdminPassword) {
    console.warn('============================================================');
    console.warn('[SEGURIDAD] Se creó el usuario administrador con contraseña temporal:');
    console.warn('  Usuario: admin');
    console.warn(`  Contraseña: ${adminPassword}`);
    console.warn('  Cámbiela inmediatamente en Gestión de Usuarios.');
    console.warn('============================================================');
  }
}

// Avisa si quedaron credenciales históricas de demostración activas
function warnAboutDefaultPasswords() {
  const defaults = [
    { username: 'admin', password: 'admin123' },
    { username: 'revisor', password: 'revisor123' },
  ];

  for (const item of defaults) {
    const user = db.select().from(users).where(eq(users.username, item.username)).get();
    if (user && bcrypt.compareSync(item.password, user.passwordHash)) {
      console.warn(
        `[SEGURIDAD] El usuario "${item.username}" sigue usando la contraseña por defecto. Cámbiela en Gestión de Usuarios.`
      );
    }
  }
}

// Inicializar datos del sistema (Equipos, Ubicaciones, Edificios, Ejecuciones) si la base de datos está vacía
function seedInitialDataIfEmpty() {
  const isCleared = db.select().from(settings).where(eq(settings.key, 'fcbv_is_cleared')).get();
  if (isCleared && isCleared.value === 'true') {
    return; // El usuario limpió los datos voluntariamente, no restaurar automáticamente
  }

  const existingEquipments = db.select().from(equipments).all();
  if (existingEquipments.length === 0) {
    db.transaction((tx) => {
      // 1. Edificios
      const existingBuildings = tx.select().from(buildings).all();
      if (existingBuildings.length === 0) {
        tx.insert(buildings)
          .values(INITIAL_BUILDINGS.map((name) => ({ name })))
          .run();
      }

      // 2. Ubicaciones
      const existingLocations = tx.select().from(locations).all();
      if (existingLocations.length === 0) {
        tx.insert(locations).values(INITIAL_LOCATIONS).run();
      }

      // 3. Equipos
      tx.insert(equipments)
        .values(
          INITIAL_EQUIPMENTS.map((e) => ({
            ...e,
            parts: JSON.stringify(e.parts || []),
            maintenanceTasks: JSON.stringify(e.maintenanceTasks || []),
            customMonths: e.customMonths ? JSON.stringify(e.customMonths) : null,
          }))
        )
        .run();

      // 4. Ejecuciones
      const existingExecs = tx.select().from(executions).all();
      if (existingExecs.length === 0) {
        tx.insert(executions)
          .values(
            INITIAL_EXECUTIONS_SEED.map((e) => ({
              ...e,
              completedTasks: JSON.stringify(e.completedTasks || []),
              partsReplaced: e.partsReplaced ? JSON.stringify(e.partsReplaced) : null,
            }))
          )
          .run();
      }
    });
  }
}

/**
 * Prepara la base de datos y los datos iniciales.
 * Se ejecuta al importar el módulo, de modo que las pruebas tengan el mismo
 * estado que un arranque real del servidor.
 */
export function initializeApp(): void {
  ensureSchema();
  initUsersDb();
  if (!env.isTest) {
    warnAboutDefaultPasswords();
  }
  seedInitialDataIfEmpty();
}

initializeApp();

const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.status(401).json({ error: 'No token provided' });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(401).json({ error: 'Sesión inválida o expirada' });
    req.user = user;
    next();
  });
};

const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Requiere permisos de administrador' });
  }
  next();
};

// Aprobación/revisión SGC: administradores y revisores.
const requireReviewerOrAdmin = (req: any, res: any, next: any) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'revisor') {
    return res.status(403).json({ error: 'Requiere permisos de administrador o revisor SGC' });
  }
  next();
};

// Limitador de peticiones en memoria (suficiente para 1-2 usuarios y un solo proceso PM2)
type RateLimitOptions = { windowMs: number; max: number; message: string };

const rateLimiterRegistries: Array<Map<string, { count: number; resetAt: number }>> = [];

function createRateLimiter({ windowMs, max, message }: RateLimitOptions) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  rateLimiterRegistries.push(hits);

  return (req: any, res: any, next: any) => {
    const now = Date.now();

    // Limpieza oportunista para evitar crecimiento indefinido
    if (hits.size > 1000) {
      for (const [key, value] of hits) {
        if (value.resetAt <= now) hits.delete(key);
      }
    }

    const key = String(req.user?.id || req.ip || req.socket?.remoteAddress || 'unknown');
    const current = hits.get(key);

    if (!current || current.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    current.count += 1;
    if (current.count > max) {
      const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({ success: false, error: message });
    }

    return next();
  };
}

/** Reinicia los contadores de los limitadores. Solo para pruebas. */
export function resetRateLimiters(): void {
  rateLimiterRegistries.forEach((registry) => registry.clear());
}

const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Demasiados intentos de inicio de sesión. Intente de nuevo en 15 minutos.',
});

const aiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  message: 'Demasiadas solicitudes de reconocimiento. Espere un momento e intente de nuevo.',
});

// RUTAS DE AUTENTICACIÓN
app.post('/api/auth/login', loginRateLimiter, (req: any, res) => {
  const { username, password } = req.body ?? {};

  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
    return res.status(400).json({ success: false, error: 'Usuario y contraseña son obligatorios' });
  }

  const user = db.select().from(users).where(eq(users.username, username.trim())).get();

  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    recordAudit(req, { action: 'login_failed', entity: 'auth', details: { username: username.trim() } });
    return res.status(401).json({ success: false, error: 'Usuario o contraseña incorrectos' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  req.user = { id: user.id, username: user.username, role: user.role, name: user.name };
  recordAudit(req, { action: 'login', entity: 'auth' });

  res.json({
    success: true,
    token,
    user: { id: user.id, username: user.username, role: user.role, name: user.name },
  });
});

app.get('/api/auth/me', authenticateToken, (req: any, res) => {
  res.json({ success: true, user: req.user });
});

// RUTAS DE USUARIOS
app.get('/api/users', authenticateToken, requireAdmin, (req, res) => {
  const allUsers = db
    .select()
    .from(users)
    .all()
    .map((u) => {
      const { passwordHash, ...safeUser } = u;
      return safeUser;
    });
  res.json({ success: true, users: allUsers });
});

app.post('/api/users', authenticateToken, requireAdmin, (req, res) => {
  const { username, password, name, role } = req.body;
  if (!username || !password || !name || !role) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  const existing = db.select().from(users).where(eq(users.username, username)).get();
  if (existing) return res.status(400).json({ error: 'El nombre de usuario ya existe' });

  const newUser = {
    id: Date.now().toString(),
    username,
    passwordHash: bcrypt.hashSync(password, 10),
    name,
    role,
  };

  db.insert(users).values(newUser).run();
  recordAudit(req, {
    action: 'user.create',
    entity: 'user',
    entityId: newUser.id,
    details: { username: newUser.username, role: newUser.role },
  });
  const { passwordHash, ...safeUser } = newUser;
  res.json({ success: true, user: safeUser });
});

app.delete('/api/users/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const user = db.select().from(users).where(eq(users.id, id)).get();
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  if (user.username === 'admin')
    return res.status(400).json({ error: 'No se puede eliminar el administrador principal' });

  db.delete(users).where(eq(users.id, id)).run();
  recordAudit(req, {
    action: 'user.delete',
    entity: 'user',
    entityId: id,
    details: { username: user.username },
  });
  res.json({ success: true });
});

app.put('/api/users/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { username, name, role, password } = req.body;
  const user = db.select().from(users).where(eq(users.id, id)).get();
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  if (username !== user.username) {
    const existing = db.select().from(users).where(eq(users.username, username)).get();
    if (existing) return res.status(400).json({ error: 'El nombre de usuario ya existe' });
  }

  if (user.username === 'admin') {
    if (role !== 'admin')
      return res.status(400).json({ error: 'No se puede quitar el rol al administrador principal' });
    if (username !== 'admin')
      return res.status(400).json({ error: 'No se puede cambiar el usuario al administrador principal' });
  }

  const updateData: any = { username, name, role };
  if (password) updateData.passwordHash = bcrypt.hashSync(password, 10);

  db.update(users).set(updateData).where(eq(users.id, id)).run();
  recordAudit(req, {
    action: 'user.update',
    entity: 'user',
    entityId: id,
    details: { username, role, passwordChanged: Boolean(password) },
  });
  const updatedUser = db.select().from(users).where(eq(users.id, id)).get();
  const { passwordHash, ...userWithoutPassword } = updatedUser as any;
  res.json({ success: true, user: userWithoutPassword });
});

// RUTAS DE DATOS (REST por recurso)
// La lista blanca de entidades y la lógica de sincronización viven en
// server/sync.ts para compartirla con las pruebas y mantener las rutas delgadas.
// Cada recurso REST comparte el mismo manejador y conserva el bloqueo optimista
// (`{ data, expectedRevision }` → `{ revision }` + `ETag`).

// Lee una entidad sincronizada y la devuelve en el formato que espera el cliente
// (campos JSON ya deserializados).
function readSyncEntity(entity: SyncEntity): any {
  if (entity === 'equipments') {
    return db
      .select()
      .from(equipments)
      .all()
      .map((e) => ({
        ...e,
        parts: JSON.parse(e.parts),
        maintenanceTasks: JSON.parse(e.maintenanceTasks),
        customMonths: e.customMonths ? JSON.parse(e.customMonths) : undefined,
      }));
  }
  if (entity === 'locations') {
    return db.select().from(locations).all();
  }
  if (entity === 'buildings') {
    return db
      .select()
      .from(buildings)
      .all()
      .map((b) => b.name);
  }
  if (entity === 'annualPlans') {
    const data: Record<string, Record<string, boolean[]>> = {};
    const plans = db.select().from(annualPlans).all();
    plans.forEach((p) => {
      if (!data[p.year]) data[p.year] = {};
      data[p.year][p.equipmentId] = JSON.parse(p.schedules);
    });
    return data;
  }
  return db
    .select()
    .from(executions)
    .all()
    .map((e) => ({
      ...e,
      completedTasks: JSON.parse(e.completedTasks),
      partsReplaced: e.partsReplaced ? JSON.parse(e.partsReplaced) : undefined,
      maintenanceType: (e as any).maintenanceType || 'preventivo',
      failureDescription: (e as any).failureDescription || undefined,
      actionTaken: (e as any).actionTaken || undefined,
      downtimeHours: (e as any).downtimeHours !== null ? (e as any).downtimeHours : undefined,
      finalOperationalStatus: (e as any).finalOperationalStatus || undefined,
    }));
}

function handleReadEntity(res: any, entity: SyncEntity): void {
  try {
    const data = readSyncEntity(entity);
    const revision = getEntityRevision(entity);
    res.setHeader('ETag', `"rev-${revision}"`);
    res.json({ success: true, data, revision });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
}

function handleWriteEntity(req: any, res: any, entity: SyncEntity): void {
  // Formato recomendado: { data, expectedRevision }. Se sigue aceptando el
  // cuerpo plano anterior para no romper clientes ya desplegados.
  const body = req.body;
  const envelope =
    body &&
    typeof body === 'object' &&
    !Array.isArray(body) &&
    Object.prototype.hasOwnProperty.call(body, 'data');
  const payload = envelope ? body.data : body;

  let expectedRevision: number | undefined;

  const ifMatch = req.headers['if-match'];
  if (typeof ifMatch === 'string' && ifMatch.trim() !== '') {
    const cleaned = ifMatch.trim().replace(/^W\//i, '').replace(/"/g, '').replace(/^rev-/i, '');
    const parsed = Number(cleaned);
    if (!Number.isInteger(parsed) || parsed < 0) {
      return res.status(400).json({ success: false, error: 'El encabezado If-Match no es válido.' });
    }
    expectedRevision = parsed;
  }

  if (envelope && body.expectedRevision !== undefined && body.expectedRevision !== null) {
    const parsed = Number(body.expectedRevision);
    if (!Number.isInteger(parsed) || parsed < 0) {
      return res.status(400).json({ success: false, error: 'expectedRevision no es válido.' });
    }
    expectedRevision = parsed;
  }

  try {
    const result = db.transaction((tx) => {
      // Se aplica primero el cambio (se revierte si hay conflicto) para que los
      // errores de validación del cuerpo tengan prioridad sobre el 409.
      applySyncEntity(tx, entity, payload);

      const currentRevision = getEntityRevision(entity);
      if (expectedRevision !== undefined && expectedRevision !== currentRevision) {
        throw new SyncError(
          409,
          `Otro usuario modificó ${entity} mientras editaba. Recargue los datos e intente de nuevo.`
        );
      }

      const revision = bumpEntityRevision(tx, entity, req.user?.username);

      return { revision };
    });

    res.setHeader('ETag', `"rev-${result.revision}"`);
    recordAudit(req, {
      action: 'sync.write',
      entity,
      details: { revision: result.revision },
    });
    res.json({ success: true, revision: result.revision });
  } catch (e: any) {
    if (e instanceof SyncError) {
      const response: Record<string, any> = { success: false, error: e.message };
      if (e.statusCode === 409) {
        response.code = e.code ?? 'SYNC_CONFLICT';
        response.revision = getEntityRevision(entity);
      }
      return res.status(e.statusCode).json(response);
    }

    // Violación de una restricción UNIQUE: otro cliente ganó la carrera.
    if (String(e?.message || '').includes('UNIQUE constraint failed')) {
      return res.status(409).json({
        success: false,
        code: 'SYNC_CONFLICT',
        error: 'Los datos entran en conflicto con otro cambio reciente (código o identificador duplicado).',
        revision: getEntityRevision(entity),
      });
    }

    res.status(500).json({ success: false, error: e.message });
  }
}

// Recurso REST canónico para cada entidad sincronizada.
export const SYNC_RESOURCE_ROUTES: ReadonlyArray<{ path: string; entity: SyncEntity }> = [
  { path: '/api/equipments', entity: 'equipments' },
  { path: '/api/locations', entity: 'locations' },
  { path: '/api/buildings', entity: 'buildings' },
  { path: '/api/annual-plans', entity: 'annualPlans' },
  { path: '/api/executions', entity: 'executions' },
];

for (const { path: resourcePath, entity } of SYNC_RESOURCE_ROUTES) {
  app.get(resourcePath, authenticateToken, (_req, res) => handleReadEntity(res, entity));
  app.put(resourcePath, authenticateToken, requireAdmin, (req, res) => handleWriteEntity(req, res, entity));
}

// Alias heredado del sync monolítico: se conserva para clientes ya desplegados.
app.get('/api/sync/:entity', authenticateToken, (req, res) => {
  const { entity } = req.params;

  if (!isSyncEntity(entity)) {
    return res.status(404).json({ success: false, error: `Entidad de sincronización no válida: ${entity}` });
  }

  return handleReadEntity(res, entity);
});

app.post('/api/sync/:entity', authenticateToken, requireAdmin, (req, res) => {
  const { entity } = req.params;

  if (!isSyncEntity(entity)) {
    return res.status(404).json({ success: false, error: `Entidad de sincronización no válida: ${entity}` });
  }

  return handleWriteEntity(req, res, entity);
});

// --- Ciclo de vida SGC de las actas (aprobar / cerrar / reabrir) ---
// El estado y la versión del acta solo los cambia el servidor; el cliente nunca
// envía estos campos por la sincronización.
function registerExecutionTransition(
  path: string,
  action: 'approve' | 'close' | 'reopen',
  auditActionName: string,
  middleware: any
) {
  app.post(path, authenticateToken, middleware, (req: any, res) => {
    try {
      const execution = transitionExecution(req.params.id, action, req.user?.username ?? null);
      recordAudit(req, {
        action: auditActionName,
        entity: 'executions',
        entityId: req.params.id,
        details: { recordStatus: execution?.recordStatus, recordVersion: execution?.recordVersion },
      });
      res.json({ success: true, data: execution });
    } catch (e: any) {
      if (e instanceof SyncError) {
        return res.status(e.statusCode).json({ success: false, code: e.code, error: e.message });
      }
      res.status(500).json({ success: false, error: e.message });
    }
  });
}

registerExecutionTransition(
  '/api/executions/:id/approve',
  'approve',
  'execution.approve',
  requireReviewerOrAdmin
);
registerExecutionTransition('/api/executions/:id/close', 'close', 'execution.close', requireReviewerOrAdmin);
registerExecutionTransition('/api/executions/:id/reopen', 'reopen', 'execution.reopen', requireAdmin);

// GET / POST settings (Signature)
app.get('/api/settings/:key', authenticateToken, (req, res) => {
  const val = db.select().from(settings).where(eq(settings.key, req.params.key)).get();
  res.json({ success: true, value: val ? val.value : null });
});

app.post('/api/settings', authenticateToken, requireAdmin, (req, res) => {
  const { key, value } = req.body;
  const existing = db.select().from(settings).where(eq(settings.key, key)).get();
  if (existing) {
    db.update(settings).set({ value }).where(eq(settings.key, key)).run();
  } else {
    db.insert(settings).values({ key, value }).run();
  }
  recordAudit(req, { action: 'settings.update', entity: 'settings', entityId: String(key) });
  res.json({ success: true });
});

// Copia preventiva obligatoria antes de operaciones destructivas.
// En una base en memoria no hay archivo que respaldar, así que se omite.
async function backupBeforeDestructiveOperation(reason: string): Promise<void> {
  try {
    await createBackup(reason);
  } catch (error) {
    if (error instanceof BackupUnavailableError) return;
    throw error;
  }
}

// Endpoint para vaciar deliberadamente la base de datos (iniciar con datos reales)
app.post('/api/database/clear-data', authenticateToken, requireAdmin, async (req, res) => {
  const { preserveLocations } = req.body || {};
  try {
    await backupBeforeDestructiveOperation('pre-clear');

    const currentEquipmentsCount = db.select().from(equipments).all().length;
    const currentLocationsCount = db.select().from(locations).all().length;
    const currentExecutionsCount = db.select().from(executions).all().length;

    db.transaction((tx) => {
      tx.delete(equipments).run();
      tx.delete(annualPlans).run();
      tx.delete(executions).run();
      if (!preserveLocations) {
        tx.delete(locations).run();
      }

      // Marcar flag en settings para evitar autoreseeding
      const isCleared = tx.select().from(settings).where(eq(settings.key, 'fcbv_is_cleared')).get();
      if (isCleared) {
        tx.update(settings).set({ value: 'true' }).where(eq(settings.key, 'fcbv_is_cleared')).run();
      } else {
        tx.insert(settings).values({ key: 'fcbv_is_cleared', value: 'true' }).run();
      }
    });

    res.json({
      success: true,
      clearedEquipments: currentEquipmentsCount,
      clearedLocations: preserveLocations ? 0 : currentLocationsCount,
      clearedExecutions: currentExecutionsCount,
    });
    recordAudit(req, {
      action: 'database.clear',
      entity: 'database',
      details: {
        preserveLocations: Boolean(preserveLocations),
        clearedEquipments: currentEquipmentsCount,
        clearedLocations: preserveLocations ? 0 : currentLocationsCount,
        clearedExecutions: currentExecutionsCount,
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Endpoint para restaurar los datos de demostración predeterminados en la base de datos
app.post('/api/database/reset-to-default', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await backupBeforeDestructiveOperation('pre-reset');

    db.transaction((tx) => {
      tx.delete(equipments).run();
      tx.delete(annualPlans).run();
      tx.delete(executions).run();
      tx.delete(locations).run();
      tx.delete(buildings).run();

      // Desactivar flag de cleared
      const isCleared = tx.select().from(settings).where(eq(settings.key, 'fcbv_is_cleared')).get();
      if (isCleared) {
        tx.update(settings).set({ value: 'false' }).where(eq(settings.key, 'fcbv_is_cleared')).run();
      } else {
        tx.insert(settings).values({ key: 'fcbv_is_cleared', value: 'false' }).run();
      }

      // Reinsertar edificios
      tx.insert(buildings)
        .values(INITIAL_BUILDINGS.map((name) => ({ name })))
        .run();

      // Reinsertar ubicaciones
      tx.insert(locations).values(INITIAL_LOCATIONS).run();

      // Reinsertar equipos
      tx.insert(equipments)
        .values(
          INITIAL_EQUIPMENTS.map((e) => ({
            ...e,
            parts: JSON.stringify(e.parts || []),
            maintenanceTasks: JSON.stringify(e.maintenanceTasks || []),
            customMonths: e.customMonths ? JSON.stringify(e.customMonths) : null,
          }))
        )
        .run();

      // Reinsertar ejecuciones
      tx.insert(executions)
        .values(
          INITIAL_EXECUTIONS_SEED.map((e) => ({
            ...e,
            completedTasks: JSON.stringify(e.completedTasks || []),
            partsReplaced: e.partsReplaced ? JSON.stringify(e.partsReplaced) : null,
          }))
        )
        .run();
    });

    res.json({ success: true, message: 'Datos de demostración restaurados en la base de datos.' });
    recordAudit(req, { action: 'database.reset', entity: 'database' });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// RUTAS DE GESTIÓN Y CONFIGURACIÓN DE BASE DE DATOS (SQLite / MySQL)

// --- Copias de seguridad del archivo SQLite ---
app.get('/api/database/backups', authenticateToken, requireAdmin, (req, res) => {
  try {
    res.json({ success: true, data: listBackups(), settings: getBackupSettings() });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/database/backups', authenticateToken, requireAdmin, async (req, res) => {
  const reason = typeof req.body?.reason === 'string' && req.body.reason.trim() ? req.body.reason : 'manual';
  try {
    const backup = await createBackup(reason);
    recordAudit(req, { action: 'backup.create', entity: 'backup', entityId: backup.filename });
    res.status(201).json({ success: true, data: backup });
  } catch (e: any) {
    if (e instanceof BackupUnavailableError) {
      return res.status(409).json({ success: false, error: e.message });
    }
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/database/backups/:filename', authenticateToken, requireAdmin, (req, res) => {
  const fullPath = resolveBackupPath(req.params.filename);
  if (!fullPath) {
    return res.status(404).json({ success: false, error: 'Copia de seguridad no encontrada.' });
  }
  res.download(fullPath, req.params.filename);
});

app.delete('/api/database/backups/:filename', authenticateToken, requireAdmin, (req, res) => {
  try {
    if (!deleteBackup(req.params.filename)) {
      return res.status(404).json({ success: false, error: 'Copia de seguridad no encontrada.' });
    }
    recordAudit(req, { action: 'backup.delete', entity: 'backup', entityId: req.params.filename });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// --- Bitácora de auditoría (solo lectura: no hay endpoints de edición ni borrado) ---

app.get('/api/audit', authenticateToken, requireAdmin, (req, res) => {
  try {
    res.json({
      success: true,
      data: listAudit(req.query as any),
      summary: auditSummary(),
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/audit/export', authenticateToken, requireAdmin, (req, res) => {
  const format = req.query.format === 'csv' ? 'csv' : 'json';
  try {
    const content = exportAudit(req.query as any, format);
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="bitacora_${stamp}.csv"`);
    } else {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="bitacora_${stamp}.json"`);
    }
    res.send(content);
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/database/config', authenticateToken, requireAdmin, (req, res) => {
  try {
    const config = getDbConfig();
    // Obtener estadísticas en vivo de SQLite
    const stats = {
      engine: config.engine,
      sqlitePath: sqliteFilePath,
      sqliteSizeKB: fs.existsSync(sqliteFilePath) ? Math.round(fs.statSync(sqliteFilePath).size / 1024) : 0,
      totalEquipments: db.select().from(equipments).all().length,
      totalLocations: db.select().from(locations).all().length,
      totalExecutions: db.select().from(executions).all().length,
      totalPlans: db.select().from(annualPlans).all().length,
      totalUsers: db.select().from(users).all().length,
      mysql: config.mysql
        ? {
            host: config.mysql.host,
            port: config.mysql.port,
            user: config.mysql.user,
            database: config.mysql.database,
            ssl: Boolean(config.mysql.ssl),
            hasPassword: Boolean(config.mysql.password),
          }
        : null,
    };
    res.json({ success: true, config, stats });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/database/test-connection', authenticateToken, requireAdmin, async (req, res) => {
  const { host, port, user, password, database, ssl } = req.body;
  if (!host || !user || !database) {
    return res
      .status(400)
      .json({ success: false, message: 'Host, usuario y base de datos son obligatorios.' });
  }

  const result = await testMysqlConnection({
    host,
    port: Number(port) || 3306,
    user,
    password,
    database,
    ssl: Boolean(ssl),
  });

  res.json(result);
});

app.post('/api/database/save-config', authenticateToken, requireAdmin, (req, res) => {
  const { engine, mysqlConfig } = req.body;
  if (engine !== 'sqlite' && engine !== 'mysql') {
    return res.status(400).json({ success: false, error: 'Motor no válido. Debe ser sqlite o mysql.' });
  }

  const current = getDbConfig();
  const updated = {
    ...current,
    engine,
    mysql: mysqlConfig
      ? {
          host: mysqlConfig.host,
          port: Number(mysqlConfig.port) || 3306,
          user: mysqlConfig.user,
          password: mysqlConfig.password !== undefined ? mysqlConfig.password : current.mysql?.password || '',
          database: mysqlConfig.database,
          ssl: Boolean(mysqlConfig.ssl),
        }
      : current.mysql,
  };

  saveDbConfig(updated);
  recordAudit(req, {
    action: 'database.save-config',
    entity: 'database',
    details: { engine, mysqlHost: updated.mysql?.host ?? null },
  });
  res.json({ success: true, message: 'Configuración de base de datos guardada con éxito.', config: updated });
});

app.post('/api/database/migrate-to-mysql', authenticateToken, requireAdmin, async (req, res) => {
  const { host, port, user, password, database, ssl } = req.body;
  const current = getDbConfig();
  const targetConfig = {
    host: host || current.mysql?.host,
    port: Number(port) || current.mysql?.port || 3306,
    user: user || current.mysql?.user,
    password: password !== undefined ? password : current.mysql?.password || '',
    database: database || current.mysql?.database,
    ssl: ssl !== undefined ? Boolean(ssl) : Boolean(current.mysql?.ssl),
  };

  if (!targetConfig.host || !targetConfig.user || !targetConfig.database) {
    return res
      .status(400)
      .json({ success: false, message: 'Parámetros de MySQL incompletos para ejecutar la migración.' });
  }

  const migrationResult = await migrateSqliteToMysql(targetConfig);
  if (migrationResult.success) {
    // Actualizar configuración
    saveDbConfig({
      engine: 'mysql',
      sqlitePath: sqliteFilePath,
      mysql: targetConfig,
    });
  }

  recordAudit(req, {
    action: 'database.migrate-mysql',
    entity: 'database',
    details: {
      success: migrationResult.success,
      host: targetConfig.host,
      database: targetConfig.database,
      counts: migrationResult.counts ?? null,
    },
  });

  res.json(migrationResult);
});

// LOGO RUTAS
const ALLOWED_LOGO_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const ALLOWED_LOGO_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const MAX_LOGO_BYTES = 5 * 1024 * 1024; // 5 MB

function detectImageMime(buffer: Buffer): string | null {
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

app.get('/api/logo', (req, res) => {
  try {
    if (fs.existsSync(META_FILE)) {
      const meta = JSON.parse(fs.readFileSync(META_FILE, 'utf-8'));
      const imagePath = path.join(UPLOADS_DIR, meta.filename);
      if (fs.existsSync(imagePath)) {
        return res.json({
          success: true,
          hasCustomLogo: true,
          logoUrl: '/api/logo/image',
          ...meta,
        });
      }
    }
  } catch (err) {
    console.error('Error reading logo metadata:', err);
  }
  res.json({
    success: true,
    hasCustomLogo: false,
    logoUrl: null,
  });
});

app.get('/api/logo/image', (req, res) => {
  try {
    if (fs.existsSync(META_FILE)) {
      const meta = JSON.parse(fs.readFileSync(META_FILE, 'utf-8'));
      const imagePath = path.join(UPLOADS_DIR, meta.filename);
      if (fs.existsSync(imagePath)) {
        return res.sendFile(imagePath);
      }
    }
  } catch (err) {
    console.error('Error sending logo image file:', err);
  }
  res.status(404).json({ error: 'No custom logo found' });
});

app.post('/api/logo', authenticateToken, requireAdmin, (req: any, res: any) => {
  const { imageBase64, filename, mimeType } = req.body;
  if (!imageBase64 || !filename) {
    return res.status(400).json({ success: false, error: 'Se requiere imageBase64 y filename' });
  }

  const extension = path.extname(String(filename)).toLowerCase();
  let declaredMime = String(mimeType || '').toLowerCase();
  if (declaredMime === 'image/jpg') declaredMime = 'image/jpeg';

  if (!ALLOWED_LOGO_EXTENSIONS.has(extension) || !ALLOWED_LOGO_MIME_TYPES.has(declaredMime)) {
    return res.status(400).json({
      success: false,
      error: 'Formato de logo no permitido. Use PNG, JPG o WEBP.',
    });
  }

  try {
    const base64Data = String(imageBase64).replace(/^data:image\/(png|jpeg|webp);base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    if (buffer.length === 0 || buffer.length > MAX_LOGO_BYTES) {
      return res.status(400).json({
        success: false,
        error: 'El logo supera el tamaño máximo permitido (5 MB).',
      });
    }

    const detectedMime = detectImageMime(buffer);
    if (!detectedMime || detectedMime !== declaredMime) {
      return res.status(400).json({
        success: false,
        error: 'El contenido del archivo no corresponde a una imagen PNG, JPG o WEBP válida.',
      });
    }

    const safeFilename = 'logo_' + Date.now() + extension;
    const imagePath = path.join(UPLOADS_DIR, safeFilename);
    fs.writeFileSync(imagePath, buffer);
    const meta = {
      filename: safeFilename,
      originalName: filename,
      mimeType: declaredMime,
      uploadedAt: new Date().toISOString(),
      uploadedBy: req.user?.username,
    };
    fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2));
    recordAudit(req, {
      action: 'logo.upload',
      entity: 'logo',
      entityId: meta.filename,
      details: { originalName: meta.originalName, mimeType: meta.mimeType },
    });
    res.json({
      success: true,
      message: 'Logo actualizado correctamente',
      hasCustomLogo: true,
      logoUrl: '/api/logo/image',
      ...meta,
    });
  } catch {
    res.status(500).json({ success: false, error: 'Error al guardar logo' });
  }
});

app.delete('/api/logo', authenticateToken, requireAdmin, (req: any, res: any) => {
  try {
    let removedFile: string | null = null;
    if (fs.existsSync(META_FILE)) {
      const meta = JSON.parse(fs.readFileSync(META_FILE, 'utf-8'));
      const imagePath = path.join(UPLOADS_DIR, meta.filename);
      if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
      fs.unlinkSync(META_FILE);
      removedFile = meta.filename;
    }
    recordAudit(req, { action: 'logo.delete', entity: 'logo', entityId: removedFile });
    res.json({ success: true, message: 'Logo eliminado correctamente' });
  } catch {
    res.status(500).json({ success: false, error: 'Error al eliminar logo' });
  }
});

// Endpoint de Reconocimiento Inteligente de Placas y Etiquetas con Gemini Vision
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  if (!env.geminiApiKey) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: env.geminiApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

app.post('/api/ai/scan-plate', authenticateToken, aiRateLimiter, async (req: any, res: any) => {
  const { imageBase64 } = req.body;
  if (!imageBase64) {
    return res.status(400).json({ success: false, error: 'Se requiere imageBase64' });
  }

  const ai = getGenAI();
  if (!ai) {
    return res.status(503).json({
      success: false,
      error: 'GEMINI_API_KEY no configurado en el servidor. Utilizando motor OCR local.',
    });
  }

  try {
    let mimeType = 'image/jpeg';
    let cleanBase64 = imageBase64;
    const match = imageBase64.match(/^data:(image\/[a-zA-Z0-9.+_-]+);base64,(.+)$/);
    if (match) {
      mimeType = match[1];
      cleanBase64 = match[2];
    }

    const prompt = `Eres un experto en inventario de infraestructura tecnológica, informática y telecomunicaciones.
Analiza detenidamente esta fotografía de una etiqueta técnica, placa de fabricante, código de barras o chasis de equipo.

INSTRUCCIONES CLAVE DE EXTRACCIÓN:
1. MARCA (brand): Fabricante del equipo. Si ves "Model:SER", "SER5", "SEi", "Mini S", la marca es "Beelink". Si ves "Cisco", "Dell", "HP", "Lenovo", "TP-Link", "Mikrotik", "Intel", etc., indícala.
2. MODELO (model): Modelo del dispositivo. Por ejemplo si dice "Model:SER" y en el adhesivo dice "SER5 PRO-E-16500EJ0W64PRO-DP/XB", el modelo comercial es "SER5 Pro" (o "SER5"). Si es Cisco, Dell, HP, etc., pon el modelo comercial y serie precisa.
3. SERIAL (serial): Número de serie (S/N o SN) único del equipo. Si hay un código de barras de serial (ej: D58003JH70063), transcríbelo exactamente.
4. CÓDIGO (code): Código de activo institucional si está rotulado, o asigna el serial si no hay código de inventario adicional.
5. TIPO DE EQUIPO (deviceType): Categoría en español (ej: "Mini PC / Computador Compacto", "Computador de Escritorio", "Switch de Red Administrable", "Router Inalámbrico", "Servidor Central de Datos", "Punto de Acceso Wi-Fi", "Sistema de Respaldo UPS", "Grabador NVR / CCTV", "Video Proyector Multimedia").
6. ESPECIFICACIONES TÉCNICAS (specs): Voltaje y amperaje de entrada (ej: "Input: 19V ⎓ 3.42A (65W)"), configuración de parte/SKU, lote o revisión (ej: "99.222890208F0"), certificaciones (CE, UKCA, FCC, RoHS), país de fabricación.
7. TRANSCRIPCIÓN COMPLETA (rawText): Transcribe todo el texto legible que aparece impreso en el chasis y la etiqueta adhesiva.`;

    const candidateModels = [
      'gemini-3.8-flash',
      'gemini-3.1-pro-preview',
      'gemini-3.1-flash-lite',
      'gemini-flash-latest',
    ];
    let response: any = null;

    for (const candidateModel of candidateModels) {
      try {
        response = await ai.models.generateContent({
          model: candidateModel,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: cleanBase64,
                },
              },
              {
                text: prompt,
              },
            ],
          },
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                brand: { type: Type.STRING, description: 'Marca o fabricante detectado' },
                model: { type: Type.STRING, description: 'Modelo o serie comercial detectada' },
                serial: { type: Type.STRING, description: 'Número de serie único (S/N)' },
                code: { type: Type.STRING, description: 'Código de activo o serial sugerido' },
                deviceType: { type: Type.STRING, description: 'Categoría de equipo en español' },
                specs: { type: Type.STRING, description: 'Especificaciones eléctricas y técnicas' },
                rawText: { type: Type.STRING, description: 'Transcripción completa de la etiqueta' },
              },
              required: ['brand', 'model', 'serial', 'deviceType'],
            },
          },
        });

        if (response && response.text) {
          break;
        }
      } catch {
        console.log(
          `[Plate Scanner] Modelo ${candidateModel} ocupado temporalmente. Probando alternativo...`
        );
        // Pausa breve para mitigar picos de concurrencia
        await new Promise((r) => setTimeout(r, 350));
      }
    }

    if (!response || !response.text) {
      console.log(
        '[Plate Scanner] Modelos de IA con alta demanda temporal; activando respaldo transparente con OCR local.'
      );
      return res.status(200).json({
        success: false,
        fallbackToLocal: true,
        error: 'Modelos de IA temporalmente con alta demanda. Se procederá con el motor OCR local.',
      });
    }

    const parsedJson = JSON.parse(response.text || '{}');
    return res.json({
      success: true,
      data: parsedJson,
      source: 'gemini_vision',
    });
  } catch {
    console.log('[Plate Scanner] Respaldo a OCR local activado.');
    return res.status(200).json({
      success: false,
      fallbackToLocal: true,
      error: 'Respaldo a OCR local activado.',
    });
  }
});

// 404 específico para rutas de API no reconocidas
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: 'Ruta de API no encontrada' });
});

// Manejador central de errores (responde JSON, nunca HTML)
app.use((err: any, req: any, res: any, next: any) => {
  console.error('[API] Error no controlado:', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ success: false, error: 'Error interno del servidor' });
});

export async function startServer() {
  // Copias automáticas de la base SQLite (se desactivan solas en memoria).
  startAutomaticBackups();

  if (!env.isProduction) {
    // Carga dinámica: las pruebas no necesitan el servidor de Vite.
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  return app.listen(env.port, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${env.port}`);
  });
}

// En pruebas se importa la app directamente; nunca se abre un puerto.
if (!env.isTest) {
  startServer();
}
