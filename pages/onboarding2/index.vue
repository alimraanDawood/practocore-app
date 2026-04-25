<template>
  <div class="flex flex-col w-full h-dvh bg-background">
    <!-- Progress bar -->
    <div class="w-full h-0.5 bg-muted shrink-0">
      <div
        class="h-full bg-primary transition-all duration-700 ease-out"
        :style="{ width: `${progress}%` }"
      />
    </div>

    <!-- Header -->
    <div class="flex w-full flex-row items-center justify-between px-4 py-3 border-b shrink-0">
      <div class="flex items-center gap-2">
        <img
          src="@/assets/img/logos/Practo%20Core%20Square%20--%20orange.png"
          alt="PractoCore"
          class="h-7 w-auto"
        />
        <span class="text-base font-semibold ibm-plex-serif">PractoCore</span>
      </div>
      <div class="flex items-center gap-2">
        <SharedDarkModeSwitch />
        <NuxtLink to="/auth/login">
          <Button variant="secondary">
            Sign in instead
          </Button>
        </NuxtLink>
      </div>
    </div>

    <!-- Main content -->
    <div class="flex flex-col w-full flex-1 items-center overflow-hidden">
      <div class="overflow-y-auto flex flex-col w-full max-w-3xl flex-1 border-x">

        <Transition name="step" mode="out-in">
          <div
            v-if="currentStep !== 'matter-form'"
            :key="currentStep"
            class="flex flex-col flex-1 min-h-full"
          >

            <!-- PERSONA STEP -->
            <div v-if="currentStep === 'persona'" class="flex flex-col flex-1 min-h-full p-6">
              <div class="my-auto flex flex-col items-center gap-8 text-center">
                <div class="flex flex-col items-center gap-2 max-w-lg">
                  <h1 class="text-3xl font-bold ibm-plex-serif">Welcome to PractoCore</h1>
                  <p class="text-muted-foreground">
                    Litigation deadline management built for East African advocates. Let's get you set up.
                  </p>
                </div>
                <PageComponentsOnboardingPersonaSelector v-model="persona" />
              </div>
            </div>

            <!-- JOIN INFO STEP -->
            <div v-else-if="currentStep === 'join-info'" class="flex flex-col flex-1 min-h-full p-6">
              <div class="my-auto flex flex-col items-center gap-6 w-full">

                <!-- Code entry state -->
                <template v-if="joinInfoState === 'enter-code'">
                  <div class="flex flex-col items-center gap-2 text-center max-w-md">
                    <div class="flex items-center justify-center size-16 rounded-full bg-primary/10">
                      <Mail class="size-8 text-primary" />
                    </div>
                    <h2 class="text-2xl font-bold ibm-plex-serif">Join your firm's workspace</h2>
                    <p class="text-muted-foreground text-sm">
                      Check your email for an 8-character invite code from your firm administrator.
                    </p>
                  </div>

                  <div class="flex flex-col items-center gap-3 w-full max-w-sm">
                    <label class="text-sm font-medium self-start">Invite code</label>
                    <PinInput
                      :model-value="inviteCode"
                      @update:model-value="onInviteCodeChange"
                      type="text"
                      otp
                      placeholder="·"
                      class="justify-center"
                      @keydown.enter="canProceed && nextStep()"
                    >
                      <PinInputGroup>
                        <template :key="i" v-for="i in 8">
                          <PinInputSlot :index="i - 1" />
                          <template v-if="i === 4">
                            <PinInputSeparator />
                          </template>
                        </template>
                      </PinInputGroup>
                    </PinInput>
                    <p v-if="joinError" class="text-sm text-destructive text-center">{{ joinError }}</p>
                    <p class="text-xs text-muted-foreground text-center">Uppercase letters and numbers only</p>
                  </div>
                </template>

                <!-- Confirmed state -->
                <template v-else-if="joinInfoState === 'confirmed' && inviteDetails">
                  <div class="flex flex-col items-center gap-2 text-center max-w-md">
                    <div class="flex items-center justify-center size-16 rounded-full bg-green-500/10">
                      <CheckCircle2 class="size-8 text-green-500" />
                    </div>
                    <h2 class="text-2xl font-bold ibm-plex-serif">Invitation verified</h2>
                    <p class="text-muted-foreground text-sm">
                      Create your account to join the workspace below.
                    </p>
                  </div>

                  <div class="flex flex-col gap-3 w-full max-w-sm p-4 rounded-lg border bg-card">
                    <div class="flex flex-col gap-0.5">
                      <span class="text-xs text-muted-foreground uppercase tracking-wide">Firm</span>
                      <span class="font-semibold">{{ inviteDetails.orgName }}</span>
                    </div>
                    <div class="flex flex-col gap-0.5">
                      <span class="text-xs text-muted-foreground uppercase tracking-wide">Invited by</span>
                      <span class="text-sm">{{ inviteDetails.inviterName }}</span>
                    </div>
                    <div class="flex flex-col gap-0.5">
                      <span class="text-xs text-muted-foreground uppercase tracking-wide">For email</span>
                      <span class="text-sm font-mono">{{ inviteDetails.email }}</span>
                    </div>
                  </div>

                  <button
                    class="text-xs text-muted-foreground underline underline-offset-2"
                    @click="joinInfoState = 'enter-code'; inviteDetails = null; inviteToken = ''"
                  >
                    Use a different code
                  </button>
                </template>

              </div>
            </div>

            <!-- ORG DETAILS STEP -->
            <div v-else-if="currentStep === 'org-details'" class="flex flex-col flex-1 min-h-full p-6">
              <div class="my-auto flex flex-col items-center gap-6 w-full">
                <div class="flex flex-col items-center gap-2 text-center max-w-md">
                  <div class="flex items-center justify-center size-16 rounded-full bg-primary/10">
                    <Building2 class="size-8 text-primary" />
                  </div>
                  <h2 class="text-2xl font-bold ibm-plex-serif">Tell us about your firm</h2>
                  <p class="text-muted-foreground">
                    This sets up your firm's workspace. You'll invite your team after your first matter.
                  </p>
                </div>

                <div class="flex flex-col gap-1.5 w-full max-w-sm">
                  <label class="text-sm font-medium">Law firm name</label>
                  <Input
                    v-model="orgDetails.firmName"
                    placeholder="Kato & Associates Advocates"
                    class="w-full"
                    @keydown.enter="canProceed && nextStep()"
                  />
                  <p class="text-xs text-muted-foreground">As it appears on your firm's letterhead</p>
                </div>
              </div>
            </div>

            <!-- FIRM CONTACT STEP (ORG only) -->
            <div v-else-if="currentStep === 'firm-contact'" class="flex flex-col flex-1 min-h-full p-6">
              <div class="my-auto flex flex-col items-center gap-6 w-full">
                <div class="flex flex-col items-center gap-2 text-center max-w-md">
                  <div class="flex items-center justify-center size-16 rounded-full bg-primary/10">
                    <Phone class="size-8 text-primary" />
                  </div>
                  <h2 class="text-2xl font-bold ibm-plex-serif">Primary contact details</h2>
                  <p class="text-muted-foreground text-sm">
                    This person will manage the firm's account and receive important notifications.
                  </p>
                </div>

                <div class="flex flex-col gap-4 w-full max-w-sm">
                  <p class="text-xs text-muted-foreground text-center -mb-1">Pre-filled from your account — change if needed.</p>

                  <div class="flex flex-col gap-1.5">
                    <label class="text-sm font-medium">Full name</label>
                    <Input
                      v-model="firmContact.fullName"
                      type="text"
                      placeholder="Amina Nakato"
                      class="w-full"
                      autocomplete="name"
                    />
                  </div>

                  <div class="flex flex-col gap-1.5">
                    <label class="text-sm font-medium">Email address</label>
                    <Input
                      v-model="firmContact.emailAddress"
                      type="email"
                      placeholder="amina@nakatolaw.co.ug"
                      class="w-full"
                      autocomplete="email"
                    />
                  </div>

                  <div class="flex flex-col gap-1.5">
                    <label class="text-sm font-medium">Phone number <span class="text-muted-foreground font-normal">(optional)</span></label>
                    <UgandaPhoneInput
                      v-model="firmContact.phoneNumber"
                      @keydown.enter="canProceed && nextStep()"
                    />
                    <p class="text-xs text-muted-foreground">For account verification and critical notifications</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- MATTER MODE STEP -->
            <div v-else-if="currentStep === 'matter-mode'" class="flex flex-col flex-1 min-h-full p-6">
              <div class="my-auto flex items-center justify-center">
                <PageComponentsOnboardingSoloSelectMatterCreation v-model="creationMode" />
              </div>
            </div>

            <!-- DEADLINE REVEAL STEP — the AHA moment -->
            <div v-else-if="currentStep === 'deadline-reveal'" class="flex flex-col flex-1 min-h-full p-6 gap-6">
              <div class="flex flex-col gap-1 text-center">
                <span class="text-xs font-medium text-primary uppercase tracking-widest">Your deadline schedule is ready</span>
                <h2 class="text-2xl font-bold ibm-plex-serif">{{ calculatorResult?.title }}</h2>
                <p class="text-sm text-muted-foreground">{{ calculatorResult?.templateName }}</p>
              </div>

              <div class="flex flex-col gap-2 rounded-lg border overflow-hidden">
                <div class="flex items-center gap-2 px-4 py-2.5 bg-muted/60 border-b">
                  <Calendar class="size-3.5 text-muted-foreground" />
                  <span class="text-xs text-muted-foreground">
                    Trigger date: {{ calculatorResult?.triggerDate ? dayjs(calculatorResult.triggerDate).format('D MMMM YYYY') : '—' }}
                  </span>
                </div>

                <div class="flex flex-col divide-y">
                  <div
                    v-for="(deadline, index) in visibleDeadlines"
                    :key="deadline.id"
                    class="flex items-center justify-between px-4 py-3 deadline-row"
                    :style="{ '--delay': `${index * 55}ms` }"
                  >
                    <span class="text-sm font-medium">{{ deadline.name }}</span>
                    <div class="flex flex-col items-end gap-0.5 shrink-0 ml-4">
                      <span class="text-sm ibm-plex-serif tabular-nums">
                        {{ deadline.date ? dayjs(deadline.date).format('D MMM YYYY') : '—' }}
                      </span>
                      <span class="text-xs text-muted-foreground">
                        {{ deadline.date ? dayjs(deadline.date).fromNow() : '' }}
                      </span>
                    </div>
                  </div>

                  <div v-if="visibleDeadlines.length === 0" class="px-4 py-6 text-center text-sm text-muted-foreground">
                    No deadlines to display.
                  </div>
                </div>
              </div>

              <div class="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                <Bell class="size-3.5 mt-0.5 shrink-0" />
                <span>
                  PractoCore will send you reminders 30, 14, 7, 3, and 1 day before each deadline.
                  You can customise reminder rules after setup.
                </span>
              </div>
            </div>

            <!-- INVITE TEAM STEP (ORG only) -->
            <div v-else-if="currentStep === 'invite-team'" class="flex flex-col flex-1 min-h-full p-6">
              <div class="my-auto flex flex-col items-center gap-6 w-full">
                <div class="flex flex-col items-center gap-3 text-center max-w-md">
                  <div class="flex items-center justify-center size-16 rounded-full bg-primary/10">
                    <Users class="size-8 text-primary" />
                  </div>
                  <h2 class="text-2xl font-bold ibm-plex-serif">Invite your team</h2>
                  <p class="text-muted-foreground text-sm">
                    Add colleagues to your firm's workspace so they can start managing deadlines alongside you.
                    You can always invite more people later.
                  </p>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-sm">
                  <div class="flex flex-col gap-3 p-4 rounded-lg border bg-card">
                    <div class="flex items-center gap-2">
                      <UserPlus class="size-4 text-primary shrink-0" />
                      <p class="text-sm font-medium">Invite one by one</p>
                    </div>
                    <p class="text-xs text-muted-foreground flex-1">Send an email invite with a role assigned.</p>
                    <InviteUser @invited="onInvited">
                      <Button size="sm" class="w-full">
                        <UserPlus class="size-3.5 mr-1.5" />
                        Invite a member
                      </Button>
                    </InviteUser>
                  </div>

                  <div class="flex flex-col gap-3 p-4 rounded-lg border bg-card">
                    <div class="flex items-center gap-2">
                      <Download class="size-4 text-primary shrink-0" />
                      <p class="text-sm font-medium">Import via spreadsheet</p>
                    </div>
                    <p class="text-xs text-muted-foreground flex-1">Upload Excel or CSV to bulk-invite with roles.</p>
                    <ImportLawyers @imported="onInvited">
                      <Button size="sm" variant="outline" class="w-full">
                        <Download class="size-3.5 mr-1.5" />
                        Import spreadsheet
                      </Button>
                    </ImportLawyers>
                  </div>
                </div>

                <div
                  v-if="invitesSentCount > 0"
                  class="flex items-center gap-2 p-3 rounded-md bg-green-500/10 text-green-700 dark:text-green-400 text-sm"
                >
                  <CheckCircle2 class="size-4 shrink-0" />
                  <span>{{ invitesSentCount }} invitation{{ invitesSentCount === 1 ? '' : 's' }} sent — you can send more or continue.</span>
                </div>
              </div>
            </div>

            <!-- REMINDERS STEP -->
            <div v-else-if="currentStep === 'reminders'" class="flex flex-col flex-1 min-h-full p-6">
              <div class="my-auto flex flex-col items-center gap-6 w-full">
                <div class="flex flex-col items-center gap-2 text-center max-w-md">
                  <div class="flex items-center justify-center size-16 rounded-full bg-primary/10">
                    <Bell class="size-8 text-primary" />
                  </div>
                  <h2 class="text-2xl font-bold ibm-plex-serif">How should we remind you?</h2>
                  <p class="text-muted-foreground text-sm">
                    PractoCore sends deadline reminders 30, 14, 7, 3, and 1 day before each deadline.
                    Choose when and how you want them.
                  </p>
                </div>

                <div class="flex flex-col gap-3 w-full max-w-sm">
                  <!-- Daily reminder time -->
                  <div class="flex flex-col gap-3 p-4 rounded-lg border bg-card">
                    <div class="flex items-center justify-between">
                      <div class="flex flex-col gap-0.5">
                        <p class="text-sm font-medium">Daily reminder time</p>
                        <p class="text-xs text-muted-foreground">When you'd like to receive your morning summary</p>
                      </div>
                      <Input
                        type="time"
                        v-model="reminderPrefs.time"
                        class="w-28 text-sm"
                      />
                    </div>
                  </div>

                  <!-- Notification channels -->
                  <div class="flex flex-col gap-1 p-4 rounded-lg border bg-card">
                    <p class="text-sm font-medium mb-2">Notification channels</p>

                    <div class="flex items-center justify-between py-2">
                      <div class="flex flex-col gap-0.5">
                        <p class="text-sm">Email</p>
                        <p class="text-xs text-muted-foreground">Reminders sent to your inbox</p>
                      </div>
                      <Switch :model-value="reminderPrefs.email" @update:model-value="v => reminderPrefs.email = v" />
                    </div>

                    <Separator />

                    <div class="flex items-center justify-between py-2">
                      <div class="flex flex-col gap-0.5">
                        <p class="text-sm">In-app</p>
                        <p class="text-xs text-muted-foreground">Alerts inside PractoCore</p>
                      </div>
                      <Switch :model-value="reminderPrefs.app" @update:model-value="v => reminderPrefs.app = v" />
                    </div>

                    <Separator />

                    <div class="flex items-center justify-between py-2">
                      <div class="flex flex-col gap-0.5">
                        <p class="text-sm">Push notifications</p>
                        <p class="text-xs text-muted-foreground">Alerts on your device</p>
                      </div>
                      <Switch :model-value="reminderPrefs.push" @update:model-value="v => reminderPrefs.push = v" />
                    </div>

                    <Separator />

                    <div class="flex flex-col gap-2 py-2">
                      <div class="flex items-center justify-between">
                        <div class="flex flex-col gap-0.5">
                          <p class="text-sm">SMS</p>
                          <p class="text-xs text-muted-foreground">Text messages to your phone</p>
                        </div>
                        <Switch :model-value="reminderPrefs.sms" @update:model-value="v => reminderPrefs.sms = v" />
                      </div>
                      <div v-if="reminderPrefs.sms" class="flex flex-col gap-1">
                        <UgandaPhoneInput v-model="reminderPrefs.phone" />
                        <p class="text-xs text-muted-foreground">Uganda number — 9 digits after +256</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- ACCOUNT CREATE STEP -->
            <div v-else-if="currentStep === 'account-create'" class="flex flex-col flex-1 min-h-full p-6">
              <div class="my-auto flex flex-col items-center gap-6 w-full">
                <div class="flex flex-col items-center gap-2 text-center max-w-md">
                  <div class="flex items-center justify-center size-16 rounded-full bg-primary/10">
                    <User class="size-8 text-primary" />
                  </div>
                  <h2 class="text-2xl font-bold ibm-plex-serif">Create your account</h2>
                  <p class="text-muted-foreground text-sm">
                    Get started managing your litigation deadlines. It only takes a moment.
                  </p>
                </div>

                <!-- Google sign-in -->
                <div class="flex flex-col gap-3 w-full max-w-sm">
                  <Button
                    type="button"
                    variant="outline"
                    class="w-full"
                    :disabled="isGoogleLoading"
                    @click="onGoogleSignIn"
                  >
                    <svg v-if="!isGoogleLoading" class="size-4 mr-2 shrink-0" viewBox="-3 0 262 262" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid">
                      <path d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622 38.755 30.023 2.685.268c24.659-22.774 38.875-56.282 38.875-96.027" fill="#4285F4"/><path d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055-34.523 0-63.824-22.773-74.269-54.25l-1.531.13-40.298 31.187-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1" fill="#34A853"/><path d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82 0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602l42.356-32.782" fill="#FBBC05"/><path d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0 79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251" fill="#EB4335"/>
                    </svg>
                    <Loader2 v-else class="size-4 mr-2 animate-spin" />
                    Continue with Google
                  </Button>

                  <div class="flex items-center gap-3">
                    <div class="h-px bg-border flex-1" />
                    <span class="text-xs text-muted-foreground">or continue with email</span>
                    <div class="h-px bg-border flex-1" />
                  </div>
                </div>

                <form
                  id="account-form"
                  class="flex flex-col gap-4 w-full max-w-sm"
                  @submit.prevent="nextStep"
                >
                  <FormField v-slot="{ componentField }" name="fullName" :validate-on-blur="true">
                    <FormItem>
                      <FormLabel>Full name</FormLabel>
                      <FormControl>
                        <Input type="text" placeholder="Amina Nakato" v-bind="componentField" autocomplete="name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  </FormField>

                  <FormField v-slot="{ componentField }" name="emailAddress" :validate-on-blur="true">
                    <FormItem>
                      <FormLabel>Email address</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="amina@nakatolaw.co.ug" v-bind="componentField" autocomplete="email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  </FormField>

                  <FormField v-slot="{ componentField }" name="password" :validate-on-blur="true">
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <AuthPasswordInput placeholder="At least 8 characters" :component-field="componentField" autocomplete="new-password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  </FormField>

                  <FormField v-slot="{ componentField }" name="confirmPassword" :validate-on-blur="true">
                    <FormItem>
                      <FormLabel>Confirm password</FormLabel>
                      <FormControl>
                        <AuthPasswordInput placeholder="Re-enter your password" :component-field="componentField" autocomplete="new-password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  </FormField>

                  <button type="submit" class="hidden" />
                </form>

                <p class="text-xs text-muted-foreground text-center max-w-sm">
                  By continuing, you agree to our
                  <a href="#" class="underline hover:text-foreground">Terms of Service</a>
                  and
                  <a href="#" class="underline hover:text-foreground">Privacy Policy</a>.
                  A small trial fee applies — paid via mobile money on the next step.
                </p>
              </div>
            </div>

            <!-- TRIAL PAYMENT STEP -->
            <div v-else-if="currentStep === 'trial-payment'" class="flex flex-col flex-1 min-h-full p-6">
              <div class="my-auto w-full max-w-sm mx-auto">
                <TrialPayment
                  ref="trialPaymentRef"
                  :acc-type="persona === 'ORG' ? 'ORG' : 'IND'"
                  @complete="onTrialPaymentComplete"
                />
              </div>
            </div>

            <!-- CREATING STEP -->
            <div v-else-if="currentStep === 'creating'" class="flex flex-col flex-1 min-h-full p-6">
              <div class="my-auto flex flex-col items-center gap-4">
                <div class="flex items-center justify-center size-16 rounded-full bg-muted">
                  <Loader2 class="size-8 text-primary animate-spin" />
                </div>
                <div class="flex flex-col items-center gap-1 text-center">
                  <p class="font-medium">Creating your account…</p>
                  <p class="text-sm text-muted-foreground">This takes just a moment.</p>
                </div>
              </div>
            </div>


          </div>
        </Transition>

        <!-- MATTER FORM STEP (v-show preserves form state) -->
        <div v-show="currentStep === 'matter-form'" class="flex flex-col flex-1 p-6">
          <PageComponentsOnboardingSoloScratchMatter
            ref="scratchMatterRef"
            :mode="creationMode"
            @calculated="onCalculated"
          />
        </div>

      </div>
    </div>

    <!-- Footer nav (hidden on steps that manage their own navigation) -->
    <div
      v-if="showFooterNav"
      class="flex w-full items-center justify-center px-4 py-3 border-t bg-background shrink-0"
    >
      <div class="flex w-full max-w-3xl items-center gap-3 lg:justify-start justify-between">
        <Button
          variant="outline"
          size="sm"
          @click="previousStep"
          :disabled="!canGoBack"
          class="shrink-0"
        >
          <ArrowLeft class="size-4" />
          <span class="hidden sm:inline ml-1.5">Back</span>
        </Button>

        <!-- Step dots -->
        <div class="flex-1 hidden md:flex items-center justify-center gap-1.5">
          <div
            v-for="(step, i) in dotSteps"
            :key="step"
            class="rounded-full transition-all duration-300"
            :class="
              step === currentStep
                ? 'size-2 bg-primary'
                : i < dotStepIndex
                  ? 'size-1.5 bg-primary/40'
                  : 'size-1.5 bg-muted-foreground/20'
            "
          />
        </div>
        <div class="flex flex-row gap-2 items-center">
          <Button
            v-if="canSkip"
            type="button"
            size="sm"
            variant="outline"
            @click="skipStep"
          >
            Skip
          </Button>

          <Button
            size="sm"
            @click="nextStep"
            :disabled="!canProceed"
            class="shrink-0"
          >
            {{ footerNextLabel }}
            <ArrowRight class="size-4 ml-1.5" />
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import {
  ArrowLeft, ArrowRight, Bell, Calendar, Building2,
  Users, User, Loader2, UserPlus, Download, CheckCircle2, Phone, Mail,
} from 'lucide-vue-next'
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import * as z from 'zod'
import { toast } from 'vue-sonner'
import { individualSignUp, organisationSignUp, signUpWithGoogle, getUserPreferences, updateUserPreferencesById, updateUser, acceptInvite, getOrganisationInviteReference } from '~/services/auth'
import { pb, SERVER_URL } from '~/lib/pocketbase'
import { createMatter } from '~/services/matters'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import TrialPayment from '~/components/auth/RegisterScreens/TrialPayment.vue'
import InviteUser from '~/components/PageComponents/Organisation/Users/InviteUser/InviteUser.vue'
import ImportLawyers from '~/components/PageComponents/Organisation/Users/ImportLawyers/ImportLawyers.vue'

