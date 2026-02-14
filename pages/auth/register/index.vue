<template>
  <div class="grid grid-cols-1 lg:grid-cols-2 w-screen h-dvh divide-x">
    <div class="flex flex-col w-full overflow-hidden items-center col-span justify-center">
      <div class="flex flex-row justify-between w-full items-center p-3 border-b">
        <div class="flex flex-row gap-2">
          <Button size="icon" variant="secondary" :disabled="!canGoBack" @click="goBack">
            <ArrowLeft/>
          </Button>

          <Button size="icon" variant="secondary" :disabled="!canGoForward" @click="goForward">
            <ArrowRight/>
          </Button>
        </div>

        <SharedDarkModeSwitch />
      </div>

      <div class="flex flex-col h-full w-[95vw] max-w-xl items-center border-x overflow-hidden">
        <Transition mode="out-in" :name="direction === 'forward' ? 'slide-left' : 'slide-right'" class="max-w-sm">
          <AccountType class="max-w-sm p-3" v-if="currentStep === RegistrationSteps.ACC_TYPE" :account-type="registrationData?.type" @complete="accountTypeRegistComplete" />
          <OrganisationRegister class="max-w-sm p-3" :organisation-data="registrationData.organisation" v-else-if="currentStep === RegistrationSteps.ORG_REGIST" @complete="organisationRegistComplete" />
          <FirmDetailsRegister class="max-w-sm p-3" :firm-details-data="registrationData.organisation" v-else-if="currentStep === RegistrationSteps.FIRM_DETAILS_REGIST" @complete="firmDetailsRegistComplete" />
          <PrimaryContactRegister class="max-w-sm p-3" :primary-contact-data="registrationData.organisation" v-else-if="currentStep === RegistrationSteps.PRIMARY_CONTACT_REGIST" @complete="primaryContactRegistComplete" />
          <AdminRegister :inviteRef="organisationRef" class="max-w-sm p-3" :admin-data="registrationData.user" v-else-if="currentStep === RegistrationSteps.ADMIN_REGIST" @complete="adminRegistComplete" @google="adminRegistGoogle" />
          <CreatingAccount class="max-w-sm p-3" v-else-if="currentStep === RegistrationSteps.CREATING" />
          <OTP class="max-w-sm p-3" :otp-id="otpId" @complete="OTPEntryComplete" :user-id="userId" v-else-if="currentStep === RegistrationSteps.OTP" />
        </Transition>
      </div>

      <div class="flex flex-row text-sm text-center w-full justify-center text-muted-foreground border-t p-3">
        <span>
          Already have an account?
          <NuxtLink :to="query?.ref ? `/auth/login?ref=${query?.ref}` : '/auth/login'" class="text-primary font-semibold underline">Login Instead</NuxtLink>.
        </span>
      </div>
    </div>

    <div class="bg-muted w-full h-full col-span-1 lg:flex flex-col hidden">
      <div class="flex flex-col w-full p-8">
        <span class="font-semibold text-3xl ibm-plex-serif">Litigation Deadline Management made effortless</span>
        <span class="text-muted-foreground">Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. A</span>
      </div>

      <div class="relative w-full overflow-hidden pl-8 flex flex-col items-end justify-end h-full">
        <img src="@/assets/img/screenshots/home_desktop_dark_corner.png" class="hidden dark:block shadow border rounded-xl" />
        <img src="@/assets/img/screenshots/home_desktop_light_corner.png" class="dark:hidden border shadow rounded-xl" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'; // Import ref, reactive, computed from 'vue'
import {ArrowLeft, ArrowRight, Maximize2, Minus, X} from 'lucide-vue-next'
import AccountType from "~/components/auth/RegisterScreens/AccountType.vue";
import OrganisationRegister from "~/components/auth/RegisterScreens/OrganisationRegister.vue";
import PrimaryContactRegister from "~/components/auth/RegisterScreens/PrimaryContactRegister.vue";
import FirmDetailsRegister from "~/components/auth/RegisterScreens/FirmDetailsRegister.vue";
import AdminRegister from "~/components/auth/RegisterScreens/AdminRegister.vue";
import CreatingAccount from "~/components/auth/RegisterScreens/CreatingAccount.vue";
import OTP from '~/components/auth/RegisterScreens/OTP.vue';
import Subscription from "~/components/auth/RegisterScreens/Subscription.vue";

import {
  acceptInvite,
  getOrganisationInviteReference,
  getSignedInUser,
  signInWithEmail,
  submitAccountDetails
} from "~/services/auth";
import {toast} from "vue-sonner";
import {getCurrentWindow} from "@tauri-apps/api/window";
import DarkModeSwitch from "~/components/shared/DarkModeSwitch/DarkModeSwitch.vue";
// query allows us to tell whether the registration is from a link
const query = useRoute().query;

