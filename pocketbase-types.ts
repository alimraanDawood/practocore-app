/**
* This file was @generated using pocketbase-typegen
*/

import type PocketBase from 'pocketbase'
import type { RecordService } from 'pocketbase'

export enum Collections {
	DeadlineReminders = "DeadlineReminders",
	DeadlineTemplateVersions = "DeadlineTemplateVersions",
	DeadlineTemplates = "DeadlineTemplates",
	Deadlines = "Deadlines",
	Matters = "Matters",
	OTPs = "OTPs",
	OrganisationInviteReferences = "OrganisationInviteReferences",
	Organisations = "Organisations",
	TeamSettings = "TeamSettings",
	Teams = "Teams",
	UserPreferences = "UserPreferences",
	Users = "Users",
	Practocoreplans = "_PractocorePlans",
	Authorigins = "_authOrigins",
	Externalauths = "_externalAuths",
	Mfas = "_mfas",
	Otps = "_otps",
	Superusers = "_superusers",
}

// Alias types for improved usability
export type IsoDateString = string
export type RecordIdString = string
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

export enum DeadlineRemindersPriorityOptions {
	"informative" = "informative",
	"moderate" = "moderate",
	"urgent" = "urgent",
	"critical" = "critical",
}

export enum DeadlineRemindersChannelsOptions {
	"MAIL" = "MAIL",
	"APP" = "APP",
	"ALARM" = "ALARM",
}
export type DeadlineRemindersRecord<Trules = unknown> = {
	acknowledged?: boolean
	active?: boolean
	body?: string
	bodyHTML?: HTMLString
	channels?: DeadlineRemindersChannelsOptions[]
	created?: IsoDateString
	date?: IsoDateString
	deadline?: RecordIdString
	escalate?: boolean
	id: string
	priority?: DeadlineRemindersPriorityOptions
	rules?: null | Trules
	title?: string
	updated?: IsoDateString
}

export type DeadlineTemplateVersionsRecord<TtemplateData = unknown> = {
	created?: IsoDateString
	createdBy?: RecordIdString
	id: string
	template?: RecordIdString
	templateData?: null | TtemplateData
	updated?: IsoDateString
	version?: string
}

export enum DeadlineTemplatesStatusOptions {
	"draft" = "draft",
	"active" = "active",
	"deprecated" = "deprecated",
}
export type DeadlineTemplatesRecord<Tchangelog = unknown, Ttemplate = unknown> = {
	author?: RecordIdString
	changelog?: null | Tchangelog
	created?: IsoDateString
	description?: HTMLString
	id: string
	isPublic?: boolean
	name?: string
	organisation?: RecordIdString
	status?: DeadlineTemplatesStatusOptions
	tags?: string
	template?: null | Ttemplate
	updated?: IsoDateString
	usageCount?: number
	version?: string
}

export type DeadlinesRecord<Trules = unknown> = {
	action?: string
	completed?: boolean
	created?: IsoDateString
	date?: IsoDateString
	dependancy?: RecordIdString
	description?: string
	dynamic?: boolean
	fulfilled_prompt?: string
	id: string
	input_prompt?: string
	matter?: RecordIdString
	missed?: boolean
	name?: string
	pending_prompt?: string
	rules?: null | Trules
	updated?: IsoDateString
}

export type MattersRecord<TfieldValues = unknown> = {
	caseNumber?: string
	created?: IsoDateString
	fieldValues?: null | TfieldValues
	id: string
	name?: string
	owner?: RecordIdString
	template?: RecordIdString
	updated?: IsoDateString
}

export type OTPsRecord = {
	code?: string
	created?: IsoDateString
	id: string
	ttl?: number
	updated?: IsoDateString
	user?: RecordIdString
}

export type OrganisationInviteReferencesRecord = {
	created?: IsoDateString
	expired?: boolean
	expiry?: IsoDateString
	id: string
	organisation?: RecordIdString
	token?: string
	updated?: IsoDateString
	users?: RecordIdString[]
}

export enum OrganisationsSizeOptions {
	"SOLO PRACTITIONER" = "SOLO PRACTITIONER",
	"11-50" = "11-50",
	"51-100" = "51-100",
	"100+" = "100+",
	"2-10" = "2-10",
}
export type OrganisationsRecord<TprimaryPracticeAreas = unknown> = {
	contact_email?: string
	contact_name?: string
	contact_phoneNumber?: string
	created?: IsoDateString
	deleted?: boolean
	deletedAt?: IsoDateString
	emailDomain?: string
	id: string
	legalBusinessName?: string
	name?: string
	primaryPracticeAreas?: null | TprimaryPracticeAreas
	size?: OrganisationsSizeOptions
	updated?: IsoDateString
}

