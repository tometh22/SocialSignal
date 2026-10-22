# Mind para dots y otros clientes MCP

El conector expone `https://mind.epical.digital/mcp` mediante MCP Streamable HTTP
sin sesiones de transporte. Está deshabilitado hasta configurar las variables
de entorno. Implementarlo en el repositorio no lo habilita en producción ni lo
instala automáticamente en ChatGPT.

## Qué puede consultar

| Herramienta | Resultado |
| --- | --- |
| `list_mind_resources` | Catálogo de todos los módulos de negocio autorizados; campos, tipos, claves y relaciones de cada recurso. |
| `query_mind` | Registros con filtros AND, búsqueda literal, selección de campos, orden y paginación. |
| `aggregate_mind` | Conteos, sumas, promedios, mínimos y máximos sobre el conjunto completo autorizado, con agrupación y separación de monedas. |
| `read_mind_field` | Lectura por fragmentos de contenido largo o JSON: propuestas, alcance, notas y snapshots. |
| `list_status_rooms` | Salas activas del usuario, buscables por nombre, descripción o nombre de participante. Incluye participantes y enlace a Mind. |
| `get_status` | Proyectos y temas adicionales visibles: semáforos, riesgos, acciones, responsables, hitos, fechas y decisiones pendientes. |
| `get_status_activity` | Notas, actualizaciones y cambios de campos de ambos tipos de tema, con autor y fecha. |

Todas son de lectura. No crean ni modifican datos, no marcan elementos como
leídos y no llaman a un proveedor de IA: el dot interpreta los datos devueltos.
No requieren `OPENAI_API_KEY` ni `ANTHROPIC_API_KEY`.

Las respuestas contienen `retrievedAt` y la URL de Mind (o de la sala para Status). `updated_at`
indica cuándo se actualizó cada tema; consultar el conector no actualiza ese dato.
Las páginas tienen hasta 50 elementos, por defecto 25. Hay que continuar con
`nextOffset` hasta que sea `null` antes de presentar un resumen completo o un total.
La paginación usa offset; los cambios concurrentes pueden alterar páginas durante
una consulta larga. El historial usa `since` inclusivo y `until` exclusivo en ISO
8601 con zona horaria; por defecto cubre los últimos siete días, no la semana
calendario. Para una semana argentina, enviar límites con `-03:00`.

El catálogo incluye 157 recursos: cotizaciones, grupos, variantes, equipos,
revisiones, negociaciones, propuestas y recetas; CRM y clientes; proyectos,
entregables y calidad; tareas y horas; personal, capacidad, ausencias y cierres;
facturación, cobranzas, pagos, caja, costos, ingresos y fuentes analíticas;
objetivos, Status, propuestas de sala, conversaciones de Mind y datos personales.
`get_status_activity` sigue ofreciendo el historial resumido; el catálogo permite
consultar los demás datos. No busca conversaciones fuera de Mind.

Cada tabla de `shared/schema.ts` está clasificada explícitamente. Las proyecciones
de `server/mcp/catalog.ts` son una lista permitida: agregar columnas al esquema no
las publica automáticamente. No se exponen credenciales OAuth, recuperación de
contraseñas, suscripciones push ni `system_config` (puede contener secretos).
Las contraseñas, hashes de acceso y claves de almacenamiento quedan excluidas;
los secretos dentro de objetos JSON se eliminan también. Los adjuntos se ofrecen
como metadatos/enlaces existentes, no como descarga o extracción del contenido
binario. No se añade acceso al filesystem del servidor.

## Cómo explorar cotizaciones

1. `list_mind_resources({"query":"cotizaciones"})` descubre los recursos disponibles.
2. `list_mind_resources({"resource":"quotations"})` muestra campos y relaciones.
3. `query_mind({"resource":"quotations","search":"cliente o proyecto"})`
   busca registros. Para buscar por cliente, consultar primero `clients` y filtrar
   `quotations.client_id` por el ID devuelto.
4. Consultar `quotation_team_members`, `quotation_variants`, `quotation_revisions`,
   `negotiation_history` y `proposal_documents` filtrando `quotation_id`.
   `people_directory` y `user_directory` resuelven nombres sin exponer salarios ni credenciales.
