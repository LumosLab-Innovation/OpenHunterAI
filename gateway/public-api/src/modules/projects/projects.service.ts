import { ProjectsRepository } from './projects.repository.js';
import type { CreateProjectBody } from './projects.dto.js';

export class ProjectsService {
  constructor(private readonly repo = new ProjectsRepository()) {}

  async list(orgId: string) {
    return { projects: await this.repo.list(orgId) };
  }

  async create(orgId: string, body: CreateProjectBody) {
    return { project: await this.repo.create(orgId, body) };
  }
}
