# Auditoría e implementación de mejoras de agilidad de Mind

Fecha: 3 de noviembre de 2026. Versión: `1.14.20`. Código revisado: `6f3da56f`.

Entorno local: Node `v25.8.2`. CI declara Node 24; esta ejecución no reemplaza una validación en ese entorno.

## Dictamen de la línea de base

**Actualización:** se implementaron las mejoras de código detalladas en el anexo final, con pruebas de navegador y PostgreSQL. Los hallazgos A01–A17 describen el código original, previo a esa implementación. La capacidad de producción sigue requiriendo validación en el entorno desplegado.

La aplicación tiene buenas bases, pero **todavía no hay evidencia suficiente para declararla preparada para uso masivo**. Los riesgos principales son el trabajo que crece con todo el historial, las consultas por registro y los recursos que siguen siendo locales al servidor. Ampliar CPU o agregar réplicas sin resolverlos puede trasladar el cuello de botella a PostgreSQL o producir comportamientos inconsistentes.

También hay un defecto de uso verificable desde el código: el inicio consulta tareas personales mediante una ruta exclusiva de Operaciones y transforma el rechazo en una lista vacía. Una app que responde rápido pero oculta tareas por error tampoco resulta ágil.

Se encontró además una exposición de datos financieros en rutas BI sin autenticación en la aplicación. Debe atenderse antes de ampliar el acceso.

La auditoría original no modificaba la aplicación. La implementación posterior está incluida en esta rama. El estado del release se comprueba mediante CI, el SHA publicado en `/api/health` y readiness en `/api/ready`.

## Alcance y límites de la evidencia

Se revisaron el arranque y enrutamiento, frontend React/Vite, consultas y cachés, Express, autenticación, PostgreSQL/Drizzle, trabajos automáticos, chat, archivos, pruebas y CI. Se siguieron los puntos de entrada de los módulos principales y se profundizó en recorridos representativos. No equivale a comprobar cada interacción de cada pantalla.

Se ejecutaron instalación reproducible, pruebas, TypeScript, build y medición de dependencias estáticas del bundle. Se reprodujo aisladamente el rechazo del middleware de permisos para un miembro con `projects` y sin `operations`.

No había `DATABASE_URL`, `FINANCIAL_TEST_DATABASE_URL` ni `TEST_MCP_DATABASE_URL` configuradas. No se inició el backend, porque su arranque ejecuta migraciones, seeds y trabajos. No se ejecutaron pruebas de carga, consultas de diagnóstico sobre producción ni un recorrido visual autenticado. Quedan pendientes tiempos HTTP, planes SQL, mediciones de navegador, accesibilidad con tecnologías de asistencia y ensayos con usuarios reales.

En los hallazgos se distingue entre **comprobado** —código o medición local— y **riesgo inferido** —consecuencia esperable cuya magnitud requiere ensayo—. No se atribuye una latencia ni una capacidad de usuarios sin medirlas.

## Línea de base local

| Comprobación | Resultado |
| --- | --- |
| `npm ci --no-audit --no-fund` | Correcto; 798 paquetes instalados |
| `npm test` | 99 archivos aprobados, 8 omitidos; 1.012 pruebas aprobadas y 77 omitidas; 14,67 s |
| `npm run check` | Correcto |
| `npm run build` | Correcto; Vite 3,09 s y esbuild 87 ms |
| JavaScript inicial estático | 58 archivos, 1.310.401 bytes; gzip local estimado: 386.937 bytes |
| CSS inicial | 245.401 bytes; gzip local estimado: 39.087 bytes |
| Archivo JS de entrada | 471.556 bytes |
| Gráficos incluidos en la carga inicial | Chunk `generateCategoricalChart`: 345.248 bytes |
| Panel de detalle incluido en la carga inicial | Chunk `TaskDetailPanel`: 51.707 bytes |
| Worker PDF | 1.321,30 kB en el build; no forma parte del total inicial estático |

El total inicial incluye el cierre transitivo de imports estáticos y los `modulepreload` del HTML. Excluye rutas dinámicas, fuentes, scripts externos, imágenes y respuestas API. **Gzip local no significa que el servidor desplegado esté comprimiendo las respuestas.** El tiempo de build tampoco mide la velocidad que percibe una persona.

Los logs y la medición reproducible quedan en `.context/audit-performance/`: `build.log`, `tests.log`, `typecheck.log`, `bundle.json` y `measure-bundle.mjs`. Para repetir la medición en este workspace: `node .context/audit-performance/measure-bundle.mjs`, después del build. `.context` es evidencia local y no forma parte de la documentación versionada.

## Cobertura por área

