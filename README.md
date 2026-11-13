# JV Urban Style

Sistema de reservas online para una barbería. Los clientes eligen uno o más servicios, ven los horarios libres de cada profesional y dejan el turno pedido sin escribir por WhatsApp. El dueño administra todo desde un panel en `/admin`: agenda del día, turnos fijos, señas, servicios, profesionales y horarios.

El frontend (React) y el backend (Express) están separados y se despliegan por separado. Los datos viven en Supabase (PostgreSQL), y el frontend nunca accede a la base de forma directa: todo pasa por la API.

## Qué hace

**Reserva de turnos.** El cliente arma la reserva en tres pasos: servicios, fecha y horario, y datos de contacto. Si elige varios servicios, la duración y el precio se suman, y solo se ofrecen profesionales que hacen todos los servicios elegidos. El turno queda pendiente de aceptación. Si el local exige seña, el cliente ve los datos de transferencia y un acceso directo a WhatsApp para mandar el comprobante. Si no la exige, el acceso directo sirve para avisar que reservó.

**Disponibilidad calculada en el servidor.** Para cada profesional, el backend arma los horarios del día a partir de:

- el horario semanal, o el horario especial de esa fecha si existe (feriados, vacaciones, días con horario reducido);
- los turnos ya tomados que no estén cancelados;
- los turnos fijos semanales (clientes que vienen siempre el mismo día y hora);
- los bloqueos puntuales de la tabla `time_off`.

Los horarios se generan cada `SLOT_INTERVAL_MINUTES`, o cada tanto como dure la reserva si es más larga, en la zona horaria del negocio. Los ocupados se devuelven igual, marcados con el motivo ("Reservado", "Pendiente de comprobante", etc.), para que el cliente vea la agenda real.

**Sin turnos duplicados.** La protección tiene dos capas. Al crear un turno, el backend recalcula la disponibilidad y rechaza el pedido si ese horario ya no está libre. Si dos pedidos llegan a la vez, la tabla `appointments` tiene una restricción de exclusión de PostgreSQL (`btree_gist`) que impide que dos turnos `pending` o `confirmed` del mismo profesional se superpongan.

**Señas y cancelación.** Desde el panel se define si se exige seña, qué porcentaje del total representa, con cuántos minutos de anticipación se puede cancelar online y los datos de transferencia. El endpoint de cancelación rechaza el pedido si ya pasó ese plazo.

**Panel de administración.** Protegido con un PIN (`ADMIN_PIN`). Permite:

- ver los turnos del día y las solicitudes futuras;
- aceptar o rechazar solicitudes, marcar la seña como recibida y registrar si el cliente vino o no;
- gestionar turnos fijos, servicios (precio y duración), profesionales, horario semanal y fechas especiales;
- administrar la galería de trabajos: subir fotos y videos, editar descripciones, reordenar, ocultar y eliminar.

Al aceptar, rechazar o confirmar la seña, el panel abre WhatsApp con un mensaje ya armado para el cliente.

Quitar un servicio o un profesional no lo borra: lo desactiva, para no romper el historial.

**Galería de trabajos.** La sección "Trabajos" muestra fotos y videos de clientes en un carrusel. Los archivos viven en un bucket público de Supabase Storage (`gallery`) y la tabla `gallery_items` guarda orden, descripción y visibilidad. Las subidas van directo del navegador a Storage con URLs firmadas que genera el backend, así los videos no pasan por el límite de tamaño de las funciones de Vercel. Antes de subir, el navegador achica las fotos a 1600 px en WebP y saca un fotograma de cada video como portada. Mientras la galería no esté configurada en Supabase, la web muestra las fotos y videos incluidos en `frontend/src/assets/gallery`.

**PWA y notificaciones.** La reserva y el panel se pueden instalar como apps separadas, cada una con su manifest. Desde el panel se pueden activar notificaciones push (Web Push con claves VAPID), que avisan en el dispositivo cada vez que entra un turno nuevo.

## Stack

