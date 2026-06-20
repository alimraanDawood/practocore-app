<template>
  <div class="flex flex-col w-full h-full overflow-hidden items-center">
    <div class="flex flex-col h-full lg:w-[90vw] w-full">

      <!-- Header -->
      <div class="flex flex-row items-center gap-3 p-4 border-b">
        <Button variant="ghost" size="icon-sm" @click="$router.back()">
          <ArrowLeft class="size-5" />
        </Button>
        <div class="flex flex-col">
          <h1 class="text-2xl font-semibold ibm-plex-serif">Import Cases</h1>
          <p class="text-sm text-muted-foreground">
            Pull ECCMIS cases and hearing dates into PractoCore.
          </p>
        </div>
      </div>

      <!-- Tabs -->
      <Tabs v-model="activeTab" class="flex flex-col flex-1 overflow-hidden">
        <TabsList class="mx-4 mt-4 w-fit">
          <TabsTrigger value="server">Sync from ECCMIS</TabsTrigger>
          <TabsTrigger value="upload">Upload export</TabsTrigger>
        </TabsList>

        <!-- ── Server sync tab ─────────────────────────────────────────── -->
        <TabsContent value="server" class="flex-1 overflow-y-auto p-4">
          <!-- Not connected -->
          <template v-if="!eccmisConnected">
            <div class="rounded-lg border bg-muted/40 p-6 flex flex-col items-center gap-3 text-center max-w-md">
              <Globe class="size-8 text-muted-foreground" />
              <div class="flex flex-col gap-1">
                <span class="font-medium">No ECCMIS account connected</span>
                <span class="text-sm text-muted-foreground">
                  Connect your ECCMIS account in Settings to automatically fetch your cases.
                </span>
              </div>
              <Button size="sm" @click="navigateTo('/main/settings')">
                Connect in Settings
              </Button>
            </div>
          </template>

          <!-- Idle / ready to fetch -->
          <template v-else-if="serverStep === 'idle'">
            <div class="flex flex-col gap-4 max-w-lg">
              <div class="rounded-md border bg-muted/40 p-4 text-sm flex flex-col gap-1">
                <div class="flex items-center gap-2 font-medium">
                  <Globe class="size-4 shrink-0" />
                  Connected as <span class="font-mono">{{ eccmisStatus?.eccmisUser }}</span>
                </div>
                <span class="text-muted-foreground text-xs">
                  Fetching will log into ECCMIS and retrieve your current case list.
                  Nothing is saved until you confirm the selection.
                </span>
              </div>
              <Button class="w-fit" @click="doFetchPreview">
                <RefreshCw class="size-4" />
                Fetch cases from ECCMIS
              </Button>
            </div>
          </template>

          <!-- Loading -->
          <template v-else-if="serverStep === 'loading'">
            <div class="flex flex-col items-center gap-3 py-12 text-center">
              <RefreshCw class="size-8 text-muted-foreground animate-spin" />
              <span class="text-sm text-muted-foreground">
                Connecting to ECCMIS and fetching your cases…
              </span>
            </div>
          </template>

          <!-- Preview / selection -->
          <template v-else-if="serverStep === 'preview' && serverPreview">
            <div class="flex flex-col gap-4">
              <!-- Summary chips -->
              <div class="flex flex-wrap gap-2">
                <Badge class="bg-emerald-600 text-white hover:bg-emerald-600">
                  {{ serverPreview.summary.toCreate }} to create
                </Badge>
                <Badge variant="secondary">{{ serverPreview.summary.toUpdate }} to update</Badge>
                <Badge variant="outline">{{ serverPreview.summary.deadlines }} hearings</Badge>
                <Badge v-if="serverPreview.summary.errors > 0" variant="destructive">
                  {{ serverPreview.summary.errors }} error{{ serverPreview.summary.errors === 1 ? '' : 's' }}
                </Badge>
              </div>

              <!-- Select all -->
              <div class="flex items-center gap-2 text-sm">
                <Checkbox
                  :model-value="allSelected"
                  @update:model-value="toggleSelectAll"
                />
                <span>
                  Select all
                  <span class="text-muted-foreground">({{ selectedCaseNumbers.size }} of {{ selectableItems.length }} selected)</span>
                </span>
              </div>

              <!-- Case list -->
              <div class="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead class="w-10"></TableHead>
                      <TableHead>Case</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead class="text-right">Hearings</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow
                      v-for="(item, i) in serverPreview.items"
                      :key="i"
                      :class="item.action === 'error' ? 'opacity-50' : 'cursor-pointer'"
                      @click="item.action !== 'error' && item.eccmisCaseNumber && toggleCase(item.eccmisCaseNumber)"
                    >
                      <TableCell>
                        <Checkbox
                          v-if="item.action !== 'error' && item.eccmisCaseNumber"
                          :model-value="selectedCaseNumbers.has(item.eccmisCaseNumber)"
                          @update:model-value="toggleCase(item.eccmisCaseNumber!)"
                          @click.stop
                        />
                      </TableCell>
                      <TableCell>
                        <div class="font-medium text-sm">{{ item.eccmisCaseNumber || '(draft)' }}</div>
                        <div v-if="item.matter" class="text-xs text-muted-foreground">
                          {{ matterMeta(item.matter) }}
                        </div>
                        <div v-if="item.action === 'error'" class="text-xs text-destructive mt-0.5">
                          {{ item.errorMessage || 'Could not map case.' }}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          :variant="item.action === 'error' ? 'destructive' : item.action === 'update' ? 'secondary' : 'default'"
                          :class="item.action === 'create' ? 'bg-emerald-600 text-white hover:bg-emerald-600' : ''"
                        >
                          {{ item.action }}
                        </Badge>
                      </TableCell>
                      <TableCell class="text-right tabular-nums text-sm">
                        {{ item.action === 'error' ? '—' : item.deadlines.length }}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <p v-if="serverError" class="text-sm text-destructive">{{ serverError }}</p>

              <!-- Footer actions -->
              <div class="flex flex-row gap-2 items-center">
                <Button variant="outline" @click="serverStep = 'idle'">
                  <ArrowLeft class="size-4" /> Back
                </Button>
                <Button
                  :disabled="selectedCaseNumbers.size === 0 || importing"
                  @click="doImportSelected"
                >
                  <LoaderCircle v-if="importing" class="size-4 animate-spin" />
                  Import {{ selectedCaseNumbers.size > 0 ? selectedCaseNumbers.size : '' }}
                  {{ selectedCaseNumbers.size === 1 ? 'case' : 'cases' }}
                </Button>
              </div>
            </div>
          </template>

          <!-- Success -->
          <template v-else-if="serverStep === 'success' && importResult">
            <div class="flex flex-col items-center gap-4 py-12 text-center max-w-sm mx-auto">
              <CheckCircle2 class="size-12 text-emerald-600" />
              <div class="flex flex-col gap-1">
                <span class="font-semibold text-lg">Import complete</span>
                <span class="text-sm text-muted-foreground">
                  {{ importResult.mattersCreated }} matter{{ importResult.mattersCreated === 1 ? '' : 's' }} created,
                  {{ importResult.mattersUpdated }} updated,
                  {{ importResult.deadlinesCreated }} hearing{{ importResult.deadlinesCreated === 1 ? '' : 's' }} added.
                </span>
                <div v-if="importResult.errors?.length" class="text-xs text-destructive mt-1">
                  {{ importResult.errors.length }} error{{ importResult.errors.length === 1 ? '' : 's' }} encountered.
                </div>
              </div>
              <div class="flex gap-2">
                <Button variant="outline" @click="resetServerFlow">Import more</Button>
                <Button @click="navigateTo('/main/matters')">Go to Matters</Button>
              </div>
            </div>
          </template>

          <p v-if="serverStep === 'idle' && serverError" class="text-sm text-destructive mt-2">
            {{ serverError }}
          </p>
        </TabsContent>

        <!-- ── Upload export tab ───────────────────────────────────────── -->
        <TabsContent value="upload" class="flex-1 overflow-y-auto p-4">
          <div class="flex flex-col gap-4 max-w-2xl">

            <!-- Step: input -->
            <template v-if="uploadStep === 'input'">
              <div class="rounded-md border bg-muted/40 p-3 text-sm">
                <div class="flex items-center gap-2 font-medium text-foreground">
                  <Info class="size-4 shrink-0" />
                  How to export from ECCMIS
                </div>
                <ol class="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
                  <li>Log in to ECCMIS at <span class="font-mono text-xs">eccmis.judiciary.go.ug</span>.</li>
                  <li>Open your case portfolio / case list.</li>
                  <li>Export or download your cases (with their hearing dates).</li>
                  <li>Upload the file below, or paste its contents.</li>
                </ol>
              </div>

              <div>
                <input
                  ref="fileInput"
                  type="file"
                  accept=".json,application/json,.txt,text/plain"
                  class="hidden"
                  @change="onFileChange"
                />
                <Button variant="outline" class="w-full" @click="fileInput?.click()">
                  <FileUp class="size-4" />
                  {{ fileName ? `Selected: ${fileName}` : 'Choose ECCMIS export file' }}
                </Button>
              </div>

              <div class="flex items-center gap-2 text-xs text-muted-foreground">
                <Separator class="flex-1" /> or paste the export text <Separator class="flex-1" />
              </div>

              <Textarea
                v-model="uploadContent"
                rows="6"
                placeholder='Paste your ECCMIS export here, e.g. {"cases":[ ... ]}'
                class="font-mono text-xs"
                @input="fileName = ''"
              />

              <p v-if="uploadError" class="text-sm text-destructive">{{ uploadError }}</p>

              <Button class="w-fit" :disabled="!uploadContent.trim() || uploadBusy" @click="runUploadPreview">
                <LoaderCircle v-if="uploadBusy" class="size-4 animate-spin" />
                Preview import
              </Button>
            </template>

            <!-- Step: preview -->
            <template v-else-if="uploadStep === 'preview' && uploadPreview">
              <div class="flex flex-wrap gap-2">
                <Badge class="bg-emerald-600 text-white hover:bg-emerald-600">
                  {{ uploadPreview.summary.toCreate }} to create
                </Badge>
                <Badge variant="secondary">{{ uploadPreview.summary.toUpdate }} to update</Badge>
                <Badge variant="outline">{{ uploadPreview.summary.deadlines }} hearing deadlines</Badge>
                <Badge v-if="uploadPreview.summary.errors > 0" variant="destructive">
                  {{ uploadPreview.summary.errors }} error{{ uploadPreview.summary.errors === 1 ? '' : 's' }}
                </Badge>
              </div>

              <div class="rounded-md border overflow-hidden max-h-[50vh] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Action</TableHead>
                      <TableHead>Case</TableHead>
                      <TableHead class="text-right">Hearings</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow v-for="(item, i) in uploadPreview.items" :key="i">
                      <TableCell>
                        <Badge
                          :variant="item.action === 'error' ? 'destructive' : item.action === 'update' ? 'secondary' : 'default'"
                          :class="item.action === 'create' ? 'bg-emerald-600 text-white hover:bg-emerald-600' : ''"
                        >
                          {{ item.action }}
                        </Badge>
                      </TableCell>
                      <TableCell class="font-medium">
                        {{ item.eccmisCaseNumber || '—' }}
                        <div v-if="item.matter" class="text-xs font-normal text-muted-foreground">
                          {{ uploadMatterDetail(item.matter) }}
                        </div>
                      </TableCell>
                      <TableCell class="text-right tabular-nums">
                        {{ item.action === 'error' ? '—' : item.deadlines.length }}
                      </TableCell>
                      <TableCell class="text-xs">
                        <span v-if="item.action === 'error'" class="text-destructive">
                          {{ item.errorMessage || 'Could not be mapped.' }}
                        </span>
                        <a
                          v-else-if="item.action === 'update' && item.matchedMatterId"
                          :href="`/main/matters/matter/${item.matchedMatterId}`"
                          class="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          Existing matter <ExternalLink class="size-3" />
                        </a>
                        <span v-else class="text-muted-foreground">New matter</span>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <p v-if="uploadNothingToImport" class="text-sm text-muted-foreground">
                Nothing to import — every case either errored or has no changes.
              </p>
              <p v-if="uploadError" class="text-sm text-destructive">{{ uploadError }}</p>

              <div class="flex gap-2">
                <Button variant="outline" :disabled="uploadBusy" @click="uploadStep = 'input'">
                  <ArrowLeft class="size-4" /> Back
                </Button>
                <Button :disabled="uploadNothingToImport || uploadBusy" @click="runUploadCommit">
                  <LoaderCircle v-if="uploadBusy" class="size-4 animate-spin" />
                  Confirm import
                </Button>
              </div>
            </template>

            <!-- Step: success -->
            <template v-else-if="uploadStep === 'success' && uploadResult">
              <div class="flex flex-col items-center gap-4 py-12 text-center max-w-sm mx-auto">
                <component
                  :is="uploadResult.alreadyImported ? Info : CheckCircle2"
                  :class="uploadResult.alreadyImported ? 'text-muted-foreground' : 'text-emerald-600'"
                  class="size-12"
                />
                <div v-if="uploadResult.alreadyImported" class="flex flex-col gap-1">
                  <span class="font-semibold">Already imported</span>
                  <span class="text-sm text-muted-foreground">
                    This export was imported before — nothing was duplicated.
                  </span>
                </div>
                <div v-else class="flex flex-col gap-1">
                  <span class="font-semibold text-lg">Import complete</span>
                  <span class="text-sm text-muted-foreground">
                    {{ uploadResult.mattersCreated }} created ·
                    {{ uploadResult.mattersUpdated }} updated ·
                    {{ uploadResult.deadlinesCreated }} hearing{{ uploadResult.deadlinesCreated === 1 ? '' : 's' }} added
                  </span>
                </div>
                <div class="flex gap-2">
                  <Button variant="outline" @click="resetUploadFlow">Import another</Button>
                  <Button @click="navigateTo('/main/matters')">Go to Matters</Button>
                </div>
              </div>
            </template>

          </div>
        </TabsContent>
      </Tabs>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  ArrowLeft, Globe, RefreshCw, CheckCircle2, LoaderCircle,
  Info, FileUp, ExternalLink,
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import {
  getEccmisStatus,
  fetchEccmisPreview,
  importEccmisSelected,
  previewEccmisImport,
  commitEccmisImport,
  type EccmisStatus,
  type ServerImportPreview,
  type ServerImportItem,
  type ServerMappedMatter,
  type ImportSelectedResult,
  type ImportPreview,
  type CommitResult,
  type MappedMatter,
} from '~/services/eccmis'

