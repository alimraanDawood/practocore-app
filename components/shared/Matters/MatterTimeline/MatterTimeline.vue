<template>
  <!-- Loaded state -->
  <div v-if="matter !== null" class="flex flex-col gap-4">

    <!-- Unassigned deadlines alert (supervisors only) -->
    <div
      v-if="isSupervisor && unassignedDeadlines.length > 0"
      class="flex flex-row items-start gap-2.5 rounded-lg border border-accent-warning/30 bg-accent-warning/5 p-3"
    >
      <UserX class="size-4 text-accent-warning shrink-0 mt-0.5"/>
      <div class="flex flex-col gap-0.5 min-w-0 flex-1">
        <span class="text-sm font-semibold ibm-plex-serif leading-snug">
          {{ unassignedDeadlines.length }} deadline{{ unassignedDeadlines.length !== 1 ? 's' : '' }}
          need{{ unassignedDeadlines.length === 1 ? 's' : '' }} an assignee
        </span>
        <span class="text-xs text-muted-foreground">
          Only assigned team members receive reminders. Assign someone so
          {{ unassignedDeadlines.length === 1 ? "it isn't" : "they aren't" }} missed.
        </span>
      </div>
      <Button size="sm" variant="outline" class="shrink-0" @click="reviewUnassigned">
        Review
      </Button>
    </div>

    <!-- Filter bar -->
    <div class="flex flex-row gap-1 items-center">
      <button
        v-for="tab in filterTabs"
        :key="tab.value"
        @click="activeFilter = tab.value"
        class="flex flex-row items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-150"
        :class="activeFilter === tab.value
          ? 'bg-foreground text-background'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted'"
      >
        {{ tab.label }}
        <span
          class="text-xs rounded-md px-1 py-0.5 tabular-nums font-semibold leading-none"
          :class="activeFilter === tab.value ? 'bg-background/20 text-background' : 'bg-muted text-muted-foreground'"
        >{{ tab.count }}</span>
      </button>

      <!-- Add a deadline the firm tracks itself, alongside the court's own dates. -->
      <div v-if="canAddDeadline" class="ml-auto">
        <Button
            size="sm"
            variant="outline"
            class="ml-auto shrink-0 hidden lg:flex"
            @click="openAddDeadline"
        >
          <CalendarPlus class="size-3.5"/>
          Add deadline
        </Button>

        <Button
            size="icon-sm"
            variant="outline"
            class="ml-auto shrink-0 lg:hidden"
            @click="openAddDeadline"
        >
          <CalendarPlus class="size-3.5"/>
        </Button>
      </div>
    </div>

    <!-- Hidden hearings. Hiding a court row is a real removal — the sync is
         told to stop re-sending it — which is precisely why it has to be
         visible and undoable from here. Without this strip a hearing the firm
         hid is indistinguishable from a sync that stopped working. -->
    <div
      v-if="hiddenHearings.length > 0"
      class="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2"
    >
      <button
        class="flex flex-row items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        @click="showHidden = !showHidden"
      >
        <EyeOff class="size-3.5 shrink-0"/>
        <span class="font-medium">
          {{ hiddenHearings.length }}
          {{ hiddenHearings.length === 1 ? 'hidden hearing' : 'hidden hearings' }}
        </span>
        <span class="underline underline-offset-2">{{ showHidden ? 'Hide' : 'Show' }}</span>
      </button>

      <div v-if="showHidden" class="flex flex-col gap-1.5">
        <div
          v-for="hidden in hiddenHearings"
          :key="hidden.id"
          class="flex flex-row items-center gap-2 flex-wrap text-xs"
        >
          <Landmark class="size-3.5 shrink-0 text-muted-foreground"/>
          <span class="font-medium">{{ hidden.name || 'Hearing' }}</span>
          <span v-if="hidden.date" class="text-muted-foreground tabular-nums">
            {{ dayjs(hidden.date).format('D MMM YYYY') }}
          </span>
          <Button
            size="sm"
            variant="ghost"
            class="ml-auto h-7"
            :disabled="hiddenBusy === hidden.id"
            @click="restoreHearing(hidden)"
          >
            <Eye class="size-3"/>
            Restore
          </Button>
        </div>
        <p class="text-[10px] text-muted-foreground">
          The court sync will not add these back while they are hidden.
        </p>
      </div>
    </div>

    <AdhocDeadlineDialog
      v-if="canAddDeadline"
      v-model:open="adhocDialogOpen"
      :matter-id="matter.id"
      :deadline="adhocEditing"
      @saved="emits('updated')"
    />

    <!-- One destructive confirm for the timeline: hiding a court hearing, and
         deleting a firm's own deadline. Both were window.confirm, which is
         titled with the origin, traps no focus and cannot be styled. Drawer
         under tablet and AlertDialog above, matching EccmisLink's unlink. -->
    <Drawer v-if="$viewport.isLessThan('tablet')" v-model:open="confirmOpen" :close-threshold="0.95">
      <DrawerContent>
        <DrawerHeader class="text-left">
          <DrawerTitle>{{ confirmAction?.title }}</DrawerTitle>
          <DrawerDescription>{{ confirmAction?.description }}</DrawerDescription>
        </DrawerHeader>
        <DrawerFooter>
          <Button
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            :disabled="confirmBusy"
            @click="runConfirmed"
          >
            {{ confirmAction?.actionLabel }}
          </Button>
          <Button variant="outline" :disabled="confirmBusy" @click="confirmOpen = false">Cancel</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>

    <AlertDialog v-else v-model:open="confirmOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ confirmAction?.title }}</AlertDialogTitle>
          <AlertDialogDescription>{{ confirmAction?.description }}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="confirmBusy">Cancel</AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            :disabled="confirmBusy"
            @click="runConfirmed"
          >
            {{ confirmAction?.actionLabel }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <!-- Timeline. One right-click menu for the whole list: the row under the
         pointer sets the aim in the target phase, the list clears it here in the
         capture phase, so empty space gets the timeline's own menu. -->
    <ContextMenu>
    <ContextMenuTrigger as-child :disabled="coarsePointer">
    <div class="flex flex-col" @contextmenu.capture="ctxRow = null">

      <!-- Trigger date node -->
      <div class="flex flex-row">
        <div class="flex flex-col items-center w-9 shrink-0">
          <div class="size-7 bg-primary/15 rounded-full grid place-items-center border-2 border-primary shrink-0">
            <CalendarIcon class="size-3 text-primary"/>
          </div>
          <div class="w-0.5 flex-1 min-h-5 bg-border mt-0.5"></div>
        </div>
        <div class="flex flex-col py-1 pb-3 pl-2 gap-0.5">
          <span class="text-sm font-semibold ibm-plex-serif leading-snug">{{ matter?.triggerDateName || 'Trigger Date' }}</span>
          <div class="flex flex-row items-center gap-2">
            <span class="text-xs text-muted-foreground">
              {{ dayjs(matter.triggerDate).format('D MMM YYYY') }}
            </span>
            <!-- Every date on this timeline is computed from this one, so it has to
                 be correctable. Provisional matters are excluded: their banner owns
                 the date through "Confirm trigger date", which also switches
                 reminders on. Supervisor-gated to match the server rule. -->
            <SharedMattersChangeTriggerDate
              v-if="canChangeTriggerDate"
              :matter="matter"
              @updated="emits('updated')"
            >
              <span class="text-xs text-primary hover:underline">Change</span>
            </SharedMattersChangeTriggerDate>
          </div>
        </div>
      </div>

      <!-- Empty state: all caught up -->
      <div
        v-if="activeFilter === 'active' && filteredDeadlines.length === 0 && doneCount > 0"
        class="flex flex-col items-start pl-2 py-4 gap-2"
      >
        <div class="flex flex-row items-center gap-2">
          <div class="size-7 rounded-full bg-primary/10 grid place-items-center shrink-0">
            <CheckCheck class="size-3.5 text-primary"/>
          </div>
          <div class="flex flex-col pl-2">
            <span class="text-sm font-medium">All caught up</span>
            <span class="text-xs text-muted-foreground">
              {{ doneCount }} deadline{{ doneCount !== 1 ? 's' : '' }} completed
              <button @click="activeFilter = 'done'" class="text-primary hover:underline ml-1">View</button>
            </span>
          </div>
        </div>
      </div>

      <!-- Deadline items -->
      <div
        v-for="(deadline, index) in filteredDeadlines"
        :key="deadline.id"
        class="flex flex-row"
        @contextmenu="ctxRow = deadline"
      >
        <!-- Left: connecting lines + status node -->
        <div class="flex flex-col items-center w-9 shrink-0">
          <div
            class="w-0.5 h-5 shrink-0"
            :class="lineClass(deadline)"
          ></div>
          <div
            class="size-7 shrink-0 rounded-full grid place-items-center transition-colors duration-200"
            :class="nodeClass(deadline)"
          >
            <component :is="nodeIconComponent(deadline)" class="size-3.5"/>
          </div>
          <div
            class="w-0.5 flex-1 min-h-4"
            :class="index === filteredDeadlines.length - 1 ? 'opacity-0' : lineClass(deadline)"
          ></div>
        </div>

        <!-- Right: compact row + expandable detail -->
        <div class="flex flex-col flex-1 min-w-0 pl-2">

          <!-- Clickable compact row -->
          <button
            class="flex flex-row items-center gap-2 py-1.5 w-full text-left rounded-lg hover:bg-muted/50 transition-colors duration-100 group -ml-1 pl-1 pr-1"
            @click="toggleExpand(deadline.id)"
          >
            <div class="flex flex-col flex-1 min-w-0">
              <!-- Application context -->
              <div v-if="deadline.application" class="flex flex-row items-center gap-1 mb-0.5">
                <span class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">App</span>
                <span class="text-[10px] text-muted-foreground">·</span>
                <span class="text-[10px] text-muted-foreground truncate">
                  {{ matter?.expand?.applications?.find(a => a.id === deadline.application)?.type }}
                </span>
              </div>

              <!-- L6: the other side's step. Shown because a litigator has to plan
                   against it, marked because it is not this firm's work — no
                   countdown, no urgency colour, no reminder. -->
              <div v-if="isOtherSide(deadline)" class="flex flex-row items-center gap-1 mb-0.5">
                <Users class="size-2.5 text-muted-foreground shrink-0"/>
                <span class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {{ otherSideRoleLabel(deadline) || 'Other party' }}'s step
                </span>
              </div>

              <!-- L2: a corrected date must never quietly replace the computed
                   one. The rule still applies; this row simply departs from it,
                   and anyone reading the file has to be able to see that at a
                   glance rather than by expanding the row. -->
              <div v-if="overrideOf(deadline)" class="flex flex-row items-center gap-1 mb-0.5">
                <PencilLine class="size-2.5 text-muted-foreground shrink-0"/>
                <span class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Corrected — computed {{ dayjs(overrideOf(deadline).from).format('D MMM YYYY') }}
                </span>
              </div>

              <!-- Firm-added marker: never let a firm's own note read as a court date -->
              <div v-if="isAdhoc(deadline)" class="flex flex-row items-center gap-1 mb-0.5">
                <CalendarPlus class="size-2.5 text-muted-foreground shrink-0"/>
                <span class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Added by your firm
                </span>
              </div>

              <span
                class="text-sm font-medium leading-snug truncate"
                :class="deadline.status === 'fulfilled' ? 'text-muted-foreground' : 'text-foreground'"
              >{{ displayName(deadline) }}</span>

              <!-- The rule's own wording, kept visible whenever a firm name sits
                   over it. This is what the authority, the registry and the court
                   will call the same obligation. -->
              <span
                v-if="isRenamed(deadline)"
                class="text-[10px] text-muted-foreground truncate mt-0.5"
              >{{ deadline.name }}</span>

              <div v-if="deadline.party_context" class="flex flex-row items-center gap-1 mt-0.5">
                <User class="size-2.5 text-muted-foreground shrink-0"/>
                <span class="text-[10px] text-muted-foreground truncate">{{ deadline.party_context.party_name }}</span>
              </div>

              <!-- Unassigned highlight (supervisors only) -->
              <div v-if="isSupervisor && isUnassigned(deadline)" class="flex flex-row items-center gap-1 mt-0.5">
                <UserX class="size-2.5 text-accent-warning shrink-0"/>
                <span class="text-[10px] font-medium text-accent-warning">Unassigned</span>
              </div>
            </div>

            <!-- Date / urgency -->
            <div class="flex flex-col items-end gap-0.5 shrink-0">
              <span class="text-xs font-semibold tabular-nums" :class="urgencyTextClass(deadline)">
                {{ deadlineDateDisplay(deadline) }}
              </span>
              <span v-if="deadline.date" class="text-[10px] text-muted-foreground">{{ dayjs(deadline.date).format('D MMM') }}</span>
            </div>

            <ChevronDown
              class="size-3.5 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground transition-all duration-150"
              :class="isExpanded(deadline.id) ? 'rotate-180' : ''"
            />
          </button>

          <!-- Expanded detail -->
          <div v-if="isExpanded(deadline.id)" class="flex flex-col gap-3 pb-5 pt-1 pr-1">

            <!-- Firm-added (ad-hoc) deadline. Handled before the court branches
                 because it is not an engine node: it has no prompts to render and
                 must never be routed through fulfill/adjourn, which target the
                 matter's event log. -->
            <template v-if="isAdhoc(deadline)">
              <p v-if="deadline.description" class="text-sm text-muted-foreground">
                {{ deadline.description }}
              </p>
              <p v-else class="text-sm italic text-muted-foreground ibm-plex-serif">
                A deadline your firm is tracking on this matter.
              </p>

              <div class="flex flex-row gap-2 flex-wrap">
                <Button
                  v-if="deadline.status !== 'fulfilled'"
                  size="sm"
                  :disabled="adhocBusy === deadline.id"
                  @click="completeAdhoc(deadline)"
                >
                  <CheckCheck class="size-3"/>
                  Mark done
                </Button>
                <Button
                  v-else
                  size="sm"
                  variant="outline"
                  :disabled="adhocBusy === deadline.id"
                  @click="completeAdhoc(deadline, true)"
                >
                  Reopen
                </Button>

                <Button size="sm" variant="outline" @click="openEditDeadline(deadline)">
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  class="text-destructive hover:text-destructive"
                  :disabled="adhocBusy === deadline.id"
                  @click="removeAdhoc(deadline)"
                >
                  Delete
                </Button>
              </div>
            </template>

            <!-- Fulfilled deadline -->
            <template v-else-if="deadline.status === 'fulfilled'">
              <p
                v-if="deadline.fulfilled_prompt"
                class="text-sm italic text-muted-foreground ibm-plex-serif"
                v-html="deadline.fulfilled_prompt.replace('<<date>>', `<b class='text-foreground'>${dayjs(deadline.date).format('D MMM YYYY')}</b>`)"
              ></p>
              <div class="flex flex-row gap-2 flex-wrap">
                <SharedDeadlineCompleteDeadline @updated="emits('updated')" :deadline="deadline">
                  <Button size="sm" variant="outline">
                    <CalendarIcon class="size-3"/>
                    {{ dayjs(deadline.date).format('D MMM YYYY') }}
                  </Button>
                </SharedDeadlineCompleteDeadline>
              </div>

              <!-- Done, proven — or done, unevidenced. Both are states worth
                   reading off the row. -->
              <SharedDeadlineEvidence :rows="evidenceFor(deadline.id)" />
            </template>

            <!-- Pending deadline (Deadlines collection) -->
            <template v-else-if="deadline.collectionName === 'Deadlines'">
              <!-- L2: on a corrected deadline this sentence describes what the
                   rule COMPUTES, against the date the rule actually produced —
                   never against the firm's corrected date, which the rule did
                   not produce. The operative date is the row's own, badged
                   "Corrected" above. The label is what keeps the two apart. -->
              <div v-if="promptOf(deadline, deadline.pending_prompt).html" class="flex flex-col gap-0.5">
                <span
                  v-if="promptOf(deadline, deadline.pending_prompt).isComputation"
                  class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                >What the rule computes</span>
                <p
                  class="text-sm italic text-muted-foreground ibm-plex-serif"
                  v-html="promptOf(deadline, deadline.pending_prompt).html"
                ></p>
              </div>

              <p v-if="deadline.input_prompt && !deadline.disableFulfill" class="text-sm text-muted-foreground">
                {{ deadline.input_prompt }}
              </p>

              <!-- The date verbs, on rows whose date is ours to move. A court
                   hearing is excluded: the registry set that date and will send
                   it again, so completing, adjourning or correcting it here
                   would be the firm editing the court's diary in their own copy
                   of it. The row-actions menu takes the same branch. -->
              <div v-if="!isCourt(deadline)" class="flex flex-row gap-2 flex-wrap">
                <SharedDeadlineCompleteDeadline
                  v-if="!deadline.disableFulfill"
                  @updated="emits('updated')"
                  :deadline="deadline"
                >
                  <Button size="sm">
                    <CalendarIcon class="size-3"/>
                    Set Date
                  </Button>
                </SharedDeadlineCompleteDeadline>

                <AdjournDeadline @updated="emits('updated')" :deadline="deadline">
                  <Button size="sm" variant="outline">Adjourn</Button>
                </AdjournDeadline>

                <!-- L2: nothing was adjourned — the computed date is simply not
                     the real one. A separate action, because filing a false
                     adjournment to fix a date is what lawyers were doing instead. -->
                <OverrideDeadline @updated="emits('updated')" :deadline="deadline">
                  <Button size="sm" variant="outline">Correct date</Button>
                </OverrideDeadline>
              </div>
            </template>

            <!-- Event record (not a Deadline) -->
            <template v-else>
              <p
                v-if="deadline.fulfilled_prompt"
                class="text-sm italic text-muted-foreground ibm-plex-serif"
                v-html="deadline.fulfilled_prompt.replace('<<date>>', `<b class='text-foreground'>${dayjs(deadline.date).format('D MMM YYYY')}</b>`)"
              ></p>
              <div>
                <SharedEventsCompleteEvent :event="deadline" @updated="emits('updated')">
                  <Button size="sm">
                    <CalendarIcon class="size-3"/>
                    Set Date
                  </Button>
                </SharedEventsCompleteEvent>
              </div>

              <!-- A milestone is evidenced exactly like a deadline: both hang
                   off a sequence number in the same log. -->
              <SharedDeadlineEvidence
                v-if="deadline.status === 'fulfilled'"
                :rows="evidenceFor(deadline.id)" />
            </template>

            <!-- Adjournment history -->
            <div
              v-if="deadline.expand?.adjournments?.length > 0"
              class="flex flex-col gap-2 border-t border-border/60 pt-2"
            >
              <div
                v-for="adj in [...(deadline.expand.adjournments)].sort((a, b) => new Date(a.from) - new Date(b.from))"
                :key="adj.id"
                class="flex flex-col gap-0.5"
              >
                <div class="flex flex-row items-center gap-1.5 text-xs font-medium text-foreground">
                  <CalendarSync class="size-3 text-muted-foreground shrink-0"/>
                  <!-- Rows written before L2 carry no kind; they were all
                       adjournments, which is what the migration backfilled. -->
                  <span class="text-muted-foreground">{{ adj.kind === 'override' ? 'Corrected' : 'Adjourned' }}</span>
                  <span>{{ dayjs(adj.from).format('D MMM YYYY') }}</span>
                  <ArrowRight class="size-3 text-muted-foreground shrink-0"/>
                  <span>{{ dayjs(adj.to).format('D MMM YYYY') }}</span>
                </div>
                <p v-if="adj.reason" class="text-xs text-muted-foreground pl-4">{{ adj.reason }}</p>
              </div>
            </div>

            <!-- L7: rename. Offered on EVERY Deadlines row regardless of origin,
                 because it writes `label` and never `name` — no date moves, no
                 dependant recomputes, and the rule's wording stays on the record.
                 This is the one customisation a statutory row can safely take. -->
            <div
              v-if="canAddDeadline && deadline.collectionName === 'Deadlines'"
              class="flex flex-col gap-1.5 border-t border-border/60 pt-2"
            >
              <template v-if="renamingId === deadline.id">
                <Input
                  v-model="renameDraft"
                  :maxlength="200"
                  placeholder="What you want to call this"
                  class="h-8 text-sm"
                  @keyup.enter="saveRename(deadline)"
                  @keyup.esc="cancelRename()"
                />
                <p class="text-[10px] text-muted-foreground">
                  Only changes what you see here. The rule still reads
                  &ldquo;{{ deadline.name }}&rdquo;, and the date is unaffected.
                </p>
                <div class="flex flex-row gap-2">
                  <Button size="sm" :disabled="renameBusy" @click="saveRename(deadline)">Save</Button>
                  <Button size="sm" variant="ghost" :disabled="renameBusy" @click="cancelRename()">Cancel</Button>
                </div>
              </template>
              <div v-else class="flex flex-row gap-2 flex-wrap">
                <Button size="sm" variant="outline" @click="startRename(deadline)">
                  <PencilLine class="size-3"/>
                  {{ isRenamed(deadline) ? 'Change name' : 'Rename' }}
                </Button>
                <Button
                  v-if="isRenamed(deadline)"
                  size="sm"
                  variant="ghost"
                  :disabled="renameBusy"
                  @click="clearRename(deadline)"
                >
                  Use original name
                </Button>
              </div>
            </div>

            <!-- The firm's own remark on the row. Safe on every origin for the
                 same reason the label is: nothing computes with it. On a court
                 hearing it is often the only thing the firm can add — "registry
                 confirmed by phone", "counsel away that week". -->
            <div
              v-if="canAddDeadline && deadline.collectionName === 'Deadlines'"
              class="flex flex-col gap-1.5 border-t border-border/60 pt-2"
            >
              <template v-if="notingId === deadline.id">
                <Textarea
                  v-model="noteDraft"
                  :maxlength="5000"
                  rows="3"
                  placeholder="Your note on this deadline"
                  class="text-sm"
                />
                <div class="flex flex-row gap-2">
                  <Button size="sm" :disabled="noteBusy" @click="saveNote(deadline)">Save</Button>
                  <Button size="sm" variant="ghost" :disabled="noteBusy" @click="cancelNote()">Cancel</Button>
                </div>
              </template>
              <template v-else>
                <p v-if="hasNote(deadline)" class="text-xs text-muted-foreground whitespace-pre-line">
                  {{ deadline.note }}
                </p>
                <div class="flex flex-row gap-2 flex-wrap">
                  <Button size="sm" variant="outline" @click="startNote(deadline)">
                    <PencilLine class="size-3"/>
                    {{ hasNote(deadline) ? 'Edit note' : 'Add note' }}
                  </Button>
                  <Button
                    v-if="isCourt(deadline)"
                    size="sm"
                    variant="ghost"
                    class="text-destructive"
                    :disabled="hiddenBusy === deadline.id"
                    @click="askHideHearing(deadline)"
                  >
                    <EyeOff class="size-3"/>
                    Hide hearing
                  </Button>
                </div>
                <p v-if="isCourt(deadline)" class="text-[10px] text-muted-foreground">
                  This hearing came from the court registry. Its date is the
                  court&rsquo;s — you can rename it, note it, or hide it, but it
                  can only be moved by the court.
                </p>
              </template>
            </div>

            <!-- Assignees -->
            <SharedDeadlineAssignees
              v-if="matterMembers.length > 0 && deadline.collectionName === 'Deadlines'"
              :deadline-id="deadline.id"
              :current-assignees="deadline.assignees || []"
              :matter-members="matterMembers"
              :is-supervisor="isSupervisor"
              @updated="handleAssigneesUpdated"
            />
          </div>
        </div>
      </div>

    </div>
    </ContextMenuTrigger>
    <ContextMenuContent class="w-64">
      <SharedActionMenuItems
        :actions="ctxRow ? rowActions(ctxRow) : surfaceActions"
        variant="context" />
    </ContextMenuContent>
    </ContextMenu>

  </div>


  <!-- The date dialogs, opened from the menu rather than from their own button
       inside an expanded row. Mounted only while open and keyed by row, because
       each seeds a form from the deadline it was opened on. The empty span is
       the trigger slot they expect; nothing renders it. -->
  <SharedDeadlineCompleteDeadline
    v-if="completeFor"
    :key="`complete-${completeFor.id}`"
    :deadline="completeFor"
    :open="true"
    @update:open="(v) => { if (!v) completeFor = null; }"
    @updated="emits('updated')"
  >
    <span class="hidden" />
  </SharedDeadlineCompleteDeadline>

  <AdjournDeadline
    v-if="adjournFor"
    :key="`adjourn-${adjournFor.id}`"
    :deadline="adjournFor"
    :open="true"
    @update:open="(v) => { if (!v) adjournFor = null; }"
    @updated="emits('updated')"
  >
    <span class="hidden" />
  </AdjournDeadline>

  <OverrideDeadline
    v-if="overrideFor"
    :key="`override-${overrideFor.id}`"
    :deadline="overrideFor"
    :open="true"
    @update:open="(v) => { if (!v) overrideFor = null; }"
    @updated="emits('updated')"
  >
    <span class="hidden" />
  </OverrideDeadline>

  <SharedEventsCompleteEvent
    v-if="eventDateFor"
    :key="`event-${eventDateFor.id}`"
    :event="eventDateFor"
    :open="true"
    @update:open="(v) => { if (!v) eventDateFor = null; }"
    @updated="emits('updated')"
  >
    <span class="hidden" />
  </SharedEventsCompleteEvent>

  <!-- Loading skeleton. Tested on `matter` rather than written as the loaded
       state's `v-else`: the date dialogs above are siblings, so an `v-else` binds
       to whichever one happens to be last and the skeleton renders UNDER a
       timeline that has already loaded. -->
  <div v-if="matter === null" class="flex flex-col gap-4 animate-pulse">
    <div class="flex flex-row gap-1">
      <div v-for="i in 3" :key="i" class="h-8 w-20 bg-muted rounded-lg"></div>
    </div>
    <div class="flex flex-col">
      <div v-for="i in 5" :key="i" class="flex flex-row gap-0">
        <div class="flex flex-col items-center w-9 shrink-0">
          <div class="w-0.5 h-5 bg-muted"></div>
          <div class="size-7 bg-muted rounded-full shrink-0"></div>
          <div class="w-0.5 h-10 bg-muted"></div>
        </div>
        <div class="flex flex-col gap-1.5 flex-1 pl-2 py-2">
          <div class="h-4 bg-muted rounded w-3/5"></div>
          <div class="h-3 bg-muted rounded w-1/4"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import {
  CalendarIcon,
  CalendarPlus,
  CalendarClock,
  CalendarCheck,
  ArrowRight,
  CalendarSync,
  User,
  Asterisk,
  AlertTriangle,
  Clock,
  ChevronDown,
  CheckCheck,
  UserX,
  Users,
  PencilLine,
  ChevronRight,
  Pencil,
  Trash2,
  RotateCcw,
  ListFilter,
  EyeOff,
  Eye,
  Landmark,
} from "lucide-vue-next";
import { useMediaQuery } from "@vueuse/core";
import AdjournDeadline from "../../Deadline/AdjournDeadline/AdjournDeadline.vue";
import OverrideDeadline from "../../Deadline/OverrideDeadline/OverrideDeadline.vue";
import AdhocDeadlineDialog from "../../Deadline/AdhocDeadline/AdhocDeadlineDialog.vue";
import { pb } from "~/lib/pocketbase";
import {
  resetDeadline, completeAdhocDeadline, deleteAdhocDeadline, renameDeadline,
  listDeadlineEvidence, annotateDeadline, hideCourtDeadline, listHiddenHearings,
  restoreHiddenHearing,
} from "~/services/matters";
import {
  deadlineUrgency,
  isAdhoc as isAdhocDeadline,
  isCourt as isCourtDeadline,
  isOtherSide as isOtherSideDeadline,
  isProjected as isProjectedDeadline,
} from "~/services/deadlines/urgency";
import { toast } from "vue-sonner";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

const props = defineProps(["matter", "applicationFilter"]);
const emits = defineEmits(["updated"]);

// ── Filter state ─────────────────────────────────────────────────────────────
const activeFilter = ref("active");

// ── Expand/collapse state ─────────────────────────────────────────────────────
const expandedSet = ref(new Set());

const toggleExpand = (id) => {
  const next = new Set(expandedSet.value);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  expandedSet.value = next;
};

const isExpanded = (id) => expandedSet.value.has(id);

// ── Timeline order (L8) ───────────────────────────────────────────────────────
//
// Three keys, in this order:
//
//   1. Dated rows before undated ones. A date is a commitment; no date is an
//      unknown, and an unknown is not "very old". The previous sort mapped a
//      missing date to 1970-01-01, so every undated row floated above a hearing
//      that was due today — the top of the timeline showed the rows needing the
//      least attention.
//   2. Date ascending. Once a date exists it is the operative fact and the
//      lawyer works to a calendar, so it outranks the procedural order.
//   3. `seq` — the engine's resolution order over the procedure's DAG. This is
//      what orders the undated tail (two sequential appeal steps must not be
//      free to swap places just because neither has a date yet) and what breaks
//      same-day ties that otherwise fell back to array order.
//
// Rows the engine did not generate carry seq 0: an ECCMIS sitting and an ad-hoc
// row have no place in a blueprint. They sort last within their group, by
// creation, rather than being given an invented position.
const procIndex = (d) => Number(d?.seq) || Number.POSITIVE_INFINITY;

const byTimelineOrder = (a, b) => {
  const aDated = a?.date ? 1 : 0;
  const bDated = b?.date ? 1 : 0;
  if (aDated !== bDated) return bDated - aDated;

  if (aDated === 1) {
    const byDate = new Date(a.date) - new Date(b.date);
    if (byDate !== 0) return byDate;
  }

  const aSeq = procIndex(a);
  const bSeq = procIndex(b);
  // Written as a comparison rather than a subtraction so two positionless rows
  // (both Infinity) fall through to creation order instead of yielding NaN.
  if (aSeq !== bSeq) return aSeq < bSeq ? -1 : 1;

  return String(a?.created || "").localeCompare(String(b?.created || ""));
};

const allDeadlines = computed(() => {
  if (props.applicationFilter === "all" || !props.applicationFilter) {
    return [
      ...(props?.matter?.expand?.deadlines || []),
      ...(props?.matter?.expand?.events?.filter((e) => e.status === "fulfilled") || []),
      ...(props?.matter?.expand?.applications?.flatMap((app) => app?.expand?.deadlines || []) || []),
    ]
      .filter((d) => d.status !== "unavailable")
      .sort(byTimelineOrder);
  }
  // The single-application view was never sorted at all — it rendered in
  // whatever order the expand came back in. Same ordering applies.
  return (
    props?.matter?.expand?.applications
      ?.find((ap) => ap.id === props.applicationFilter)
      ?.expand?.deadlines?.filter((d) => d.status !== "unavailable")
      ?.slice()
      ?.sort(byTimelineOrder) ?? []
  );
});

// ── Filtered view ─────────────────────────────────────────────────────────────
const filteredDeadlines = computed(() => {
  if (activeFilter.value === "active") return allDeadlines.value.filter((d) => d.status !== "fulfilled");
  if (activeFilter.value === "done") return allDeadlines.value.filter((d) => d.status === "fulfilled");
  return allDeadlines.value;
});

const activeCount = computed(() => allDeadlines.value.filter((d) => d.status !== "fulfilled").length);
const doneCount = computed(() => allDeadlines.value.filter((d) => d.status === "fulfilled").length);

const filterTabs = computed(() => [
  { value: "active", label: "Active", count: activeCount.value },
  { value: "all", label: "All", count: allDeadlines.value.length },
  { value: "done", label: "Done", count: doneCount.value },
]);

// ── P2: proof recorded against a completed step ───────────────────────────────
// Read separately from the matter expand rather than joined onto it: evidence
// hangs off a sequence number in the engine's event log, not off the mutable
// deadline row, so it is not the matter's to carry. The row id is only the
// handle the UI hangs it on.
// This block is plain JS (no lang="ts"), so no type annotations here.
const evidenceByRow = ref({});

const evidenceFor = (rowId) => evidenceByRow.value[rowId] || [];

// Applications are child matters with their own ids, so ask for all of them.
const evidenceMatterIds = computed(() => {
  const ids = [props?.matter?.id, ...(props?.matter?.expand?.applications || []).map((a) => a.id)];
  return [...new Set(ids.filter(Boolean))];
});

const loadEvidence = async () => {
  try {
    evidenceByRow.value = await listDeadlineEvidence(evidenceMatterIds.value);
  } catch (e) {
    // A read failure must not blank the timeline; the row simply shows no chip.
    console.error(e);
  }
};

// Declared AFTER loadEvidence: an immediate watcher runs its callback during
// setup, so a function it calls must already be initialised.
watch(
  () => [
    evidenceMatterIds.value.join(","),
    // Refetch when anything completes or a date moves, which is when proof can
    // have been recorded or superseded.
    allDeadlines.value.map((d) => `${d.id}:${d.status}:${d.date}`).join("|"),
  ].join("~"),
  loadEvidence,
  { immediate: true },
);

// ── Unassigned deadlines (supervisor concern) ─────────────────────────────────
// ── L6: whose obligation is this? ─────────────────────────────────────────────
// The engine generates the WHOLE two-sided timeline, because the other side's
// steps are real dates a litigator has to plan against — a plaintiff needs to know
// when the defence falls due. But they are not the firm's own work, and rendering
// them in the firm's alarm colours would put a red "overdue" on a step nobody in
// the office was ever going to do.
//
// The comparison is done here, at read time, rather than in the engine: the firm
// can change who it acts for, and that must never require rebuilding a schedule.
// A deadline with no role (the mediation and scheduling steps, which bind both
// sides) is always ours.
const representedRoleId = computed(() => {
  const r = props.matter?.representing;
  if (!r) return "";
  return r.role_id ?? r.roleId ?? "";
});

// Until the firm says who it acts for, claim nothing — showing every step as
// the other side's would empty the timeline. That rule, and the rest of the
// urgency derivation below, live in ~/services/deadlines/urgency so the matter
// card, the calendar and the assistant all answer this the same way.
const isOtherSide = (deadline) => isOtherSideDeadline(deadline, representedRoleId.value);

const otherSideRoleLabel = (deadline) => {
  const roles = normalizePartyConfig(props.matter?.partyConfig)?.roles ?? [];
  return roles.find((r) => r.id === deadline?.role)?.name ?? "";
};

// A deadline needs an assignee when it's an actionable (non-fulfilled) Deadline
// record with no one assigned — only assignees receive reminders for it.
// The other side's steps are excluded: nobody in this firm is going to do them,
// so flagging them to a supervisor as "needs an assignee" is a false alarm that
// would grow with every two-sided matter.
const isUnassigned = (deadline) =>
  deadline.collectionName === "Deadlines" &&
  deadline.status !== "fulfilled" &&
  !isOtherSide(deadline) &&
  (deadline.assignees?.length ?? 0) === 0;

const unassignedDeadlines = computed(() => allDeadlines.value.filter(isUnassigned));

// Banner CTA: surface every unassigned deadline so a supervisor can act on them.
const reviewUnassigned = () => {
  activeFilter.value = "active";
  const next = new Set(expandedSet.value);
  for (const d of unassignedDeadlines.value) next.add(d.id);
  expandedSet.value = next;
};

// Default to "all" when all deadlines are completed
watch(
  () => props.matter,
  () => {
    if (props.matter && activeCount.value === 0 && doneCount.value > 0) {
      activeFilter.value = "all";
    }
  },
  { immediate: true }
);

// ── Urgency helpers ───────────────────────────────────────────────────────────
// A deadline is "projected" when its matter's trigger date is still provisional
// (an estimate). Projected deadlines are a planning view: even if their computed
// date is in the past, they must NOT render as overdue/urgent, and no reminders
// exist for them yet. The owning matter is the parent when deadline.application is
// unset, otherwise the child application identified by deadline.application.
// A firm-added deadline (origin 'adhoc') is an ordinary Deadlines row with no
// t_id — see the ad-hoc block below and internal/deadlinev2/adhoc.go. Declared
// here because isProjected/urgencyOf depend on it.
const isAdhoc = (deadline) => isAdhocDeadline(deadline);

// A hearing the court sent (origin 'court'). Not the firm's row and not the
// engine's: the registry owns the date, so the timeline offers the edits that do
// not touch it — rename, note, hide — and none that do.
const isCourt = (deadline) => isCourtDeadline(deadline);

// L7: what the row is CALLED, as opposed to what the rule calls it.
//
// `label` is the firm's own wording ("Lodge John's notice of appeal"); `name` is
// the blueprint node's label, or the registry's own wording for a court sitting.
// The override wins on screen, but `name` is never overwritten and is still shown
// underneath whenever the two differ — a timeline that hides which rule a row came
// from is worse than one that reads awkwardly.
const displayName = (deadline) => (deadline?.label || "").trim() || deadline?.name || "";
const isRenamed = (deadline) => Boolean((deadline?.label || "").trim());

// L2: the most recent correction on a deadline, if any. Returns the row rather
// than a boolean because the computed date it superseded (adj.from) is the part
// that has to stay on screen — a correction that hides the rule is worse than no
// correction at all. Rows written before L2 carry no kind and are adjournments.
//
// Shared with the rule-sentence renderer below: two copies of "is this corrected"
// would let the badge and the sentence disagree about the same row.
const { formatDeadlinePrompt, correctionOf } = useDeadlinePrompt();
const overrideOf = (deadline) => correctionOf(deadline);

// A deadline's prompt cites the rule. On a corrected deadline it is rendered
// against the COMPUTED date, so the citation stays true; `isComputation` tells
// the template to label it as the rule's calculation rather than the real date.
const promptOf = (deadline, prompt) => formatDeadlinePrompt(prompt, deadline?.date, deadline);

// The record whose trigger date governs this deadline: the child application
// when the deadline belongs to one, otherwise the matter itself.
const ownerOf = (deadline) => {
  if (deadline?.application) {
    return props.matter?.expand?.applications?.find((a) => a.id === deadline.application) ?? null;
  }
  return props.matter ?? null;
};

const isProjected = (deadline) => isProjectedDeadline(deadline, ownerOf(deadline));

// The shared derivation, given this timeline's owner and represented role. It
// returns "undated" where this used to return "pending" for a dateless ad-hoc
// task; both fall through to the same muted styling below.
const urgencyOf = (deadline) =>
  deadlineUrgency(deadline, {
    owner: ownerOf(deadline),
    representedRoleId: representedRoleId.value,
  });

const nodeClass = (deadline) => {
  const u = urgencyOf(deadline);
  if (u === "done") return "bg-primary text-primary-foreground";
  if (u === "theirs") return "bg-transparent border-2 border-dotted border-border text-muted-foreground";
  if (u === "projected") return "bg-muted border-2 border-dashed border-border text-muted-foreground";
  if (u === "overdue") return "bg-destructive/10 border-2 border-destructive text-destructive";
  if (u === "urgent") return "bg-accent-warning/10 border-2 border-accent-warning text-accent-warning";
  return "bg-muted border-2 border-border text-muted-foreground";
};

const lineClass = (deadline) => {
  const u = urgencyOf(deadline);
  if (u === "done") return "bg-primary/60";
  if (u === "theirs") return "bg-border/50";
  if (u === "overdue") return "bg-destructive/30";
  return "bg-border";
};

const urgencyTextClass = (deadline) => {
  const u = urgencyOf(deadline);
  if (u === "theirs") return "text-muted-foreground";
  if (u === "projected") return "text-muted-foreground";
  if (u === "overdue") return "text-destructive";
  if (u === "urgent") return "text-accent-warning";
  if (u === "done") return "text-muted-foreground";
  return "text-foreground";
};

const nodeIconComponent = (deadline) => {
  if (deadline.collectionName !== "Deadlines") return Asterisk;
  if (deadline.status === "fulfilled") return CalendarCheck;
  const u = urgencyOf(deadline);
  if (u === "theirs") return CalendarClock;
  if (u === "projected") return CalendarClock;
  if (u === "overdue") return AlertTriangle;
  if (u === "urgent") return Clock;
  return CalendarClock;
};

const deadlineDateDisplay = (deadline) => {
  // Ad-hoc deadlines may legitimately carry no date (a task not yet scheduled).
  // Every other branch here does date arithmetic, so bail out first.
  if (!deadline.date) return "No date";
  if (deadline.status === "fulfilled") return dayjs(deadline.date).format("D MMM YYYY");
  // The other side's step is a plain date, not a countdown. "3 days" reads as an
  // instruction to this firm; it is not one.
  if (isOtherSide(deadline)) return dayjs(deadline.date).format("D MMM YYYY");
  if (isProjected(deadline)) return deadline.date ? `Projected · ${dayjs(deadline.date).format("D MMM YYYY")}` : "Projected";
  const days = dayjs(deadline.date).diff(dayjs(), "day");
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Tomorrow";
  if (days <= 7) return `${days} days`;
  return dayjs(deadline.date).fromNow();
};

// ── Matter members ────────────────────────────────────────────────────────────
const matterMembers = computed(() => {
  if (!props.matter) return [];
  const members = [];
  const seen = new Set();
  if (props.matter.expand?.owner) {
    members.push(props.matter.expand.owner);
    seen.add(props.matter.expand.owner.id);
  }
  (props.matter.expand?.members || []).forEach((m) => {
    if (!seen.has(m.id)) {
      members.push(m);
      seen.add(m.id);
    }
  });
  return members;
});

const isSupervisor = computed(() => {
  const userId = pb.authStore.record?.id;
  if (!userId || !props.matter) return false;
  return props.matter.supervisors?.includes(userId) || false;
});

function handleAssigneesUpdated() {
  emits("updated");
}

// ── Ad-hoc deadlines ──────────────────────────────────────────────────────────
// Rows the firm added itself (origin: 'adhoc'). They are ordinary Deadlines rows
// with no t_id, so they arrive in the same expand.deadlines payload and need no
// separate fetch — but they are NOT engine nodes, so fulfil/adjourn do not apply
// to them and the backend refuses those verbs.

const adhocDialogOpen = ref(false);
const adhocEditing = ref(null);
const adhocBusy = ref(null);

// Anyone working the matter may add to it — matching the API, which allows the
// owner, supervisors, and members (mutating an existing row is narrower: the
// backend requires a supervisor or an assignee on that row).
const canAddDeadline = computed(() => {
  const userId = pb.authStore.record?.id;
  if (!userId || !props.matter) return false;
  return (
    props.matter.owner === userId ||
    props.matter.supervisors?.includes(userId) ||
    props.matter.members?.includes(userId) ||
    false
  );
});

// Changing the trigger date recomputes the entire timeline, so the server limits
// it to supervisors — mirrored here so nobody is offered a control that 403s.
// While the matter is provisional the banner's "Confirm trigger date" owns this
// date instead (it also flips reminders on), so we stay out of its way.
const canChangeTriggerDate = computed(() => {
  const userId = pb.authStore.record?.id;
  if (!userId || !props.matter) return false;
  if (props.matter.triggerStatus === 'provisional') return false;
  return props.matter.supervisors?.includes(userId) ?? false;
});

// ── Right-click menus ───────────────────────────────────────────────────────
// Every action on a row lives behind expanding it, which is three clicks to
// adjourn a date you can already see. The menu is the shortcut: the same actions
// the expanded row offers, aimed at the row under the pointer, with the expanded
// panel still the place that explains them.
//
// ONE menu for the whole timeline, not one per row — a menu per row makes each
// its own dismissable layer, and right-clicking a second row leaves the first
// standing. The list clears the aim in the capture phase, each row sets it in the
// target phase, and reka re-anchors the single menu at the new point.
//
// Touch has no context menu: reka's trigger arms a long-press of its own, and the
// row's own tap-to-expand is the touch route to all of this.
const coarsePointer = useMediaQuery("(pointer: coarse)");
const ctxRow = ref(null);

// A menu and a dialog are separate overlay layers; opening the second while the
// first is still closing makes them race for the body scroll lock (CLAUDE.md).
const defer = (fn) => setTimeout(fn, 0);

// The date dialogs are normally opened by their own trigger button inside the
// expanded row. Held here instead, they are mounted open and unmounted on close,
// so a menu item can reach them with no button to click. Keyed by row id, because
// each carries a form seeded from the deadline it was opened on.
const completeFor = ref(null);
const adjournFor = ref(null);
const overrideFor = ref(null);
const eventDateFor = ref(null);

// The same gate the trigger buttons carry, said out loud instead of greying a row
// with no explanation.
const planActive = usePlanActive();
const { isOffline: netOffline } = useNetwork();
const dateActionsBlocked = computed(() => {
  if (netOffline.value) return "offline";
  if (!planActive.value?.active) return "subscription expired";
  return "";
});

function expandRow(id) {
  if (!expandedSet.value.has(id)) toggleExpand(id);
}

/** What the row under the pointer can do — the expanded row's actions, in a menu. */
function rowActions(deadline) {
  const out = [];
  const expanded = isExpanded(deadline.id);
  const blocked = dateActionsBlocked.value;
  const suffix = blocked ? ` — ${blocked}` : "";

  out.push({
    id: "expand",
    label: expanded ? "Collapse" : "Show details",
    icon: expanded ? ChevronDown : ChevronRight,
    run: () => toggleExpand(deadline.id),
  });

  if (isAdhoc(deadline)) {
    // A firm's own row: not an engine node, so it never routes through
    // fulfill/adjourn — the same branch the expanded row takes.
    out.push(deadline.status === "fulfilled"
      ? {
          id: "reopen", label: "Reopen", icon: RotateCcw, divider: true,
          disabled: adhocBusy.value === deadline.id,
          run: () => completeAdhoc(deadline, true),
        }
      : {
          id: "done", label: "Mark done", icon: CheckCheck, divider: true,
          disabled: adhocBusy.value === deadline.id,
          run: () => completeAdhoc(deadline),
        });
    out.push({ id: "edit", label: "Edit…", icon: Pencil, run: () => defer(() => openEditDeadline(deadline)) });
    out.push({
      id: "remove", label: "Delete", icon: Trash2, danger: true, divider: true,
      disabled: adhocBusy.value === deadline.id,
      run: () => defer(() => askRemoveAdhoc(deadline)),
    });
    return out;
  }

  if (isCourt(deadline)) {
    // The registry owns this date. Adjourning or correcting it here would be the
    // firm overwriting the court's own diary in their copy of it, so the menu
    // offers only what is safe on somebody else's row — and hiding, which is a
    // statement about this matter rather than about the sitting.
    if (canAddDeadline.value) {
      out.push({
        id: "rename", label: isRenamed(deadline) ? "Change name" : "Rename", icon: Pencil, divider: true,
        run: () => { expandRow(deadline.id); startRename(deadline); },
      });
      if (isRenamed(deadline)) {
        out.push({
          id: "unrename", label: "Use the original name", icon: RotateCcw,
          disabled: renameBusy.value, run: () => clearRename(deadline),
        });
      }
      out.push({
        id: "note", label: hasNote(deadline) ? "Edit note…" : "Add note…", icon: PencilLine,
        run: () => { expandRow(deadline.id); startNote(deadline); },
      });
      out.push({
        id: "hide", label: "Hide hearing", icon: EyeOff, danger: true, divider: true,
        disabled: hiddenBusy.value === deadline.id,
        run: () => defer(() => askHideHearing(deadline)),
      });
    }
    return out;
  }

  if (deadline.collectionName !== "Deadlines") {
    // A milestone/event row — its date is recorded, nothing is computed from it.
    out.push({
      id: "event-date", label: `Set date…${suffix}`, icon: CalendarIcon, divider: true,
      disabled: !!blocked, run: () => defer(() => { eventDateFor.value = deadline; }),
    });
    return out;
  }

  if (deadline.status === "fulfilled") {
    out.push({
      id: "recorded-date", label: `Change the recorded date…${suffix}`, icon: CalendarIcon, divider: true,
      disabled: !!blocked, run: () => defer(() => { completeFor.value = deadline; }),
    });
  } else {
    if (!deadline.disableFulfill) {
      out.push({
        id: "set-date", label: `Set date…${suffix}`, icon: CalendarIcon, divider: true,
        disabled: !!blocked, run: () => defer(() => { completeFor.value = deadline; }),
      });
    }
    out.push({
      id: "adjourn", label: `Adjourn…${suffix}`, icon: CalendarSync, divider: out.length === 1,
      disabled: !!blocked, run: () => defer(() => { adjournFor.value = deadline; }),
    });
    // Nothing was adjourned — the computed date is simply not the real one.
    out.push({
      id: "correct", label: `Correct date…${suffix}`, icon: PencilLine,
      disabled: !!blocked, run: () => defer(() => { overrideFor.value = deadline; }),
    });
  }

  // Renaming writes `label`, never `name`: no date moves and the rule's own
  // wording stays on the record, which is why it is offered on every row.
  if (canAddDeadline.value) {
    out.push({
      id: "rename", label: isRenamed(deadline) ? "Change name" : "Rename", icon: Pencil, divider: true,
      run: () => { expandRow(deadline.id); startRename(deadline); },
    });
    if (isRenamed(deadline)) {
      out.push({
        id: "unrename", label: "Use the original name", icon: RotateCcw,
        disabled: renameBusy.value, run: () => clearRename(deadline),
      });
    }
    // A note is safe for the same reason a label is: nothing computes with it.
    out.push({
      id: "note", label: hasNote(deadline) ? "Edit note…" : "Add note…", icon: PencilLine,
      run: () => { expandRow(deadline.id); startNote(deadline); },
    });
  }
  return out;
}

/** The menu on the timeline itself, rather than on any one row. */
const surfaceActions = computed(() => {
  const out = [];
  if (canAddDeadline.value) {
    out.push({ id: "add", label: "Add deadline…", icon: CalendarPlus, run: () => defer(openAddDeadline) });
  }
  filterTabs.value
    .filter((t) => t.value !== activeFilter.value)
    .forEach((t, i) => out.push({
      id: `filter-${t.value}`,
      label: `Show ${t.label.toLowerCase()} (${t.count})`,
      icon: ListFilter,
      divider: i === 0 && out.length > 0,
      run: () => { activeFilter.value = t.value; },
    }));
  return out;
});

function openAddDeadline() {
  adhocEditing.value = null;
  adhocDialogOpen.value = true;
}

function openEditDeadline(deadline) {
  adhocEditing.value = deadline;
  adhocDialogOpen.value = true;
}

async function completeAdhoc(deadline, undo = false) {
  adhocBusy.value = deadline.id;
  try {
    const res = await completeAdhocDeadline(deadline.id, undo);
    if (res?.error) {
      toast.error(res.error);
      return;
    }
    toast.success(undo ? "Deadline reopened" : "Deadline marked done");
    emits("updated");
  } catch (err) {
    toast.error(err?.message || "Could not update deadline");
  } finally {
    adhocBusy.value = null;
  }
}

// Destructive confirmations, in the app's own voice.
//
// window.confirm was doing this job for both deletes, and it is the one dialog
// that cannot: it is titled with the origin ("localhost:3001 says"), it traps
// no focus, it cannot be styled, and on a phone it is the browser's chrome
// rather than the app's. EccmisLink already settled the pattern for the
// unlink — Drawer under tablet, AlertDialog above — so this is the same, with
// the copy driven by state because two different actions share it.
const confirmOpen = ref(false);
const confirmAction = ref(null);

function askConfirm({ title, description, actionLabel, busyId, run }) {
  confirmAction.value = { title, description, actionLabel, busyId, run };
  confirmOpen.value = true;
}

const confirmBusy = computed(() => {
  const id = confirmAction.value?.busyId;
  return Boolean(id) && (adhocBusy.value === id || hiddenBusy.value === id);
});

async function runConfirmed() {
  const action = confirmAction.value;
  if (!action) return;
  try {
    await action.run();
  } finally {
    confirmOpen.value = false;
    confirmAction.value = null;
  }
}

function askHideHearing(deadline) {
  askConfirm({
    title: "Hide this hearing?",
    description: `“${displayName(deadline)}” comes off this matter, and the court sync will stop adding it back. You can restore it from “Hidden hearings” at any time.`,
    actionLabel: "Hide hearing",
    busyId: deadline.id,
    run: () => hideHearing(deadline),
  });
}

function askRemoveAdhoc(deadline) {
  askConfirm({
    title: "Delete this deadline?",
    description: `“${displayName(deadline)}” and its reminders are removed. The matter's procedure deadlines and the court's own dates are not affected.`,
    actionLabel: "Delete",
    busyId: deadline.id,
    run: () => removeAdhoc(deadline),
  });
}

async function removeAdhoc(deadline) {
  adhocBusy.value = deadline.id;
  try {
    const res = await deleteAdhocDeadline(deadline.id);
    if (res?.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Deadline deleted");
    emits("updated");
  } catch (err) {
    toast.error(err?.message || "Could not delete deadline");
  } finally {
    adhocBusy.value = null;
  }
}

// ── Renaming ──────────────────────────────────────────────────────────────────
// Deliberately NOT part of the ad-hoc block above. Renaming applies to every row
// on the timeline, including the statutory ones the engine owns, because it only
// ever writes `label` — see internal/deadlinev2/label.go. The permission mirrors
// canAddDeadline (anyone working the matter) rather than the narrower supervisor/
// assignee rule that guards real obligations.

const renamingId = ref(null);
const renameDraft = ref("");
const renameBusy = ref(false);

function startRename(deadline) {
  renamingId.value = deadline.id;
  // Seed with the current display name so "rename" reads as editing what is on
  // screen, not as filling in an empty box.
  renameDraft.value = displayName(deadline);
}

function cancelRename() {
  renamingId.value = null;
  renameDraft.value = "";
}

async function applyRename(deadline, label) {
  renameBusy.value = true;
  try {
    const res = await renameDeadline(deadline.id, label);
    if (res?.error) {
      toast.error(res.error);
      return;
    }
    cancelRename();
    toast.success(label ? "Deadline renamed" : "Original name restored");
    emits("updated");
  } catch (err) {
    toast.error(err?.message || "Could not rename deadline");
  } finally {
    renameBusy.value = false;
  }
}

function saveRename(deadline) {
  const next = renameDraft.value.trim();
  if (!next) {
    // An empty box means "go back to the rule's wording", which is the same
    // operation as the explicit reset button — the server clears on empty.
    applyRename(deadline, "");
    return;
  }
  applyRename(deadline, next);
}

function clearRename(deadline) {
  applyRename(deadline, "");
}

// ── Notes, on any row ─────────────────────────────────────────────────────────
// The same reasoning as rename: a note changes no date and nothing computes with
// it, so it is safe on a row the firm does not own. Until the /note/ endpoint
// existed the only way to write one was the ad-hoc PATCH, which refuses exactly
// the rows a lawyer most wants to annotate — the statutory ones and the court's.

const notingId = ref(null);
const noteDraft = ref("");
const noteBusy = ref(false);

const hasNote = (deadline) => Boolean((deadline?.note || "").trim());

function startNote(deadline) {
  notingId.value = deadline.id;
  noteDraft.value = deadline?.note || "";
}

function cancelNote() {
  notingId.value = null;
  noteDraft.value = "";
}

async function saveNote(deadline) {
  noteBusy.value = true;
  try {
    const next = noteDraft.value.trim();
    const res = await annotateDeadline(deadline.id, next);
    if (res?.error) {
      toast.error(res.error);
      return;
    }
    cancelNote();
    toast.success(next ? "Note saved" : "Note removed");
    emits("updated");
  } catch (err) {
    toast.error(err?.message || "Could not save the note");
  } finally {
    noteBusy.value = false;
  }
}

// ── Hidden court hearings ─────────────────────────────────────────────────────
// Deleting a court row on its own would last until the next sync, which runs
// twice a day: ECCMIS would simply send the sitting again. So the backend
// records a tombstone against the sitting's identity and the sync skips it.
//
// That makes the removal real, which is exactly why the list below has to exist.
// A hidden hearing nobody can see or undo is not hidden, it is lost — and the
// firm would have no way to tell a deliberate removal from a sync that quietly
// stopped working.

const hiddenHearings = ref([]);
const hiddenBusy = ref(null);
const showHidden = ref(false);

async function loadHiddenHearings() {
  if (!props.matter?.id) return;
  try {
    const res = await listHiddenHearings(props.matter.id);
    // A failed read is not "nothing is hidden". Keeping the last known list is
    // the safer wrong answer: blanking it would quietly remove the only route
    // back to a hidden hearing.
    if (res?.error) return;
    hiddenHearings.value = res?.hidden || [];
  } catch {
    // A matter page must still render when this call fails; the worst case is
    // that the strip shows what it last knew until the next load.
  }
}

async function hideHearing(deadline) {
  if (!deadline) return;
  hiddenBusy.value = deadline.id;
  try {
    const res = await hideCourtDeadline(deadline.id);
    if (res?.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Hearing hidden", { description: "Restore it from Hidden hearings." });
    await loadHiddenHearings();
    emits("updated");
  } catch (err) {
    toast.error(err?.message || "Could not hide the hearing");
  } finally {
    hiddenBusy.value = null;
  }
}

async function restoreHearing(hidden) {
  hiddenBusy.value = hidden.id;
  try {
    const res = await restoreHiddenHearing(props.matter.id, hidden.id);
    if (res?.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Hearing restored");
    await loadHiddenHearings();
    emits("updated");
  } catch (err) {
    toast.error(err?.message || "Could not restore the hearing");
  } finally {
    hiddenBusy.value = null;
  }
}

onMounted(loadHiddenHearings);
watch(() => props.matter?.id, loadHiddenHearings);

// Kept for future use when reset is re-enabled
async function handleResetDeadline(deadline) {
  const confirmed = confirm(
    `Reset "${deadline.name}" to its template-calculated date? Dependent deadlines will also recalculate.`
  );
  if (!confirmed) return;
  try {
    const result = await resetDeadline(deadline.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Deadline reset", {
        description: `${new Date(result.oldDate).toLocaleDateString()} → ${new Date(result.newDate).toLocaleDateString()}`,
      });
      emits("updated");
    }
  } catch {
    toast.error("Failed to reset deadline");
  }
}
</script>