| Área | Revisión realizada | Pendiente para validación completa |
| --- | --- | --- |
| Inicio y navegación | Dependencias iniciales, consultas, permisos y estados vacíos | Recorrido autenticado por perfil, móvil y teclado |
| Tareas y calendario | Listados, filtros, privacidad de horas, detalle y render de listas | Datos grandes, drag and drop, edición concurrente y dispositivo móvil |
| Portfolio/proyectos | Ruta efectiva `/api/projects`, agregador, métricas y filtros | Planes SQL y tiempos con volumen realista |
| Cotizaciones/propuestas | Listado, consultas auxiliares, grupos y margen | Flujo completo de creación, guardado y publicación |
| CRM/clientes | Búsqueda, enriquecimiento por oportunidad y listados | Tableros grandes y arrastre con dos usuarios |
| Finanzas | Dashboard nativo, lectura histórica, carga documental y rutas BI | Conciliación y latencia sobre una base de ensayo |
| Equipo/capacidad/liquidaciones | Consultas por período, bloqueos y programación de trabajos | Cierres simultáneos y convivencia con tráfico web |
| Reviews/objetivos | Rutas, consultas por sala/año, historial y caché | Sesiones colaborativas, historial grande y acciones concurrentes |
| Chat/notificaciones | Conexiones, distribución, polling y worker de entregas | Dos réplicas, desconexiones y clientes lentos |
| Administración/integraciones | Autenticación, arranque, sincronizaciones y almacenamiento | Acciones administrativas de punta a punta |
| Propuestas públicas/proveedores | Enrutamiento y carga diferida | Auditoría funcional y visual autenticada/pública específica |
| Infraestructura/CI | Pool, migraciones, estáticos y verificaciones automatizadas | Configuración efectiva del hosting, CDN, recursos y base |

## Hallazgos priorizados

P0: resolver antes de ampliar acceso. P1: resolver o medir con un criterio explícito antes de promover escala. P2: siguiente ciclo de mejora de experiencia y eficiencia.

### A01 · P0 · Rutas BI financieras registradas antes de la autenticación

**Comprobado en código.** `server/index.ts:1129` y rutas siguientes responden consultas a vistas financieras. Se registran antes de `registerRoutes()`; `setupAuth()` recién se instala dentro de esa función, en `server/routes.ts:1067`. No hay guard de autenticación en esas rutas BI. CORS no reemplaza autenticación.

**Impacto:** acceso a información financiera sin sesión a nivel aplicación y posibilidad de consumir consultas sin control de acceso. La exposición externa efectiva depende también del proxy/red, que no se inspeccionó.

**Acción:** autenticar la integración BI con identidad de servicio y permisos de lectura específicos, o protegerla con sesión y permiso financiero si corresponde. Mantener el contrato de la integración autorizada.

**Aceptación:** petición sin credenciales rechazada; perfil sin permisos rechazado; integración autorizada funcional; respuestas sensibles con política de caché adecuada. Prueba de ruta real, no sólo búsqueda de texto.

### A02 · P1 · El inicio puede ocultar tareas por un rechazo de permisos

**Comprobado por trazado y reproducción aislada del guard.** `client/src/pages/home-dashboard.tsx:150` consulta `/api/tasks/team-calendar?assigneeId=...` y devuelve `[]` cuando `response.ok` es falso. Esa ruta exige `operations` en `server/routes.ts:23481`. Un usuario con acceso a sus tareas mediante `projects` o `task_manager`, sin Operaciones y sin ser administrador, recibe 403.

Además, otras tarjetas del inicio convierten fallos en cero/listas vacías. En `client/src/pages/my-tasks.tsx:103` se parsea JSON sin comprobar estado HTTP; el dashboard financiero no separa explícitamente su error de consulta del caso sin datos (`client/src/pages/executive-dashboard-v2.tsx:77,178`).

**Acción:** usar una ruta personal autorizada, con el contrato que necesita el calendario; distinguir cargando, vacío, error y dato anterior disponible. Conservar la restricción del calendario de equipo.

**Aceptación:** miembro, responsable, Operaciones y administrador ven sus tareas correctas; 403/500/red interrumpida muestran estado explícito y reintento; un error no comunica “sin tareas” ni saldo cero.

### A03 · P1 · Listados de tareas y cotizaciones sin límite de resultados

**Comprobado.** `/api/tasks` y `/api/tasks/my-tasks` leen resultados sin paginación (`server/routes.ts:23340,23395`). Mis tareas pide el historial sin ventana desde `client/src/pages/my-tasks.tsx:103`. Las estimaciones se cargan para todos los IDs devueltos. `/api/quotations` tampoco pagina (`server/routes.ts:6353`). Los listados generales de tareas seleccionan todas las columnas, incluida procedencia JSON de importación; la ruta de tareas de proyecto ya elimina parte del material bruto, una mejora que conviene extender.

**Riesgo inferido:** respuestas, memoria, serialización y trabajo del navegador crecen con la historia, aunque la persona sólo mire una semana o las primeras filas.

**Acción:** contratos ligeros de listado, filtro de estado/fechas en SQL, paginación estable y detalle bajo demanda. En calendario, acotar a la ventana visible y contemplar por separado vencidas y sin fecha. Evitar truncar tareas silenciosamente.

**Aceptación:** volumen transferido acotado por página/ventana; recorrido completo sin omisiones ni duplicados; mantener totales, subtareas y permisos.

### A04 · P1 · Cada lectura de tareas puede recalcular todo el historial personal de horas

**Comprobado.** El middleware de `server/routes.ts:1081` carga las tareas de los proyectos del miembro y todas sus entradas de horas, y recorre ancestros, antes de responder muchas rutas GET. Se ejecuta también para lecturas pequeñas, como comentarios o detalle. Varias rutas vuelven a ejecutar `requireAuth` después del guard general.

**Riesgo inferido:** abrir un panel pequeño puede costar más a medida que crece todo el historial del usuario.

**Acción:** calcular la proyección de privacidad sólo en respuestas que incluyen horas, acotada a IDs/período de la respuesta; agregación por lotes y contexto de autenticación reutilizable por petición. La privacidad debe mantenerse.