definePageMeta({ layout: 'default' })

// ── Connection state ──────────────────────────────────────────────────────────

const eccmisStatus = ref<EccmisStatus | null>(null)
const eccmisConnected = computed(() => !!eccmisStatus.value?.connected)

onMounted(async () => {
  try {
    eccmisStatus.value = await getEccmisStatus()
  } catch {
    // If status fetch fails, show not connected.
  }
})

// ── Active tab ────────────────────────────────────────────────────────────────

const activeTab = ref('server')

// ── Server sync flow ──────────────────────────────────────────────────────────

type ServerStep = 'idle' | 'loading' | 'preview' | 'success'

const serverStep = ref<ServerStep>('idle')
const serverPreview = ref<ServerImportPreview | null>(null)
const serverError = ref('')
const importing = ref(false)
const importResult = ref<ImportSelectedResult | null>(null)
const selectedCaseNumbers = ref<Set<string>>(new Set())

const selectableItems = computed<ServerImportItem[]>(() =>
  (serverPreview.value?.items ?? []).filter(i => i.action !== 'error' && i.eccmisCaseNumber != null),
)

const allSelected = computed(() =>
  selectableItems.value.length > 0 &&
  selectableItems.value.every(i => selectedCaseNumbers.value.has(i.eccmisCaseNumber!)),
)

