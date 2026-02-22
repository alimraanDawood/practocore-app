<template>
  <!-- Reuse the full support page content inline for the desktop settings tab -->
  <div class="flex flex-col gap-6 p-6">

    <div class="flex flex-col gap-1">
      <h1 class="text-2xl font-semibold ibm-plex-serif">Support &amp; Help</h1>
      <p class="text-sm text-muted-foreground">We're here to help. Reach out any time — we typically respond within a few hours.</p>
    </div>

    <Separator />

    <!-- Priority channels -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

      <!-- WhatsApp -->
      <a href="https://wa.me/256700000000" target="_blank"
         class="flex flex-col gap-3 p-5 border rounded-xl hover:bg-muted/50 transition-colors group">
        <div class="flex flex-row items-center gap-3">
          <div class="size-10 rounded-full bg-green-500/10 grid place-items-center shrink-0">
            <MessageCircle class="size-5 text-green-600" />
          </div>
          <div class="flex flex-col">
            <span class="font-semibold text-sm">WhatsApp</span>
            <span class="text-xs text-muted-foreground">Fastest response</span>
          </div>
          <ExternalLink class="size-4 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <div class="flex flex-col gap-0.5">
          <span class="text-sm font-medium">+256 700 000 000</span>
          <span class="text-xs text-muted-foreground">Mon – Fri, 8 am – 6 pm EAT</span>
        </div>
      </a>

      <!-- Email support -->
      <a href="mailto:support@practocore.com"
         class="flex flex-col gap-3 p-5 border rounded-xl hover:bg-muted/50 transition-colors group">
        <div class="flex flex-row items-center gap-3">
          <div class="size-10 rounded-full bg-primary/10 grid place-items-center shrink-0">
            <Mail class="size-5 text-primary" />
          </div>
          <div class="flex flex-col">
            <span class="font-semibold text-sm">Email</span>
            <span class="text-xs text-muted-foreground">24-hour response</span>
          </div>
          <ExternalLink class="size-4 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <div class="flex flex-col gap-0.5">
          <span class="text-sm font-medium">support@practocore.com</span>
          <span class="text-xs text-muted-foreground">Billing, accounts &amp; technical issues</span>
        </div>
      </a>

      <!-- Sales / Onboarding -->
      <a href="mailto:sales@practocore.com"
         class="flex flex-col gap-3 p-5 border rounded-xl hover:bg-muted/50 transition-colors group">
        <div class="flex flex-row items-center gap-3">
          <div class="size-10 rounded-full bg-blue-500/10 grid place-items-center shrink-0">
            <Headset class="size-5 text-blue-600" />
          </div>
          <div class="flex flex-col">
            <span class="font-semibold text-sm">Sales &amp; Onboarding</span>
            <span class="text-xs text-muted-foreground">New firms &amp; upgrades</span>
          </div>
          <ExternalLink class="size-4 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <div class="flex flex-col gap-0.5">
          <span class="text-sm font-medium">sales@practocore.com</span>
          <span class="text-xs text-muted-foreground">Custom templates &amp; enterprise plans</span>
        </div>
      </a>
    </div>

    <Separator />

    <!-- Quick answers -->
    <div class="flex flex-col gap-3">
      <h2 class="font-semibold">Quick Answers</h2>

      <Accordion type="single" collapsible class="w-full border rounded-xl overflow-hidden divide-y">
        <AccordionItem value="q1" class="px-4">
          <AccordionTrigger class="text-sm font-medium py-4 text-left">How do I create my first matter?</AccordionTrigger>
          <AccordionContent class="text-sm text-muted-foreground pb-4">
            Click the <strong>+ Create Matter</strong> button on the dashboard or the Matters page. Select a
            template that matches your case type (e.g. Appeal, Ordinary Plaint), enter the trigger date
            (usually the judgment or filing date), fill in the matter details, and PractoCore will
            automatically calculate all deadlines for you.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="q2" class="px-4">
          <AccordionTrigger class="text-sm font-medium py-4 text-left">What happens when a court grants an adjournment?</AccordionTrigger>
          <AccordionContent class="text-sm text-muted-foreground pb-4">
            Open the affected deadline from the matter timeline, click <strong>Adjourn</strong>, enter the
            new date and the reason. PractoCore will automatically recalculate all dependent deadlines —
            no manual updates needed.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="q3" class="px-4">
          <AccordionTrigger class="text-sm font-medium py-4 text-left">How do I invite colleagues to my organisation?</AccordionTrigger>
          <AccordionContent class="text-sm text-muted-foreground pb-4">
            Go to <strong>Team</strong> in the navigation and click <strong>Add Lawyer</strong>. Enter their
            email address and assign a role (Member, Moderator, or Admin). They will receive an invitation
            email with a secure link to join your organisation.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="q4" class="px-4">
          <AccordionTrigger class="text-sm font-medium py-4 text-left">I'm not receiving push notifications — what should I do?</AccordionTrigger>
          <AccordionContent class="text-sm text-muted-foreground pb-4">
            Open <strong>Settings → Notifications</strong> and make sure push notifications are enabled.
            On Android, also check that battery optimisation is not restricting the app. If the problem
            persists, sign out, sign back in, and re-enable notifications. Contact support if it continues.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="q5" class="px-4">
          <AccordionTrigger class="text-sm font-medium py-4 text-left">Can I change my subscription plan?</AccordionTrigger>
          <AccordionContent class="text-sm text-muted-foreground pb-4">
            Yes. Go to <strong>Settings → Billing</strong> and click <strong>Manage Subscription</strong>.
            You can upgrade, downgrade, or add seats at any time. Changes take effect from the next billing
            cycle. For enterprise or custom pricing, email sales@practocore.com.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="q6" class="px-4">
          <AccordionTrigger class="text-sm font-medium py-4 text-left">How do I create or customise a deadline template?</AccordionTrigger>
          <AccordionContent class="text-sm text-muted-foreground pb-4">
            Navigate to <strong>Templates</strong> in the sidebar and click <strong>+ New Template</strong>.
            You can build a template from scratch using the visual editor — define deadlines, set offset
            rules, add holidays, and configure reminders. Templates can be kept private, shared with your
            organisation, or (soon) published to the marketplace.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>

    <Separator />

    <!-- Debug info for bug reports -->
    <div class="flex flex-col gap-3">
      <h2 class="font-semibold">Report a Bug</h2>
      <p class="text-sm text-muted-foreground">
        When reporting a bug please include your <strong>account email</strong>, a short description of
        what happened, and the information below.
      </p>

      <div class="flex flex-col gap-2 p-4 bg-muted rounded-xl font-mono text-xs break-all select-all">
        <div class="flex flex-row justify-between gap-2">
          <span class="text-muted-foreground">App version</span>
          <span>1.0.0</span>
        </div>
        <div class="flex flex-row justify-between gap-2">
          <span class="text-muted-foreground">Platform</span>
          <span>{{ platform }}</span>
        </div>
        <div class="flex flex-row justify-between gap-2">
          <span class="text-muted-foreground">User agent</span>
          <span class="truncate max-w-[60%] text-right">{{ shortUA }}</span>
        </div>
      </div>

      <Button variant="outline" size="sm" class="w-fit" @click="copyDebugInfo">
        <Copy class="size-4 mr-2" />
        Copy debug info
      </Button>
    </div>

  </div>
</template>

<script setup lang="ts">
import { Headset, Mail, MessageCircle, ExternalLink, Copy } from 'lucide-vue-next';
import { toast } from 'vue-sonner';

const platform = computed(() => {
  if (typeof window === 'undefined') return 'web';
  if ('__TAURI_INTERNALS__' in window) return 'desktop (Tauri)';
  if (/android/i.test(navigator.userAgent)) return 'android';
  if (/iphone|ipad/i.test(navigator.userAgent)) return 'ios';
  return 'web';
});

const shortUA = computed(() => {
  if (typeof window === 'undefined') return '';
  return navigator.userAgent;
});

const copyDebugInfo = async () => {
  const info = [
    `App version: 1.0.0`,
    `Platform: ${platform.value}`,
    `User agent: ${shortUA.value}`,
  ].join('\n');
  try {
    await navigator.clipboard.writeText(info);
    toast.success('Debug info copied to clipboard');
  } catch {
    toast.error('Could not copy to clipboard');
  }
};
</script>

