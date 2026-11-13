import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  createGalleryItem,
  createUploadUrl,
  deleteGalleryItem,
  listAdminGallery,
  listPublicGallery,
  reorderGallery,
  updateGalleryItem
} from '../services/gallery.service.js';

export async function getGallery(_req: Request, res: Response) {
  res.json(await listPublicGallery());
}

export async function getAdminGallery(_req: Request, res: Response) {
  res.json({ items: await listAdminGallery() });
}

export async function postGalleryUploadUrl(req: Request, res: Response) {
  res.json(await createUploadUrl(req.body));
}

export async function postGalleryItem(req: Request, res: Response) {
  const item = await createGalleryItem(req.body);
  res.status(201).json({ item });
}

export async function patchGalleryItem(req: Request, res: Response) {
  const params = z.object({ id: z.string().uuid() }).parse(req.params);
  const item = await updateGalleryItem(params.id, req.body);
  res.json({ item });
}

export async function putGalleryOrder(req: Request, res: Response) {
  res.json({ items: await reorderGallery(req.body) });
}

export async function removeGalleryItem(req: Request, res: Response) {
  const params = z.object({ id: z.string().uuid() }).parse(req.params);
  res.json(await deleteGalleryItem(params.id));
}