function toggleCase(caseNumber: string) {
  const next = new Set(selectedCaseNumbers.value)
  if (next.has(caseNumber)) {
    next.delete(caseNumber)
  } else {
    next.add(caseNumber)
  }
  selectedCaseNumbers.value = next
}

function toggleSelectAll(checked: boolean | 'indeterminate') {
  if (checked) {
    selectedCaseNumbers.value = new Set(
      selectableItems.value.map(i => i.eccmisCaseNumber!),
    )
  } else {
    selectedCaseNumbers.value = new Set()
  }
}

function matterMeta(m: ServerMappedMatter): string {
  const parts: string[] = []
  if (m.filingDate) parts.push(`Filed ${new Date(m.filingDate).toLocaleDateString()}`)
  if (m.assignedJudge) parts.push(m.assignedJudge)
  return parts.join(' · ')
}

async function doFetchPreview() {
  serverError.value = ''
  serverStep.value = 'loading'
  selectedCaseNumbers.value = new Set()
  try {
    serverPreview.value = await fetchEccmisPreview()
    // Auto-select all create/update items.
    selectedCaseNumbers.value = new Set(
      (serverPreview.value.items ?? [])
        .filter(i => i.action !== 'error' && i.eccmisCaseNumber != null)
        .map(i => i.eccmisCaseNumber!),
    )
    serverStep.value = 'preview'
  } catch (e: any) {
    serverError.value = e?.message || 'Could not fetch cases from ECCMIS.'
    serverStep.value = 'idle'
  }
}

