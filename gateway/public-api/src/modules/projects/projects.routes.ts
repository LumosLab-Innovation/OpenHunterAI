import { Router } from 'express';
import { requireUser } from '../../middlewares/auth.middleware.js';
import { asyncRoute } from '../../middlewares/async-route.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import { createProject, deleteProject, getProject, listProjects } from './projects.controller.js';
import { CreateProjectBody, DeleteProjectBody } from './projects.dto.js';

export const projectRoutes = Router();

projectRoutes.get('/', requireUser, asyncRoute(listProjects));
projectRoutes.post('/', requireUser, validateBody(CreateProjectBody), asyncRoute(createProject));
projectRoutes.get('/:id', requireUser, asyncRoute(getProject));
projectRoutes.delete('/:id', requireUser, validateBody(DeleteProjectBody), asyncRoute(deleteProject));
