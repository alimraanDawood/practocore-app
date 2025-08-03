<script setup lang="ts">
definePageMeta({
  layout: 'blank',
})
</script>

<template>
<!--  <LayoutAuth reverse>-->
<!--    <div class="flex flex-col mx-auto max-w-sm px-3 h-full">-->
<!--      <div class="grid gap-3 border-x p-3 h-full">-->

<!--        <AuthSignIn />-->
<!--      </div>-->
<!--    </div>-->
<!--  </LayoutAuth>-->

    <div class="flex flex-col w-full h-[100dvh]">
      <div class="flex flex-row p-3 border-b"></div>
      <div class="flex flex-col w-full h-full gap-5 items-center justify-center">
        <div class="flex flex-col w-[95vw] items-center justify-center lg:w-[35vw] items-center p-3 border-x h-full">
          <div class="flex flex-col w-full lg:max-w-sm">
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

            <AuthSignIn class="w-full" />
          </div>
        </div>
      </div>
      <div class="flex flex-row p-3 border-t"></div>
    </div>
</template>
