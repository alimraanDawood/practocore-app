import { defineStore } from 'pinia'

export type Persona = 'SOLO' | 'JOIN' | 'ORG'
export type RegisterStep =
    | 'persona'
    | 'join-info'
    | 'org-details'
    | 'firm-contact'
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

export interface InviteDetails {
    orgName: string
    inviterName: string
    email: string
}

// Steps per persona — defined outside store so they can be used in getters cleanly
const STEPS_BY_PERSONA: Record<Persona, RegisterStep[]> = {
    ORG: [
        'persona', 'account-create', 'org-details', 'firm-contact',
        'reminders', 'trial-payment', 'creating', 'invite-team',
    ],
    JOIN: [
        'persona', 'join-info', 'account-create', 'reminders', 'creating',
    ],
    SOLO: [
        'persona', 'account-create', 'reminders', 'trial-payment', 'creating',
    ],
}

const SKIP_TARGETS: Partial<Record<RegisterStep, RegisterStep | string>> = {
    'invite-team': '/main',
}

export const useRegisterStore = defineStore('register', {
    state: () => ({
        // Flow control
        persona: 'SOLO' as Persona,

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

        // Auth state
        isGoogleAuth: false,
        googleUserId: '',
        createdUserId: '',
        // True when the user is already authenticated on entry (e.g. signed in with
        // Google from the login page, or created their account earlier in this flow).
        // Removes the redundant account-create step from the flow.
        accountExists: false,

        // JOIN invite flow
        inviteToken: '',
        inviteDetails: null as InviteDetails | null,
        joinInfoState: 'enter-code' as 'enter-code' | 'confirmed',

        // Team invite tracking (ORG only)
        invitesSentCount: 0,

        // Trial payment details captured from TrialPayment, consumed by StepCreating
        mobileMoneyPhone: '',
        trialPaymentMethod: 'MOBILE_MONEY' as 'MOBILE_MONEY' | 'CARD' | 'MANUAL',

        // Cached account form values — lets StepAccountCreate re-hydrate on back-nav
        accountFormValues: {
            fullName: '',
            emailAddress: '',
            password: '',
            confirmPassword: '',
        },

        // Step UI state — steps write here; layout reads here
        stepCanProceed: true as boolean,
        stepFooterLabel: 'Continue' as string,
        stepNextAction: null as (() => Promise<void>) | null,
    }),

    getters: {
        steps(): RegisterStep[] {
            const base = STEPS_BY_PERSONA[this.persona]
            // Once the user is already authenticated, account-create is redundant —
            // drop it so navigation, progress and the step dots all skip it cleanly.
            return this.accountExists ? base.filter(s => s !== 'account-create') : base
        },

        dotSteps(): RegisterStep[] {
            return (this.steps as RegisterStep[]).filter(s => s !== 'creating')
        },

        progressForStep(): (step: RegisterStep) => number {
            const steps = this.steps as RegisterStep[]
            return (step: RegisterStep): number => {
                const index = steps.indexOf(step)
                if (index === -1 || steps.length <= 1) return 0
                return (index / (steps.length - 1)) * 100
            }
        },
    },

    actions: {
        reset() {
            this.$reset()
        },

        // Navigation path helpers — return full Nuxt route paths

        nextStepPath(currentStep: RegisterStep): string | null {
            const steps = this.steps
            const index = steps.indexOf(currentStep)
            if (index === -1 || index >= steps.length - 1) return null
            return `/auth/register/${steps[index + 1]}`
        },

        prevStepPath(currentStep: RegisterStep): string | null {
            const steps = this.steps
            const index = steps.indexOf(currentStep)
            if (index <= 0) return null
            if (steps[index - 1] === 'creating') {
                return null
            }
            return `/auth/register/${steps[index - 1]}`
        },

        skipTargetPath(currentStep: RegisterStep): string | null {
            const target = SKIP_TARGETS[currentStep]
            if (!target) return null
            return target.startsWith('/') ? target : `/auth/register/${target}`
        },

        // Convenience: advance from a given step
        async advance(currentStep: RegisterStep) {
            const next = this.nextStepPath(currentStep)
            if (next) await navigateTo(next)
        },
    },
})