async function doImportSelected() {
  if (selectedCaseNumbers.value.size === 0) return
  importing.value = true
  serverError.value = ''
  try {
    importResult.value = await importEccmisSelected([...selectedCaseNumbers.value])
    serverStep.value = 'success'
    eccmisStatus.value = await getEccmisStatus()
  } catch (e: any) {
    serverError.value = e?.message || 'Import failed.'
    toast.error(serverError.value)
  } finally {
    importing.value = false
  }
}

function resetServerFlow() {
  serverStep.value = 'idle'
  serverPreview.value = null
  serverError.value = ''
  importResult.value = null
  selectedCaseNumbers.value = new Set()
}

// ── Upload flow ───────────────────────────────────────────────────────────────

type UploadStep = 'input' | 'preview' | 'success'

const uploadStep = ref<UploadStep>('input')
const uploadContent = ref('')
const fileName = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const uploadPreview = ref<ImportPreview | null>(null)
const uploadResult = ref<CommitResult | null>(null)
const uploadError = ref('')
const uploadBusy = ref(false)

const uploadNothingToImport = computed(() =>
  !uploadPreview.value ||
  uploadPreview.value.summary.toCreate + uploadPreview.value.summary.toUpdate === 0,
)

async function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    uploadContent.value = await file.text()
    fileName.value = file.name
    uploadError.value = ''
  } catch {
    toast.error('Could not read that file.')
  }
}