dayjs.extend(relativeTime)

definePageMeta({ layout: 'blank' })

type Persona = 'SOLO' | 'JOIN' | 'ORG'
type CreationMode = 'SCRATCH' | 'SAMPLE'
type Step =
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

// --- Flow state ---
const persona = ref<Persona>('SOLO')
const creationMode = ref<CreationMode | ''>('')
const currentStep = ref<Step>('persona')

// --- Org details (ORG only) ---
const orgDetails = reactive({ firmName: '' })

// --- Firm primary contact (ORG only) ---
const firmContact = reactive({ fullName: '', emailAddress: '', phoneNumber: '' })

// --- Reminder preferences ---
const reminderPrefs = reactive({ time: '09:00', email: true, app: true, push: true, sms: false, phone: '' })

// --- Matter result from ScratchMatter ---
const calculatorResult = ref<{
  mode: CreationMode
  title: string
  templateName: string
  triggerDate: string
  output: any
  templateId: string
  fieldValues: Record<string, any>
} | null>(null)

// --- Child component refs (for footer-driven submission) ---
const scratchMatterRef = ref()
const trialPaymentRef = ref()

// --- Google auth ---
const isGoogleAuth = ref(false)
const isGoogleLoading = ref(false)
const googleUserId = ref('')

// --- Created user (email path) ---
const createdUserId = ref('')
const isCreatingUser = ref(false)