const xyzAnimation = computed(() => {
  return direction.value === 'forward'
      ? 'fade in-right out-left'
      : 'fade in-left out-right'
})

// --- Registration Steps Enum ---
enum RegistrationSteps {
  ACC_TYPE = 1,
  ORG_REGIST = 2,
  PRIMARY_CONTACT_REGIST = 3,
  FIRM_DETAILS_REGIST = 4,
  ADMIN_REGIST = 5,
  CREATING = 6,
  OTP = 7,
  SUBSCRIPTION = 8
}

const joiningAndIsSignedIn = computed(() => {
  return query?.ref !== undefined && query.ref !== null && getSignedInUser();
});

// --- Doubly Linked List for History ---

class RegistrationStepNode {
  step: RegistrationSteps;
  prev: RegistrationStepNode | null;
  next: RegistrationStepNode | null;

  constructor(step: RegistrationSteps) {
    this.step = step;
    this.prev = null;
    this.next = null;
  }
}

class RegistrationHistory {
  head: RegistrationStepNode | null;
  currentStepNode: RegistrationStepNode | null;

  constructor() {
    this.head = null;
    this.currentStepNode = null;
  }

  reset() {
    this.head = null;
    this.currentStepNode = null;
  }

  /**
   * Adds a new step to the history.
   * This invalidates any "forward" history from the current point.
   */
  addStep(step: RegistrationSteps) {
    const newNode = new RegistrationStepNode(step);

    if (!this.head) {
      this.head = newNode;
    } else {
      newNode.prev = this.currentStepNode;
      if (this.currentStepNode) {
        this.currentStepNode.next = newNode;
      }
      // Any nodes previously linked as 'next' from currentStepNode are now unreferenced
      // and will be garbage collected, effectively discarding forward history.
    }
    this.currentStepNode = newNode;
  }

  /**
   * Moves back in history.
   * @returns {RegistrationSteps | null} The previous step, or null if at the start.
   */
  goBack(): RegistrationSteps | null {
    if (this.currentStepNode && this.currentStepNode.prev) {
      this.currentStepNode = this.currentStepNode.prev;
      return this.currentStepNode.step;
    }
    return null;
  }

  /**
   * Moves forward in history.
   * @returns {RegistrationSteps | null} The next step, or null if at the end.
   */
  goForward(): RegistrationSteps | null {
    if (this.currentStepNode && this.currentStepNode.next) {
      this.currentStepNode = this.currentStepNode.next;
      return this.currentStepNode.step;
    }
    return null;
  }

  /**
   * Checks if there's a previous step to go back to.
   */
  canGoBack(): boolean {
    return this.currentStepNode !== null && this.currentStepNode.prev !== null;
  }

  /**
   * Checks if there's a next step to go forward to.
   */
  canGoForward(): boolean {
    return this.currentStepNode !== null && this.currentStepNode.next !== null;
  }
}

// --- Reactive State ---
// Using ref for currentStep as it's a primitive.
const currentStep = ref<RegistrationSteps>(RegistrationSteps.ACC_TYPE);
const organisationRef = ref(null);
const inviteSent = ref(false);

const acceptInvitation = async (token : string) => {
  try {
    const response = await acceptInvite(token);

    if(response) {
      inviteSent.value = true;
    }

  } catch(e) {
    console.error(e);

  }
}
onMounted(async () => {
  if(query?.ref) {
    currentStep.value = RegistrationSteps.ADMIN_REGIST;
    organisationRef.value = await getOrganisationInviteReference(query?.ref);
  }

  if(joiningAndIsSignedIn.value) {
  }
})


// Use reactive for complex objects if you prefer, or ref for all.
const registrationData = reactive({
  type: 'IND',
  organisation: {
    firmName: '',
    firmEmailDomain: '',
    contact: {
      fullName: '',
      emailAddress: '',
      phoneNumber: ''
    }
  },
  user: {
    id: '',
    fullName: '',
    emailAddress: '',
    password: '',
    confirmPassword: '',
    timezone: ''
  }
});

const userId = ref('');
const otpId = ref('');
const orgId = ref(null);

// Initialize the history manager
const historyManager = reactive(new RegistrationHistory());

// Immediately add the initial step to history
historyManager.addStep(currentStep.value);

// --- Computed Properties for Button State ---
const canGoBack = computed(() => historyManager.canGoBack());
const canGoForward = computed(() => historyManager.canGoForward());

// --- Navigation Functions (Wrapper for historyManager) ---
const goToStep = (step: RegistrationSteps) => {
  direction.value = 'forward';

  historyManager.addStep(step);
  currentStep.value = step;
};

const direction = ref('forward'); // 'back' || 'forward'

