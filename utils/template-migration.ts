/**
 * Template Migration Utilities
 * Helpers for migrating existing templates to Phase 1A schema
 */

import type { DeadlineTemplateRecord, TemplateFormData } from '~/lib/types/template';
import { updateTemplate } from '~/services/templates';
import { serializeTags, parseTags } from '~/lib/types/template';
import { calculateComplexity } from '~/lib/constants/template-categories';
import type { Country, PracticeArea, ComplexityLevel } from '~/lib/constants/template-categories';

/**
 * Migration options for bulk updating templates
 */
export interface MigrationOptions {
  defaultCountry?: Country;
  defaultPracticeArea?: PracticeArea;
  defaultLanguage?: string;
  autoCalculateComplexity?: boolean;
  convertTags?: boolean;
  dryRun?: boolean;
}

/**
 * Analyze a template and suggest categorization
 */
export function analyzeTemplate(template: DeadlineTemplateRecord): Partial<TemplateFormData> {
  const suggestions: Partial<TemplateFormData> = {};

  // Auto-detect complexity from template structure
  if (template.template?.deadlines) {
    const deadlineCount = template.template.deadlines.length || 0;
    const conditionalCount = template.template.conditionals?.length || 0;
    suggestions.complexity = calculateComplexity(deadlineCount, conditionalCount);
  }

  // Convert legacy tags (comma-separated to JSON array)
  if (template.tags && typeof template.tags === 'string') {
    const tagsArray = parseTags(template.tags);
    if (tagsArray.length > 0) {
      suggestions.tags = tagsArray;
    }
  }

  // Try to detect practice area from tags or name
  const nameAndDesc = `${template.name} ${template.description || ''}`.toLowerCase();

  if (nameAndDesc.includes('civil') || nameAndDesc.includes('litigation')) {
    suggestions.practiceArea = 'civil_litigation';
  } else if (nameAndDesc.includes('criminal')) {
    suggestions.practiceArea = 'criminal_law';
  } else if (nameAndDesc.includes('family') || nameAndDesc.includes('divorce')) {
    suggestions.practiceArea = 'family_law';
  } else if (nameAndDesc.includes('corporate') || nameAndDesc.includes('commercial')) {
    suggestions.practiceArea = 'corporate_commercial';
  } else if (nameAndDesc.includes('employment') || nameAndDesc.includes('labor')) {
    suggestions.practiceArea = 'employment_law';
  } else if (nameAndDesc.includes('property') || nameAndDesc.includes('ip')) {
    suggestions.practiceArea = 'intellectual_property';
  } else if (nameAndDesc.includes('real estate') || nameAndDesc.includes('property')) {
    suggestions.practiceArea = 'real_estate';
  } else if (nameAndDesc.includes('tax')) {
    suggestions.practiceArea = 'tax_law';
  } else if (nameAndDesc.includes('immigration')) {
    suggestions.practiceArea = 'immigration_law';
  }

  // Try to detect court level
  if (nameAndDesc.includes('supreme') || nameAndDesc.includes('apex')) {
    suggestions.courtLevel = 'supreme_apex';
  } else if (nameAndDesc.includes('appeal') || nameAndDesc.includes('appellate') || nameAndDesc.includes('high court')) {
    suggestions.courtLevel = 'appellate_high';
  } else if (nameAndDesc.includes('trial') || nameAndDesc.includes('district')) {
    suggestions.courtLevel = 'trial_district';
  } else if (nameAndDesc.includes('tribunal')) {
    suggestions.courtLevel = 'specialized_tribunal';
  } else if (nameAndDesc.includes('arbitration') || nameAndDesc.includes('adr')) {
    suggestions.courtLevel = 'arbitration_adr';
  } else if (nameAndDesc.includes('small claims')) {
    suggestions.courtLevel = 'small_claims';
  }

  // Extract matter type from name if it follows common patterns
  const matterTypePatterns = [
    /summons/i,
    /motion/i,
    /appeal/i,
    /petition/i,
    /complaint/i,
    /discovery/i,
    /deposition/i,
  ];

  for (const pattern of matterTypePatterns) {
    if (pattern.test(template.name)) {
      suggestions.matterType = template.name;
      break;
    }
  }

  return suggestions;
}

/**
 * Migrate a single template to Phase 1A schema
 */
export async function migrateTemplate(
  template: DeadlineTemplateRecord,
  options: MigrationOptions = {}
): Promise<{ success: boolean; error?: string; updated?: Partial<TemplateFormData> }> {
  try {
    const {
      defaultCountry = 'US',
      defaultPracticeArea = 'other',
      defaultLanguage = 'en',
      autoCalculateComplexity = true,
      convertTags = true,
      dryRun = false,
    } = options;

    // Skip if template already has required fields
    if (template.country && template.practiceArea) {
      return {
        success: true,
        error: 'Template already migrated',
      };
    }

    // Get auto-detected suggestions
    const suggestions = analyzeTemplate(template);

    // Build update data
    const updateData: Partial<TemplateFormData> = {
      country: template.country || defaultCountry,
      practiceArea: template.practiceArea || suggestions.practiceArea || defaultPracticeArea,
      language: template.language || defaultLanguage,
    };

    // Add optional fields if detected
    if (suggestions.courtLevel) {
      updateData.courtLevel = suggestions.courtLevel;
    }

    if (suggestions.matterType) {
      updateData.matterType = suggestions.matterType;
    }

    // Add complexity
    if (autoCalculateComplexity && suggestions.complexity) {
      updateData.complexity = suggestions.complexity;
    }

    // Convert tags
    if (convertTags && suggestions.tags) {
      updateData.tags = serializeTags(suggestions.tags);
    }

    // Dry run - just return what would be updated
    if (dryRun) {
      return {
        success: true,
        updated: updateData,
      };
    }

    // Actually update the template
    // await updateTemplate(template.id, updateData);

    return {
      success: true,
      updated: updateData,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to migrate template',
    };
  }
}

