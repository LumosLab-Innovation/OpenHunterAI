import { Router } from 'express';
import { requireUser } from '../../middlewares/auth.middleware.js';
import { asyncRoute } from '../../middlewares/async-route.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import { createProject, listProjects } from './projects.controller.js';
import { CreateProjectBody } from './projects.dto.js';

export const projectRoutes = Router();

projectRoutes.get('/', requireUser, asyncRoute(listProjects));
projectRoutes.post('/', requireUser, validateBody(CreateProjectBody), asyncRoute(createProject));
