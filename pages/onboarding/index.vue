<template>
  <div class="flex flex-col w-full h-[100dvh] items-center bg-gradient-to-b from-background to-muted/20">
    <div class="flex flex-col w-full h-full">
      <!-- Progress Bar -->
      <div class="w-full h-1 bg-muted">
        <div
            class="h-full bg-primary transition-all duration-500 ease-out"
            :style="{ width: `${progress}%` }"
        />
      </div>

      <div class="flex w-full  flex-row items-center justify-between p-3 border-b">
        <div class="flex items-center gap-2">
          <img src="@/assets/img/logos/Practo%20Core%20Square%20--%20orange.png" alt="logo" class="h-8 w-auto"/>
          <span class="text-lg font-semibold ibm-plex-serif">PractoCore</span>
        </div>
        <div class="flex flex-row gap-2 items-center">
          <SharedDarkModeSwitch />
          <Button
              v-if="currentStep > 0 && currentStep < steps.length - 1"
              variant="outline"
              size="sm"
              @click="skipStep"
          >
            Skip
          </Button>

          <div v-if="isTauri" class="flex flex-row items-center gap-2">
            <button @click="minimizeWindow" class="bg-muted text-muted-foreground size-6 grid place-items-center rounded-full"><Minus class="size-4" /></button>
            <button @click="toggleMaximizeWindow" class="bg-muted text-muted-foreground size-6 grid place-items-center rounded-full">
              <Maximize2 class="size-3 stroke-3" />
            </button>
            <button @click="closeWindow" class="bg-muted text-muted-foreground size-6 grid place-items-center rounded-full"><X class="size-4" /></button>
          </div>
        </div>
      </div>

      <!-- Content Area -->
      <div class="flex flex-col w-full h-full items-center overflow-hidden">
        <div class=" overflow-y-scroll flex flex-col w-full max-w-3xl h-full border-x">
          <!-- Welcome Screen -->
          <div v-if="currentStep === 0" class="flex flex-col lg:items-center lg:justify-center lg:text-center h-full gap-6 p-5 animate-in fade-in duration-500">
            <div class="flex flex-col gap-3">
              <h1 class="text-4xl font-bold ibm-plex-serif">
                Welcome to PractoCore
              </h1>
              <p class="text-xl text-muted-foreground">
                Hi {{ userName }}, let's get you set up! 👋
              </p>
            </div>

            <div class="flex flex-col">
              <span
                  class="text-sm lg:text-lg text-muted-foreground">PractoCore automatically calculates court deadlines under Ugandan civil procedure rules, sends timely reminders, and helps ensure you and your team never miss a filing date.</span>
            </div>
          </div>

          <!-- Profile Photo Step -->
          <div v-if="currentStep === 1" class="flex flex-col gap-6 p-5 animate-in fade-in duration-500">
            <div class="flex flex-col gap-2 text-center">
              <h2 class="text-2xl font-bold ibm-plex-serif">Set Your Profile Photo</h2>
              <p class="text-muted-foreground">Help your team recognize you</p>
            </div>

            <div class="flex flex-col items-center gap-6 mt-4">
              <!-- Avatar Display -->
              <div class="relative group">
                <Avatar class="size-32 border-4 border-primary/20">
                  <AvatarImage :src="currentAvatarUrl" alt="Profile photo" :key="currentAvatarUrl"/>

                  <AvatarFallback class="text-3xl bg-primary/10 text-primary">
                    {{ userInitials }}
                  </AvatarFallback>
                </Avatar>
                <div
                    class="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera class="size-8 text-white"/>
                </div>
              </div>

              <!-- Upload Controls -->
              <div class="flex flex-col gap-3 w-full max-w-sm">
                <input
                    ref="fileInput"
                    type="file"
                    accept="image/*"
                    class="hidden"
                    @change="handleFileSelect"
                />

                <Button @click="triggerFileInput" :disabled="isUploadingPhoto" class="w-full">
                  <Upload class="size-4 mr-2"/>
                  {{ currentAvatarUrl ? 'Change Photo' : 'Upload Photo' }}
                </Button>

                <Button
                    v-if="currentAvatarUrl"
                    variant="outline"
                    @click="clearAvatar"
                    :disabled="isUploadingPhoto"
                    class="w-full"
                >
                  <X class="size-4 mr-2"/>
                  Remove Photo
                </Button>
              </div>

              <!-- Cropper Modal -->
              <Dialog v-model:open="showCropper">
                <DialogContent class="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Crop Your Photo</DialogTitle>
                    <DialogDescription>Adjust the crop area to your liking</DialogDescription>
                  </DialogHeader>

                  <div class="w-full h-[400px] bg-muted rounded-lg overflow-hidden">
                    <Cropper
                        ref="cropper"
                        :src="selectedImage"
                        :stencil-props="{ aspectRatio: 1 }"
                        class="h-full w-full"
                    />
                  </div>

                  <div class="flex gap-2">
                    <Button @click="uploadAvatar" :disabled="isUploadingPhoto" class="flex-1">
                      {{ isUploadingPhoto ? 'Uploading...' : 'Save Photo' }}
                    </Button>
                    <Button variant="outline" @click="cancelCrop" :disabled="isUploadingPhoto" class="flex-1">
                      Cancel
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <!-- Reminder Preferences Step -->
          <div v-if="currentStep === 2" class="flex flex-col gap-6 p-5 animate-in fade-in duration-500">
            <div class="flex flex-col gap-2 text-center">
              <h2 class="text-2xl font-bold ibm-plex-serif">Set Your Preferences</h2>
              <p class="text-muted-foreground">Customize how you receive reminders</p>
            </div>

            <div class="flex flex-col gap-6 mt-4 max-w-xl mx-auto w-full">
              <!-- Reminder Time -->
              <div class="flex flex-col gap-3 p-5 rounded-lg border bg-card">
                <div class="flex items-center gap-2">
                  <Clock class="size-5 text-primary"/>
                  <h3 class="font-semibold">Daily Reminder Time</h3>
                </div>
                <p class="text-sm text-muted-foreground">
                  Choose when you'd like to receive your daily deadline reminders
                </p>
                <Input
                    v-model="reminderTime"
                    type="time"
                    class="max-w-xs"
                />
              </div>

              <!-- Notification Channels -->
              <div class="flex flex-col gap-3 p-5 rounded-lg border bg-card">
                <div class="flex items-center gap-2">
                  <Bell class="size-5 text-primary"/>
                  <h3 class="font-semibold">Notification Channels</h3>
                </div>
                <p class="text-sm text-muted-foreground mb-2">
                  Select how you want to be notified
                </p>

                <div class="flex flex-col gap-3">
                  <div class="flex items-center justify-between p-3 rounded-md hover:bg-muted/50 transition-colors">
                    <div class="flex items-center gap-3">
                      <Mail class="size-5 text-muted-foreground"/>
                      <div>
                        <p class="font-medium">Email Notifications</p>
                        <p class="text-xs text-muted-foreground">Receive reminders via email</p>
                      </div>
                    </div>
                    <Switch :model-value="emailNotifications" @update:model-value="v => emailNotifications = v"/>
                  </div>

                  <div class="flex items-center justify-between p-3 rounded-md hover:bg-muted/50 transition-colors">
                    <div class="flex items-center gap-3">
                      <Smartphone class="size-5 text-muted-foreground"/>
                      <div>
                        <p class="font-medium">App Notifications</p>
                        <p class="text-xs text-muted-foreground">Get in-app alerts</p>
                      </div>
                    </div>
                    <Switch :model-value="appNotifications" @update:model-value="v => appNotifications = v"/>
                  </div>

                  <div class="flex items-center justify-between p-3 rounded-md hover:bg-muted/50 transition-colors">
                    <div class="flex items-center gap-3">
                      <BellRing class="size-5 text-muted-foreground"/>
                      <div>
                        <p class="font-medium">Push Notifications</p>
                        <p class="text-xs text-muted-foreground">Receive push alerts on mobile</p>
                      </div>
                    </div>
                    <Switch :model-value="pushNotifications" @update:model-value="v => pushNotifications = v"/>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Create Matter Step -->
          <div v-if="currentStep === 3" class="flex flex-col gap-2 p-3 animate-in fade-in duration-500">
            <div class="flex flex-row w-full justify-between">
              <span class="font-semibold text-lg ibm-plex-serif">Add your matters</span>

              <SharedMattersCreateMatter @created="reloadMatters">
                <Button size="sm">
                  <Plus />

                  Add Matter
                </Button>
              </SharedMattersCreateMatter>
            </div>

            <div class="flex flex-col w-full">
                <div class="lg:block hidden">
                  <Table class="w-full">
                    <TableHeader>
                      <TableRow class="bg-muted divide-x border">
                        <TableHead class="w-[150px] font-semibold ibm-plex-serif">Case Number</TableHead>
                        <TableHead class="font-semibold ibm-plex-serif">Case Name</TableHead>
                        <TableHead class="font-semibold ibm-plex-serif">Upcoming Deadline</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody class="divide-y border border-t-0">
                      <TableRow v-for="(matter, index) in matters?.items || []" class="divide-x">
                        <TableCell>{{ matter?.caseNumber }}</TableCell>
                        <TableCell>{{ matter?.name }}</TableCell>
                        <TableCell>
                          <div class="flex flex-row gap-1 items-center">
                            <Clock class="size-4" />

                            <span>
                              {{ dayjs(matter?.expand?.deadlines?.sort((a, b) => new Date(a) - new Date(b))?.at(0)?.date)?.fromNow() || 'UNKOWN DATE' }}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
                <div class="lg:hidden flex flex-col bg-muted divide-y border rounded-lg">
                  <div v-for="matter in matters?.items" class="flex flex-col gap-2 p-3">
                    <div class="flex flex-row gap-1 items-center">
                      <span class="text-sm text-muted-foreground">Matter</span>
                      <div class="bg-muted-foreground size-1.5 rounded-full"></div>
                      <span class="text-sm text-muted-foreground">{{ matter?.caseNumber }}</span>
                    </div>

                    <span class="ibm-plex-serif text-xl">
                      {{ matter?.name }}
                    </span>

                    <div class="flex flex-row gap-2 items-center">
                      <Clock class="size-4" />
                      {{ dayjs(matter?.expand?.deadlines?.sort((a, b) => new Date(a) - new Date(b))?.at(0)?.date)?.fromNow() || 'UNKNOWN DATE' }}
                    </div>
                  </div>
                </div>
              </div>
          </div>

          <!-- Invite Members Step (for organization users) -->
          <div v-if="currentStep === 4 && isOrganizationUser"
               class="flex flex-col gap-6 p-5 animate-in fade-in duration-500">
            <div class="flex flex-col gap-2 text-center">
              <h2 class="text-2xl font-bold ibm-plex-serif">Invite Your Team</h2>
              <p class="text-muted-foreground">Collaborate with your colleagues</p>
            </div>

            <div class="flex flex-col gap-6 mt-4 max-w-xl mx-auto w-full">
              <div class="flex flex-col gap-3 p-5 rounded-lg border bg-card">
                <div class="flex items-center gap-2">
                  <UserPlus class="size-5 text-primary"/>
                  <h3 class="font-semibold">Invite Team Members</h3>
                </div>
                <p class="text-sm text-muted-foreground">
                  Send invitations to your team members to join your organization
                </p>
              </div>

              <!-- Invite Form -->
              <div class="flex flex-col gap-4">
                <div v-for="(invite, index) in inviteList" :key="index" class="flex gap-2 items-start">
                  <div class="flex-1 flex flex-col sm:flex-row gap-2">
                    <Input
                        v-model="invite.email"
                        type="email"
                        placeholder="colleague@lawfirm.com"
                        class="flex-1"
                    />
                    <Input
                        v-model="invite.name"
                        type="text"
                        placeholder="Full Name (optional)"
                        class="flex-1"
                    />
                    <Select v-model="invite.role">
                      <SelectTrigger class="w-full sm:w-32">
                        <SelectValue placeholder="Role"/>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="moderator">Moderator</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                      v-if="inviteList.length > 1"
                      variant="ghost"
                      size="icon"
                      @click="removeInvite(index)"
                  >
                    <X class="size-4"/>
                  </Button>
                </div>

                <Button variant="outline" @click="addInviteField" class="w-full">
                  <Plus class="size-4 mr-2"/>
                  Add Another
                </Button>

                <div v-if="invitationStatus" class="p-3 rounded-md"
                     :class="invitationStatus.success ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'">
                  <p class="text-sm">{{ invitationStatus.message }}</p>
                </div>

                <Button @click="sendInvitations" :disabled="isSendingInvites || !hasValidInvites" class="w-full">
                  <Send class="size-4 mr-2"/>
                  {{ isSendingInvites ? 'Sending Invitations...' : 'Send Invitations' }}
                </Button>
              </div>

              <!-- Already Invited Members -->
              <div v-if="sentInvites.length > 0" class="flex flex-col gap-2">
                <h4 class="text-sm font-semibold text-muted-foreground">Invitations Sent</h4>
                <div class="flex flex-col gap-2">
                  <div v-for="invite in sentInvites" :key="invite.email"
                       class="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                    <CheckCircle2 class="size-4 text-green-600"/>
                    <span class="text-sm">{{ invite.email }}</span>
                    <Badge variant="secondary" class="ml-auto">{{ invite.role }}</Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Completion Step -->
          <div v-if="currentStep === finalStep"
               class="flex flex-col gap-6 p-5 items-center text-center animate-in fade-in duration-500">
            <div class="flex items-center justify-center size-24 rounded-full bg-primary/10">
              <CheckCircle2 class="size-12 text-primary"/>
            </div>

            <div class="flex flex-col gap-2">
              <h2 class="text-3xl font-bold ibm-plex-serif">You're All Set!</h2>
              <p class="text-muted-foreground text-lg">
                Welcome to a better way to manage deadlines
              </p>
            </div>

            <div class="flex flex-col gap-3 w-full max-w-md mt-4">
              <div class="p-4 rounded-lg border bg-card text-left">
                <h3 class="font-semibold mb-2">What's Next?</h3>
                <ul class="space-y-2 text-sm text-muted-foreground">
                  <li class="flex items-start gap-2">
                    <div class="size-1.5 rounded-full bg-primary mt-1.5"/>
                    <span>Explore deadline templates for your jurisdiction</span>
                  </li>
                  <li class="flex items-start gap-2">
                    <div class="size-1.5 rounded-full bg-primary mt-1.5"/>
                    <span>Import existing matters to stay organized</span>
                  </li>
                  <li class="flex items-start gap-2">
                    <div class="size-1.5 rounded-full bg-primary mt-1.5"/>
                    <span>Customize templates to match your workflow</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Navigation -->
      <div class="flex flex-row w-full gap-3 items-center justify-center p-3 border-t bg-background">
        <div class="flex flex-row w-full lg:w-fit gap-5">
          <Button
              variant="outline"
              @click="previousStep"
              :disabled="currentStep === 0"
              class="flex-1"
          >
            <ArrowLeft class="size-4 mr-2"/>
            Back
          </Button>

          <div class="hidden md:flex flex-row gap-1 items-center justify-center">
            <div class="size-2 bg-muted rounded-full" v-for="i in (steps.length - 1)"
                 :class="{ 'bg-primary': (currentStep + 1) > i }"></div>
          </div>

          <Button
              @click="nextStep"
              :disabled="!canProceed"
              class="flex-1 md:w-fit"
              v-if="currentStep < finalStep"
          >
            Next
            <ArrowRight class="size-4 ml-2"/>
          </Button>
          <Button
              v-else
              @click="router.push('/main')"
              :disabled="!canProceed"
              class="flex-1 md:w-fit"
          >
            Complete
            <ArrowRight class="size-4 ml-2"/>
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {ref, computed, watch, onMounted, onUnmounted} from 'vue'
import {useRouter} from 'vue-router'
import {
  ArrowLeft, ArrowRight, Bell, BellRing, Camera, CalendarCheck,
  CheckCircle2, Clock, Mail, Plus, Send, Smartphone, Sparkles,
  Upload, UserPlus, Users, X, Minus, Maximize2
} from 'lucide-vue-next';
import {Cropper} from 'vue-advanced-cropper'
import 'vue-advanced-cropper/dist/style.css'
import {
  getSignedInUser, updateUser, getUserPreferences, updateUserPreferencesById, refreshUserData, pocketbase, SERVER_URL,
  getOrganisation
} from '~/services/auth'
import {sendDirectInvite} from '~/services/admin'
import {toast} from 'vue-sonner'
import {App as CapacitorApp} from '@capacitor/app'
import {invoke} from "@tauri-apps/api/core";
import {getCurrentWindow} from "@tauri-apps/api/window";
import {getMatters} from "~/services/matters";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime)

