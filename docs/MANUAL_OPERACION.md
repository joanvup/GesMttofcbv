# Manual de Operación — GesMttofcbv

**Sistema de Gestión del Mantenimiento (SGC)** de los equipos críticos de infraestructura y
tecnología de la **Fundación Colegio Bilingüe (FCBV)**.

Este manual está dirigido al **personal que usa el sistema a diario** (coordinación de
mantenimiento, técnicos y revisores SGC). La parte de instalación y configuración del servidor se
encuentra al final, en el **Anexo para soporte técnico**, y en el [`README.md`](../README.md).

---

## Índice

1. [Qué es el sistema](#1-qué-es-el-sistema)
2. [Acceso: usuarios, roles y contraseñas](#2-acceso-usuarios-roles-y-contraseñas)
3. [Cómo iniciar y cerrar sesión](#3-cómo-iniciar-y-cerrar-sesión)
4. [Mapa general de módulos](#4-mapa-general-de-módulos)
5. [Módulo 0 · Panel de Control](#5-módulo-0--panel-de-control)
6. [Módulo 1 · Censo de Equipos](#6-módulo-1--censo-de-equipos)
7. [Módulo 2 · Plan Anual](#7-módulo-2--plan-anual)
8. [Módulo 3 · Registro de Ejecución y Revisión de Actas (SGC)](#8-módulo-3--registro-de-ejecución-y-revisión-de-actas-sgc)
9. [Módulo 4 · Mapa de Áreas (Ubicaciones)](#9-módulo-4--mapa-de-áreas-ubicaciones)
10. [Módulo 5 · Reportes Oficiales SGC](#10-módulo-5--reportes-oficiales-sgc)
11. [Módulo 6 · Gestión de Usuarios](#11-módulo-6--gestión-de-usuarios)
12. [Módulo 7 · Motor de Base de Datos](#12-módulo-7--motor-de-base-de-datos)
13. [Ciclo de vida SGC de las actas (borrador → aprobado → cerrado)](#13-ciclo-de-vida-sgc-de-las-actas-borrador--aprobado--cerrado)
14. [Uso sin conexión (modo offline)](#14-uso-sin-conexión-modo-offline)
15. [Copias de seguridad y restauración](#15-copias-de-seguridad-y-restauración)
16. [Solución de problemas (preguntas frecuentes)](#16-solución-de-problemas-preguntas-frecuentes)
17. [Glosario](#17-glosario)
18. [Anexo · Guía para soporte técnico](#18-anexo--guía-para-soporte-técnico)

---

## 1. Qué es el sistema

GesMttofcbv es la herramienta oficial para **planificar, ejecutar y documentar el mantenimiento**
(preventivo y correctivo) de los equipos críticos del colegio: servidores, computadores, switches,
UPS, aires acondicionados, proyectores, etc.

El sistema cubre el ciclo completo exigido por el **Sistema de Gestión de Calidad (SGC)**:

1. **Censar** los equipos (módulo 1).
2. **Planificar** su mantenimiento preventivo en un cronograma anual (módulo 2).
3. **Ejecutar y registrar** cada intervención, con checklist y firmas digitales (módulo 3).
4. **Revisar, aprobar y cerrar** las actas según el ciclo SGC (módulo 3).
5. **Generar los reportes oficiales** homologados PA-03 para imprimir o exportar (módulo 5).
6. Dejar **trazabilidad completa** (bitácora de auditoría inmutable) de todo lo anterior.

> Todos los reportes impresos quedan homologados bajo la norma **PA-03 (Versión 3, Vigencia
> 18-09-24)** e incluyen la leyenda _"Una vez impreso este documento se considera copia no
> controlada"_.

---

## 2. Acceso: usuarios, roles y contraseñas

### Roles disponibles

| Rol                       | Para quién                         | Qué puede hacer                                                                                                                                 |
| ------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Administrador**         | Coordinación de mantenimiento y TI | Acceso **total**: todos los módulos, crear/editar/eliminar, aprobar y reabrir.                                                                  |
| **Revisor (Revisor SGC)** | Calidad / auditoría interna        | Acceso **de solo lectura** a los módulos 3 y 5. Puede **aprobar y cerrar** actas, pero **no** crear ni editar contenido, y **no** reabre actas. |

### Qué ve cada rol en el menú lateral

| Módulo                                          | Administrador | Revisor |
| ----------------------------------------------- | :-----------: | :-----: |
| 0. Panel de Control                             |      Sí       |   No    |
| 1. Censo de Equipos                             |      Sí       |   No    |
| 2. Plan Anual                                   |      Sí       |   No    |
| 3. Registro Ejecución / Revisión de Actas (SGC) |      Sí       |   Sí    |
| 4. Mapa de Áreas                                |      Sí       |   No    |
| 5. Reportes Oficiales SGC                       |      Sí       |   Sí    |
| 6. Gestión de Usuarios                          |      Sí       |   No    |
| 7. Motor Base de Datos                          |      Sí       |   No    |

Si el revisor escribe en el navegador una dirección de administrador (por ejemplo `/equipos`), el
sistema lo **redirige automáticamente** al módulo de Reportes.

### Contraseñas

- Las contraseñas se guardan **cifradas** (nunca en texto plano) y **no** aparecen en la bitácora.
- Si olvida su contraseña, solicítela a TI: puede cambiarla desde el servidor con un comando
  (ver [Anexo](#18-anexo--guía-para-soporte-técnico)).
- Por seguridad, **cambie la contraseña temporal** entregada en la puesta en marcha.
- Tras **10 intentos fallidos** desde la misma red, el acceso se **bloquea 15 minutos**.

---

## 3. Cómo iniciar y cerrar sesión

### Iniciar sesión

1. Abra en el navegador la dirección del sistema (proporcionada por TI).
2. En la pantalla **"SGC FCBV — Portal de Gestión y Reportes"**, escriba su **Usuario** y
   **Contraseña**.
3. Pulse **"Acceder al Sistema"**.
4. El sistema lo lleva a su módulo inicial: el administrador a _Censo de Equipos_; el revisor a
   _Reportes Oficiales_.

### Cerrar sesión

Pulse **"Cerrar sesión"** al pie del menú lateral. La sesión caduca sola tras **24 horas**; si
ocurre, vuelva a iniciar sesión.

### Instalar como aplicación (opcional, recomendado)

El sistema es una **aplicación web instalable (PWA)**: desde el menú del navegador elija
_"Instalar aplicación"_ para tener un icono propio y aprovechar mejor el modo sin conexión.

---

## 4. Mapa general de módulos

El menú lateral (izquierda) es el recorrido habitual de trabajo, **en orden numérico**:

| N.º | Módulo                 | Dirección      | Función principal                                |
| --- | ---------------------- | -------------- | ------------------------------------------------ |
| 0   | Panel de Control       | `/panel`       | Resumen general e indicadores.                   |
| 1   | Censo de Equipos       | `/equipos`     | Inventario técnico de los equipos críticos.      |
| 2   | Plan Anual             | `/plan`        | Cronograma anual de mantenimiento preventivo.    |
| 3   | Registro Ejecución     | `/ejecucion`   | Registrar actas y ciclo SGC (revisión de actas). |
| 4   | Mapa de Áreas          | `/ubicaciones` | Catálogo de edificios, salas y áreas.            |
| 5   | Reportes Oficiales SGC | `/reportes`    | Formatos oficiales F01, F02, F03 y F05.          |
| 6   | Gestión de Usuarios    | `/usuarios`    | Altas, bajas y roles de usuarios.                |
| 7   | Motor Base de Datos    | `/database`    | Copias, migración, auditoría y persistencia.     |

En el encabezado superior aparecen, además, los botones de administrador **"Backup y
Restauración"**, **"Guía"**, **"Limpiar Sistema"** y **"Cargar Datos Demo"**.

**Flujo recomendado**: primero dé de alta las **ubicaciones** (módulo 4) y los **equipos**
(módulo 1); después **planifique** el año (módulo 2); durante el año **registre y revise** las
actas (módulo 3); y al final **genere los reportes** (módulo 5).

---

## 5. Módulo 0 · Panel de Control

**Para qué sirve:** ver de un vistazo el estado del mantenimiento. Solo el administrador lo ve.

**Indicadores (tarjetas):**

- **"Equipos Activos"** — número de equipos en operación. Botón **"Ver censo completo"** → módulo 1.
- **"Pendientes (30 Días)"** — intervenciones del mes actual y el próximo sin ejecutar. Botón
  **"Ir a ejecución"** → módulo 3.
- **"Cumplimiento (año)"** — porcentaje de mantenimientos ejecutados sobre los programados.
  Botón **"Ver reportes oficiales"** → módulo 5.
- **"Sin Ubicación"** — equipos activos a los que falta asignar área. Botón **"Revisar
  inventario"** → módulo 1.

**Alerta de calidad:** si existen equipos sin ubicación, aparece un aviso _("Atención: Hay equipos
que requieren actualización")_ que lista los códigos afectados y advierte que esa inconsistencia
se refleja en los reportes F01/F02. Pulse **"Asignar Ubicaciones Ahora"** para corregirlo.

---

## 6. Módulo 1 · Censo de Equipos

**Ruta:** `/equipos` · **Encabezado:** _"Registro de Equipos Críticos"_.

**Para qué sirve:** mantener el inventario técnico: qué equipos hay, dónde están, su marca/modelo,
sus partes y las tareas de mantenimiento que les corresponden.

### Acciones principales (barra superior)

- **"Nuevo Equipo Crítico"** — abre el formulario de alta.
- **"Importar Excel (.xlsx)"** y **"Plantilla Excel"** — carga masiva desde hoja de cálculo
  (descargue primero la plantilla).
- **"Escanear QR / OCR Etiquetas"** — lee la etiqueta del equipo (con IA o con OCR local) para
  autocompletar datos.
- **"Imprimir Etiquetas QR"** — genera las etiquetas para pegar en los equipos.
- **"Programación Masiva"** — lleva al Plan Anual con los equipos seleccionados.
- **"Ver Ubicaciones"** — abre el módulo 4.

### Tarjetas rápidas

"Total Equipos", "Activos en Plan", "Dados de Baja" y "Ubicaciones".

### Buscar y filtrar

- Buscador libre: _"Buscar por código (ej: AP-01), nombre, marca, serial o ubicación..."_.
- Filtros por **Ubicación**, **Estado** ("Todos los estados" / "Solo Activos" / "Dados de Baja") y
  **Frecuencia**.
- **"Limpiar filtros"** restablece la vista. Abajo se muestra _"Mostrando N de M equipos"_.

### Tabla

Columnas: selección (casilla), **"Código"**, **"Equipo / Descripción"**, **"Ubicación"**,
**"Marca / Modelo"**, **"Frecuencia"**, **"Partes & Tareas"**, **"Estado"** ("Activo" / "Dado de
baja") y **"Acciones"**.

**Acciones por fila:** imprimir su QR, **ver ficha** (ojo), **editar** (lápiz) y **dar de baja /
reactivar** (baja lógica: el equipo se conserva con su historial).

**Acciones masivas:** al marcar varias casillas aparece una barra flotante con _"N equipos
seleccionados"_ y permite **"Imprimir Etiquetas QR (N)"**, **"Programar Mantenimientos (año)"** y
**cambio rápido de frecuencia** (mensual/trimestral/semestral/anual).

### Ficha del equipo (formulario)

Campos: **Código** (se escribe en mayúsculas; atajos de prefijo `AP-`, `SW-`, `PC-`, `PY-`,
`SRV-`, `UPS-`, `AA-`), **Descripción/Nombre**, **Ubicación** (del catálogo o "Otra ubicación
personalizada", con opción de crear una ubicación al vuelo), **Marca/Modelo/Serial**,
**Frecuencia de Mantenimiento**, **Estado Operativo**, **Partes y Componentes**, **Tareas de
Mantenimiento** y **Observaciones**.

**Frecuencias:** Mensual (12 veces), Trimestral (Mar, Jun, Sep, Dic), Semestral (Jun, Dic), Anual
(Nov) o **Personalizada** (rejilla Ene–Dic para marcar los meses exactos).

**Validaciones:** el **código**, el **nombre** y la **ubicación** son obligatorios; el sistema
rechaza un código duplicado (_"Ya existe un equipo con el código ..."_).

> **Equipos dados de baja** no aparecen en el Plan Anual ni en las actas nuevas, pero su historial
> se conserva.

---

## 7. Módulo 2 · Plan Anual

**Ruta:** `/plan` · **Encabezado:** _"Plan de Mantenimiento Anual"_.

**Para qué sirve:** decidir **en qué meses del año** se hará mantenimiento a cada equipo, formando
el cronograma que alimenta el módulo de ejecución y el reporte F03.

### Controles superiores

- Selector de **año** (◀ ▶).
- **"Programación Masiva"** — abre el asistente de programación.
- **"Ejecutar Masivamente"** — registra de una vez varias órdenes como ejecutadas.
- **"Excel"** y **"PDF"** — exportan el cronograma.
- Botón circular de **recalcular**: restablece el cronograma según la frecuencia de ficha de cada
  equipo (con confirmación _"¿Desea restablecer el cronograma de {año}?"_).

### Indicadores

"Equipos en Cronograma", "Intervenciones (año)", "Mes con Mayor Carga" y el estado de la
"Programación Masiva".

### La matriz mensual

Tabla con **Código**, **Equipo / Descripción**, **Ubicación**, **Frec.**, doce columnas **Ene–Dic**
y una columna **"Total"** por equipo. Cada celda muestra **"X"** si ese mes está programado. En los
encabezados de mes hay un botón **"± lote"** para programar o desprogramar todo ese mes de una vez.
Al pie se resumen los _"Total Mantenimientos Programados / Mes"_.

Cada cambio de celda se **guarda al instante** y muestra un aviso de confirmación.

### Asistente "Programación Masiva"

Permite programar por lotes con varias estrategias:

- **Alcance:** equipos marcados, todos los activos, por ubicación o por frecuencia de ficha.
- **Estrategias:** "Según Frecuencia de Ficha" (automática, reparte en días hábiles), "Cadencia
  Predefinida", "Meses Específicos" o "Desprogramar / Limpiar".
- La estrategia automática permite fijar **mes de inicio**, **capacidad diaria** (máximo de
  equipos por jornada), **días hábiles** ("Solo Lu-Vi" o "+ Sábados"), **agrupar por ubicación** y
  **sincronizar fechas** con el registro de ejecución, con una **simulación en vivo**.
- **Presets** rápidos: Mensual, Trimestral (estándar/alterno), Semestral (estándar/vacaciones),
  Bimestral (pares) y Anual (Nov/Dic).
- **Modo de aplicación:** "Reemplazar Todo", "Adicionar Meses" o "Quitar Meses".
- Confirme con **"Aplicar Programación a N Equipos"**.

---

## 8. Módulo 3 · Registro de Ejecución y Revisión de Actas (SGC)

**Ruta:** `/ejecucion` · **Encabezado:** _"Mantenimiento Ejecutado"_.
En el menú del **revisor** aparece como **"3. Revisión de Actas (SGC)"**.

**Para qué sirve:** documentar cada intervención (preventiva o correctiva) mediante un **acta**,
con checklist, repuestos y **firma digital**, y gestionar su **ciclo de vida SGC**.

### Pestañas

- **"Preventivos (Plan Anual)"** — las órdenes generadas por el cronograma.
- **"Correctivos (Averías y Fallas)"** — las atenciones de fallas puntuales.

### Indicadores y filtros

Indicadores: **"Cumplimiento"**, **"Ejecutados"**, **"Pendientes"** y **"Atrasados"**. Filtros por
búsqueda libre, **Mes**, **Estado** ("Solo Pendientes" / "Solo Ejecutados" / "Solo Atrasados") y
**Ubicación**.

### Registrar una ejecución preventiva

1. Localice la orden y pulse **"Programar / Ejecutar"**.
2. Ajuste la **"Fecha Programada"** (debe ser día hábil, lunes a viernes; hay un botón para
   **"Sugerir primer día hábil"**).
3. Marque las tareas del **"Checklist de Tareas de Mantenimiento"** (o **"Marcar todas como
   realizadas"**) y active el interruptor **"¿Mantenimiento Ejecutado y Completado?"**.
4. Complete **fecha y hora real**, **nombre del técnico responsable**, cargo/documento y los
   **repuestos reemplazados** (si aplica).
5. Firme en el recuadro de **Firma Digital**.
6. Pulse **"Guardar Registro"**.

> Si marca el mantenimiento como ejecutado, el **nombre del técnico** y la **firma digital** son
> **obligatorios**.

### Registrar una ejecución correctiva

Pulse **"+ Mantenimiento Correctivo"** / **"+ Registrar Mantenimiento Correctivo"** y complete:
fecha y hora de la intervención, **tiempo fuera de servicio (horas)**, **descripción de la falla**,
**acción correctiva realizada**, **repuestos usados**, **estado operativo final** (✓ 100%
Operativo / ⚠️ Requiere Repuesto / ⛔ Proponer Baja), **técnico responsable** y **firma digital**.

### Ejecución masiva

**"Ejecutar Masivamente"** permite cerrar muchas órdenes de un mes o del año completo con un solo
técnico y una firma (modos: dibujar, firma certificada FCBV o cargar imagen).

### La columna "Acta SGC" y el ciclo de vida

Cada acta muestra su estado (**Borrador / Aprobado / Cerrado**) con su versión (`vN`) y los
botones disponibles según su estado y su rol:

- **"Aprobar"** (Borrador → Aprobado): administrador y revisor.
- **"Cerrar"** (Aprobado → Cerrado; pide confirmación): administrador y revisor.
- **"Reabrir"** (Cerrado/Aprobado → Borrador; pide confirmación): **solo administrador**.

Las actas **aprobadas** o **cerradas** se abren en **modo solo lectura** y **no** pueden editarse ni
eliminarse hasta reabrirlas. El detalle del ciclo está en la [sección 13](#13-ciclo-de-vida-sgc-de-las-actas-borrador--aprobado--cerrado).

---

## 9. Módulo 4 · Mapa de Áreas (Ubicaciones)

**Ruta:** `/ubicaciones` · **Encabezado:** _"Ubicaciones del Campus"_.

**Para qué sirve:** mantener el catálogo de **edificios, salas y áreas** (data centers,
laboratorios, oficinas, auditorios, etc.) y saber qué equipos hay en cada una.

### Acciones principales

- **"Nueva Ubicación"** — alta de un espacio.
- **"Editar Edificios (N)"** — crear, renombrar, reasignar o restablecer edificios. Al **renombrar**
  un edificio, todos los equipos vinculados se actualizan **en cascada**.
- **"Importar Excel"** / **"Exportar Excel"** — carga y descarga masiva del catálogo.
- **"Nueva Ubicación"**.

### Indicadores y filtros

Indicadores: "Total Ubicaciones", "Activas", "Con Equipos" y "Equipos Ubicados". Filtros por
búsqueda, **Edificio**, **Tipo de Área** (Data Center, Laboratorio Cómputo, Aula / Biblioteca,
Oficina TI, Auditorio, Infraestructura, Otro Ambiente) y **Estado**.

### Tabla

Columnas: **"Ubicación / Espacio"**, **"Edificio / Bloque"**, **"Tipo de Ambiente"**, **"Equipos
Asignados"**, **"Estado"** y **"Acciones"** (ver detalle, editar, eliminar).

Al **eliminar** una ubicación con equipos, el sistema pide **reasignarlos** a otra área para no
dejarlos sin ubicación.

---

## 10. Módulo 5 · Reportes Oficiales SGC

**Ruta:** `/reportes` · **Encabezado:** _"Reportes Oficiales SGC"_.
Módulo disponible también para el **revisor**.

**Para qué sirve:** generar los formatos oficiales homologados **PA-03** para imprimir o exportar a
Excel. Arriba están los botones globales **"Descargar Excel"** e **"Imprimir / PDF"**, y el filtro
común por **"Ubicación"** y por búsqueda.

### Formatos disponibles

| Formato                          | Código    | Qué contiene                                                            |
| -------------------------------- | --------- | ----------------------------------------------------------------------- |
| **"Listado Equipos Críticos"**   | PA-03-F01 | Censo tabular: **Codigo**, **Nombre** y **Ubicación** (paginado).       |
| **"Ficha Técnica de Equipos"**   | PA-03-F02 | Especificaciones, partes y tareas del equipo seleccionado.              |
| **"Programación de Mttos"**      | PA-03-F03 | Matriz anual preventiva de 12 meses para el año elegido.                |
| **"Registro de Mtto Ejecutado"** | PA-03-F05 | Bitácora de intervenciones, firmas y **trazabilidad SGC** de cada acta. |

### Cómo generar un reporte

1. Pulse la tarjeta del **formato** deseado.
2. Ajuste el alcance: en F02/F05 elija un **Equipo** (o "Todos los equipos"); en F03 elija el
   **Año del Cronograma** (2025/2026/2027).
3. Use el filtro de **Ubicación** y el buscador para acotar la lista.
4. Pulse **"Descargar Excel"** para el archivo de cálculo o **"Imprimir / PDF"** para el documento
   físico o PDF.

### El reporte F05 y el SGC

El **F05** incluye, por equipo, una tabla con **Fecha**, **Descripción del Mantenimiento**,
**Estado SGC** (sello Borrador/Aprobado/Cerrado `vN`), **Firma Elaboró** y **Revisión SGC**
(quién aprobó/cerró y cuándo, o "Pendiente de aprobación"), además de un **resumen por estado**
(_"N cerrada(s) · N aprobada(s) · N en borrador"_) al pie. Así, el documento impreso refleja el
ciclo de vida del acta.

### Logo institucional

El administrador puede cambiar el **logo** que aparece en los encabezados de los reportes
("Subir Logo" / "Restablecer"; PNG/JPG/SVG/WebP, máximo 5 MB).

---

## 11. Módulo 6 · Gestión de Usuarios

**Ruta:** `/usuarios` · **Encabezado:** _"Gestión de Usuarios"_. Solo administrador.

**Para qué sirve:** dar de alta usuarios, asignarles rol y eliminarlos.

- **"Nuevo Usuario"** abre el formulario con **Nombre Completo**, **Usuario (Login)**,
  **Contraseña** y **Rol** (Administrador / Revisor).
- Para editar, pulse el lápiz; deje la contraseña **en blanco** si no desea cambiarla.
- Para eliminar, pulse la papelera y confirme (_"¿Estás seguro de eliminar este usuario?"_).

> El usuario **`admin` principal no puede eliminarse** ni perder su rol de administrador: es la
> cuenta de recuperación del sistema.

---

## 12. Módulo 7 · Motor de Base de Datos

**Ruta:** `/database` · Solo administrador.

**Para qué sirve:** gestionar el almacenamiento de los datos, su respaldo y la trazabilidad.

### Estadísticas

"Equipos Críticos", "Ubicaciones del Campus", "Mantenimientos Ejecutados", "Planes Anuales" y el
**peso del archivo** de base de datos.

### Copias de Seguridad del Servidor

- Muestra el estado (_"Activas"_), la **frecuencia** automática y la **carpeta** de copias.
- Botones **"Actualizar"** y **"Crear copia ahora"**.
- Tabla de copias con **Archivo**, **Fecha**, **Tipo**, **Tamaño** y acciones para **descargar** o
  **eliminar**.
- Se crea una copia **automática** cada cierto número de horas y otra **antes** de vaciar o
  restaurar datos.

### Bitácora de Auditoría (SGC)

Registro **inmutable** de todo lo ocurrido: inicios de sesión, altas/cambios/bajas de usuarios,
escrituras de datos, transiciones SGC de actas, cambios de configuración y gestión de copias.

- Consúltela con los filtros **Acción**, **Usuario**, **Entidad**, **Desde** y **Hasta**.
- Exporte con **"CSV"**, **"JSON"** o **"Consultar"**.
- Las **contraseñas nunca** se registran.

### Migración a MySQL (opcional)

El sistema funciona con **SQLite** (base local en el servidor), que es lo recomendado para este
colegio. Si en el futuro se requiere un **servidor MySQL/MariaDB** externo, esta pantalla permite
configurar la conexión, **"Probar Conexión MySQL"**, guardar las preferencias y
**"Migrar SQLite a MySQL"**.

---

## 13. Ciclo de vida SGC de las actas (borrador → aprobado → cerrado)

Toda acta nace en **Borrador** y avanza por transiciones **irreversibles salvo reapertura**:

| Estado       | Cómo se llega                     | ¿Se puede editar el contenido? | Quién lo aplica         |
| ------------ | --------------------------------- | :----------------------------: | ----------------------- |
| **Borrador** | Estado inicial de toda acta       |               Sí               | —                       |
| **Aprobado** | Desde Borrador                    |               No               | Administrador o Revisor |
| **Cerrado**  | Desde Aprobado                    |         No (inmutable)         | Administrador o Revisor |
| **Borrador** | Reapertura desde Aprobado/Cerrado |               Sí               | **Solo Administrador**  |

### Flujo operativo recomendado

1. El **técnico** (administrador) registra la intervención y guarda el acta → queda en **Borrador**.
2. El **revisor SGC** revisa el contenido y pulsa **"Aprobar"** → queda en **Aprobado**.
3. Tras la verificación final, pulsa **"Cerrar"** → queda **Cerrado e inmutable**. Ese es el estado
   que refleja el reporte F05.
4. Si hay un error, el **administrador** puede **"Reabrir"** el acta, corregirla y volver a
   aprobarla y cerrarla. Cada transición **incrementa la versión** (`v1`, `v2`, …) y guarda
   **quién y cuándo**.

### Reglas que debe conocer

- Editar o eliminar un acta **aprobada** o **cerrada** responde con **conflicto** y **no** se
  aplica: primero hay que reabrirla.
- Las actas **cerradas** no se pueden borrar sin reabrir.
- **Aprobar / cerrar** está permitido a administrador y revisor; **reabrir**, solo al
  administrador.
- Las transiciones requieren **conexión** (dependen del estado en el servidor) y quedan en la
  **bitácora de auditoría**.

---

## 14. Uso sin conexión (modo offline)

El sistema funciona de forma **degradada sin internet**, pensando en recorridos por el campus:

- Puede **abrir la aplicación** aunque no haya red (se guarda una copia de la interfaz).
- **Puede consultar** los últimos datos conocidos.
- Los cambios que haga **se guardan localmente** y se reflejan de inmediato en pantalla.
- Al recuperar la conexión, esos cambios **se envían solos** al servidor. También puede forzarlo con
  el botón **"Sincronizar ahora"**.

El **indicador del menú lateral** muestra el estado:

- **"En línea · datos sincronizados"** — todo al día.
- **"Cambios pendientes"** o **"Sin conexión"** — hay operaciones por enviar.
- Si un cambio **entra en conflicto** con el de otro usuario, **no se sobrescribe en silencio**: se
  marca como **fallido** para que lo revise (puede **reintentar** o **descartar**).

> Las **transiciones SGC** (aprobar / cerrar / reabrir) y las operaciones de **usuarios, copias y
> configuración** requieren **conexión**.

---

## 15. Copias de seguridad y restauración

### Copia completa en archivo (.json) — recomendada antes de cambios grandes

Desde el encabezado, **"Backup y Restauración"**:

- **Exportar:** pestaña _"Crear Copia de Seguridad (Exportar)"_ → botón **"Descargar Copia de
  Seguridad Completa (.json)"** (o **"Copiar JSON"**). El archivo incluye equipos, ubicaciones,
  ejecuciones y cronogramas.
- **Importar:** pestaña _"Restaurar Copia de Seguridad (Importar)"_ → arrastre el archivo `.json`,
  revise el **"Contenido Verificado"**, elija el modo (**"Reemplazo Completo"** o **"Fusión
  Inteligente"**) y pulse **"Restaurar Base de Datos"**. Se recomienda dejar marcada la casilla de
  respaldo automático previo.

### Copias del servidor

En el módulo 7 (_"Copias de Seguridad del Servidor"_) el sistema crea copias **automáticas** cada
cierto número de horas y **antes** de operaciones destructivas; pueden descargarse o eliminarse.

### Vaciar datos para iniciar con datos reales

Desde el encabezado, **"Limpiar Sistema"** abre el cuadro _"Limpiar Datos de Demostración"_, que
permite vaciar equipos, cronogramas, actas y (opcionalmente) **conservar** el catálogo de
ubicaciones. El sistema genera una copia preventiva antes de borrar.

> **Recomendación:** antes de cualquier limpieza o restauración, descargue una **copia `.json`** y
> una **copia del servidor**. Así siempre podrá volver atrás.

---

## 16. Solución de problemas (preguntas frecuentes)

**No puedo iniciar sesión.**
Verifique usuario y contraseña. Si tras varios intentos no entra, pudo activarse el bloqueo de
**15 minutos**. Si persiste, pida a TI restablecer la contraseña.

**"Otro usuario modificó los datos. Se recargó la información."**
Alguien guardó cambios en el mismo registro antes que usted. El sistema recargó los datos: revise y
vuelva a aplicar su cambio. No se pierde información de forma silenciosa.

**No puedo editar un acta.**
Está **Aprobada** o **Cerrada**. Solicite al administrador que la **reabra** si necesita
corregirla.

**El botón "Reabrir" no aparece.**
Solo el **administrador** puede reabrir actas; el revisor únicamente aprueba y cierra.

**Veo un aviso ámbar o rojo en el indicador de conexión.**
Hay cambios **pendientes** o **sin conexión**. Espere a recuperar la red o pulse **"Sincronizar
ahora"**. Si algún cambio quedó **fallido**, revíselo y **reintente** o **descártelo**.

**Un equipo no aparece en el Plan Anual.**
Los equipos **dados de baja** se excluyen. Reactive el equipo en el módulo 1 si debe volver al
plan.

**El reporte sale incompleto o con "Sin Ubicación".**
Hay equipos activos **sin área asignada**. Corrija la ubicación (módulo 1 o 4) y regenere el
reporte; revise también la alerta del Panel de Control.

**La impresión o el PDF no salen bien.**
Use **"Imprimir / PDF"** y, en el diálogo del navegador, elija el tamaño **Carta/A4** y active
_"Gráficos de fondo"_. Evite escalados al reducir.

**Instalé la aplicación pero no guarda sin conexión.**
El modo offline del navegador requiere que el sistema se sirva por **HTTPS** (o `localhost`).
Consulte con TI.

---

## 17. Glosario

- **Acta:** registro de una intervención de mantenimiento (preventiva o correctiva) con checklist,
  responsable y firma.
- **Preventivo:** mantenimiento planificado según la frecuencia del equipo.
- **Correctivo:** atención de una falla o avería puntual.
- **SGC:** Sistema de Gestión de Calidad; define el ciclo de vida y la trazabilidad de las actas.
- **Borrador / Aprobado / Cerrado:** estados del ciclo de vida del acta.
- **PA-03:** norma de elaboración de documentos de FCBV; los reportes F01/F02/F03/F05 la cumplen.
- **Reportes F01/F02/F03/F05:** formatos oficiales (listado de equipos, ficha técnica,
  programación anual y registro de mantenimiento ejecutado).
- **Outbox / modo offline:** cola de cambios pendientes de enviar al servidor.
- **Bitácora de auditoría:** historial inmutable de lo que ocurre en el sistema.
- **PWA:** aplicación web instalable que funciona parcialmente sin conexión.

---

## 18. Anexo · Guía para soporte técnico

Solo para el personal de TI. Requisitos y detalles ampliados en el [`README.md`](../README.md).

### Requisitos y arranque en el servidor (Ubuntu + PM2)

```bash
npm ci
cp .env.example .env      # complete JWT_SECRET y demás variables
npm run build
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup               # arranque automático al reiniciar
```

Comandos útiles:

```bash
pm2 logs gesmttofcbv      # ver registros
pm2 restart gesmttofcbv   # reiniciar tras un nuevo build
pm2 status
```

> Mientras se use **SQLite**, el proceso debe correr en `fork` con **una sola instancia**
> (`ecosystem.config.cjs` ya está configurado así). El modo _cluster_ con varias instancias
> provocaría bloqueos de escritura. Solo si se migra a **MySQL** puede pasar a _cluster_.

### Variables de entorno clave

`JWT_SECRET` (obligatoria, mínimo 32 caracteres), `PORT`, `NODE_ENV`,
`INITIAL_ADMIN_PASSWORD` / `INITIAL_REVISOR_PASSWORD` (solo para el primer arranque),
`GEMINI_API_KEY` (opcional, OCR con IA), `DB_ENGINE`, `SQLITE_PATH`, `BACKUP_DIR`,
`BACKUP_RETENTION` y `BACKUP_INTERVAL_HOURS`. Valores detallados en `.env.example`.

### Restablecer una contraseña

```bash
npm run security:set-password -- admin "NuevaContraseñaSegura123"
npm run security:set-password -- revisor "OtraContraseñaSegura123"
```

### Calidad antes de desplegar

```bash
npm run check          # tipos + lint + pruebas
npm run format:check   # formato
npm run build          # compila frontend y servidor en dist/
```

La integración continua (GitHub Actions) ejecuta estas verificaciones en cada envío a `main`.

### Copias y datos

- Las copias automáticas viven en `backups/` (configurable con `BACKUP_DIR`), con retención de
  `BACKUP_RETENTION` copias.
- `.env`, `uploads/`, `data/`, `backups/` y `logs/` **no** se versionan en Git.

### Notas de arquitectura recientes (útiles para soporte)

- La API expone **endpoints REST por recurso** (`/api/equipments`, `/api/locations`,
  `/api/buildings`, `/api/annual-plans`, `/api/executions`), con **bloqueo optimista**
  (`{ data, expectedRevision }` → `{ revision }` + `ETag`, `409` en conflicto). El antiguo
  `/api/sync/:entity` se conserva como alias.
- El frontend usa **React Router** (cada módulo tiene su URL) y **TanStack Query** (caché de estado
  de servidor). La capa **offline** (espejo en IndexedDB + outbox) sigue siendo la única vía de
  acceso a los datos.
- El esquema se aplica con **migraciones versionadas** al arrancar; **no edite** una migración ya
  aplicada: cree una nueva.
