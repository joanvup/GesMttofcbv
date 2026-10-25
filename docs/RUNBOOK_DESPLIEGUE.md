# Runbook de actualización en producción

Procedimiento para actualizar GesMttofcbv en el servidor de la FCBV sin perder datos.

- **Servidor:** Ubuntu 24.04.4 LTS (`192.168.3.5`), con varias apps bajo PM2 y nginx.
- **URL pública:** <https://gesmtto.colegiobilingue.edu.co>
- **Downtime estimado:** 30–90 segundos (paso 4).
- **nginx:** no requiere cambios. El `location /` proxy-pasa todo al puerto de la app, así que
  los endpoints REST nuevos y las rutas de React Router funcionan sin tocar la configuración.

> **Importante — el historial de Git fue reescrito** (purga de un archivo sensible con
> `git-filter-repo` + force-push). Por eso **`git pull` fallará** en el servidor con un error tipo
> _refusing to merge unrelated histories_. El procedimiento correcto es `git fetch --force` +
> `git reset --hard origin/main`, que **descarta los cambios locales** del checkout: por eso el
> paso 0 los revisa antes de continuar.
>
> La base de datos **no se ve afectada**: `uploads/` está fuera de Git, así que `reset --hard` no
> la toca.

## Reglas generales

- Ejecute **un bloque a la vez** y **no avance si una comprobación falla**.
- Las variables en mayúsculas (`$APP_DIR`, `$APP_NAME`, `$OLD_SHA`) se definen en el paso 0.
- El paso 4 es la **única ventana de corte**. Todo lo anterior no interrumpe el servicio.

---

## Paso 0 · Diagnóstico (sin downtime)

```bash
ssh tu_usuario@192.168.3.5

pm2 list
pm2 describe gesmttofcbv | grep -iE 'name|script path|exec cwd|status|restarts'
```

Con el valor de `exec cwd` que devuelva:

```bash
export APP_DIR="/ruta/que/devuelva/exec/cwd"
export APP_NAME="gesmttofcbv"                       # el nombre exacto de `pm2 list`
export OLD_SHA=$(cd "$APP_DIR" && git rev-parse HEAD)
cd "$APP_DIR"
echo "OLD_SHA=$OLD_SHA"                             # GUÁRDALO: es su punto de rollback
```

Comprobaciones previas (**todas** deben ser correctas):

```bash
node -v && npm -v                                   # Node >= 20 obligatorio
df -h .                                             # >= 500 MB libres
git log --oneline -1                                # anote la versión actual
git status --porcelain                              # idealmente vacío
ls -la uploads/database.sqlite                      # anote el tamaño: se compara al final
grep -E '^(PORT|NODE_ENV|DB_ENGINE)=' .env          # PORT debe coincidir con el proxy_pass
```

**Puertas de decisión:**

| Situación                                 | Acción                                                                                                                                             |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node -v` menor a 20                      | **Alto.** Actualice Node antes de continuar.                                                                                                       |
| `git status --porcelain` **no vacío**     | **Alto.** Revise `git diff`: si son parches hechos a mano en producción, decida si conservarlos con `git stash`. No continúe sin entender qué son. |
| `PORT` distinto del `proxy_pass` de nginx | **Alto.** Alinee el `.env` o confirme con soporte.                                                                                                 |

---

## Paso 1 · Respaldos

Copia preventiva con la app aún corriendo (red de seguridad, no definitiva):

```bash
mkdir -p ~/respaldos-gesmtto
cp -a "$APP_DIR/uploads" "$HOME/respaldos-gesmtto/uploads_pre_$(date +%F_%H%M)"
cp -a "$APP_DIR/.env"    "$HOME/respaldos-gesmtto/dotenv_pre_$(date +%F_%H%M)"
```

Genere además una copia desde la interfaz: **módulo 7 → Copias de Seguridad del Servidor →
Crear copia ahora**. El respaldo **definitivo** se hace en el paso 4, con el proceso detenido.

---

## Paso 2 · Obtener el código nuevo (sin tocar nada)

```bash
cd "$APP_DIR"
git fetch --force origin
git log --oneline origin/main -3
```

Debe aparecer el commit más reciente de `origin/main` arriba del todo (p. ej. `docs: add production
update runbook...`). Aquí es **normal**
que un `git pull` normal falle por la reescritura del historial; por eso se usa `fetch --force`.

---

## Paso 3 · Dependencias y control de calidad (sin downtime)

```bash
cd "$APP_DIR"
npm ci
```

Instala también las dependencias nuevas (`react-router-dom`, `@tanstack/react-query`). Puede tardar
1–3 minutos. El proceso antiguo **permanece en memoria y sigue dando servicio**.

Control de calidad (usa SQLite **en memoria**, nunca toca los datos reales):

```bash
npx vitest run 2>&1 | tail -5
```

Espere `Test Files 14 passed` y `Tests 115 passed`.

> **Si falla, deténgase aquí.** Con solo `npm ci` la aplicación anterior sigue intacta y puede
> continuar prestando servicio sin cambios.

---

## Paso 4 · Ventana de corte (30–90 s)

Avisar al personal antes de empezar.

```bash
cd "$APP_DIR"
pm2 stop "$APP_NAME"
pm2 list                       # gesmttofcbv en stopped; las demás apps deben seguir online
```

Respaldo **definitivo** (la base queda sin escritores activos, lo que garantiza una copia
consistente):

```bash
cp -a "$APP_DIR/uploads" "$HOME/respaldos-gesmtto/uploads_final_$(date +%F_%H%M)"
ls -la "$HOME/respaldos-gesmtto/"
```

Aplicar el código y compilar:

```bash
cd "$APP_DIR"
git reset --hard origin/main
git log --oneline -1           # debe coincidir con el commit esperado
npm run build
ls -la dist/server.cjs dist/index.html dist/sw.js
```

Levantar el servicio (aquí se aplican las migraciones `0001`–`0004`):

```bash
pm2 restart "$APP_NAME"
pm2 logs "$APP_NAME" --lines 40 --nostream
```

En el registro debe ver las líneas `[Migraciones] Aplicada 000X_...` y, al final,
`Server running on http://localhost:3050`.

