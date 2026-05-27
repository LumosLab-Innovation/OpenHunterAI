import type { Request, Response } from 'express';
import { currentUser } from '../../middlewares/auth.middleware.js';
import { ProjectsService } from './projects.service.js';

const service = new ProjectsService();

export async function listProjects(req: Request, res: Response) {
  res.json(await service.list(currentUser(req).orgId));
}

export async function createProject(req: Request, res: Response) {
  res.json(await service.create(currentUser(req).orgId, req.body));
}
