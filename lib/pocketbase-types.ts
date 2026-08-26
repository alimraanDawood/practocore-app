/**
* This file was @generated using pocketbase-typegen
*/

import type PocketBase from 'pocketbase'
import type { RecordService } from 'pocketbase'

export const Collections = {
	Authorigins: "_authOrigins",
	Externalauths: "_externalAuths",
	Mfas: "_mfas",
	Otps: "_otps",
	Superusers: "_superusers",
	AiAuditLog: "AiAuditLog",
	AiChatAttachments: "AiChatAttachments",
	AiConversations: "AiConversations",
	AiDeepTasks: "AiDeepTasks",
	AiForms: "AiForms",
	AiFormSubmissions: "AiFormSubmissions",
	AiMemories: "AiMemories",
	AiResearchFindings: "AiResearchFindings",
	AiSkills: "AiSkills",
	AiUsage: "AiUsage",
	AiVaultDocuments: "AiVaultDocuments",
	AiVaultFolders: "AiVaultFolders",
	AiVaultMembers: "AiVaultMembers",
	AiVaults: "AiVaults",
	AiWorkflowRuns: "AiWorkflowRuns",
	AiWorkflows: "AiWorkflows",
	AiWorkflowStepLog: "AiWorkflowStepLog",
	Applications: "Applications",
	Avatars: "Avatars",
	CaseLawCatalogueSync: "CaseLawCatalogueSync",
	Clerks: "Clerks",
	ComplianceFilings: "ComplianceFilings",
	ComplianceObligations: "ComplianceObligations",
	ConciergeLeads: "ConciergeLeads",
	Courts: "Courts",
	DeCalendarVersions: "de_calendar_versions",
	DeMatterEvents: "de_matter_events",
	DeMatterSnapshots: "de_matter_snapshots",
	DeMatters: "de_matters",
	DeTemplateVersions: "de_template_versions",
	DeadlineAdjournments: "DeadlineAdjournments",
	DeadlineEvents: "DeadlineEvents",
	DeadlineReminders: "DeadlineReminders",
	Deadlines: "Deadlines",
	DeadlineTemplateAuthors: "DeadlineTemplateAuthors",
	DeadlineTemplates: "DeadlineTemplates",
	DeviceTokens: "DeviceTokens",
	EccmisConnections: "EccmisConnections",
	EccmisEvents: "EccmisEvents",
	EccmisHolidays: "EccmisHolidays",
	EccmisPayments: "EccmisPayments",
	EmailBus: "EmailBus",
	EngagementMilestones: "EngagementMilestones",
	Engagements: "Engagements",
	EngagementTemplates: "EngagementTemplates",
	EngagementTemplateVersions: "EngagementTemplateVersions",
	Firms: "Firms",
	GeneratedDocuments: "GeneratedDocuments",
	HelpArticles: "HelpArticles",
	HelpCategories: "HelpCategories",
	HelpFeedback: "HelpFeedback",
	Invoices: "Invoices",
	JobNotifications: "JobNotifications",
	Judges: "Judges",
	LedgerEntries: "LedgerEntries",
	LegalCitations: "LegalCitations",
	LegalKnowledge: "LegalKnowledge",
	LegalProvisions: "LegalProvisions",
	LegalSources: "LegalSources",
	LegalVolumeImports: "LegalVolumeImports",
	MatterActionEvents: "MatterActionEvents",
	MatterImports: "MatterImports",
	Matters: "Matters",
	Notifications: "Notifications",
	OrganisationDirectInvites: "OrganisationDirectInvites",
	Organisations: "Organisations",
	OrganisationUserPermissions: "OrganisationUserPermissions",
	OTPs: "OTPs",
	PaymentRefs: "PaymentRefs",
	PaymentRequests: "PaymentRequests",
	Payments: "Payments",
	ProcedureVersions: "ProcedureVersions",
	PromotionalMatters: "PromotionalMatters",
	Registrars: "Registrars",
	ReminderAuditLog: "ReminderAuditLog",
	ReminderEscalationAuditLog: "ReminderEscalationAuditLog",
	ReminderJobs: "ReminderJobs",
	Reminders: "Reminders",
	SeatEvents: "SeatEvents",
	SubscriptionPlans: "SubscriptionPlans",
	Subscriptions: "Subscriptions",
	UserPreferences: "UserPreferences",
	Users: "Users",
} as const
export type Collections = typeof Collections[keyof typeof Collections]

// Alias types for improved usability
export type IsoDateString = string
export type IsoAutoDateString = string & { readonly autodate: unique symbol }
export type RecordIdString = string
export type FileNameString = string & { readonly filename: unique symbol }
export type HTMLString = string

type ExpandType<T> = unknown extends T
	? T extends unknown
		? { expand?: unknown }
		: { expand: T }
	: { expand: T }

// System fields
export type BaseSystemFields<T = unknown> = {
	id: RecordIdString
	collectionId: string
	collectionName: Collections
} & ExpandType<T>

export type AuthSystemFields<T = unknown> = {
	email: string
	emailVisibility: boolean
	username: string
	verified: boolean
} & BaseSystemFields<T>

// Record types for each collection

export type AuthoriginsRecord = {
	collectionRef: string
	created: IsoAutoDateString
	fingerprint: string
	id: string
	recordRef: string
	updated: IsoAutoDateString
}

export type ExternalauthsRecord = {
	collectionRef: string
	created: IsoAutoDateString
	id: string
	provider: string
	providerId: string
	recordRef: string
	updated: IsoAutoDateString
}

export type MfasRecord = {
	collectionRef: string
	created: IsoAutoDateString
	id: string
	method: string
	recordRef: string
	updated: IsoAutoDateString
}

export type OtpsRecord = {
	collectionRef: string
	created: IsoAutoDateString
	id: string
	password: string
	recordRef: string
	sentTo?: string
	updated: IsoAutoDateString
}

export type SuperusersRecord = {
	created: IsoAutoDateString
	email: string
	emailVisibility?: boolean
	id: string
	password: string
	tokenKey: string
	updated: IsoAutoDateString
	verified?: boolean
}

export type AiAuditLogRecord<Tcitations = unknown, Trefs = unknown> = {
	action: string
	citations?: null | Tcitations
	created: IsoAutoDateString
	detail?: string
	id: string
	org?: string
	refs?: null | Trefs
	scope?: string
	scope_id?: string
	tool?: string
	user?: string
}

export type AiChatAttachmentsRecord = {
	conversation?: string
	created: IsoAutoDateString
	file?: FileNameString
	id: string
	kind?: string
	mime?: string
	name?: string
	org?: string
	owner?: string
	sha256?: string
	size?: number
	updated: IsoAutoDateString
	vault?: string
	vault_doc?: string
}

export type AiConversationsRecord<Tmessages = unknown, Ttree = unknown> = {
	context?: string
	created: IsoAutoDateString
	id: string
	messages?: null | Tmessages
	mode?: string
	model?: string
	organisation?: RecordIdString
	owner: RecordIdString
	title: string
	tree?: null | Ttree
	updated: IsoAutoDateString
}

export type AiDeepTasksRecord<TattachmentNames = unknown, Tattachments = unknown, Tauthored = unknown, Tnotes = unknown, Toutline = unknown, Tscope = unknown, Tsources = unknown, Tsteps = unknown> = {
	attachmentNames?: null | TattachmentNames
	attachments?: null | Tattachments
	authored?: null | Tauthored
	control?: string
	conversation?: string
	created: IsoAutoDateString
	credits?: number
	document?: string
	error?: string
	id: string
	instruction: string
	label?: string
	length?: string
	mode?: string
	notes?: null | Tnotes
	org?: string
	outline?: null | Toutline
	phase: string
	progress?: number
	report?: string
	resume?: string
	review?: boolean
	scope?: null | Tscope
	seeded?: boolean
	sources?: null | Tsources
	steps?: null | Tsteps
	updated: IsoAutoDateString
	user: string
}

export type AiFormsRecord<Tfields = unknown, Tsettings = unknown> = {
	accepting_submissions?: boolean
	created: IsoAutoDateString
	created_by?: string
	description?: string
	fields?: null | Tfields
	id: string
	name: string
	org?: string
	owner?: string
	published?: boolean
	settings?: null | Tsettings
	slug: string
	updated: IsoAutoDateString
	version?: number
}

export type AiFormSubmissionsRecord<Tvalues = unknown> = {
	created: IsoAutoDateString
	files?: FileNameString[]
	form: string
	form_version?: number
	id: string
	matter?: string
	org?: string
	run?: string
	submitter?: string
	values?: null | Tvalues
}

export const AiMemoriesScopeOptions = {
	"org": "org",
	"matter": "matter",
	"user": "user",
	"vault": "vault",
	"engagement": "engagement",
} as const
export type AiMemoriesScopeOptions = typeof AiMemoriesScopeOptions[keyof typeof AiMemoriesScopeOptions]

export const AiMemoriesStatusOptions = {
	"active": "active",
	"superseded": "superseded",
	"expired": "expired",
} as const
export type AiMemoriesStatusOptions = typeof AiMemoriesStatusOptions[keyof typeof AiMemoriesStatusOptions]
export type AiMemoriesRecord<Tprovenance = unknown, Ttags = unknown> = {
	confidence?: number
	content: string
	created: IsoAutoDateString
	created_by?: string
	embedding?: string
	embedding_model?: string
	id: string
	jurisdiction?: string
	org?: string
	provenance?: null | Tprovenance
	scope: AiMemoriesScopeOptions
	scope_id: string
	source?: string
	status?: AiMemoriesStatusOptions
	supersedes?: string
	tags?: null | Ttags
	updated: IsoAutoDateString
}

export type AiResearchFindingsRecord<Tcontradicts = unknown, Tsource_chain = unknown, Ttags = unknown> = {
	authority_weight?: number
	claim: string
	confidence?: string
	contradicts?: null | Tcontradicts
	created: IsoAutoDateString
	id: string
	idem_key?: string
	source_chain?: null | Tsource_chain
	sub_question_id?: string
	tags?: null | Ttags
	task_id: string
	updated: IsoAutoDateString
	user?: string
}

export const AiSkillsStatusOptions = {
	"draft": "draft",
	"active": "active",
	"deprecated": "deprecated",
} as const
export type AiSkillsStatusOptions = typeof AiSkillsStatusOptions[keyof typeof AiSkillsStatusOptions]
export type AiSkillsRecord<Texamples = unknown, Ttool_bindings = unknown> = {
	author?: string
	court_scope?: string
	created: IsoAutoDateString
	embedding?: string
	embedding_model?: string
	examples?: null | Texamples
	id: string
	instructions?: string
	jurisdiction?: string
	name: string
	org?: string
	owner?: string
	purpose?: string
	status?: AiSkillsStatusOptions
	title: string
	tool_bindings?: null | Ttool_bindings
	triggers?: string
	updated: IsoAutoDateString
	user_invocable?: boolean
	version?: string
}

export type AiUsageRecord = {
	cache_creation_input_tokens?: number
	cache_read_input_tokens?: number
	conversation?: RecordIdString
	cost_ugx?: number
	created: IsoAutoDateString
	credits?: number
	duration_ms?: number
	id: string
	input_tokens?: number
	model?: string
	organisation?: RecordIdString
	output_tokens?: number
	tool_call_count?: number
	user?: RecordIdString
	web_search_requests?: number
}