**Aceptación:** comentarios no consultan el historial de horas; detalle consulta sólo lo necesario; pruebas de privacidad y totales de ancestros siguen pasando.

### A05 · P1 · CRM multiplica consultas por cada oportunidad y por cada búsqueda

**Comprobado.** En `server/routes.ts:22845`, se cargan oportunidades, se filtran en memoria y se consultan actividad y recordatorios por cada resultado (`:22873`). Para N oportunidades retenidas hay **2 + 2N consultas de datos del listado**, si hay resultados, antes de contar autenticación/sesión. Con 100 resultados son 202 consultas de ese recorrido; no es una medición de tiempo. El pool sólo permite 20 conexiones simultáneas por proceso.

`client/src/pages/crm.tsx:851` cambia la consulta con cada cambio del texto de búsqueda; no hay debounce en ese recorrido. El fetch no consume la señal de cancelación ni comprueba `res.ok`.

**Acción:** filtrar y paginar en SQL; obtener última actividad y cantidad de pendientes por consultas agrupadas o joins; debounce orientativo de 250–350 ms y cancelación de búsquedas anteriores.

**Aceptación:** número de consultas aproximadamente constante por página; escribir rápido no acumula peticiones obsoletas; errores visibles; búsqueda mantiene empresas, oportunidades y contactos.

### A06 · P1 · El portfolio recalcula y consulta por proyecto en la lectura

**Comprobado.** La ruta activa es `handleProjectsRequest` (`server/routes.ts:1222,1418`), no el router antiguo de `server/routes/projects.ts`, cuyo montaje está comentado. Crea un agregador por petición y, para `period=YYYY-MM`, agrega otra lectura del esquema financiero sobre la respuesta ya calculada.

`server/domain/projectsActive.ts:750` recorre proyectos y hace `await storage.getClient(...)` dentro del bucle (`:846`). La resolución de nombres/alias puede consultar y registrar candidatos durante la lectura (`:592,669`). No se encontró una caché de respuesta compartida en este recorrido.

**Acción:** traer clientes/aliases por lotes, resolver con mapas, consolidar la fuente de métricas por período y sacar la escritura de aliases de la navegación. Agregar caché corta con invalidación sólo después de asegurar que la clave respeta permisos y fuente de datos.

**Aceptación:** cantidad de consultas no aumenta una por proyecto; navegación de portfolio no escribe aliases; cifras y moneda coinciden con los contratos actuales.

### A07 · P1 · El dashboard financiero calcula todos los períodos antes de filtrar

**Comprobado.** `server/services/financial-native-dashboard.ts:54` obtiene historia y períodos vivos, con varias subconsultas correlacionadas y acumulados `period_key <= p.period_key`; recién después elige el mes/trimestre pedido. Cambiar el período puede repetir el cálculo completo. El header HTTP privado de la ruta no es una caché de cómputo compartida entre usuarios.

**Acción:** medir `EXPLAIN (ANALYZE, BUFFERS)` sobre una copia representativa; preagregar por período, calcular acumulados con una estrategia que preserve el saldo inicial y reutilizar períodos cerrados. Separar metadatos de períodos disponibles del detalle solicitado.

**Aceptación:** un mes no reconstruye innecesariamente toda la historia; acumulados, cierres y conversiones siguen conciliando; p95 medido con historia creciente.

### A08 · P1 · Arranque y trabajos automáticos necesitan coordinación entre réplicas

**Comprobado.** `server/index.ts:1167` aplica DDL y seeds antes de escuchar HTTP y lanza múltiples trabajos dentro del servidor web. Las migraciones capturan errores y continúan. `daily-sot-sync` y `resumen-ejecutivo-sync` usan flags locales. `AutoSyncService.isRunning` indica que el servicio arrancó, pero `performSync()` no lo usa como exclusión de cada ejecución (`server/services/autoSyncService.ts:17,58`): una ejecución manual y otra programada pueden superponerse.

**Riesgo inferido:** más réplicas pueden repetir trabajo, competir por locks y ejecutar migraciones a la vez. La idempotencia existente reduce algunos efectos, pero no evita el consumo repetido ni reemplaza coordinación global. **Excepción positiva:** las entregas de correo ya se reclaman con `FOR UPDATE SKIP LOCKED` (`server/services/user-notifications.ts:257`).

**Acción:** migración de release con un dueño, worker separado o liderazgo con lease en base, exclusión e idempotencia por trabajo/período, límites de concurrencia y seguimiento de reintentos.

**Aceptación:** con dos instancias sólo una ejecuta cada trabajo lógico; caída del dueño permite retomar; no se avanza como saludable ante una migración requerida fallida.

### A09 · P1 · Archivos locales y cargas en memoria limitan la escala horizontal

**Comprobado.** `server/upload.ts` escribe en `public/uploads`. La carga financiera privada usa filesystem local por defecto (`server/services/financial-intake-files.ts:34`); puede configurarse otro directorio, pero no se verificó almacenamiento compartido. Multer mantiene hasta 10 archivos de 20 MiB en memoria por solicitud financiera: techo nominal de **200 MiB por solicitud**, antes de copias y extracción. `server/routes-financial-native.ts:134` espera la extracción de los archivos dentro de la petición, secuencialmente.

**Riesgo inferido:** archivo subido en réplica A no disponible en B si el disco no es compartido; consumo alto de RAM y peticiones largas con cargas simultáneas.