const onGoogleSignIn = async () => {
  isGoogleLoading.value = true
  try {
    const result = await signUpWithGoogle()
    isGoogleAuth.value = true
    googleUserId.value = result.record?.id ?? ''
    advanceStep()
  } catch (e) {
    console.error(e)
    toast.error('Google sign-in failed. Please try again.')
  } finally {
    isGoogleLoading.value = false
  }
}

// --- Account form (vee-validate at page level) ---
const accountSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  emailAddress: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).superRefine(({ password, confirmPassword }, ctx) => {
  if (confirmPassword !== password) {
    ctx.addIssue({
      code: 'custom',
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    })
  }
})

const {
  values: accountValues,
  meta: accountMeta,
  validate: validateAccountForm,
} = useForm({
  validationSchema: toTypedSchema(accountSchema),
  initialValues: {
    fullName: '',
    emailAddress: '',
    password: '',
    confirmPassword: '',
  },
})

// --- Steps per persona ---
const stepsForPersona = computed<Step[]>(() => {
  switch (persona.value) {
    case 'ORG':
      return [
        'persona', 'account-create', 'org-details', 'firm-contact', 'matter-mode', 'matter-form',
        'deadline-reveal', 'reminders', 'trial-payment', 'creating', 'invite-team',
      ]
    case 'JOIN':
      return ['persona', 'join-info', 'account-create', 'reminders', 'creating']
    case 'SOLO':
    default:
      return [
        'persona', 'account-create', 'matter-mode', 'matter-form',
        'deadline-reveal', 'reminders', 'trial-payment', 'creating',
      ]
  }
})

