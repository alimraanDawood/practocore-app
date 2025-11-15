# Template Marketplace Design Document
## PractoCore Legal Deadline Management Platform

**Version**: 1.0
**Date**: 2025-11-14
**Author**: System Analysis & Design

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Marketplace Vision & Goals](#marketplace-vision--goals)
4. [Categorization & Taxonomy System](#categorization--taxonomy-system)
5. [Permission & Access Control Model](#permission--access-control-model)
6. [Scoping & Visibility Framework](#scoping--visibility-framework)
7. [Rating & Review System](#rating--review-system)
8. [Monetization & Licensing](#monetization--licensing)
9. [Search & Discovery](#search--discovery)
10. [Template Lifecycle & Versioning](#template-lifecycle--versioning)
11. [Quality Assurance & Curation](#quality-assurance--curation)
12. [Analytics & Insights](#analytics--insights)
13. [Technical Implementation](#technical-implementation)
14. [Database Schema Design](#database-schema-design)
15. [API Design](#api-design)
16. [UI/UX Recommendations](#uiux-recommendations)
17. [Implementation Roadmap](#implementation-roadmap)

---

## 1. Executive Summary

This document outlines the design for a **global template marketplace** that will transform PractoCore from a private deadline management tool into a collaborative platform where lawyers worldwide can share, discover, and monetize deadline templates.

### Key Objectives
- Enable **global template sharing** across jurisdictions and practice areas
- Implement **robust categorization** by country, jurisdiction, case type, and matter type
- Provide **granular permissions** and access control for commercial and free templates
- Support **multi-tier scoping**: personal, team, organization, regional, global
- Introduce **quality assurance** through ratings, reviews, and expert curation
- Enable **monetization** for template creators while maintaining free community templates
- Deliver **intelligent discovery** through advanced search, filtering, and recommendations

### Success Metrics
- 10,000+ community templates within first year
- 95% template satisfaction rating
- 50% reduction in deadline setup time for common matters
- Active template creator community across 20+ countries

---

## 2. Current State Analysis

### Existing Capabilities
The current template system provides:
- **Sophisticated workflow modeling**: Conditional branching, field-driven customization
- **Reminder management**: Multi-channel notifications with escalation
- **Visual editor**: Graph-based template building with undo/redo
- **Real-time sync**: PocketBase subscriptions for collaborative updates
- **Basic scoping**: Public, organization-scoped, and private templates

### Current Limitations
1. **Access Control**: Binary public/private model, no granular permissions
2. **Categorization**: Free-text tags with no enforcement or UI support
3. **Discovery**: Name-only filtering, no advanced search or recommendations
4. **Quality Control**: No rating system, review process, or verification
5. **Versioning**: Version field exists but no migration or rollback
6. **Sharing**: No team-level sharing or collaborative editing
7. **Monetization**: No licensing, pricing, or payment infrastructure
8. **Analytics**: Basic usage count, no detailed insights or creator dashboards

### Technical Foundation
- **Backend**: PocketBase (SQLite-based, extensible with custom routes)
- **Data Model**: `DeadlineTemplates` collection with flexible JSON schema
- **Frontend**: Vue 3 + Nuxt 4, Pinia state management, Vue-Flow editor
- **Platform**: Web, Desktop (Tauri), Mobile (Capacitor/Android)

---

## 3. Marketplace Vision & Goals

### Vision Statement
"PractoCore Marketplace will be the world's largest community-driven repository of legal deadline templates, empowering lawyers with battle-tested workflows while enabling template creators to share expertise and build sustainable businesses."

### Core Goals

#### For Template Consumers (Lawyers)
1. **Discover** templates relevant to their jurisdiction and practice area in seconds
2. **Trust** templates through ratings, reviews, and expert verification
3. **Customize** templates to their specific matter requirements
4. **Save time** by avoiding repetitive deadline configuration
5. **Stay compliant** with jurisdiction-specific filing rules

#### For Template Creators
1. **Share expertise** with the global legal community
2. **Earn revenue** from premium templates (optional)
3. **Build reputation** through quality ratings and usage metrics
4. **Iterate** based on user feedback and analytics
5. **Maintain control** over versioning, licensing, and distribution

#### For Organizations
1. **Standardize workflows** across teams and offices
2. **Ensure compliance** with firm-specific procedures
3. **Onboard faster** by providing new lawyers with proven templates
4. **Track usage** of internal templates for quality improvement
5. **Control distribution** of proprietary templates

---

## 4. Categorization & Taxonomy System

### Multi-Dimensional Taxonomy

Templates will be categorized across **seven primary dimensions**:

#### 4.1 Geographic Hierarchy
```
Region → Country → State/Province → County/District → Court
```

**Examples**:
- `North America > United States > California > Los Angeles County > Superior Court`
- `Europe > United Kingdom > England & Wales > High Court`
- `Asia > India > Karnataka > Bangalore > Commercial Court`

**Implementation**:
- Hierarchical dropdown selection during template creation
- Auto-complete with type-ahead search
- Multi-select for templates applicable to multiple jurisdictions
- "Jurisdiction Tags" field for granular court-level specification

#### 4.2 Practice Area
```
Category → Subcategory → Specialty
```

**Top-Level Categories**:
- Civil Litigation
- Criminal Law
- Family Law
- Corporate & Commercial
- Intellectual Property
- Employment Law
- Real Estate
- Tax Law
- Immigration Law
- Administrative Law
- Bankruptcy & Insolvency
- Environmental Law
- Other

**Example Hierarchy**:
```
Civil Litigation
  ├── Personal Injury
  │   ├── Motor Vehicle Accidents
  │   ├── Medical Malpractice
  │   └── Slip and Fall
  ├── Contract Disputes
  └── Tort Claims
```

#### 4.3 Matter Type
Specific case or proceeding type within practice area.

**Examples**:
- "Summons to File Defence"
- "Notice of Motion"
- "Appeal (Civil)"
- "Divorce Petition"
- "Trademark Opposition"
- "Employment Termination Dispute"

**Implementation**:
- Free-text field with auto-complete from existing templates
- Suggested matter types based on practice area selection
- Ability to create custom matter types

#### 4.4 Template Complexity
- **Beginner**: Linear timelines, no conditionals (≤ 5 deadlines)
- **Intermediate**: Some conditional logic (6-15 deadlines)
- **Advanced**: Complex branching, multiple fields (16-30 deadlines)
- **Expert**: Highly specialized workflows (31+ deadlines)

**Auto-calculated** based on:
- Number of deadlines
- Number of conditional nodes
- Number of fields
- Number of conditional offset rules

#### 4.5 Court Level
- Supreme Court / Apex Court
- Appellate / High Court
- Trial Court / District Court
- Specialized Tribunal (Tax, Labor, IP, etc.)
- Administrative Agency
- Arbitration / ADR
- Small Claims
- Other

#### 4.6 Template Type
- **Standard Workflow**: General deadline sequence
- **Expedited Procedure**: Fast-track timelines
- **Discovery Template**: Document production deadlines
- **Pre-Trial Motion**: Motion practice workflows
- **Appeal Workflow**: Appellate deadlines
- **Settlement Conference**: Mediation/settlement timelines
- **Enforcement**: Judgment enforcement procedures
- **Other**

#### 4.7 Language
- English
- Spanish
- French
- German
- Portuguese
- Hindi
- Mandarin
- Other (with language code)

**Multi-language support**:
- Template name, description, and prompts in multiple languages
- Language-specific field labels
- Auto-translation suggestions (with human review)

### Tagging System

In addition to structured categories, templates support **free-form tags**:

- **Use Cases**: "Small Claims", "Pro Se", "Commercial Litigation"
- **Attributes**: "Fast Track", "High Stakes", "Routine"
- **Special Requirements**: "E-Filing", "Service by Publication", "Cross-Border"

**Tag Management**:
- Auto-suggest popular tags
- Tag validation against approved list (curated)
- Community voting on tag relevance
- Maximum 10 tags per template

### Category Validation & Enforcement

1. **Required Fields**: Country, Practice Area, Matter Type must be set
2. **Consistency Checks**: Court Level must match Geographic selection
3. **Auto-categorization**: Complexity calculated automatically
4. **Curator Review**: Public templates reviewed for correct categorization
5. **User Reporting**: "Report incorrect category" feature

---

## 5. Permission & Access Control Model

### Permission Levels

#### 5.1 Template-Level Permissions

| Permission | Owner | Collaborator (Edit) | Collaborator (View) | Public User |
|------------|-------|---------------------|---------------------|-------------|
| View Template | ✓ | ✓ | ✓ | ✓ (if public) |
| Edit Structure | ✓ | ✓ | ✗ | ✗ |
| Edit Metadata | ✓ | ✓ | ✗ | ✗ |
| Delete | ✓ | ✗ | ✗ | ✗ |
| Share/Transfer | ✓ | ✗ | ✗ | ✗ |
| Publish/Unpublish | ✓ | ✗ | ✗ | ✗ |
| Clone/Duplicate | ✓ | ✓ | ✓ | ✓ (if allowed) |
| View Analytics | ✓ | ✓ (limited) | ✗ | ✗ |
| Manage Pricing | ✓ | ✗ | ✗ | ✗ |
| Respond to Reviews | ✓ | ✓ | ✗ | ✗ |

#### 5.2 Organization Permissions

Organizations can assign **template management roles**:

**Template Admin** (Organization-level role):
- Create organization-wide templates
- Approve templates for org publication
- Manage org template library
- View org template analytics
- Set org-wide template policies

**Template Creator** (Team/Department-level):
- Create templates for their team
- Request publication to organization
- Edit own templates
- Share with other teams (if allowed)

**Template User** (Standard Member):
- Browse and use organization templates
- Clone to personal workspace
- Request access to restricted templates
- Provide feedback/ratings

#### 5.3 Marketplace Permissions

**Template Publisher**:
- Publish templates to public marketplace
- Set pricing and licensing terms
- Respond to reviews and support requests
- Access creator analytics dashboard
- Withdraw templates from marketplace

**Verified Creator**:
- All Publisher permissions
- "Verified" badge on templates
- Priority in search results
- Access to beta features
- Direct support channel

**Marketplace Curator**:
- Review templates pending publication
- Edit template metadata for consistency
- Feature templates in curated collections
- Moderate reviews and comments
- Ban low-quality templates

### Access Control Lists (ACLs)

Each template maintains an ACL with:

```typescript
interface TemplateACL {
  owner: RecordIdString              // Primary owner
  collaborators: TemplateCollaborator[]
  teams: TeamPermission[]             // Organization teams with access
  publicAccess: PublicAccessLevel
  licensing: TemplateLicense
}

interface TemplateCollaborator {
  userId: RecordIdString
  role: 'editor' | 'viewer' | 'admin'
  addedBy: RecordIdString
  addedAt: ISODateString
  permissions?: CustomPermission[]    // Override defaults
}

interface TeamPermission {
  teamId: RecordIdString
  access: 'view' | 'edit' | 'admin'
  inheritedFrom?: RecordIdString      // If org-level permission
}

type PublicAccessLevel =
  | 'private'           // Not visible outside ACL
  | 'organization'      // All org members can view
  | 'marketplace'       // Public marketplace (subject to licensing)
  | 'unlisted'          // Anyone with link can view
```

### Inheritance Model

Permissions cascade from:
1. **Organization Settings** → Templates inherit org-wide policies
2. **Team Settings** → Templates inherit team policies
3. **Template ACL** → Explicit overrides at template level

**Example Scenario**:
- Organization policy: "All templates require approval before org-wide sharing"
- Team policy: "Litigation team templates are viewable by all legal staff"
- Template ACL: "John Doe can edit, Jane Smith can view"

**Resolution**: Template requires approval (org policy) before litigation team AND legal staff can view it.

### Permission Validation

1. **Creation**: User must have `create_template` permission in their org/team
2. **Read**: User must be in ACL OR template is public OR user's org/team has access
3. **Update**: User must have `editor` or `admin` role in ACL
4. **Delete**: Only owner can delete (with confirmation)
5. **Publish**: User must have `publisher` role OR org admin approval
6. **Transfer Ownership**: Current owner can transfer to another user (irreversible)

---

## 6. Scoping & Visibility Framework

### Visibility Tiers

#### Tier 1: Personal
- **Creator**: Individual user
- **Visibility**: Only creator can see/edit
- **Use Case**: Drafts, experiments, personal customizations
- **Sharing**: Can be shared via link (generates unlisted URL)
- **Status**: `draft` or `private`

#### Tier 2: Team
- **Creator**: User within organization
- **Visibility**: Assigned to specific teams/departments
- **Use Case**: Department-specific workflows (Litigation, Corporate, Family)
- **Sharing**: Team admins can share with other teams
- **Status**: `team-active` or `team-draft`
- **Examples**:
  - "Litigation Team - Discovery Motion Template"
  - "Corporate Team - M&A Due Diligence Timeline"

#### Tier 3: Organization
- **Creator**: Organization admin or approved creator
- **Visibility**: All organization members
- **Use Case**: Firm-wide standard procedures
- **Sharing**: Read-only outside org (unless cloned)
- **Status**: `org-active`
- **Examples**:
  - "Smith & Associates - Client Intake Process"
  - "Public Defender's Office - Criminal Defense Workflow"

#### Tier 4: Regional
- **Creator**: Verified publisher
- **Visibility**: Users in specific geographic region
- **Use Case**: Jurisdiction-specific templates not universally applicable
- **Sharing**: Marketplace-listed with geographic filter
- **Status**: `marketplace-regional`
- **Examples**:
  - "California Superior Court - Civil Summons Template"
  - "Ontario Court of Justice - Family Law Motion"
- **Region Lock**: Enforced by user profile location (with override for research)

#### Tier 5: Global (Marketplace)
- **Creator**: Verified publisher
- **Visibility**: All users worldwide
- **Use Case**: Universal legal workflows, educational templates
- **Sharing**: Fully public in marketplace
- **Status**: `marketplace-global`
- **Examples**:
  - "Basic Appeal Timeline - Universal Framework"
  - "Client Communication Reminder System"

#### Tier 6: Featured/Curated
- **Creator**: Any verified publisher
- **Visibility**: Promoted in marketplace homepage and category pages
- **Use Case**: Highest quality, most popular, or editor's choice templates
- **Sharing**: Same as Global, but with premium placement
- **Status**: `marketplace-featured`
- **Selection**: Curator review + algorithm (ratings, usage, recency)

### Visibility Control Settings

```typescript
interface VisibilitySettings {
  scope: 'personal' | 'team' | 'organization' | 'regional' | 'global'
  status: TemplateStatus

  // Regional settings
  regions?: GeographicRegion[]        // Required if scope = 'regional'

  // Organization settings
  orgId?: RecordIdString              // Required if scope = 'organization' or 'team'
  teams?: RecordIdString[]            // Required if scope = 'team'

  // Marketplace settings
  marketplaceListing?: {
    featured: boolean
    featuredUntil?: ISODateString     // Auto-unfeature after date
    curatorNotes?: string
    approvedBy?: RecordIdString
    approvedAt?: ISODateString
  }

  // Discoverability
  searchable: boolean                 // Appears in search results
  allowCloning: boolean               // Users can duplicate
  allowRemixing: boolean              // Users can modify clones
  requireAttribution: boolean         // Credit original creator
}

type TemplateStatus =
  | 'draft'              // Work in progress
  | 'private'            // Finalized but private
  | 'pending-review'     // Submitted for org/marketplace approval
  | 'team-active'        // Published to team
  | 'org-active'         // Published to organization
  | 'marketplace-regional'  // Live in regional marketplace
  | 'marketplace-global'    // Live in global marketplace
  | 'marketplace-featured'  // Curated/featured
  | 'deprecated'         // No longer recommended
  | 'archived'           // Removed from active listings
```

### Scope Transition Workflow

**Personal → Team**:
1. Creator clicks "Share with Team"
2. Selects target team(s)
3. Team admin receives notification (if approval required)
4. Upon approval, template visible to team with creator's name

**Team → Organization**:
1. Team admin or creator clicks "Publish to Organization"
2. Organization template admin reviews
3. May require legal review for compliance
4. Upon approval, promoted to `org-active`

**Organization → Marketplace**:
1. Creator submits for marketplace publication
2. Platform curator reviews:
   - Category accuracy
   - Template quality (test with sample data)
   - Description completeness
   - No proprietary/sensitive information
3. Creator confirms licensing terms
4. Upon approval, published to marketplace

**Marketplace Rejection**:
- Curator provides feedback
- Template returns to `pending-review` with notes
- Creator can revise and resubmit

### Geographic Scoping

Templates can be **geo-fenced** to specific jurisdictions:

**Automatic Scoping**:
- Regional templates auto-filtered by user's location
- User profile contains: Country, State/Province, Primary Practice Locations
- Search results prioritize local templates

**Manual Override**:
- Users can browse all regions (for research, multi-jurisdictional practice)
- "Show templates from all regions" toggle in search
- Warning when using template outside intended jurisdiction

**Multi-Jurisdiction Templates**:
- Template applicable to multiple jurisdictions (e.g., "Federal Court Appeal - USA")
- Tags: `#Federal #Nationwide`
- Search results show for all USA users regardless of state

---

## 7. Rating & Review System

### Rating Dimensions

Templates are rated on **five dimensions** (1-5 stars each):

1. **Accuracy** - Deadlines match legal requirements
2. **Completeness** - All necessary deadlines included
3. **Ease of Use** - Clear prompts, logical flow
4. **Customizability** - Flexibility for different scenarios
5. **Documentation** - Helpful descriptions and guidance

**Overall Rating**: Average of five dimensions, displayed prominently.

### Review Structure

```typescript
interface TemplateReview {
  id: RecordIdString
  template: RecordIdString
  reviewer: RecordIdString

  // Ratings
  ratingAccuracy: number              // 1-5
  ratingCompleteness: number          // 1-5
  ratingEaseOfUse: number             // 1-5
  ratingCustomizability: number       // 1-5
  ratingDocumentation: number         // 1-5
  ratingOverall: number               // Calculated average

  // Review content
  title: string                       // Short summary
  content: string                     // Detailed review (markdown)

  // Context
  usedFor: string                     // "Used for: Medical malpractice case"
  jurisdiction: string                // Reviewer's jurisdiction
  experience: 'beginner' | 'intermediate' | 'advanced' | 'expert'

  // Verification
  verified: boolean                   // Reviewer is verified lawyer
  purchaseVerified: boolean           // For paid templates

  // Engagement
  helpful: number                     // Helpful votes count
  reported: number                    // Report as inappropriate count

  // Creator response
  response?: {
    content: string
    respondedAt: ISODateString
  }

  created: ISODateString
  updated: ISODateString
}
```

### Review Policies

**Who Can Review**:
- Users who have **used** the template (created matter from it)
- One review per template per user
- Can update review after further use

**Review Moderation**:
- Automated filter for profanity, spam
- Community reporting for inappropriate reviews
- Curator review for reported content
- Creator can flag inaccurate reviews (curator adjudicates)

**Verified Reviews**:
- Reviewer has verified lawyer status (via bar membership check)
- Displays "Verified Lawyer" badge
- Higher weight in overall rating calculation

**Creator Response**:
- Template owner can respond to each review
- Response shown below review
- Notification to reviewer when creator responds

### Review Incentives

**For Reviewers**:
- "Top Reviewer" badge for helpful reviews
- Reputation points for community contribution
- Early access to new templates (if active reviewer)

**For Creators**:
- High ratings boost search ranking
- Featured consideration requires 4.5+ average rating
- Reviews provide actionable feedback for improvements

### Review Display

**Template Detail Page**:
- Overall rating (e.g., 4.7/5.0) with star visualization
- Breakdown by dimension (bar charts)
- Distribution histogram (e.g., "85% 5-star, 10% 4-star...")
- Most helpful positive/negative reviews
- Filter by: Rating, Recency, Jurisdiction, Verification status

**Search Results**:
- Overall rating badge
- Review count (e.g., "(127 reviews)")
- Sorting option: "Highest Rated", "Most Reviewed"

---

## 8. Monetization & Licensing

### Licensing Models

Templates can be published under various licenses:

#### 8.1 Free Licenses

**PractoCore Community License (PCCL)**:
- Free to use, modify, and remix
- Attribution required
- Derivatives must use same license (copyleft)
- No commercial restrictions
- **Use Case**: Community-contributed templates

**Creative Commons Attribution (CC-BY)**:
- Free to use and modify
- Attribution required
- Derivatives can use different license
- **Use Case**: Educational templates

**Public Domain (CC0)**:
- No restrictions, no attribution required
- **Use Case**: Basic/generic templates

#### 8.2 Commercial Licenses

**Standard Commercial License**:
- One-time purchase per organization
- Use within organization only
- No redistribution
- Updates included for 1 year
- **Pricing**: $10 - $100 per template

**Extended Commercial License**:
- One-time purchase
- Use within organization + client matters
- Can modify but not redistribute
- Lifetime updates
- **Pricing**: $50 - $500 per template

**Enterprise License**:
- Unlimited users within organization
- Priority support from creator
- Custom modifications included (limited hours)
- Lifetime updates
- **Pricing**: $500 - $5,000 per template

**Subscription License**:
- Monthly/annual subscription
- Access to template + all updates
- Includes support
- Auto-cancel option
- **Pricing**: $5-50/month or $50-500/year

#### 8.3 Hybrid Models

**Freemium**:
- Basic version free (limited deadlines/features)
- Premium version with advanced conditionals, reminders
- **Use Case**: Popular templates with power-user features

**Pay-What-You-Want**:
- Minimum $0, suggested price displayed
- Community-driven pricing
- Creator receives 100% above platform fee
- **Use Case**: Community templates with optional donation

### Pricing Framework

```typescript
interface TemplatePricing {
  model: 'free' | 'one-time' | 'subscription' | 'freemium' | 'pwyw'

  // One-time pricing
  price?: number                      // USD cents (e.g., 9900 = $99.00)
  currency?: string                   // Default: 'USD'

  // Subscription pricing
  subscriptionPrice?: number          // Monthly price
  subscriptionInterval?: 'month' | 'year'

  // Freemium
  freeVersionId?: RecordIdString      // Reference to free variant
  premiumFeatures?: string[]          // What premium adds

  // Pay-what-you-want
  minimumPrice?: number               // Minimum (can be 0)
  suggestedPrice?: number             // Suggested amount

  // Discounts
  discounts?: Discount[]

  // License terms
  license: LicenseType
  licenseTerms?: string               // Custom terms (markdown)

  // Commercial use
  allowCommercialUse: boolean
  allowRedistribution: boolean
  requireAttribution: boolean
}

interface Discount {
  code?: string                       // Optional discount code
  percentage?: number                 // 0-100 (e.g., 20 = 20% off)
  fixedAmount?: number                // USD cents
  validFrom: ISODateString
  validUntil: ISODateString
  usageLimit?: number                 // Max redemptions
  usageCount: number                  // Current redemptions
}
```

### Revenue Sharing

**Platform Fee**:
- 15% of gross revenue for commercial templates
- 0% for free templates (PractoCore covers hosting/infrastructure)

**Creator Earnings**:
- 85% of sale price
- Paid monthly via Stripe Connect
- Minimum payout threshold: $50
- Dashboard shows: Revenue, Sales, Pending, Paid

**Organization Revenue**:
- Organizations can sell templates created by employees
- Revenue split configurable (default: 70% creator, 30% organization)
- Reported for tax purposes (1099 in USA)

### Payment Processing

**Integration**: Stripe for payments
- One-click purchase with saved payment method
- Support for: Credit/Debit cards, ACH, SEPA, international methods
- Automatic sales tax calculation (Stripe Tax)
- Invoicing for enterprise purchases

**Refund Policy**:
- 30-day money-back guarantee
- Full refund if template doesn't work as described
- Partial refund pro-rated for subscriptions
- Creator notified of refund with reason

### License Enforcement

**Technical Enforcement**:
- Usage tracking per license (e.g., max 1 org for standard license)
- Watermarking in exported templates (for paid templates)
- Audit logs for license compliance

**Honor System**:
- Attribution requirement relies on user compliance
- Copyright notice in template metadata
- DMCA takedown process for violations

**Dispute Resolution**:
- Users can report license violations
- Creator reviews alleged violation
- Platform mediates dispute
- Legal action as last resort

---

## 9. Search & Discovery

### Search Capabilities

#### 9.1 Full-Text Search

**Indexed Fields**:
- Template name (boosted 3x)
- Template description
- Tags
- Author name
- Organization name
- Review content
- Matter type

**Search Features**:
- Fuzzy matching for typos
- Synonym expansion ("summons" → "complaint", "petition")
- Stemming ("filing" matches "file", "filed", "files")
- Phrase search with quotes: `"notice of motion"`
- Boolean operators: `appeal AND california NOT criminal`

**Implementation**: PostgreSQL full-text search or Meilisearch integration

#### 9.2 Faceted Filtering

Users can filter by multiple criteria simultaneously:

**Filter Categories**:
- **Country**: Multi-select dropdown
- **State/Province**: Dependent on country selection
- **Court Level**: Checkboxes
- **Practice Area**: Hierarchical tree selection
- **Matter Type**: Auto-complete
- **Complexity**: Range slider (Beginner to Expert)
- **Rating**: Minimum rating (e.g., "4+ stars")
- **Price**: Free, Paid, Range slider
- **License**: Free, Commercial, Specific license type
- **Language**: Multi-select
- **Recency**: Created/Updated in last: 7 days, 30 days, 90 days, year
- **Verification**: Verified creators only
- **Features**: Has conditionals, Has reminders, Has fields

**Filter UI**:
- Collapsible filter panel on left side
- Active filters shown as chips with X to remove
- "Clear all filters" button
- Filter count badges (e.g., "California (47)")

#### 9.3 Advanced Search

Power users can access advanced search with:
- Query builder (visual)
- Saved searches
- Search within results
- Export search results (CSV with template IDs)

**Example Query**:
```
(Country = "United States" OR Country = "Canada")
AND Practice Area = "Civil Litigation"
AND Rating >= 4.0
AND Price <= $50
AND HasConditionals = true
```

#### 9.4 Sort Options

- **Relevance** (default for search queries)
- **Highest Rated** (overall rating desc)
- **Most Popular** (usage count desc)
- **Newest** (created date desc)
- **Recently Updated** (updated date desc)
- **Price: Low to High**
- **Price: High to Low**
- **Alphabetical** (A-Z, Z-A)

### Discovery Features

#### 9.5 Personalized Recommendations

**Algorithm Inputs**:
- User's jurisdiction (from profile)
- User's practice areas (from profile preferences)
- User's previously used templates
- User's organization's popular templates
- Templates saved/bookmarked by user

**Recommendation Types**:
- "Recommended for You" (homepage)
- "Lawyers in California also use..." (template detail)
- "Similar Templates" (based on category + tags)
- "Frequently Used Together" (templates often used in same matters)

**Implementation**:
- Collaborative filtering (users with similar usage patterns)
- Content-based filtering (metadata similarity)
- Hybrid approach with A/B testing

#### 9.6 Curated Collections

Marketplace curators and community create themed collections:

**Collection Types**:
- **Starter Kits**: "Essential Templates for Family Law"
- **Jurisdiction Packs**: "California Civil Litigation - Complete Set"
- **Specialty Collections**: "E-Discovery Workflows"
- **Trending**: "Most Popular This Month"
- **New Releases**: "Recently Published"
- **Editor's Choice**: "Best of Q4 2025"

**Collection Structure**:
```typescript
interface TemplateCollection {
  id: RecordIdString
  name: string
  description: string
  coverImage?: string
  curator: RecordIdString            // User who created collection
  templates: RecordIdString[]        // Ordered list of templates

  visibility: 'public' | 'private' | 'organization'
  featured: boolean                  // Homepage display
  category?: string                  // "Starter Kit", "Jurisdiction", etc.

  stats: {
    viewCount: number
    bookmarkCount: number
    useCount: number                 // How many matters created from collection
  }

  created: ISODateString
  updated: ISODateString
}
```

**User-Created Collections**:
- Users can create private collections (like playlists)
- Share collection URLs with colleagues
- Fork/duplicate public collections

#### 9.7 Browse by Category

Hierarchical browsing interface:

**Homepage Categories** (with icons):
- By Jurisdiction (map visualization)
- By Practice Area (icon grid)
- By Court Level (tiered list)
- By Popularity (trending, top-rated, most-used)
- By Creator (verified creators, top contributors)

**Category Pages**:
- Breadcrumb navigation
- Subcategory tiles
- Template grid view with filters
- Sort options
- Featured templates at top

#### 9.8 Template Preview

Before using/purchasing, users can preview:
- Full template structure (graph visualization)
- All deadlines and conditionals
- Fields required
- Sample workflow with test data
- Reminders configured
- Creator notes and documentation
- Reviews and ratings
- Usage statistics (if public)

**Try Before Buy**:
- Paid templates allow 1-time test run in sandbox
- Generates deadlines with dummy data
- Full functionality except saving to actual matter
- Limits abuse with rate limiting (1 preview per hour per template)

---

## 10. Template Lifecycle & Versioning

### Version Management

#### 10.1 Semantic Versioning

Templates follow semantic versioning: `MAJOR.MINOR.PATCH`

**Version Incrementing**:
- **MAJOR**: Breaking changes (field removal, deadline restructure)
- **MINOR**: New features (additional deadlines, new reminders)
- **PATCH**: Bug fixes (typo corrections, date calculation fixes)

**Auto-Detection**:
- System prompts creator to classify changes
- Suggests version increment based on diff analysis
- Creator can override

#### 10.2 Version History

```typescript
interface TemplateVersion {
  id: RecordIdString
  templateId: RecordIdString
  version: string                     // "1.0.0", "1.1.0", "2.0.0"

  // Snapshot of template at this version
  templateSnapshot: TemplateConfiguration

  // Metadata
  createdBy: RecordIdString
  createdAt: ISODateString
  changelog: string                   // Markdown description of changes

  // Status
  status: 'draft' | 'published' | 'deprecated'
  publishedAt?: ISODateString
  deprecatedAt?: ISODateString

  // Stats
  usageCount: number                  // Matters created with this version

  // Migration
  migrationGuide?: string             // For major version upgrades
  autoMigratable: boolean             // Can auto-upgrade from previous version
}
```

**Version Timeline**:
- Template detail page shows all published versions
- Users can view changelog between versions
- Users can download/clone specific version

#### 10.3 Version Migration

When a template has a major version update:

**Existing Matters**:
- Continue using their version of template (frozen snapshot)
- Notification: "New version available - [View Changes]"
- Option to upgrade matter to new template version:
  - Diff view shows changes
  - Confirms field compatibility
  - Applies migration (if auto-migratable)
  - Manual review required if breaking changes

**Saved Templates**:
- Personal clones don't auto-update
- Notification: "Template updated - [Review & Update]"
- Side-by-side comparison view
- One-click merge if no conflicts

**Organization Templates**:
- Template admin reviews update
- Approves migration for organization
- Rollout options: Immediate, Scheduled, Gradual

#### 10.4 Deprecation Workflow

**When to Deprecate**:
- Template superseded by newer version
- Jurisdiction law changes make template obsolete
- Creator discontinuing support

**Deprecation Process**:
1. Creator marks template as `deprecated`
2. Warning banner shown on template page
3. Suggested replacement template (if applicable)
4. Removed from search results (unless "Include deprecated" toggled)
5. Existing users receive notification
6. Grace period (e.g., 90 days) before archival

**Archived Templates**:
- Not visible in marketplace
- Accessible via direct URL (for historical reference)
- Read-only, cannot create new matters
- Existing matters continue to function

### Template Forking & Remixing

#### 10.5 Clone/Fork Functionality

Users can create personal copies of templates:

**Clone**:
- Creates exact copy in user's personal workspace
- Metadata copied: name (+ "Copy of"), description, structure
- Not linked to original (no sync)
- **Use Case**: Customize for specific matter, experiment

**Fork**:
- Creates copy with attribution to original
- Tracks relationship: `forkedFrom: RecordIdString`
- Can publish fork to marketplace (with attribution)
- Creator of fork can submit pull request to original (if allowed)
- **Use Case**: Improve community template, create variant

**Fork Policies** (set by original creator):
- `allowForking: true/false`
- `requireAttribution: true/false`
- `acceptPullRequests: true/false`

#### 10.6 Pull Requests (Collaborative Improvement)

For community templates, users can propose improvements:

**PR Workflow**:
1. User forks template
2. Makes improvements (adds deadline, fixes calculation)
3. Submits pull request to original creator
4. Creator reviews changes (diff view)
5. Creator can: Accept (merges changes), Reject (with reason), Request changes
6. If accepted, contributor credited in template metadata

**Contributor Credits**:
- Template shows "Contributors: [User1, User2, User3]"
- Contributor badge for accepted PRs
- Leaderboard for top contributors

---

## 11. Quality Assurance & Curation

### Quality Standards

#### 11.1 Automated Quality Checks

Before marketplace publication, templates must pass:

**Structural Validation**:
- ✓ At least 2 deadlines (beyond start date)
- ✓ All deadlines have names and prompts
- ✓ No circular dependencies
- ✓ All offset references valid
- ✓ All field references valid in conditions
- ✓ All conditional nodes have both paths defined

**Metadata Completeness**:
- ✓ Template name (3-100 characters)
- ✓ Description (min 50 characters, max 5000)
- ✓ Country selected
- ✓ Practice area selected
- ✓ Matter type specified
- ✓ At least 2 tags
- ✓ Language specified

**Content Quality**:
- ✓ No placeholder text ("Lorem ipsum", "TODO", "TBD")
- ✓ No profanity or inappropriate content
- ✓ Deadline names are descriptive (not "Deadline 1", "Deadline 2")
- ✓ Prompts are clear questions (ends with "?")

**Legal Compliance**:
- ✓ No confidential/proprietary information
- ✓ No personally identifiable information (PII)
- ✓ Creator confirms they have rights to publish

#### 11.2 Manual Curator Review

For featured/promoted templates, human curators verify:

**Accuracy Review**:
- Test template with sample matter data
- Verify deadlines calculate correctly
- Check against jurisdiction statutes/rules
- Confirm weekend/holiday handling accurate

**Usability Review**:
- Field labels clear and necessary
- Conditionals make sense
- Reminders appropriately timed
- Documentation helpful

**Categorization Review**:
- Assigned categories accurate
- Tags relevant
- Jurisdiction correctly specified
- Complexity rating appropriate

**Curation Decision**:
- **Approve**: Publish to marketplace
- **Approve with Edits**: Curator makes minor corrections, notifies creator
- **Request Changes**: Returns to creator with feedback
- **Reject**: Not suitable for marketplace (with reason)

#### 11.3 Community Quality Mechanisms

**Reporting**:
- Users can report templates for:
  - Inaccurate deadlines
  - Incorrect categorization
  - Inappropriate content
  - Copyright violation
  - Technical issues
- Reports reviewed by curators within 48 hours

**Quality Voting**:
- "Is this template accurate?" (Yes/No/Not Sure)
- Aggregated quality score displayed
- Low-quality templates de-ranked in search

**Template Badges**:
- **Verified**: Curator-reviewed for accuracy
- **Expert-Created**: Created by verified legal expert
- **Highly Rated**: 4.5+ stars with 20+ reviews
- **Popular**: Top 10% usage in category
- **Trending**: Rapidly growing usage
- **Updated Recently**: Modified within 30 days
- **Community Favorite**: High community quality votes

#### 11.4 Creator Reputation System

Creators build reputation through:
- Template ratings (weighted by usage)
- Review responses (helpfulness)
- Template usage counts
- Pull request contributions
- Community engagement

**Reputation Tiers**:
- **Contributor** (0-100 points): New creator
- **Trusted Creator** (100-500 points): Consistent quality
- **Expert Creator** (500-2000 points): High-quality, popular templates
- **Master Creator** (2000+ points): Top-tier contributor, mentor status

**Reputation Benefits**:
- Higher search ranking
- Featured creator badge
- Access to beta features
- Invitation to curator program
- Revenue share bonus (e.g., 90% instead of 85% for masters)

---

## 12. Analytics & Insights

### Creator Analytics Dashboard

#### 12.1 Template Performance Metrics

**Overview KPIs**:
- Total views (marketplace page views)
- Total uses (matters created from template)
- Total revenue (for paid templates)
- Average rating
- Review count
- Bookmark/save count

**Time-Series Charts**:
- Views over time (daily, weekly, monthly)
- Uses over time
- Revenue over time
- Rating trend

**Geographic Breakdown**:
- Map showing usage by country/state
- Top 5 jurisdictions using template

**User Insights**:
- User types: Individual vs Organization
- Organization sizes using template
- Practice areas of users (inferred from profile)

**Conversion Funnel**:
- Views → Previews → Uses → Purchases (for paid)
- Drop-off analysis

#### 12.2 Review Analytics

- Rating distribution (5-star histogram)
- Dimension breakdown (which aspect scores lowest)
- Review sentiment analysis (positive, neutral, negative)
- Common themes in reviews (extracted keywords)
- Response rate to reviews

#### 12.3 Version Analytics

- Usage by version (how many on v1.0 vs v2.0)
- Version upgrade rate
- Deprecation impact (usage decline)

#### 12.4 Competitive Benchmarking

- How template ranks in category (top 10%, top 25%, etc.)
- Comparison to category average (rating, usage, price)
- Similar templates performance

### Platform-Wide Analytics

#### 12.5 Marketplace Insights (Admin Dashboard)

**Marketplace Health**:
- Total templates
- Active templates (used in last 30 days)
- New templates (published in last 30 days)
- Template growth rate
- Geographic distribution (templates per country)

**User Engagement**:
- Searches per day
- Templates used per day
- Average session duration
- Return user rate

**Revenue Metrics**:
- Gross Merchandise Value (GMV)
- Revenue by category
- Average template price
- Top-earning creators
- Revenue share (platform vs creators)

**Quality Metrics**:
- Average template rating
- Review coverage (% templates with reviews)
- Curator approval rate
- Report resolution time

**Trends**:
- Fastest-growing categories
- Emerging jurisdictions
- Popular practice areas
- Seasonal patterns (e.g., tax deadlines spike in Q1)

#### 12.6 Organization Analytics

Organization admins see:
- Template usage across organization
- Most-used templates by team
- Internal vs marketplace template usage
- Template creation activity
- Compliance with org-approved templates
- Cost savings from templates (estimated time saved)

### User Analytics

#### 12.7 Personal Insights

Individual users see:
- Templates used (count, categories)
- Time saved (estimated based on deadlines created)
- Favorite categories
- Usage patterns (time of day, day of week)
- Bookmarked templates

---

## 13. Technical Implementation

### Architecture Overview

#### 13.1 Backend Enhancements (PocketBase)

**New Collections**:

1. **TemplateCategories**: Hierarchical category tree
2. **TemplateReviews**: User reviews and ratings
3. **TemplateLicenses**: License definitions and terms
4. **TemplatePurchases**: Purchase records for paid templates
5. **TemplateVersions**: Version history
6. **TemplateCollections**: Curated collections
7. **TemplateAnalytics**: Usage tracking
8. **TemplateReports**: User-reported issues
9. **CreatorProfiles**: Extended creator information
10. **TemplateACL**: Access control lists
11. **MarketplaceSettings**: Global marketplace configuration

**Custom API Routes** (PocketBase hooks):

- `POST /api/templates/publish` - Publish template to marketplace
- `GET /api/templates/search` - Advanced search endpoint
- `POST /api/templates/purchase` - Process template purchase
- `GET /api/templates/{id}/versions` - Get version history
- `POST /api/templates/{id}/fork` - Fork template
- `POST /api/templates/{id}/review` - Submit review
- `GET /api/marketplace/recommendations` - Personalized recommendations
- `GET /api/creator/{id}/analytics` - Creator dashboard data
- `POST /api/curator/approve` - Curator approval workflow

**Real-Time Subscriptions**:
- Subscribe to template updates (existing)
- Subscribe to review updates (new)
- Subscribe to marketplace featured templates (new)
- Subscribe to organization template changes (new)

#### 13.2 Search Infrastructure

**Option 1: PostgreSQL Full-Text Search** (if migrating from SQLite)
- Built-in full-text search capabilities
- GIN indexes for performance
- Supports complex queries, ranking

**Option 2: Meilisearch Integration**
- Dedicated search engine (open-source)
- Lightning-fast typo-tolerant search
- Faceted filtering out-of-the-box
- Hosted or self-hosted
- Sync via PocketBase hooks

**Option 3: Algolia** (SaaS)
- Fully managed search service
- Advanced features: personalization, A/B testing
- Higher cost
- External dependency

**Recommendation**: Meilisearch for balance of features, performance, and cost.

**Implementation**:
- PocketBase hook syncs template changes to Meilisearch
- Frontend queries Meilisearch API directly (with API key scoping)
- Fallback to PocketBase if Meilisearch unavailable

#### 13.3 Payment Processing

**Stripe Integration**:

**Stripe Products**:
- Each paid template = Stripe Product
- Variants (one-time, subscription) = Stripe Prices
- Automatic tax calculation via Stripe Tax

**Checkout Flow**:
1. User clicks "Purchase"
2. Frontend calls `/api/templates/purchase`
3. Backend creates Stripe Checkout Session
4. User redirected to Stripe-hosted checkout
5. On success, redirected back with session ID
6. Backend webhook receives `checkout.session.completed`
7. Creates `TemplatePurchase` record
8. Adds template to user's library

**Stripe Connect** (for creator payouts):
- Creators onboard via Stripe Connect Express
- Platform automatically splits payment (85% creator, 15% platform)
- Creators manage payouts via Stripe dashboard

**Subscription Management**:
- Stripe handles recurring billing
- Webhook `customer.subscription.deleted` removes access
- Frontend displays subscription status

#### 13.4 Permission System

**PocketBase Rules** (enhanced):

```javascript
// DeadlineTemplates collection rules
{
  "listRule": "@request.auth.id != '' && (
    // Public marketplace templates
    (isPublic = true && status = 'marketplace-global') ||

    // Organization templates
    (organisation = @request.auth.organisation && status ~ 'org-active|team-active') ||

    // User's own templates
    (author = @request.auth.id) ||

    // ACL-based access
    (@request.auth.id ?~ acl.viewers ||
     @request.auth.id ?~ acl.editors ||
     @request.auth.team ?~ acl.teams)
  )",

  "viewRule": "/* same as listRule */",

  "createRule": "@request.auth.id != '' && (
    @request.auth.canCreateTemplates = true ||
    @request.auth.role ?~ 'template_creator|admin'
  )",

  "updateRule": "@request.auth.id != '' && (
    // Owner
    author = @request.auth.id ||

    // Editor in ACL
    @request.auth.id ?~ acl.editors ||

    // Organization admin (for org templates)
    (@request.auth.role ?~ 'org_admin' &&
     organisation = @request.auth.organisation)
  )",

  "deleteRule": "author = @request.auth.id"
}
```

**ACL Middleware** (custom validation):
- Checks if user purchase paid template before allowing use
- Enforces license limits (e.g., 1 organization for standard license)
- Logs access for audit trail

#### 13.5 Caching Strategy

**Cache Layers**:

1. **Frontend (Pinia Store)**:
   - 5-minute TTL for template lists
   - Individual template cache (invalidate on update)
   - Search results cache (short 1-min TTL)

2. **Backend (Redis or PocketBase built-in)**:
   - Marketplace featured templates (15-min TTL)
   - Category counts (10-min TTL)
   - User permissions (5-min TTL, invalidate on role change)
   - Search results (1-min TTL)

3. **CDN (Cloudflare or similar)**:
   - Static template assets (images, icons)
   - Template JSON exports (for downloads)
   - Category pages (5-min TTL)

**Cache Invalidation**:
- On template update: Clear template cache + list caches containing template
- On review: Clear template cache (rating changed)
- On publication: Clear category cache, featured cache
- Use cache tags for targeted invalidation

#### 13.6 Rate Limiting

**API Endpoints**:
- Search: 60 requests/min per user
- Template creation: 10/hour per user
- Review submission: 5/hour per user
- Template preview: 20/hour per user (to prevent abuse)

**Stripe Webhook**:
- Verify webhook signature to prevent spoofing

#### 13.7 Monitoring & Observability

**Metrics** (Prometheus + Grafana or similar):
- Template usage events (created, used, purchased)
- Search query latency
- Payment success/failure rates
- Curator approval queue length
- Error rates by endpoint

**Logging**:
- Template publication audit log
- Purchase transaction log
- Permission denied events (investigate abuse)
- Search analytics (popular queries, zero-result queries)

**Alerts**:
- Spike in template reports (potential quality issue)
- Payment failure spike
- Search latency degradation
- Error rate > 5%

---

## 14. Database Schema Design

### New Collections

#### 14.1 TemplateCategories

```typescript
{
  id: RecordIdString
  name: string                        // "Civil Litigation"
  slug: string                        // "civil-litigation" (URL-friendly)
  type: 'geographic' | 'practice_area' | 'court_level' | 'template_type'
  parent?: RecordIdString             // For hierarchical categories
  level: number                       // 0 = top-level, 1 = subcategory, etc.
  icon?: string                       // Icon name or URL
  description?: string
  order: number                       // Display order
  templateCount: number               // Cached count (updated daily)
}

// Indexes: slug, parent, type
```

#### 14.2 TemplateReviews

```typescript
{
  id: RecordIdString
  template: RecordIdString            // FK: DeadlineTemplates
  reviewer: RecordIdString            // FK: Users

  // Ratings (1-5)
  ratingAccuracy: number
  ratingCompleteness: number
  ratingEaseOfUse: number
  ratingCustomizability: number
  ratingDocumentation: number
  ratingOverall: number               // Calculated

  // Content
  title: string
  content: string                     // Markdown
  usedFor?: string
  jurisdiction?: string
  reviewerExperience: 'beginner' | 'intermediate' | 'advanced' | 'expert'

  // Verification
  verified: boolean                   // Verified lawyer
  purchaseVerified: boolean           // Paid template buyer

  // Engagement
  helpfulVotes: number
  unhelpfulVotes: number
  reportCount: number

  // Creator response
  creatorResponse?: string
  creatorRespondedAt?: ISODateString

  // Moderation
  status: 'published' | 'pending' | 'flagged' | 'removed'
  moderatedBy?: RecordIdString
  moderatedAt?: ISODateString

  created: ISODateString
  updated: ISODateString
}

// Indexes: template, reviewer, ratingOverall (desc), created (desc)
// Unique: (template, reviewer) - one review per user per template
```

#### 14.3 TemplateLicenses

```typescript
{
  id: RecordIdString
  name: string                        // "Standard Commercial License"
  shortName: string                   // "Commercial"
  type: 'free' | 'commercial' | 'subscription'

  // Terms
  termsMarkdown: string               // Full license text
  summary: string                     // Short description

  // Permissions
  allowCommercialUse: boolean
  allowRedistribution: boolean
  allowModification: boolean
  requireAttribution: boolean

  // Restrictions
  maxOrganizations?: number           // null = unlimited
  maxUsers?: number
  geoRestrictions?: string[]          // Countries where not allowed

  // For predefined licenses only
  isPredefined: boolean               // PCCL, CC-BY, etc.
  officialUrl?: string                // Link to official license

  created: ISODateString
}

// Seed data: PCCL, CC-BY, CC0, Standard Commercial, Enterprise
```

#### 14.4 TemplatePurchases

```typescript
{
  id: RecordIdString
  template: RecordIdString            // FK: DeadlineTemplates
  buyer: RecordIdString               // FK: Users
  organisation?: RecordIdString       // FK: Organisations (if org purchase)

  // Purchase details
  purchaseType: 'one-time' | 'subscription'
  amount: number                      // USD cents
  currency: string                    // 'USD'

  // Stripe
  stripeCheckoutSessionId: string
  stripePaymentIntentId: string
  stripeCustomerId: string
  stripeSubscriptionId?: string       // For subscriptions

  // License
  license: RecordIdString             // FK: TemplateLicenses
  licenseTermsSnapshot: string        // Snapshot of license at purchase time

  // Status
  status: 'completed' | 'refunded' | 'cancelled'
  refundedAt?: ISODateString
  refundReason?: string
  cancelledAt?: ISODateString

  // Subscription (if applicable)
  subscriptionStatus?: 'active' | 'past_due' | 'cancelled' | 'unpaid'
  subscriptionCurrentPeriodEnd?: ISODateString

  created: ISODateString              // Purchase date
}

// Indexes: template, buyer, organisation, status
// Unique: (buyer, template) for one-time purchases
```

#### 14.5 TemplateVersions

```typescript
{
  id: RecordIdString
  template: RecordIdString            // FK: DeadlineTemplates
  version: string                     // "1.2.3"

  // Snapshot
  templateSnapshot: JSON              // Full template configuration at this version
  metadataSnapshot: JSON              // Name, description, tags, etc.

  // Changes
  changelog: string                   // Markdown
  changeType: 'major' | 'minor' | 'patch'

  // Migration
  migrationGuide?: string
  autoMigratable: boolean
  migratesFrom?: RecordIdString[]     // Version IDs this can migrate from

  // Status
  status: 'draft' | 'published' | 'deprecated'
  publishedAt?: ISODateString
  deprecatedAt?: ISODateString

  // Creator
  createdBy: RecordIdString           // FK: Users
  created: ISODateString

  // Usage
  usageCount: number                  // Matters created with this version
}

// Indexes: template, version, publishedAt (desc)
```

#### 14.6 TemplateCollections

```typescript
{
  id: RecordIdString
  name: string
  slug: string                        // URL-friendly
  description: string                 // Markdown
  coverImage?: string                 // URL

  // Templates
  templates: RecordIdString[]         // Array of template IDs (ordered)

  // Creator/Curator
  curator: RecordIdString             // FK: Users
  curatorType: 'platform' | 'community' | 'organization'
  organisation?: RecordIdString       // If org collection

  // Visibility
  visibility: 'public' | 'private' | 'organization'
  featured: boolean
  featuredUntil?: ISODateString

  // Categorization
  category?: string                   // "Starter Kit", "Jurisdiction Pack"
  tags: string[]

  // Stats
  viewCount: number
  bookmarkCount: number
  useCount: number

  created: ISODateString
  updated: ISODateString
}

// Indexes: curator, slug, featured, visibility
```

#### 14.7 TemplateAnalytics

```typescript
{
  id: RecordIdString
  template: RecordIdString            // FK: DeadlineTemplates
  date: ISODateString                 // YYYY-MM-DD (daily aggregation)

  // Metrics
  viewCount: number
  previewCount: number
  useCount: number                    // Matters created
  bookmarkCount: number
  purchaseCount: number               // For paid templates
  revenue: number                     // USD cents

  // Demographics
  viewsByCountry: JSON                // {"US": 50, "CA": 20, ...}
  viewsByState: JSON
  usesByOrganisationType: JSON        // {"small": 10, "medium": 5, "enterprise": 2}

  created: ISODateString              // When record created (usually daily batch job)
}

// Indexes: (template, date), date (desc)
// Unique: (template, date)
```

#### 14.8 TemplateReports

```typescript
{
  id: RecordIdString
  template: RecordIdString            // FK: DeadlineTemplates
  reporter: RecordIdString            // FK: Users

  // Report details
  reason: 'inaccurate' | 'miscategorized' | 'inappropriate' | 'copyright' | 'technical' | 'other'
  description: string

  // Status
  status: 'pending' | 'investigating' | 'resolved' | 'dismissed'

  // Resolution
  resolvedBy?: RecordIdString         // FK: Users (curator)
  resolvedAt?: ISODateString
  resolutionNotes?: string
  actionTaken?: 'corrected' | 'removed' | 'no_action' | 'contacted_creator'

  // Notifications
  reporterNotified: boolean
  creatorNotified: boolean

  created: ISODateString
}

// Indexes: template, status, created (desc)
```

#### 14.9 CreatorProfiles

```typescript
{
  id: RecordIdString
  user: RecordIdString                // FK: Users (one-to-one)

  // Professional info
  barNumber?: string                  // Lawyer bar registration
  barState?: string
  barVerified: boolean
  verifiedAt?: ISODateString

  // Bio
  bio?: string                        // Markdown
  expertise: string[]                 // Practice areas
  website?: string
  linkedin?: string

  // Creator stats
  templateCount: number
  totalUses: number
  averageRating: number
  reviewCount: number
  followerCount: number

  // Reputation
  reputationPoints: number
  reputationTier: 'contributor' | 'trusted' | 'expert' | 'master'
  badges: string[]                    // ["verified", "top_contributor", "expert_creator"]

  // Monetization (Stripe)
  stripeConnectAccountId?: string
  stripeOnboarded: boolean
  payoutsEnabled: boolean

  // Preferences
  acceptPullRequests: boolean
  publicEmail?: string                // For template support

  created: ISODateString
  updated: ISODateString
}

// Indexes: user (unique), barNumber, reputationTier
```

#### 14.10 TemplateACL

```typescript
{
  id: RecordIdString
  template: RecordIdString            // FK: DeadlineTemplates

  // Users
  viewers: RecordIdString[]           // FK: Users[]
  editors: RecordIdString[]
  admins: RecordIdString[]

  // Teams/Organizations
  viewerTeams: RecordIdString[]       // FK: Teams[]
  editorTeams: RecordIdString[]

  // Metadata
  inheritFromOrg: boolean             // Inherit org-level permissions

  updated: ISODateString
}

// Indexes: template (unique)
```

#### 14.11 MarketplaceSettings

```typescript
{
  id: RecordIdString                  // Singleton (only one record)

  // Platform fees
  platformFeePercentage: number       // 15 (means 15%)

  // Creator payouts
  minimumPayoutAmount: number         // USD cents (e.g., 5000 = $50)
  payoutSchedule: 'daily' | 'weekly' | 'monthly'

  // Quality thresholds
  minRatingForFeatured: number        // 4.5
  minReviewsForFeatured: number       // 20
  minUsageForFeatured: number         // 100

  // Curation
  requireCuratorApproval: boolean     // For marketplace publication
  autoApproveThreshold?: number       // Auto-approve if creator reputation >= X

  // Search
  defaultSearchRadius: number         // Miles/km for location-based search
  maxSearchResults: number            // 100

  // Features
  enableMonetization: boolean
  enableCollections: boolean
  enableReviews: boolean

  updated: ISODateString
}
```

### Modified Collections

#### 14.12 DeadlineTemplates (Enhanced)

Add new fields to existing collection:

```typescript
{
  // Existing fields...
  id: RecordIdString
  name: string
  description: HTMLString
  version: string
  author: RecordIdString
  organisation?: RecordIdString
  template: JSON

  // NEW FIELDS:

  // Categorization
  country: RecordIdString              // FK: TemplateCategories
  stateProvince?: RecordIdString       // FK: TemplateCategories
  courtLevel: RecordIdString           // FK: TemplateCategories
  practiceArea: RecordIdString         // FK: TemplateCategories
  matterType: string
  complexity: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  language: string                     // ISO code: 'en', 'es', 'fr'
  tags: string[]                       // Array instead of comma-separated

  // Visibility & scoping
  scope: 'personal' | 'team' | 'organization' | 'regional' | 'global'
  teams?: RecordIdString[]             // FK: Teams[] (if scope = 'team')
  regions?: string[]                   // Country codes (if scope = 'regional')

  // Status
  status: 'draft' | 'private' | 'pending-review' | 'team-active' | 'org-active' |
          'marketplace-regional' | 'marketplace-global' | 'marketplace-featured' |
          'deprecated' | 'archived'

  // Marketplace
  marketplaceListing?: {
    featured: boolean
    featuredUntil?: ISODateString
    curatorNotes?: string
    approvedBy?: RecordIdString
    approvedAt?: ISODateString
    rejectionReason?: string
  }

  // Licensing & pricing
  license: RecordIdString              // FK: TemplateLicenses
  pricing?: {
    model: 'free' | 'one-time' | 'subscription' | 'freemium' | 'pwyw'
    price?: number                     // USD cents
    currency?: string
    subscriptionPrice?: number
    subscriptionInterval?: 'month' | 'year'
    minimumPrice?: number              // For PWYW
    suggestedPrice?: number
  }

  // Permissions
  allowCloning: boolean
  allowRemixing: boolean
  allowPullRequests: boolean
  requireAttribution: boolean

  // Version management
  currentVersion: string               // "2.1.0"
  latestVersionId: RecordIdString      // FK: TemplateVersions
  forkedFrom?: RecordIdString          // FK: DeadlineTemplates (if fork)

  // Analytics (cached, updated daily)
  stats: {
    viewCount: number
    useCount: number
    purchaseCount: number
    bookmarkCount: number
    averageRating: number
    reviewCount: number
  }

  // Quality
  qualityScore: number                 // 0-100 (algorithm-based)
  verifiedAccurate: boolean            // Curator verified

  // Existing fields...
  created: ISODateString
  updated: ISODateString
}
```

**Indexes**:
- country, stateProvince, practiceArea, courtLevel
- scope, status
- (scope, status, averageRating DESC, useCount DESC) - for marketplace queries
- author, organisation
- forkedFrom
- tags (if DB supports array indexing)

---

## 15. API Design

### REST Endpoints

#### 15.1 Template CRUD (Enhanced)

**GET /api/collections/DeadlineTemplates/records**
- Enhanced filtering: `?country={id}&practiceArea={id}&complexity=intermediate`
- Sorting: `?sort=-stats.averageRating,-stats.useCount`
- Scoping: Auto-filters based on user permissions

**GET /api/collections/DeadlineTemplates/records/{id}**
- Expands: `author`, `country`, `practiceArea`, `license`, `organisation`
- Returns: Full template + ACL (if user has permission)

**POST /api/collections/DeadlineTemplates/records**
- Validates: Required categorization fields
- Sets: `author` to current user, `status` to 'draft'

**PATCH /api/collections/DeadlineTemplates/records/{id}**
- Permission check: User must be owner/editor
- Version bump: Auto-increments version if template structure changes
- Analytics: Logs edit event

**DELETE /api/collections/DeadlineTemplates/records/{id}**
- Soft delete: Sets `status` to 'archived'
- Cleanup: Schedules hard delete after 90 days

#### 15.2 Marketplace Endpoints

**GET /api/marketplace/templates**
Search and browse marketplace templates.

**Query Parameters**:
- `q`: Search query (string)
- `country`: Country ID or code
- `state`: State/province ID
- `practiceArea`: Practice area ID
- `complexity`: Complexity level
- `rating`: Minimum rating (1-5)
- `priceMin`, `priceMax`: Price range (cents)
- `license`: License type
- `verified`: Boolean (verified creators only)
- `featured`: Boolean (featured templates only)
- `sort`: Sort field (-stats.averageRating, -stats.useCount, -created, price)
- `page`, `perPage`: Pagination

**Response**:
```json
{
  "items": [
    {
      "id": "abc123",
      "name": "California Civil Summons",
      "description": "...",
      "author": {
        "id": "user123",
        "name": "John Doe",
        "verified": true
      },
      "category": {
        "country": "United States",
        "state": "California",
        "practiceArea": "Civil Litigation"
      },
      "stats": {
        "averageRating": 4.8,
        "reviewCount": 45,
        "useCount": 1200
      },
      "pricing": {
        "model": "free"
      },
      "badges": ["verified", "highly_rated"]
    }
  ],
  "page": 1,
  "perPage": 20,
  "totalItems": 156,
  "totalPages": 8
}
```

**GET /api/marketplace/templates/{id}**
Get full template details for marketplace listing.

**Includes**:
- Template structure (if user has access)
- Reviews (paginated)
- Version history
- Related templates
- Creator profile

**POST /api/marketplace/templates/{id}/preview**
Generate preview with test data.

**Request Body**:
```json
{
  "startDate": "2025-12-01",
  "fieldValues": {
    "defendant_type": "government"
  }
}
```

**Response**:
```json
{
  "deadlines": [
    {
      "id": "d_001",
      "name": "File Defence",
      "date": "2026-01-01",
      "description": "...",
      "reminders": [...]
    }
  ]
}
```

#### 15.3 Purchase Endpoints

**POST /api/marketplace/purchase**
Initiate template purchase.

**Request Body**:
```json
{
  "templateId": "abc123",
  "purchaseFor": "user",              // "user" or "organization"
  "organisationId": "org123"          // Required if purchaseFor = "organization"
}
```

**Response**:
```json
{
  "checkoutUrl": "https://checkout.stripe.com/...",
  "sessionId": "cs_test_..."
}
```

User is redirected to Stripe Checkout. On completion, Stripe webhook creates TemplatePurchase record.

**GET /api/marketplace/purchases**
List user's purchases (for "My Templates" library).

**GET /api/marketplace/purchases/{id}/invoice**
Download invoice for purchase (PDF).

#### 15.4 Review Endpoints

**POST /api/templates/{id}/reviews**
Submit review.

**Request Body**:
```json
{
  "ratingAccuracy": 5,
  "ratingCompleteness": 4,
  "ratingEaseOfUse": 5,
  "ratingCustomizability": 4,
  "ratingDocumentation": 5,
  "title": "Excellent template for routine cases",
  "content": "I've used this template for 10+ cases...",
  "usedFor": "Medical malpractice defense",
  "jurisdiction": "California",
  "experience": "advanced"
}
```

**Validation**:
- User must have used template (created matter from it)
- One review per user per template
- If updating, replaces existing review

**GET /api/templates/{id}/reviews**
Get reviews for template.

**Query Parameters**:
- `sort`: -ratingOverall, -created, -helpfulVotes
- `filter`: verified (verified lawyers only), purchaseVerified
- `page`, `perPage`

**PATCH /api/reviews/{id}/helpful**
Vote review as helpful.

**POST /api/reviews/{id}/report**
Report inappropriate review.

**POST /api/reviews/{id}/respond**
Creator responds to review (only template author).

#### 15.5 Versioning Endpoints

**GET /api/templates/{id}/versions**
Get version history.

**Response**:
```json
{
  "versions": [
    {
      "id": "ver123",
      "version": "2.0.0",
      "changelog": "Major update: Added discovery deadlines",
      "publishedAt": "2025-10-15T10:30:00Z",
      "usageCount": 45,
      "status": "published"
    },
    {
      "id": "ver122",
      "version": "1.2.3",
      "changelog": "Fixed date calculation for weekends",
      "publishedAt": "2025-09-20T14:00:00Z",
      "usageCount": 230,
      "status": "deprecated"
    }
  ]
}
```

**POST /api/templates/{id}/versions**
Create new version.

**Request Body**:
```json
{
  "version": "2.1.0",
  "changelog": "Added reminder for status conference",
  "changeType": "minor",
  "autoMigratable": true
}
```

**GET /api/templates/{id}/versions/{versionId}/diff**
Compare two versions (visual diff).

**POST /api/matters/{matterId}/upgrade-template**
Upgrade matter to newer template version.

**Request Body**:
```json
{
  "targetVersionId": "ver124"
}
```

Applies migration, returns updated deadlines.

#### 15.6 Fork & Remix Endpoints

**POST /api/templates/{id}/fork**
Fork template to user's workspace.

**Request Body**:
```json
{
  "name": "My Custom Summons Template",
  "visibility": "personal"            // "personal", "team", "organization"
}
```

**Response**: New template record (forked copy).

**POST /api/templates/{id}/pull-request**
Submit pull request to original template.

**Request Body**:
```json
{
  "forkedTemplateId": "fork123",
  "title": "Added deadline for reply to motion",
  "description": "This PR adds...",
  "changelog": "Added 'Reply to Motion' deadline with 14-day offset"
}
```

Creator of original template receives notification.

**GET /api/templates/{id}/pull-requests**
List PRs for template (owner only).

**PATCH /api/pull-requests/{id}**
Accept or reject PR.

**Request Body**:
```json
{
  "action": "accept",                 // "accept" or "reject"
  "message": "Thanks! This is a great addition."
}
```

#### 15.7 Collections Endpoints

**GET /api/collections**
Browse template collections.

**Query Parameters**:
- `category`: "starter_kit", "jurisdiction", etc.
- `curator`: User ID
- `featured`: Boolean
- `page`, `perPage`

**GET /api/collections/{id}**
Get collection details + templates.

**POST /api/collections**
Create collection (user or curator).

**Request Body**:
```json
{
  "name": "Essential Family Law Templates",
  "description": "10 must-have templates for family law practice",
  "templates": ["template1", "template2", "template3"],
  "visibility": "public"
}
```

**PATCH /api/collections/{id}**
Update collection (add/remove templates, change order).

#### 15.8 Analytics Endpoints

**GET /api/creator/analytics**
Creator dashboard analytics.

**Query Parameters**:
- `templateId`: Specific template (optional, defaults to all creator's templates)
- `startDate`, `endDate`: Date range

**Response**:
```json
{
  "overview": {
    "totalViews": 1250,
    "totalUses": 340,
    "totalRevenue": 125000,          // USD cents
    "averageRating": 4.7,
    "reviewCount": 28
  },
  "timeSeries": {
    "views": [
      {"date": "2025-11-01", "count": 45},
      {"date": "2025-11-02", "count": 52}
    ],
    "uses": [...],
    "revenue": [...]
  },
  "geographic": {
    "countries": [
      {"country": "US", "uses": 200},
      {"country": "CA", "uses": 80}
    ],
    "states": [...]
  },
  "conversionFunnel": {
    "views": 1250,
    "previews": 450,
    "uses": 340,
    "purchases": 85                  // For paid templates
  }
}
```

**GET /api/admin/marketplace/analytics**
Platform-wide analytics (admin only).

**Includes**:
- Total templates, users, purchases
- Revenue trends
- Popular categories
- Creator leaderboard
- Quality metrics

#### 15.9 Curation Endpoints

**GET /api/curator/queue**
Templates pending review (curator only).

**Response**:
```json
{
  "pending": [
    {
      "id": "template123",
      "name": "...",
      "author": {...},
      "submittedAt": "2025-11-12T10:00:00Z",
      "category": {...},
      "qualityChecks": {
        "structuralValidation": "passed",
        "metadataCompleteness": "passed",
        "contentQuality": "warning"
      }
    }
  ]
}
```

**POST /api/curator/approve**
Approve template for marketplace.

**Request Body**:
```json
{
  "templateId": "template123",
  "action": "approve",                // "approve", "request_changes", "reject"
  "curatorNotes": "Great template, approved for publication",
  "featured": false,
  "edits": {                          // Optional curator edits
    "tags": ["civil", "california", "summons"],
    "complexity": "intermediate"
  }
}
```

**POST /api/curator/feature**
Feature template on marketplace homepage.

**Request Body**:
```json
{
  "templateId": "template123",
  "featuredUntil": "2025-12-31T23:59:59Z"  // Auto-unfeature after date
}
```

---

## 16. UI/UX Recommendations

### Marketplace Homepage

**Hero Section**:
- Search bar: "Search 10,000+ deadline templates..."
- Quick filters: Country dropdown, Practice Area dropdown, "Free Templates" toggle
- Call-to-action: "Browse Templates" button

**Featured Section**:
- Carousel of 5-10 featured templates
- Cards show: Name, Rating, Usage count, Badge, Thumbnail
- Auto-rotates every 5 seconds

**Categories Grid**:
- Visual tiles for each practice area (icon + name + template count)
- Click to browse category

**Trending & New**:
- Two columns: "Trending This Week" | "New Arrivals"
- Each shows 5 templates with rating and use count

**Collections**:
- Curated collections carousel
- "Starter Kits", "Jurisdiction Packs", "Editor's Choice"

**Creator Spotlight**:
- Featured creator of the month
- Photo, bio snippet, top templates

### Search Results Page

**Layout**: Filter panel (left) + Results grid (center) + Sort/view toggle (top right)

**Filter Panel** (collapsible on mobile):
- Search within results input
- Category filters (expandable sections):
  - Geographic (country → state)
  - Practice Area (tree view)
  - Court Level (checkboxes)
  - Complexity (range slider)
  - Rating (star buttons)
  - Price (range slider + "Free only" toggle)
  - License type (checkboxes)
  - Features (Has conditionals, Has reminders, etc.)
- Active filters chips at top with "Clear all"

**Results Grid**:
- Card layout (default) or List layout toggle
- Each card shows:
  - Template name (bold, clickable)
  - Creator name + verification badge
  - Star rating + review count
  - Usage count icon
  - Price (or "Free" badge)
  - Complexity badge
  - Jurisdiction tags
  - Quick preview button
  - "Use Template" or "Purchase" button
  - Bookmark icon
- Infinite scroll or pagination (configurable)

**Sort Dropdown**:
- Relevance (default for search)
- Highest Rated
- Most Popular
- Newest
- Recently Updated
- Price: Low to High
- Price: High to Low

### Template Detail Page

**Header**:
- Template name (large)
- Creator name + avatar + verification badge + "Follow" button
- Star rating (large) + review count
- Tags (clickable)
- Bookmark button + Share button

**Tabs**:
1. **Overview**:
   - Description (markdown)
   - Key Features (bullet points)
   - Included Deadlines (expandable list)
   - Customization Fields
   - Reminders configured
   - Jurisdiction applicability

2. **Preview**:
   - Interactive template graph (Vue-Flow visualization)
   - Sample data form: "Try with your own dates"
   - Generated deadline timeline preview

3. **Reviews** ({count}):
   - Rating breakdown (5-star histogram)
   - Dimension ratings (Accuracy, Completeness, etc.)
   - Sort: Most Helpful, Newest, Highest/Lowest Rating
   - Filter: Verified only, Purchase verified
   - Each review card shows:
     - Reviewer name + verification badges
     - Star rating
     - Review title (bold)
     - Review content (expandable)
     - Used for, Jurisdiction, Experience
     - Helpful button (count)
     - Report button
     - Creator response (if exists, indented)
   - "Write a Review" button (if user has used template)

4. **Versions**:
   - Timeline of versions
   - Each version: Version number, Date, Changelog, Usage count
   - "View this version" link
   - Diff view between versions

5. **Details**:
   - License information (full terms, expandable)
   - Category (with breadcrumb links)
   - Complexity level
   - Language
   - Creation date, Last updated
   - Usage statistics (if public)
   - Forked from (if applicable)
   - Related templates (similar category/tags)

**Sidebar** (sticky on scroll):
- Price (large) or "Free" badge
- "Purchase" or "Use Template" button (primary CTA)
- "Preview Template" button (secondary)
- "Clone to My Workspace" button (for customization)
- Quick stats:
  - 4.8★ rating (45 reviews)
  - 1,200 lawyers use this
  - Updated 2 days ago
- Created by: [Author card with avatar, name, badge]
- License: [License name with icon]

**Below Tabs**:
- "Related Templates" carousel
- "Frequently Used Together" section

### Template Editor (Enhanced)

**Top Bar**:
- Template name (editable inline)
- Version indicator
- Auto-save status
- "Preview" button
- "Publish" dropdown (Save Draft, Publish to Team, Publish to Org, Submit to Marketplace)
- Undo/Redo buttons
- Settings dropdown

**Left Panel** (collapsible):
- Tree view of deadlines (existing)
- Add: Add Field button
- Add: Add Conditional button
- Search deadlines input

**Center Canvas**:
- Graph visualization (existing)
- Zoom controls
- Minimap
- Node selection highlights

**Right Panel** (collapsible):
- When node selected: Deadline/Conditional editor (existing)
- When no selection: Template metadata form:
  - Name, Description
  - **NEW**: Category selectors (Country, State, Practice Area, Court Level, Matter Type)
  - **NEW**: Tags input (auto-suggest)
  - **NEW**: Complexity (auto-calculated, can override)
  - **NEW**: License dropdown
  - **NEW**: Pricing configuration (if monetization enabled)
  - **NEW**: Visibility/scoping radio buttons
  - **NEW**: Permissions toggles (Allow cloning, Allow remixing, etc.)

**Bottom Bar**:
- Validation errors (if any, red banner)
- Warnings (yellow banner)
- Node count, Field count, Conditional count

### My Templates Library

**Tabs**:
1. **My Created Templates**: Templates user authored
2. **Purchased**: Paid templates user bought
3. **Bookmarked**: Templates user saved
4. **Org Templates**: Organization's templates (if applicable)
5. **Drafts**: Unpublished work in progress

**View Options**:
- Grid or List view toggle
- Sort: Recently used, Recently created, Alphabetical, Rating
- Search within library

**Batch Actions**:
- Multi-select templates
- Bulk delete, Bulk move to folder, Bulk share

**Folders** (left sidebar):
- User-created folders for organization
- Drag-and-drop templates to folders

### Creator Dashboard

**Overview Tab**:
- KPI cards: Total Views, Total Uses, Total Revenue, Avg Rating
- Time-series chart: Views/Uses over time (selectable date range)
- Top 5 templates table (by usage or revenue)

**Templates Tab**:
- List of creator's templates
- Columns: Name, Status, Rating, Reviews, Uses, Revenue
- Quick actions: Edit, View Analytics, Manage Reviews

**Reviews Tab**:
- All reviews across all templates
- Filter by template, rating, needs response
- Respond inline

**Analytics Tab**:
- Deep-dive charts:
  - Geographic distribution (map + table)
  - Usage by organization type
  - Conversion funnel
  - Revenue trends
- Export data (CSV)

**Earnings Tab** (if monetization enabled):
- Revenue summary (Gross, Platform Fee, Net)
- Payout history table
- Stripe Connect integration (view payouts, update bank info)
- Tax documents (1099 download)

**Settings Tab**:
- Creator profile (bio, expertise, social links)
- Notification preferences (new reviews, purchases, PRs)
- Default template settings (license, pricing, permissions)

### Admin/Curator Dashboard

**Queue Tab**:
- Templates pending approval (table)
- Columns: Template Name, Author, Submitted Date, Category, Quality Score
- Click to open review modal

**Review Modal**:
- Template preview (full structure)
- Metadata form (editable by curator)
- Quality checklist (auto-checks + manual)
- Test with sample data button
- Approve/Request Changes/Reject buttons with notes field

**Featured Tab**:
- Drag-and-drop to reorder featured templates
- Set feature expiration dates
- Preview how homepage looks

**Reports Tab**:
- User-reported templates/reviews
- Status: Pending, Investigating, Resolved
- Assign to curator, Add notes, Take action

**Analytics Tab**:
- Platform-wide metrics (marketplace health)
- Creator leaderboard
- Category performance
- User engagement

**Settings Tab**:
- Marketplace configuration (fees, thresholds, policies)
- Manage categories (add, edit, reorder)
- Manage predefined licenses
- Manage curator permissions

---

## 17. Implementation Roadmap

### Phase 1: Foundation (Months 1-2)

**Goal**: Establish core categorization and enhanced data model.

**Deliverables**:
- Database schema migration (new collections, enhanced DeadlineTemplates fields)
- Category management UI (admin)
- Template creation form enhanced with categorization fields
- Basic category browsing (by practice area, jurisdiction)
- Template detail page with enhanced metadata display

**User Stories**:
- As a creator, I can categorize my template by country, practice area, and court level
- As a user, I can browse templates by category
- As an admin, I can manage the category taxonomy

**Technical Tasks**:
- PocketBase migrations for new collections
- Seed data for categories (countries, practice areas, court levels)
- Update template creation/edit components
- Build category tree component
- Update template service layer for new fields

### Phase 2: Search & Discovery (Months 3-4)

**Goal**: Implement robust search and filtering.

**Deliverables**:
- Meilisearch integration for full-text search
- Advanced filtering UI (faceted search)
- Search results page with sorting
- Template preview modal (before use)
- "Related templates" recommendation engine

**User Stories**:
- As a user, I can search for templates by keywords and filter by multiple criteria
- As a user, I can preview a template's structure before using it
- As a user, I discover related templates based on my current selection

**Technical Tasks**:
- Set up Meilisearch instance (self-hosted or cloud)
- PocketBase hooks to sync templates to Meilisearch
- Build search API wrapper
- Implement filter panel component
- Build template preview modal with graph visualization
- Collaborative filtering algorithm for recommendations

### Phase 3: Permissions & Scoping (Months 5-6)

**Goal**: Granular access control and multi-tier scoping.

**Deliverables**:
- ACL system for templates
- Team-level template sharing
- Organization template library
- Regional marketplace filtering (geo-scoping)
- Template visibility controls (personal, team, org, marketplace)

**User Stories**:
- As a creator, I can share my template with specific team members with view or edit access
- As an org admin, I can publish templates to my entire organization
- As a user, I see templates relevant to my jurisdiction prioritized in search

**Technical Tasks**:
- Implement TemplateACL collection and permission middleware
- Build team selection UI for template sharing
- Enhance PocketBase rules for ACL-based access control
- Implement geographic filtering in search
- Build "Publish to..." workflow with approval gates

### Phase 4: Reviews & Quality (Months 7-8)

**Goal**: Community-driven quality through reviews and ratings.

**Deliverables**:
- Review submission and display system
- Multi-dimensional rating (5 dimensions)
- Review moderation tools
- Creator response to reviews
- Quality badges (verified, highly-rated, etc.)
- Template reporting mechanism

**User Stories**:
- As a user, I can review a template after using it, rating accuracy, completeness, etc.
- As a creator, I can respond to reviews to address feedback
- As a curator, I can moderate inappropriate reviews
- As a user, I trust templates with high ratings and verification badges

**Technical Tasks**:
- Build TemplateReviews collection
- Review submission form (multi-dimensional rating)
- Review display component (with filtering, sorting)
- Creator response UI
- Review moderation queue (curator dashboard)
- Badge calculation logic (based on ratings, verification, usage)
- Report template/review functionality

### Phase 5: Versioning & Lifecycle (Months 9-10)

**Goal**: Robust version management and template lifecycle.

**Deliverables**:
- Semantic versioning for templates
- Version history display
- Template migration/upgrade workflow
- Fork and pull request system
- Template deprecation workflow

**User Stories**:
- As a creator, I can publish a new version of my template with a changelog
- As a user, I can upgrade my matter to a newer template version
- As a user, I can fork a community template to customize it
- As a creator, I can accept pull requests from community contributors
- As a creator, I can deprecate outdated templates with a suggested replacement

**Technical Tasks**:
- Implement TemplateVersions collection
- Version creation workflow with auto-detection of change type
- Version diff view (side-by-side comparison)
- Matter upgrade API (applies new template version)
- Fork functionality (creates copy with attribution)
- Pull request system (diff, approve/reject workflow)
- Deprecation workflow with notifications

### Phase 6: Monetization (Months 11-13)

**Goal**: Enable creators to monetize templates.

**Deliverables**:
- License system (free and commercial)
- Pricing configuration UI
- Stripe integration (checkout, subscriptions, payouts)
- Purchase workflow
- Creator earnings dashboard
- Invoicing and tax documents

**User Stories**:
- As a creator, I can set a price for my premium template
- As a user, I can purchase a template with one-click checkout
- As a creator, I receive payouts for my template sales
- As an organization, I can purchase templates for enterprise use

**Technical Tasks**:
- Build TemplateLicenses and TemplatePurchases collections
- Pricing configuration component
- Stripe Checkout integration
- Stripe Connect onboarding for creators
- Webhook handlers for payment events
- Creator earnings dashboard
- Invoice generation (PDF)
- Subscription management (cancel, pause, resume)

### Phase 7: Curation & Collections (Months 14-15)

**Goal**: Editorial curation and template collections.

**Deliverables**:
- Curator approval workflow
- Featured template management
- Template collections (curated sets)
- User-created collections
- Marketplace homepage redesign with curated content
- Creator verification program

**User Stories**:
- As a curator, I review templates pending marketplace publication
- As a curator, I feature high-quality templates on the homepage
- As a curator, I create "Starter Kit" collections for common practice areas
- As a user, I browse curated collections to find related templates
- As a user, I create my own collection of frequently-used templates

**Technical Tasks**:
- Build curator queue and review modal
- Approval workflow (approve, request changes, reject)
- Featured template management UI
- TemplateCollections collection and API
- Collection builder UI (drag-and-drop templates)
- Homepage redesign with featured section and collections carousel
- Creator verification workflow (bar number check)

### Phase 8: Analytics & Insights (Months 16-17)

**Goal**: Data-driven insights for creators and platform.

**Deliverables**:
- Creator analytics dashboard
- Template performance metrics
- Platform-wide admin analytics
- Organization usage analytics
- Review analytics
- Export functionality (CSV, PDF reports)

**User Stories**:
- As a creator, I see detailed analytics on my template usage, revenue, and ratings
- As a creator, I understand which jurisdictions use my template most
- As a platform admin, I monitor marketplace health and identify trends
- As an org admin, I track which templates my teams use most

**Technical Tasks**:
- TemplateAnalytics collection with daily aggregation job
- Creator dashboard UI (charts, tables, maps)
- Admin analytics dashboard
- Organization analytics page
- Review sentiment analysis
- Export functionality (CSV, PDF via jsPDF)

### Phase 9: Advanced Discovery (Months 18-19)

**Goal**: AI-powered recommendations and intelligent search.

**Deliverables**:
- Personalized template recommendations
- "Frequently used together" suggestions
- Auto-tagging with ML
- Zero-result search handling (suggestions)
- Template quality scoring algorithm
- Trending templates detection

**User Stories**:
- As a user, I receive personalized template recommendations based on my practice area
- As a user, I discover templates frequently used together for complex workflows
- As a user, I get helpful suggestions when my search returns no results

**Technical Tasks**:
- Collaborative filtering algorithm (user-user, item-item)
- Content-based filtering (metadata similarity)
- Hybrid recommendation engine
- "Frequently used together" algorithm (association rules)
- ML model for auto-tagging (if feasible, else rule-based)
- Quality scoring algorithm (weighted combination of rating, usage, recency, review coverage)
- Trending detection (usage velocity)
- Search suggestion engine (did-you-mean, related queries)

### Phase 10: Mobile & Platform Parity (Months 20-21)

**Goal**: Full marketplace experience on mobile and desktop apps.

**Deliverables**:
- Mobile-optimized marketplace UI (responsive)
- Capacitor integration for Android
- Tauri integration for desktop
- Offline template library (progressive web app)
- Push notifications for template updates, purchases, reviews

**User Stories**:
- As a mobile user, I can browse and purchase templates on my phone
- As a desktop app user, I receive native notifications when someone reviews my template
- As a user, I can access my purchased templates offline

**Technical Tasks**:
- Responsive design for all marketplace pages
- Mobile navigation patterns (bottom nav, hamburger menu)
- Capacitor-specific optimizations (native UI components)
- Tauri-specific optimizations (native window management)
- Service worker for offline template caching
- Push notification integration (via Capacitor Push Notifications plugin)
- Background sync for template updates

### Phase 11: Internationalization (Months 22-23)

**Goal**: Global marketplace with multi-language support.

**Deliverables**:
- Multi-language UI (i18n)
- Template metadata translation
- Language-specific search
- Regional marketplaces (e.g., marketplace.practocore.fr)
- Currency conversion for pricing
- Localized payment methods (via Stripe)

**User Stories**:
- As a French lawyer, I can browse the marketplace in French
- As a creator, I can provide my template description in multiple languages
- As a user, I see prices in my local currency

**Technical Tasks**:
- Nuxt i18n integration
- Translation management (keys, files)
- Template metadata multi-language fields (JSON with language codes)
- Language switcher component
- Search filtering by language
- Currency conversion API integration (or Stripe multi-currency)
- Regional domain routing (if applicable)

### Phase 12: Community & Engagement (Months 24)

**Goal**: Foster active creator and user community.

**Deliverables**:
- Creator forums/discussion boards
- Template comments (besides reviews)
- Creator follow system (notifications when favorite creator publishes)
- Leaderboards (top creators, top reviewers)
- Badges and gamification
- Template of the Month program
- Community guidelines and code of conduct

**User Stories**:
- As a user, I can follow my favorite creators and get notified of new templates
- As a creator, I engage with users through comments on my templates
- As a top contributor, I earn badges and recognition
- As a user, I participate in voting for "Template of the Month"

**Technical Tasks**:
- Build discussion/comment system (threaded comments)
- Follow system (user-user relationships, notifications)
- Leaderboard calculation (top creators by rating, usage, revenue; top reviewers by helpful votes)
- Badge system (criteria definitions, badge awarding logic)
- "Template of the Month" voting mechanism
- Community guidelines page
- Moderation tools for comments

---

## Conclusion

This comprehensive marketplace design provides a roadmap for transforming PractoCore into a global platform for legal deadline template sharing and collaboration. The phased approach allows for iterative development with regular user feedback, ensuring each feature delivers value before moving to the next.

### Key Success Factors

1. **Quality First**: Robust curation and review systems ensure marketplace templates are accurate and trustworthy
2. **Creator Empowerment**: Fair revenue sharing, detailed analytics, and reputation systems incentivize high-quality contributions
3. **User Trust**: Verification badges, ratings, and editorial curation help users confidently select templates
4. **Discoverability**: Powerful search, intelligent recommendations, and curated collections help users find the right template
5. **Global Reach**: Multi-language support, regional scoping, and diverse payment methods enable worldwide adoption
6. **Community**: Engagement features foster a collaborative ecosystem of legal professionals

### Next Steps

1. **Stakeholder Review**: Present this design to product, engineering, and legal teams for feedback
2. **User Research**: Conduct interviews with target users (lawyers, law firms) to validate assumptions
3. **Technical Feasibility**: Deep-dive on Meilisearch, Stripe integration, and PocketBase scalability
4. **Prioritization**: Refine roadmap based on business priorities and resource availability
5. **Prototype**: Build low-fidelity prototypes of key screens for usability testing
6. **MVP Definition**: Define Phase 1-2 scope as minimum viable product for initial launch

---

**Document End**

*This design document is a living document and should be updated as requirements evolve and implementation progresses.*
