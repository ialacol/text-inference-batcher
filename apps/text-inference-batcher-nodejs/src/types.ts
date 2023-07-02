export interface ModelResponse {
  data: Array<{
    id: string
    object: "model"
    owned_by: string
    permissions: unknown[]
  }>
  object: string
}
