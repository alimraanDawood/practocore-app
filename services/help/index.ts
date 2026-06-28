import { pb, SERVER_URL } from '~/lib/pocketbase';
import { superuserToken } from '~/services/caselaw';

// Client for the in-app Help Center API (HELP_CENTER_STRATEGY.md Phase 1/2).
// Reads are public (published, audience-filtered) so they work logged-out too;
// the curator writes are superuser-only and gated server-side. The auth token is
// sent when present so an authenticated reader sees role-scoped content.

export interface HelpCategory {
  id: string;
  title: string;
  slug: string;
  description: string;
  icon: string;
  order: number;
  audience: string;
  article_count: number;
}

export interface HelpArticleSummary {
  id: string;
  title: string;
  slug: string;
  category: string;
  category_slug?: string;
  excerpt: string;
  order: number;
  audience: string;
  tags: string[];
  published: boolean;
  updated: string;
}

export interface HelpArticle extends HelpArticleSummary {
  body: string;
  related?: string[];
}

export interface HelpArticleWrite {
  title?: string;
  slug?: string;
  category?: string; // id or slug
  excerpt?: string;
  body?: string;
  order?: number;
  audience?: string;
  tags?: string[];
  related?: string[];
  published?: boolean;
}

export interface HelpCategoryWrite {
  title?: string;
  slug?: string;
  description?: string;
  icon?: string;
  order?: number;
  audience?: string;
}

/** Curator view of an article: adds publish state + helpful/not-helpful tallies. */
export interface HelpAdminArticle extends HelpArticle {
  helpful_yes: number;
  helpful_no: number;
}

const BASE = `${SERVER_URL}/api/practocore/help`;

function authHeaders(json = true): Record<string, string> {
  const h: Record<string, string> = {};
  // Reads are public, but send the token when signed in for audience scoping.
  if (pb.authStore.token) h.Authorization = pb.authStore.token;
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      msg = body?.message || body?.error || msg;
    } catch { /* keep default */ }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

// --- reads -------------------------------------------------------------------

export async function listCategories(): Promise<HelpCategory[]> {
  const res = await fetch(`${BASE}/categories`, { headers: authHeaders(false) });
  const data = await asJson<{ categories: HelpCategory[] }>(res);
  return data.categories ?? [];
}

export async function listArticles(category?: string): Promise<HelpArticleSummary[]> {
  const url = new URL(`${BASE}/articles`);
  if (category) url.searchParams.set('category', category);
  const res = await fetch(url.toString(), { headers: authHeaders(false) });
  const data = await asJson<{ articles: HelpArticleSummary[] }>(res);
  return data.articles ?? [];
}

export async function getArticle(slug: string): Promise<HelpArticle> {
  const res = await fetch(`${BASE}/articles/${encodeURIComponent(slug)}`, { headers: authHeaders(false) });
  return asJson<HelpArticle>(res);
}

export async function searchHelp(q: string, limit = 10): Promise<HelpArticleSummary[]> {
  if (!q.trim()) return [];
  const url = new URL(`${BASE}/search`);
  url.searchParams.set('q', q);
  url.searchParams.set('limit', String(limit));
  const res = await fetch(url.toString(), { headers: authHeaders(false) });
  const data = await asJson<{ results: HelpArticleSummary[] }>(res);
  return data.results ?? [];
}

/** Record a "was this helpful?" vote (public; the user's token dedupes re-votes). */
export async function submitFeedback(slug: string, helpful: boolean, comment?: string): Promise<void> {
  const res = await fetch(`${BASE}/articles/${encodeURIComponent(slug)}/feedback`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ helpful, comment: comment ?? '' }),
  });
  await asJson<{ ok: boolean }>(res);
}

// --- curator (superuser session shared with the case-law admin) --------------

function curatorHeaders(json = true): Record<string, string> {
  const h: Record<string, string> = { Authorization: superuserToken() };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

/** All articles incl. drafts, with feedback tallies (curator grid). */
export async function adminListArticles(): Promise<HelpAdminArticle[]> {
  const res = await fetch(`${BASE}/admin/articles`, { headers: curatorHeaders(false) });
  const data = await asJson<{ articles: HelpAdminArticle[] }>(res);
  return data.articles ?? [];
}

/** One article (any publish state, with body) + feedback tallies. */
export async function adminGetArticle(id: string): Promise<HelpAdminArticle> {
  const res = await fetch(`${BASE}/admin/articles/${id}`, { headers: curatorHeaders(false) });
  return asJson<HelpAdminArticle>(res);
}

export async function createArticle(body: HelpArticleWrite): Promise<{ id: string }> {
  const res = await fetch(`${BASE}/articles`, { method: 'POST', headers: curatorHeaders(), body: JSON.stringify(body) });
  return asJson<{ id: string }>(res);
}

export async function updateArticle(id: string, body: HelpArticleWrite): Promise<{ id: string }> {
  const res = await fetch(`${BASE}/articles/${id}`, { method: 'PATCH', headers: curatorHeaders(), body: JSON.stringify(body) });
  return asJson<{ id: string }>(res);
}

export async function deleteArticle(id: string): Promise<void> {
  const res = await fetch(`${BASE}/articles/${id}`, { method: 'DELETE', headers: curatorHeaders(false) });
  await asJson<{ deleted: string }>(res);
}

export async function createCategory(body: HelpCategoryWrite): Promise<{ id: string }> {
  const res = await fetch(`${BASE}/categories`, { method: 'POST', headers: curatorHeaders(), body: JSON.stringify(body) });
  return asJson<{ id: string }>(res);
}

export async function updateCategory(id: string, body: HelpCategoryWrite): Promise<{ id: string }> {
  const res = await fetch(`${BASE}/categories/${id}`, { method: 'PATCH', headers: curatorHeaders(), body: JSON.stringify(body) });
  return asJson<{ id: string }>(res);
}

export async function deleteCategory(id: string): Promise<void> {
  const res = await fetch(`${BASE}/categories/${id}`, { method: 'DELETE', headers: curatorHeaders(false) });
  await asJson<{ deleted: string }>(res);
}

export async function reindexHelp(): Promise<{ fts_indexed: number; embedded: number; embed_error?: string }> {
  const res = await fetch(`${BASE}/reindex`, { method: 'POST', headers: curatorHeaders(false) });
  return asJson<{ fts_indexed: number; embedded: number; embed_error?: string }>(res);
}
