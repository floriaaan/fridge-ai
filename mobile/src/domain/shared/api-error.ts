/** Structurally identical to the `error` field of the backend's error envelope (`error-serializer.ts`) — no re-mapping on this side. */
export interface ApiError {
  type: string
  message: string
  details?: unknown
}
