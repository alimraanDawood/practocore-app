/**
* This file was @generated using pocketbase-typegen
*/

import type PocketBase from 'pocketbase'
import type { RecordService } from 'pocketbase'

export enum Collections {
	Applications = "Applications",
	Avatars = "Avatars",
	Clerks = "Clerks",
	Courts = "Courts",
	DeadlineAdjournments = "DeadlineAdjournments",
	DeadlineEvents = "DeadlineEvents",
	DeadlineReminders = "DeadlineReminders",
	DeadlineTemplateAuthors = "DeadlineTemplateAuthors",
	DeadlineTemplates = "DeadlineTemplates",
	Deadlines = "Deadlines",
	DeviceTokens = "DeviceTokens",
	EmailBus = "EmailBus",
	Firms = "Firms",
	JobNotifications = "JobNotifications",
	Judges = "Judges",
	MatterActionEvents = "MatterActionEvents",
	Matters = "Matters",
	Notifications = "Notifications",
	OTPs = "OTPs",
	OrganisationDirectInvites = "OrganisationDirectInvites",
	OrganisationInviteReferences = "OrganisationInviteReferences",
	OrganisationInviteReferencesSanitized = "OrganisationInviteReferencesSanitized",
	OrganisationInviteRequests = "OrganisationInviteRequests",
	OrganisationUserPermissions = "OrganisationUserPermissions",
	Organisations = "Organisations",
	PaymentRefs = "PaymentRefs",
	PaymentRequests = "PaymentRequests",
	Registrars = "Registrars",
	ReminderAuditLog = "ReminderAuditLog",
	ReminderEscalationAuditLog = "ReminderEscalationAuditLog",
	ReminderJobs = "ReminderJobs",
	SeatEvents = "SeatEvents",
	SubscriptionPlans = "SubscriptionPlans",
	Subscriptions = "Subscriptions",
	UserPreferences = "UserPreferences",
	Users = "Users",
	Authorigins = "_authOrigins",
	Externalauths = "_externalAuths",
	Mfas = "_mfas",
	Otps = "_otps",
	Superusers = "_superusers",
}

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
	type?: string
	updated: IsoAutoDateString
}

export type AvatarsRecord = {
	created: IsoAutoDateString
	field?: FileNameString
	id: string
	updated: IsoAutoDateString
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

export type CourtsRecord = {
	created: IsoAutoDateString
	id: string
	name?: string
	order?: number
	updated: IsoAutoDateString
}

export type DeadlineAdjournmentsRecord = {
	created: IsoAutoDateString
	deadline?: RecordIdString
	from?: IsoDateString
	id: string
	reason?: string
	to?: IsoDateString
	updated: IsoAutoDateString
}

export enum DeadlineEventsStatusOptions {
	"pending" = "pending",
	"fulfilled" = "fulfilled",
	"unavailable" = "unavailable",
}
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

export enum DeadlineRemindersChannelsOptions {
	"EMAIL" = "EMAIL",
	"APP" = "APP",
	"PUSH" = "PUSH",
	"SMS" = "SMS",
}
export type DeadlineRemindersRecord = {
	acknowledgedBy?: RecordIdString[]
	active?: boolean
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
	requiresAcknowledgement?: boolean
	sent?: RecordIdString[]
	supervisorAlerted?: boolean
	supervisorAlertedAt?: IsoDateString
	title?: string
	updated: IsoAutoDateString
}

export type DeadlineTemplateAuthorsRecord = {
	avatar?: string
	id: string
	name: string
}

export enum DeadlineTemplatesStatusOptions {
	"draft" = "draft",
	"active" = "active",
	"deprecated" = "deprecated",
}

export enum DeadlineTemplatesPracticeAreaOptions {
	"civil_litigation" = "civil_litigation",
	"criminal_law" = "criminal_law",
	"family_law" = "family_law",
	"corporate_commercial" = "corporate_commercial",
	"intellectual_property" = "intellectual_property",
	"employment_law" = "employment_law",
	"real_estate" = "real_estate",
	"tax_law" = "tax_law",
	"immigration_law" = "immigration_law",
	"administrative_law" = "administrative_law",
	"bankruptcy_insolvency" = "bankruptcy_insolvency",
	"environmental_law" = "environmental_law",
	"other" = "other",
}

export enum DeadlineTemplatesCourtLevelOptions {
	"supreme_apex" = "supreme_apex",
	"appellate_high" = "appellate_high",
	"trial_district" = "trial_district",
	"specialized_tribunal" = "specialized_tribunal",
	"administrative_agency" = "administrative_agency",
	"arbitration_adr" = "arbitration_adr",
	"small_claims" = "small_claims",
	"other" = "other",
}

export enum DeadlineTemplatesComplexityOptions {
	"beginner" = "beginner",
	"intermediate" = "intermediate",
	"advanced" = "advanced",
	"expert" = "expert",
}
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
	id: string
	isPublic?: boolean
	language?: string
	matterType?: string
	name?: string
	order?: number
	organisation?: RecordIdString
	organisationName?: string
	practiceArea?: DeadlineTemplatesPracticeAreaOptions
	stateProvince?: string
	status?: DeadlineTemplatesStatusOptions
	tags?: null | Ttags
	template?: null | Ttemplate
	updated: IsoAutoDateString
	usageCount?: number
	version?: string
}

