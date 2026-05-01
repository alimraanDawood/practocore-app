import { defineStore } from 'pinia'

export type Persona = 'SOLO' | 'JOIN' | 'ORG'
export type CreationMode = 'SCRATCH' | 'SAMPLE'
export type RegisterStep =
    | 'persona'
    | 'join-info'
    | 'org-details'
    | 'firm-contact'
    | 'matter-mode'
    | 'matter-form'
    | 'deadline-reveal'
    | 'invite-team'
    | 'account-create'
    | 'reminders'
    | 'trial-payment'
    | 'creating'

export interface ReminderPrefs {
    time: string
    email: boolean
    app: boolean
    push: boolean
    sms: boolean
    phone: string
}

export interface OrgDetails {
    firmName: string
}

export interface FirmContact {
    fullName: string
    emailAddress: string
    phoneNumber: string
}

export interface CalculatorResult {
    mode: CreationMode
    title: string
    templateName: string
    triggerDate: string
    output: any
    templateId: string
    fieldValues: Record<string, any>
}

export interface InviteDetails {
    orgName: string
    inviterName: string
    email: string
}

// Steps per persona — defined outside store so they can be used in getters cleanly
const STEPS_BY_PERSONA: Record<Persona, RegisterStep[]> = {
    ORG: [
        'persona', 'account-create', 'org-details', 'firm-contact',
        'matter-mode', 'matter-form', 'deadline-reveal', 'reminders',
        'trial-payment', 'creating', 'invite-team',
    ],
    JOIN: [
        'persona', 'join-info', 'account-create', 'reminders', 'creating',
    ],
    SOLO: [
        'persona', 'account-create', 'matter-mode', 'matter-form',
        'deadline-reveal', 'reminders', 'trial-payment', 'creating',
    ],
}

const SKIP_TARGETS: Partial<Record<RegisterStep, RegisterStep>> = {
    'matter-mode': 'reminders',
    'matter-form': 'reminders',
    'deadline-reveal': 'reminders',
}

export const useRegisterStore = defineStore('register', {
    state: () => ({
        // Flow control
        persona: 'SOLO' as Persona,
        creationMode: '' as CreationMode | '',

        // Firm / org data
        orgDetails: { firmName: '' } as OrgDetails,
        firmContact: { fullName: '', emailAddress: '', phoneNumber: '' } as FirmContact,

        // Reminder preferences
        reminderPrefs: {
            time: '09:00',
            email: true,
            app: true,
            push: true,
            sms: false,
            phone: '',
        } as ReminderPrefs,

        // Calculator / matter result
        calculatorResult: null as CalculatorResult | null,

        // Auth state
        isGoogleAuth: false,
        googleUserId: '',
        createdUserId: '',

        // JOIN invite flow
        inviteToken: '',
        inviteDetails: null as InviteDetails | null,
        joinInfoState: 'enter-code' as 'enter-code' | 'confirmed',

        // Team invite tracking (ORG only)
        invitesSentCount: 0,

        // Mobile money phone captured from TrialPayment, consumed by StepCreating
        mobileMoneyPhone: '',

        // Cached account form values — lets StepAccountCreate re-hydrate on back-nav
        accountFormValues: {
            fullName: '',
            emailAddress: '',
            password: '',
            confirmPassword: '',
        },
    }),

    getters: {
        steps: (state): RegisterStep[] => STEPS_BY_PERSONA[state.persona],

        dotSteps(): RegisterStep[] {
            return (this.steps as RegisterStep[]).filter(s => s !== 'creating')
        },

        progressForStep: (state) => (step: RegisterStep): number => {
            const steps = STEPS_BY_PERSONA[state.persona]
            const index = steps.indexOf(step)
            if (index === -1 || steps.length <= 1) return 0
            return (index / (steps.length - 1)) * 100
        },
    },

    actions: {
        reset() {
            this.$reset()
        },

        // Navigation path helpers — return full Nuxt route paths

        nextStepPath(currentStep: RegisterStep): string | null {
            const steps = STEPS_BY_PERSONA[this.persona]
            const index = steps.indexOf(currentStep)
            if (index === -1 || index >= steps.length - 1) return null
            return `/auth/register/${steps[index + 1]}`
        },

        prevStepPath(currentStep: RegisterStep): string | null {
            const steps = STEPS_BY_PERSONA[this.persona]
            const index = steps.indexOf(currentStep)
            if (index <= 0) return null
            if (steps[index - 1] === 'creating') {
                return null
            }
            return `/auth/register/${steps[index - 1]}`
        },

        skipTargetPath(currentStep: RegisterStep): string | null {
            const target = SKIP_TARGETS[currentStep]
            return target ? `/auth/register/${target}` : null
        },

        // Convenience: advance from a given step
        async advance(currentStep: RegisterStep) {
            const next = this.nextStepPath(currentStep)
            if (next) await navigateTo(next)
        },
    },
})