export const AiVaultDocumentsScopeOptions = {
	"matter": "matter",
	"org": "org",
	"vault": "vault",
	"user": "user",
	"engagement": "engagement",
} as const
export type AiVaultDocumentsScopeOptions = typeof AiVaultDocumentsScopeOptions[keyof typeof AiVaultDocumentsScopeOptions]

export const AiVaultDocumentsStatusOptions = {
	"pending": "pending",
	"processing": "processing",
	"ingested": "ingested",
	"failed": "failed",
	"stored": "stored",
} as const
export type AiVaultDocumentsStatusOptions = typeof AiVaultDocumentsStatusOptions[keyof typeof AiVaultDocumentsStatusOptions]
export type AiVaultDocumentsRecord = {
	created: IsoAutoDateString
	created_by?: string
	doc_type?: string
	error?: string
	facts_count?: number
	file?: FileNameString
	filename?: string
	folder?: string
	id: string
	ingest?: boolean
	jurisdiction?: string
	mime?: string
	ocr?: boolean
	org?: string
	provider?: string
	scope: AiVaultDocumentsScopeOptions
	scope_id: string
	status: AiVaultDocumentsStatusOptions
	text?: string
	trashed?: boolean
	trashed_at?: IsoDateString
	updated: IsoAutoDateString
}

export const AiVaultFoldersScopeOptions = {
	"matter": "matter",
	"org": "org",
	"vault": "vault",
	"user": "user",
	"engagement": "engagement",
} as const
export type AiVaultFoldersScopeOptions = typeof AiVaultFoldersScopeOptions[keyof typeof AiVaultFoldersScopeOptions]
export type AiVaultFoldersRecord = {
	created: IsoAutoDateString
	created_by?: string
	id: string
	jurisdiction?: string
	name: string
	org?: string
	parent?: string
	scope: AiVaultFoldersScopeOptions
	scope_id: string
	trashed?: boolean
	trashed_at?: IsoDateString
	updated: IsoAutoDateString
}

export const AiVaultMembersRoleOptions = {
	"owner": "owner",
	"manager": "manager",
	"contributor": "contributor",
	"viewer": "viewer",
} as const
export type AiVaultMembersRoleOptions = typeof AiVaultMembersRoleOptions[keyof typeof AiVaultMembersRoleOptions]

export const AiVaultMembersStatusOptions = {
	"invited": "invited",
	"active": "active",
} as const
export type AiVaultMembersStatusOptions = typeof AiVaultMembersStatusOptions[keyof typeof AiVaultMembersStatusOptions]
export type AiVaultMembersRecord<Tcaps = unknown> = {
	caps?: null | Tcaps
	created: IsoAutoDateString
	id: string
	invited_by?: string
	org?: string
	role: AiVaultMembersRoleOptions
	status: AiVaultMembersStatusOptions
	updated: IsoAutoDateString
	user: string
	vault: string
}

export const AiVaultsVisibilityOptions = {
	"personal": "personal",
	"shared": "shared",
} as const
export type AiVaultsVisibilityOptions = typeof AiVaultsVisibilityOptions[keyof typeof AiVaultsVisibilityOptions]
export type AiVaultsRecord = {
	ai_read_default?: boolean
	conversation?: string
	created: IsoAutoDateString
	created_by?: string
	description?: string
	id: string
	jurisdiction?: string
	name: string
	org?: string
	owner: string
	trashed?: boolean
	trashed_at?: IsoDateString
	updated: IsoAutoDateString
	visibility?: AiVaultsVisibilityOptions
}

export const AiWorkflowRunsStatusOptions = {
	"pending": "pending",
	"running": "running",
	"awaiting_approval": "awaiting_approval",
	"completed": "completed",
	"failed": "failed",
	"cancelled": "cancelled",
} as const
export type AiWorkflowRunsStatusOptions = typeof AiWorkflowRunsStatusOptions[keyof typeof AiWorkflowRunsStatusOptions]
export type AiWorkflowRunsRecord<Tcontext = unknown, Toutcome = unknown> = {
	actor?: string
	context?: null | Tcontext
	current_step?: string
	dry_run?: boolean
	error?: string
	finished?: string
	id: string
	matter?: string
	org?: string
	outcome?: null | Toutcome
	started: IsoAutoDateString
	status?: AiWorkflowRunsStatusOptions
	submission?: string
	trigger_kind?: string
	trigger_source?: string
	workflow: string
	workflow_version?: number
}

export type AiWorkflowsRecord<Tresource_access = unknown, Tsettings = unknown, Tsteps = unknown, Ttrigger = unknown> = {
	created: IsoAutoDateString
	created_by?: string
	description?: string
	enabled?: boolean
	id: string
	name: string
	org?: string
	owner?: string
	published?: boolean
	resource_access?: null | Tresource_access
	scope?: string
	settings?: null | Tsettings
	slug: string
	steps?: null | Tsteps
	trigger?: null | Ttrigger
	updated: IsoAutoDateString
	version?: number
	visibility?: string
}

export type AiWorkflowStepLogRecord<Tapproval = unknown, Tresolved_input = unknown, Tresult = unknown> = {
	action?: string
	approval?: null | Tapproval
	credits_used?: number
	error?: string
	finished?: string
	id: string
	resolved_input?: null | Tresolved_input
	result?: null | Tresult
	run: string
	started: IsoAutoDateString
	step_id?: string
	step_type?: string
}

export const ApplicationsTriggerStatusOptions = {
	"confirmed": "confirmed",
	"provisional": "provisional",
} as const
export type ApplicationsTriggerStatusOptions = typeof ApplicationsTriggerStatusOptions[keyof typeof ApplicationsTriggerStatusOptions]
export type ApplicationsRecord<TfieldValues = unknown, TopposingCounsel = unknown, Tparties = unknown, TpartyConfig = unknown, Trepresenting = unknown, Tstate = unknown> = {
	caseNumber?: string
	court?: RecordIdString
	created: IsoAutoDateString
	createdBy?: RecordIdString
	fieldValues?: null | TfieldValues
	id: string
	inheritParties?: boolean
	judges?: RecordIdString
	matter?: RecordIdString
	members?: RecordIdString
	name?: string
	opposingCounsel?: null | TopposingCounsel
	organisation?: RecordIdString
	parties?: null | Tparties
	partyConfig?: null | TpartyConfig
	personal?: boolean
	representing?: null | Trepresenting
	state?: null | Tstate
	supervisors?: RecordIdString[]
	template?: RecordIdString
	triggerDate?: IsoDateString
	triggerDateName?: string
	triggerDatePrompt?: string
	triggerStatus?: ApplicationsTriggerStatusOptions
	type?: string
	updated: IsoAutoDateString
}

export type AvatarsRecord = {
	created: IsoAutoDateString
	field?: FileNameString
	id: string
	updated: IsoAutoDateString
}

export type CaseLawCatalogueSyncRecord = {
	court?: string
	created: IsoAutoDateString
	cursor_created?: string
	enabled?: boolean
	id: string
	imported?: number
	last_error?: string
	last_run?: IsoDateString
	skipped?: number
	source: string
	updated: IsoAutoDateString
	watermark?: string
	year?: string
}

export type ClerksRecord = {
	created: IsoAutoDateString
	email?: string
	id: string
	judge?: RecordIdString
	name?: string
	phone?: string
	updated: IsoAutoDateString
}

export const ComplianceFilingsStatusOptions = {
	"pending": "pending",
	"filed": "filed",
	"missed": "missed",
} as const
export type ComplianceFilingsStatusOptions = typeof ComplianceFilingsStatusOptions[keyof typeof ComplianceFilingsStatusOptions]
export type ComplianceFilingsRecord = {
	created: IsoAutoDateString
	dueDate?: IsoDateString
	engagement: RecordIdString
	evidence?: FileNameString
	filedDate?: IsoDateString
	id: string
	label: string
	note?: string
	obligation: RecordIdString
	organisation?: RecordIdString
	owner?: RecordIdString
	reference?: string
	reminder?: string
	status?: ComplianceFilingsStatusOptions
	updated: IsoAutoDateString
}

export const ComplianceObligationsRecurrenceOptions = {
	"weekly": "weekly",
	"monthly": "monthly",
	"quarterly": "quarterly",
	"yearly": "yearly",
	"custom": "custom",
} as const
export type ComplianceObligationsRecurrenceOptions = typeof ComplianceObligationsRecurrenceOptions[keyof typeof ComplianceObligationsRecurrenceOptions]

export const ComplianceObligationsStatusOptions = {
	"active": "active",
	"paused": "paused",
	"ended": "ended",
} as const
export type ComplianceObligationsStatusOptions = typeof ComplianceObligationsStatusOptions[keyof typeof ComplianceObligationsStatusOptions]
export type ComplianceObligationsRecord = {
	anchorDate?: IsoDateString
	created: IsoAutoDateString
	engagement: RecordIdString
	id: string
	label: string
	nextDueDate?: IsoDateString
	organisation?: RecordIdString
	owner?: RecordIdString
	periodMonths?: number
	recurrence?: ComplianceObligationsRecurrenceOptions
	remind?: boolean
	reminder?: string
	source?: string
	status?: ComplianceObligationsStatusOptions
	updated: IsoAutoDateString
}

export type ConciergeLeadsRecord = {
	created: IsoAutoDateString
	email?: string
	firm?: string
	id: string
	name?: string
	notes?: string
	practice_area?: string
	source?: string
	start?: string
}

export type CourtsRecord = {
	created: IsoAutoDateString
	id: string
	name?: string
	order?: number
	updated: IsoAutoDateString
}

export type DeCalendarVersionsRecord<Tdata = unknown> = {
	calendarId?: string
	created: IsoAutoDateString
	data?: null | Tdata
	id: string
	jurisdiction?: string
	version: string
}

export type DeMatterEventsRecord = {
	actor?: string
	created: IsoAutoDateString
	date?: string
	id: string
	matter?: string
	seq: number
	supersedes?: number
	target?: string
	type: string
}

export type DeMatterSnapshotsRecord<Tsnapshot = unknown> = {
	id: string
	matter: string
	snapshot?: null | Tsnapshot
	throughSeq?: number
	updated: IsoAutoDateString
}

export type DeMattersRecord<Tfields = unknown, Tparties = unknown> = {
	calendarVersion: string
	created: IsoAutoDateString
	createdBy?: string
	fields?: null | Tfields
	id: string
	jurisdiction?: string
	legacyMatter?: string
	parties?: null | Tparties
	templateVersion: string
	trigger: string
}

export type DeTemplateVersionsRecord<Tir = unknown> = {
	created: IsoAutoDateString
	createdBy?: string
	id: string
	ir?: null | Tir
	jurisdiction?: string
	name?: string
	templateId?: string
	version: string
}

export const DeadlineAdjournmentsKindOptions = {
	"adjournment": "adjournment",
	"override": "override",
} as const
export type DeadlineAdjournmentsKindOptions = typeof DeadlineAdjournmentsKindOptions[keyof typeof DeadlineAdjournmentsKindOptions]
export type DeadlineAdjournmentsRecord = {
	created: IsoAutoDateString
	deadline?: RecordIdString
	from?: IsoDateString
	id: string
	kind?: DeadlineAdjournmentsKindOptions
	reason?: string
	to?: IsoDateString
	updated: IsoAutoDateString
}