export enum TeamSettingsVisibilityOptions {
	"PUBLIC" = "PUBLIC",
	"PRIVATE" = "PRIVATE",
}
export type TeamSettingsRecord = {
	allowSelfJoin?: boolean
	created?: IsoDateString
	id: string
	updated?: IsoDateString
	visibility?: TeamSettingsVisibilityOptions
}

export type TeamsRecord = {
	created?: IsoDateString
	deleted?: boolean
	deletedAt?: IsoDateString
	description?: HTMLString
	id: string
	name?: string
	settings?: RecordIdString
	updated?: IsoDateString
}

export type UserPreferencesRecord = {
	created?: IsoDateString
	id: string
	reminder_time?: string
	updated?: IsoDateString
	use_app_notifications?: boolean
	use_email_notifications?: boolean
	use_push_notifications?: boolean
}

export type UsersRecord = {
	avatar?: string
	created?: IsoDateString
	deleted?: boolean
	deletedAt?: IsoDateString
	email: string
	emailVisibility?: boolean
	id: string
	lastActiveAt?: IsoDateString
	name: string
	online?: boolean
	organisation?: RecordIdString
	password: string
	phone?: string
	preferences?: RecordIdString
	profilePhoto?: string
	teams?: RecordIdString
	timezone?: string
	timezoneOffset?: number
	tokenKey: string
	updated?: IsoDateString
	username?: string
	verified?: boolean
}

export type PractocoreplansRecord = {
	created?: IsoDateString
	id: string
	maxSeats?: number
	name?: string
	price_per_seat?: number
	updated?: IsoDateString
}

export type AuthoriginsRecord = {
	collectionRef: string
	created?: IsoDateString
	fingerprint: string
	id: string
	recordRef: string
	updated?: IsoDateString
}

export type ExternalauthsRecord = {
	collectionRef: string
	created?: IsoDateString
	id: string
	provider: string
	providerId: string
	recordRef: string
	updated?: IsoDateString
}

export type MfasRecord = {
	collectionRef: string
	created?: IsoDateString
	id: string
	method: string
	recordRef: string
	updated?: IsoDateString
}

export type OtpsRecord = {
	collectionRef: string
	created?: IsoDateString
	id: string
	password: string
	recordRef: string
	sentTo?: string
	updated?: IsoDateString
}

export type SuperusersRecord = {
	created?: IsoDateString
	email: string
	emailVisibility?: boolean
	id: string
	password: string
	tokenKey: string
	updated?: IsoDateString
	verified?: boolean
}

// Response types include system fields and match responses from the PocketBase API
export type DeadlineRemindersResponse<Trules = unknown, Texpand = unknown> = Required<DeadlineRemindersRecord<Trules>> & BaseSystemFields<Texpand>
export type DeadlineTemplateVersionsResponse<TtemplateData = unknown, Texpand = unknown> = Required<DeadlineTemplateVersionsRecord<TtemplateData>> & BaseSystemFields<Texpand>
export type DeadlineTemplatesResponse<Tchangelog = unknown, Ttemplate = unknown, Texpand = unknown> = Required<DeadlineTemplatesRecord<Tchangelog, Ttemplate>> & BaseSystemFields<Texpand>
export type DeadlinesResponse<Trules = unknown, Texpand = unknown> = Required<DeadlinesRecord<Trules>> & BaseSystemFields<Texpand>
export type MattersResponse<TfieldValues = unknown, Texpand = unknown> = Required<MattersRecord<TfieldValues>> & BaseSystemFields<Texpand>
export type OTPsResponse<Texpand = unknown> = Required<OTPsRecord> & BaseSystemFields<Texpand>
export type OrganisationInviteReferencesResponse<Texpand = unknown> = Required<OrganisationInviteReferencesRecord> & BaseSystemFields<Texpand>
export type OrganisationsResponse<TprimaryPracticeAreas = unknown, Texpand = unknown> = Required<OrganisationsRecord<TprimaryPracticeAreas>> & BaseSystemFields<Texpand>
export type TeamSettingsResponse<Texpand = unknown> = Required<TeamSettingsRecord> & BaseSystemFields<Texpand>
export type TeamsResponse<Texpand = unknown> = Required<TeamsRecord> & BaseSystemFields<Texpand>
export type UserPreferencesResponse<Texpand = unknown> = Required<UserPreferencesRecord> & BaseSystemFields<Texpand>
export type UsersResponse<Texpand = unknown> = Required<UsersRecord> & AuthSystemFields<Texpand>
export type PractocoreplansResponse<Texpand = unknown> = Required<PractocoreplansRecord> & BaseSystemFields<Texpand>
export type AuthoriginsResponse<Texpand = unknown> = Required<AuthoriginsRecord> & BaseSystemFields<Texpand>
export type ExternalauthsResponse<Texpand = unknown> = Required<ExternalauthsRecord> & BaseSystemFields<Texpand>
export type MfasResponse<Texpand = unknown> = Required<MfasRecord> & BaseSystemFields<Texpand>
export type OtpsResponse<Texpand = unknown> = Required<OtpsRecord> & BaseSystemFields<Texpand>
export type SuperusersResponse<Texpand = unknown> = Required<SuperusersRecord> & AuthSystemFields<Texpand>

