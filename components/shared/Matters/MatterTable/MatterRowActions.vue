<script setup lang="ts">
import { ref } from 'vue'
import { MoreHorizontal, Eye, Trash2, Copy } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import type { MattersRecord } from '~/lib/pocketbase-types'
import { deleteMatter } from '~/services/matters'
import { useMattersStore } from '~/stores/matters'
import { useDashboardStore } from '~/stores/dashboard'

const props = defineProps<{
  matter: MattersRecord
}>()

const router = useRouter()
const mattersStore = useMattersStore()
const dashboardStore = useDashboardStore()

const deleteDialogOpen = ref(false)
const isDeleting = ref(false)

function viewMatter() {
  router.push(`/main/matters/matter/${props.matter.id}`)
}

function copyMatterId() {
  navigator.clipboard.writeText(props.matter.id)
  toast.success('Matter ID copied to clipboard')
}

function copyCaseNumber() {
  if (props.matter.caseNumber) {
    navigator.clipboard.writeText(props.matter.caseNumber)
    toast.success('Case number copied to clipboard')
  }
}

async function handleDelete() {
  isDeleting.value = true
  try {
    await deleteMatter(props.matter.id)
  } catch (error) {
    console.log(error);
  } finally {
    isDeleting.value = false
    toast.success('Matter deleted successfully')
    deleteDialogOpen.value = false

    // Refresh matters list and dashboard statistics
    await Promise.all([
      mattersStore.fetchMatters(true),
      dashboardStore.fetchStatistics(true)
    ])
  }

}
</script>

<template>
  <AlertDialog v-model:open="deleteDialogOpen">
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button variant="ghost" class="h-8 w-8 p-0">
          <span class="sr-only">Open menu</span>
          <MoreHorizontal class="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem @click="viewMatter">
          <Eye class="mr-2 h-4 w-4" />
          View matter
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem @click="copyMatterId">
          <Copy class="mr-2 h-4 w-4" />
          Copy matter ID
        </DropdownMenuItem>
        <DropdownMenuItem v-if="matter.caseNumber" @click="copyCaseNumber">
          <Copy class="mr-2 h-4 w-4" />
          Copy case number
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <AlertDialogTrigger as-child>
          <DropdownMenuItem class="text-destructive">
            <Trash2 class="mr-2 h-4 w-4" />
            Delete matter
          </DropdownMenuItem>
        </AlertDialogTrigger>
      </DropdownMenuContent>
    </DropdownMenu>

    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
        <AlertDialogDescription>
          This action cannot be undone. This will permanently delete
          <span class="font-semibold">{{ matter.name }}</span>
          and all its deadlines.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="isDeleting">Cancel</AlertDialogCancel>
        <Button
          variant="destructive"
          :disabled="isDeleting"
          @click="handleDelete"
        >
          <template v-if="isDeleting">Deleting...</template>
          <template v-else>Delete</template>
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