export const DeadlineEventsStatusOptions = {
	"pending": "pending",
	"fulfilled": "fulfilled",
	"unavailable": "unavailable",
} as const
export type DeadlineEventsStatusOptions = typeof DeadlineEventsStatusOptions[keyof typeof DeadlineEventsStatusOptions]
export type DeadlineEventsRecord = {
	created: IsoAutoDateString
	date?: IsoDateString
	fulfilled_prompt?: string
	id: string
	input_prompt?: string
	matter?: RecordIdString
	name?: string
	status?: DeadlineEventsStatusOptions
	t_id?: string
	updated: IsoAutoDateString
}

export const DeadlineRemindersChannelsOptions = {
	"EMAIL": "EMAIL",
	"APP": "APP",
	"PUSH": "PUSH",
	"SMS": "SMS",
} as const
export type DeadlineRemindersChannelsOptions = typeof DeadlineRemindersChannelsOptions[keyof typeof DeadlineRemindersChannelsOptions]
export type DeadlineRemindersRecord = {
	acknowledgedBy?: RecordIdString[]
	active?: boolean
	atTime?: string
	body?: string
	bodyHTML?: HTMLString
	channels?: DeadlineRemindersChannelsOptions[]
	created: IsoAutoDateString
	date?: IsoDateString
	deadline?: RecordIdString
	escalate?: boolean
	id: string
	jobsGenerated?: boolean
	jobsGeneratedAt?: IsoDateString
	reminderSource?: RecordIdString
	requiresAcknowledgement?: boolean
	sent?: RecordIdString[]
	supervisorAlerted?: boolean
	supervisorAlertedAt?: IsoDateString
	title?: string
	updated: IsoAutoDateString
}

export const DeadlinesStatusOptions = {
	"pending": "pending",
	"fulfilled": "fulfilled",
	"overdue": "overdue",
	"unavailable": "unavailable",
} as const
export type DeadlinesStatusOptions = typeof DeadlinesStatusOptions[keyof typeof DeadlinesStatusOptions]

export const DeadlinesOriginOptions = {
	"template": "template",
	"adhoc": "adhoc",
	"court": "court",
} as const
export type DeadlinesOriginOptions = typeof DeadlinesOriginOptions[keyof typeof DeadlinesOriginOptions]
export type DeadlinesRecord<Tparty_context = unknown, TreminderOffsets = unknown, Trules = unknown> = {
	action?: string
	application?: RecordIdString
	applications_enabled?: boolean
	assignees?: RecordIdString[]
	created: IsoAutoDateString
	createdBy?: RecordIdString
	date?: IsoDateString
	dependency?: RecordIdString
	description?: string
	disableFulfill?: boolean
	dynamic?: boolean
	fulfilled_prompt?: string
	id: string
	input_prompt?: string
	label?: string
	matter?: RecordIdString
	name?: string
	note?: string
	origin?: DeadlinesOriginOptions
	overdue_prompt?: string
	party_context?: null | Tparty_context
	pending_prompt?: string
	reminderOffsets?: null | TreminderOffsets
	reminderTask?: boolean
	role?: string
	rules?: null | Trules
	seq?: number
	status?: DeadlinesStatusOptions
	t_id?: string
	updated: IsoAutoDateString
}

export type DeadlineTemplateAuthorsRecord = {
	avatar?: string
	id: string
	name: string
}

export const DeadlineTemplatesStatusOptions = {
	"draft": "draft",
	"active": "active",
	"deprecated": "deprecated",
} as const
export type DeadlineTemplatesStatusOptions = typeof DeadlineTemplatesStatusOptions[keyof typeof DeadlineTemplatesStatusOptions]

export const DeadlineTemplatesPracticeAreaOptions = {
	"civil_litigation": "civil_litigation",
	"criminal_law": "criminal_law",
	"family_law": "family_law",
	"corporate_commercial": "corporate_commercial",
	"intellectual_property": "intellectual_property",
	"employment_law": "employment_law",
	"real_estate": "real_estate",
	"tax_law": "tax_law",
	"immigration_law": "immigration_law",
	"administrative_law": "administrative_law",
	"bankruptcy_insolvency": "bankruptcy_insolvency",
	"environmental_law": "environmental_law",
	"other": "other",
} as const
export type DeadlineTemplatesPracticeAreaOptions = typeof DeadlineTemplatesPracticeAreaOptions[keyof typeof DeadlineTemplatesPracticeAreaOptions]

export const DeadlineTemplatesCourtLevelOptions = {
	"supreme_apex": "supreme_apex",
	"appellate_high": "appellate_high",
	"trial_district": "trial_district",
	"specialized_tribunal": "specialized_tribunal",
	"administrative_agency": "administrative_agency",
	"arbitration_adr": "arbitration_adr",
	"small_claims": "small_claims",
	"other": "other",
} as const
export type DeadlineTemplatesCourtLevelOptions = typeof DeadlineTemplatesCourtLevelOptions[keyof typeof DeadlineTemplatesCourtLevelOptions]

export const DeadlineTemplatesComplexityOptions = {
	"beginner": "beginner",
	"intermediate": "intermediate",
	"advanced": "advanced",
	"expert": "expert",
} as const
export type DeadlineTemplatesComplexityOptions = typeof DeadlineTemplatesComplexityOptions[keyof typeof DeadlineTemplatesComplexityOptions]

export const DeadlineTemplatesProvenanceOptions = {
	"practocore": "practocore",
	"firm": "firm",
} as const
export type DeadlineTemplatesProvenanceOptions = typeof DeadlineTemplatesProvenanceOptions[keyof typeof DeadlineTemplatesProvenanceOptions]

export const DeadlineTemplatesInstrumentClassOptions = {
	"originating": "originating",
	"responsive": "responsive",
} as const
export type DeadlineTemplatesInstrumentClassOptions = typeof DeadlineTemplatesInstrumentClassOptions[keyof typeof DeadlineTemplatesInstrumentClassOptions]

export const DeadlineTemplatesTypicalFilingSideOptions = {
	"claimant": "claimant",
	"respondent": "respondent",
	"either": "either",
} as const
export type DeadlineTemplatesTypicalFilingSideOptions = typeof DeadlineTemplatesTypicalFilingSideOptions[keyof typeof DeadlineTemplatesTypicalFilingSideOptions]
export type DeadlineTemplatesRecord<Tchangelog = unknown, Ttags = unknown, Ttemplate = unknown> = {
	author?: RecordIdString
	authorName?: string
	caseNumberLabel?: string
	changelog?: null | Tchangelog
	complexity?: DeadlineTemplatesComplexityOptions
	country?: string
	courtLevel?: DeadlineTemplatesCourtLevelOptions
	courts?: RecordIdString[]
	created: IsoAutoDateString
	forum?: string
	id: string
	instrumentClass?: DeadlineTemplatesInstrumentClassOptions
	isPublic?: boolean
	language?: string
	matterType?: string
	name?: string
	order?: number
	organisation?: RecordIdString
	organisationName?: string
	practiceArea?: DeadlineTemplatesPracticeAreaOptions
	provenance?: DeadlineTemplatesProvenanceOptions
	stateProvince?: string
	status?: DeadlineTemplatesStatusOptions
	tags?: null | Ttags
	template?: null | Ttemplate
	typicalFilingSide?: DeadlineTemplatesTypicalFilingSideOptions
	updated: IsoAutoDateString
	usageCount?: number
	version?: string
}

export const DeviceTokensPlatformOptions = {
	"android": "android",
	"ios": "ios",
	"web": "web",
	"electron": "electron",
} as const
export type DeviceTokensPlatformOptions = typeof DeviceTokensPlatformOptions[keyof typeof DeviceTokensPlatformOptions]
export type DeviceTokensRecord<Tdevice_info = unknown> = {
	created: IsoAutoDateString
	device_info?: null | Tdevice_info
	id: string
	is_active?: boolean
	last_updated?: IsoDateString
	platform?: DeviceTokensPlatformOptions
	token?: string
	updated: IsoAutoDateString
	user?: RecordIdString
}

export const EccmisConnectionsStatusOptions = {
	"connected": "connected",
	"disconnected": "disconnected",
	"failed": "failed",
	"syncing": "syncing",
} as const
export type EccmisConnectionsStatusOptions = typeof EccmisConnectionsStatusOptions[keyof typeof EccmisConnectionsStatusOptions]
export type EccmisConnectionsRecord<TusageLog = unknown> = {
	created: IsoAutoDateString
	eccmisUserId?: string
	eccmisUsername?: string
	encryptedCredentials?: string
	failureCount?: number
	id: string
	lastError?: string
	lastSyncAt?: IsoDateString
	noticeWatermark?: number
	operatorAuthorisationRef?: string
	organisation?: RecordIdString
	status: EccmisConnectionsStatusOptions
	updated: IsoAutoDateString
	usageLog?: null | TusageLog
	user: RecordIdString
}

export const EccmisEventsTypeOptions = {
	"hearing_new": "hearing_new",
	"hearing_moved": "hearing_moved",
	"hearing_cancelled": "hearing_cancelled",
	"status_changed": "status_changed",
	"court_notice": "court_notice",
	"judgment_entered": "judgment_entered",
	"payment_due": "payment_due",
	"document_added": "document_added",
} as const
export type EccmisEventsTypeOptions = typeof EccmisEventsTypeOptions[keyof typeof EccmisEventsTypeOptions]
export type EccmisEventsRecord<Tdetail = unknown> = {
	body?: string
	caseInstanceId?: number
	caseNumber?: string
	created: IsoAutoDateString
	detail?: null | Tdetail
	eventKey?: string
	id: string
	matter?: RecordIdString
	notified?: boolean
	organisation?: RecordIdString
	title?: string
	type: EccmisEventsTypeOptions
	updated: IsoAutoDateString
	user: RecordIdString
}

export type EccmisHolidaysRecord = {
	created: IsoAutoDateString
	date: string
	endDate?: string
	id: string
	name: string
	source?: string
	updated: IsoAutoDateString
}

export const EccmisPaymentsStatusOptions = {
	"draft": "draft",
	"pending_payment": "pending_payment",
	"paid_offline_pending": "paid_offline_pending",
	"paid_pending": "paid_pending",
	"paid": "paid",
	"expired": "expired",
	"unknown": "unknown",
} as const
export type EccmisPaymentsStatusOptions = typeof EccmisPaymentsStatusOptions[keyof typeof EccmisPaymentsStatusOptions]
export type EccmisPaymentsRecord<Tdetail = unknown> = {
	amount?: number
	caseInstanceId?: number
	caseNumber?: string
	created: IsoAutoDateString
	currency?: string
	description?: string
	detail?: null | Tdetail
	dueDate?: IsoDateString
	eccmisPaymentId: string
	id: string
	matter?: RecordIdString
	organisation?: RecordIdString
	prn?: string
	status?: EccmisPaymentsStatusOptions
	updated: IsoAutoDateString
	user: RecordIdString
}

export type EmailBusRecord = {
	body?: HTMLString
	created: IsoAutoDateString
	id: string
	sent?: boolean
	subject?: string
	to?: string
	updated: IsoAutoDateString
}