definePageMeta({
  layout: 'blank'
})

const router = useRouter()

// Back button handler
let backButtonListener: any = null

// User data
const user = computed(() => getSignedInUser())
const userName = computed(() => user.value?.name?.split(' ')[0] || 'there')
const userInitials = computed(() => {
  const name = user.value?.name || ''
  const parts = name.split(' ')
  if (parts.length >= 2) {
    return (parts[0][0] || '').toUpperCase() + (parts[1][0] || '').toUpperCase()
  }
  return (parts[0]?.[0] || 'U').toUpperCase()
});

const isOrganizationUser = computed(() => !!user.value?.organisation);
const isOrganizationAdmin = ref(false);

// Step management
const currentStep = ref(0)
const steps = computed(() => {
  const baseSteps = [
    {id: 'welcome', title: 'Welcome', required: false},
    {id: 'photo', title: 'Profile Photo', required: false},
    {id: 'preferences', title: 'Preferences', required: false},
    {id: 'matter', title: 'First Matter', required: false},
  ]

  if (isOrganizationAdmin.value) {
    baseSteps.push({id: 'invite', title: 'Invite Team', required: false})
  }

  baseSteps.push({id: 'complete', title: 'Complete', required: false})

  return baseSteps
})

const finalStep = computed(() => steps.value.length - 1)
const progress = computed(() => ((currentStep.value) / finalStep.value) * 100)

