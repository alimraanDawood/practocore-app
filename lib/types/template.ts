/**
 * Enhanced Template Types with Marketplace Features
 * Phase 1A: Categorization & Metadata
 */

import type { RecordModel } from 'pocketbase';
import type {
  Country,
  PracticeArea,
  CourtLevel,
  ComplexityLevel,
  TemplateLanguage
} from '~/lib/constants/template-categories';

/**
 * Base PocketBase Template Record
 */
export interface DeadlineTemplateRecord extends RecordModel {
  id: string;
  name: string;
  description: string;
  isPublic: boolean;
  template: any; // JSON template structure
  version: string;
  organisation?: string;
  usageCount: number;
  tags: string; // Will be converted to string[] in enhanced version
  changelog: any;
  status: 'draft' | 'active' | 'deprecated';
  author: string;
  authorName: string;
  organisationName: string;
  created: string;
  updated: string;

  // Phase 1A: New categorization fields
  country?: Country;
  stateProvince?: string;
  practiceArea?: PracticeArea;
  courtLevel?: CourtLevel;
  matterType?: string;
  complexity?: ComplexityLevel;
  language?: TemplateLanguage;
}

/**
 * Enhanced Template with parsed fields
 */
export interface EnhancedTemplate extends Omit<DeadlineTemplateRecord, 'tags'> {
  tags: string[]; // Parsed from comma-separated or JSON

  // Metadata helpers
  deadlineCount?: number;
  conditionalCount?: number;
  fieldCount?: number;
}

/**
 * Template Category Filter
 */
export interface TemplateCategoryFilter {
  country?: Country[];
  stateProvince?: string[];
  practiceArea?: PracticeArea[];
  courtLevel?: CourtLevel[];
  complexity?: ComplexityLevel[];
  language?: TemplateLanguage[];
  status?: ('draft' | 'active' | 'deprecated')[];
  isPublic?: boolean;
  searchQuery?: string;
  tags?: string[];
}

/**
 * Template Creation/Update Data
 */
export interface TemplateFormData {
  name: string;
  description: string;
  template: any;

  // Categorization
  country?: Country;
  stateProvince?: string;
  practiceArea?: PracticeArea;
  courtLevel?: CourtLevel;
  matterType?: string;
  complexity?: ComplexityLevel;
  language?: TemplateLanguage;

  // Metadata
  tags?: string[];
  status?: 'draft' | 'active' | 'deprecated';
  isPublic?: boolean;
  version?: string;

  // Legacy
  organisation?: string;
}

/**
 * Template Statistics
 */
export interface TemplateStats {
  usageCount: number;
  deadlineCount: number;
  conditionalCount: number;
  fieldCount: number;
  averageRating?: number; // Future: Phase 4
  reviewCount?: number; // Future: Phase 4
}

/**
 * Helper to parse tags from legacy format
 */
export function parseTags(tags: string | string[] | null | undefined): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;

  // Try parsing as JSON first
  try {
    const parsed = JSON.parse(tags);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Fall through to comma-separated parsing
  }

  // Parse comma-separated tags
  return tags.split(',').map(t => t.trim()).filter(Boolean);
}

/**
 * Helper to serialize tags for storage
 */
export function serializeTags(tags: string[]): string {
  return JSON.stringify(tags);
}

/**
 * Helper to enhance a template record
 */
export function enhanceTemplate(record: DeadlineTemplateRecord): EnhancedTemplate {
  return {
    ...record,
    tags: parseTags(record.tags),
    // Calculate metadata from template structure
    deadlineCount: record.template?.deadlines?.length || 0,
    conditionalCount: record.template?.conditionals?.length || 0,
    fieldCount: record.template?.fields?.length || 0,
  };
}