export const EngagementMilestonesStatusOptions = {
	"pending": "pending",
	"done": "done",
	"skipped": "skipped",
} as const
export type EngagementMilestonesStatusOptions = typeof EngagementMilestonesStatusOptions[keyof typeof EngagementMilestonesStatusOptions]
export type EngagementMilestonesRecord<TreminderChannels = unknown, TreminderOffsets = unknown> = {
	created: IsoAutoDateString
	dueDate?: IsoDateString
	engagement?: RecordIdString
	id: string
	label: string
	matter?: RecordIdString
	owner?: RecordIdString
	remind?: boolean
	reminder?: string
	reminderChannels?: null | TreminderChannels
	reminderOffsets?: null | TreminderOffsets
	source?: string
	stageId?: string
	status?: EngagementMilestonesStatusOptions
	updated: IsoAutoDateString
}

export const EngagementsStatusOptions = {
	"draft": "draft",
	"active": "active",
	"completed": "completed",
	"archived": "archived",
} as const
export type EngagementsStatusOptions = typeof EngagementsStatusOptions[keyof typeof EngagementsStatusOptions]
export type EngagementsRecord<TextraFields = unknown, TfieldValues = unknown, Tparties = unknown, TstageStatus = unknown> = {
	created: IsoAutoDateString
	extraFields?: null | TextraFields
	fieldValues?: null | TfieldValues
	id: string
	members?: RecordIdString[]
	name: string
	organisation?: RecordIdString
	owner: RecordIdString
	parties?: null | Tparties
	stageStatus?: null | TstageStatus
	status?: EngagementsStatusOptions
	targetDate?: IsoDateString
	template: RecordIdString
	updated: IsoAutoDateString
}

export type EngagementTemplatesRecord<Tdata = unknown> = {
	author?: RecordIdString
	created: IsoAutoDateString
	data: null | Tdata
	description?: string
	id: string
	isPublic?: boolean
	name: string
	organisation?: RecordIdString
	updated: IsoAutoDateString
}

export type EngagementTemplateVersionsRecord<Tdata = unknown> = {
	author?: RecordIdString
	created: IsoAutoDateString
	data?: null | Tdata
	description?: string
	id: string
	name?: string
	note?: string
	seq?: number
	template: RecordIdString
}

export type FirmsRecord<Tmeta = unknown> = {
	created: IsoAutoDateString
	id: string
	meta?: null | Tmeta
	name?: string
	updated: IsoAutoDateString
}

export type GeneratedDocumentsRecord<Tir = unknown> = {
	author?: string
	conversation?: string
	created: IsoAutoDateString
	engagement?: string
	file?: FileNameString
	filename?: string
	id: string
	ir?: null | Tir
	kind?: string
	matter?: string
	org?: string
	title: string
	updated: IsoAutoDateString
}

export const HelpArticlesAudienceOptions = {
	"all": "all",
	"firm_admin": "firm_admin",
	"lawyer": "lawyer",
} as const
export type HelpArticlesAudienceOptions = typeof HelpArticlesAudienceOptions[keyof typeof HelpArticlesAudienceOptions]
export type HelpArticlesRecord<Trelated = unknown, Ttags = unknown> = {
	audience?: HelpArticlesAudienceOptions
	body?: string
	category?: RecordIdString
	created: IsoAutoDateString
	embedding?: string
	embedding_model?: string
	excerpt?: string
	id: string
	order?: number
	published?: boolean
	related?: null | Trelated
	slug: string
	tags?: null | Ttags
	title: string
	updated: IsoAutoDateString
	views?: number
}

export const HelpCategoriesAudienceOptions = {
	"all": "all",
	"firm_admin": "firm_admin",
	"lawyer": "lawyer",
} as const
export type HelpCategoriesAudienceOptions = typeof HelpCategoriesAudienceOptions[keyof typeof HelpCategoriesAudienceOptions]
export type HelpCategoriesRecord = {
	audience?: HelpCategoriesAudienceOptions
	created: IsoAutoDateString
	description?: string
	icon?: string
	id: string
	order?: number
	slug: string
	title: string
	updated: IsoAutoDateString
}

export type HelpFeedbackRecord = {
	article: string
	comment?: string
	created: IsoAutoDateString
	helpful?: boolean
	id: string
	updated: IsoAutoDateString
	user?: string
}

export type InvoicesRecord<Tlines = unknown> = {
	amountPaid?: number
	checkoutExpiresAt?: IsoDateString
	checkoutToken?: string
	created: IsoAutoDateString
	currency: string
	dueAt?: IsoDateString
	holderId: string
	holderType: string
	id: string
	issuedAt?: IsoDateString
	lagoInvoiceId?: string
	lines?: null | Tlines
	notes?: string
	number: string
	paidAt?: IsoDateString
	source?: string
	status: string
	subscription?: string
	subtotal?: number
	total?: number
	updated: IsoAutoDateString
}

export const JobNotificationsChannelsOptions = {
	"APP": "APP",
	"EMAIL": "EMAIL",
	"PUSH": "PUSH",
	"SMS": "SMS",
} as const
export type JobNotificationsChannelsOptions = typeof JobNotificationsChannelsOptions[keyof typeof JobNotificationsChannelsOptions]
export type JobNotificationsRecord<Tactions = unknown, Tmetadata = unknown> = {
	actions?: null | Tactions
	avatar?: string
	body?: string
	bodyHTML?: HTMLString
	channels?: JobNotificationsChannelsOptions[]
	created: IsoAutoDateString
	fullMessage?: string
	id: string
	link?: string
	metadata?: null | Tmetadata
	organisation?: RecordIdString
	read?: boolean
	recipient?: RecordIdString
	sent?: boolean
	title?: string
	type?: string
	updated: IsoAutoDateString
}

export type JudgesRecord = {
	court?: RecordIdString
	created: IsoAutoDateString
	id: string
	name?: string
	updated: IsoAutoDateString
}

export type LedgerEntriesRecord<Tmeta = unknown> = {
	amount?: number
	created: IsoAutoDateString
	currency: string
	description?: string
	direction: string
	holderId: string
	holderType: string
	id: string
	idempotencyKey?: string
	invoice?: string
	kind: string
	meta?: null | Tmeta
	occurredAt?: IsoDateString
	payment?: string
}

export const LegalCitationsKindOptions = {
	"case": "case",
	"statute": "statute",
	"constitution": "constitution",
} as const
export type LegalCitationsKindOptions = typeof LegalCitationsKindOptions[keyof typeof LegalCitationsKindOptions]

export const LegalCitationsTreatmentOptions = {
	"followed": "followed",
	"applied": "applied",
	"distinguished": "distinguished",
	"overruled": "overruled",
	"cited": "cited",
} as const
export type LegalCitationsTreatmentOptions = typeof LegalCitationsTreatmentOptions[keyof typeof LegalCitationsTreatmentOptions]
export type LegalCitationsRecord = {
	created: IsoAutoDateString
	from_source: string
	id: string
	kind?: LegalCitationsKindOptions
	to_citation?: string
	to_source?: string
	treatment?: LegalCitationsTreatmentOptions
}

export const LegalKnowledgeStatusOptions = {
	"draft": "draft",
	"active": "active",
	"deprecated": "deprecated",
} as const
export type LegalKnowledgeStatusOptions = typeof LegalKnowledgeStatusOptions[keyof typeof LegalKnowledgeStatusOptions]
export type LegalKnowledgeRecord<TpackageJson = unknown> = {
	created: IsoAutoDateString
	id: string
	name?: string
	openQuestionsCount?: number
	packageJson?: null | TpackageJson
	packageMarkdown?: string
	reviewedAt?: IsoDateString
	reviewedBy?: string
	sourcesVerifiedOn?: IsoDateString
	status?: LegalKnowledgeStatusOptions
	template?: RecordIdString
	updated: IsoAutoDateString
	version?: string
}

export type LegalProvisionsRecord<Tderived_keywords = unknown> = {
	anchor?: string
	cap?: string
	case_number?: string
	citation?: string
	court?: string
	created: IsoAutoDateString
	decision_date?: IsoDateString
	derived_keywords?: null | Tderived_keywords
	derived_summary?: string
	embedding?: string
	embedding_model?: string
	id: string
	jurisdiction?: string
	path?: string
	seq?: number
	source: string
	text: string
	title?: string
	updated: IsoAutoDateString
}

export const LegalSourcesTypeOptions = {
	"case": "case",
	"constitution": "constitution",
	"act": "act",
	"statutory_instrument": "statutory_instrument",
	"rules": "rules",
	"practice_direction": "practice_direction",
} as const
export type LegalSourcesTypeOptions = typeof LegalSourcesTypeOptions[keyof typeof LegalSourcesTypeOptions]

export const LegalSourcesStatusOptions = {
	"pending": "pending",
	"processing": "processing",
	"ingested": "ingested",
	"failed": "failed",
	"needs_review": "needs_review",
} as const
export type LegalSourcesStatusOptions = typeof LegalSourcesStatusOptions[keyof typeof LegalSourcesStatusOptions]
export type LegalSourcesRecord<Tamended_by = unknown, Tholdings = unknown, Tjudges = unknown, Tparties = unknown, Tsubjects = unknown> = {
	act_number?: string
	amended_by?: null | Tamended_by
	as_at?: IsoDateString
	cap?: string
	case_number?: string
	catalogue_id?: string
	citation?: string
	commencement_date?: IsoDateString
	content_hash?: string
	court?: string
	created: IsoAutoDateString
	created_by?: string
	decision_date?: IsoDateString
	error?: string
	fetched_at?: IsoDateString
	file?: FileNameString
	filename?: string
	headnote?: string
	holdings?: null | Tholdings
	id: string
	judges?: null | Tjudges
	jurisdiction?: string
	licence?: string
	mime?: string
	ocr?: boolean
	outcome?: string
	pages?: string
	parties?: null | Tparties
	provider?: string
	provisions_count?: number
	remote?: boolean
	repealed?: boolean
	s3_bucket?: string
	s3_key?: string
	s3_url?: string
	short_id?: string
	source_format?: string
	source_url?: string
	status: LegalSourcesStatusOptions
	subjects?: null | Tsubjects
	text?: string
	title: string
	type: LegalSourcesTypeOptions
	updated: IsoAutoDateString
	volume?: string
}

export const LegalVolumeImportsStatusOptions = {
	"staged": "staged",
	"committed": "committed",
} as const
export type LegalVolumeImportsStatusOptions = typeof LegalVolumeImportsStatusOptions[keyof typeof LegalVolumeImportsStatusOptions]
export type LegalVolumeImportsRecord<Tspans = unknown> = {
	as_at?: IsoDateString
	content_hash?: string
	created: IsoAutoDateString
	created_by?: string
	created_count?: number
	file?: FileNameString
	filename?: string
	id: string
	mime?: string
	ocr?: boolean
	spans?: null | Tspans
	status: LegalVolumeImportsStatusOptions
	text?: string
	updated: IsoAutoDateString
	volume?: string
	works_count?: number
}

export type MatterActionEventsRecord<Taction = unknown, Tinput = unknown, Toutput = unknown> = {
	action?: null | Taction
	created: IsoAutoDateString
	id: string
	input?: null | Tinput
	matter?: RecordIdString
	output?: null | Toutput
	updated: IsoAutoDateString
}

