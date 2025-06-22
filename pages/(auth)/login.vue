<script setup lang="ts">
definePageMeta({
  layout: 'blank',
})
</script>

<template>
  <LayoutAuth reverse>
    <div class="grid mx-auto max-w-sm gap-6">
      <div class="grid gap-2 text-center">
        <div class="flex flex-row w-full items-center justify-center">
          <img alt="logo" src="@/assets/img/logos/Practo%20Core%20Square.png" class="size-12" />
        </div>
        <h1 class="text-2xl font-semibold tracking-tight gold">
          Welcome back
        </h1>
        <p class="text-balance text-sm text-muted-foreground">
          Login with your Apple or Google account
        </p>
      </div>
      <AuthSignIn />
    </div>
  </LayoutAuth>
</template>
