const INTELLIGENCE_URL = "http://127.0.0.1:3001"

export interface CollectionFilter {
  collection: "Matters" | "Deadlines" | "DeadlineTemplates" | "Applications" | "Courts" | "Judges" | "Clerks" | "Registrars" | "DeadlineAdjournments"
  filter: string
  sort?: string
  limit?: number
}

export interface SearchFiltersResponse {
  filters: CollectionFilter[]
  message: string
}

export async function generateSearchFilters(
  query: string,
  isAdmin: boolean
): Promise<SearchFiltersResponse> {
  const response = await fetch(`${INTELLIGENCE_URL}/api/search/filters`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, isAdmin }),
  })

  if (!response.ok) {
    throw new Error(`Intelligence service error: ${response.status}`)
  }

  return response.json()
}
