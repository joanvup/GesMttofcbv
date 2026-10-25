# GesMttofcbv

Sistema de gestión de mantenimiento preventivo y correctivo para los equipos críticos de
infraestructura y tecnología de la **Fundación Colegio Bilingüe (FCBV)**.

- **Frontend:** React 19 + Vite + Tailwind CSS 4, con **React Router** (navegación por URL) y
  **TanStack Query** (estado de servidor)
- **Backend:** Express 5 + Drizzle ORM, con **API REST por recurso**
- **Base de datos:** SQLite (por defecto), con soporte de migración a MySQL
- **Autenticación:** JWT con roles `admin` y `revisor`

> 📘 **¿Es usted parte del personal de FCBV?** Consulte el
> [Manual de Operación](docs/MANUAL_OPERACION.md): explica en español, paso a paso y sin tecnicismos,
> el acceso y los roles, cada módulo, el ciclo de vida SGC de las actas, los reportes oficiales, el
> uso sin conexión, las copias de seguridad y la solución de problemas. Este `README` es la guía
> técnica para instalar y mantener el sistema.
>
> 🚀 **¿Va a desplegar en el servidor de producción?** Use el
> [Runbook de actualización](docs/RUNBOOK_DESPLIEGUE.md): procedimiento paso a paso con respaldos,
> verificaciones y plan de rollback para Ubuntu + PM2 + nginx.

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
- `tests/audit.test.ts`: migraciones versionadas y bitácora de auditoría.
- `tests/rest.test.ts`: endpoints REST por recurso y compatibilidad del alias `/api/sync`.
- `tests/executions.test.ts`: ciclo de vida SGC de las actas (aprobar, cerrar, reabrir y bloqueo).
- `tests/sgc.test.ts`: etiquetas, resumen y columnas de trazabilidad SGC de las actas.
- `tests/reports.test.ts`: render del reporte F05 con el estado SGC reflejado.
- `tests/routes.test.ts`: rutas URL de los módulos y pestaña por defecto por rol.
- `tests/queries.test.ts`: cliente de TanStack Query y claves de consulta.
- `tests/offline.test.ts`: espejo local, cola de escritura offline y sincronización al reconectar.
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

Los datos se exponen con **endpoints REST por recurso** (el cliente los usa en lugar del antiguo
_sync_ monolítico):

| Recurso        | Lectura                 | Escritura               |
| -------------- | ----------------------- | ----------------------- |
| Equipos        | `GET /api/equipments`   | `PUT /api/equipments`   |
| Ubicaciones    | `GET /api/locations`    | `PUT /api/locations`    |
| Edificios      | `GET /api/buildings`    | `PUT /api/buildings`    |
| Planes anuales | `GET /api/annual-plans` | `PUT /api/annual-plans` |
| Ejecuciones    | `GET /api/executions`   | `PUT /api/executions`   |

Cada entidad mantiene un contador de revisión para el bloqueo optimista:

1. `GET /api/<recurso>` devuelve `data` y `revision` (también en el encabezado `ETag`).
2. `PUT /api/<recurso>` recibe `{ data, expectedRevision }` (o el encabezado `If-Match`).
3. Si la revisión ya no coincide, la API responde **`409`** con `code: "SYNC_CONFLICT"` en lugar
   de sobrescribir el trabajo del otro usuario. La interfaz avisa y recarga los datos.
   (Las ediciones sobre actas bloqueadas usan el mismo `409` con `code: "RECORD_LOCKED"`.)

El alias heredado `GET/POST /api/sync/:entity` se conserva por compatibilidad con clientes ya
desplegados y comparte el mismo manejador. Además, las escrituras ya **no** borran y reinsertan
toda la tabla: se hace _upsert_ de lo recibido y se eliminan únicamente los registros ausentes,
dentro de una transacción.

## Migraciones versionadas

El esquema se aplica por migraciones numeradas que se ejecutan al arrancar el servidor
(`src/db/bootstrap.ts`). Cada migración se registra una sola vez en la tabla
`schema_migrations` junto con un _checksum_ SHA-256:

- Se aplica en orden y dentro de una transacción por migración.
- Es idempotente: arrancar el servidor varias veces no repite migraciones.
- Si una migración ya aplicada cambia, solo se emite un aviso: **cree una migración nueva en
  lugar de editar una existente**.