**Acción:** almacenamiento de objetos privado o solución compartida validada, transferencia por streaming o subida directa autorizada, límite de bytes agregados y extracción en cola con progreso/reintento.

**Aceptación:** subir en A y descargar desde B funciona respetando permisos; una extracción lenta no bloquea el flujo; límite de memoria medido bajo concurrencia y recuperación tras reinicio.

### A10 · P1 · Pool y ciclo de vida sin presupuesto de capacidad verificado

**Comprobado.** `server/db.ts:13` fija `max:20` y espera de conexión de 10 s. Sesiones y consultas de negocio usan el mismo pool (`server/storage.ts:476`). No se encontró timeout general de sentencias/consultas ni cierre ordenado con `SIGTERM` para HTTP, WebSocket, jobs y pool. MCP sí configura un timeout SQL local en su propio recorrido.

**Acción:** presupuestar conexiones considerando web, workers, sesiones, herramientas y reserva; observar `waitingCount`, tiempos de espera y consultas; timeouts por clase de operación; drenado de peticiones al desplegar. Revisar índices de tareas/CRM con planes reales, sin asumir que el schema del repositorio refleja todos los índices de producción.

**Aceptación:** la suma de pools de todas las instancias cabe en PostgreSQL; una consulta lenta no ocupa recursos indefinidamente; despliegue drena peticiones y cierra recursos. No aumentar el pool como primera solución. La documentación de [node-postgres explica el presupuesto entre instancias](https://node-postgres.com/guides/pool-sizing).

### A11 · P2 · La carga inicial arrastra pantallas financieras y paneles secundarios

**Medido.** Hay 1,31 MB de JS estático inicial. Aunque muchas rutas son lazy, `client/src/App.tsx:48` importa directamente Proyección, ARR, Rendimiento y Costos; Inicio también es directo (`:87`). El grafo inicial del build incluye gráficos y detalle de tareas.

**Acción:** diferir esas rutas, montar el panel de detalle sólo al abrirlo y verificar qué dependencias puede diferir Inicio. Medir el grafo real; dividir archivos manualmente por sí solo no garantiza menos descarga inicial.

**Aceptación propuesta:** reducir al menos 30% el JS inicial gzip respecto de 386.937 bytes, sin generar una cascada perceptible al navegar; comprobar login, Inicio y pantallas financieras por separado.

### A12 · P2 · Cachés e invalidaciones generan recargas evitables

**Comprobado.** El caché global tiene valores razonables, pero Cotizaciones fuerza `staleTime:0`, `gcTime:0` y refetch al enfocar (`client/src/pages/manage-quotes.tsx:63`), junto con ocho consultas auxiliares declaradas en esa pantalla. El listado de grupos carga workspaces por grupo (`server/routes.ts:7374`). Cambiar de Review invalida todas las consultas (`client/src/lib/queryClient.ts:34`). La función de consulta predeterminada no propaga `AbortSignal` a `fetch`.

**Acción:** freshness por recurso y necesidad de negocio, estadísticas agregadas, detalle de grupo al abrir, invalidación por dominio/sala y cancelación de solicitudes que ya no interesan. Para colaboración, asegurar además la actualización entre usuarios: evitar recargas no debe dejar datos obsoletos silenciosamente.

**Aceptación:** volver a una pantalla no repite cargas completas sin motivo; cambiar de sala sólo refresca recursos afectados; guardar mantiene datos coherentes. [TanStack documenta la cancelación mediante la señal de cada consulta](https://tanstack.com/query/v5/docs/react/guides/query-cancellation).

### A13 · P2 · La búsqueda global descarga colecciones completas y cruza arrays

**Comprobado.** `client/src/components/features/global-search.tsx:62` carga clientes, proyectos, cotizaciones y entregables al abrir. La búsqueda usa `find`/`filter` anidados en memoria en cada término.

**Acción:** endpoint de búsqueda autorizada con término mínimo, resultados acotados y orden de relevancia; para conjuntos pequeños, mapas de lookup y debounce pueden ser una mejora intermedia.

**Aceptación:** buscar no necesita transferir todas las entidades; resultados respetan permisos, son navegables por teclado y muestran carga/error.

### A14 · P2 · Listas/tableros grandes montan todos sus elementos

**Comprobado.** `client/src/components/tasks/ProjectTaskList.tsx:931,965,1245` y el CRM renderizan colecciones por `map`; no se encontró virtualización en esos recorridos. El calendario de equipo ya limita visualmente elementos por día y pide una ventana de fechas, una base positiva.

**Riesgo inferido:** costo de DOM y drag and drop crece al expandir muchos elementos. Hace falta medirlo, no asumir que memoizar todo lo resuelve.

**Acción:** paginación o carga incremental, virtualización donde el volumen lo justifique y expansión bajo demanda. Mantener navegación por teclado, arrastre y subtareas.

**Aceptación:** ensayo con 1.000 tareas por proyecto y tablero grande; medir interacción y frames, sin perder foco, selección ni posición al guardar.

### A15 · P2 · Bootstrap con barreras de accesibilidad y dependencia externa innecesaria

**Comprobado.** `client/index.html:2` declara `lang="en"` aunque la interfaz es española; el viewport limita `maximum-scale=1`. El script del banner de Replit queda también en el HTML de producción y no tiene `async`/`defer`. Puede agregar espera de parsing por un tercero; el impacto real requiere medir red.

**Acción:** idioma correcto, permitir zoom, excluir el banner del build de producción y evaluar fuentes alojadas localmente. Luego recorrer móvil, teclado y lector de pantalla.

**Aceptación:** zoom disponible, pronunciación correcta de la interfaz y ausencia del banner en producción; formularios/dialogs utilizables a 200% de zoom. No se emite una certificación de accesibilidad con esta revisión estática.

### A16 · P1 · Falta evidencia operativa y de navegador para aprobar escala

**Comprobado.** `.github/workflows/ci.yml` corre pruebas, TypeScript y build. No hay etapa de carga, navegador, accesibilidad ni presupuesto del bundle. Parte de las pruebas de interfaz verifica texto del código (`tests/ui-ux-system.test.ts`), por lo que no demuestra que un recorrido funcione en el navegador. Hay 77 pruebas omitidas en esta ejecución; ese resultado no valida sus escenarios. `/api/health` devuelve estado fijo y metadatos, sin verificar readiness de dependencias. No se encontró instrumentación general de Core Web Vitals, trazas o distribución de latencias; sí hay medición puntual `Server-Timing` para alertas de proyectos.

**Acción:** métricas de frontend/API/SQL, errores por ruta y perfil, readiness separado de liveness, smoke de navegador por rol y carga aislada con datos representativos. El chat también requiere ensayo de dos réplicas: `server/chat.ts:33,321` distribuye por conexiones en memoria del proceso, sin bus compartido. No tiene heartbeat/backpressure explícitos en ese recorrido.

**Aceptación:** observar dónde se consume el tiempo; detectar error aunque la UI no se caiga; mensajes entre usuarios conectados a distintas réplicas; reporte de carga reproducible con límites y recursos declarados.

### A17 · P2 · Política de estáticos y compresión pendiente de validar

**Comprobado en aplicación.** `server/vite.ts:78` sirve estáticos con configuración predeterminada, sin caché prolongada explícita para assets con hash. No se encontró middleware HTTP de compresión. **No se comprobó** si el proxy/CDN ya implementa ambas cosas.

**Acción:** verificar headers efectivos; habilitar gzip/Brotli en la capa adecuada, caché larga e immutable sólo para assets versionados, revalidación del HTML y estrategia que mantenga disponibles chunks de sesiones anteriores durante un despliegue. Nunca aplicar caché pública indiscriminada a APIs privadas.

**Aceptación:** headers comprobados desde el entorno desplegado, segunda navegación con caché útil y pestaña abierta que sobrevive a un nuevo deploy. [Express recomienda compresión y, para tráfico alto, implementarla en el proxy](https://expressjs.com/en/advanced/best-practice-performance/).

## Orden de ejecución recomendado

| Etapa | Trabajo | Resultado para darla por cerrada |
| --- | --- | --- |
| 1 · Acceso y confianza | A01; corregir endpoint personal y estados de error de A02 | Sin exposición BI; tareas visibles para cada rol y fallos explícitos |
| 2 · Línea de base observable | A16: métricas, fixtures, smoke por perfil y presupuesto de bundle | Tiempos comparables y fallos localizables |
| 3 · Menos trabajo por interacción | A03–A07, A11–A14 | Paginación, consultas por lotes, SQL acotado y menor descarga inicial |
| 4 · Preparar réplicas | A08–A10; distribución de chat de A16 | Jobs coordinados, archivos compartidos y presupuesto DB |
| 5 · Validación y experiencia | A15, A17; carga, concurrencia y QA visual | Evidencia de capacidad, accesibilidad básica y despliegue estable |

No hace falta reescribir toda la app ni introducir microservicios para comenzar. Las primeras mejoras pueden mantenerse en React, Express y PostgreSQL. Incorporar una cola, almacenamiento de objetos o un bus de eventos debe responder a las necesidades de jobs, archivos y chat identificadas, con operación y observabilidad previstas.

## Metas de aceptación propuestas

Son metas a acordar y medir, no resultados obtenidos en esta auditoría.

| Dimensión | Meta inicial |
| --- | --- |
| Carga perceptible | LCP ≤ 2,5 s en p75, por móvil/escritorio y ruta |
| Respuesta a interacción | INP ≤ 200 ms en p75 |
| Estabilidad visual | CLS ≤ 0,1 en p75 |
| API de lectura habitual | p95 ≤ 400 ms, excluyendo procesamiento externo y descargas |
| Guardado habitual | p95 ≤ 700 ms y confirmación visible; operaciones largas con progreso |
| Navegación con datos en caché | Contenido útil ≤ 1 s en p95 en el entorno/dispositivo definidos |
| Carga objetivo | Menos de 0,5% de errores inesperados y sin crecimiento sostenido de colas |
| Búsqueda y listas | Trabajo acotado por página; consultas no proporcionales a cada fila |
| Memoria | Estable tras calentamiento y dentro del presupuesto del contenedor, sin OOM |
| Acceso y concurrencia | Sin datos de otro perfil, pérdida silenciosa ni doble efecto financiero |

Los tres umbrales de Core Web Vitals y su evaluación en p75 siguen los criterios de [web.dev](https://web.dev/articles/defining-core-web-vitals-thresholds). Los objetivos de API, errores y navegación son propuestas específicas de este plan.

## Plan de prueba para “muchas personas”

Hay que diferenciar usuarios registrados, sesiones conectadas y usuarios realizando acciones simultáneas. No se puede convertir un número en otro sin un modelo de uso.

1. Preparar staging aislado con PostgreSQL y almacenamiento propios, datos sintéticos y las mismas clases de recursos que producción. Desactivar correos, cobros e integraciones externas reales. Ejecutar migraciones bajo un único dueño.
2. Crear al menos dos volúmenes: referencia y 10 veces la historia prevista. Incluir proyectos con 1.000 tareas, colaboraciones/subtareas, oportunidades con muchas actividades, meses financieros y archivos grandes. Registrar cardinalidades y tamaños reales.
3. Probar primero 1 usuario para establecer costos por recorrido; luego 10, 50 y 200 usuarios virtuales activos. Evaluar 500/1.000 sólo si las etapas previas cumplen metas y existe capacidad del entorno. Son escalones de ensayo, no una promesa de soporte.
4. Como hipótesis inicial, mezclar 40% lectura/edición de tareas, 20% proyectos, 15% CRM, 10% cotizaciones, 10% finanzas y 5% acciones de chat/notificaciones. Incluir pausas humanas y registrar por separado conexiones WebSocket y ritmo de mensajes; ajustar la mezcla con telemetría real.
5. En cada escalón: calentamiento, al menos 15 minutos estables y medición por endpoint/rol, sin ocultar las rutas lentas en un promedio global. Ejecutar después un ensayo prolongado de 60 minutos, picos y reconexiones escalonadas. Detener ante errores persistentes, riesgo de integridad o saturación.
6. Medir p50/p95/p99, errores, bytes, CPU/RSS, retraso del event loop, espera del pool, consultas lentas, locks, filas leídas y colas de trabajos. Separar caché fría/caliente y tráfico web con/sin jobs.
7. Verificar dos usuarios editando la misma tarea, reordenando, registrando horas y cerrando períodos. Definir por acción si se rechaza la versión obsoleta, se fusiona o se acepta el último cambio; informar conflictos y evitar doble registro.
8. Probar dos réplicas, reinicio y despliegue con sesiones abiertas. Subir en A/descargar desde B, chat entre A/B y recuperación de jobs interrumpidos.
9. Completar QA visual autenticado en 360/390 px y escritorio, teclado, zoom 200%, conexión lenta, errores y reintento. Medir éxito y tiempo para crear tarea, cargar horas, encontrar proyecto, preparar cotización y revisar factura.

La capacidad aprobada será el mayor escalón que cumpla objetivos con margen y datos representativos, detallando hardware, topología, historia y mezcla de uso. Si no se alcanza un escalón, corregir el cuello de botella medido antes de aumentar recursos o repetir la prueba.

## Bases existentes que conviene conservar

- Carga diferida de muchas rutas, `Suspense` y recuperación de chunks después de un deploy.
- React Query con caché global y refetch controlado.
- Calendario de equipo con ventana de fechas, estados de error y límite visual por día.
- Respuesta plana de tareas de proyecto y eliminación de procedencia bruta en ese listado.
- Notificaciones paginadas por cursor y worker de correo con reclamo SQL de trabajos.
- Carga financiera paginada, restricciones de archivos y almacenamiento privado separado.
- Uso de transacciones/bloqueos en varias operaciones sensibles y pruebas de lógica financiera.
- CI con pruebas, TypeScript y build reproducible.

Estas bases permiten mejorar por etapas. La decisión de ampliar usuarios debe apoyarse en el cierre de los riesgos prioritarios y en el ensayo medido, no sólo en que el build y los tests actuales pasen.

## Implementación realizada

| Hallazgo | Cambios aplicados |
| --- | --- |
| A01 | BI exige sesión financiera o `BI_ACCESS_TOKEN`; rechazo antes de consultar vistas y respuestas privadas sin caché. |
| A02 | Inicio usa tareas personales; estados de error y reintento en inicio, tareas, CRM, finanzas y cotizaciones. |
| A03 | Páginas por cursor en tareas/cotizaciones/CRM, categorías y contadores de tareas en SQL, listas personales y delegadas paginadas, selector de cotizaciones con búsqueda, bandeja financiera paginada y búsqueda en servidor. Los totales de cartera se calculan sobre toda la cartera. |
| A04 | Proyección de horas consulta sólo IDs incluidos en la respuesta y sus descendientes; comentarios no cargan historial. Autenticación reutilizada dentro de cada petición. |
| A05 | CRM filtra en SQL y carga contactos, última actividad y pendientes por lotes: cuatro consultas de datos por página con resultados, además de autenticación/sesión. Búsqueda con debounce y cancelación. |
| A06 | Portfolio carga clientes y aliases por lotes, deja de escribir aliases al navegar y reutiliza la base agregada durante 10 segundos, con invalidación en escrituras. |
| A07 | Dashboard preagrega cada ledger y calcula acumulados con ventanas SQL; caché de cómputo compartida entre filtros y peticiones simultáneas. Prueba contra la consulta anterior. |
| A08 | Exclusión entre procesos con advisory locks; workers de extracción con reclamo SQL y recuperación de ejecución interrumpida; entrada `server/worker.ts`; migraciones bajo lock, modo de release y fallo explícito si falta una requerida. |
| A09 | Subidas financieras a disco temporal con limpieza y límite agregado de 40 MiB; extracción en cola y progreso; adaptador S3 privado y copias compartidas de uploads, con lectura de claves históricas y script de migración. |
| A10 | Pool configurable, timeouts, readiness con consulta DB, drenado HTTP/WebSocket y cierre de jobs/conexiones. Migración de índices concurrentes y búsqueda con trigramas. |
| A11 | Finanzas e Inicio diferidos; detalle del calendario bajo demanda. JS inicial reducido de 58 a 20 archivos estáticos. |
| A12 | Caché de cotizaciones conservada, invalidación de Review acotada a su dominio, señales de cancelación y avisos de cambios entre servidores. Refrescos del navegador agrupados por recurso. |
| A13 | Búsqueda global en servidor: mínimo dos caracteres, diez resultados por categoría autorizada y sin descargar las colecciones completas. |
| A14 | Render inicial acotado a 80 filas por sección y 60 tarjetas por columna, con botones para cargar más; se conserva el conjunto de IDs para reordenar. |
| A15 | HTML en español, zoom permitido, banner eliminado e Inter servido localmente con licencia OFL. |
| A16 | Histogramas HTTP y Web Vitals, métricas de memoria/event loop/pool protegidas por Admin, pruebas SQL/archivos/locks, nueve recorridos de navegador, presupuesto JS en CI y herramienta de carga. Chat entre réplicas con notificaciones PostgreSQL, heartbeat y control de clientes lentos. |
| A17 | Gzip HTTP, assets versionados con caché immutable y HTML revalidable; archivo compartido opcional de chunks para pestañas abiertas durante despliegues. |

Las APIs anteriores mantienen su respuesta sin paginación cuando una integración no envía `limit`; los recorridos de listado migrados usan la nueva paginación. Los calendarios personales consultan la ventana visible y el tablero de proyecto conserva el árbol completo para mantener sus operaciones de jerarquía y arrastre. No se truncaron resultados silenciosamente. Una integración externa que siga pidiendo toda la historia debe migrarse al contrato paginado antes de usarla con volúmenes grandes.

### Validación de la implementación

- TypeScript y build de producción correctos; bundle web y worker generados.
- 1.095 pruebas aprobadas y 11 omitidas, usando PostgreSQL local para las integraciones disponibles. Las omitidas no se consideran verificadas.
- Nueve pruebas de navegador: miembro sin Operaciones, privacidad de horas, páginas sin duplicados, permisos BI/Admin, búsqueda CRM, cola financiera, error móvil, totales globales, archivo privado, chat entre servidores y tareas delegadas.
- Consulta financiera nueva equivalente a la anterior con acumulados, historia de provisiones sin otros movimientos, cierre, transferencias internas, anulaciones y prioridad de FX.
- Cola probada ante rechazo concurrente y lease abandonado; subidas probadas por HTTP, sin buffers de lote en RAM y con rechazo de lotes mayores a 40 MiB.
- Adaptador S3 probado contra un servidor HTTP de ensayo del protocolo de objetos. Falta el ensayo con el proveedor real elegido.
- Migraciones de arranque ejecutadas sin errores sobre una base local de ensayo. Índices aplicados a la base de navegador con creación concurrente.
- Build de producción levantado localmente: `/api/ready` 200, HTML `no-cache`, JS con gzip e immutable por un año, chunk de una versión anterior servido desde el archivo compartido, sin fuentes ni banner externos.
- JS inicial: **1.310.401 → 720.126 bytes**, gzip estimado **386.937 → 223.517 bytes**, aproximadamente **42% menos JS comprimido**. Esto no significa que todas las interacciones sean 42% más rápidas; fuentes, datos y dispositivo también influyen.

El ensayo del build de producción local ejecutó **1.389 lecturas, 20 lectores simultáneos simulados sobre dos cuentas y 30 segundos**, con **cero errores**. El p95 medido fue 219 ms en dashboard, 241 ms en CRM, 250 ms en búsqueda, 320 ms en tareas de proyecto, 520 ms en notificaciones, 646 ms en cotizaciones y 755 ms en tareas personales. **No pasó la meta de p95 ≤ 400 ms en todas las rutas.** El host compartido tenía una carga media de 33 sobre 10 CPU lógicas al inspeccionarlo; eso impide aislar el límite de la aplicación con este ensayo. No se detuvieron procesos ajenos. Repetir en staging dedicado y revisar latencias SQL, espera de pool y CPU antes de aumentar usuarios o recursos. Los datos financieros de este fixture son mínimos; no representa la historia de producción ni escrituras concurrentes.

La evidencia local queda en `.context/audit-performance/`, incluidos `implementation-tests.log`, `e2e.log`, `bundle-after.json`, `static-headers.json` y los screenshots de Inicio y error móvil. El ensayo de carga se registra por separado en `load-after.json`; sus límites y resultados no constituyen una certificación de producción.

### Activación en el despliegue

Las opciones mantienen compatibilidad con una instancia existente. Para separar web y procesos automáticos y ampliar réplicas, aplicar el siguiente orden con un único responsable del release:

1. Ejecutar CI y construir la versión. Correr `MIGRATE_ONLY=true NODE_ENV=production node dist/index.js` en el paso de release con la base correcta. Ante una migración fallida se detiene el arranque; `ALLOW_PARTIAL_MIGRATIONS=true` es sólo una salida explícita para una recuperación supervisada, no la configuración recomendada.
2. Ejecutar `NODE_ENV=production npm run db:performance-indexes` fuera de una transacción. El dueño de la base debe permitir `pg_trgm`. Los índices usan `CONCURRENTLY`, pero igualmente deben observarse consumo de recursos y duración durante el release.
3. En réplicas web configurar `RUN_STARTUP_MIGRATIONS=false` y `RUN_BACKGROUND_JOBS=false`; iniciar con `npm start`. El proceso de release pasa a ser el dueño de migraciones.
4. Iniciar el worker con `npm run start:worker`, con las mismas credenciales de DB y almacenamiento. Las banderas existentes `DISABLE_AUTO_SYNC` y `DISABLE_TEAM_PAYROLL` siguen vigentes. El worker no escucha HTTP; supervisar el proceso y sus logs. PostgreSQL coordina jobs y entregas entre procesos.
5. Calcular el presupuesto de conexiones considerando `DB_POOL_MAX` por proceso, hasta tres conexiones adicionales de locks y una de eventos, más reserva para release y administración. Configurar según la capacidad real; no incrementar el pool sin medir. Timeouts: `DB_CONNECTION_TIMEOUT_MS`, `DB_STATEMENT_TIMEOUT_MS` y `DB_QUERY_TIMEOUT_MS`.
6. Configurar almacenamiento en todas las réplicas y workers: `S3_BUCKET`, `S3_REGION`, credenciales estándar AWS; para un proveedor compatible, `S3_ENDPOINT` y, si hace falta, `S3_FORCE_PATH_STYLE=true`. El bucket debe ser privado. Activarlo sólo después de que todas las réplicas ejecuten el adaptador nuevo.
7. Para archivos previos, montar el disco existente y revisar `npm run storage:migrate`; copiar con `npm run storage:migrate -- --apply`. Es una copia, no elimina el origen. La lectura de claves históricas busca en el objeto compartido si no existe el archivo local. Verificar upload en una réplica y lectura desde otra con los permisos correspondientes antes de retirar el disco anterior.
8. Si se usa disco compartido para conservar chunks, definir `STATIC_ASSET_ARCHIVE_DIR` en un directorio persistente separado del build. Cada arranque incorpora los assets completos mediante publicación atómica y conserva los anteriores. Definir retención según la duración admitida de sesiones; no borrar archivos de sesiones activas. Si el CDN ya conserva versiones, aplicar allí la política equivalente.
9. Configurar la identidad de BI con `BI_ACCESS_TOKEN` (o el `BI_API_TOKEN` existente) en el gestor de secretos y actualizar el conector para enviar `Authorization: Bearer …`, o utilizar una sesión con permiso financiero. Nunca enviar el token en una URL.
10. Configurar readiness con `/api/ready`; `/api/health` sigue siendo liveness y metadatos. Consultar `/api/admin/performance` con un administrador; las métricas son por proceso y deben exportarse a la observabilidad del hosting para conservar series y agregar réplicas.

Las claves privadas no forman parte del repositorio. `.gitignore` excluye los directorios de archivos operativos. Un rollback debe contemplar los documentos con clave `s3:` y las extracciones encoladas: conservar el adaptador/worker compatible o completar una migración inversa y drenar la cola antes de volver a una versión anterior.

### Repetir las verificaciones

```sh
npm ci
npm test
npm run check
npm run build
npm run check:bundle
```

Para navegador, crear una base **local dedicada cuyo nombre empiece por `mind_e2e`**, definir `DATABASE_URL` al preparar schema y fixtures, y ejecutar `npx drizzle-kit push --force` y `npx tsx scripts/seed-performance-e2e.ts`. Luego definir `E2E_DATABASE_URL`, instalar Chromium con `npx playwright install chromium` y ejecutar `npm run test:e2e`. La configuración levanta una web y una segunda API aislada; CI ya incluye estos pasos. Los datos y las credenciales del fixture sólo sirven en ese entorno de ensayo.

Para carga local, usar el mismo fixture con `PERFORMANCE_BASE_URL`, `PERFORMANCE_CONCURRENCY`, `PERFORMANCE_SECONDS` y `PERFORMANCE_REPORT`, y ejecutar `npm run test:load`. El script sólo acepta destinos locales y distribuye lectores sobre dos cuentas de prueba. Para evaluar usuarios reales, escrituras financieras o historia 10 veces mayor, usar staging con el modelo de carga descrito en esta auditoría.


### Validación adicional del release — 2026-11-03

- Checkout limpio en GitHub Actions: 1.111 tests aprobados, 11 omitidos; tipos, build, presupuesto de JavaScript y nueve recorridos Playwright aprobados.
- Staging aislado en Railway, PostgreSQL 18 y build de producción, sin credenciales de correo ni integraciones reales: ocho recorridos adicionales por HTTPS aprobados.
- Carga dentro de staging: 100 lectores simulados sobre dos cuentas sintéticas, 60 segundos, 16.019 lecturas, cero errores y p95 máximo de 64,26 ms. Son tiempos internos sin la latencia de Internet y un fixture pequeño; no certifican la capacidad con toda la historia financiera ni escrituras concurrentes.
- Respaldo PostgreSQL 18 de producción restaurado en una base aislada; migraciones e índices aplicados correctamente sobre esa copia. Copia de archivos al bucket privado verificada con SHA-256, conservando los originales. El acceso anónimo al bucket devuelve 403.
- Publicación 1.14.23: `.dockerignore` evita incluir los 1,6 GB de adjuntos históricos en las imágenes, y CI hace checkout parcial sin ese archivo. La versión previa de staging ya se construyó sin esa carpeta mediante `.railwayignore`; el build y las pruebas de CI vuelven a verificar esa exclusión.
