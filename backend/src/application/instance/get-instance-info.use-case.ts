import type { UseCase } from '#application/shared/use-case'
import type { InstanceInfo } from '#domain/instance/interfaces/instance-info.interface'

/** Always answers — unlike public stats, this is not opt-in. */
export class GetInstanceInfo implements UseCase<void, InstanceInfo> {
  constructor(private readonly info: InstanceInfo) {}

  async execute(): Promise<InstanceInfo> {
    return this.info
  }
}