Migraciones actuales: `0001_initial`, `0002_entity_revisions`, `0003_audit_log`, `0004_sgc_lifecycle`.

## Ciclo de vida SGC de las actas (borrador → aprobado → cerrado)

Cada acta de mantenimiento (preventiva o correctiva) tiene un **estado de registro** y una
**versión**, que **solo cambia el servidor**; el cliente nunca los envía por la sincronización.

| Estado     | Quién lo alcanza                   | Edición de contenido  |
| ---------- | ---------------------------------- | --------------------- |
| `borrador` | Estado inicial de toda acta        | Permitida             |
| `aprobado` | `admin` o `revisor`                | Bloqueada             |
| `cerrado`  | `admin` o `revisor` (tras aprobar) | Bloqueada e inmutable |

- **Aprobar / cerrar / reabrir** se hacen con endpoints dedicados, no con el _sync_:
  - `POST /api/executions/:id/approve` — `admin` y `revisor`.
  - `POST /api/executions/:id/close` — `admin` y `revisor` (requiere estado `aprobado`).
  - `POST /api/executions/:id/reopen` — **solo `admin`** (vuelve a `borrador` y limpia las marcas).
- Intentar cambiar el **contenido** de un acta `aprobada` o `cerrada` por la sincronización
  responde **`409`** con `code: "RECORD_LOCKED"`. Tampoco se pueden **eliminar** actas cerradas:
  primero deben reabrirse.
- Cada transición incrementa `record_version` y guarda quién y cuándo (`approved_by/at`,
  `closed_by/at`).
- El revisor SGC accede a la pestaña _3. Revisión de Actas (SGC)_ en **modo lectura**: puede ver,
  aprobar y cerrar, pero no crear ni editar contenido.
- El **reporte impreso F05** y su **exportación a Excel** incluyen las columnas de trazabilidad SGC:
  estado, versión, quién aprobó/cerró y cuándo, y el sello de revisión; además de un resumen de
  actas por estado al pie de cada hoja. Así el documento físico refleja el ciclo de vida del acta.

## Auditoría (trazabilidad SGC)

La tabla `audit_log` guarda una traza **inmutable** (solo se insertan filas, nunca se editan ni
se borran por API) de los eventos relevantes:

- Inicios de sesión correctos y fallidos.
- Altas, cambios y bajas de usuarios.
- Escrituras de sincronización (equipos, ubicaciones, edificios, planes anuales, ejecuciones).
- Transiciones del ciclo de vida de las actas (`execution.approve`, `execution.close`,
  `execution.reopen`).
- Vaciar datos, restaurar valores por defecto y cambios de configuración.
- Creación/eliminación de copias de seguridad y cambio de logo.

Se consulta y exporta desde _Configuración de Base de Datos → Bitácora de Auditoría_ (filtros por
acción, usuario, entidad y rango de fechas): `GET /api/audit` y `GET /api/audit/export?format=csv|json`
(solo administradores). Las contraseñas nunca se registran.

## Arquitectura de la interfaz (rutas y estado de servidor)

- **React Router**: cada módulo tiene su propia URL (`/panel`, `/equipos`, `/plan`, `/ejecucion`,
  `/ubicaciones`, `/reportes`, `/usuarios`, `/database`), de modo que son enlazables, recargables y
  navegables con el historial del navegador. El revisor solo accede a `/ejecucion` y `/reportes`;
  las rutas de administrador lo redirigen a `/reportes` y las rutas desconocidas a la pestaña por
  defecto de su rol (`src/routes.ts`).
- **TanStack Query**: las lecturas (equipos, plan anual, ejecuciones, ubicaciones, edificios) se
  sirven desde una caché compartida de estado de servidor (`src/services/queries.ts`). Las
  mutaciones escriben de forma optimista en esa caché y/o la invalidan para releer del servidor.
  La capa offline de `StorageService` sigue siendo la única puerta de acceso a los datos.

## Seguridad

- Contraseñas con `bcrypt` (12 rondas) y tokens JWT de 24 h.
- Límite de 10 intentos de login por IP cada 15 minutos. Con `trust proxy` activo, la IP registrada
  es la real del cliente aunque la app esté detrás de nginx (no la del proxy).