export enum DeadlinesStatusOptions {
	"pending" = "pending",
	"fulfilled" = "fulfilled",
	"overdue" = "overdue",
	"unavailable" = "unavailable",
}
export type DeadlinesRecord<Tparty_context = unknown, Trules = unknown> = {
	action?: string
	application?: RecordIdString
	applications_enabled?: boolean
	assignees?: RecordIdString[]
	created: IsoAutoDateString
	date?: IsoDateString
	dependency?: RecordIdString
	description?: string
	disableFulfill?: boolean
	dynamic?: boolean
	fulfilled_prompt?: string
	id: string
	input_prompt?: string
	matter?: RecordIdString
	name?: string
	overdue_prompt?: string
	party_context?: null | Tparty_context
	pending_prompt?: string
	rules?: null | Trules
	status?: DeadlinesStatusOptions
	t_id?: string
	updated: IsoAutoDateString
}

export enum DeviceTokensPlatformOptions {
	"android" = "android",
	"ios" = "ios",
	"web" = "web",
	"electron" = "electron",
}
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

export type EmailBusRecord = {
	body?: HTMLString
	created: IsoAutoDateString
	id: string
	sent?: boolean
	subject?: string
	to?: string
	updated: IsoAutoDateString
}

export type FirmsRecord<Tmeta = unknown> = {
	created: IsoAutoDateString
	id: string
	meta?: null | Tmeta
	name?: string
	updated: IsoAutoDateString
}

export enum JobNotificationsChannelsOptions {
	"APP" = "APP",
	"EMAIL" = "EMAIL",
	"PUSH" = "PUSH",
	"SMS" = "SMS",
}
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

export type MatterActionEventsRecord<Taction = unknown, Tinput = unknown, Toutput = unknown> = {
	action?: null | Taction
	created: IsoAutoDateString
	id: string
	input?: null | Tinput
	matter?: RecordIdString
	output?: null | Toutput
	updated: IsoAutoDateString
}

export type MattersRecord<TfieldValues = unknown, TopposingCounsel = unknown, Tparties = unknown, TpartyConfig = unknown, Trepresenting = unknown, Tstate = unknown> = {
	caseNumber?: string
	court?: RecordIdString
	created: IsoAutoDateString
	fieldValues?: null | TfieldValues
	id: string
	judges?: RecordIdString[]
	members?: RecordIdString[]
	name?: string
	opposingCounsel?: null | TopposingCounsel
	organisation?: RecordIdString
	owner?: RecordIdString
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
	updated: IsoAutoDateString
}

export enum NotificationsChannelsOptions {
	"APP" = "APP",
	"EMAIL" = "EMAIL",
	"PUSH" = "PUSH",
	"SMS" = "SMS",
}
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

export type OTPsRecord = {
	code?: string
	created: IsoAutoDateString
	id: string
	ttl?: number
	updated: IsoAutoDateString
	user?: RecordIdString
}

