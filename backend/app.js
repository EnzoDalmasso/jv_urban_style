// Entrypoint de Vercel. Usa el JS que genera `npm run build` (tsc) en dist/,
// para que Vercel no recompile el TypeScript con su propia configuracion.
import 'express';

export { default } from './dist/app.js';
