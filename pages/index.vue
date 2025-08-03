<template>
</template>

<script setup>
definePageMeta({
  layout: 'empty'
});

onMounted(() => {
  useRouter().push('/main/');
})
</script>