export enum OrganisationDirectInvitesStatusOptions {
	"pending" = "pending",
	"accepted" = "accepted",
	"rejected" = "rejected",
	"expired" = "expired",
}

export enum OrganisationDirectInvitesRoleOptions {
	"member" = "member",
	"admin" = "admin",
	"moderator" = "moderator",
}

export enum OrganisationDirectInvitesOrganisationRoleOptions {
	"partner" = "partner",
	"senior_associate" = "senior_associate",
	"associate" = "associate",
	"paralegal" = "paralegal",
	"intern" = "intern",
}
export type OrganisationDirectInvitesRecord = {
	acceptedAt?: IsoDateString
	avatar?: string
	created: IsoAutoDateString
	email: string
	expiresAt?: IsoDateString
	id: string
	invitedBy?: RecordIdString
	name?: string
	organisation?: RecordIdString
	organisationRole?: OrganisationDirectInvitesOrganisationRoleOptions
	role?: OrganisationDirectInvitesRoleOptions
	status?: OrganisationDirectInvitesStatusOptions
	token?: string
	updated: IsoAutoDateString
}

export type OrganisationInviteReferencesRecord = {
	created: IsoAutoDateString
	expired?: boolean
	expiry?: IsoDateString
	id: string
	inviter_name?: string
	organisation?: RecordIdString
	organisation_name?: string
	token?: string
	updated: IsoAutoDateString
	users?: RecordIdString[]
}

export type OrganisationInviteReferencesSanitizedRecord = {
	id: string
	inviter_name?: string
	organisation_name?: string
	token?: string
}

export type OrganisationInviteRequestsRecord = {
	avatar?: string
	created: IsoAutoDateString
	id: string
	name?: string
	reference?: RecordIdString
	updated: IsoAutoDateString
	user?: RecordIdString
}

export enum OrganisationUserPermissionsPermissionsOptions {
	"canCreateMatters" = "canCreateMatters",
	"canDeleteMatters" = "canDeleteMatters",
	"canViewExternalMatters" = "canViewExternalMatters",
	"canCreateApplications" = "canCreateApplications",
}

export enum OrganisationUserPermissionsOrganisationRoleOptions {
	"partner" = "partner",
	"senior_associate" = "senior_associate",
	"associate" = "associate",
	"paralegal" = "paralegal",
	"intern" = "intern",
}
export type OrganisationUserPermissionsRecord = {
	created: IsoAutoDateString
	id: string
	organisation?: RecordIdString
	organisationRole?: OrganisationUserPermissionsOrganisationRoleOptions
	permissions?: OrganisationUserPermissionsPermissionsOptions[]
	updated: IsoAutoDateString
	user?: RecordIdString
}

export type OrganisationsRecord = {
	activeSubscription?: RecordIdString
	active_seats?: number
	admins?: RecordIdString[]
	billing_status?: string
	contact_email?: string
	contact_name?: string
	contact_phoneNumber?: string
	created: IsoAutoDateString
	deleted?: boolean
	deletedAt?: IsoDateString
	emailDomain?: string
	id: string
	lago_customer_id?: string
	lago_subscription_id?: string
	last_synced_to_lago?: IsoDateString
	name?: string
	seats?: number
	updated: IsoAutoDateString
	users?: RecordIdString[]
}

export type PaymentRefsRecord<Tdata = unknown> = {
	created: IsoAutoDateString
	data?: null | Tdata
	id: string
	paymentRequest?: RecordIdString
	updated: IsoAutoDateString
	uuid?: string
}

export enum PaymentRequestsStatusOptions {
	"PENDING" = "PENDING",
	"PAID" = "PAID",
	"FAILED" = "FAILED",
	"CANCELLED" = "CANCELLED",
}
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

export enum ReminderAuditLogEventOptions {
	"created" = "created",
	"claimed" = "claimed",
	"sent" = "sent",
	"failed" = "failed",
	"retried" = "retried",
	"system_recovery" = "system_recovery",
}
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

