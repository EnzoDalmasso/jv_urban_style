import { Router } from 'express';
import { availabilityRouter } from './availability.routes.js';
import { servicesRouter } from './services.routes.js';

export const apiRouter = Router();

apiRouter.use('/availability', availabilityRouter);
apiRouter.use('/services', servicesRouter);
