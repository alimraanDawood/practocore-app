<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { toast } from 'vue-sonner';
import { getAllTemplates } from '~/services/templates';
import {
  generateMigrationReport,
  bulkMigrateTemplates,
  downloadMigrationReport,
  type MigrationOptions,
} from '~/utils/template-migration';
import type { DeadlineTemplateRecord } from '~/lib/types/template';
import { COUNTRIES, PRACTICE_AREAS } from '~/lib/constants/template-categories';
import { Download, Play, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-vue-next';

// State
const loading = ref(false);
const migrating = ref(false);
const templates = ref<DeadlineTemplateRecord[]>([]);
const migrationReport = ref<any>(null);
const migrationResults = ref<any>(null);

// Migration options
const options = ref<MigrationOptions>({
  defaultCountry: 'US',
  defaultPracticeArea: 'other',
  defaultLanguage: 'en',
  autoCalculateComplexity: true,
  convertTags: true,
  dryRun: false,
});

// Computed
const needsMigrationCount = computed(() => {
  return migrationReport.value?.needsMigration.length || 0;
});

const alreadyMigratedCount = computed(() => {
  return migrationReport.value?.alreadyMigrated.length || 0;
});

const canMigrate = computed(() => {
  return needsMigrationCount.value > 0 && !migrating.value;
});

// Load templates and generate report
async function loadTemplates() {
  loading.value = true;
  try {
    templates.value = await getAllTemplates();

    // Generate migration report
    migrationReport.value = generateMigrationReport(templates.value, options.value);

    toast.success('Templates loaded successfully');
  } catch (error) {
    console.error('Failed to load templates:', error);
    toast.error('Failed to load templates');
  } finally {
    loading.value = false;
  }
}

// Refresh report with new options
function refreshReport() {
  if (templates.value.length > 0) {
    migrationReport.value = generateMigrationReport(templates.value, options.value);
  }
}

// Download CSV report
function downloadReport() {
  if (migrationReport.value) {
    downloadMigrationReport(migrationReport.value);
    toast.success('Report downloaded');
  }
}

// Run migration
async function runMigration() {
  if (!confirm(`Are you sure you want to migrate ${needsMigrationCount.value} templates?`)) {
    return;
  }

  migrating.value = true;
  try {
    const result = await bulkMigrateTemplates(
      migrationReport.value.needsMigration,
      options.value
    );

    migrationResults.value = result;

    if (result.failed === 0) {
      toast.success(`Successfully migrated ${result.succeeded} templates`);
    } else {
      toast.warning(`Migrated ${result.succeeded} templates, ${result.failed} failed`);
    }

    // Reload templates
    await loadTemplates();
  } catch (error) {
    console.error('Migration failed:', error);
    toast.error('Migration failed');
  } finally {
    migrating.value = false;
  }
}

// Initialize
onMounted(() => {
  loadTemplates();
});
</script>

<template>
  <Card class="w-full">
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <FileText class="h-5 w-5" />
        Template Migration Tool
      </CardTitle>
      <CardDescription>
        Migrate existing templates to Phase 1A categorization schema
      </CardDescription>
    </CardHeader>

    <CardContent class="space-y-6">
      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center py-8">
        <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
      </div>

      <!-- Migration Status -->
      <div v-else-if="migrationReport" class="space-y-4">
        <!-- Stats -->
        <div class="grid grid-cols-2 gap-4">
          <Card>
            <CardContent class="pt-6">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm text-muted-foreground">Needs Migration</p>
                  <p class="text-3xl font-bold">{{ needsMigrationCount }}</p>
                </div>
                <AlertCircle class="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent class="pt-6">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm text-muted-foreground">Already Migrated</p>
                  <p class="text-3xl font-bold">{{ alreadyMigratedCount }}</p>
                </div>
                <CheckCircle2 class="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator />

        <!-- Migration Options -->
        <div class="space-y-4">
          <h3 class="text-sm font-semibold">Migration Options</h3>

          <div class="grid grid-cols-2 gap-4">
            <!-- Default Country -->
            <div class="space-y-2">
              <Label>Default Country</Label>
              <Select v-model="options.defaultCountry" @update:model-value="refreshReport">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="country in COUNTRIES" :key="country.value" :value="country.value">
                    {{ country.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <!-- Default Practice Area -->
            <div class="space-y-2">
              <Label>Default Practice Area</Label>
              <Select v-model="options.defaultPracticeArea" @update:model-value="refreshReport">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="area in PRACTICE_AREAS" :key="area.value" :value="area.value">
                    {{ area.icon }} {{ area.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <!-- Checkboxes -->
          <div class="space-y-2">
            <div class="flex items-center space-x-2">
              <Checkbox
                id="autoComplexity"
                v-model:checked="options.autoCalculateComplexity"
                @update:checked="refreshReport"
              />
              <Label for="autoComplexity" class="text-sm font-normal cursor-pointer">
                Auto-calculate complexity from template structure
              </Label>
            </div>

            <div class="flex items-center space-x-2">
              <Checkbox
                id="convertTags"
                v-model:checked="options.convertTags"
                @update:checked="refreshReport"
              />
              <Label for="convertTags" class="text-sm font-normal cursor-pointer">
                Convert tags from comma-separated to JSON array
              </Label>
            </div>
          </div>
        </div>

        <Separator />

        <!-- Preview -->
        <div v-if="migrationReport.preview.length > 0" class="space-y-2">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold">Migration Preview</h3>
            <p class="text-xs text-muted-foreground">Showing first 5 templates</p>
          </div>

          <div class="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Template Name</TableHead>
                  <TableHead>Current</TableHead>
                  <TableHead>Will Become</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="item in migrationReport.preview.slice(0, 5)" :key="item.id">
                  <TableCell class="font-medium">{{ item.name }}</TableCell>
                  <TableCell class="text-xs text-muted-foreground">
                    <div v-if="item.current.country || item.current.practiceArea">
                      {{ item.current.country || '-' }} • {{ item.current.practiceArea || '-' }}
                    </div>
                    <div v-else class="text-orange-500">Not categorized</div>
                  </TableCell>
                  <TableCell class="text-xs">
                    <div>{{ item.suggested.country }} • {{ item.suggested.practiceArea }}</div>
                    <div v-if="item.suggested.complexity" class="text-muted-foreground">
                      Complexity: {{ item.suggested.complexity }}
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>

        <!-- Migration Results -->
        <div v-if="migrationResults" class="space-y-2">
          <h3 class="text-sm font-semibold">Migration Results</h3>

          <Alert :variant="migrationResults.failed > 0 ? 'destructive' : 'default'">
            <CheckCircle2 v-if="migrationResults.failed === 0" class="h-4 w-4" />
            <AlertCircle v-else class="h-4 w-4" />
            <AlertTitle>
              {{ migrationResults.failed === 0 ? 'Success!' : 'Completed with Errors' }}
            </AlertTitle>
            <AlertDescription>
              {{ migrationResults.succeeded }} templates migrated successfully.
              <span v-if="migrationResults.failed > 0">
                {{ migrationResults.failed }} templates failed to migrate.
              </span>
            </AlertDescription>
          </Alert>

          <!-- Show failed templates -->
          <div v-if="migrationResults.failed > 0" class="border rounded-lg p-3 space-y-2">
            <p class="text-sm font-medium">Failed Templates:</p>
            <div class="space-y-1">
              <div
                v-for="result in migrationResults.results.filter(r => !r.success)"
                :key="result.id"
                class="text-xs text-muted-foreground"
              >
                {{ result.name }}: {{ result.error }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </CardContent>

    <CardFooter class="flex gap-2 justify-end border-t pt-4">
      <Button variant="outline" @click="downloadReport" :disabled="!migrationReport">
        <Download class="h-4 w-4 mr-2" />
        Download Report
      </Button>

      <Button @click="runMigration" :disabled="!canMigrate || migrating">
        <Play v-if="!migrating" class="h-4 w-4 mr-2" />
        <Loader2 v-else class="h-4 w-4 mr-2 animate-spin" />
        {{ migrating ? 'Migrating...' : `Migrate ${needsMigrationCount} Templates` }}
      </Button>
    </CardFooter>
  </Card>
</template>
