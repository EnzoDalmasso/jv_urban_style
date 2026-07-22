# Proyecto Peluqueria

Base desacoplada para una app moderna de reservas de turnos para peluqueria/barberia.

## Stack elegido

- Frontend: React + Vite + TypeScript, listo para Vercel.
- Backend: Node.js + Express + TypeScript, listo para Render.
- Base de datos: Supabase PostgreSQL con SQL en `supabase/schema.sql`.

## Estructura

```txt
frontend/
  src/
    components/
      DateTimeSelector.tsx
    lib/
      api.ts
    App.tsx
    main.tsx
    styles.css
backend/
  src/
    config/
    controllers/
    lib/
    middleware/
    routes/
    services/
    utils/
supabase/
  schema.sql
  seed.sql
```

## Variables de entorno

Backend (`backend/.env`):

```env
PORT=4000
CORS_ORIGIN=http://localhost:5173
ADMIN_PIN=change-this-pin
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
BUSINESS_TIMEZONE=America/Argentina/Buenos_Aires
SLOT_INTERVAL_MINUTES=15
```

Frontend (`frontend/.env`):

```env
VITE_API_URL=http://localhost:4000
```

## Endpoints iniciales

- `GET /health`
- `GET /api/services`
- `GET /api/availability?date=YYYY-MM-DD&serviceIds=id1,id2`
- `GET /api/availability?date=YYYY-MM-DD&serviceId=id&staffId=id`
- `POST /api/appointments`
- `GET /api/admin/summary?date=YYYY-MM-DD`
- `PATCH /api/admin/services/:id`
- `PUT /api/admin/business-hours`
- `POST /api/admin/special-hours`

La disponibilidad se calcula en servidor para evitar doble reserva. El SQL tambien incluye una restriccion de exclusion en PostgreSQL para bloquear solapamientos por profesional.

El panel del dueño vive en `/admin` y requiere el PIN configurado en `ADMIN_PIN`.

## Arranque local

```bash
cd backend
npm install
npm run dev
```

```bash
cd frontend
npm install
npm run dev
```

Antes de probar disponibilidad, ejecutar `supabase/schema.sql` y opcionalmente `supabase/seed.sql` en el SQL editor de Supabase.
