import express from 'express';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createServer as createViteServer } from 'vite';
import { db, getDbConfig, saveDbConfig, testMysqlConnection, migrateSqliteToMysql, sqliteFilePath } from './src/db/index';
import { users, equipments, annualPlans, executions, locations, buildings, settings } from './src/db/schema';
import { eq } from 'drizzle-orm';
import { INITIAL_EQUIPMENTS, INITIAL_LOCATIONS, INITIAL_BUILDINGS, INITIAL_EXECUTIONS_SEED } from './src/seeds/initialData';

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'fcbv-secret-key-2026';

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const META_FILE = path.join(UPLOADS_DIR, 'logo-meta.json');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Inicializar DB de Usuarios
function initUsersDb() {
  const adminPassword = bcrypt.hashSync('admin123', 10);
  const revisorPassword = bcrypt.hashSync('revisor123', 10);
  
  const existingAdmin = db.select().from(users).where(eq(users.username, 'admin')).get();
  if (!existingAdmin) {
    db.insert(users).values([
      { id: '1', username: 'admin', passwordHash: adminPassword, name: 'Administrador Principal', role: 'admin' },
      { id: '2', username: 'revisor', passwordHash: revisorPassword, name: 'Revisor SGC', role: 'revisor' }
    ]).run();
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
        tx.insert(buildings).values(INITIAL_BUILDINGS.map(name => ({ name }))).run();
      }

      // 2. Ubicaciones
      const existingLocations = tx.select().from(locations).all();
      if (existingLocations.length === 0) {
        tx.insert(locations).values(INITIAL_LOCATIONS).run();
      }

      // 3. Equipos
      tx.insert(equipments).values(INITIAL_EQUIPMENTS.map(e => ({
        ...e,
        parts: JSON.stringify(e.parts || []),
        maintenanceTasks: JSON.stringify(e.maintenanceTasks || []),
        customMonths: e.customMonths ? JSON.stringify(e.customMonths) : null
      }))).run();

      // 4. Ejecuciones
      const existingExecs = tx.select().from(executions).all();
      if (existingExecs.length === 0) {
        tx.insert(executions).values(INITIAL_EXECUTIONS_SEED.map(e => ({
          ...e,
          completedTasks: JSON.stringify(e.completedTasks || []),
          partsReplaced: e.partsReplaced ? JSON.stringify(e.partsReplaced) : null
        }))).run();
      }
    });
  }
}

initUsersDb();
seedInitialDataIfEmpty();

const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (token == null) return res.status(401).json({ error: 'No token provided' });
  
  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
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

// RUTAS DE AUTENTICACIÓN
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.select().from(users).where(eq(users.username, username)).get();
  
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ success: false, error: 'Usuario o contraseña incorrectos' });
  }
  
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
  
  res.json({
    success: true,
    token,
    user: { id: user.id, username: user.username, role: user.role, name: user.name }
  });
});

app.get('/api/auth/me', authenticateToken, (req: any, res) => {
  res.json({ success: true, user: req.user });
});

// RUTAS DE USUARIOS
app.get('/api/users', authenticateToken, requireAdmin, (req, res) => {
  const allUsers = db.select().from(users).all().map(u => {
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
    role
  };
  
  db.insert(users).values(newUser).run();
  const { passwordHash, ...safeUser } = newUser;
  res.json({ success: true, user: safeUser });
});

app.delete('/api/users/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const user = db.select().from(users).where(eq(users.id, id)).get();
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  if (user.username === 'admin') return res.status(400).json({ error: 'No se puede eliminar el administrador principal' });
  
  db.delete(users).where(eq(users.id, id)).run();
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
    if (role !== 'admin') return res.status(400).json({ error: 'No se puede quitar el rol al administrador principal' });
    if (username !== 'admin') return res.status(400).json({ error: 'No se puede cambiar el usuario al administrador principal' });
  }
  
  const updateData: any = { username, name, role };
  if (password) updateData.passwordHash = bcrypt.hashSync(password, 10);
  
  db.update(users).set(updateData).where(eq(users.id, id)).run();
  const updatedUser = db.select().from(users).where(eq(users.id, id)).get();
  const { passwordHash, ...userWithoutPassword } = updatedUser as any;
  res.json({ success: true, user: userWithoutPassword });
});