export const MatterImportsSourceKindOptions = {
	"upload": "upload",
	"extension": "extension",
	"authorized-server": "authorized-server",
} as const
export type MatterImportsSourceKindOptions = typeof MatterImportsSourceKindOptions[keyof typeof MatterImportsSourceKindOptions]
export type MatterImportsRecord<Tsummary = unknown> = {
	committed?: boolean
	committedAt?: IsoDateString
	contentHash?: string
	created: IsoAutoDateString
	id: string
	mattersCreated?: RecordIdString[]
	mattersUpdated?: RecordIdString[]
	organisation?: RecordIdString
	sourceKind?: MatterImportsSourceKindOptions
	sourceLabel?: string
	summary?: null | Tsummary
	updated: IsoAutoDateString
	user: RecordIdString
}

export const MattersTriggerStatusOptions = {
	"confirmed": "confirmed",
	"provisional": "provisional",
} as const
export type MattersTriggerStatusOptions = typeof MattersTriggerStatusOptions[keyof typeof MattersTriggerStatusOptions]

export const MattersRelationshipOptions = {
	"interlocutory_application": "interlocutory_application",
	"appeal": "appeal",
	"taxation": "taxation",
	"execution": "execution",
} as const
export type MattersRelationshipOptions = typeof MattersRelationshipOptions[keyof typeof MattersRelationshipOptions]

export const MattersStatusOptions = {
	"active": "active",
	"closed": "closed",
	"archived": "archived",
} as const
export type MattersStatusOptions = typeof MattersStatusOptions[keyof typeof MattersStatusOptions]
export type MattersRecord<TeccmisData = unknown, TeccmisSnapshot = unknown, TextraFields = unknown, TfieldValues = unknown, TopposingCounsel = unknown, Tparties = unknown, TpartyConfig = unknown, Trepresenting = unknown, Tstate = unknown> = {
	applicationType?: string
	caseNumber?: string
	closedAt?: IsoDateString
	closureReason?: string
	court?: RecordIdString
	created: IsoAutoDateString
	eccmisCaseInstanceId?: number
	eccmisData?: null | TeccmisData
	eccmisSnapshot?: null | TeccmisSnapshot
	extraFields?: null | TextraFields
	fieldValues?: null | TfieldValues
	id: string
	judges?: RecordIdString[]
	members?: RecordIdString[]
	name?: string
	opposingCounsel?: null | TopposingCounsel
	organisation?: RecordIdString
	owner?: RecordIdString
	parent?: RecordIdString
	parties?: null | Tparties
	partyConfig?: null | TpartyConfig
	personal?: boolean
	relationship?: MattersRelationshipOptions
	reminderInbox?: boolean
	representing?: null | Trepresenting
	spawnedFrom?: string
	state?: null | Tstate
	status?: MattersStatusOptions
	supervisors?: RecordIdString[]
	template?: RecordIdString
	triggerDate?: IsoDateString
	triggerDateName?: string
	triggerDatePrompt?: string
	triggerId?: string
	triggerStatus?: MattersTriggerStatusOptions
	updated: IsoAutoDateString
}

export const NotificationsChannelsOptions = {
	"APP": "APP",
	"EMAIL": "EMAIL",
	"PUSH": "PUSH",
	"SMS": "SMS",
} as const
export type NotificationsChannelsOptions = typeof NotificationsChannelsOptions[keyof typeof NotificationsChannelsOptions]
export type NotificationsRecord<Tactions = unknown, Tmetadata = unknown> = {
	actions?: null | Tactions
	avatar?: string
	body?: string
	bodyHTML?: HTMLString
	channels?: NotificationsChannelsOptions[]
	created: IsoAutoDateString
	fullMessage?: string
	id: string
	link?: string
	metadata?: null | Tmetadata
	organisation?: RecordIdString
	read?: boolean
	recipient?: RecordIdString
	sent?: boolean
	title?: string
	type?: string
	updated: IsoAutoDateString
}

export const OrganisationDirectInvitesStatusOptions = {
	"pending": "pending",
	"accepted": "accepted",
	"rejected": "rejected",
	"expired": "expired",
} as const
export type OrganisationDirectInvitesStatusOptions = typeof OrganisationDirectInvitesStatusOptions[keyof typeof OrganisationDirectInvitesStatusOptions]

export const OrganisationDirectInvitesRoleOptions = {
	"member": "member",
	"admin": "admin",
	"moderator": "moderator",
} as const
export type OrganisationDirectInvitesRoleOptions = typeof OrganisationDirectInvitesRoleOptions[keyof typeof OrganisationDirectInvitesRoleOptions]

export const OrganisationDirectInvitesOrganisationRoleOptions = {
	"partner": "partner",
	"senior_associate": "senior_associate",
	"associate": "associate",
	"paralegal": "paralegal",
	"intern": "intern",
} as const
export type OrganisationDirectInvitesOrganisationRoleOptions = typeof OrganisationDirectInvitesOrganisationRoleOptions[keyof typeof OrganisationDirectInvitesOrganisationRoleOptions]
export type OrganisationDirectInvitesRecord = {
	acceptedAt?: IsoDateString
	avatar?: string
	created: IsoAutoDateString
	email: string
	expiresAt?: IsoDateString
	id: string
	inviteCode?: string
	invitedBy?: RecordIdString
	name?: string
	organisation?: RecordIdString
	organisationRole?: OrganisationDirectInvitesOrganisationRoleOptions
	role?: OrganisationDirectInvitesRoleOptions
	status?: OrganisationDirectInvitesStatusOptions
	token?: string
	updated: IsoAutoDateString
}

export type OrganisationsRecord<Tfeature_overrides = unknown> = {
	accessGrantedUntil?: IsoDateString
	activeSubscription?: RecordIdString
	active_seats?: number
	admins?: RecordIdString[]
	ai_overage_credits?: number
	billingArrangement?: string
	billingSuspended?: boolean
	billing_status?: string
	contact_email?: string
	contact_name?: string
	contact_phoneNumber?: string
	created: IsoAutoDateString
	deleted?: boolean
	deletedAt?: IsoDateString
	emailDomain?: string
	feature_overrides?: null | Tfeature_overrides
	id: string
	lago_customer_id?: string
	lago_subscription_id?: string
	last_synced_to_lago?: IsoDateString
	name?: string
	seats?: number
	updated: IsoAutoDateString
	users?: RecordIdString[]
}

export const OrganisationUserPermissionsPermissionsOptions = {
	"canCreateMatters": "canCreateMatters",
	"canDeleteMatters": "canDeleteMatters",
	"canViewExternalMatters": "canViewExternalMatters",
	"canCreateApplications": "canCreateApplications",
	"canManageTemplates": "canManageTemplates",
} as const
export type OrganisationUserPermissionsPermissionsOptions = typeof OrganisationUserPermissionsPermissionsOptions[keyof typeof OrganisationUserPermissionsPermissionsOptions]

export const OrganisationUserPermissionsOrganisationRoleOptions = {
	"partner": "partner",
	"senior_associate": "senior_associate",
	"associate": "associate",
	"paralegal": "paralegal",
	"intern": "intern",
} as const
export type OrganisationUserPermissionsOrganisationRoleOptions = typeof OrganisationUserPermissionsOrganisationRoleOptions[keyof typeof OrganisationUserPermissionsOrganisationRoleOptions]
export type OrganisationUserPermissionsRecord = {
	created: IsoAutoDateString
	id: string
	organisation?: RecordIdString
	organisationRole?: OrganisationUserPermissionsOrganisationRoleOptions
	permissions?: OrganisationUserPermissionsPermissionsOptions[]
	updated: IsoAutoDateString
	user?: RecordIdString
}

export type OTPsRecord = {
	code?: string
	created: IsoAutoDateString
	id: string
	ttl?: number
	updated: IsoAutoDateString
	user?: RecordIdString
}

export type PaymentRefsRecord<Tdata = unknown> = {
	created: IsoAutoDateString
	data?: null | Tdata
	id: string
	paymentRequest?: RecordIdString
	updated: IsoAutoDateString
	uuid?: string
}

export const PaymentRequestsStatusOptions = {
	"PENDING": "PENDING",
	"PAID": "PAID",
	"FAILED": "FAILED",
	"CANCELLED": "CANCELLED",
} as const
export type PaymentRequestsStatusOptions = typeof PaymentRequestsStatusOptions[keyof typeof PaymentRequestsStatusOptions]

export const PaymentRequestsTypeOptions = {
	"MOBILE_MONEY": "MOBILE_MONEY",
	"CARD": "CARD",
	"MANUAL": "MANUAL",
} as const
export type PaymentRequestsTypeOptions = typeof PaymentRequestsTypeOptions[keyof typeof PaymentRequestsTypeOptions]
export type PaymentRequestsRecord<Tresponse = unknown> = {
	TIN?: string
	amount?: number
	created: IsoAutoDateString
	id: string
	lago_invoice_id?: string
	number?: string
	paid_at?: IsoDateString
	reference?: string
	response?: null | Tresponse
	retries?: number
	status?: PaymentRequestsStatusOptions
	subscription?: RecordIdString
	type?: PaymentRequestsTypeOptions
	updated: IsoAutoDateString
	webhook_token?: string
}

export type PaymentsRecord<Traw = unknown> = {
	amount?: number
	amountSettled?: number
	callbackToken?: string
	confirmedBy?: string
	created: IsoAutoDateString
	currency: string
	externalRef?: string
	failureReason?: string
	id: string
	initiatedAt?: IsoDateString
	invoice: string
	method: string
	provider: string
	providerRef?: string
	providerTxnId?: string
	raw?: null | Traw
	redirectUrl?: string
	reference: string
	settledAt?: IsoDateString
	status: string
	updated: IsoAutoDateString
}

export type ProcedureVersionsRecord<Ttemplate = unknown> = {
	author?: RecordIdString
	created: IsoAutoDateString
	id: string
	name?: string
	note?: string
	procedure: RecordIdString
	seq?: number
	template?: null | Ttemplate
	version?: string
}

export type PromotionalMattersRecord<Tdeadlines = unknown, TfieldValues = unknown> = {
	active?: boolean
	created: IsoAutoDateString
	deadlines?: null | Tdeadlines
	fieldValues?: null | TfieldValues
	id: string
	name?: string
	triggerDate?: IsoDateString
	type?: string
	updated: IsoAutoDateString
}

export type RegistrarsRecord = {
	court?: RecordIdString
	created: IsoAutoDateString
	id: string
	name?: string
	role?: string
	updated: IsoAutoDateString
}

export const ReminderAuditLogEventOptions = {
	"created": "created",
	"claimed": "claimed",
	"sent": "sent",
	"failed": "failed",
	"retried": "retried",
	"system_recovery": "system_recovery",
} as const
export type ReminderAuditLogEventOptions = typeof ReminderAuditLogEventOptions[keyof typeof ReminderAuditLogEventOptions]
export type ReminderAuditLogRecord<Tdetails = unknown> = {
	created: IsoAutoDateString
	details?: null | Tdetails
	event?: ReminderAuditLogEventOptions
	id: string
	job?: RecordIdString
	timestamp?: IsoDateString
	updated: IsoAutoDateString
	workerId?: string
}