// Photo upload
const fileInput = ref<HTMLInputElement | null>(null)
const selectedImage = ref<string | null>(null)
const cropper = ref<any>(null)
const isUploadingPhoto = ref(false)
const showCropper = ref(false)
const currentAvatarUrl = ref<string>('')

// Watch for user changes and update avatar URL
watch(() => user.value?.avatar, (newAvatar) => {
  if (newAvatar !== undefined) {
    currentAvatarUrl.value = newAvatar
  }
}, {immediate: true})

const triggerFileInput = () => {
  fileInput.value?.click()
}

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (file) {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      selectedImage.value = e.target?.result as string
      showCropper.value = true
    }
    reader.readAsDataURL(file)
  }
}

const cancelCrop = () => {
  selectedImage.value = null
  showCropper.value = false
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

const uploadAvatar = async () => {
  if (!cropper.value) return

  isUploadingPhoto.value = true

  try {
    const {canvas} = cropper.value.getResult()

    if (!canvas) {
      throw new Error('Failed to get cropped image')
    }

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob: Blob | null) => {
        if (blob) resolve(blob)
      }, 'image/jpeg', 0.9)
    })

    const formData = new FormData()
    formData.append('field', blob, 'avatar.jpg')

    const avatarRecord = await pocketbase.collection('Avatars').create(formData)
    const fileUrl = `${SERVER_URL}/api/files/Avatars/${avatarRecord.id}/${avatarRecord.field}`

    // Update user in database
    await updateUser({avatar: fileUrl})

    // Optimistically update local avatar URL immediately
    currentAvatarUrl.value = fileUrl

    // Refresh auth store to sync
    await refreshUserData()

    toast.success('Profile photo updated successfully')
    cancelCrop()
  } catch (error) {
    console.error('Error uploading avatar:', error)
    toast.error('Failed to upload profile photo')
  } finally {
    isUploadingPhoto.value = false
  }
}