// RUTAS SYNC
app.get('/api/sync/:entity', authenticateToken, (req, res) => {
  const { entity } = req.params;
  let data: any = [];
  try {
    if (entity === "equipments") {
      data = db.select().from(equipments).all().map(e => ({
        ...e,
        parts: JSON.parse(e.parts),
        maintenanceTasks: JSON.parse(e.maintenanceTasks),
        customMonths: e.customMonths ? JSON.parse(e.customMonths) : undefined
      }));
    } else if (entity === "locations") {
      data = db.select().from(locations).all();
    } else if (entity === "buildings") {
      data = db.select().from(buildings).all().map(b => b.name);
    } else if (entity === "annualPlans") {
      data = {};
      const plans = db.select().from(annualPlans).all();
      plans.forEach(p => {
        if (!data[p.year]) data[p.year] = {};
        data[p.year][p.equipmentId] = JSON.parse(p.schedules);
      });
    } else if (entity === "executions") {
      data = db.select().from(executions).all().map(e => ({
        ...e,
        completedTasks: JSON.parse(e.completedTasks),
        partsReplaced: e.partsReplaced ? JSON.parse(e.partsReplaced) : undefined
      }));
    }
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/sync/:entity', authenticateToken, requireAdmin, (req, res) => {
  const { entity } = req.params;
  const payload = req.body;
  
  try {
    db.transaction((tx) => {
      if (entity === "equipments") {
        tx.delete(equipments).run();
        if (payload.length > 0) {
          const uniqueEquipments = [];
          const seenCodes = new Set();
          for (const e of payload) {
             const code = e.code?.toUpperCase().trim();
             if (!seenCodes.has(code)) {
               seenCodes.add(code);
               uniqueEquipments.push({
                 ...e,
                 parts: JSON.stringify(e.parts || []),
                 maintenanceTasks: JSON.stringify(e.maintenanceTasks || []),
                 customMonths: e.customMonths ? JSON.stringify(e.customMonths) : null
               });
             }
          }
          if (uniqueEquipments.length > 0) {
            tx.insert(equipments).values(uniqueEquipments).run();
          }
        }
      } else if (entity === "locations") {
        tx.delete(locations).run();
        if (payload.length > 0) {
          tx.insert(locations).values(payload).run();
        }
      } else if (entity === "buildings") {
        tx.delete(buildings).run();
        if (payload.length > 0) {
          tx.insert(buildings).values(payload.map((name: string) => ({ name }))).run();
        }
      } else if (entity === "annualPlans") {
        tx.delete(annualPlans).run();
        const inserts: any[] = [];
        for (const [yearStr, yearData] of Object.entries(payload)) {
          for (const [equipmentId, schedules] of Object.entries(yearData as any)) {
            inserts.push({
              id: `${yearStr}_${equipmentId}`,
              equipmentId,
              year: parseInt(yearStr),
              schedules: JSON.stringify(schedules)
            });
          }
        }
        if (inserts.length > 0) tx.insert(annualPlans).values(inserts).run();
      } else if (entity === "executions") {
        tx.delete(executions).run();
        if (payload.length > 0) {
          tx.insert(executions).values(payload.map((e: any) => ({
            ...e,
            completedTasks: JSON.stringify(e.completedTasks || []),
            partsReplaced: e.partsReplaced ? JSON.stringify(e.partsReplaced) : null
          }))).run();
        }
      }
    });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

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
  res.json({ success: true });
});

// Endpoint para vaciar deliberadamente la base de datos (iniciar con datos reales)
app.post('/api/database/clear-data', authenticateToken, requireAdmin, (req, res) => {
  const { preserveLocations } = req.body || {};
  try {
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
      clearedExecutions: currentExecutionsCount
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Endpoint para restaurar los datos de demostración predeterminados en la base de datos
app.post('/api/database/reset-to-default', authenticateToken, requireAdmin, (req, res) => {
  try {
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
      tx.insert(buildings).values(INITIAL_BUILDINGS.map(name => ({ name }))).run();

      // Reinsertar ubicaciones
      tx.insert(locations).values(INITIAL_LOCATIONS).run();

      // Reinsertar equipos
      tx.insert(equipments).values(INITIAL_EQUIPMENTS.map(e => ({
        ...e,
        parts: JSON.stringify(e.parts || []),
        maintenanceTasks: JSON.stringify(e.maintenanceTasks || []),
        customMonths: e.customMonths ? JSON.stringify(e.customMonths) : null
      }))).run();

      // Reinsertar ejecuciones
      tx.insert(executions).values(INITIAL_EXECUTIONS_SEED.map(e => ({
        ...e,
        completedTasks: JSON.stringify(e.completedTasks || []),
        partsReplaced: e.partsReplaced ? JSON.stringify(e.partsReplaced) : null
      }))).run();
    });

    res.json({ success: true, message: 'Datos de demostración restaurados en la base de datos.' });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// RUTAS DE GESTIÓN Y CONFIGURACIÓN DE BASE DE DATOS (SQLite / MySQL)
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
      mysql: config.mysql ? {
        host: config.mysql.host,
        port: config.mysql.port,
        user: config.mysql.user,
        database: config.mysql.database,
        ssl: Boolean(config.mysql.ssl),
        hasPassword: Boolean(config.mysql.password)
      } : null
    };
    res.json({ success: true, config, stats });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/database/test-connection', authenticateToken, requireAdmin, async (req, res) => {
  const { host, port, user, password, database, ssl } = req.body;
  if (!host || !user || !database) {
    return res.status(400).json({ success: false, message: 'Host, usuario y base de datos son obligatorios.' });
  }

  const result = await testMysqlConnection({
    host,
    port: Number(port) || 3306,
    user,
    password,
    database,
    ssl: Boolean(ssl)
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
    mysql: mysqlConfig ? {
      host: mysqlConfig.host,
      port: Number(mysqlConfig.port) || 3306,
      user: mysqlConfig.user,
      password: mysqlConfig.password !== undefined ? mysqlConfig.password : (current.mysql?.password || ''),
      database: mysqlConfig.database,
      ssl: Boolean(mysqlConfig.ssl)
    } : current.mysql
  };

  saveDbConfig(updated);
  res.json({ success: true, message: 'Configuración de base de datos guardada con éxito.', config: updated });
});

app.post('/api/database/migrate-to-mysql', authenticateToken, requireAdmin, async (req, res) => {
  const { host, port, user, password, database, ssl } = req.body;
  const current = getDbConfig();
  const targetConfig = {
    host: host || current.mysql?.host,
    port: Number(port) || current.mysql?.port || 3306,
    user: user || current.mysql?.user,
    password: password !== undefined ? password : (current.mysql?.password || ''),
    database: database || current.mysql?.database,
    ssl: ssl !== undefined ? Boolean(ssl) : Boolean(current.mysql?.ssl)
  };

  if (!targetConfig.host || !targetConfig.user || !targetConfig.database) {
    return res.status(400).json({ success: false, message: 'Parámetros de MySQL incompletos para ejecutar la migración.' });
  }

  const migrationResult = await migrateSqliteToMysql(targetConfig);
  if (migrationResult.success) {
    // Actualizar configuración
    saveDbConfig({
      engine: 'mysql',
      sqlitePath: sqliteFilePath,
      mysql: targetConfig
    });
  }

  res.json(migrationResult);
});

// LOGO RUTAS
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
          ...meta
        });
      }
    }
  } catch (err) {
    console.error('Error reading logo metadata:', err);
  }
  res.json({
    success: true,
    hasCustomLogo: false,
    logoUrl: null
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
  try {
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    const safeFilename = 'logo_' + Date.now() + path.extname(filename);
    const imagePath = path.join(UPLOADS_DIR, safeFilename);
    fs.writeFileSync(imagePath, buffer);
    const meta = { filename: safeFilename, originalName: filename, mimeType: mimeType || 'image/png', uploadedAt: new Date().toISOString(), uploadedBy: req.user?.username };
    fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2));
    res.json({ success: true, message: 'Logo actualizado correctamente', hasCustomLogo: true, logoUrl: '/api/logo/image', ...meta });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error al guardar logo' });
  }
});

app.delete('/api/logo', authenticateToken, requireAdmin, (req: any, res: any) => {
  try {
    if (fs.existsSync(META_FILE)) {
      const meta = JSON.parse(fs.readFileSync(META_FILE, 'utf-8'));
      const imagePath = path.join(UPLOADS_DIR, meta.filename);
      if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
      fs.unlinkSync(META_FILE);
    }
    res.json({ success: true, message: 'Logo eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error al eliminar logo' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();