const progress = computed(() => {
  const steps = stepsForPersona.value
  const index = steps.indexOf(currentStep.value)
  if (index === -1 || steps.length <= 1) return 0
  return (index / (steps.length - 1)) * 100
})

// Dot steps: only meaningful, user-visible steps
const dotSteps = computed<Step[]>(() =>
  stepsForPersona.value.filter(s => s !== 'creating')
)
const dotStepIndex = computed(() => dotSteps.value.indexOf(currentStep.value))

// --- Deadline data ---
const visibleDeadlines = computed(() =>
  (calculatorResult.value?.output?.deadlines || []).filter((d: any) => d.status !== 'unavailable')
)

// --- Footer ---
const showFooterNav = computed(() =>
  !['creating'].includes(currentStep.value)
)

// --- Navigation history (drives Back button, respects skips) ---
const stepHistory = ref<Step[]>([])

const canGoBack = computed(() => stepHistory.value.length > 0)

const canProceed = computed(() => {
  switch (currentStep.value) {
    case 'persona': return true
    case 'matter-mode': return !!creationMode.value
    case 'org-details': return !!orgDetails.firmName.trim()
    case 'firm-contact': return !!firmContact.fullName.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(firmContact.emailAddress)
    case 'deadline-reveal': return visibleDeadlines.value.length > 0
    case 'account-create': return accountMeta.value.valid && !isCreatingUser.value
    case 'join-info': return joinInfoState.value === 'confirmed'
      ? true
      : inviteCodeString.value.length === 8 && !isJoiningWorkspace.value
    case 'matter-form': return scratchMatterRef.value?.canSubmit ?? false
    case 'trial-payment': return !(trialPaymentRef.value?.isSubmitting ?? false)
    case 'reminders': return !reminderPrefs.sms || /^7[0-9]{8}$/.test(reminderPrefs.phone)
    default: return true
  }
})

