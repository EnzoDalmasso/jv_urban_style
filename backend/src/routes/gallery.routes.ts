import { Router } from 'express';
import { getGallery } from '../controllers/gallery.controller.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export const galleryRouter = Router();

galleryRouter.get('/', asyncHandler(getGallery));