export const ReminderEscalationAuditLogEventOptions = {
	"created": "created",
	"claimed": "claimed",
	"sent": "sent",
	"failed": "failed",
	"retried": "retried",
	"system_recovery": "system_recovery",
	"supervisor_alerted": "supervisor_alerted",
} as const
export type ReminderEscalationAuditLogEventOptions = typeof ReminderEscalationAuditLogEventOptions[keyof typeof ReminderEscalationAuditLogEventOptions]
export type ReminderEscalationAuditLogRecord<Tdetails = unknown> = {
	created: IsoAutoDateString
	details?: null | Tdetails
	event?: ReminderEscalationAuditLogEventOptions
	id: string
	job?: RecordIdString
	timestamp?: IsoDateString
	updated: IsoAutoDateString
	workerId?: string
}

export const ReminderJobsStatusOptions = {
	"pending": "pending",
	"processing": "processing",
	"sent": "sent",
	"failed": "failed",
	"skipped": "skipped",
} as const
export type ReminderJobsStatusOptions = typeof ReminderJobsStatusOptions[keyof typeof ReminderJobsStatusOptions]

export const ReminderJobsChannelsOptions = {
	"EMAIL": "EMAIL",
	"APP": "APP",
	"PUSH": "PUSH",
	"SMS": "SMS",
} as const
export type ReminderJobsChannelsOptions = typeof ReminderJobsChannelsOptions[keyof typeof ReminderJobsChannelsOptions]
export type ReminderJobsRecord = {
	attempts?: number
	channels?: ReminderJobsChannelsOptions[]
	created: IsoAutoDateString
	id: string
	idempotencyKey?: string
	lastAttemptAt?: IsoDateString
	lastError?: string
	lockedUntil?: IsoDateString
	nextRetryAt?: IsoDateString
	processedBy?: string
	reminder?: RecordIdString
	scheduledAt?: IsoDateString
	status?: ReminderJobsStatusOptions
	updated: IsoAutoDateString
	user?: RecordIdString
}

export const RemindersStatusOptions = {
	"pending": "pending",
	"done": "done",
	"cancelled": "cancelled",
} as const
export type RemindersStatusOptions = typeof RemindersStatusOptions[keyof typeof RemindersStatusOptions]
export type RemindersRecord = {
	atTime?: string
	created: IsoAutoDateString
	engagement?: RecordIdString
	id: string
	matter?: RecordIdString
	mode?: string
	organisation?: RecordIdString
	owner: RecordIdString
	recipients?: RecordIdString[]
	status?: RemindersStatusOptions
	targetDate?: IsoDateString
	timezone?: string
	title?: string
	updated: IsoAutoDateString
}

export const SeatEventsEventOptions = {
	"add": "add",
	"remove": "remove",
} as const
export type SeatEventsEventOptions = typeof SeatEventsEventOptions[keyof typeof SeatEventsEventOptions]
export type SeatEventsRecord = {
	created: IsoAutoDateString
	event?: SeatEventsEventOptions
	id: string
	lago_transaction_id?: string
	organisation?: RecordIdString
	synced_to_lago?: boolean
	updated: IsoAutoDateString
	user?: RecordIdString
}

export type SubscriptionPlansRecord = {
	created: IsoAutoDateString
	disableFreeTrial?: boolean
	id: string
	index?: number
	isCustomPan?: boolean
	lago_plan_code?: string
	lago_plan_id?: string
	maxSeats?: number
	minSeats?: number
	name?: string
	perSeatAnnually?: number
	perSeatMonthly?: number
	subtitle?: string
	updated: IsoAutoDateString
}

export const SubscriptionsTypeOptions = {
	"individual": "individual",
	"organisation": "organisation",
} as const
export type SubscriptionsTypeOptions = typeof SubscriptionsTypeOptions[keyof typeof SubscriptionsTypeOptions]

export const SubscriptionsPaymentStatusOptions = {
	"pending": "pending",
	"failed": "failed",
	"complete": "complete",
	"cancelled": "cancelled",
} as const
export type SubscriptionsPaymentStatusOptions = typeof SubscriptionsPaymentStatusOptions[keyof typeof SubscriptionsPaymentStatusOptions]

export const SubscriptionsPaymentMethodOptions = {
	"MOBILE_MONEY": "MOBILE_MONEY",
	"CARD": "CARD",
	"MANUAL": "MANUAL",
} as const
export type SubscriptionsPaymentMethodOptions = typeof SubscriptionsPaymentMethodOptions[keyof typeof SubscriptionsPaymentMethodOptions]
export type SubscriptionsRecord<Tmeta = unknown> = {
	active?: boolean
	amount?: number
	created: IsoAutoDateString
	endDate?: IsoDateString
	id: string
	individual?: RecordIdString
	meta?: null | Tmeta
	mobileMoneyNumber?: string
	organisation?: RecordIdString
	paymentMethod?: SubscriptionsPaymentMethodOptions
	paymentStatus?: SubscriptionsPaymentStatusOptions
	plan?: RecordIdString
	reference?: string
	seats?: number
	startDate?: IsoDateString
	trial?: boolean
	type?: SubscriptionsTypeOptions
	updated: IsoAutoDateString
}

export type UserPreferencesRecord = {
	created: IsoAutoDateString
	id: string
	reminder_time?: string
	updated: IsoAutoDateString
	use_app_notifications?: boolean
	use_email_notifications?: boolean
	use_push_notifications?: boolean
	use_sms_notifications?: boolean
	user?: RecordIdString
}

export const UsersAiProviderOptions = {
	"claude": "claude",
	"deepseek": "deepseek",
} as const
export type UsersAiProviderOptions = typeof UsersAiProviderOptions[keyof typeof UsersAiProviderOptions]
export type UsersRecord = {
	accessGrantedUntil?: IsoDateString
	activeSubscription?: RecordIdString
	ai_overage_credits?: number
	ai_provider?: UsersAiProviderOptions
	avatar?: string
	billingArrangement?: string
	billingSuspended?: boolean
	billing_status?: string
	created: IsoAutoDateString
	deleted?: boolean
	deletedAt?: IsoDateString
	email: string
	emailVisibility?: boolean
	id: string
	lago_customer_id?: string
	lago_subscription_id?: string
	lastActiveAt?: IsoDateString
	name: string
	online?: boolean
	organisation?: RecordIdString
	password: string
	phone?: string
	preferences?: RecordIdString
	profilePhoto?: FileNameString
	timezone?: string
	timezoneOffset?: number
	tokenKey: string
	updated: IsoAutoDateString
	username?: string
	verified?: boolean
	voiceAgentId?: string
}