const clearAvatar = async () => {
  isUploadingPhoto.value = true

  try {
    await updateUser({avatar: ''})

    // Optimistically clear local avatar URL immediately
    currentAvatarUrl.value = ''

    // Refresh auth store to sync
    await refreshUserData()

    toast.success('Profile photo cleared successfully')
  } catch (error) {
    console.error('Error clearing avatar:', error)
    toast.error('Failed to clear profile photo')
  } finally {
    isUploadingPhoto.value = false
  }
}

// Preferences
const prefId = ref('');
const reminderTime = ref('09:00');
const emailNotifications = ref(true);
const appNotifications = ref(true);
const pushNotifications = ref(true);

const savePreferences = async () => {
  try {
    await updateUserPreferencesById(prefId.value, {
      reminder_time: reminderTime.value,
      use_email_notifications: emailNotifications.value,
      use_app_notifications: appNotifications.value,
      use_push_notifications: pushNotifications.value
    });
  } catch (error) {
    console.error('Failed to save preferences:', error)
  }
}

// Matter creation
const matterCreated = ref(false)

const handleMatterCreated = () => {
  matterCreated.value = true
  setTimeout(() => {
    nextStep()
  }, 500)
}

// Invitations
interface Invite {
  email: string
  name: string
  role: string
}

