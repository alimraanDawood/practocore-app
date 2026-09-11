<script setup lang="ts">
import { computed, nextTick, watch } from 'vue';
import type { CaseLawDetail, CaseLawParagraph } from '~/services/caselaw';
import { courtLabel } from '~/services/caselaw';

const props = defineProps<{
  detail: CaseLawDetail;
  anchor?: string;
}>();

const legislationTypes = new Set([
  'act', 'constitution', 'statutory_instrument', 'rules', 'practice_direction',
]);
const isLegislation = computed(() => legislationTypes.has(props.detail.type));

interface RenderSection extends CaseLawParagraph {
  number: string;
  heading: string;
  body: string;
  blocks: string[];
  part: string;
  showPart: boolean;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sectionNumber(anchor: string): string {
  return anchor
    .replace(/^s\./i, '')
    .replace(/^art\./i, '')
    .replace(/^para(?:graph)?\s*/i, '')
    .trim();
}

function pathParts(path = ''): { part: string; heading: string } {
  const pieces = path.split('>').map(piece => piece.trim()).filter(Boolean);
  if (!pieces.length) return { part: '', heading: '' };
  const leaf = pieces.at(-1) || '';
  const part = pieces.length > 1 ? pieces.slice(0, -1).join(' — ') : '';
  const heading = leaf.replace(/^(?:s\.|art\.)?\d+[A-Z]?\.?\s*/i, '').trim();
  return { part, heading };
}

// The stored verbatim segment includes its printed section number and marginal
// heading. Those are rendered separately so the document gets a real hierarchy;
// only the duplicate lead is removed, never the substantive body text.
function sectionBody(paragraph: CaseLawParagraph, number: string, heading: string): string {
  if (!isLegislation.value) return paragraph.text.trim();
  let text = paragraph.text.trim();
  const numberLead = new RegExp(`^${escapeRegExp(number)}\\.?\\s*`, 'i');
  text = text.replace(numberLead, '');
  if (heading) {
    const headingLead = new RegExp(`^${escapeRegExp(heading)}(?:\\s*[.—–-])?\\s*`, 'i');
    text = text.replace(headingLead, '');
  }
  return text.trim();
}

const sections = computed<RenderSection[]>(() => {
  let previousPart = '';
  return props.detail.paragraphs.map((paragraph) => {
    const number = sectionNumber(paragraph.anchor);
    const { part, heading } = pathParts(paragraph.path);
    const body = sectionBody(paragraph, number, heading);
    const showPart = !!part && part !== previousPart;
    if (part) previousPart = part;
    return {
      ...paragraph,
      number,
      heading,
      body,
      blocks: body.split(/\n{2,}/).map(block => block.trim()).filter(Boolean),
      part,
      showPart,
    };
  });
});

function formatDate(value?: string): string {
  if (!value) return '';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat('en-UG', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(date);
}

const metadata = computed(() => {
  if (isLegislation.value) {
    return [
      props.detail.act_number ? { label: 'Originally enacted as', value: props.detail.act_number } : null,
      props.detail.commencement_date ? { label: 'Commenced', value: formatDate(props.detail.commencement_date) } : null,
      props.detail.as_at ? { label: 'Consolidated as at', value: formatDate(props.detail.as_at) } : null,
    ].filter((item): item is { label: string; value: string } => !!item);
  }
  return [
    props.detail.court ? { label: 'Court', value: courtLabel(props.detail.court) } : null,
    props.detail.decision_date ? { label: 'Decided', value: formatDate(props.detail.decision_date) } : null,
    props.detail.case_number ? { label: 'Case number', value: props.detail.case_number } : null,
  ].filter((item): item is { label: string; value: string } => !!item);
});

function isCited(anchor: string): boolean {
  return !!props.anchor && anchor.trim().toLowerCase() === props.anchor.trim().toLowerCase();
}

const sectionRefs = new Map<string, HTMLElement>();
function setSectionRef(anchor: string, el: unknown) {
  if (el instanceof HTMLElement) sectionRefs.set(anchor.trim().toLowerCase(), el);
}

async function scrollToCitation() {
  if (!props.anchor) return;
  await nextTick();
  sectionRefs.get(props.anchor.trim().toLowerCase())?.scrollIntoView({ block: 'center' });
}

watch(() => [props.detail.id, props.anchor], scrollToCitation, { immediate: true });
</script>

<template>
  <article class="legal-document" :class="{ 'legal-document--judgment': !isLegislation }">
    <header class="legal-document__masthead">
      <p class="legal-document__jurisdiction">Uganda</p>
      <h1>{{ detail.title }}</h1>
      <p v-if="isLegislation && detail.cap" class="legal-document__identity">{{ detail.cap }}</p>
      <p v-else-if="detail.citation" class="legal-document__identity">{{ detail.citation }}</p>

      <dl v-if="metadata.length" class="legal-document__metadata">
        <div v-for="item in metadata" :key="item.label">
          <dt>{{ item.label }}</dt>
          <dd>{{ item.value }}</dd>
        </div>
      </dl>

      <p v-if="isLegislation && detail.as_at" class="legal-document__currency">
        This is the consolidated version available at {{ formatDate(detail.as_at) }}.
      </p>
    </header>

    <div class="legal-document__rule" />

    <div class="legal-document__body">
      <template v-for="section in sections" :key="section.id">
        <h2 v-if="section.showPart" class="legal-document__part">{{ section.part }}</h2>

        <section
          :ref="el => setSectionRef(section.anchor, el)"
          class="legal-document__section"
          :class="{ 'legal-document__section--cited': isCited(section.anchor) }"
        >
          <p v-if="isCited(section.anchor)" class="legal-document__cited-label">Cited provision</p>

          <h3 v-if="isLegislation" class="legal-document__section-heading">
            <span class="legal-document__number">{{ section.number }}.</span>
            <span>{{ section.heading || section.anchor }}</span>
          </h3>

          <div v-else class="legal-document__paragraph-row">
            <span class="legal-document__paragraph-number">[{{ section.number }}]</span>
            <div class="legal-document__section-copy">
              <p v-for="(block, index) in section.blocks" :key="index">{{ block }}</p>
            </div>
          </div>

          <div v-if="isLegislation" class="legal-document__section-copy legal-document__section-copy--indented">
            <p v-for="(block, index) in section.blocks" :key="index">{{ block }}</p>
          </div>
        </section>
      </template>
    </div>
  </article>
</template>

<style scoped>
.legal-document {
  min-height: 100%;
  background: #fff;
  color: #262521;
  font-family: "IBM Plex Serif", Georgia, Cambria, "Times New Roman", serif;
  font-size: 1rem;
  line-height: 1.72;
}

.legal-document__masthead {
  margin: 0 auto;
  max-width: 48rem;
  padding: clamp(2.75rem, 7vw, 5.5rem) clamp(1.25rem, 5vw, 4rem) 2.75rem;
  text-align: center;
}

.legal-document__jurisdiction {
  margin: 0 0 0.9rem;
  font-size: 1rem;
  font-weight: 600;
}

.legal-document h1 {
  margin: 0;
  text-wrap: balance;
  font-size: clamp(1.7rem, 4vw, 2.35rem);
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.legal-document__identity {
  margin: 1rem 0 0;
  font-size: 1.15rem;
  font-weight: 600;
}

.legal-document__metadata {
  display: grid;
  gap: 0.32rem;
  margin: 1.5rem auto 0;
  max-width: 34rem;
  font-size: 0.9rem;
  line-height: 1.45;
}

.legal-document__metadata div {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.35rem;
}

.legal-document__metadata dt {
  color: #625f57;
}

.legal-document__metadata dt::after {
  content: ":";
}

.legal-document__metadata dd {
  margin: 0;
  font-weight: 600;
}

.legal-document__currency {
  margin: 1.5rem auto 0;
  max-width: 38rem;
  color: #625f57;
  font-size: 0.88rem;
  font-style: italic;
}

.legal-document__rule {
  height: 1px;
  margin: 0 auto;
  max-width: 44rem;
  background: #ddd9d0;
}

.legal-document__body {
  margin: 0 auto;
  max-width: 50rem;
  padding: 1rem clamp(1.25rem, 5vw, 4rem) 6rem;
}

.legal-document__part {
  margin: 3.75rem 0 1.9rem;
  text-align: center;
  text-wrap: balance;
  font-size: 1.22rem;
  font-weight: 600;
  line-height: 1.35;
}

.legal-document__section {
  position: relative;
  margin: 0 -0.9rem 2.25rem;
  padding: 0.55rem 0.9rem 0.75rem;
  border-radius: 0.2rem;
  scroll-margin-block: 5rem;
}

.legal-document__section--cited {
  background: #fff4c7;
  box-shadow: inset 3px 0 0 #c79520;
}

.legal-document__cited-label {
  margin: 0 0 0.45rem;
  color: #765b17;
  font-family: "Geist", ui-sans-serif, system-ui, sans-serif;
  font-size: 0.7rem;
  font-weight: 650;
}

.legal-document__section-heading {
  display: grid;
  grid-template-columns: 2.2rem minmax(0, 1fr);
  gap: 0.45rem;
  margin: 0 0 0.65rem;
  font-size: 1.04rem;
  font-weight: 600;
  line-height: 1.45;
}

.legal-document__number {
  font-variant-numeric: tabular-nums;
}

.legal-document__section-copy {
  display: grid;
  gap: 0.85rem;
}

.legal-document__section-copy--indented {
  padding-left: 2.65rem;
}

.legal-document__section-copy p {
  margin: 0;
  white-space: pre-line;
}

.legal-document__paragraph-row {
  display: grid;
  grid-template-columns: 3rem minmax(0, 1fr);
  gap: 0.8rem;
}

.legal-document__paragraph-number {
  color: #625f57;
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
  line-height: 1.9rem;
}

@media (max-width: 640px) {
  .legal-document__masthead {
    padding-top: 2.75rem;
  }

  .legal-document__body {
    padding-inline: 1.1rem;
  }

  .legal-document__section {
    margin-inline: -0.45rem;
    padding-inline: 0.45rem;
  }

  .legal-document__section-copy--indented {
    padding-left: 0;
  }

  .legal-document__section-heading {
    grid-template-columns: 1.9rem minmax(0, 1fr);
  }
}

@media (prefers-reduced-motion: no-preference) {
  .legal-document__section--cited {
    animation: citation-settle 700ms ease-out;
  }
}

@keyframes citation-settle {
  from { background: #ffe58a; }
  to { background: #fff4c7; }
}
</style>
