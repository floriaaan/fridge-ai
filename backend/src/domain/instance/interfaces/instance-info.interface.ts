/**
 * Lets a client (the mobile app's onboarding, the landing page) tell a
 * self-hosted instance apart from the hosted offering without a session.
 */
export interface InstanceInfo {
  mode: 'hosted' | 'self-hosted'
  name: string | null
  version: string
}