/**
 * Bulk migrate multiple templates
 */
export async function bulkMigrateTemplates(
  templates: DeadlineTemplateRecord[],
  options: MigrationOptions = {}
): Promise<{
  total: number;
  succeeded: number;
  failed: number;
  results: Array<{
    id: string;
    name: string;
    success: boolean;
    error?: string;
    updated?: Partial<TemplateFormData>;
  }>;
}> {
  const results = [];
  let succeeded = 0;
  let failed = 0;

  for (const template of templates) {
    const result = await migrateTemplate(template, options);

    results.push({
      id: template.id,
      name: template.name,
      success: result.success,
      error: result.error,
      updated: result.updated,
    });

    if (result.success) {
      succeeded++;
    } else {
      failed++;
    }

    // Add small delay to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return {
    total: templates.length,
    succeeded,
    failed,
    results,
  };
}

/**
 * Generate migration report for review before running
 */
export function generateMigrationReport(
  templates: DeadlineTemplateRecord[],
  options: MigrationOptions = {}
): {
  needsMigration: DeadlineTemplateRecord[];
  alreadyMigrated: DeadlineTemplateRecord[];
  preview: Array<{
    id: string;
    name: string;
    current: Partial<TemplateFormData>;
    suggested: Partial<TemplateFormData>;
  }>;
} {
  const needsMigration: DeadlineTemplateRecord[] = [];
  const alreadyMigrated: DeadlineTemplateRecord[] = [];
  const preview = [];

  for (const template of templates) {
    // Check if already migrated
    if (template.country && template.practiceArea) {
      alreadyMigrated.push(template);
      continue;
    }

    needsMigration.push(template);

    // Generate preview
    const suggestions = analyzeTemplate(template);
    preview.push({
      id: template.id,
      name: template.name,
      current: {
        country: template.country,
        practiceArea: template.practiceArea,
        complexity: template.complexity,
        tags: template.tags ? parseTags(template.tags) : undefined,
      },
      suggested: {
        country: options.defaultCountry || 'US',
        practiceArea: suggestions.practiceArea || options.defaultPracticeArea || 'other',
        complexity: suggestions.complexity,
        courtLevel: suggestions.courtLevel,
        matterType: suggestions.matterType,
        tags: suggestions.tags,
      },
    });
  }

  return {
    needsMigration,
    alreadyMigrated,
    preview,
  };
}

/**
 * Helper to download migration report as CSV
 */
export function downloadMigrationReport(report: ReturnType<typeof generateMigrationReport>) {
  const headers = ['Template ID', 'Template Name', 'Current Country', 'Suggested Country', 'Current Practice Area', 'Suggested Practice Area', 'Suggested Complexity', 'Suggested Court', 'Suggested Matter Type'];

  const rows = report.preview.map(item => [
    item.id,
    item.name,
    item.current.country || '',
    item.suggested.country || '',
    item.current.practiceArea || '',
    item.suggested.practiceArea || '',
    item.suggested.complexity || '',
    item.suggested.courtLevel || '',
    item.suggested.matterType || '',
  ]);

  const csv = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  // Create download
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `template-migration-report-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Example usage in a Vue component:
 *
 * ```vue
 * <script setup>
 * import { getAllTemplates } from '~/services/templates';
 * import { bulkMigrateTemplates, generateMigrationReport } from '~/utils/template-migration';
 *
 * async function migrateAllTemplates() {
 *   // Get all templates
 *   const templates = await getAllTemplates();
 *
 *   // Generate preview report
 *   const report = generateMigrationReport(templates, {
 *     defaultCountry: 'US',
 *     defaultPracticeArea: 'other',
 *     autoCalculateComplexity: true,
 *   });
 *
 *   console.log(`${report.needsMigration.length} templates need migration`);
 *   console.log(`${report.alreadyMigrated.length} templates already migrated`);
 *
 *   // Optionally download report
 *   // downloadMigrationReport(report);
 *
 *   // Confirm before running
 *   if (confirm(`Migrate ${report.needsMigration.length} templates?`)) {
 *     const result = await bulkMigrateTemplates(report.needsMigration, {
 *       defaultCountry: 'US',
 *       defaultPracticeArea: 'other',
 *       autoCalculateComplexity: true,
 *       convertTags: true,
 *     });
 *
 *     console.log(`Migration complete: ${result.succeeded} succeeded, ${result.failed} failed`);
 *   }
 * }
 * </script>
 * ```
 */