const inviteList = ref<Invite[]>([
  {email: '', name: '', role: 'member'}
])
const sentInvites = ref<Invite[]>([])
const isSendingInvites = ref(false)
const invitationStatus = ref<{ success: boolean; message: string } | null>(null)

const hasValidInvites = computed(() => {
  return inviteList.value.some(invite => invite.email.trim() !== '')
})

const addInviteField = () => {
  inviteList.value.push({email: '', name: '', role: 'member'})
}

const removeInvite = (index: number) => {
  inviteList.value.splice(index, 1)
}

const sendInvitations = async () => {
  const validInvites = inviteList.value.filter(invite => invite.email.trim() !== '')

  if (validInvites.length === 0) return

  isSendingInvites.value = true
  invitationStatus.value = null

  try {
    const orgId = user.value?.organisation

    if (!orgId) {
      throw new Error('No organization found')
    }

    const promises = validInvites.map(invite =>
        sendDirectInvite(invite.email, orgId, invite.role, invite.name || undefined)
    )

    await Promise.all(promises)

    sentInvites.value.push(...validInvites)
    inviteList.value = [{email: '', name: '', role: 'member'}]

    invitationStatus.value = {
      success: true,
      message: `Successfully sent ${validInvites.length} invitation${validInvites.length > 1 ? 's' : ''}`
    }

    toast.success(`Sent ${validInvites.length} invitation${validInvites.length > 1 ? 's' : ''}`)
  } catch (error) {
    console.error('Failed to send invitations:', error)
    invitationStatus.value = {
      success: false,
      message: 'Failed to send invitations. Please try again.'
    }
    toast.error('Failed to send invitations')
  } finally {
    isSendingInvites.value = false
  }
}