- Cabeceras `X-Content-Type-Options`, `X-Frame-Options` y `Referrer-Policy`.
- Subida de logo restringida a PNG/JPG/WEBP de hasta 5 MB, validando el contenido real.
- El endpoint de IA exige sesión y está limitado a 20 solicitudes por minuto.
- `.env`, `uploads/`, `data/`, `backups/` y `logs/` están excluidos de Git.

## Uso sin conexión (PWA + outbox)

La aplicación es instalable y funciona de forma degradada sin conexión:

- Un **service worker** (`public/sw.js`) cachea el _app shell_ (HTML y estáticos) para poder
  abrir la interfaz aunque no haya red. Las peticiones `/api/` **no** se cachean ahí.
- Los datos se guardan en un **espejo local en IndexedDB** (`src/services/offline.ts`): al leer,
  si no hay conexión se devuelve la última copia conocida; al escribir, el cambio se refleja de
  inmediato en local (optimista).
- Las escrituras realizadas sin conexión se encolan en una **outbox** y se envían al servidor al
  recuperar la conexión (o al pulsar _Sincronizar ahora_ en el panel lateral).
- El indicador del panel lateral muestra el estado (en línea / sin conexión) y las operaciones
  pendientes. Si una operación entra en conflicto con otro usuario (**409**), **no se sobreescribe
  en silencio**: se marca como fallida para revisarla o descartarla.
- Las **transiciones SGC** (aprobar / cerrar / reabrir) requieren conexión: dependen del estado
  actual del acta en el servidor, por lo que no se encolan.
- El service worker se registra **solo en producción** (no interfiere con el HMR en desarrollo).

> Para que la instalación PWA funcione correctamente, sirva la aplicación por HTTPS (o
> `http://localhost` durante las pruebas).

## Despliegue en Ubuntu con PM2

> Para **actualizar** un servidor ya en producción, siga el
> [Runbook de actualización](docs/RUNBOOK_DESPLIEGUE.md): incluye respaldos, el manejo del historial
> de Git reescrito, el control de calidad antes del corte y el plan de rollback.

El repositorio incluye `ecosystem.config.cjs` ya configurado (modo `fork`, `instances: 1`,
logs en `logs/`):

```bash
npm ci
cp .env.example .env      # complete JWT_SECRET y demás variables
npm run build
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup               # siga la instrucción que imprima para arrancar al reiniciar
```

Comandos útiles:

```bash
pm2 logs gesmttofcbv      # ver logs
pm2 restart gesmttofcbv   # reiniciar tras un nuevo build
pm2 status
```

> Mientras se use SQLite, el proceso debe correr en `exec_mode: fork` con `instances: 1`. El modo
> cluster con varias instancias provocaría bloqueos de escritura en la base de datos. Si migra a
> MySQL, puede cambiar a `cluster` con las instancias deseadas.

## Estructura del proyecto

```
docs/MANUAL_OPERACION.md   Manual de operación para el personal de FCBV
server.ts                  Punto de entrada del backend (rutas REST y arranque)
server/env.ts              Validación de variables de entorno
server/sync.ts             Lógica de sincronización no destructiva y bloqueo optimista
server/backup.ts           Copias de seguridad del archivo SQLite
server/audit.ts            Bitácora de auditoría (trazabilidad SGC)
public/                    Service worker, manifest e icono de la PWA
src/db/                    Conexión Drizzle, esquema y migraciones versionadas
src/App.tsx                Composición de la interfaz y manejadores de mutación
src/routes.ts              Rutas URL de cada módulo (React Router)
src/services/              Acceso a datos, exportación, Excel, QR, OCR
src/services/queries.ts    Consultas de estado de servidor (TanStack Query)
src/services/offline.ts    Espejo local (IndexedDB) y cola de escritura offline
src/services/sgc.ts        Utilidades del ciclo de vida SGC (etiquetas y trazabilidad)
src/components/            Vistas y módulos de la interfaz
ecosystem.config.cjs       Configuración de despliegue con PM2
tests/                     Pruebas de API y de lógica pura
```