5. Para totales, usar `aggregate_mind` con filtros explícitos de estado, fechas y
   `archived_at`. Agrupa monedas automáticamente cuando calcula métricas numéricas.
   No sumar versiones ni variantes alternativas como si fueran ventas.

Los recursos exponen datos persistidos, incluidos históricos/archivados cuando
existen; los permisos de salas y tareas siguen filtrándolos. No reproducen cada
fórmula de los dashboards. Las fuentes analíticas se identifican por separado:
no sumar un consolidado con sus filas originales ni presentar un importe cotizado
como ingreso reconocido. Los datos pueden cambiar entre páginas. Cada consulta
se ejecuta en una transacción PostgreSQL de solo lectura, con timeout de 5 segundos.
Los resultados largos señalan `truncated`; `read_mind_field` permite recuperar el
campo completo después de aplicar redacción de secretos.

## Configuración del servidor

1. Desplegar el cambio con sus dependencias y la migración
   `0086_mcp_oauth.sql`. El arranque también aplica la misma migración de forma
   idempotente, según la convención del repositorio. Verificar el mensaje
   `Migration OK: 0086 MCP OAuth grants`.
2. Configurar estas variables en el servicio de Mind:

   ```dotenv
   MIND_MCP_PUBLIC_URL=https://mind.epical.digital
   MIND_MCP_CLIENT_ID=mind-status-chatgpt
   MIND_MCP_CLIENT_SECRET=<secreto aleatorio de al menos 32 caracteres>
   MIND_MCP_REDIRECT_URIS=https://chatgpt.com/connector_platform_oauth_redirect
   ```

   `MIND_MCP_PUBLIC_URL` es el origen, sin `/mcp`. Debe ser el mismo dominio en el
   que se inicia sesión en Mind. No se deriva de encabezados Host o Forwarded.
   `MIND_MCP_REDIRECT_URIS` admite varias URLs separadas por comas, sin comodines.
   El conector anuncia identificación de emisor RFC 9207 y devuelve `iss` en
   respuestas de autorización exitosas y fallidas; esto habilita el callback
   estable de ChatGPT indicado arriba. Si una conexión existente muestra otro
   callback, agregar esa URL exacta. Guardar el secreto en el administrador de secretos del
   despliegue y en la configuración OAuth del cliente; no en git ni en el chat.
   El sitio debe tener su `SESSION_SECRET` persistente habitual.
3. Reiniciar el servicio. La configuración incompleta o inválida se rechaza.
   Sin `MIND_MCP_PUBLIC_URL`, `/mcp` responde 503 y el resto de Mind sigue igual.
4. Comprobar discovery sin credenciales:

   ```sh
   curl --fail https://mind.epical.digital/.well-known/oauth-protected-resource/mcp
   curl --fail https://mind.epical.digital/.well-known/oauth-authorization-server
   ```

   Un POST a `/mcp` sin Bearer debe devolver 401 con `WWW-Authenticate` y
   `resource_metadata`. GET/DELETE devuelven 405: no hay stream persistente ni
   sesiones MCP que eliminar. Evitar registrar cuerpos o credenciales OAuth en el
   proxy externo; los logs del conector no incluyen tokens ni contenido de salas.

## Conectar ChatGPT y el dot

1. En ChatGPT, abrir Plugins → agregar → **Add custom MCP server**.
2. Usar nombre **Mind** (el nombre anterior **Mind Status** también sirve), URL `https://mind.epical.digital/mcp` y OAuth.
3. Configurar el Client ID y Client Secret anteriores. El servidor admite un
   cliente registrado estáticamente y `client_secret_post`; no publica registro
   dinámico ni CIMD. Si la interfaz muestra el callback después de crear la
   conexión, copiarlo a `MIND_MCP_REDIRECT_URIS`, reiniciar y reconectar.
4. Solicitar `mind:read offline_access`. Si se ofrecen campos manuales, los
   endpoints son `/authorize`, `/token` y `/revoke` en el origen de Mind; discovery
   los anuncia. Sin `offline_access`, el acceso vence en una hora y requiere
   reconexión.
5. Iniciar sesión en Mind y pulsar **Autorizar lectura**. Las credenciales de Mind
   se ingresan en Mind, no en la conversación. El consentimiento describe el acceso
   a todos los módulos autorizados, incluida información comercial y financiera.
