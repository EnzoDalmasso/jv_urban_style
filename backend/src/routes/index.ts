import { Router } from 'express';
import { availabilityRouter } from './availability.routes.js';
import { appointmentsRouter } from './appointments.routes.js';
import { servicesRouter } from './services.routes.js';
import { adminRouter } from './admin.routes.js';
import { scheduleRouter } from './schedule.routes.js';

export const apiRouter = Router();

apiRouter.use('/availability', availabilityRouter);
apiRouter.use('/appointments', appointmentsRouter);
apiRouter.use('/services', servicesRouter);
apiRouter.use('/schedule', scheduleRouter);
apiRouter.use('/admin', adminRouter);
