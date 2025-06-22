<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'
// import { forgotTopLevelAdministratorPassword } from "~/services/auth";
import { toast } from "vue-sonner";

const isLoading = ref(false)

const email = ref('')

async function onSubmit(event: Event) {
  event.preventDefault()
  if (email.value.length < 3)
    return

  isLoading.value = true;

  try {
    // const result = await forgotTopLevelAdministratorPassword(email.value);
    //
    // if (result) {
    //   toast.success("Success: Check your inbox for a reset link!")
    // }

  } catch (e) {
    toast.error("Failed to send password reset link!")
    console.error(e)
  }

  isLoading.value = false;
}
</script>

<template>
  <form @submit="onSubmit">
    <div class="grid gap-4">
      <div class="grid gap-2">
        <Label for="email">
          Email
        </Label>
        <Input
            id="email"
            v-model="email"
            placeholder="name@example.com"
            type="email"
            auto-capitalize="none"
            auto-complete="email"
            auto-correct="off"
            :disabled="isLoading"
        />
      </div>
      <Button :disabled="isLoading">
        <Loader2 v-if="isLoading" class="mr-2 h-4 w-4 animate-spin" />
        Submit
      </Button>
    </div>
  </form>
</template>

<style scoped>

</style>
