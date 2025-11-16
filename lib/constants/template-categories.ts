/**
 * Template Marketplace Category Constants
 * Based on TEMPLATE_MARKETPLACE_DESIGN.md
 */

export const COUNTRIES = [
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'AU', label: 'Australia' },
  { value: 'IN', label: 'India' },
  { value: 'ZA', label: 'South Africa' },
  { value: 'NZ', label: 'New Zealand' },
  { value: 'SG', label: 'Singapore' },
  { value: 'OTHER', label: 'Other' },
] as const;

export const PRACTICE_AREAS = [
  { value: 'civil_litigation', label: 'Civil Litigation', icon: '⚖️' },
  { value: 'criminal_law', label: 'Criminal Law', icon: '🚔' },
  { value: 'family_law', label: 'Family Law', icon: '👨‍👩‍👧‍👦' },
  { value: 'corporate_commercial', label: 'Corporate & Commercial', icon: '🏢' },
  { value: 'intellectual_property', label: 'Intellectual Property', icon: '💡' },
  { value: 'employment_law', label: 'Employment Law', icon: '👔' },
  { value: 'real_estate', label: 'Real Estate', icon: '🏠' },
  { value: 'tax_law', label: 'Tax Law', icon: '💰' },
  { value: 'immigration_law', label: 'Immigration Law', icon: '✈️' },
  { value: 'administrative_law', label: 'Administrative Law', icon: '📋' },
  { value: 'bankruptcy_insolvency', label: 'Bankruptcy & Insolvency', icon: '💸' },
  { value: 'environmental_law', label: 'Environmental Law', icon: '🌍' },
  { value: 'other', label: 'Other', icon: '📁' },
] as const;

export const COURT_LEVELS = [
  { value: 'supreme_apex', label: 'Supreme Court / Apex Court' },
  { value: 'appellate_high', label: 'Appellate / High Court' },
  { value: 'trial_district', label: 'Trial Court / District Court' },
  { value: 'specialized_tribunal', label: 'Specialized Tribunal' },
  { value: 'administrative_agency', label: 'Administrative Agency' },
  { value: 'arbitration_adr', label: 'Arbitration / ADR' },
  { value: 'small_claims', label: 'Small Claims' },
  { value: 'other', label: 'Other' },
] as const;

export const COMPLEXITY_LEVELS = [
  {
    value: 'beginner',
    label: 'Beginner',
    description: 'Linear timelines, no conditionals (≤ 5 deadlines)',
    color: 'green'
  },
  {
    value: 'intermediate',
    label: 'Intermediate',
    description: 'Some conditional logic (6-15 deadlines)',
    color: 'blue'
  },
  {
    value: 'advanced',
    label: 'Advanced',
    description: 'Complex branching, multiple fields (16-30 deadlines)',
    color: 'orange'
  },
  {
    value: 'expert',
    label: 'Expert',
    description: 'Highly specialized workflows (31+ deadlines)',
    color: 'red'
  },
] as const;

export const TEMPLATE_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'hi', label: 'Hindi' },
  { value: 'zh', label: 'Mandarin' },
  { value: 'other', label: 'Other' },
] as const;

// Type exports for TypeScript
export type Country = typeof COUNTRIES[number]['value'];
export type PracticeArea = typeof PRACTICE_AREAS[number]['value'];
export type CourtLevel = typeof COURT_LEVELS[number]['value'];
export type ComplexityLevel = typeof COMPLEXITY_LEVELS[number]['value'];
export type TemplateLanguage = typeof TEMPLATE_LANGUAGES[number]['value'];

// Helper functions
export function getCountryLabel(value: string): string {
  return COUNTRIES.find(c => c.value === value)?.label || value;
}

export function getPracticeAreaLabel(value: string): string {
  return PRACTICE_AREAS.find(p => p.value === value)?.label || value;
}

export function getCourtLevelLabel(value: string): string {
  return COURT_LEVELS.find(c => c.value === value)?.label || value;
}

export function getComplexityLabel(value: string): string {
  return COMPLEXITY_LEVELS.find(c => c.value === value)?.label || value;
}

export function getLanguageLabel(value: string): string {
  return TEMPLATE_LANGUAGES.find(l => l.value === value)?.label || value;
}

// Calculate complexity based on template structure
export function calculateComplexity(deadlineCount: number, conditionalCount: number = 0): ComplexityLevel {
  if (deadlineCount <= 5 && conditionalCount === 0) return 'beginner';
  if (deadlineCount <= 15) return 'intermediate';
  if (deadlineCount <= 30) return 'advanced';
  return 'expert';
}