function uploadMatterDetail(m: MappedMatter): string {
  const parts: string[] = []
  const cat = m.categoryLabel ?? (m.categoryId != null ? `Category #${m.categoryId}` : null)
  if (cat) parts.push(cat)
  if (m.filingDate) parts.push(`Filed ${new Date(m.filingDate).toLocaleDateString()}`)
  if (m.assignedJudge) parts.push(m.assignedJudge)
  return parts.join(' · ')
}

async function runUploadPreview() {
  if (!uploadContent.value.trim()) return
  uploadBusy.value = true
  uploadError.value = ''
  try {
    uploadPreview.value = await previewEccmisImport(uploadContent.value)
    uploadStep.value = 'preview'
  } catch (e: any) {
    uploadError.value = e?.message || 'Could not preview the import.'
  } finally {
    uploadBusy.value = false
  }
}

async function runUploadCommit() {
  if (uploadNothingToImport.value) return
  uploadBusy.value = true
  uploadError.value = ''
  try {
    uploadResult.value = await commitEccmisImport(uploadContent.value)
    uploadStep.value = 'success'
  } catch (e: any) {
    uploadError.value = e?.message || 'Import failed.'
    toast.error(uploadError.value)
  } finally {
    uploadBusy.value = false
  }
}

function resetUploadFlow() {
  uploadStep.value = 'input'
  uploadContent.value = ''
  fileName.value = ''
  uploadPreview.value = null
  uploadResult.value = null
  uploadError.value = ''
}
</script>
