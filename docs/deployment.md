# Despliegue

Guía paso a paso para poner el sistema en producción. El esquema es: Supabase para la base, y dos proyectos de Vercel conectados al mismo repositorio (uno para el backend y otro para el frontend). Al final hay alternativas para correr el backend en Render o Docker.

Conviene seguir este orden: base, backend y frontend. El backend necesita la URL del frontend para CORS y el frontend necesita la URL del backend, así que en el paso 3 se vuelve a ajustar el backend.

## 1. Supabase

1. Crear un proyecto en Supabase.
2. En el SQL Editor, ejecutar `supabase/schema.sql`.
3. Opcional: ejecutar `supabase/seed.sql` para cargar servicios, profesionales y horarios de ejemplo.
4. En la configuración del proyecto, en la sección de API, copiar:
   - Project URL → `SUPABASE_URL`
   - service role key → `SUPABASE_SERVICE_ROLE_KEY`

La service role key ignora RLS y da acceso completo a la base. Va solo en las variables del backend: nunca en el frontend ni en una variable `VITE_*`.

### Bases existentes

Si la base se creó con una versión anterior del esquema, en lugar de `schema.sql` hay que ejecutar las migraciones de `supabase/migrations/` que falten, en orden por fecha (el nombre de cada archivo empieza con la fecha). Algunas también modifican datos, como los nombres de los profesionales, así que conviene leer cada una antes de ejecutarla.

## 2. Backend en Vercel

Crear un proyecto nuevo en Vercel importando el repositorio:

- **Root Directory:** `backend`
- **Framework Preset:** Express. Ya está fijado en `backend/vercel.json`, así que no depende de lo que se elija en el dashboard.

Vercel instala dependencias, corre `npm run build` (compila TypeScript a `dist/`) y sirve la app desde `backend/app.js`, que reexporta `dist/app.js`.

Variables de entorno (entorno *Production*):

```env
NODE_ENV=production
DEMO_MODE=false
ADMIN_PIN=un-pin-largo-y-privado
SUPABASE_URL=https://TU-PROYECTO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=TU_SERVICE_ROLE_KEY
CORS_ORIGIN=https://TU-FRONTEND.vercel.app
BUSINESS_TIMEZONE=America/Argentina/Buenos_Aires
SLOT_INTERVAL_MINUTES=15
```

Opcionales, para notificaciones push (ver el README):

```env
WEB_PUSH_PUBLIC_KEY=
WEB_PUSH_PRIVATE_KEY=
WEB_PUSH_SUBJECT=mailto:tu-email@ejemplo.com
```

Notas:

- `DEMO_MODE=false` tiene que estar explícito. Si faltan las variables de Supabase y no está definido, el backend arranca en modo demo y sirve datos de ejemplo sin avisar.
- `CORS_ORIGIN` acepta varias URLs separadas por coma y compara cada una de forma exacta (sin `/` final). No acepta comodines como `*`. Si todavía no tenés la URL del frontend, dejá cualquier valor y corregilo en el paso 3.
- Las variables se aplican en el próximo deploy. Después de cambiarlas, hay que hacer **Redeploy**.

Para verificar, abrir `https://TU-BACKEND.vercel.app/api/services`. Tiene que devolver los servicios cargados en Supabase. Si devuelve servicios de ejemplo ("Corte urbano", ids `1111…`), el backend está en modo demo y faltan variables.

## 3. Frontend en Vercel

Crear otro proyecto en Vercel con el mismo repositorio:

- **Root Directory:** `frontend`
- **Framework Preset:** Vite. `frontend/vercel.json` ya define build, rutas de `/admin` y headers.

Variable de entorno:

```env
VITE_API_URL=https://TU-BACKEND.vercel.app
```

`VITE_API_URL` se lee durante el build. Si cambia, hay que hacer redeploy del frontend.

Después:

1. Volver al proyecto del backend y poner en `CORS_ORIGIN` la URL definitiva del frontend. Hacer redeploy.
2. Revisar la CSP de `frontend/vercel.json`: la directiva `connect-src` tiene que incluir la URL del backend. Si no está, el navegador bloquea las llamadas a la API.

El panel de administración queda en `https://TU-FRONTEND.vercel.app/admin`.

## 4. Mantener activo Supabase

El plan gratuito de Supabase pausa el proyecto después de 7 días sin actividad. El repositorio ya incluye dos mecanismos que consultan la base de forma periódica:

- **Cron de Vercel** (`backend/vercel.json`): llama a `/api/services` todos los días a las 12:00 UTC. Se activa solo al desplegar el backend.
- **GitHub Actions** (`.github/workflows/supabase-keepalive.yml`): llama a `/api/services` cada dos días, usando la URL del backend escrita en el workflow. Hoy apunta al backend de Render; si Render se da de baja, hay que cambiarla por la de Vercel. El workflow se vuelve a habilitar solo, así que GitHub no lo desactiva aunque el repositorio pase 60 días sin commits.

Para probar el workflow a mano: pestaña *Actions → Supabase keep-alive → Run workflow*.

## Alternativa: backend en Render o Docker

`render.yaml` define el backend como servicio Node en Render (plan free):

- Root directory: `backend`
- Build: `npm ci && npm run build`
- Start: `npm start`
- Health check: `/health`

Las variables son las mismas del paso 2. En el plan gratuito de Render la instancia se duerme tras un rato sin tráfico, y el primer pedido puede tardar hasta un minuto.

Para Docker, el repositorio incluye un `Dockerfile` en la raíz (contexto: el repo completo) y otro en `backend/` (contexto: esa carpeta). Los dos compilan el backend y lo arrancan con `npm start` en el puerto 4000:

```bash
docker build -t jv-urban-style-api .
docker run -p 4000:4000 --env-file backend/.env jv-urban-style-api
```

Si el backend corre en otra URL, hay que actualizar `VITE_API_URL` en el frontend, la CSP en `frontend/vercel.json` y la URL del workflow de keep-alive.
