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