// Response types include system fields and match responses from the PocketBase API
export type AuthoriginsResponse<Texpand = unknown> = Required<AuthoriginsRecord> & BaseSystemFields<Texpand>
export type ExternalauthsResponse<Texpand = unknown> = Required<ExternalauthsRecord> & BaseSystemFields<Texpand>
export type MfasResponse<Texpand = unknown> = Required<MfasRecord> & BaseSystemFields<Texpand>
export type OtpsResponse<Texpand = unknown> = Required<OtpsRecord> & BaseSystemFields<Texpand>
export type SuperusersResponse<Texpand = unknown> = Required<SuperusersRecord> & AuthSystemFields<Texpand>
export type AiAuditLogResponse<Tcitations = unknown, Trefs = unknown, Texpand = unknown> = Required<AiAuditLogRecord<Tcitations, Trefs>> & BaseSystemFields<Texpand>
export type AiChatAttachmentsResponse<Texpand = unknown> = Required<AiChatAttachmentsRecord> & BaseSystemFields<Texpand>
export type AiConversationsResponse<Tmessages = unknown, Ttree = unknown, Texpand = unknown> = Required<AiConversationsRecord<Tmessages, Ttree>> & BaseSystemFields<Texpand>
export type AiDeepTasksResponse<TattachmentNames = unknown, Tattachments = unknown, Tauthored = unknown, Tnotes = unknown, Toutline = unknown, Tscope = unknown, Tsources = unknown, Tsteps = unknown, Texpand = unknown> = Required<AiDeepTasksRecord<TattachmentNames, Tattachments, Tauthored, Tnotes, Toutline, Tscope, Tsources, Tsteps>> & BaseSystemFields<Texpand>
export type AiFormsResponse<Tfields = unknown, Tsettings = unknown, Texpand = unknown> = Required<AiFormsRecord<Tfields, Tsettings>> & BaseSystemFields<Texpand>
export type AiFormSubmissionsResponse<Tvalues = unknown, Texpand = unknown> = Required<AiFormSubmissionsRecord<Tvalues>> & BaseSystemFields<Texpand>
export type AiMemoriesResponse<Tprovenance = unknown, Ttags = unknown, Texpand = unknown> = Required<AiMemoriesRecord<Tprovenance, Ttags>> & BaseSystemFields<Texpand>
export type AiResearchFindingsResponse<Tcontradicts = unknown, Tsource_chain = unknown, Ttags = unknown, Texpand = unknown> = Required<AiResearchFindingsRecord<Tcontradicts, Tsource_chain, Ttags>> & BaseSystemFields<Texpand>
export type AiSkillsResponse<Texamples = unknown, Ttool_bindings = unknown, Texpand = unknown> = Required<AiSkillsRecord<Texamples, Ttool_bindings>> & BaseSystemFields<Texpand>
export type AiUsageResponse<Texpand = unknown> = Required<AiUsageRecord> & BaseSystemFields<Texpand>
export type AiVaultDocumentsResponse<Texpand = unknown> = Required<AiVaultDocumentsRecord> & BaseSystemFields<Texpand>
export type AiVaultFoldersResponse<Texpand = unknown> = Required<AiVaultFoldersRecord> & BaseSystemFields<Texpand>
export type AiVaultMembersResponse<Tcaps = unknown, Texpand = unknown> = Required<AiVaultMembersRecord<Tcaps>> & BaseSystemFields<Texpand>
export type AiVaultsResponse<Texpand = unknown> = Required<AiVaultsRecord> & BaseSystemFields<Texpand>
export type AiWorkflowRunsResponse<Tcontext = unknown, Toutcome = unknown, Texpand = unknown> = Required<AiWorkflowRunsRecord<Tcontext, Toutcome>> & BaseSystemFields<Texpand>
export type AiWorkflowsResponse<Tresource_access = unknown, Tsettings = unknown, Tsteps = unknown, Ttrigger = unknown, Texpand = unknown> = Required<AiWorkflowsRecord<Tresource_access, Tsettings, Tsteps, Ttrigger>> & BaseSystemFields<Texpand>
export type AiWorkflowStepLogResponse<Tapproval = unknown, Tresolved_input = unknown, Tresult = unknown, Texpand = unknown> = Required<AiWorkflowStepLogRecord<Tapproval, Tresolved_input, Tresult>> & BaseSystemFields<Texpand>
export type ApplicationsResponse<TfieldValues = unknown, TopposingCounsel = unknown, Tparties = unknown, TpartyConfig = unknown, Trepresenting = unknown, Tstate = unknown, Texpand = unknown> = Required<ApplicationsRecord<TfieldValues, TopposingCounsel, Tparties, TpartyConfig, Trepresenting, Tstate>> & BaseSystemFields<Texpand>
export type AvatarsResponse<Texpand = unknown> = Required<AvatarsRecord> & BaseSystemFields<Texpand>
export type CaseLawCatalogueSyncResponse<Texpand = unknown> = Required<CaseLawCatalogueSyncRecord> & BaseSystemFields<Texpand>
export type ClerksResponse<Texpand = unknown> = Required<ClerksRecord> & BaseSystemFields<Texpand>
export type ComplianceFilingsResponse<Texpand = unknown> = Required<ComplianceFilingsRecord> & BaseSystemFields<Texpand>
export type ComplianceObligationsResponse<Texpand = unknown> = Required<ComplianceObligationsRecord> & BaseSystemFields<Texpand>
export type ConciergeLeadsResponse<Texpand = unknown> = Required<ConciergeLeadsRecord> & BaseSystemFields<Texpand>
export type CourtsResponse<Texpand = unknown> = Required<CourtsRecord> & BaseSystemFields<Texpand>
export type DeCalendarVersionsResponse<Tdata = unknown, Texpand = unknown> = Required<DeCalendarVersionsRecord<Tdata>> & BaseSystemFields<Texpand>
export type DeMatterEventsResponse<Texpand = unknown> = Required<DeMatterEventsRecord> & BaseSystemFields<Texpand>
export type DeMatterSnapshotsResponse<Tsnapshot = unknown, Texpand = unknown> = Required<DeMatterSnapshotsRecord<Tsnapshot>> & BaseSystemFields<Texpand>
export type DeMattersResponse<Tfields = unknown, Tparties = unknown, Texpand = unknown> = Required<DeMattersRecord<Tfields, Tparties>> & BaseSystemFields<Texpand>
export type DeTemplateVersionsResponse<Tir = unknown, Texpand = unknown> = Required<DeTemplateVersionsRecord<Tir>> & BaseSystemFields<Texpand>
export type DeadlineAdjournmentsResponse<Texpand = unknown> = Required<DeadlineAdjournmentsRecord> & BaseSystemFields<Texpand>
export type DeadlineEventsResponse<Texpand = unknown> = Required<DeadlineEventsRecord> & BaseSystemFields<Texpand>
export type DeadlineRemindersResponse<Texpand = unknown> = Required<DeadlineRemindersRecord> & BaseSystemFields<Texpand>
export type DeadlinesResponse<Tparty_context = unknown, TreminderOffsets = unknown, Trules = unknown, Texpand = unknown> = Required<DeadlinesRecord<Tparty_context, TreminderOffsets, Trules>> & BaseSystemFields<Texpand>
export type DeadlineTemplateAuthorsResponse<Texpand = unknown> = Required<DeadlineTemplateAuthorsRecord> & BaseSystemFields<Texpand>
export type DeadlineTemplatesResponse<Tchangelog = unknown, Ttags = unknown, Ttemplate = unknown, Texpand = unknown> = Required<DeadlineTemplatesRecord<Tchangelog, Ttags, Ttemplate>> & BaseSystemFields<Texpand>
export type DeviceTokensResponse<Tdevice_info = unknown, Texpand = unknown> = Required<DeviceTokensRecord<Tdevice_info>> & BaseSystemFields<Texpand>
export type EccmisConnectionsResponse<TusageLog = unknown, Texpand = unknown> = Required<EccmisConnectionsRecord<TusageLog>> & BaseSystemFields<Texpand>
export type EccmisEventsResponse<Tdetail = unknown, Texpand = unknown> = Required<EccmisEventsRecord<Tdetail>> & BaseSystemFields<Texpand>
export type EccmisHolidaysResponse<Texpand = unknown> = Required<EccmisHolidaysRecord> & BaseSystemFields<Texpand>
export type EccmisPaymentsResponse<Tdetail = unknown, Texpand = unknown> = Required<EccmisPaymentsRecord<Tdetail>> & BaseSystemFields<Texpand>
export type EmailBusResponse<Texpand = unknown> = Required<EmailBusRecord> & BaseSystemFields<Texpand>
export type EngagementMilestonesResponse<TreminderChannels = unknown, TreminderOffsets = unknown, Texpand = unknown> = Required<EngagementMilestonesRecord<TreminderChannels, TreminderOffsets>> & BaseSystemFields<Texpand>
export type EngagementsResponse<TextraFields = unknown, TfieldValues = unknown, Tparties = unknown, TstageStatus = unknown, Texpand = unknown> = Required<EngagementsRecord<TextraFields, TfieldValues, Tparties, TstageStatus>> & BaseSystemFields<Texpand>
export type EngagementTemplatesResponse<Tdata = unknown, Texpand = unknown> = Required<EngagementTemplatesRecord<Tdata>> & BaseSystemFields<Texpand>
export type EngagementTemplateVersionsResponse<Tdata = unknown, Texpand = unknown> = Required<EngagementTemplateVersionsRecord<Tdata>> & BaseSystemFields<Texpand>
export type FirmsResponse<Tmeta = unknown, Texpand = unknown> = Required<FirmsRecord<Tmeta>> & BaseSystemFields<Texpand>
export type GeneratedDocumentsResponse<Tir = unknown, Texpand = unknown> = Required<GeneratedDocumentsRecord<Tir>> & BaseSystemFields<Texpand>
export type HelpArticlesResponse<Trelated = unknown, Ttags = unknown, Texpand = unknown> = Required<HelpArticlesRecord<Trelated, Ttags>> & BaseSystemFields<Texpand>
export type HelpCategoriesResponse<Texpand = unknown> = Required<HelpCategoriesRecord> & BaseSystemFields<Texpand>
export type HelpFeedbackResponse<Texpand = unknown> = Required<HelpFeedbackRecord> & BaseSystemFields<Texpand>
export type InvoicesResponse<Tlines = unknown, Texpand = unknown> = Required<InvoicesRecord<Tlines>> & BaseSystemFields<Texpand>
export type JobNotificationsResponse<Tactions = unknown, Tmetadata = unknown, Texpand = unknown> = Required<JobNotificationsRecord<Tactions, Tmetadata>> & BaseSystemFields<Texpand>
export type JudgesResponse<Texpand = unknown> = Required<JudgesRecord> & BaseSystemFields<Texpand>
export type LedgerEntriesResponse<Tmeta = unknown, Texpand = unknown> = Required<LedgerEntriesRecord<Tmeta>> & BaseSystemFields<Texpand>
export type LegalCitationsResponse<Texpand = unknown> = Required<LegalCitationsRecord> & BaseSystemFields<Texpand>
export type LegalKnowledgeResponse<TpackageJson = unknown, Texpand = unknown> = Required<LegalKnowledgeRecord<TpackageJson>> & BaseSystemFields<Texpand>
export type LegalProvisionsResponse<Tderived_keywords = unknown, Texpand = unknown> = Required<LegalProvisionsRecord<Tderived_keywords>> & BaseSystemFields<Texpand>
export type LegalSourcesResponse<Tamended_by = unknown, Tholdings = unknown, Tjudges = unknown, Tparties = unknown, Tsubjects = unknown, Texpand = unknown> = Required<LegalSourcesRecord<Tamended_by, Tholdings, Tjudges, Tparties, Tsubjects>> & BaseSystemFields<Texpand>
export type LegalVolumeImportsResponse<Tspans = unknown, Texpand = unknown> = Required<LegalVolumeImportsRecord<Tspans>> & BaseSystemFields<Texpand>
export type MatterActionEventsResponse<Taction = unknown, Tinput = unknown, Toutput = unknown, Texpand = unknown> = Required<MatterActionEventsRecord<Taction, Tinput, Toutput>> & BaseSystemFields<Texpand>
export type MatterImportsResponse<Tsummary = unknown, Texpand = unknown> = Required<MatterImportsRecord<Tsummary>> & BaseSystemFields<Texpand>
export type MattersResponse<TeccmisData = unknown, TeccmisSnapshot = unknown, TextraFields = unknown, TfieldValues = unknown, TopposingCounsel = unknown, Tparties = unknown, TpartyConfig = unknown, Trepresenting = unknown, Tstate = unknown, Texpand = unknown> = Required<MattersRecord<TeccmisData, TeccmisSnapshot, TextraFields, TfieldValues, TopposingCounsel, Tparties, TpartyConfig, Trepresenting, Tstate>> & BaseSystemFields<Texpand>
export type NotificationsResponse<Tactions = unknown, Tmetadata = unknown, Texpand = unknown> = Required<NotificationsRecord<Tactions, Tmetadata>> & BaseSystemFields<Texpand>
export type OrganisationDirectInvitesResponse<Texpand = unknown> = Required<OrganisationDirectInvitesRecord> & BaseSystemFields<Texpand>
export type OrganisationsResponse<Tfeature_overrides = unknown, Texpand = unknown> = Required<OrganisationsRecord<Tfeature_overrides>> & BaseSystemFields<Texpand>
export type OrganisationUserPermissionsResponse<Texpand = unknown> = Required<OrganisationUserPermissionsRecord> & BaseSystemFields<Texpand>
export type OTPsResponse<Texpand = unknown> = Required<OTPsRecord> & BaseSystemFields<Texpand>
export type PaymentRefsResponse<Tdata = unknown, Texpand = unknown> = Required<PaymentRefsRecord<Tdata>> & BaseSystemFields<Texpand>
export type PaymentRequestsResponse<Tresponse = unknown, Texpand = unknown> = Required<PaymentRequestsRecord<Tresponse>> & BaseSystemFields<Texpand>
export type PaymentsResponse<Traw = unknown, Texpand = unknown> = Required<PaymentsRecord<Traw>> & BaseSystemFields<Texpand>
export type ProcedureVersionsResponse<Ttemplate = unknown, Texpand = unknown> = Required<ProcedureVersionsRecord<Ttemplate>> & BaseSystemFields<Texpand>
export type PromotionalMattersResponse<Tdeadlines = unknown, TfieldValues = unknown, Texpand = unknown> = Required<PromotionalMattersRecord<Tdeadlines, TfieldValues>> & BaseSystemFields<Texpand>
export type RegistrarsResponse<Texpand = unknown> = Required<RegistrarsRecord> & BaseSystemFields<Texpand>
export type ReminderAuditLogResponse<Tdetails = unknown, Texpand = unknown> = Required<ReminderAuditLogRecord<Tdetails>> & BaseSystemFields<Texpand>
export type ReminderEscalationAuditLogResponse<Tdetails = unknown, Texpand = unknown> = Required<ReminderEscalationAuditLogRecord<Tdetails>> & BaseSystemFields<Texpand>
export type ReminderJobsResponse<Texpand = unknown> = Required<ReminderJobsRecord> & BaseSystemFields<Texpand>
export type RemindersResponse<Texpand = unknown> = Required<RemindersRecord> & BaseSystemFields<Texpand>
export type SeatEventsResponse<Texpand = unknown> = Required<SeatEventsRecord> & BaseSystemFields<Texpand>
export type SubscriptionPlansResponse<Texpand = unknown> = Required<SubscriptionPlansRecord> & BaseSystemFields<Texpand>
export type SubscriptionsResponse<Tmeta = unknown, Texpand = unknown> = Required<SubscriptionsRecord<Tmeta>> & BaseSystemFields<Texpand>
export type UserPreferencesResponse<Texpand = unknown> = Required<UserPreferencesRecord> & BaseSystemFields<Texpand>
export type UsersResponse<Texpand = unknown> = Required<UsersRecord> & AuthSystemFields<Texpand>