export enum ReminderEscalationAuditLogEventOptions {
	"created" = "created",
	"claimed" = "claimed",
	"sent" = "sent",
	"failed" = "failed",
	"retried" = "retried",
	"system_recovery" = "system_recovery",
	"supervisor_alerted" = "supervisor_alerted",
}
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

export enum ReminderJobsStatusOptions {
	"pending" = "pending",
	"processing" = "processing",
	"sent" = "sent",
	"failed" = "failed",
	"skipped" = "skipped",
}

export enum ReminderJobsChannelsOptions {
	"EMAIL" = "EMAIL",
	"APP" = "APP",
	"PUSH" = "PUSH",
	"SMS" = "SMS",
}
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

export enum SeatEventsEventOptions {
	"add" = "add",
	"remove" = "remove",
}
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

export enum SubscriptionsTypeOptions {
	"individual" = "individual",
	"organisation" = "organisation",
}

export enum SubscriptionsPaymentStatusOptions {
	"pending" = "pending",
	"failed" = "failed",
	"complete" = "complete",
}
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

export type UsersRecord = {
	activeSubscription?: RecordIdString
	avatar?: string
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
}

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

// Response types include system fields and match responses from the PocketBase API
export type ApplicationsResponse<TfieldValues = unknown, TopposingCounsel = unknown, Tparties = unknown, TpartyConfig = unknown, Trepresenting = unknown, Tstate = unknown, Texpand = unknown> = Required<ApplicationsRecord<TfieldValues, TopposingCounsel, Tparties, TpartyConfig, Trepresenting, Tstate>> & BaseSystemFields<Texpand>
export type AvatarsResponse<Texpand = unknown> = Required<AvatarsRecord> & BaseSystemFields<Texpand>
export type ClerksResponse<Texpand = unknown> = Required<ClerksRecord> & BaseSystemFields<Texpand>
export type CourtsResponse<Texpand = unknown> = Required<CourtsRecord> & BaseSystemFields<Texpand>
export type DeadlineAdjournmentsResponse<Texpand = unknown> = Required<DeadlineAdjournmentsRecord> & BaseSystemFields<Texpand>
export type DeadlineEventsResponse<Texpand = unknown> = Required<DeadlineEventsRecord> & BaseSystemFields<Texpand>
export type DeadlineRemindersResponse<Texpand = unknown> = Required<DeadlineRemindersRecord> & BaseSystemFields<Texpand>
export type DeadlineTemplateAuthorsResponse<Texpand = unknown> = Required<DeadlineTemplateAuthorsRecord> & BaseSystemFields<Texpand>
export type DeadlineTemplatesResponse<Tchangelog = unknown, Ttags = unknown, Ttemplate = unknown, Texpand = unknown> = Required<DeadlineTemplatesRecord<Tchangelog, Ttags, Ttemplate>> & BaseSystemFields<Texpand>
export type DeadlinesResponse<Tparty_context = unknown, Trules = unknown, Texpand = unknown> = Required<DeadlinesRecord<Tparty_context, Trules>> & BaseSystemFields<Texpand>
export type DeviceTokensResponse<Tdevice_info = unknown, Texpand = unknown> = Required<DeviceTokensRecord<Tdevice_info>> & BaseSystemFields<Texpand>
export type EmailBusResponse<Texpand = unknown> = Required<EmailBusRecord> & BaseSystemFields<Texpand>
export type FirmsResponse<Tmeta = unknown, Texpand = unknown> = Required<FirmsRecord<Tmeta>> & BaseSystemFields<Texpand>
export type JobNotificationsResponse<Tactions = unknown, Tmetadata = unknown, Texpand = unknown> = Required<JobNotificationsRecord<Tactions, Tmetadata>> & BaseSystemFields<Texpand>
export type JudgesResponse<Texpand = unknown> = Required<JudgesRecord> & BaseSystemFields<Texpand>
export type MatterActionEventsResponse<Taction = unknown, Tinput = unknown, Toutput = unknown, Texpand = unknown> = Required<MatterActionEventsRecord<Taction, Tinput, Toutput>> & BaseSystemFields<Texpand>
export type MattersResponse<TfieldValues = unknown, TopposingCounsel = unknown, Tparties = unknown, TpartyConfig = unknown, Trepresenting = unknown, Tstate = unknown, Texpand = unknown> = Required<MattersRecord<TfieldValues, TopposingCounsel, Tparties, TpartyConfig, Trepresenting, Tstate>> & BaseSystemFields<Texpand>
export type NotificationsResponse<Tactions = unknown, Tmetadata = unknown, Texpand = unknown> = Required<NotificationsRecord<Tactions, Tmetadata>> & BaseSystemFields<Texpand>
export type OTPsResponse<Texpand = unknown> = Required<OTPsRecord> & BaseSystemFields<Texpand>
export type OrganisationDirectInvitesResponse<Texpand = unknown> = Required<OrganisationDirectInvitesRecord> & BaseSystemFields<Texpand>
export type OrganisationInviteReferencesResponse<Texpand = unknown> = Required<OrganisationInviteReferencesRecord> & BaseSystemFields<Texpand>
export type OrganisationInviteReferencesSanitizedResponse<Texpand = unknown> = Required<OrganisationInviteReferencesSanitizedRecord> & BaseSystemFields<Texpand>
export type OrganisationInviteRequestsResponse<Texpand = unknown> = Required<OrganisationInviteRequestsRecord> & BaseSystemFields<Texpand>
export type OrganisationUserPermissionsResponse<Texpand = unknown> = Required<OrganisationUserPermissionsRecord> & BaseSystemFields<Texpand>
export type OrganisationsResponse<Texpand = unknown> = Required<OrganisationsRecord> & BaseSystemFields<Texpand>
export type PaymentRefsResponse<Tdata = unknown, Texpand = unknown> = Required<PaymentRefsRecord<Tdata>> & BaseSystemFields<Texpand>
export type PaymentRequestsResponse<Tresponse = unknown, Texpand = unknown> = Required<PaymentRequestsRecord<Tresponse>> & BaseSystemFields<Texpand>
export type RegistrarsResponse<Texpand = unknown> = Required<RegistrarsRecord> & BaseSystemFields<Texpand>
export type ReminderAuditLogResponse<Tdetails = unknown, Texpand = unknown> = Required<ReminderAuditLogRecord<Tdetails>> & BaseSystemFields<Texpand>
export type ReminderEscalationAuditLogResponse<Tdetails = unknown, Texpand = unknown> = Required<ReminderEscalationAuditLogRecord<Tdetails>> & BaseSystemFields<Texpand>
export type ReminderJobsResponse<Texpand = unknown> = Required<ReminderJobsRecord> & BaseSystemFields<Texpand>
export type SeatEventsResponse<Texpand = unknown> = Required<SeatEventsRecord> & BaseSystemFields<Texpand>
export type SubscriptionPlansResponse<Texpand = unknown> = Required<SubscriptionPlansRecord> & BaseSystemFields<Texpand>
export type SubscriptionsResponse<Tmeta = unknown, Texpand = unknown> = Required<SubscriptionsRecord<Tmeta>> & BaseSystemFields<Texpand>
export type UserPreferencesResponse<Texpand = unknown> = Required<UserPreferencesRecord> & BaseSystemFields<Texpand>
export type UsersResponse<Texpand = unknown> = Required<UsersRecord> & AuthSystemFields<Texpand>
export type AuthoriginsResponse<Texpand = unknown> = Required<AuthoriginsRecord> & BaseSystemFields<Texpand>
export type ExternalauthsResponse<Texpand = unknown> = Required<ExternalauthsRecord> & BaseSystemFields<Texpand>
export type MfasResponse<Texpand = unknown> = Required<MfasRecord> & BaseSystemFields<Texpand>
export type OtpsResponse<Texpand = unknown> = Required<OtpsRecord> & BaseSystemFields<Texpand>
export type SuperusersResponse<Texpand = unknown> = Required<SuperusersRecord> & AuthSystemFields<Texpand>

