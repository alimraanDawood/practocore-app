<template>
  <div class="flex flex-col w-full h-full overflow-hidden items-center">
    <div class="flex flex-col h-full lg:w-[90vw] w-full">
      <div class="flex flex-col w-full h-full">

        <!-- Back button for mobile -->
        <div class="flex flex-row items-center gap-3 p-3 border-b lg:hidden">
          <Button variant="outline" size="icon-sm" @click="$router.back()">
            <ArrowLeft class="size-5" />
          </Button>
          <span class="text-lg font-semibold">Documentation</span>

          <SharedDarkModeSwitch class="ml-auto" />
        </div>

        <div class="flex flex-col gap-8 p-4 lg:p-6 h-full overflow-y-scroll">

          <!-- Quick start cards -->
          <div class="flex flex-col gap-3">
            <h2 class="font-semibold text-lg">Getting Started</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

              <div class="flex flex-col gap-2 p-5 border rounded-xl bg-muted/30">
                <div class="flex flex-row items-center gap-2">
                  <div class="size-8 rounded-full bg-primary/10 grid place-items-center shrink-0">
                    <span class="text-primary font-bold text-sm">1</span>
                  </div>
                  <span class="font-semibold text-sm">Create your first matter</span>
                </div>
                <p class="text-xs text-muted-foreground">
                  Click <strong>+ Create Matter</strong> on the dashboard. Choose a template, enter the
                  trigger date, fill in matter details. PractoCore calculates every deadline automatically.
                </p>
              </div>

              <div class="flex flex-col gap-2 p-5 border rounded-xl bg-muted/30">
                <div class="flex flex-row items-center gap-2">
                  <div class="size-8 rounded-full bg-primary/10 grid place-items-center shrink-0">
                    <span class="text-primary font-bold text-sm">2</span>
                  </div>
                  <span class="font-semibold text-sm">Invite your team</span>
                </div>
                <p class="text-xs text-muted-foreground">
                  Go to <strong>Team</strong> → <strong>Add Lawyer</strong>. Enter their email and assign
                  a role. They'll receive an invitation email to join your organisation.
                </p>
              </div>

              <div class="flex flex-col gap-2 p-5 border rounded-xl bg-muted/30">
                <div class="flex flex-row items-center gap-2">
                  <div class="size-8 rounded-full bg-primary/10 grid place-items-center shrink-0">
                    <span class="text-primary font-bold text-sm">3</span>
                  </div>
                  <span class="font-semibold text-sm">Enable notifications</span>
                </div>
                <p class="text-xs text-muted-foreground">
                  Go to <strong>Settings → Notifications</strong> and enable push notifications so
                  reminders reach you even when the app is closed.
                </p>
              </div>
            </div>
          </div>

          <Separator />

          <!-- Core concepts -->
          <div class="flex flex-col gap-4">
            <h2 class="font-semibold text-lg">Core Concepts</h2>

            <Accordion type="multiple" class="w-full border rounded-xl overflow-hidden divide-y">

              <AccordionItem value="matters" class="px-4">
                <AccordionTrigger class="text-sm font-semibold py-4 text-left gap-2">
                  <div class="flex flex-row items-center gap-2">
                    <Briefcase class="size-4 text-primary shrink-0" />
                    Matters
                  </div>
                </AccordionTrigger>
                <AccordionContent class="text-sm text-muted-foreground pb-4 flex flex-col gap-2">
                  <p>A <strong>matter</strong> represents one legal case or file — e.g. "Acacia Ltd v Bloom Holdings (Appeal)".</p>
                  <p>Each matter is created from a <strong>template</strong> and a <strong>trigger date</strong> (the filing date, service date, or judgment date that starts the procedural clock). PractoCore calculates every deadline from that single date.</p>
                  <p>Matters can contain <strong>applications</strong> — child matters that are filed within a parent case (e.g. an interlocutory application).</p>
                  <p>Matter data includes: case number, parties, opposing counsel, court officers, and assigned team members.</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="deadlines" class="px-4">
                <AccordionTrigger class="text-sm font-semibold py-4 text-left gap-2">
                  <div class="flex flex-row items-center gap-2">
                    <CalendarClock class="size-4 text-primary shrink-0" />
                    Deadlines
                  </div>
                </AccordionTrigger>
                <AccordionContent class="text-sm text-muted-foreground pb-4 flex flex-col gap-2">
                  <p>Deadlines are calculated procedural dates — e.g. "Notice of Appeal must be filed within 21 court days of judgment".</p>
                  <p>Each deadline has a <strong>status</strong>:</p>
                  <ul class="list-disc ml-4 flex flex-col gap-1">
                    <li><strong>Pending</strong> — upcoming, not yet done</li>
                    <li><strong>Fulfilled</strong> — marked complete</li>
                    <li><strong>Overdue</strong> — past date without being completed</li>
                    <li><strong>Unavailable</strong> — not yet activated (depends on another deadline being fulfilled first)</li>
                  </ul>
                  <p><strong>Cascading updates:</strong> when you complete or adjourn a deadline, every deadline that depends on it automatically recalculates its date.</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="templates" class="px-4">
                <AccordionTrigger class="text-sm font-semibold py-4 text-left gap-2">
                  <div class="flex flex-row items-center gap-2">
                    <LayoutTemplate class="size-4 text-primary shrink-0" />
                    Templates
                  </div>
                </AccordionTrigger>
                <AccordionContent class="text-sm text-muted-foreground pb-4 flex flex-col gap-2">
                  <p>A <strong>template</strong> encodes the complete procedural lifecycle of a matter type — all deadlines, their dependencies, counting rules, holiday adjustments, and reminders.</p>
                  <p>Built-in templates include: Appeal, Ordinary Plaint, Summary Suit, Employment, Chamber Summons. Your firm can also create custom templates for your specific practice areas and court rules.</p>
                  <p>Templates can be kept <strong>private</strong> (only you), shared with your <strong>organisation</strong>, or (coming soon) published to the community <strong>marketplace</strong>.</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="adjournments" class="px-4">
                <AccordionTrigger class="text-sm font-semibold py-4 text-left gap-2">
                  <div class="flex flex-row items-center gap-2">
                    <CalendarArrowUp class="size-4 text-primary shrink-0" />
                    Adjournments
                  </div>
                </AccordionTrigger>
                <AccordionContent class="text-sm text-muted-foreground pb-4 flex flex-col gap-2">
                  <p>When a court grants an extension or postponement, use the <strong>Adjourn</strong> action on the affected deadline.</p>
                  <p>Enter the new date and a reason (e.g. "Court order dated 20 Feb 2026"). PractoCore records the change with a full audit trail and recalculates all downstream deadlines automatically.</p>
                  <p>The original date is preserved in the deadline history for compliance and condonation application purposes.</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="reminders" class="px-4">
                <AccordionTrigger class="text-sm font-semibold py-4 text-left gap-2">
                  <div class="flex flex-row items-center gap-2">
                    <Bell class="size-4 text-primary shrink-0" />
                    Reminders &amp; Notifications
                  </div>
                </AccordionTrigger>
                <AccordionContent class="text-sm text-muted-foreground pb-4 flex flex-col gap-2">
                  <p>Every deadline has a built-in reminder schedule defined in its template (typically 30, 14, 7, 3, and 1 day before).</p>
                  <p>Reminders escalate as the deadline approaches:</p>
                  <ul class="list-disc ml-4 flex flex-col gap-1">
                    <li><strong>Moderate</strong> — 10+ days out</li>
                    <li><strong>Urgent</strong> — 5–9 days out</li>
                    <li><strong>Critical</strong> — less than 5 days out</li>
                  </ul>
                  <p>Reminders are delivered via <strong>in-app notifications</strong>, <strong>email</strong>, and <strong>push notifications</strong> (mobile &amp; desktop). Enable push notifications in Settings → Notifications to receive alerts when the app is closed.</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="roles" class="px-4">
                <AccordionTrigger class="text-sm font-semibold py-4 text-left gap-2">
                  <div class="flex flex-row items-center gap-2">
                    <Users class="size-4 text-primary shrink-0" />
                    Roles &amp; Permissions
                  </div>
                </AccordionTrigger>
                <AccordionContent class="text-sm text-muted-foreground pb-4 flex flex-col gap-2">
                  <p>PractoCore uses role-based access control within your organisation:</p>
                  <ul class="list-disc ml-4 flex flex-col gap-1">
                    <li><strong>Member</strong> — can view and update matters and deadlines they are assigned to</li>
                    <li><strong>Moderator</strong> — all member permissions + can manage all matters and view reports</li>
                    <li><strong>Admin</strong> — full access including user management and settings</li>
                    <li><strong>Owner</strong> — admin + organisation and subscription management</li>
                  </ul>
                  <p>Assign roles when inviting a team member, or change them later in <strong>Organisation → Members</strong>.</p>
                </AccordionContent>
              </AccordionItem>

            </Accordion>
          </div>

          <Separator />

          <!-- Keyboard shortcuts / tips -->
          <div class="flex flex-col gap-3">
            <h2 class="font-semibold text-lg">Tips &amp; Best Practices</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <div class="flex flex-col gap-2 p-4 border rounded-xl">
                <div class="flex flex-row items-center gap-2">
                  <CheckCircle2 class="size-4 text-green-600 shrink-0" />
                  <span class="font-semibold text-sm">Always set the correct trigger date</span>
                </div>
                <p class="text-xs text-muted-foreground">
                  The trigger date is the single date from which every deadline is calculated. Make sure it
                  matches the date in the actual court order or filing receipt. A wrong trigger date shifts
                  every deadline downstream.
                </p>
              </div>

              <div class="flex flex-col gap-2 p-4 border rounded-xl">
                <div class="flex flex-row items-center gap-2">
                  <CheckCircle2 class="size-4 text-green-600 shrink-0" />
                  <span class="font-semibold text-sm">Mark deadlines complete immediately</span>
                </div>
                <p class="text-xs text-muted-foreground">
                  As soon as a step is completed (e.g. Notice of Appeal filed), mark it done in PractoCore.
                  This activates the next set of deadlines and keeps the timeline accurate for the
                  whole team.
                </p>
              </div>

              <div class="flex flex-col gap-2 p-4 border rounded-xl">
                <div class="flex flex-row items-center gap-2">
                  <CheckCircle2 class="size-4 text-green-600 shrink-0" />
                  <span class="font-semibold text-sm">Use adjournments — don't edit dates manually</span>
                </div>
                <p class="text-xs text-muted-foreground">
                  Use the <strong>Adjourn</strong> action (not manual edit) when a court moves a date. This
                  preserves the original date in the audit trail and triggers the correct cascade
                  recalculation.
                </p>
              </div>

              <div class="flex flex-col gap-2 p-4 border rounded-xl">
                <div class="flex flex-row items-center gap-2">
                  <CheckCircle2 class="size-4 text-green-600 shrink-0" />
                  <span class="font-semibold text-sm">Assign lawyers to matters</span>
                </div>
                <p class="text-xs text-muted-foreground">
                  Assign the handling attorney to each matter. They'll receive targeted reminders for
                  deadlines in their matters and partners can see matter ownership at a glance on the
                  dashboard.
                </p>
              </div>

              <div class="flex flex-col gap-2 p-4 border rounded-xl">
                <div class="flex flex-row items-center gap-2">
                  <CheckCircle2 class="size-4 text-green-600 shrink-0" />
                  <span class="font-semibold text-sm">Check the calendar weekly</span>
                </div>
                <p class="text-xs text-muted-foreground">
                  The <strong>Calendar</strong> page shows your entire firm's deadline schedule in one view.
                  A weekly review by the managing partner takes two minutes and surfaces anything approaching
                  critical status.
                </p>
              </div>

              <div class="flex flex-col gap-2 p-4 border rounded-xl">
                <div class="flex flex-row items-center gap-2">
                  <CheckCircle2 class="size-4 text-green-600 shrink-0" />
                  <span class="font-semibold text-sm">Create templates for your firm's common matters</span>
                </div>
                <p class="text-xs text-muted-foreground">
                  If your firm regularly handles a specific matter type, ask us to build a custom template
                  that encodes your firm's exact workflow. This saves setup time and ensures consistency
                  across your team.
                </p>
              </div>

            </div>
          </div>

          <Separator />

          <!-- Need more help -->
          <div class="flex flex-col gap-3 p-5 border rounded-xl bg-muted/30 items-start">
            <h2 class="font-semibold">Need more help?</h2>
            <p class="text-sm text-muted-foreground">Our support team is available Monday to Friday, 8 am – 6 pm EAT.</p>
            <div class="flex flex-row gap-2 flex-wrap">
              <a href="mailto:support@practocore.com">
                <Button variant="outline" size="sm">
                  <Mail class="size-4 mr-2" />
                  Email support
                </Button>
              </a>
              <a href="https://wa.me/256700000000" target="_blank">
                <Button variant="outline" size="sm">
                  <MessageCircle class="size-4 mr-2" />
                  WhatsApp
                </Button>
              </a>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import {
  ArrowLeft, BookOpen, Briefcase, CalendarClock, LayoutTemplate,
  Bell, Users, CheckCircle2, Mail, MessageCircle, CalendarArrowUp
} from "lucide-vue-next";

definePageMeta({
  layout: 'no-mobile-nav'
})
</script>



