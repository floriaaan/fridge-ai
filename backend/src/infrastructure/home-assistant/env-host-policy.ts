import env from '#start/env'
import type { HostPolicy } from '#domain/home-assistant/interfaces/host-policy.interface'
import type { InstanceUrl } from '#domain/home-assistant/instance-url.vo'

/** Cf. design §7. Empty or unset = allow all, so existing deployments and
 * `task setup` need no new value. */
export class EnvHostPolicy implements HostPolicy {
  isAllowed(url: InstanceUrl): boolean {
    const raw = env.get('HOME_ASSISTANT_ALLOWED_HOSTS', '')
    if (!raw.trim()) return true

    const allowed = raw
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)

    const parsed = new URL(url.value)
    const host = parsed.hostname
    const hostWithPort = parsed.port ? `${host}:${parsed.port}` : host

    return allowed.includes(host) || allowed.includes(hostWithPort)
  }
}