// Types containing all Records and Responses, useful for creating typing helper functions

export type CollectionRecords = {
	DeadlineReminders: DeadlineRemindersRecord
	DeadlineTemplateVersions: DeadlineTemplateVersionsRecord
	DeadlineTemplates: DeadlineTemplatesRecord
	Deadlines: DeadlinesRecord
	Matters: MattersRecord
	OTPs: OTPsRecord
	OrganisationInviteReferences: OrganisationInviteReferencesRecord
	Organisations: OrganisationsRecord
	TeamSettings: TeamSettingsRecord
	Teams: TeamsRecord
	UserPreferences: UserPreferencesRecord
	Users: UsersRecord
	_PractocorePlans: PractocoreplansRecord
	_authOrigins: AuthoriginsRecord
	_externalAuths: ExternalauthsRecord
	_mfas: MfasRecord
	_otps: OtpsRecord
	_superusers: SuperusersRecord
}

export type CollectionResponses = {
	DeadlineReminders: DeadlineRemindersResponse
	DeadlineTemplateVersions: DeadlineTemplateVersionsResponse
	DeadlineTemplates: DeadlineTemplatesResponse
	Deadlines: DeadlinesResponse
	Matters: MattersResponse
	OTPs: OTPsResponse
	OrganisationInviteReferences: OrganisationInviteReferencesResponse
	Organisations: OrganisationsResponse
	TeamSettings: TeamSettingsResponse
	Teams: TeamsResponse
	UserPreferences: UserPreferencesResponse
	Users: UsersResponse
	_PractocorePlans: PractocoreplansResponse
	_authOrigins: AuthoriginsResponse
	_externalAuths: ExternalauthsResponse
	_mfas: MfasResponse
	_otps: OtpsResponse
	_superusers: SuperusersResponse
}

// Type for usage with type asserted PocketBase instance
// https://github.com/pocketbase/js-sdk#specify-typescript-definitions

export type TypedPocketBase = PocketBase & {
	collection(idOrName: 'DeadlineReminders'): RecordService<DeadlineRemindersResponse>
	collection(idOrName: 'DeadlineTemplateVersions'): RecordService<DeadlineTemplateVersionsResponse>
	collection(idOrName: 'DeadlineTemplates'): RecordService<DeadlineTemplatesResponse>
	collection(idOrName: 'Deadlines'): RecordService<DeadlinesResponse>
	collection(idOrName: 'Matters'): RecordService<MattersResponse>
	collection(idOrName: 'OTPs'): RecordService<OTPsResponse>
	collection(idOrName: 'OrganisationInviteReferences'): RecordService<OrganisationInviteReferencesResponse>
	collection(idOrName: 'Organisations'): RecordService<OrganisationsResponse>
	collection(idOrName: 'TeamSettings'): RecordService<TeamSettingsResponse>
	collection(idOrName: 'Teams'): RecordService<TeamsResponse>
	collection(idOrName: 'UserPreferences'): RecordService<UserPreferencesResponse>
	collection(idOrName: 'Users'): RecordService<UsersResponse>
	collection(idOrName: '_PractocorePlans'): RecordService<PractocoreplansResponse>
	collection(idOrName: '_authOrigins'): RecordService<AuthoriginsResponse>
	collection(idOrName: '_externalAuths'): RecordService<ExternalauthsResponse>
	collection(idOrName: '_mfas'): RecordService<MfasResponse>
	collection(idOrName: '_otps'): RecordService<OtpsResponse>
	collection(idOrName: '_superusers'): RecordService<SuperusersResponse>
}