const footerNextLabel = computed(() => {
  switch (currentStep.value) {
    case 'deadline-reveal': return 'Looks right — set up my workspace'
    case 'account-create': return isCreatingUser.value ? 'Creating account…' : 'Continue'
    case 'join-info': return joinInfoState.value === 'confirmed'
      ? 'Create my account'
      : isJoiningWorkspace.value ? 'Verifying…' : 'Verify code'
    case 'matter-form': return 'Calculate Preview'
    case 'trial-payment': return (trialPaymentRef.value?.isSubmitting) ? 'Processing…' : 'Continue to Payment'
    case 'invite-team': return invitesSentCount.value > 0 ? 'Go to app' : 'Skip for now'
    default: return 'Continue'
  }
})

// --- Navigation ---
// Steps that can be skipped, and where they jump to
const skipTargets = computed((): Partial<Record<Step, Step>> => ({
  'matter-mode': 'reminders',
  'matter-form': 'reminders',
  'deadline-reveal': 'reminders',
}))

// --- Join workspace (JOIN persona) ---
const inviteCode = ref<string[]>(Array(8).fill(''))
const isJoiningWorkspace = ref(false)
const joinError = ref('')
const inviteToken = ref('')
const inviteDetails = ref<{ orgName: string; inviterName: string; email: string } | null>(null)
const joinInfoState = ref<'enter-code' | 'confirmed'>('enter-code')