// Types containing all Records and Responses, useful for creating typing helper functions

export type CollectionRecords = {
	Applications: ApplicationsRecord
	Avatars: AvatarsRecord
	Clerks: ClerksRecord
	Courts: CourtsRecord
	DeadlineAdjournments: DeadlineAdjournmentsRecord
	DeadlineEvents: DeadlineEventsRecord
	DeadlineReminders: DeadlineRemindersRecord
	DeadlineTemplateAuthors: DeadlineTemplateAuthorsRecord
	DeadlineTemplates: DeadlineTemplatesRecord
	Deadlines: DeadlinesRecord
	DeviceTokens: DeviceTokensRecord
	EmailBus: EmailBusRecord
	Firms: FirmsRecord
	JobNotifications: JobNotificationsRecord
	Judges: JudgesRecord
	MatterActionEvents: MatterActionEventsRecord
	Matters: MattersRecord
	Notifications: NotificationsRecord
	OTPs: OTPsRecord
	OrganisationDirectInvites: OrganisationDirectInvitesRecord
	OrganisationInviteReferences: OrganisationInviteReferencesRecord
	OrganisationInviteReferencesSanitized: OrganisationInviteReferencesSanitizedRecord
	OrganisationInviteRequests: OrganisationInviteRequestsRecord
	OrganisationUserPermissions: OrganisationUserPermissionsRecord
	Organisations: OrganisationsRecord
	PaymentRefs: PaymentRefsRecord
	PaymentRequests: PaymentRequestsRecord
	Registrars: RegistrarsRecord
	ReminderAuditLog: ReminderAuditLogRecord
	ReminderEscalationAuditLog: ReminderEscalationAuditLogRecord
	ReminderJobs: ReminderJobsRecord
	SeatEvents: SeatEventsRecord
	SubscriptionPlans: SubscriptionPlansRecord
	Subscriptions: SubscriptionsRecord
	UserPreferences: UserPreferencesRecord
	Users: UsersRecord
	_authOrigins: AuthoriginsRecord
	_externalAuths: ExternalauthsRecord
	_mfas: MfasRecord
	_otps: OtpsRecord
	_superusers: SuperusersRecord
}