| Parte | Tecnologías |
|---|---|
| Frontend | React 19, TypeScript, Vite, lucide-react |
| Backend | Node.js 20+, Express 4, TypeScript, Zod, Luxon, web-push, helmet |
| Base de datos | Supabase (PostgreSQL), cliente `@supabase/supabase-js` |
| Despliegue | Vercel (frontend y backend). También hay configuración para Render y Docker |

## Estructura

```txt
backend/
  app.js            entrypoint para Vercel (reexporta dist/app.js)
  src/
    app.ts          configuración de Express: helmet, CORS, rutas
    server.ts       arranque local / Render / Docker (app.listen)
    config/env.ts   lectura y validación de variables de entorno
    routes/         definición de endpoints y rate limits
    controllers/    validación de parámetros y respuesta HTTP
    services/       lógica: disponibilidad, reservas, admin, push
    middleware/     PIN de admin, rate limit, manejo de errores
    lib/            cliente de Supabase y datos de demo
frontend/
  index.html        entrada de la reserva
  admin.html        entrada del panel (PWA separada)
  public/           service worker, manifests e íconos
  src/
    pages/          BookingPage y AdminPage
    components/     selector de fecha y horario
    lib/api.ts      cliente de la API
supabase/
  schema.sql        esquema completo para una base nueva
  seed.sql          datos iniciales opcionales
  migrations/       cambios incrementales para bases existentes
  maintenance/      scripts manuales para limpiar turnos de prueba
docs/
  deployment.md
```

La lógica de negocio está en `backend/src/services`. Los controllers solo validan la entrada con Zod y delegan.

## Ejecutar en local