onMounted(async () => {
  const ref = useRoute().query.ref as string | undefined
  if (!ref) return
  try {
    const details = await getOrganisationInviteReference(ref)
    if (details?.invite) {
      persona.value = 'JOIN'
      inviteToken.value = ref
      inviteDetails.value = {
        orgName: details.invite.organisation.name,
        inviterName: details.invite.invitedBy.name,
        email: details.invite.email,
      }
      joinInfoState.value = 'confirmed'
      currentStep.value = 'join-info'
    }
  } catch (e) {
    // Fall through — user can enter code manually
  }
})

const onInviteCodeChange = (val: string[]) => {
  inviteCode.value = val.map(c => c.replace(/[^A-Za-z0-9]/g, '').toUpperCase())
}

const inviteCodeString = computed(() => inviteCode.value.join(''))

const joinWorkspace = async () => {
  // If already confirmed, advance to account-create
  if (joinInfoState.value === 'confirmed') {
    advanceStep()
    return
  }

  if (inviteCodeString.value.length !== 8 || isJoiningWorkspace.value) return
  isJoiningWorkspace.value = true
  joinError.value = ''
  try {
    // Step 1: resolve code → token
    const res = await fetch(`${SERVER_URL}/api/invitations/get-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: inviteCodeString.value }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.message ?? 'Invalid code. Please check and try again.')
    inviteToken.value = data.token

    // Step 2: fetch invite details for confirmation card
    const details = await getOrganisationInviteReference(data.token)
    if (!details?.invite) throw new Error('Could not load invitation details.')
    inviteDetails.value = {
      orgName: details.invite.organisation.name,
      inviterName: details.invite.invitedBy.name,
      email: details.invite.email,
    }
    joinInfoState.value = 'confirmed'
  } catch (e: any) {
    joinError.value = e.message ?? 'Invalid code. Please check and try again.'
  } finally {
    isJoiningWorkspace.value = false
  }
}

// --- Invite team (ORG only) ---
const invitesSentCount = ref(0)
const onInvited = () => { invitesSentCount.value++ }

const canSkip = computed(() => currentStep.value in skipTargets.value)

const skipStep = () => {
  const target = skipTargets.value[currentStep.value]
  if (target) {
    stepHistory.value.push(currentStep.value)
    currentStep.value = target as Step
  }
}

const advanceStep = () => {
  const steps = stepsForPersona.value
  const index = steps.indexOf(currentStep.value)
  if (index < steps.length - 1) {
    stepHistory.value.push(currentStep.value)
    currentStep.value = steps[index + 1]!
  }
}

const previousStep = () => {
  const prev = stepHistory.value.pop()
  if (prev) currentStep.value = prev
}

const nextStep = async () => {
  if (currentStep.value === 'join-info') {
    await joinWorkspace()
    return
  }
  if (currentStep.value === 'invite-team') {
    await navigateTo('/main')
    return
  }
  if (currentStep.value === 'matter-form') {
    await scratchMatterRef.value?.triggerSubmit()
    return // navigation driven by @calculated → onCalculated
  }
  if (currentStep.value === 'trial-payment') {
    await trialPaymentRef.value?.triggerSubmit()
    return // navigation driven by @complete → onTrialPaymentComplete
  }
  if (currentStep.value === 'account-create') {
    const result = await validateAccountForm()
    if (!result.valid) return
    isCreatingUser.value = true
    try {
      await pb.collection('Users').create({
        name: accountValues.fullName,
        email: accountValues.emailAddress,
        password: accountValues.password,
        passwordConfirm: accountValues.confirmPassword,
        emailVisibility: true,
      })
      await pb.collection('Users').authWithPassword(accountValues.emailAddress!, accountValues.password!)
      createdUserId.value = pb.authStore.record?.id ?? ''
      firmContact.fullName = accountValues.fullName ?? ''
      firmContact.emailAddress = accountValues.emailAddress ?? ''

      advanceStep()
    } catch (e: any) {
      const msg = e?.response?.data?.email?.message ?? e?.message ?? 'Failed to create account. That email may already be in use.'
      toast.error(msg)
    } finally {
      isCreatingUser.value = false
    }
    return
  }
  if (currentStep.value === 'reminders' && persona.value === 'JOIN') {
    await completeJoinSignup()
    return
  }
  advanceStep()
}

// --- JOIN flow completion ---
const completeJoinSignup = async () => {
  currentStep.value = 'creating'
  try {
    const prefs = await getUserPreferences()
    if (prefs?.id) {
      await updateUserPreferencesById(prefs.id, {
        reminder_time: reminderPrefs.time,
        use_email_notifications: reminderPrefs.email,
        use_app_notifications: reminderPrefs.app,
        use_push_notifications: reminderPrefs.push,
        use_sms_notifications: reminderPrefs.sms,
      })
      if (reminderPrefs.sms && reminderPrefs.phone)
        await updateUser({ phone: `+256${reminderPrefs.phone}` })
    }
  } catch (e) {
    console.error('Preferences save failed (non-fatal):', e)
  }
  try {
    await acceptInvite(inviteToken.value)
  } catch (e: any) {
    toast.error('Account created but failed to join workspace. Please contact your administrator.')
  }
  await navigateTo('/main')
}

// --- ScratchMatter event ---
const onCalculated = (payload: typeof calculatorResult.value) => {
  calculatorResult.value = payload
  // Advance to deadline-reveal
  currentStep.value = 'deadline-reveal'
}

// --- Trial payment → workspace setup ---
const onTrialPaymentComplete = async (phone: string) => {
  currentStep.value = 'creating'

  // Both Google and email paths use the same workspace setup logic.
  // The only difference is where the existing PocketBase user ID comes from.
  const userId = isGoogleAuth.value ? googleUserId.value : createdUserId.value

  try {
    const payload: any = {
      type: persona.value === 'ORG' ? 'ORG' : 'IND',
      user: {
        id: userId,
        mobileMoneyNumber: phone,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    }

    if (persona.value === 'ORG') {
      payload.organisation = {
        firmName: orgDetails.firmName,
        firmEmailDomain: '',
        contact: {
          fullName: firmContact.fullName,
          emailAddress: firmContact.emailAddress,
          phoneNumber: firmContact.phoneNumber,
        },
      }
      await organisationSignUp(payload)
    } else {
      await individualSignUp(payload)
    }

    // Refresh auth record so pb.authStore.record reflects the organisation
    // field that the backend just set during signup. InviteForm reads this.
    await pb.collection('Users').authRefresh()

    await saveMatterAndRedirect()
  } catch (e) {
    console.error(e)
    toast.error('Failed to set up your workspace. Please try again.')
    currentStep.value = 'trial-payment'
  }
}

// --- Shared: save matter + redirect (used by both email and Google paths) ---
const saveMatterAndRedirect = async () => {
  // Save reminder preferences (UserPreferences record created server-side during signup)
  try {
    const prefs = await getUserPreferences()
    if (prefs?.id) {
      await updateUserPreferencesById(prefs.id, {
        reminder_time: reminderPrefs.time,
        use_email_notifications: reminderPrefs.email,
        use_app_notifications: reminderPrefs.app,
        use_push_notifications: reminderPrefs.push,
        use_sms_notifications: reminderPrefs.sms,
      })
      if (reminderPrefs.sms && reminderPrefs.phone)
        await updateUser({ phone: `+256${reminderPrefs.phone}` })
    }
  } catch (e) {
    console.error('Preferences save failed (non-fatal):', e)
  }

  if (calculatorResult.value?.templateId) {
    try {
      await createMatter({
        name: calculatorResult.value.title,
        caseNumber: '',
        personal: true,
        templateId: calculatorResult.value.templateId,
        date: calculatorResult.value.triggerDate,
        fieldValues: calculatorResult.value.fieldValues,
      })
    } catch (e) {
      console.error('Matter save failed (non-fatal):', e)
    }
  }
  if (persona.value === 'ORG') {
    stepHistory.value = []  // disable Back from invite step — org setup is complete
    currentStep.value = 'invite-team'
  } else {
    await navigateTo('/main')
  }
}

</script>

<style scoped>
.step-enter-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}
.step-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.step-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
.step-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.deadline-row {
  animation: deadlineIn 0.35s ease-out both;
  animation-delay: var(--delay, 0ms);
}

@keyframes deadlineIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>