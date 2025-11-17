import { type RecordModel, type RecordSubscription } from 'pocketbase';
import { pb as pocketbase } from '~/lib/pocketbase';
import type {
  DeadlineTemplateRecord,
  EnhancedTemplate,
  TemplateCategoryFilter,
  TemplateFormData
} from '~/lib/types/template';
import { enhanceTemplate } from '~/lib/types/template';

const SERVER_URL = "https://www.practocore.com";

/**
 * Build PocketBase filter from category filter object
 */
function buildFilterString(filter: TemplateCategoryFilter): string {
  const filters: string[] = [];

  if (filter.country?.length) {
    const countryFilter = filter.country.map(c => `country = '${c}'`).join(' || ');
    filters.push(`(${countryFilter})`);
  }

  if (filter.practiceArea?.length) {
    const practiceFilter = filter.practiceArea.map(p => `practiceArea = '${p}'`).join(' || ');
    filters.push(`(${practiceFilter})`);
  }

  if (filter.courtLevel?.length) {
    const courtFilter = filter.courtLevel.map(c => `courtLevel = '${c}'`).join(' || ');
    filters.push(`(${courtFilter})`);
  }

  if (filter.complexity?.length) {
    const complexityFilter = filter.complexity.map(c => `complexity = '${c}'`).join(' || ');
    filters.push(`(${complexityFilter})`);
  }

  if (filter.status?.length) {
    const statusFilter = filter.status.map(s => `status = '${s}'`).join(' || ');
    filters.push(`(${statusFilter})`);
  }

  if (filter.isPublic !== undefined) {
    filters.push(`isPublic = ${filter.isPublic}`);
  }

  if (filter.searchQuery) {
    const query = filter.searchQuery.replace(/'/g, "\\'");
    filters.push(`(name ~ '${query}' || description ~ '${query}' || matterType ~ '${query}')`);
  }

  return filters.join(' && ');
}

/**
 * Get all templates with optional filtering
 */
export async function getAllTemplates(filter?: TemplateCategoryFilter): Promise<EnhancedTemplate[]> {
  pocketbase.autoCancellation(false);

  const options: any = {
    expand: 'author',
    sort: '-created',
  };

  if (filter) {
    const filterString = buildFilterString(filter);
    if (filterString) {
      options.filter = filterString;
    }
  }

  const result = await pocketbase.collection('DeadlineTemplates').getFullList(options);
  pocketbase.autoCancellation(true);

  return result.map(record => enhanceTemplate(record as DeadlineTemplateRecord));
}

/**
 * Create a new template
 */
export async function createTemplate(options: TemplateFormData): Promise<DeadlineTemplateRecord> {
  return pocketbase.collection('DeadlineTemplates').create(options);
}

/**
 * Get paginated templates with filtering
 */
export async function getTemplates(
  page: number,
  numPerPage: number,
  filter?: TemplateCategoryFilter,
  sortBy: string = '-created'
): Promise<{ items: EnhancedTemplate[], page: number, perPage: number, totalItems: number, totalPages: number }> {
  pocketbase.autoCancellation(false);

  const options: any = {
    expand: 'author',
    sort: sortBy,
  };

  if (filter) {
    const filterString = buildFilterString(filter);
    if (filterString) {
      options.filter = filterString;
    }
  }

  const result = await pocketbase.collection('DeadlineTemplates').getList(page, numPerPage, options);
  pocketbase.autoCancellation(true);

  return {
    items: result.items.map(record => enhanceTemplate(record as DeadlineTemplateRecord)),
    page: result.page,
    perPage: result.perPage,
    totalItems: result.totalItems,
    totalPages: result.totalPages,
  };
}

/**
 * Get a single template by ID
 */
export async function getTemplate(id: string): Promise<EnhancedTemplate> {
  const record = await pocketbase.collection('DeadlineTemplates').getOne(id, { expand: 'author' });
  return enhanceTemplate(record as DeadlineTemplateRecord);
}

/**
 * Update a template
 */
export async function updateTemplate(id: string, data: Partial<TemplateFormData>): Promise<DeadlineTemplateRecord> {
  return pocketbase.collection('DeadlineTemplates').update(id, data);
}

/**
 * Subscribe to template changes
 */
export function subscribeToTemplates(callback: Function) {
  return pocketbase.collection('DeadlineTemplates').subscribe('*', callback);
}

/**
 * Unsubscribe from template changes
 */
export function unsubscribeToTemplates() {
  return pocketbase.collection('DeadlineTemplates').unsubscribe('*');
}

/**
 * Search templates by keyword
 */
export async function searchTemplates(query: string, limit: number = 20): Promise<EnhancedTemplate[]> {
  const filter: TemplateCategoryFilter = {
    searchQuery: query,
    isPublic: true, // Only search public templates
  };

  const result = await getTemplates(1, limit, filter);
  return result.items;
}