<script setup lang="ts">
import {Copy, Loader} from "lucide-vue-next";
import {requestInviteLink} from "~/services/auth";
import {toast} from "vue-sonner";

const loading = ref(true);
const data = ref(null);
const props = defineProps(['organisation']);

onMounted(async () => {
  loading.value = true;
  try {
    data.value = await requestInviteLink(props.organisation);

    loading.value = false;
  } catch(e) {
    console.log(e);
    toast.error("Failed to create link!");
  }
});

async function setClipboard(text) {
  const type = "text/plain";
  const clipboardItemData = {
    [type]: text,
  };
  const clipboardItem = new ClipboardItem(clipboardItemData);
  await navigator.clipboard.write([clipboardItem]).then(() => {
    toast.success("Link copied to clipboard!");
  });
}

</script>

<template>
  <div v-if="loading" class="flex flex-col w-full p-5 items-center justify-center">
    <Loader class="animate-spin text-primary" />
  </div>

  <div v-else class="flex flex-col gap-3">
    <div class="border rounded-lg p-2 flex items-center flex-row gap-2">
      <div class="overflow-hidden w-full px-2">
        <span class="text-primary whitespace-nowrap font-semibold underline">{{ data.link }}</span>
      </div>

      <Button @click="setClipboard(data.link)" class="bg-tertiary hover:bg-tertiary/90">
        <Copy />
        Copy
      </Button>
    </div>

<!--    <div class="flex flex-col tablet:flex-row w-full gap-3 justify-between">-->
<!--      <div class="flex flex-col">-->
<!--        <div class="flex flex-row gap-1 items-center">-->
<!--          <span class="font-semibold">Link Permissions</span>-->
<!--        </div>-->
<!--        <span class="text-sm text-muted-foreground">The join link will grant all sign ups with the following privileges</span>-->
<!--      </div>-->

<!--      <Select>-->
<!--        <SelectTrigger>-->
<!--          <SelectValue placeholder="Choose Permission" />-->
<!--        </SelectTrigger>-->
<!--        <SelectContent>-->
<!--          <SelectGroup>-->
<!--            <SelectLabel>Permissions</SelectLabel>-->
<!--            <SelectItem value="admin">-->
<!--              Admin-->
<!--            </SelectItem>-->
<!--            <SelectItem value="member">-->
<!--              Member-->
<!--            </SelectItem>-->
<!--            <SelectItem value="guest">-->
<!--              Guest-->
<!--            </SelectItem>-->
<!--          </SelectGroup>-->
<!--        </SelectContent>-->
<!--      </Select>-->
<!--    </div>-->
  </div>
</template>

<style scoped>

</style>