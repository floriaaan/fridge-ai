import type { ApplicationService } from '@adonisjs/core/types'
import type { HomeAssistantLinkRepository } from '#domain/home-assistant/interfaces/home-assistant-link-repository.interface'
import type { HomeAssistantClient } from '#domain/home-assistant/interfaces/home-assistant-client.interface'
import type { HostPolicy } from '#domain/home-assistant/interfaces/host-policy.interface'
import type { ShoppingListMirror } from '#application/home-assistant/shopping-list-mirror'

export default class HomeAssistantProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton('homeAssistant.links', async () => {
      const { LucidHomeAssistantLinkRepository } =
        await import('#infrastructure/database/home-assistant/home-assistant-link.repository')
      const encryption = await this.app.container.make('shared.encryption')
      return new LucidHomeAssistantLinkRepository(encryption)
    })

    this.app.container.singleton('homeAssistant.client', async () => {
      const { HttpHomeAssistantClient } = await import('#infrastructure/home-assistant/http-home-assistant.client')
      return new HttpHomeAssistantClient()
    })

    this.app.container.singleton('homeAssistant.hostPolicy', async () => {
      const { EnvHostPolicy } = await import('#infrastructure/home-assistant/env-host-policy')
      return new EnvHostPolicy()
    })

    this.app.container.singleton('homeAssistant.shoppingListMirror', async () => {
      const { ShoppingListMirror } = await import('#application/home-assistant/shopping-list-mirror')
      const links = await this.app.container.make('homeAssistant.links')
      const client = await this.app.container.make('homeAssistant.client')
      const hostPolicy = await this.app.container.make('homeAssistant.hostPolicy')
      const clock = await this.app.container.make('shared.clock')
      return new ShoppingListMirror(links, client, hostPolicy, clock)
    })
  }
}

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    'homeAssistant.links': HomeAssistantLinkRepository
    'homeAssistant.client': HomeAssistantClient
    'homeAssistant.hostPolicy': HostPolicy
    'homeAssistant.shoppingListMirror': ShoppingListMirror
  }
}
