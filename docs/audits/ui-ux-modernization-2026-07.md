# Auditoría y modernización UI/UX — Mind

Fecha: 27 de julio de 2026

## Objetivo

Unificar la experiencia de Mind y elevarla a nivel producto: moderna, clara, confiable, responsive y consistente, sin alterar la lógica de negocio validada en Feedback Mind V2.

## Hallazgos principales

- Convivían radios, sombras, alturas, densidades y jerarquías de distintas etapas del producto.
- El shell oscuro era angosto y visualmente plano; la barra superior competía con el contenido.
- La barra superior mostraba tres alertas de proyecto hardcodeadas como si fueran datos reales.
- La búsqueda global no registraba el atajo anunciado `⌘K` desde el shell.
- Algunos controles dependían de `hover`, por lo que quedaban ocultos en dispositivos touch.
- Los diálogos no tenían límite seguro de alto para viewports pequeños.
- El login conservaba una estética genérica azul/violeta, desconectada de Mind, y un copyright fijo de 2025.
- Varias pantallas sumaban padding y headers duplicados dentro del shell.

## Implementación

### Sistema visual compartido

- Nueva base cromática neutral con acento Epical, superficies blancas, bordes suaves y profundidad controlada.
- Componentes base renovados: botones, cards, inputs, textareas, selects, tabs, badges, tablas y diálogos.
- Estados de foco visibles, targets táctiles, transiciones discretas y soporte `prefers-reduced-motion`.
- Inputs de 16 px en mobile para evitar zoom automático en iOS.
- Scrollbars discretas, selección de texto de marca y fondos de aplicación con textura mínima.
- Nuevas primitivas `BrandMark`, `PageHeading` y `SectionHeading`.

### Shell y navegación

- Sidebar de 264 px, colapsado de 72 px, mejor jerarquía, estados activos inequívocos y footer de identidad.
- Topbar clara y translúcida, breadcrumbs compactos, buscador visible en desktop y navegación mobile.
- Atajo global real `⌘K` / `Ctrl+K`.
- Alertas conectadas a `/api/crm/reminders/due`; se eliminaron las alertas ficticias.
- Menús y popovers con estados vacíos honestos y contención responsive.
- Pantallas secundarias cargadas de forma diferida por ruta, con skeleton estable durante la transición.

### Pantallas principales

- Inicio: hero operativo, acciones prioritarias, salud del portfolio, KPIs y accesos con jerarquía renovada.
- Tareas: resumen de foco, horas, proyectos y calendario; fechas accesibles en touch y controles con etiquetas.
- Proyectos: cabecera de portfolio, estado de salud, filtros flotantes estables, tablas y grupos de cliente.
- Cotizaciones: header consistente, KPIs, filtros, agrupación Cliente > Cotización y cards responsive.
- Login: identidad Mind/Epical, layout de producto, mejor contraste, formulario accesible y año dinámico.
- `PageLayout` y `PageHeader` actualizados para propagar el nuevo lenguaje a las pantallas que los reutilizan.

## Validación

- TypeScript: aprobado.
- `git diff --check`: aprobado.
- Build de producción: aprobado.
- Bundle principal: reducido de 2.567 kB a 677 kB minificado (aprox. 74% menos); las pantallas secundarias quedaron divididas en chunks por ruta.
- Suite automática: 97 tests aprobados, 11 omitidos por fixtures/entorno y 0 fallidos.
- Tests de regresión UI añadidos para:
  - impedir alertas demo hardcodeadas;
  - verificar datos reales de CRM;
  - asegurar el atajo de búsqueda;
  - preservar controles táctiles;
  - limitar diálogos al viewport;
  - respetar reducción de movimiento;
  - mantener brand y page heading compartidos.
  - conservar lazy loading y fallback accesible entre rutas.
- El smoke visual por navegador integrado quedó pendiente porque Conductor no expuso ninguna sesión de navegador en el workspace. No se sustituyó por un navegador externo para evitar una validación no equivalente.

## Revisión visual de regresiones

La captura de producción recibida el 27 de julio expuso problemas que la primera pasada no había detectado. Se hizo una segunda auditoría transversal del shell, overlays, encabezados y puntos de quiebre.

### Causas encontradas

- Una regla legacy `body.sidebar-dark .topbar` ganaba por especificidad y volvía oscura la topbar nueva, pero sus textos seguían usando colores para fondo claro.
- Clases como `text-white/58` y `text-white/28` no pertenecían a la escala configurada de Tailwind y no generaban CSS en producción.
- El resumen lateral de `PageHeading` aparecía desde `lg`, justo cuando el ancho útil se reduce por la sidebar, y competía con títulos y acciones.
- Los estados de las cotizaciones usaban posición absoluta en desktop y podían cubrir datos de la card cuando había varios badges.
- El mini header del detalle de proyecto era `fixed`, ocupaba todo el viewport y se superponía a sidebar y topbar.
- El backdrop del diálogo usaba otra opacidad no generada (`bg-slate-950/55`).
- La búsqueda global y los alert dialogs no estaban contenidos de forma segura en viewports bajos.

### Correcciones

- Se eliminó el tema global `sidebar-dark`; la superficie oscura quedó encapsulada en la sidebar.
- La navegación usa opacidades arbitrarias válidas. El contraste calculado del link inactivo es 9.05:1 y el de etiquetas secundarias es al menos 5.33:1 sobre `#0b0f17`.
- `PageHeading` ahora distribuye contenido con grid, pasa las acciones a una fila segura en anchos intermedios y muestra el aside solamente desde 1536 px.
- `SectionHeading` apila título y acción en mobile.
- La búsqueda completa aparece desde `xl`; antes de ese ancho se conserva el botón compacto.
- Badges de cotizaciones y estados permanecen en el flujo del documento.
- El mini header de proyecto es sticky dentro del scroll de contenido, sin invadir el shell.
- Diálogos, confirmaciones y búsqueda global respetan el alto dinámico del viewport, permiten scroll y usan overlays compilados.
- La búsqueda global cierra con `Escape` o click en el backdrop y bloquea el scroll de fondo.
- Tablas de proyectos tienen ancho mínimo y scroll horizontal explícito en vez de comprimir columnas.
- Los insights de portfolio no muestran un mensaje de “sin proyectos” cuando el KPI proviene de otra fuente con proyectos activos.

### Validación de la segunda pasada

- TypeScript: aprobado.
- Build de producción: aprobado.
- Suite completa: 97 aprobados, 11 omitidos y 0 fallidos.
- Regresiones UI dedicadas: 8 aprobadas.
- CSS compilado inspeccionado: presentes `text-white/[0.68]`, `text-white/[0.52]` y `bg-slate-950/[0.55]`; ausente `text-white/58`.
- El navegador integrado continuó sin sesiones disponibles (`[]`), por lo que esta segunda pasada se validó contra la captura, el CSS final compilado y pruebas automatizadas, no mediante clicks autenticados.

## Alcance

La modernización afecta transversalmente a toda la aplicación mediante el sistema de componentes compartidos. Las pantallas de mayor tráfico recibieron además una intervención específica. No se modificaron endpoints ni reglas de negocio.