Requisitos: Node.js 20 o superior y npm. Supabase es opcional para una primera prueba (ver [modo demo](#modo-demo)).

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

La API queda en `http://localhost:4000`. Para verificar que responde: `GET /health` devuelve `{"ok":true}`.

En otra terminal:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

La reserva queda en `http://localhost:5173` y el panel en `http://localhost:5173/admin`.

### Modo demo

Si `SUPABASE_URL` o `SUPABASE_SERVICE_ROLE_KEY` no están definidas, el backend arranca en modo demo: usa servicios, profesionales y horarios de ejemplo guardados en memoria, y las reservas no se persisten. Si además no hay `ADMIN_PIN`, el panel acepta `1234`. Sirve para ver la app funcionando sin crear una base.

El `.env.example` trae `DEMO_MODE=false` con valores de ejemplo para Supabase. Para usar el modo demo, borrá esas tres líneas o poné `DEMO_MODE=true`.

### Scripts

| Carpeta | Script | Qué hace |
|---|---|---|
| `backend` | `npm run dev` | Servidor con recarga automática (`tsx watch`) |
| `backend` | `npm run build` | Compila TypeScript a `dist/` |
| `backend` | `npm start` | Ejecuta `dist/server.js` |
| `backend` | `npm run typecheck` | Chequeo de tipos sin compilar |
| `frontend` | `npm run dev` | Servidor de desarrollo de Vite |
| `frontend` | `npm run build` | Chequeo de tipos y build de producción en `dist/` |
| `frontend` | `npm run preview` | Sirve el build localmente |
| `frontend` | `npm run typecheck` | Chequeo de tipos |

## Variables de entorno

### Backend (`backend/.env`)

| Variable | Default | Descripción |
|---|---|---|
| `PORT` | `4000` | Puerto del servidor (no se usa en Vercel) |
| `NODE_ENV` | `development` | En `production` las respuestas de error no incluyen detalles internos |
| `CORS_ORIGIN` | `http://localhost:5173` | Orígenes permitidos, separados por coma. Tienen que coincidir exactamente con la URL del frontend |
| `SUPABASE_URL` | — | URL del proyecto de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | — | Service role key. Solo va en el backend |
| `DEMO_MODE` | automático | Si no se define, se activa cuando faltan las variables de Supabase |
| `ADMIN_PIN` | — | PIN del panel, mínimo 4 caracteres. Conviene que sea largo |
| `BUSINESS_TIMEZONE` | `America/Argentina/Buenos_Aires` | Zona horaria para calcular horarios |
| `SLOT_INTERVAL_MINUTES` | `15` | Separación mínima entre horarios ofrecidos |
| `WEB_PUSH_PUBLIC_KEY` | — | Clave pública VAPID (opcional) |
| `WEB_PUSH_PRIVATE_KEY` | — | Clave privada VAPID (opcional) |
| `WEB_PUSH_SUBJECT` | `mailto:admin@jvurbanstyle.local` | Contacto que se informa al servicio de push |

En producción conviene definir `DEMO_MODE=false` de forma explícita. Si las variables de Supabase faltan o están mal cargadas, el backend no falla: arranca en modo demo y sirve datos de ejemplo sin avisar.

### Frontend (`frontend/.env`)

| Variable | Descripción |
|---|---|
| `VITE_API_URL` | URL base del backend, sin `/` final. En local: `http://localhost:4000` |

Las variables `VITE_*` quedan dentro del bundle que descarga el navegador. Nunca pongas claves ahí.

## Base de datos

Para una base nueva:

1. Crear un proyecto en [Supabase](https://supabase.com).
2. En el SQL Editor, ejecutar `supabase/schema.sql`. Crea las tablas, la restricción anti-solapamiento, los índices y las políticas de RLS.
3. Opcional: ejecutar `supabase/seed.sql` para cargar servicios, profesionales y horarios de ejemplo.
4. Copiar la Project URL y la service role key en `backend/.env`.

`schema.sql` ya incluye todos los cambios. Las migraciones de `supabase/migrations/` son solo para bases creadas con versiones anteriores, y se ejecutan en orden por fecha.

Todas las tablas tienen RLS activado. El backend usa la service role, que no está sujeta a RLS, así que la base no necesita políticas para que la app funcione. Clientes, turnos, turnos fijos y suscripciones push no tienen ninguna política de lectura pública.

Los scripts de `supabase/maintenance/` borran turnos de prueba o el historial completo. No se ejecutan solos: hay que revisarlos y correrlos a mano.

## API

Todas las rutas, excepto `/health`, están bajo `/api`. Las de `/api/admin` requieren el header `x-admin-pin`.

### Públicas

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/health` | Estado del servidor |
| `GET` | `/api/services` | Servicios activos |
| `GET` | `/api/schedule` | Horario semanal, fechas especiales de los próximos 45 días y profesionales |
| `GET` | `/api/availability` | Horarios de un día. Parámetros: `date` (`YYYY-MM-DD`), `serviceIds` (ids separados por coma) o `serviceId`, y `staffId` opcional |
| `POST` | `/api/appointments` | Crea un turno |
| `POST` | `/api/appointments/:publicCode/cancel` | Cancela un turno con su código, si todavía está dentro del plazo |
| `GET` | `/api/gallery` | Fotos y videos visibles de la galería. `configured: false` si Supabase no tiene la galería |

El endpoint de cancelación existe en la API, pero el frontend todavía no tiene una pantalla que lo use.

Ejemplo de cuerpo para `POST /api/appointments`:

```json
{
  "serviceIds": ["<uuid del servicio>"],
  "staffId": "<uuid del profesional>",
  "startsAt": "2026-11-20T13:00:00.000Z",
  "client": {
    "firstName": "Juan",
    "lastName": "Pérez",
    "phone": "3511234567",
    "email": "",
    "notes": ""
  }
}
```

`startsAt` tiene que coincidir con un horario devuelto por `/api/availability`. Si el horario no existe o ya está ocupado, la API responde `409`.

### Administración

| Método | Ruta |
|---|---|
| `GET` | `/api/admin/summary?date=YYYY-MM-DD` |
| `PATCH` | `/api/admin/settings` |
| `POST` | `/api/admin/services` |
| `PATCH` / `DELETE` | `/api/admin/services/:id` |
| `POST` | `/api/admin/staff` |
| `PATCH` / `DELETE` | `/api/admin/staff/:id` |
| `PUT` | `/api/admin/business-hours` |
| `POST` | `/api/admin/special-hours` |
| `DELETE` | `/api/admin/special-hours/:id` |
| `POST` | `/api/admin/fixed-appointments` |
| `PATCH` / `DELETE` | `/api/admin/fixed-appointments/:id` |
| `PATCH` | `/api/admin/appointments/:id/status` |
| `PATCH` | `/api/admin/appointments/:id/deposit` |
| `GET` | `/api/admin/push-config` |
| `POST` | `/api/admin/push-subscriptions` |
| `POST` | `/api/admin/push-test` |
| `GET` | `/api/admin/gallery` |
| `POST` | `/api/admin/gallery/upload-url` |
| `POST` | `/api/admin/gallery` |
| `PUT` | `/api/admin/gallery/order` |
| `PATCH` / `DELETE` | `/api/admin/gallery/:id` |

`summary` devuelve en una sola respuesta todo lo que necesita el panel: configuración, servicios, profesionales, horarios, turnos fijos, turnos del día y solicitudes futuras.

### Límites

Los rate limits se aplican por IP y se guardan en memoria:

- `/api/availability`: 90 pedidos por minuto.
- `/api/appointments`: 30 pedidos cada 15 minutos.
- `/api/admin`: 120 pedidos cada 15 minutos. Además, después de 10 intentos con PIN incorrecto, la IP queda bloqueada 15 minutos.

Al guardarse en memoria, en un entorno serverless cada instancia lleva su propia cuenta.

## Notificaciones push

Son opcionales. Para activarlas:

1. Generar un par de claves VAPID desde `backend/`:

   ```bash
   npx web-push generate-vapid-keys
   ```

2. Cargar `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY` y `WEB_PUSH_SUBJECT` en el backend, y reiniciarlo.
3. Abrir `/admin` en el dispositivo que va a recibir los avisos (idealmente con el panel instalado como app) y activar las notificaciones desde el panel.

Las suscripciones se guardan en la tabla `push_subscriptions`. Si un dispositivo deja de ser válido, el backend lo elimina cuando falla el envío.

## Despliegue

Frontend y backend se despliegan como dos proyectos de Vercel conectados al mismo repositorio:

| Proyecto | Root directory | Notas |
|---|---|---|
| Frontend | `frontend` | Preset Vite. `vercel.json` define las rutas de `/admin` y los headers de seguridad (CSP incluida) |
| Backend | `backend` | Preset Express. Vercel compila con `npm run build` y sirve la app desde `backend/app.js`, que reexporta `dist/app.js` |

Variables de producción:

- **Backend:** las de la tabla de arriba, con `NODE_ENV=production`, `DEMO_MODE=false` y `CORS_ORIGIN` igual a la URL del frontend.
- **Frontend:** `VITE_API_URL` con la URL del backend. Como se lee en el build, cualquier cambio requiere un redeploy.

Si cambia la URL del backend, también hay que actualizar `connect-src` en la CSP de `frontend/vercel.json`. La CSP ya permite `https://*.supabase.co` para mostrar y subir los archivos de la galería.

El plan gratuito de Supabase pausa los proyectos después de 7 días sin actividad. Hay dos mecanismos para evitarlo:

- Un cron de Vercel, definido en `backend/vercel.json`, que llama a `/api/services` una vez por día.
- El workflow `.github/workflows/supabase-keepalive.yml`, que consulta el backend cada dos días y se mantiene activo aunque el repositorio pase semanas sin commits. La URL del backend está escrita en el workflow y hoy apunta a la instancia de Render.

### Render y Docker

El backend también puede correr como servicio Node en Render con `render.yaml` (`npm ci && npm run build`, `npm start`, health check en `/health`), o en contenedor con el `Dockerfile` de la raíz o el de `backend/`. En esos casos el punto de entrada es `server.ts` y el puerto lo define `PORT`.

Más detalles del despliegue paso a paso en [`docs/deployment.md`](docs/deployment.md).

## Licencia

[MIT](LICENSE)