// Navigation
const canProceed = computed(() => {
  if (currentStep.value === 0) return true
  if (currentStep.value === 1) return true // Photo is optional
  if (currentStep.value === 2) return true // Preferences can be default
  if (currentStep.value === 3) return true // Matter creation is optional
  if (currentStep.value === 4) return true // Invites are optional
  return true
})

const nextStep = async () => {
  // Save preferences when leaving preferences step
  if (currentStep.value === 2) {
    await savePreferences()
  }

  // Skip invite step if not organization user
  if (currentStep.value === 3 && !isOrganizationUser.value) {
    currentStep.value = finalStep.value
    return
  }

  if (currentStep.value < finalStep.value) {
    currentStep.value++
  }
}

const previousStep = () => {
  if (currentStep.value > 0) {
    // Skip invite step when going back if not organization user
    if (currentStep.value === finalStep.value && !isOrganizationUser.value) {
      currentStep.value = 3
      return
    }
    currentStep.value--
    return true // Indicate that we handled the navigation
  }
  return false // Indicate that we're at the first step
}

const skipStep = () => {
  nextStep()
}

const finishOnboarding = async () => {
}

// Handle Android back button
const handleBackButton = () => {
  // If we're at the first step, allow default behavior (exit app)
  if (currentStep.value === 0) {
    return
  }

  // If we're at the final step, go to previous step
  if (currentStep.value === finalStep.value) {
    previousStep()
    return
  }

  // For all other steps, go to previous step
  previousStep()
}

