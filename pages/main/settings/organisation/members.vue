<template>
  <div />
</template>

<script setup>
// Retired. This page rendered a second copy of the member table that lives on
// /main/lawyers — the same data, a different set of actions, and its own idea of
// what a role is. Kept as a redirect rather than deleted because it is linked
// from settings and from bookmarks.
definePageMeta({
  layout: 'blank'
});

await navigateTo('/main/lawyers');
</script>
