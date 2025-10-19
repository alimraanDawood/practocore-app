import type { DeadlineTemplate } from '~/stores/templateEditor'

export const starterTemplates: { id: string; name: string; template: DeadlineTemplate }[] = [
  {
    id: 't_summons',
    name: 'Summons to File Defence',
    template: {
      id: 't_summons',
      name: 'Summons to File Defence',
      version: '2.0',
      description: 'Standard deadlines from summons to reply and directions.',
      date_rules: { allowWeekends: true, allowHolidays: true },
      fields: [
        { id: 'f_def_type', name: 'defendant_type', label: 'Defendant Type', type: 'select', required: true, options: [
          { value: 'individual', label: 'Individual' },
          { value: 'corporate', label: 'Corporate' },
          { value: 'government', label: 'Government' },
        ]}
      ],
      deadlines: [
        { id: '_date_', name: 'Start Date', type: 'offset', dynamic: false, description: 'Filing date',
          offset: { offsetId: '_root_', days: 0, allowHolidays: true, allowWeekends: true }, reminders: [] },
        { id: 'd_deliver', name: 'Deliver summons to defendant', type: 'offset', dynamic: true,
          description: 'Serve/Deliver summons to defendant',
          offset: {
            offsetId: '_date_', days: 21, includeFirst: false,
            conditional: {
              rules: [
                { days: 30, conditions: [ { type: 'field', fieldId: 'f_def_type', operator: 'equals', value: 'government' } ] }
              ],
              default: 21
            }
          },
          reminders: []
        },
        { id: 'd_defence', name: 'Defendant files defence', type: 'offset', dynamic: true,
          offset: { offsetId: 'd_deliver', days: 15 },
          reminders: []
        },
        { id: 'd_reply', name: 'Plaintiff files reply', type: 'offset', dynamic: true,
          offset: { offsetId: 'd_defence', days: 15 },
          reminders: []
        },
        { id: 'd_directions', name: 'Take out summons for directions', type: 'offset', dynamic: true,
          conditions: [],
          offset: { offsetId: 'd_reply', days: 28 },
          reminders: []
        }
      ]
    }
  },
  {
    id: 't_notice_motion',
    name: 'Notice of Motion',
    template: {
      id: 't_notice_motion', name: 'Notice of Motion', version: '1.0', description: 'Motion filing to hearing.',
      date_rules: { allowWeekends: true, allowHolidays: true }, fields: [],
      deadlines: [
        { id: '_date_', name: 'Start Date', type: 'offset', dynamic: false, offset: { offsetId: '_root_', days: 0, allowHolidays: true, allowWeekends: true }, reminders: [] },
        { id: 'd_file_motion', name: 'File Motion', type: 'offset', dynamic: true, offset: { offsetId: '_date_', days: 1 }, reminders: [] },
        { id: 'd_serve_motion', name: 'Serve Motion', type: 'offset', dynamic: true, offset: { offsetId: 'd_file_motion', days: 3 }, reminders: [] },
        { id: 'd_hearing', name: 'Hearing Date', type: 'offset', dynamic: true, offset: { offsetId: 'd_serve_motion', days: 14 }, reminders: [] }
      ]
    }
  },
  {
    id: 't_chamber_summons',
    name: 'Chamber Summons',
    template: {
      id: 't_chamber_summons', name: 'Chamber Summons', version: '1.0', description: 'Chamber summons workflow.',
      date_rules: { allowWeekends: true, allowHolidays: true }, fields: [],
      deadlines: [
        { id: '_date_', name: 'Start Date', type: 'offset', dynamic: false, offset: { offsetId: '_root_', days: 0, allowHolidays: true, allowWeekends: true }, reminders: [] },
        { id: 'd_prepare', name: 'Prepare Draft Order', type: 'offset', dynamic: true, offset: { offsetId: '_date_', days: 7 }, reminders: [] },
        { id: 'd_file', name: 'File Chamber Summons', type: 'offset', dynamic: true, offset: { offsetId: 'd_prepare', days: 2 }, reminders: [] },
        { id: 'd_serve', name: 'Serve Documents', type: 'offset', dynamic: true, offset: { offsetId: 'd_file', days: 3 }, reminders: [] }
      ]
    }
  },
  {
    id: 't_appeal',
    name: 'Appeal',
    template: {
      id: 't_appeal', name: 'Appeal', version: '1.0', description: 'Appeal from decision to record of appeal.',
      date_rules: { allowWeekends: true, allowHolidays: true },
      fields: [
        { id: 'f_transcript', name: 'transcript_required', label: 'Transcript Required', type: 'boolean', required: false },
      ],
      deadlines: [
        { id: '_date_', name: 'Start Date', type: 'offset', dynamic: false, offset: { offsetId: '_root_', days: 0, allowHolidays: true, allowWeekends: true }, reminders: [] },
        { id: 'd_notice_appeal', name: 'File Notice of Appeal', type: 'offset', dynamic: true, offset: { offsetId: '_date_', days: 14 }, reminders: [] },
        { id: 'd_request_transcripts', name: 'Request Transcripts', type: 'offset', dynamic: true, conditions: [ { type: 'field', fieldId: 'f_transcript', operator: 'equals', value: true } ], offset: { offsetId: 'd_notice_appeal', days: 7 }, reminders: [] },
        { id: 'd_record_appeal', name: 'File Record of Appeal', type: 'offset', dynamic: true, offset: { offsetId: 'd_notice_appeal', days: 60 }, reminders: [] }
      ]
    }
  }
]

export default starterTemplates
