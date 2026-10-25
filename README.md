# GesMttofcbv

Sistema de gestión de mantenimiento preventivo y correctivo para los equipos críticos de
infraestructura y tecnología de la **Fundación Colegio Bilingüe (FCBV)**.

- **Frontend:** React 19 + Vite + Tailwind CSS 4
- **Backend:** Express 5 + Drizzle ORM
- **Base de datos:** SQLite (por defecto), con soporte de migración a MySQL
- **Autenticación:** JWT con roles `admin` y `revisor`

---

## Requisitos

- Node.js 20 o superior (recomendado 22)
- npm 10 o superior

## Instalación

```bash
npm ci
cp .env.example .env      # en Windows: copy .env.example .env
```

> El repositorio incluye un `.npmrc` con `ignore-scripts=true`: `better-sqlite3` y `esbuild`
> distribuyen sus binarios en paquetes de plataforma, así que no se necesita compilar
> código nativo ni instalar Visual Studio / build-essential.

Genere un secreto para las sesiones y colóquelo en `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Variables de entorno

| Variable                   | Obligatoria | Descripción                                                           |
| -------------------------- | :---------: | --------------------------------------------------------------------- |
| `JWT_SECRET`               |     Sí      | Clave de firma de los tokens. Mínimo 32 caracteres.                   |
| `PORT`                     |     No      | Puerto HTTP. Por defecto `3000`.                                      |
| `NODE_ENV`                 |     No      | `development`, `test` o `production`. Por defecto `development`.      |
| `INITIAL_ADMIN_PASSWORD`   |     No      | Contraseña del admin inicial. Si se omite, se genera una temporal.    |
| `INITIAL_REVISOR_PASSWORD` |     No      | Contraseña del revisor inicial. Si se omite, no se crea el usuario.   |
| `GEMINI_API_KEY`           |     No      | Habilita el reconocimiento de placas con IA. Sin clave usa OCR local. |
| `DB_ENGINE`                |     No      | `sqlite` (por defecto) o `mysql`.                                     |
| `SQLITE_PATH`              |     No      | Ruta alternativa del archivo SQLite.                                  |
| `BACKUP_DIR`               |     No      | Carpeta de copias de seguridad. Por defecto `./backups`.              |
| `BACKUP_RETENTION`         |     No      | Número de copias que se conservan. Por defecto `14`.                  |
| `BACKUP_INTERVAL_HOURS`    |     No      | Horas entre copias automáticas. Por defecto `24`.                     |

> El servidor **no arranca** si `JWT_SECRET` falta o es demasiado corto.

## Desarrollo

```bash
npm run dev
```

Abre <http://localhost:3000>. Vite se ejecuta en modo middleware con HMR.

### Usuarios iniciales

Si la base de datos no tiene usuarios, se crea `admin` con la contraseña definida en
`INITIAL_ADMIN_PASSWORD`. Si esa variable está vacía, se genera una contraseña temporal y se
imprime **una sola vez** en la consola. El usuario `revisor` solo se crea si se define
`INITIAL_REVISOR_PASSWORD`.

Para cambiar una contraseña desde la terminal:

```bash
npm run security:set-password -- admin "NuevaContraseñaSegura123"
```

## Scripts

| Script                 | Qué hace                                                 |
| ---------------------- | -------------------------------------------------------- |
| `npm run dev`          | Servidor de desarrollo con HMR.                          |
| `npm run build`        | Compila el frontend y el servidor en `dist/`.            |
| `npm start`            | Ejecuta el servidor compilado (requiere `build` previo). |
| `npm run typecheck`    | Verifica tipos con TypeScript en modo `strict`.          |
| `npm run lint`         | Analiza el código con ESLint.                            |
| `npm run lint:fix`     | Aplica correcciones automáticas de ESLint.               |
| `npm run format`       | Formatea todo el proyecto con Prettier.                  |
| `npm run format:check` | Verifica el formato sin modificar archivos.              |
| `npm test`             | Ejecuta la suite de pruebas (Vitest + Supertest).        |
| `npm run test:watch`   | Pruebas en modo interactivo.                             |
| `npm run check`        | Tipos + lint + pruebas. Ideal antes de cada commit.      |
| `npm run db:push`      | Sincroniza el esquema de Drizzle con SQLite.             |

## Pruebas

Las pruebas usan una base SQLite en memoria (`SQLITE_PATH=:memory:`), por lo que nunca tocan
los datos reales.

- `tests/auth.test.ts`: login, tokens, roles y límite de intentos.
- `tests/security.test.ts`: cabeceras, validación de logo, protección de IA y rate limiting.
- `tests/sync.test.ts`: lectura/escritura de datos y permisos por rol.
- `tests/concurrency.test.ts`: bloqueo optimista (409), sincronización no destructiva y copias.
- `tests/dates.test.ts`: fechas locales (sin desfase UTC) y días hábiles.
- `tests/env.test.ts`: validación de variables de entorno.

## Robustez de datos

### Copias de seguridad

- Se crea una copia del archivo SQLite **cada `BACKUP_INTERVAL_HOURS`** (24 h por defecto) y se
  conservan las últimas `BACKUP_RETENTION` (14 por defecto).
- Antes de **vaciar** o **restaurar** datos se genera automáticamente una copia preventiva.
- Puede crearlas, descargarlas y eliminarlas desde _Configuración de Base de Datos → Copias de
  Seguridad del Servidor_.
- Al usar `SQLITE_PATH=:memory:` (pruebas) las copias se desactivan solas.

### Bloqueo optimista (concurrencia)

Cada entidad sincronizada (`equipos`, `ubicaciones`, `edificios`, `planes anuales`, `ejecuciones`)
mantiene un contador de revisión:

1. `GET /api/sync/:entity` devuelve `data` y `revision` (también en el encabezado `ETag`).
2. `POST /api/sync/:entity` recibe `{ data, expectedRevision }` (o el encabezado `If-Match`).
3. Si la revisión ya no coincide, la API responde **`409`** con `code: "SYNC_CONFLICT"` en lugar
   de sobrescribir el trabajo del otro usuario. La interfaz avisa y recarga los datos.

Además, las escrituras ya **no** borran y reinsertan toda la tabla: se hace _upsert_ de lo
recibido y se eliminan únicamente los registros ausentes, dentro de una transacción.

## Seguridad

- Contraseñas con `bcrypt` (12 rondas) y tokens JWT de 24 h.
- Límite de 10 intentos de login por IP cada 15 minutos.
- Cabeceras `X-Content-Type-Options`, `X-Frame-Options` y `Referrer-Policy`.
- Subida de logo restringida a PNG/JPG/WEBP de hasta 5 MB, validando el contenido real.
- El endpoint de IA exige sesión y está limitado a 20 solicitudes por minuto.
- `.env`, `uploads/`, `data/` y `backups/` están excluidos de Git.

## Despliegue en Ubuntu con PM2

```bash
npm ci
npm run build

# PM2 debe ejecutarse en modo fork con una sola instancia (SQLite)
pm2 start dist/server.cjs --name gesmttofcbv -- --port 3050
pm2 save
```

> Mientras se use SQLite, use `exec_mode: fork` e `instances: 1`. El modo cluster con varias
> instancias provocaría bloqueos de escritura en la base de datos.

## Estructura del proyecto

```
server.ts                  Punto de entrada del backend (rutas y arranque)
server/env.ts              Validación de variables de entorno
server/sync.ts             Sincronización no destructiva y bloqueo optimista
server/backup.ts           Copias de seguridad del archivo SQLite
src/db/                    Conexión Drizzle, esquema y creación idempotente de tablas
src/services/              Acceso a datos, exportación, Excel, QR, OCR
src/components/            Vistas y módulos de la interfaz
tests/                     Pruebas de API y de lógica pura
```
