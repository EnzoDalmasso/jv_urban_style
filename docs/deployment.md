# Deployment

## 1. Supabase

1. Crear un nuevo proyecto en Supabase.
2. Abrir SQL Editor.
3. Ejecutar `supabase/schema.sql`.
4. Ejecutar `supabase/seed.sql` si queres datos iniciales.
5. Copiar estos valores del dashboard:
   - Project URL -> `SUPABASE_URL`
   - Service role key -> `SUPABASE_SERVICE_ROLE_KEY`

La service role key solo va en Render. Nunca debe ir en Vercel ni en el frontend.

## 2. Render

Usar el Blueprint del repo:

- Blueprint file: `render.yaml`
- Service: `jv-urban-style-api`
- Root directory: `backend`
- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Health check path: `/health`

Si por error creaste el servicio como Docker, tambien funciona: el repo incluye un
`Dockerfile` en la raiz y otro en `backend/`.

Variables en Render:

```env
NODE_ENV=production
DEMO_MODE=false
ADMIN_PIN=un-pin-privado
BUSINESS_TIMEZONE=America/Argentina/Buenos_Aires
SLOT_INTERVAL_MINUTES=15
CORS_ORIGIN=https://TU-FRONTEND.vercel.app
SUPABASE_URL=https://TU-PROYECTO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=TU_SERVICE_ROLE_KEY
```

Durante el primer deploy, si todavia no tenes la URL de Vercel, podes usar temporalmente:

```env
CORS_ORIGIN=*
```

Despues de desplegar Vercel, cambialo por la URL real del frontend.

## Actualizaciones de Supabase

Si la base ya existe, ejecutar tambien:

```txt
supabase/migrations/20260722_admin_panel.sql
```

Esto agrega:

- Configuración de seña y plazo mínimo de cancelación.
- Horarios especiales por fecha.
- Campos de seña en turnos.
- Soporte para historial diario por profesional.

## 3. Vercel

Importar el mismo repo desde GitHub.

- Root Directory: `frontend`
- Framework Preset: Vite
- Install Command: `npm ci`
- Build Command: `npm run build`
- Output Directory: `dist`

Variables en Vercel:

```env
VITE_API_URL=https://TU-BACKEND.onrender.com
```

Despues de guardar la variable, hacer redeploy del frontend.

El panel del dueño queda en:

```txt
https://TU-FRONTEND.vercel.app/admin
```
