export interface TodoItem {
  uid: string
  summary: string
  description: string | null
  status: 'needs_action' | 'completed'
}
