<script lang="ts" setup>
// AI proposal / permission-card gallery.
//
// Every tool-approval card the assistant can raise, rendered side by side with
// representative data so their presentation can be reviewed in one place. This
// page is a design surface only — nothing here talks to the backend, and
// Approve/Dismiss just log to the on-card status line.
import { Columns2, List, Maximize2, PanelRight, RefreshCw } from 'lucide-vue-next';
import ProposalCard from '~/components/shared/AI/ProposalCard.vue';
import QuestionCardMock from '~/components/playground/QuestionCardMock.vue';
import type { QuestionSpec } from '~/components/playground/questionCardTypes';
import type { AiResponse } from '~/services/ai';
import type { ProposalVariant } from '~/components/shared/AI/proposals/theme';

definePageMeta({ layout: 'default' });

// ── Controls ──────────────────────────────────────────────────────────────────
const variant = ref<ProposalVariant>('panel');
const loading = ref(false);
const width = ref<'dock' | 'panel' | 'wide'>('panel');
const twoUp = ref(false);
const indexOpen = ref(false);

const widths: Record<typeof width.value, string> = {
  dock: '320px',
  panel: '420px',
  wide: '620px',
};
const cardWidth = computed(() => widths[width.value]);

// Last action taken on each card, so the buttons are demonstrably live.
const lastAction = reactive<Record<string, string>>({});
function act(id: string, what: string) {
  lastAction[id] = `${what} · ${new Date().toLocaleTimeString()}`;
}

