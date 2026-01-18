<template>
  <div class="flex flex-col h-dvh overflow-hidden">
    <!-- Header -->
    <div class="flex-shrink-0 flex flex-row w-full p-3 border-b items-center justify-between">
      <div class="flex flex-row gap-2 items-center">
        <img src="@/assets/img/logos/Practo%20Core%20Square%20--%20orange.png" class="size-10" alt="logo" />
        <span class="text-xl font-semibold ibm-plex-serif">PractoCore</span>
      </div>

      <div class="flex flex-row gap-2 items-center">
        <SharedDarkModeSwitch />
        <Button size="sm" variant="outline" @click="currentStep = 3">Skip</Button>
      </div>

    </div>

    <!-- Main content - takes remaining space -->
    <div class="flex flex-col w-full px-5 flex-1 min-h-0 overflow-hidden">
      <div class="flex flex-col w-full h-full border-x min-h-0">

        <!-- Steps 1-3: Split layout (content + description) -->
        <template v-if="currentStep < 3">
          <!-- Step content area -->
          <div class="flex flex-col overflow-hidden relative flex-1 min-h-0">
            <!-- Step 1 -->
            <div class="w-full h-full flex flex-col bg-muted items-center justify-center p-5 overflow-auto" v-if="currentStep === 0">
              <div class="flex flex-col p-2 bg-background border rounded-lg">
                <img src="@/assets/img/intro/timeline-light.svg" alt="timeline" class="dark:hidden" />
                <img src="@/assets/img/intro/timeline-dark.svg" alt="timeline" class="dark:block hidden" />
              </div>
            </div>

            <!-- Step 2 -->
            <div class="flex flex-col gap-3 justify-center bg-muted p-3 h-full overflow-auto" v-else-if="currentStep === 1">
              <div class="flex flex-row gap-2 items-center justify-between w-full sm:max-w-sm">
                <div class="bg-background flex flex-row items-center gap-2 border px-3 py-1.5 text-sm font-semibold text-muted-foreground rounded-full">
                  Notifications

                  <div class="size-4 bg-muted text-foreground rounded grid place-items-center text-xs">
                    2
                  </div>
                </div>

                <Button size="sm" variant="outline">Mark All as Read</Button>
              </div>
              <div class="flex flex-row sm:max-w-sm bg-background p-3 border rounded-lg gap-2 w-full">
                <div class="flex flex-col">
                  <div class="size-8 grid place-items-center bg-muted text-muted-foreground border rounded">
                    <Bell class="size-4" />
                  </div>
                </div>
                <div class="flex flex-col gap-1 w-full overflow-hidden">
                  <span class="text-sm font-semibold ibm-plex-serif">Final Notice: Summons for Directions Due Tomorrow</span>
                  <span class="text-xs text-muted-foreground">
                    <b>Final Notice:</b> Summons for directions must be taken out by tomorrow. This is your last reminder to comply with this critical deadline.
                  </span>
                </div>
              </div>

              <div class="flex flex-row sm:max-w-sm bg-background p-3 border rounded-lg gap-2 w-full">
                <div class="flex flex-col">
                  <div class="size-8 grid place-items-center bg-muted text-muted-foreground border rounded">
                    <Bell class="size-4" />
                  </div>
                </div>
                <div class="flex flex-col gap-1 w-full overflow-hidden">
                  <span class="text-sm font-semibold ibm-plex-serif">Upcoming: File Plaintiff Reply</span>
                  <span class="text-xs text-muted-foreground">
                    Reminder: You have <b>10 days remaining</b> to file the plaintiff's reply or answer to counterclaim and reply.
                  </span>
                </div>
              </div>
            </div>

            <!-- Step 3 -->
            <div class="bg-muted flex flex-col w-full h-full p-2 overflow-auto" v-else-if="currentStep === 2">
              <div class="flex flex-col gap-5 w-full p-3 bg-background rounded-lg border">
                <div class="flex flex-col">
                  <span class="font-semibold">Add Parties</span>
                  <span class="text-muted-foreground text-xs">Add the parties involved in this matter and specify who you're representing. </span>
                </div>

                <div class="flex flex-col gap-2">
                  <div class="flex flex-row w-full justify-between">
                    <div class="flex flex-col">
                      <span class="text-sm"><b>Plaintiffs</b> (Min: 1)</span>
                      <span class="text-xs text-muted-foreground">Atleast 1 plaintiff required</span>
                    </div>

                    <Button size="sm" variant="secondary">
                      <Plus class="size-4" /> Add Plaintiff
                    </Button>
                  </div>

                  <div class="flex flex-col gap-1">
                    <div class="flex flex-col p-2 border gap-1 rounded-lg bg-muted/50">
                      <span class="text-sm">Name</span>

                      <div class="flex flex-row gap-2">
                        <div class="file:text-foreground items-center  placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm">
                          Nakalema Pauline
                        </div>
                        <Button variant="destructive" size="icon">
                          <Trash2 class="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="flex flex-col gap-2">
                  <div class="flex flex-row w-full justify-between">
                    <div class="flex flex-col">
                      <span class="text-sm"><b>Defendants</b> (Min: 1)</span>
                      <span class="text-xs text-muted-foreground">At least 1 defendant required</span>
                    </div>

                    <Button size="sm" variant="secondary">
                      <Plus class="size-4" /> Add Defendant
                    </Button>
                  </div>

                  <div class="flex flex-col gap-1">
                    <div class="flex flex-col p-2 border bg-muted/50 gap-1 rounded-lg">
                      <span class="text-sm">Name</span>

                      <div class="flex flex-row gap-2">
                        <div class="file:text-foreground items-center  placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm">
                          Joseph Andorah
                        </div>
                        <Button variant="destructive" size="icon">
                          <Trash2 class="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Step title/description - fixed height area -->
          <XyzTransition xyz="fade" mode="out-in" class="flex-shrink-0 flex flex-col p-3 gap-3 py-6 items-center border-t">
            <div v-if="currentStepData" :key="currentStep" class="flex flex-col gap-3 items-center text-center">
              <span class="text-2xl font-semibold ibm-plex-serif">{{ currentStepData.title }}</span>
              <span class="text-muted-foreground">{{ currentStepData.description }}</span>
            </div>
          </XyzTransition>
        </template>

        <!-- Step 4: Full screen layout -->
        <div v-else class="flex flex-col h-full w-full overflow-auto gap-4 p-5 items-center justify-center">
          <span class="text-2xl ibm-plex-serif font-bold">Register or Sign in</span>
          <div class="flex flex-col w-full gap-2">
            <Button class="w-full" @click="goToRegister">Create Account</Button>
            <Button class="w-full" variant="secondary" @click="goToLogin">Sign In</Button>
          </div>
        </div>

      </div>
    </div>

    <!-- Footer navigation - fixed height -->
    <div class="flex-shrink-0 flex flex-col p-3 border-t gap-4">
      <!-- Step indicators -->
      <div class="flex flex-row gap-2 items-center justify-center">
        <button
            v-for="index in steps.length"
            :key="index"
            @click="currentStep = index - 1"
            class="size-2 rounded-full transition-all duration-300"
            :class="index - 1 === currentStep ? 'bg-primary w-6' : 'bg-muted-foreground/30'"
        />
      </div>

      <!-- Navigation buttons -->
      <XyzTransition xyz="fade" mode="out-in">
        <div v-if="currentStep === 0" class="flex flex-row w-full">
          <Button class="w-full" @click="next">Next</Button>
        </div>

        <div v-else class="grid grid-cols-2 gap-5 w-full">
          <Button variant="secondary" @click="back">Back</Button>
          <Button @click="next">Next</Button>
        </div>
      </XyzTransition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Bell, Plus, Trash2 } from 'lucide-vue-next';

definePageMeta({
  layout: 'blank'
});

const router = useRouter();
const { markIntroSeen } = useIntro();

const currentStep = ref(0);

interface Step {
  title: string;
  description: string;
}

const steps: Step[] = [
  {
    title: 'Intelligent Deadline Calculation',
    description: 'Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata',
  },
  {
    title: 'Never-Miss Reminder System',
    description: 'Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata',
  },
  {
    title: 'Matter & Case Management',
    description: 'Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata',
  },
  {
    title: '',
    description: '',
  },
];

const currentStepData = computed(() => steps[currentStep.value]);

const next = () => {
  if (currentStep.value < steps.length - 1) {
    currentStep.value++;
  }
};

const back = () => {
  if (currentStep.value > 0) {
    currentStep.value--;
  }
};

const skip = async () => {
  // Mark intro as seen so it won't show again
  await markIntroSeen();
  router.push('/auth/login');
};

const goToRegister = async () => {
  await markIntroSeen();
  router.push('/auth/register');
};

const goToLogin = async () => {
  await markIntroSeen();
  router.push('/auth/login');
};
</script>