export type CollectionResponses = {
	Applications: ApplicationsResponse
	Avatars: AvatarsResponse
	Clerks: ClerksResponse
	Courts: CourtsResponse
	DeadlineAdjournments: DeadlineAdjournmentsResponse
	DeadlineEvents: DeadlineEventsResponse
	DeadlineReminders: DeadlineRemindersResponse
	DeadlineTemplateAuthors: DeadlineTemplateAuthorsResponse
	DeadlineTemplates: DeadlineTemplatesResponse
	Deadlines: DeadlinesResponse
	DeviceTokens: DeviceTokensResponse
	EmailBus: EmailBusResponse
	Firms: FirmsResponse
	JobNotifications: JobNotificationsResponse
	Judges: JudgesResponse
	MatterActionEvents: MatterActionEventsResponse
	Matters: MattersResponse
	Notifications: NotificationsResponse
	OTPs: OTPsResponse
	OrganisationDirectInvites: OrganisationDirectInvitesResponse
	OrganisationInviteReferences: OrganisationInviteReferencesResponse
	OrganisationInviteReferencesSanitized: OrganisationInviteReferencesSanitizedResponse
	OrganisationInviteRequests: OrganisationInviteRequestsResponse
	OrganisationUserPermissions: OrganisationUserPermissionsResponse
	Organisations: OrganisationsResponse
	PaymentRefs: PaymentRefsResponse
	PaymentRequests: PaymentRequestsResponse
	Registrars: RegistrarsResponse
	ReminderAuditLog: ReminderAuditLogResponse
	ReminderEscalationAuditLog: ReminderEscalationAuditLogResponse
	ReminderJobs: ReminderJobsResponse
	SeatEvents: SeatEventsResponse
	SubscriptionPlans: SubscriptionPlansResponse
	Subscriptions: SubscriptionsResponse
	UserPreferences: UserPreferencesResponse
	Users: UsersResponse
	_authOrigins: AuthoriginsResponse
	_externalAuths: ExternalauthsResponse
	_mfas: MfasResponse
	_otps: OtpsResponse
	_superusers: SuperusersResponse
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