// ── Fixture helpers ───────────────────────────────────────────────────────────
const today = new Date();
const iso = (offsetDays: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

const users = {
  nakato: { id: 'u1', name: 'Sarah Nakato', email: 'sarah.nakato@kkco.ug' },
  mugisha: { id: 'u2', name: 'David Mugisha', email: 'david.mugisha@kkco.ug' },
  akello: { id: 'u3', name: 'Grace Akello', email: 'grace.akello@kkco.ug' },
  okot: { id: 'u4', name: 'Peter Okot', email: 'peter.okot@kkco.ug' },
};

const deadline = {
  id: 'd1',
  name: 'File written statement of defence',
  date: iso(9),
  status: 'pending',
  matterId: 'm1',
  matterName: 'Nakato v Ssebugwawo & 2 Ors',
};

// ── The gallery ───────────────────────────────────────────────────────────────
interface Sample {
  id: string;
  label: string;
  /** What this card exists to make the lawyer notice before approving. */
  note: string;
  proposal: AiResponse;
}

const samples: Sample[] = [
  {
    id: 'reassign',
    label: 'Reassign a deadline',
    note: 'Who holds the task now vs who will hold it.',
    proposal: {
      type: 'proposal',
      tool: 'reassign_deadline',
      toolUseId: 'tu_reassign',
      input: { deadline_id: 'd1', assignee_ids: ['u2', 'u3'] },
      preview: {
        kind: 'reassign',
        deadline,
        currentAssignees: [users.nakato],
        newAssignees: [users.mugisha, users.akello],
      },
    },
  },
  {
    id: 'reassign-unassigned',
    label: 'Reassign — currently unassigned',
    note: 'Empty "From" state, and a deadline with no matter attached.',
    proposal: {
      type: 'proposal',
      tool: 'reassign_deadline',
      toolUseId: 'tu_reassign2',
      preview: {
        kind: 'reassign',
        deadline: { id: 'd9', name: 'Serve hearing notice on the 2nd defendant' },
        currentAssignees: [],
        newAssignees: [users.okot],
      },
    },
  },
  {
    id: 'bulk_reassign',
    label: 'Bulk reassign',
    note: 'Scope line is the whole risk here — one matter or every matter.',
    proposal: {
      type: 'proposal',
      tool: 'bulk_reassign_deadlines',
      toolUseId: 'tu_bulk',
      preview: {
        kind: 'bulk_reassign',
        fromUser: users.nakato,
        toUser: users.mugisha,
        matter: undefined,
      },
    },
  },
  {
    id: 'notification',
    label: 'Send a notification',
    note: 'Message body as it will be sent, plus channels each recipient has switched off.',
    proposal: {
      type: 'proposal',
      tool: 'send_notification',
      toolUseId: 'tu_notify',
      preview: {
        kind: 'notification',
        title: 'Hearing moved to 14 September',
        body: 'The Commercial Division has moved the hearing in Nakato v Ssebugwawo to 14 September at 9:00am before Hon. Justice Wamala.\n\nPlease confirm counsel availability by Friday.',
        bodyHtml:
          '<p>The Commercial Division has moved the hearing in <strong>Nakato v Ssebugwawo</strong> to 14 September at 9:00am before Hon. Justice Wamala.</p><ul><li>Confirm counsel availability by Friday</li><li>Witness statements are unaffected</li></ul>',
        channels: ['EMAIL', 'PUSH', 'SMS'],
        recipients: [
          { ...users.nakato, effectiveChannels: ['EMAIL', 'PUSH', 'SMS'] },
          { ...users.mugisha, effectiveChannels: ['EMAIL'] },
          { ...users.akello, effectiveChannels: ['EMAIL', 'PUSH'] },
        ],
      },
    },
  },
  {
    id: 'adjourn',
    label: 'Adjourn a deadline',
    note: 'Old date → new date, with the weekend/holiday bypass called out.',
    proposal: {
      type: 'proposal',
      tool: 'adjourn_deadline',
      toolUseId: 'tu_adjourn',
      preview: {
        kind: 'adjourn',
        deadline,
        newDate: iso(23),
        reason: 'Court registry closed for the judicial conference; registrar granted an extension in chambers.',
        force: true,
      },
    },
  },
  {
    id: 'date_change_override',
    label: 'Date change — override',
    note: 'A correction, not an adjournment. The note carries that distinction.',
    proposal: {
      type: 'proposal',
      tool: 'override_deadline',
      toolUseId: 'tu_override',
      preview: {
        kind: 'date_change',
        intent: 'override_deadline',
        deadline,
        newDate: iso(16),
        reason: 'The computed date used the filing date; the summons was served a week later.',
      },
    },
  },
  {
    id: 'date_change_reset',
    label: 'Date change — reset',
    note: 'No date is shown on purpose: the engine decides it on apply.',
    proposal: {
      type: 'proposal',
      tool: 'reset_deadline',
      toolUseId: 'tu_reset',
      preview: {
        kind: 'date_change',
        intent: 'reset_deadline',
        deadline: { ...deadline, date: iso(16) },
        restoresComputed: true,
      },
    },
  },
  {
    id: 'date_change_clear',
    label: 'Date change — clear the due date',
    note: 'Firm-set task losing its date, so no reminders fire.',
    proposal: {
      type: 'proposal',
      tool: 'set_deadline_date',
      toolUseId: 'tu_setdate',
      preview: {
        kind: 'date_change',
        intent: 'set_deadline_date',
        deadline: { id: 'd3', name: 'Internal: brief the client on costs exposure', date: iso(4), matterName: 'Kampala Millers Ltd — Supply dispute' },
        clearsDate: true,
      },
    },
  },
  {
    id: 'fulfill',
    label: 'Mark a deadline fulfilled',
    note: 'Green tick path.',
    proposal: {
      type: 'proposal',
      tool: 'fulfill_deadline',
      toolUseId: 'tu_fulfill',
      preview: { kind: 'fulfill', deadline, fulfilledDate: iso(-1) },
    },
  },
  {
    id: 'fulfill_undo',
    label: 'Reopen a deadline (undo)',
    note: 'Same tool, inverted sense — the wording must flip.',
    proposal: {
      type: 'proposal',
      tool: 'fulfill_deadline',
      toolUseId: 'tu_unfulfill',
      preview: { kind: 'fulfill', deadline: { ...deadline, status: 'fulfilled' }, undo: true },
    },
  },
  {
    id: 'matter_edit',
    label: 'Update matter details',
    note: 'Add / remove / set diff rows with the shared op palette.',
    proposal: {
      type: 'proposal',
      tool: 'update_matter_details',
      toolUseId: 'tu_matteredit',
      preview: {
        kind: 'matter_edit',
        matter: { id: 'm1', name: 'Nakato v Ssebugwawo & 2 Ors', caseNumber: 'HCCS 214 of 2026' },
        changes: [
          { label: 'Case number', op: 'set', before: 'HCCS 214 of 2025', after: 'HCCS 214 of 2026' },
          { label: 'Presiding judge', op: 'update', before: 'Hon. Justice Kiryabwire', after: 'Hon. Justice Wamala' },
          { label: 'Team member', op: 'add', after: 'Grace Akello' },
          { label: 'Team member', op: 'remove', before: 'Peter Okot' },
        ],
      },
    },
  },
  {
    id: 'create_matter',
    label: 'Create a matter',
    note: 'The heaviest card: template, trigger date, parties, confidence dots, warnings, and the "edit before creating" escape hatch.',
    proposal: {
      type: 'proposal',
      tool: 'create_matter',
      toolUseId: 'tu_creatematter',
      preview: {
        kind: 'create_matter',
        template: {
          id: 't1',
          name: 'Civil Suit — High Court (Commercial Division)',
          triggerDatePrompt: 'Date the plaint was filed',
          triggerDateName: 'Filing date',
        },
        matter: {
          name: 'Kampala Millers Ltd v Nile Freight (U) Ltd',
          caseNumber: 'HCCS 402 of 2026',
          date: iso(-12),
          court: 'c1',
          courtName: 'High Court of Uganda — Commercial Division',
          judges: [{ id: 'j1', name: 'Hon. Justice Wamala', email: '' }],
          partyRoles: { plaintiff: 'Plaintiff', defendant: 'Defendant' },
          parties: {
            plaintiff: [{ name: 'Kampala Millers Ltd' }],
            defendant: [{ name: 'Nile Freight (U) Ltd' }, { name: 'Sam Ssebugwawo' }],
          },
          members: [users.nakato, users.mugisha],
        },
        fields: [
          { id: 'f1', label: 'Claim value (UGX)', value: 480000000, required: true, confidence: 'high' },
          { id: 'f2', label: 'Cause of action', value: 'Breach of carriage contract', required: true, confidence: 'medium' },
          { id: 'f3', label: 'Instructing partner', value: '', required: true, confidence: 'low' },
          { id: 'f4', label: 'Mediation referred', value: false, required: false, confidence: 'high' },
        ],
        warnings: [
          'Instructing partner is required and was not found in the instructions.',
          'Two defendants were extracted but only one address was given.',
        ],
      },
    },
  },
  {
    id: 'reminder',
    label: 'Schedule a reminder series',
    note: 'Touchpoint timeline, including a past touchpoint that will be skipped.',
    proposal: {
      type: 'proposal',
      tool: 'schedule_reminder',
      toolUseId: 'tu_reminder',
      preview: {
        kind: 'reminder',
        scope: 'case',
        matter: 'Nakato v Ssebugwawo & 2 Ors',
        title: 'Witness statements due',
        mode: 'series',
        targetDate: iso(14),
        atTime: '08:30',
        channels: ['EMAIL', 'PUSH', 'APP'],
        recipients: [users.nakato, users.mugisha],
        touchpoints: [
          { date: iso(-3), daysBefore: 17, title: 'Witness statements — 17 days out', body: 'Start collecting instructions from the two factual witnesses.', atTime: '08:30', past: true },
          { date: iso(7), daysBefore: 7, title: 'Witness statements — one week out', body: 'Drafts should be with counsel for review.', atTime: '08:30' },
          { date: iso(13), daysBefore: 1, title: 'Witness statements — tomorrow', body: 'Final signatures and commissioning today.', atTime: '07:00' },
          { date: iso(14), daysBefore: 0, title: 'Witness statements due today', body: 'File and serve before registry closes at 5:00pm.', atTime: '07:00' },
        ],
      },
    },
  },
  {
    id: 'reminder_personal',
    label: 'Reminder — personal, single',
    note: 'The lightest possible reminder card.',
    proposal: {
      type: 'proposal',
      tool: 'schedule_reminder',
      toolUseId: 'tu_reminder2',
      preview: {
        kind: 'reminder',
        scope: 'personal',
        matter: 'Personal',
        title: 'Renew practising certificate',
        mode: 'single',
        targetDate: iso(30),
        channels: ['EMAIL'],
        touchpoints: [
          { date: iso(30), daysBefore: 0, title: 'Renew practising certificate', body: 'ULS renewal window closes at the end of the month.' },
        ],
      },
    },
  },
  {
    id: 'event_edit',
    label: 'Edit a calendar event',
    note: 'Today vs proposed, plus where each nudge lands after the move.',
    proposal: {
      type: 'proposal',
      tool: 'update_event',
      toolUseId: 'tu_eventedit',
      preview: {
        kind: 'event_edit',
        eventId: 'e1',
        title: 'Scheduling conference',
        targetDate: iso(10),
        atTime: '09:00',
        scope: 'case',
        matter: 'Nakato v Ssebugwawo & 2 Ors',
        changes: [
          { label: 'Date', op: 'set', before: iso(10), after: iso(18) },
          { label: 'Time', op: 'set', before: '09:00', after: '11:30' },
        ],
        recipients: [users.mugisha, users.akello],
        currentRecipients: [users.nakato],
        channels: ['EMAIL', 'PUSH'],
        touchpoints: [
          { title: 'Conference in 7 days', date: iso(3), daysBefore: 7, newDate: iso(11) },
          { title: 'Conference tomorrow', date: iso(9), daysBefore: 1, newDate: iso(17) },
        ],
      },
    },
  },
  {
    id: 'event_status_done',
    label: 'Event status — mark done',
    note: 'Shows how many pending reminders this silences.',
    proposal: {
      type: 'proposal',
      tool: 'set_event_status',
      toolUseId: 'tu_eventdone',
      preview: {
        kind: 'event_status',
        eventId: 'e1',
        title: 'Scheduling conference',
        targetDate: iso(10),
        from: 'pending',
        to: 'done',
        scope: 'case',
        matter: 'Nakato v Ssebugwawo & 2 Ors',
        touchpoints: [
          { title: 'Conference in 7 days', date: iso(3) },
          { title: 'Conference tomorrow', date: iso(9) },
        ],
      },
    },
  },
  {
    id: 'event_status_reopen',
    label: 'Event status — reopen',
    note: 'Runs in the opposite direction; the note has to say what cannot come back.',
    proposal: {
      type: 'proposal',
      tool: 'set_event_status',
      toolUseId: 'tu_eventreopen',
      preview: {
        kind: 'event_status',
        eventId: 'e2',
        title: 'Client cheque collection',
        targetDate: iso(5),
        from: 'cancelled',
        to: 'pending',
        scope: 'personal',
        matter: 'Personal',
        touchpoints: [{ title: 'Collection tomorrow', date: iso(4) }],
      },
    },
  },
  {
    id: 'generate_document',
    label: 'Generate a document',
    note: 'Court intituling plus the body outline — shape only, no paragraph text.',
    proposal: {
      type: 'proposal',
      tool: 'generate_document',
      toolUseId: 'tu_docgen',
      preview: {
        kind: 'generate_document',
        docKind: 'plaint',
        title: 'Plaint',
        date: iso(0),
        matter: { id: 'm2', name: 'Kampala Millers Ltd v Nile Freight (U) Ltd', caseNumber: 'HCCS 402 of 2026' },
        courtHeading: {
          court: 'IN THE HIGH COURT OF UGANDA AT KAMPALA',
          division: '(COMMERCIAL DIVISION)',
          causeType: 'CIVIL SUIT NO.',
          causeNumber: '402 OF 2026',
          parties: [
            'KAMPALA MILLERS LTD — PLAINTIFF',
            'NILE FREIGHT (U) LTD — 1ST DEFENDANT',
            'SAM SSEBUGWAWO — 2ND DEFENDANT',
          ],
        },
        sections: [
          { heading: 'Parties and description', paragraphCount: 3, numbered: true },
          { heading: 'Jurisdiction', paragraphCount: 1, numbered: true },
          { heading: 'Facts constituting the cause of action', paragraphCount: 9, numbered: true },
          { heading: 'Particulars of breach', paragraphCount: 5, numbered: true },
          { heading: 'Notice of intention to sue', paragraphCount: 1, numbered: false },
        ],
        hasPrayer: true,
        prayerCount: 5,
      },
    },
  },
  {
    id: 'generate_document_letter',
    label: 'Generate a document — letter',
    note: 'No court heading, no prayer. The short end of the same card.',
    proposal: {
      type: 'proposal',
      tool: 'generate_document',
      toolUseId: 'tu_docgen2',
      preview: {
        kind: 'generate_document',
        docKind: 'demand_letter',
        title: 'Letter of demand — outstanding freight charges',
        date: iso(0),
        sections: [
          { heading: 'Introduction', paragraphCount: 2, numbered: false },
          { heading: 'The debt', paragraphCount: 3, numbered: false },
          { heading: 'Demand', paragraphCount: 1, numbered: false },
        ],
        hasPrayer: false,
      },
    },
  },
  {
    id: 'propose_skill',
    label: 'Author a firm skill',
    note: 'Instructions preview, bindings, and the unknown-binding warning.',
    proposal: {
      type: 'proposal',
      tool: 'propose_skill',
      toolUseId: 'tu_skill',
      preview: {
        kind: 'propose_skill',
        name: 'commercial-division-filing-check',
        title: 'Commercial Division filing check',
        purpose: 'Run the registry checklist before anything is filed in the Commercial Division, so nothing is rejected at the counter.',
        triggers: 'Any time a document is about to be filed at the Commercial Division registry, or the lawyer asks whether a filing is ready.',
        courtScope: 'High Court — Commercial Division',
        instructions:
          '1. Confirm the cause number matches the one on the record.\n2. Check the intituling against the current parties, including any joined or struck-out party.\n3. Confirm the filing fee assessment is attached and current.\n4. Check that every annexure referred to in the body is actually attached and lettered in sequence.\n5. Confirm the advocate on record has signed and that the firm stamp is applied.\n6. Flag anything filed within three days of a hearing, since the registry may refuse late service.',
        toolBindings: ['get_matter', 'read_vault_document', 'check_filing_fees'],
        userInvocable: true,
        exampleCount: 3,
        isUpdate: false,
        unknownToolBindings: ['check_filing_fees'],
      },
    },
  },
  {
    id: 'propose_skill_update',
    label: 'Update an existing firm skill',
    note: 'The overwrite path — version being replaced, status it keeps.',
    proposal: {
      type: 'proposal',
      tool: 'propose_skill',
      toolUseId: 'tu_skill2',
      preview: {
        kind: 'propose_skill',
        name: 'client-intake-summary',
        title: 'Client intake summary',
        purpose: 'Turn a first-meeting note into the firm\'s standard intake summary.',
        triggers: 'After a first client meeting, or when the lawyer pastes meeting notes.',
        courtScope: '',
        instructions: 'Open with the client\'s objective in their own words. Then: parties, key dates, documents held, documents needed, conflicts check outcome, and the fee basis agreed.',
        toolBindings: ['save_memory', 'generate_document'],
        userInvocable: false,
        isUpdate: true,
        currentStatus: 'active',
        currentVersion: '3',
      },
    },
  },
  {
    id: 'manage_skill_delete',
    label: 'Manage skill — delete',
    note: 'The destructive one. Shows the instructions about to be destroyed.',
    proposal: {
      type: 'proposal',
      tool: 'manage_skill',
      toolUseId: 'tu_manageskill',
      preview: {
        kind: 'manage_skill',
        name: 'old-conveyancing-checklist',
        action: 'delete',
        title: 'Conveyancing checklist (2024)',
        purpose: 'Superseded by the 2026 land registry procedure.',
        currentStatus: 'deprecated',
        version: '2',
        updated: iso(-420),
        instructionsExcerpt:
          '1. Confirm the search at the Ministry of Lands is under 30 days old.\n2. Check that consent to transfer has been obtained where the land is customary…',
        instructionsLength: 1842,
      },
    },
  },
  {
    id: 'manage_skill_activate',
    label: 'Manage skill — activate',
    note: 'Non-destructive path, plus the "not your skill" warning state.',
    proposal: {
      type: 'proposal',
      tool: 'manage_skill',
      toolUseId: 'tu_manageskill2',
      preview: {
        kind: 'manage_skill',
        name: 'oscola-citation-house-style',
        action: 'activate',
        title: 'OSCOLA citation house style',
        purpose: 'Cite Ugandan authorities the way the firm\'s partners expect to read them.',
        currentStatus: 'draft',
        version: '1',
        updated: iso(-2),
      },
    },
  },
  {
    id: 'propose_engagement_template',
    label: 'Author an engagement playbook',
    note: 'The other heavy card: stages, milestones by stage, recurring obligations, documents, fields.',
    proposal: {
      type: 'proposal',
      tool: 'propose_engagement_template',
      toolUseId: 'tu_engagement',
      preview: {
        kind: 'propose_engagement_template',
        name: 'Company incorporation (URSB)',
        description: 'Incorporating a private company limited by shares, from name reservation to first statutory filings.',
        lightweight: false,
        isUpdate: false,
        stages: [
          { id: 's1', label: 'Name reservation', order: 0 },
          { id: 's2', label: 'Incorporation', order: 1 },
          { id: 's3', label: 'Post-incorporation', order: 2 },
        ],
        milestones: [
          { label: 'Reserve the company name', stageId: 's1', stageLabel: 'Name reservation', due: 'on the start date', reminder: true },
          { label: 'Confirm reservation before it lapses', stageId: 's1', stageLabel: 'Name reservation', due: '25 day(s) after the start date', reminder: true },
          { label: 'File Form S18 and the memorandum', stageId: 's2', stageLabel: 'Incorporation', due: '7 day(s) after the start date', reminder: true },
          { label: 'Collect the certificate of incorporation', stageId: 's2', stageLabel: 'Incorporation', due: '14 day(s) after the start date', reminder: false },
          { label: 'Register for a TIN with URA', stageId: 's3', stageLabel: 'Post-incorporation', due: '21 day(s) after the start date', reminder: true },
          { label: 'Open the company bank account', stageId: 's3', stageLabel: 'Post-incorporation', due: '30 day(s) after the start date', reminder: false },
        ],
        compliance: [
          { label: 'Annual return to URSB', schedule: 'Yearly, on the incorporation anniversary · reminders on · starts when completed' },
          { label: 'Beneficial ownership update', schedule: 'Yearly, in January · reminders on · starts when completed' },
        ],
        documents: [
          { label: 'Memorandum and articles', optional: false },
          { label: 'Directors\' consent forms', optional: false },
          { label: 'Shareholders\' agreement', optional: true },
        ],
        fields: [
          { section: 'Company', label: 'Proposed name', type: 'text', required: true },
          { section: 'Company', label: 'Share capital (UGX)', type: 'number', required: true },
          { section: 'Company', label: 'Registered office', type: 'text', required: true },
          { section: 'Company', label: 'Financial year end', type: 'date', required: false },
        ],
        roles: ['Client', 'Directors', 'Shareholders'],
      },
    },
  },
  {
    id: 'propose_engagement_template_light',
    label: 'Engagement playbook — lightweight',
    note: 'Stageless advisory playbook; the milestone grouping collapses to one list.',
    proposal: {
      type: 'proposal',
      tool: 'propose_engagement_template',
      toolUseId: 'tu_engagement2',
      preview: {
        kind: 'propose_engagement_template',
        name: 'Retainer advisory — monthly',
        description: 'Ongoing general counsel support with no fixed end point.',
        lightweight: true,
        isUpdate: true,
        stages: [],
        milestones: [
          { label: 'Monthly advisory call', stageId: '', stageLabel: '', due: 'on the target date', reminder: true },
          { label: 'Quarterly risk memo', stageId: '', stageLabel: '', due: '90 day(s) after the start date', reminder: true },
        ],
        compliance: [],
        documents: [{ label: 'Signed retainer letter', optional: false }],
        fields: [{ section: 'Retainer', label: 'Monthly fee (UGX)', type: 'number', required: true }],
        roles: ['Client'],
      },
    },
  },
  {
    id: 'forget_memory',
    label: 'Forget a recorded fact',
    note: 'Document-sourced facts come back on re-ingest — the card has to say so.',
    proposal: {
      type: 'proposal',
      tool: 'forget_memory',
      toolUseId: 'tu_forget',
      preview: {
        kind: 'forget_memory',
        memoryId: 'mem1',
        content: 'The client will not settle below UGX 300,000,000 and has instructed us to proceed to trial if the offer is lower.',
        scope: 'matter',
        scopeLabel: 'Kampala Millers Ltd v Nile Freight (U) Ltd',
        confidence: 0.86,
        recorded: iso(-45),
        reason: 'The client revised this instruction at the 12 August conference and will now settle at UGX 240,000,000.',
        provenance: { type: 'document', ref: 'Attendance note — 3 July 2026', locator: 'p. 2' },
        source: 'doc_9124',
      },
    },
  },
  {
    id: 'forget_memory_org',
    label: 'Forget a fact — firm-wide, no source',
    note: 'Minimal variant: no provenance block, no reason.',
    proposal: {
      type: 'proposal',
      tool: 'forget_memory',
      toolUseId: 'tu_forget2',
      preview: {
        kind: 'forget_memory',
        memoryId: 'mem2',
        content: 'The firm bills conveyancing at 2% of the consideration.',
        scope: 'org',
        scopeLabel: 'Firm-wide',
        confidence: 1,
        recorded: iso(-200),
      },
    },
  },
  {
    id: 'generic',
    label: 'Generic fallback',
    note: 'Any tool without a tailored preview lands here — raw key/value lines.',
    proposal: {
      type: 'proposal',
      tool: 'archive_matter',
      toolUseId: 'tu_generic',
      description: 'Archive this matter so it no longer appears in the active list.',
      input: {
        matter_id: 'm1',
        reason: 'Judgment satisfied and the file is closed',
        notify_team: true,
        assignee_ids: ['u1', 'u2'],
      },
      preview: { kind: 'generic' },
    },
  },
];

// ── Clarification cards (design mock, no tool behind them) ───────────────────
// The inverse of a proposal: "I cannot act yet, answer this". Modelled on
// Emergent and Claude — see the notes on each fixture for what it is testing.
interface QuestionSample {
  id: string;
  label: string;
  note: string;
  title: string;
  questions: QuestionSpec[];
  resolvesTo?: string;
  startCollapsed?: boolean;
  answered?: boolean;
}

const createMatterGaps: QuestionSpec[] = [
  {
    id: 'q1',
    prompt: 'Who is the instructing partner on this matter?',
    mode: 'single',
    options: [
      { id: 'o1', label: 'Sarah Nakato', hint: 'Partner · already on 14 commercial matters' },
      { id: 'o2', label: 'David Mugisha', hint: 'Partner · litigation' },
      { id: 'o3', label: 'Grace Akello', hint: 'Senior associate' },
    ],
    allowOther: true,
  },
  {
    id: 'q2',
    prompt: 'Two defendants were extracted but only one address. Which of these should I keep?',
    mode: 'multi',
    options: [
      { id: 'd1', label: 'Nile Freight (U) Ltd', hint: 'Plot 44 Nakawa Industrial Area, Kampala' },
      { id: 'd2', label: 'Sam Ssebugwawo', hint: 'No address found in the instructions' },
    ],
    allowOther: true,
    skippable: true,
  },
  {
    id: 'q3',
    prompt: 'Has the matter been referred to mediation?',
    mode: 'single',
    options: [
      { id: 'm1', label: 'Not yet' },
      { id: 'm2', label: 'Yes — referred', hint: 'I will add the mediation milestones to the timetable' },
    ],
    skippable: true,
  },
];

const ambiguousMatter: QuestionSpec[] = [
  {
    id: 'a1',
    prompt: 'Which matter did you mean by "the Nakato case"?',
    mode: 'single',
    options: [
      { id: 'c1', label: 'Nakato v Ssebugwawo & 2 Ors', hint: 'HCCS 214 of 2026 · Commercial Division · active' },
      { id: 'c2', label: 'Nakato v Attorney General', hint: 'MISC 88 of 2025 · Civil Division · closed March 2026' },
      { id: 'c3', label: 'Estate of the late J. Nakato', hint: 'Engagement · probate · in progress' },
    ],
    allowOther: true,
    skippable: true,
  },
];

const questionSamples: QuestionSample[] = [
  {
    id: 'q-create-matter',
    label: 'Filling the gaps before a proposal',
    note: 'Three questions, mixed single and multi. This is the create_matter warnings block turned into something answerable — note the final button names what it becomes.',
    title: 'Before I create this matter',
    questions: createMatterGaps,
    resolvesTo: 'Create matter',
  },
  {
    id: 'q-ambiguous',
    label: 'Disambiguation — single select',
    note: 'Claude\'s numbered list. One question, keyboard-first, with Skip and a free-text row.',
    title: 'Which matter did you mean?',
    questions: ambiguousMatter,
  },
  {
    id: 'q-collapsed',
    label: 'Collapsed — waiting for answers',
    note: 'Emergent\'s summary row: what the card looks like once it has scrolled back. Click it to open.',
    title: 'Before I create this matter',
    questions: createMatterGaps,
    resolvesTo: 'Create matter',
    startCollapsed: true,
  },
  {
    id: 'q-answered',
    label: 'Answered — settled in scrollback',
    note: 'The terminal state. A card that stays full height after it is dealt with is the problem the proposal cards have too.',
    title: 'Before I create this matter',
    questions: createMatterGaps,
    answered: true,
  },
];

const count = computed(() => samples.length);
const questionCount = computed(() => questionSamples.length);

// ProposalCard disables Approve when the workspace has no active plan. On a
// review page that reads as a design flaw, so say what it actually is.
const planActive = computed(() => !!usePlanActive()?.value?.active);
</script>

<template>
  <!-- The default layout hands pages a fixed-height, overflow-hidden box, so the
       scrolling has to happen inside the page: a non-shrinking toolbar over a
       flex-1 scroll region. A `min-h-full` root would simply be clipped. -->
  <div class="flex h-full min-h-0 flex-col">
    <!-- Toolbar -->
    <div class="shrink-0 border-b bg-background/85 backdrop-blur px-4 py-3">
      <div class="flex flex-wrap items-center gap-3">
        <div class="mr-auto min-w-0">
          <h1 class="text-base font-semibold leading-tight">Proposal card gallery</h1>
          <p class="text-xs text-muted-foreground">
            {{ count }} approval cards · {{ questionCount }} clarification mocks. Nothing here hits the backend.
          </p>
        </div>

        <div class="flex items-center gap-1 rounded-lg border p-0.5">
          <Button
            v-for="v in (['panel', 'glass'] as ProposalVariant[])"
            :key="v"
            size="sm"
            :variant="variant === v ? 'default' : 'ghost'"
            class="h-7 px-3 text-xs capitalize"
            @click="variant = v"
          >
            {{ v }}
          </Button>
        </div>

        <div class="flex items-center gap-1 rounded-lg border p-0.5">
          <Button
            v-for="w in (['dock', 'panel', 'wide'] as const)"
            :key="w"
            size="sm"
            :variant="width === w ? 'default' : 'ghost'"
            class="h-7 px-3 text-xs capitalize"
            @click="width = w"
          >
            <PanelRight v-if="w === 'dock'" class="size-3 mr-1" />
            <Columns2 v-else-if="w === 'panel'" class="size-3 mr-1" />
            <Maximize2 v-else class="size-3 mr-1" />
            {{ w }}
          </Button>
        </div>

        <Button size="sm" variant="outline" class="h-8 text-xs gap-1.5" @click="indexOpen = !indexOpen">
          <List class="size-3" />
          Index
        </Button>

        <Button size="sm" variant="outline" class="h-8 text-xs" @click="twoUp = !twoUp">
          {{ twoUp ? 'Single column' : 'Two up' }}
        </Button>

        <Button size="sm" variant="outline" class="h-8 text-xs gap-1.5" @click="loading = !loading">
          <RefreshCw class="size-3" :class="loading ? 'animate-spin' : ''" />
          {{ loading ? 'Loading on' : 'Loading off' }}
        </Button>
      </div>

      <p v-if="!planActive" class="mt-2 text-[11px] text-amber-600 dark:text-amber-500">
        This workspace has no active plan, so every Approve button below is disabled by ProposalCard — that is the real
        behaviour, not a styling bug.
      </p>

      <!-- Jump index -->
      <div v-if="indexOpen" class="mt-2 flex flex-wrap gap-1">
        <a
          v-for="q in questionSamples"
          :key="q.id"
          :href="`#card-${q.id}`"
          class="text-[11px] rounded-full border border-dashed px-2 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >{{ q.label }}</a>
        <a
          v-for="s in samples"
          :key="s.id"
          :href="`#card-${s.id}`"
          class="text-[11px] rounded-full border px-2 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >{{ s.label }}</a>
      </div>
    </div>

    <!-- Cards -->
    <div
      class="flex-1 min-h-0 overflow-y-auto p-4"
      :class="twoUp ? 'grid grid-cols-1 xl:grid-cols-2 gap-4 items-start content-start' : 'flex flex-col gap-4'"
    >
      <!-- Clarification cards — a design mock, kept visually apart from the
           shipping proposal cards so nobody mistakes it for something built. -->
      <section
        v-for="q in questionSamples"
        :id="`card-${q.id}`"
        :key="q.id"
        class="shrink-0 scroll-mt-4 rounded-xl border border-dashed overflow-hidden"
      >
        <header class="px-4 py-2.5 border-b border-dashed bg-muted/30">
          <div class="flex items-baseline gap-2 flex-wrap">
            <h2 class="text-sm font-semibold">{{ q.label }}</h2>
            <Badge variant="outline" class="text-[10px] border-dashed text-muted-foreground">mock — not built</Badge>
          </div>
          <p class="text-xs text-muted-foreground mt-0.5">{{ q.note }}</p>
        </header>
        <div
          class="p-6 flex justify-center"
          :class="variant === 'glass' ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900' : 'bg-background'"
        >
          <div class="w-full" :style="{ maxWidth: cardWidth }">
            <QuestionCardMock
              :key="`${q.id}-${variant}`"
              :questions="q.questions"
              :title="q.title"
              :variant="variant"
              :resolves-to="q.resolvesTo"
              :start-collapsed="q.startCollapsed"
              :answered="q.answered"
            />
          </div>
        </div>
      </section>

      <section
        v-for="s in samples"
        :id="`card-${s.id}`"
        :key="s.id"
        class="shrink-0 scroll-mt-4 rounded-xl border overflow-hidden"
      >
        <header class="px-4 py-2.5 border-b bg-muted/30">
          <div class="flex items-baseline gap-2 flex-wrap">
            <h2 class="text-sm font-semibold">{{ s.label }}</h2>
            <code class="text-[11px] text-muted-foreground">{{ s.proposal.tool }}</code>
            <Badge variant="outline" class="text-[10px]">{{ (s.proposal.preview as any)?.kind }}</Badge>
            <span v-if="lastAction[s.id]" class="ml-auto text-[11px] text-muted-foreground">{{ lastAction[s.id] }}</span>
          </div>
          <p class="text-xs text-muted-foreground mt-0.5">{{ s.note }}</p>
        </header>

        <!-- The card, on the surface it actually ships against. The glass variant
             only reads correctly over the dark voice overlay, so recreate it. -->
        <div
          class="p-6 flex justify-center"
          :class="variant === 'glass' ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900' : 'bg-background'"
        >
          <div class="w-full" :style="{ maxWidth: cardWidth }">
            <ProposalCard
              :proposal="s.proposal"
              :variant="variant"
              :loading="loading"
              @approve="act(s.id, 'Approved')"
              @dismiss="act(s.id, 'Dismissed')"
              @edit-manually="act(s.id, 'Edit manually')"
            />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