---

## Paso 5 · Verificación

Desde el servidor:

```bash
# 1. La app responde en local
curl -s -o /dev/null -w 'root: %{http_code}\n' http://127.0.0.1:3050/

# 2. Deep link de React Router (no existía antes de esta versión)
curl -s -o /dev/null -w 'deep link: %{http_code}\n' http://127.0.0.1:3050/equipos

# 3. Login + recurso REST nuevo con ETag
read -s -p "Password admin: " PW; echo
TOKEN=*** -s -X POST http://127.0.0.1:3050/api/auth/login \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"admin\",\"password\":\"$PW\"}" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
echo "token len: ${#TOKEN}"
curl -s -D- -o /dev/null http://127.0.0.1:3050/api/equipments \
  -H "Authorization: Bearer $TOKEN" | grep -i etag

# 4. El alias heredado sigue operativo
curl -s -o /dev/null -w 'alias sync: %{http_code}\n' \
  http://127.0.0.1:3050/api/sync/equipments -H "Authorization: Bearer $TOKEN"

# 5. Los datos se conservaron (compare con el tamaño anotado en el paso 0)
ls -la "$APP_DIR/uploads/database.sqlite"
```

`read -s` evita que la contraseña quede escrita en el historial de la shell.

Desde su equipo (no desde el servidor), confirme la URL pública y el certificado:

```powershell
(Invoke-WebRequest -Uri "https://gesmtto.colegiobilingue.edu.co/equipos" -UseBasicParsing).StatusCode
```

En el navegador: inicie sesión, abra un equipo, genere los reportes **F01–F05** y compruebe que el
módulo 7 muestre la **bitácora de auditoría**. Si algún usuario ve la interfaz antigua, que haga un
refresco completo (**Ctrl+Shift+R**): el service worker conserva el _app shell_ previo y se
auto-actualiza en la navegación siguiente.

---

## Paso 6 · Rotar contraseñas

```bash
cd "$APP_DIR"
read -s -p "Nueva admin: "   PA; echo
read -s -p "Nueva revisor: " PR; echo
npm run security:set-password -- admin   "$PA"
npm run security:set-password -- revisor "$PR"
history -c
```

Las contraseñas se leen de la base en cada inicio de sesión: **no es necesario reiniciar PM2**.

---

## Rollback

```bash
pm2 stop "$APP_NAME"
cd "$APP_DIR"
cp -a "$HOME/respaldos-gesmtto/uploads_final_XXXX/database.sqlite" uploads/database.sqlite
git reset --hard "$OLD_SHA"
npm ci && npm run build
pm2 restart "$APP_NAME"
```

> **Matiz importante:** si ya se crearon actas **después** del respaldo, restaurar el `.sqlite` las
> elimina. Como las migraciones son **aditivas**, la primera opción es restaurar **solo el código**
> y conservar la base: el código anterior ignora las columnas nuevas y sigue funcionando (pierde
> únicamente aprobar/cerrar actas).

---

## Resumen de riesgos

| Aspecto              | Detalle                                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Downtime             | 30–90 s en el paso 4. Las migraciones tardan milisegundos.                                                       |
| nginx y apps vecinas | Sin cambios. `pm2 stop <app>` no afecta a las demás aplicaciones.                                                |
| Datos                | Migraciones **aditivas** (`0001`–`0004`), no destructivas. La base está fuera de Git.                            |
| Riesgo real          | Parches manuales en el checkout de producción, que se pierden con `reset --hard`. Por eso el control del paso 0. |
| Service worker       | Los usuarios pueden ver el shell antiguo hasta el primer refresco completo.                                      |

## Mejora incluida en este despliegue: IP real del cliente

`server.ts` ahora fija `app.set('trust proxy', 1)`. Antes de este cambio, detrás de nginx
`req.ip` siempre era `127.0.0.1`, así que el límite de intentos de inicio de sesión (10 cada
15 minutos) se **compartía entre todo el colegio** en lugar de aplicarse por persona. Con este
despliegue el limitador y la bitácora ven la IP real del cliente.

> Efecto colateral esperado y deseado: el bloqueo por intentos fallidos deja de ser global. Si
> alguien estaba bloqueado "por error" porque un compañero agotó los intentos, ahora podrá
> intentarlo de nuevo.

## Comandos útiles de PM2

```bash
pm2 logs gesmttofcbv      # ver registros en vivo
pm2 restart gesmttofcbv   # reiniciar tras un nuevo build
pm2 status
pm2 save                  # guardar la lista de apps para el arranque automático
```
