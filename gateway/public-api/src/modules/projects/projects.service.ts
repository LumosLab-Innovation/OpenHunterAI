import { ProjectsRepository } from './projects.repository.js';
import { GuardrailError } from '@x-hunter/shared';
import type { CreateProjectBody, DeleteProjectBody } from './projects.dto.js';

export class ProjectsService {
  constructor(private readonly repo = new ProjectsRepository()) {}

  async list(orgId: string) {
    return { projects: await this.repo.list(orgId) };
  }

  async get(projectId: string, orgId: string) {
    const project = await this.repo.find(projectId, orgId);
    if (!project) throw new GuardrailError('PROJECT_NOT_FOUND', 'Project not found');
    return { project };
  }

  async create(orgId: string, body: CreateProjectBody) {
    return { project: await this.repo.create(orgId, body) };
  }

  async delete(projectId: string, orgId: string, body: DeleteProjectBody) {
    const project = await this.repo.find(projectId, orgId);
    if (!project) throw new GuardrailError('PROJECT_NOT_FOUND', 'Project not found');
    if (body.confirmName !== project.name) {
      throw new GuardrailError('INVALID_INPUT', 'Project name confirmation does not match');
    }
    await this.repo.delete(project.id);
    return { ok: true };
  }
}