6. Instalar/habilitar el plugin para la cuenta que usa el dot. El acceso también
   depende de los permisos del workspace y del entorno del dot.

Pedido sugerido:

> Usá Mind para analizar las cotizaciones de este mes: importes por cliente y
> moneda, estado, margen y equipo. Compará las versiones cuando haya cambios y
> explicá qué filtros y fuentes usaste.

> Usá Mind Status para buscar mi sala con Vick. Resumí el estado actual, los
> riesgos, las decisiones pendientes y qué cambió en los últimos siete días.
> Incluí proyectos y temas adicionales, revisá todas las páginas y citá la sala.
> Si hay más de una sala posible, preguntame cuál.

Referencias oficiales:
[conectar un MCP propio](https://developers.openai.com/api/docs/guides/custom-mcp-server),
[OAuth para plugins](https://developers.openai.com/plugins/build/auth),
[apps de los dots](https://learn.chatgpt.com/docs/dots/computers-and-apps).

## Permisos y revocación

- `mind:read` exige cuenta interna activa y permisos de módulo. `status:read`
  conserva exclusivamente el acceso anterior a Status. Los tokens antiguos NO
  adquieren acceso a los demás módulos, tampoco al renovarse: actualizar las
  herramientas del plugin y **reconectar solicitando `mind:read offline_access`**.
  La URL, Client ID y Client Secret no cambian. Si el cliente conserva scopes
  antiguos, editar su configuración o recrear la conexión OAuth con el nuevo alcance.
- Cotizaciones exige `quotations`, CRM exige `crm`, finanzas operativas exige
  `finance`, resumen analítico `finance` o `dashboard`, personal/costos/cierres
  exige `operations`, y administración exige rol admin o `isAdmin`.
  Los módulos de proyectos/tareas siguen sus permisos y membresías; usuarios
  `task_manager` sin permisos financieros no pueden seleccionar, filtrar ni
  agregar costos. Las conversaciones exigen participación incluso para admins.
  Facturas personales y ausencias se limitan al titular salvo permiso de revisión.
- El conector exige membresía explícita de cada sala, incluso para administradores;
  no hereda el bypass de soporte de algunas rutas internas. Las salas archivadas y
  los temas ocultos quedan excluidos. El historial se filtra por sala y tema visible.
- Los access tokens vencen en una hora. Los refresh tokens rotan en cada uso y
  tienen un límite absoluto de 30 días desde la autorización. Los códigos OAuth
  duran cinco minutos y se consumen atómicamente una sola vez, con PKCE S256.
- Los tokens se guardan únicamente como hashes SHA-256 en PostgreSQL y están
  ligados al cliente, usuario, scopes y recurso `/mcp`. Un Bearer MCP no sirve
  como sesión para las APIs internas de escritura.
- Cada consulta revalida el token, el estado del usuario y la membresía. Quitar
  una membresía o permiso, desactivar al usuario o archivar una sala corta su acceso.
- En Mind: **Status → Agentes**, o `/mcp/connections`, para revocar una conexión.
  Esto invalida también su refresh token. El cliente puede usar `/revoke`.
- Cambiar el Client Secret requiere actualizarlo también en ChatGPT. Para retirar
  una conexión vigente, usar revocación; rotar el secreto del cliente no revoca
  automáticamente access tokens existentes.

## Verificación local y CI

```sh
npm ci
TEST_MCP_DATABASE_URL=postgres://usuario:clave@localhost:5432/mind_test npm test
npm run check
npm run build
```

Usar una base de pruebas. La integración crea un esquema único `mcp_test_*` y lo
elimina al terminar; no usa `DATABASE_URL`. Sin `TEST_MCP_DATABASE_URL`, las pruebas
que requieren PostgreSQL se omiten. CI levanta PostgreSQL 16 y las ejecuta.

Las pruebas recorren discovery, login/consentimiento, CSRF, callbacks, scopes,
PKCE, consumo concurrente de códigos, rotación, vencimiento, revocación,
aislamiento de salas y un cliente MCP real del SDK. Antes de dar por habilitada
la integración, completar además una conexión real desde ChatGPT contra el
despliegue y verificar lectura y revocación con una cuenta de prueba.
