import type { InstanceUrl } from '../instance-url.vo.js'

export interface HostPolicy {
  isAllowed(url: InstanceUrl): boolean
}
