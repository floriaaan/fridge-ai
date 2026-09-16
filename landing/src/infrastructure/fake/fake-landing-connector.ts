import type { LandingConnector } from '../../domain/interfaces/landing-connector.js'
import type { InstanceStats } from '../../domain/instance/instance-stats.js'
import type { ProjectInfo } from '../../domain/project/project-info.js'
import { landingContentFr } from '../content/landing-content.fr.js'

/** In-memory: no backend, no GitHub. Dev and tests only — its numbers are made up. */
export class FakeLandingConnector implements LandingConnector {
  constructor(
    private readonly stats: InstanceStats | null = {
      households: 128,
      productsConsumed: 9412,
      recipesGenerated: 736,
    },
    private readonly project: ProjectInfo = {
      repository: 'floriaaan/fridge-ai',
      url: 'https://github.com/floriaaan/fridge-ai',
      stars: 42,
      license: 'MIT',
      latestVersion: null,
    },
  ) {}

  async getContent() {
    return landingContentFr
  }

  async getInstanceStats() {
    return this.stats
  }

  async getProjectInfo() {
    return this.project
  }
}