// Types containing all Records and Responses, useful for creating typing helper functions

export type CollectionRecords = {
	_authOrigins: AuthoriginsRecord
	_externalAuths: ExternalauthsRecord
	_mfas: MfasRecord
	_otps: OtpsRecord
	_superusers: SuperusersRecord
	AiAuditLog: AiAuditLogRecord
	AiChatAttachments: AiChatAttachmentsRecord
	AiConversations: AiConversationsRecord
	AiDeepTasks: AiDeepTasksRecord
	AiForms: AiFormsRecord
	AiFormSubmissions: AiFormSubmissionsRecord
	AiMemories: AiMemoriesRecord
	AiResearchFindings: AiResearchFindingsRecord
	AiSkills: AiSkillsRecord
	AiUsage: AiUsageRecord
	AiVaultDocuments: AiVaultDocumentsRecord
	AiVaultFolders: AiVaultFoldersRecord
	AiVaultMembers: AiVaultMembersRecord
	AiVaults: AiVaultsRecord
	AiWorkflowRuns: AiWorkflowRunsRecord
	AiWorkflows: AiWorkflowsRecord
	AiWorkflowStepLog: AiWorkflowStepLogRecord
	Applications: ApplicationsRecord
	Avatars: AvatarsRecord
	CaseLawCatalogueSync: CaseLawCatalogueSyncRecord
	Clerks: ClerksRecord
	ComplianceFilings: ComplianceFilingsRecord
	ComplianceObligations: ComplianceObligationsRecord
	ConciergeLeads: ConciergeLeadsRecord
	Courts: CourtsRecord
	de_calendar_versions: DeCalendarVersionsRecord
	de_matter_events: DeMatterEventsRecord
	de_matter_snapshots: DeMatterSnapshotsRecord
	de_matters: DeMattersRecord
	de_template_versions: DeTemplateVersionsRecord
	DeadlineAdjournments: DeadlineAdjournmentsRecord
	DeadlineEvents: DeadlineEventsRecord
	DeadlineReminders: DeadlineRemindersRecord
	Deadlines: DeadlinesRecord
	DeadlineTemplateAuthors: DeadlineTemplateAuthorsRecord
	DeadlineTemplates: DeadlineTemplatesRecord
	DeviceTokens: DeviceTokensRecord
	EccmisConnections: EccmisConnectionsRecord
	EccmisEvents: EccmisEventsRecord
	EccmisHolidays: EccmisHolidaysRecord
	EccmisPayments: EccmisPaymentsRecord
	EmailBus: EmailBusRecord
	EngagementMilestones: EngagementMilestonesRecord
	Engagements: EngagementsRecord
	EngagementTemplates: EngagementTemplatesRecord
	EngagementTemplateVersions: EngagementTemplateVersionsRecord
	Firms: FirmsRecord
	GeneratedDocuments: GeneratedDocumentsRecord
	HelpArticles: HelpArticlesRecord
	HelpCategories: HelpCategoriesRecord
	HelpFeedback: HelpFeedbackRecord
	Invoices: InvoicesRecord
	JobNotifications: JobNotificationsRecord
	Judges: JudgesRecord
	LedgerEntries: LedgerEntriesRecord
	LegalCitations: LegalCitationsRecord
	LegalKnowledge: LegalKnowledgeRecord
	LegalProvisions: LegalProvisionsRecord
	LegalSources: LegalSourcesRecord
	LegalVolumeImports: LegalVolumeImportsRecord
	MatterActionEvents: MatterActionEventsRecord
	MatterImports: MatterImportsRecord
	Matters: MattersRecord
	Notifications: NotificationsRecord
	OrganisationDirectInvites: OrganisationDirectInvitesRecord
	Organisations: OrganisationsRecord
	OrganisationUserPermissions: OrganisationUserPermissionsRecord
	OTPs: OTPsRecord
	PaymentRefs: PaymentRefsRecord
	PaymentRequests: PaymentRequestsRecord
	Payments: PaymentsRecord
	ProcedureVersions: ProcedureVersionsRecord
	PromotionalMatters: PromotionalMattersRecord
	Registrars: RegistrarsRecord
	ReminderAuditLog: ReminderAuditLogRecord
	ReminderEscalationAuditLog: ReminderEscalationAuditLogRecord
	ReminderJobs: ReminderJobsRecord
	Reminders: RemindersRecord
	SeatEvents: SeatEventsRecord
	SubscriptionPlans: SubscriptionPlansRecord
	Subscriptions: SubscriptionsRecord
	UserPreferences: UserPreferencesRecord
	Users: UsersRecord
}

export type CollectionResponses = {
	_authOrigins: AuthoriginsResponse
	_externalAuths: ExternalauthsResponse
	_mfas: MfasResponse
	_otps: OtpsResponse
	_superusers: SuperusersResponse
	AiAuditLog: AiAuditLogResponse
	AiChatAttachments: AiChatAttachmentsResponse
	AiConversations: AiConversationsResponse
	AiDeepTasks: AiDeepTasksResponse
	AiForms: AiFormsResponse
	AiFormSubmissions: AiFormSubmissionsResponse
	AiMemories: AiMemoriesResponse
	AiResearchFindings: AiResearchFindingsResponse
	AiSkills: AiSkillsResponse
	AiUsage: AiUsageResponse
	AiVaultDocuments: AiVaultDocumentsResponse
	AiVaultFolders: AiVaultFoldersResponse
	AiVaultMembers: AiVaultMembersResponse
	AiVaults: AiVaultsResponse
	AiWorkflowRuns: AiWorkflowRunsResponse
	AiWorkflows: AiWorkflowsResponse
	AiWorkflowStepLog: AiWorkflowStepLogResponse
	Applications: ApplicationsResponse
	Avatars: AvatarsResponse
	CaseLawCatalogueSync: CaseLawCatalogueSyncResponse
	Clerks: ClerksResponse
	ComplianceFilings: ComplianceFilingsResponse
	ComplianceObligations: ComplianceObligationsResponse
	ConciergeLeads: ConciergeLeadsResponse
	Courts: CourtsResponse
	de_calendar_versions: DeCalendarVersionsResponse
	de_matter_events: DeMatterEventsResponse
	de_matter_snapshots: DeMatterSnapshotsResponse
	de_matters: DeMattersResponse
	de_template_versions: DeTemplateVersionsResponse
	DeadlineAdjournments: DeadlineAdjournmentsResponse
	DeadlineEvents: DeadlineEventsResponse
	DeadlineReminders: DeadlineRemindersResponse
	Deadlines: DeadlinesResponse
	DeadlineTemplateAuthors: DeadlineTemplateAuthorsResponse
	DeadlineTemplates: DeadlineTemplatesResponse
	DeviceTokens: DeviceTokensResponse
	EccmisConnections: EccmisConnectionsResponse
	EccmisEvents: EccmisEventsResponse
	EccmisHolidays: EccmisHolidaysResponse
	EccmisPayments: EccmisPaymentsResponse
	EmailBus: EmailBusResponse
	EngagementMilestones: EngagementMilestonesResponse
	Engagements: EngagementsResponse
	EngagementTemplates: EngagementTemplatesResponse
	EngagementTemplateVersions: EngagementTemplateVersionsResponse
	Firms: FirmsResponse
	GeneratedDocuments: GeneratedDocumentsResponse
	HelpArticles: HelpArticlesResponse
	HelpCategories: HelpCategoriesResponse
	HelpFeedback: HelpFeedbackResponse
	Invoices: InvoicesResponse
	JobNotifications: JobNotificationsResponse
	Judges: JudgesResponse
	LedgerEntries: LedgerEntriesResponse
	LegalCitations: LegalCitationsResponse
	LegalKnowledge: LegalKnowledgeResponse
	LegalProvisions: LegalProvisionsResponse
	LegalSources: LegalSourcesResponse
	LegalVolumeImports: LegalVolumeImportsResponse
	MatterActionEvents: MatterActionEventsResponse
	MatterImports: MatterImportsResponse
	Matters: MattersResponse
	Notifications: NotificationsResponse
	OrganisationDirectInvites: OrganisationDirectInvitesResponse
	Organisations: OrganisationsResponse
	OrganisationUserPermissions: OrganisationUserPermissionsResponse
	OTPs: OTPsResponse
	PaymentRefs: PaymentRefsResponse
	PaymentRequests: PaymentRequestsResponse
	Payments: PaymentsResponse
	ProcedureVersions: ProcedureVersionsResponse
	PromotionalMatters: PromotionalMattersResponse
	Registrars: RegistrarsResponse
	ReminderAuditLog: ReminderAuditLogResponse
	ReminderEscalationAuditLog: ReminderEscalationAuditLogResponse
	ReminderJobs: ReminderJobsResponse
	Reminders: RemindersResponse
	SeatEvents: SeatEventsResponse
	SubscriptionPlans: SubscriptionPlansResponse
	Subscriptions: SubscriptionsResponse
	UserPreferences: UserPreferencesResponse
	Users: UsersResponse
}

// Utility types for create/update operations

type ProcessCreateAndUpdateFields<T> = Omit<{
	// Omit AutoDate fields
	[K in keyof T as Extract<T[K], IsoAutoDateString> extends never ? K : never]: 
		// Convert FileNameString to File
		T[K] extends infer U ? 
			U extends (FileNameString | FileNameString[]) ? 
				U extends any[] ? File[] : File 
			: U
		: never
}, 'id'>

// Create type for Auth collections
export type CreateAuth<T> = {
	id?: RecordIdString
	email: string
	emailVisibility?: boolean
	password: string
	passwordConfirm: string
	verified?: boolean
} & ProcessCreateAndUpdateFields<T>

// Create type for Base collections
export type CreateBase<T> = {
	id?: RecordIdString
} & ProcessCreateAndUpdateFields<T>

// Update type for Auth collections
export type UpdateAuth<T> = Partial<
	Omit<ProcessCreateAndUpdateFields<T>, keyof AuthSystemFields>
> & {
	email?: string
	emailVisibility?: boolean
	oldPassword?: string
	password?: string
	passwordConfirm?: string
	verified?: boolean
}

// Update type for Base collections
export type UpdateBase<T> = Partial<
	Omit<ProcessCreateAndUpdateFields<T>, keyof BaseSystemFields>
>

// Get the correct create type for any collection
export type Create<T extends keyof CollectionResponses> =
	CollectionResponses[T] extends AuthSystemFields
		? CreateAuth<CollectionRecords[T]>
		: CreateBase<CollectionRecords[T]>

// Get the correct update type for any collection
export type Update<T extends keyof CollectionResponses> =
	CollectionResponses[T] extends AuthSystemFields
		? UpdateAuth<CollectionRecords[T]>
		: UpdateBase<CollectionRecords[T]>

// Type for usage with type asserted PocketBase instance
// https://github.com/pocketbase/js-sdk#specify-typescript-definitions

export type TypedPocketBase = {
	collection<T extends keyof CollectionResponses>(
		idOrName: T
	): RecordService<CollectionResponses[T]>
} & PocketBase
