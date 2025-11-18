<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { X, Send, Loader2, Paperclip, Mic } from 'lucide-vue-next'
import {
  getChatMessages,
  sendChatMessage,
  subscribeToChatMessages,
  unsubscribeFromChatMessages,
  markAllMessagesAsRead,
  type ChatMessage
} from '~/services/chat'
import { pb } from '~/lib/pocketbase'

const pocketbase = pb;

const props = defineProps<{
  matterId: string
  showClose?: boolean
  members: any[]
}>()

const emit = defineEmits<{
  close: []
}>()

// State
const messages = ref<ChatMessage[]>([])
const newMessage = ref('')
const loading = ref(false)
const sending = ref(false)
const messagesContainer = ref<HTMLElement | null>(null)
const currentUser = computed(() => pocketbase.authStore.model)

// Load initial messages
async function loadMessages() {
  loading.value = true
  try {
    const result = await getChatMessages(props.matterId, 1, 100)
    messages.value = result.items
    await nextTick()
    scrollToBottom()
  } catch (error) {
    console.error('Failed to load messages:', error)
  } finally {
    loading.value = false
  }
}

// Send a message
async function handleSendMessage() {
  if (!newMessage.value.trim() || sending.value || !currentUser.value) return

  sending.value = true
  try {
    await sendChatMessage({
      matter: props.matterId,
      sender: currentUser.value.id,
      message: newMessage.value.trim(),
      type: 'text'
    })

    newMessage.value = ''
    await nextTick()
    scrollToBottom()
  } catch (error) {
    console.error('Failed to send message:', error)
  } finally {
    sending.value = false
  }
}

// Scroll to bottom of messages
function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

// Format timestamp
function formatTime(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString()
}

// Check if message is from current user
function isMyMessage(message: ChatMessage): boolean {
  return message.sender === currentUser.value?.id
}

// Get sender name
function getSenderName(message: ChatMessage): string {
  if (isMyMessage(message)) return 'You'

  return props.members.find(m => m.id === message.sender)?.name || 'Unknown'
}

// Mark messages as read when they arrive
async function markAsRead() {
  if (!currentUser.value) return
  try {
    await markAllMessagesAsRead(props.matterId, currentUser.value.id)
  } catch (error) {
    console.error('Failed to mark messages as read:', error)
  }
}

// Setup real-time subscription
let unsubscribe: (() => void) | null = null

onMounted(async () => {
  await loadMessages()

  // Mark initial messages as read immediately
  if (currentUser.value) {
    await markAsRead()
  }

  // Subscribe to new messages
  try {
    unsubscribe = await subscribeToChatMessages(props.matterId, (data) => {
      if (data.action === 'create') {
        messages.value.push(data.record)
        nextTick(() => {
          scrollToBottom()
          // Mark new message as read immediately since chat is open (event-based, not polling)
          markAsRead()
        })
      } else if (data.action === 'update') {
        const index = messages.value.findIndex((m) => m.id === data.record.id)
        if (index !== -1) {
          messages.value[index] = data.record
        }
      } else if (data.action === 'delete') {
        const index = messages.value.findIndex((m) => m.id === data.record.id)
        if (index !== -1) {
          messages.value.splice(index, 1)
        }
      }
    })
  } catch (error) {
    console.error('Failed to subscribe to messages:', error)
  }
})

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe()
  }
  unsubscribeFromChatMessages(props.matterId)
})

// Watch for matter ID changes
watch(
  () => props.matterId,
  async (newId, oldId) => {
    if (newId !== oldId) {
      if (unsubscribe) {
        unsubscribe()
      }
      unsubscribeFromChatMessages(oldId)
      await loadMessages()

      // Mark new messages as read immediately
      if (currentUser.value) {
        await markAsRead()
      }

      // Resubscribe
      try {
        unsubscribe = await subscribeToChatMessages(newId, (data) => {
          if (data.action === 'create') {
            messages.value.push(data.record)
            nextTick(() => {
              scrollToBottom()
              // Mark as read when message arrives (event-based)
              markAsRead()
            })
          } else if (data.action === 'update') {
            const index = messages.value.findIndex((m) => m.id === data.record.id)
            if (index !== -1) {
              messages.value[index] = data.record
            }
          } else if (data.action === 'delete') {
            const index = messages.value.findIndex((m) => m.id === data.record.id)
            if (index !== -1) {
              messages.value.splice(index, 1)
            }
          }
        })
      } catch (error) {
        console.error('Failed to subscribe to messages:', error)
      }
    }
  }
)
</script>

<template>
  <div class="flex flex-col h-full bg-muted/30 xs:pb-12 lg:pb-0 text-foreground">
    <!-- Header -->
    <div class="flex items-center justify-between p-4 border-b bg-background">
      <h3 class="font-semibold">Chat</h3>
      <button
        v-if="false"
        @click="emit('close')"
        class="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
      >
        <X class="h-5 w-5 text-gray-500" />
      </button>
    </div>

    <!-- Messages -->
    <div ref="messagesContainer" class="flex flex-col h-full overflow-y-scroll p-4 space-y-4">
      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center h-full">
        <Loader2 class="h-6 w-6 animate-spin " />
      </div>

      <!-- No messages -->
      <div
        v-else-if="messages.length === 0"
        class="flex items-center justify-center h-full "
      >
        No messages yet. Start the conversation!
      </div>

      <!-- Message list -->
      <div v-else v-for="message in messages" :key="message.id" class="flex flex-col">
        <div v-if="message?.type === 'text'" class="flex flex-col">
          <!-- Sender name (for other users' messages) -->
          <div
              v-if="!isMyMessage(message)"
              class="text-xs font-semibold mb-1"
          >
            {{ getSenderName(message) }}
          </div>

          <div
            :class="[
              'max-w-[80%] rounded-lg p-2',
              isMyMessage(message)
                ? 'ml-auto bg-muted text-muted-foreground border'
                : 'mr-auto bg-background border text-foreground'
            ]"
          >

            <!-- Message text -->
            <div class="whitespace-pre-wrap break-words">{{ message.message }}</div>
          </div>

          <!-- Timestamp -->
          <div
            :class="[
              'text-xs mt-1',
              isMyMessage(message) ? 'text-right' : ''
            ]"
          >
            {{ formatTime(message.created) }}
          </div>
        </div>

        <div v-else-if="message?.type === 'event'" class="flex flex-row gap-1 items-center">
          <div class="h-[2px] bg-border min-w-5 w-full"></div>
          <div class="ibm-plex-serif text-muted-foreground shrink-0 w-full max-w-[75%] text-center text-xs">
            {{ message?.message }}
          </div>
          <div class="h-[2px] bg-border min-w-5 w-full"></div>
        </div>
      </div>
    </div>

    <!-- Input -->
    <div class="p-4 border-t bg-background">
      <form @submit.prevent="handleSendMessage" class="flex flex-col gap-2">
        <Textarea
          v-model="newMessage"
          type="text"
          placeholder="Type a message..."
          :disabled="sending"
        />
        <div class="flex flex-row w-full justify-between items-center">
          <div class="flex flex-row">
            <Button variant="secondary" size="icon">
              <Paperclip />
            </Button>
          </div>

          <div class="flex flex-row items-center gap-1">
            <Button size="icon" variant="outline">
              <Mic />
            </Button>

            <Button
              type="submit"
              size="icon"
              :disabled="!newMessage.trim() || sending"
            >
              <Loader2 v-if="sending" class="h-4 w-4 animate-spin" />
              <Send v-else class="h-4 w-4" />
            </Button>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>