// Load existing preferences and setup back button listener
onMounted(async () => {
  try {
    await refreshUserData();
    console.log("User Data refreshed!");
    const prefs = await getUserPreferences();

    if (prefs) {
      prefId.value = prefs.id;
      reminderTime.value = prefs.reminder_time || '09:00'
      emailNotifications.value = prefs.use_email_notifications ?? true
      appNotifications.value = prefs.use_app_notifications ?? true
      pushNotifications.value = prefs.use_push_notifications ?? false
    }


    console.log(user?.value);
    if (user?.value?.organisation) {
      const organisation = await getOrganisation(user?.value?.organisation);
      console.log(organisation);
      if (organisation) {
        isOrganizationAdmin.value = organisation?.admins?.includes(user?.value?.id);
      }
    }


    reloadMatters();

  } catch (error) {
    console.error('Failed to load preferences:', error)
  }

  // Setup Capacitor back button listener for Android
  try {
    backButtonListener = await CapacitorApp.addListener('backButton', ({canGoBack}) => {
      // If we're at the first step of onboarding, allow default behavior
      if (currentStep.value === 0) {
        // Show exit confirmation
        if (confirm('Are you sure you want to exit onboarding?')) {
          CapacitorApp.exitApp()
        }
      } else {
        // Navigate to previous onboarding step
        handleBackButton()
      }
    })
  } catch (error) {
    // Capacitor might not be available in web/dev mode
    console.log('Capacitor back button not available:', error)
  }
})

// Cleanup back button listener
onUnmounted(() => {
  if (backButtonListener) {
    backButtonListener.remove()
  }
});

const isTauri = computed(() => {
  return '__TAURI_INTERNALS__' in window;
});


const minimizeWindow = () => {
  const currentWindow = getCurrentWindow();
  currentWindow?.minimize();
}

const toggleMaximizeWindow = () => {
  const currentWindow = getCurrentWindow();
  currentWindow?.toggleMaximize();
}

const isMainWindow = computed(() => {
  const currentWindow = getCurrentWindow();

  return currentWindow?.label === 'main';
});

const closeWindow = () => {
  const currentWindow = getCurrentWindow();
  currentWindow?.close();
}

const matters = ref([]);

const reloadMatters = async () => {
  try {
    matters.value = await getMatters(1, 10, {});

  } catch (e) {
    toast.error("Failed to load matters!");
    console.log(e);
  }
}


</script>

<style scoped>
@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-in {
  animation: fade-in 0.5s ease-out;
}
</style>
