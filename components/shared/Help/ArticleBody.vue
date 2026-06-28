<script setup lang="ts">
// Renders a help article's Markdown body to sanitized HTML, mirroring the
// vault DocumentPreview markdown path (marked + DOMPurify, GFM + line breaks).
import { computed } from 'vue';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const props = defineProps<{ source: string }>();

marked.use({ breaks: true, gfm: true });

const html = computed(() => {
  const md = props.source?.trim();
  if (!md) return '<p><em>This article is empty.</em></p>';
  return DOMPurify.sanitize(marked.parse(md) as string);
});
</script>

<template>
  <!-- prose gives readable typography for the rendered Markdown. -->
  <div
    class="prose prose-pink prose-sm dark:prose-invert max-w-none prose-headings:scroll-mt-20 prose-headings:font-semibold prose-a:text-primary"
    v-html="html"
  />
</template>
