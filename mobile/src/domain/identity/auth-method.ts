export interface AuthMethod {
  id: 'password' | 'pocketid' | 'google' | 'passkey'
  enabled: boolean
  label: string
}
