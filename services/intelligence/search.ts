import { pb, SERVER_URL } from "~/lib/pocketbase"

const INTELLIGENCE_URL = "https://intelligence.practocore.com"

export interface SearchResultGroup {
  collection: string
  items: SearchResultItem[]
}

export interface SearchResultItem {
  id: string
  name?: string
  caseNumber?: string
  date?: string
  status?: string
  description?: string
  reason?: string
  role?: string
  email?: string
  triggerDate?: string
  matter?: string
  created?: string
  [key: string]: any
}

export interface SearchResponse {
  results: SearchResultGroup[]
  message: string
}

export interface SearchModelInfo {
  key: string
  label: string
  provider: string
}

export async function searchWithAI(
  query: string,
  userId?: string,
  organisationId?: string,
  authToken?: string,
  model?: string
): Promise<SearchResponse> {
  const response = await fetch(`${INTELLIGENCE_URL}/api/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, userId, organisationId, authToken, model }),
  })

  if (!response.ok) {
    throw new Error(`Intelligence service error: ${response.status}`)
  }

  return response.json()
}

/**
 * Local full-text search backed by the PocketBase FTS5 index
 * (GET /api/practocore/search). Org/access scoping is enforced server-side.
 * Returns the same shape as the AI search so the UI can render both modes
 * identically.
 */
export async function searchLocal(
  query: string,
  opts: { limit?: number, scope?: string, signal?: AbortSignal } = {}
): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: query })
  if (opts.limit) params.set("limit", String(opts.limit))
  if (opts.scope) params.set("scope", opts.scope)

  const res = await fetch(`${SERVER_URL}/api/practocore/search?${params.toString()}`, {
    method: "GET",
    headers: {
      // Custom endpoints expect the raw token (not a "Bearer" prefix).
      "Authorization": pb.authStore.token,
      "Content-Type": "application/json",
    },
    signal: opts.signal,
  })

  if (!res.ok) {
    throw new Error(`Search service error: ${res.status}`)
  }

  return res.json()
}

export async function getAvailableModels(): Promise<{
  models: SearchModelInfo[]
  default: string
}> {
  const response = await fetch(`${INTELLIGENCE_URL}/api/models`)

  if (!response.ok) {
    throw new Error(`Intelligence service error: ${response.status}`)
  }

  return response.json()
}