const goBack = () => {
  direction.value = 'back';
  const previousStep = historyManager.goBack();
  if (previousStep !== null) {
    currentStep.value = previousStep;
  }
};

const goForward = () => {
  direction.value = 'forward';

  const nextStep = historyManager.goForward();
  if (nextStep !== null) {
    currentStep.value = nextStep;
  }
};

// --- Registration Completion Handlers ---
const accountTypeRegistComplete = (val: 'ORG' | 'IND') => {
  if(val === 'ORG') {
    registrationData.type = 'ORG';
    goToStep(RegistrationSteps.ORG_REGIST);
  } else if (val === 'IND') {
    registrationData.type = 'IND';
    goToStep(RegistrationSteps.ADMIN_REGIST);
  }
}

const organisationRegistComplete = (val: any) => { // Consider more specific type for val
  registrationData.organisation = { ...registrationData.organisation, ...val };
  goToStep(RegistrationSteps.FIRM_DETAILS_REGIST);
}

const firmDetailsRegistComplete = (val: any) => { // Consider more specific type for val
  registrationData.organisation = {...registrationData.organisation, ...val};
  goToStep(RegistrationSteps.PRIMARY_CONTACT_REGIST);
}

const primaryContactRegistComplete = (val: any) => { // Consider more specific type for val
  registrationData.organisation = {...registrationData.organisation,
    contact: val
  }
  goToStep(RegistrationSteps.ADMIN_REGIST);
}

const adminRegistComplete = (val: any) => { // Consider more specific type for val
  registrationData.user = val;
  // For the final step before submission, you might not want to add it to history
  // if you don't want the user to go back to "Creating Account" or "OTP" from the next step.
  // I'll keep it simple for now, but you could skip `goToStep` and just set `currentStep.value` directly.
  currentStep.value = RegistrationSteps.CREATING; // This step is purely for UI feedback
  submitData();
}

const adminRegistGoogle = (val: any) => { // registered using google
  registrationData.user = {...registrationData.user, id: val?.record?.id };

  currentStep.value = RegistrationSteps.CREATING;
  submitData();
}

const OTPEntryComplete = async (val: any) => {
  try {
    if (val === true) {
      const signInResult = await signInWithEmail(registrationData.user.emailAddress, registrationData.user.password);

      if(query?.ref) {
        useRouter().push(`/onboarding`)
        return;
      }

      if(orgId.value !== null) {
        useRouter().push(`/onboarding`);
      } else {
        useRouter().push('/onboarding');
      }
    }
  } catch(e) {
    console.error(e);
  }
}

const subscriptionRegistComplete = () => {
  // debate on what to do here
  toast.success("Sign up is done!");
  useRouter().push('/auth/invite');
}

const submitData = async () => {
  try {
    const result = await submitAccountDetails(registrationData, query?.ref ? query?.ref : null);

    if(result) {
      otpId.value = result.otpId;
      userId.value = result.userId;

      orgId.value = result.organisation || null;

    }
    // Directly setting currentStep here, as OTP might be a terminal step not for history nav
    // If you want OTP to be part of back/forward, use `goToStep(RegistrationSteps.OTP)`

    if(otpId.value !== null) {
      currentStep.value = RegistrationSteps.OTP;
    } else {
      useRouter().push('/onboarding')
    }

    historyManager.reset()
  } catch(e) {
    toast.error("We were unable to create your account!");
    console.error(e);
  }
}

definePageMeta({
  layout: 'blank',
});

const isTauri = computed(() => {
  return '__TAURI_INTERNALS__' in window;
});

const isMainWindow = computed(() => {
  const currentWindow = getCurrentWindow();

  return currentWindow?.label === 'main';
});

const closeWindow = () => {
  const currentWindow = getCurrentWindow();
  currentWindow?.close();
}

const minimizeWindow = () => {
  const currentWindow = getCurrentWindow();
  currentWindow?.minimize();
}

const toggleMaximizeWindow = () => {
  const currentWindow = getCurrentWindow();
  currentWindow?.toggleMaximize();
}
</script>


<style scoped>
/* Forward animation (slide from right) */
.slide-left-enter-active,
.slide-left-leave-active {
  transition: all 0.4s ease;
}

.slide-left-enter-from {
  opacity: 0;
  transform: translateX(20%);
}

.slide-left-leave-to {
  opacity: 0;
  transform: translateX(-20%);
}

/* Backward animation (slide from left) */
.slide-right-enter-active,
.slide-right-leave-active {
  transition: all 0.4s ease;
}

.slide-right-enter-from {
  opacity: 0;
  transform: translateX(-20%);
}

.slide-right-leave-to {
  opacity: 0;
  transform: translateX(20%);
}
</style>