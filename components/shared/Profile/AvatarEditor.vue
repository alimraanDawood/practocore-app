<script setup lang="ts">
import { ref, computed } from 'vue';
import { Cropper } from 'vue-advanced-cropper';
import 'vue-advanced-cropper/dist/style.css';
import { getSignedInUser, updateUser, pocketbase, SERVER_URL } from "~/services/auth";
import { toast } from 'vue-sonner';

const fileInput = ref<HTMLInputElement | null>(null);
const selectedImage = ref<string | null>(null);
const cropper = ref<any>(null);
const isUploading = ref(false);
const showCropper = ref(false);
const user = computed(() => getSignedInUser());
const open = ref<boolean>(false);

const userInitials = computed(() => {
  const name = user.value?.name || '';
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] || '').toUpperCase() + (parts[1][0] || '').toUpperCase();
  }
  return (parts[0]?.[0] || '').toUpperCase();
});

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  if (file) {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      selectedImage.value = e.target?.result as string;
      showCropper.value = true;
    };
    reader.readAsDataURL(file);
  }
};

const triggerFileInput = () => {
  fileInput.value?.click();
};

const cancelCrop = () => {
  selectedImage.value = null;
  showCropper.value = false;
  if (fileInput.value) {
    fileInput.value.value = '';
  }
};

const uploadAvatar = async () => {
  if (!cropper.value) return;

  isUploading.value = true;

  try {
    const { canvas } = cropper.value.getResult();

    if (!canvas) {
      throw new Error('Failed to get cropped image');
    }

    // Convert canvas to blob
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob: Blob | null) => {
        if (blob) resolve(blob);
      }, 'image/jpeg', 0.9);
    });

    // Create FormData and upload to Avatars collection
    const formData = new FormData();
    formData.append('field', blob, 'avatar.jpg');

    const avatarRecord = await pocketbase.collection('Avatars').create(formData);

    // Generate the file URL
    const fileUrl = `${SERVER_URL}/api/files/Avatars/${avatarRecord.id}/${avatarRecord.field}`;

    // Update user's avatar field
    await updateUser({ avatar: fileUrl });

    toast.success('Profile photo updated successfully');

    // Reset state
    cancelCrop();
    open.value = false;
  } catch (error) {
    console.error('Error uploading avatar:', error);
    toast.error('Failed to upload profile photo');
  } finally {
    isUploading.value = false;
  }
};

const clearAvatar = async () => {
  isUploading.value = true;

  try {
    await updateUser({ avatar: '' });
    toast.success('Profile photo cleared successfully');
    open.value = false;
  } catch (error) {
    console.error('Error clearing avatar:', error);
    toast.error('Failed to clear profile photo');
  } finally {
    isUploading.value = false;
  }
};
</script>

<template>
  <Dialog v-model:open="open" v-if="$viewport.isGreaterOrEquals('customxs')">
    <DialogTrigger>
      <Avatar class="size-16">
        <AvatarImage :src="user?.avatar" alt="Profile photo"/>
        <AvatarFallback class="bg-primary text-primary-foreground">
          {{ userInitials }}
        </AvatarFallback>
      </Avatar>
    </DialogTrigger>

    <DialogContent>
      <DialogHeader>
        <DialogTitle>Update Profile Photo</DialogTitle>
        <DialogDescription>Use this tool to change your profile photo visible to all your team members.</DialogDescription>
      </DialogHeader>

      <div v-if="!showCropper" class="flex flex-col p-3 gap-2">
        <input
            ref="fileInput"
            type="file"
            accept="image/*"
            class="hidden"
            @change="handleFileSelect"
        />
        <Button @click="triggerFileInput" :disabled="isUploading">
          Change Profile Photo
        </Button>
        <Button
            variant="outline"
            @click="clearAvatar"
            :disabled="isUploading || !user?.avatar"
        >
          Clear Profile Photo
        </Button>
      </div>

      <div v-else class="flex flex-col p-3 gap-3 overflow-hidden">
        <div class="w-full h-[400px] bg-muted rounded-lg overflow-hidden">
          <Cropper
              ref="cropper"
              :src="selectedImage"
              :stencil-props="{
              aspectRatio: 1,
            }"
              class="h-full w-full"
          />
        </div>

        <div class="flex gap-2">
          <Button
              @click="uploadAvatar"
              :disabled="isUploading"
              class="flex-1"
          >
            {{ isUploading ? 'Uploading...' : 'Save Photo' }}
          </Button>
          <Button
              variant="outline"
              @click="cancelCrop"
              :disabled="isUploading"
              class="flex-1"
          >
            Cancel
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>

  <Drawer :dismissible="false"  v-model:open="open" v-else>
    <DrawerTrigger>
      <Avatar class="size-24">
        <AvatarImage :src="user?.avatar" alt="Profile photo"/>
        <AvatarFallback class="text-xl bg-primary text-primary-foreground">
          {{ userInitials }}
        </AvatarFallback>
      </Avatar>
    </DrawerTrigger>

    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>Update Profile Photo</DrawerTitle>
        <DrawerDescription>Use this tool to change your profile photo visible to all your team members.</DrawerDescription>
      </DrawerHeader>

      <div v-if="!showCropper" class="flex flex-col p-3 gap-2">
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          class="hidden"
          @change="handleFileSelect"
        />
        <Button @click="triggerFileInput" :disabled="isUploading">
          Change Profile Photo
        </Button>
        <Button
          variant="destructive"
          @click="clearAvatar"
          :disabled="isUploading || !user?.avatar"
        >
          Clear Profile Photo
        </Button>
        <DrawerClose class="w-full">
          <Button class="w-full" variant="secondary">Close</Button>
        </DrawerClose>
      </div>

      <div v-else class="flex flex-col p-3 gap-3">
        <div class="w-full aspect-square bg-muted rounded-lg overflow-hidden">
          <Cropper
            ref="cropper"
            :src="selectedImage"
            :stencil-props="{
              aspectRatio: 1,
            }"
            class="h-full w-full"
          />
        </div>

        <div class="flex gap-2">
          <Button
            @click="uploadAvatar"
            :disabled="isUploading"
            class="flex-1"
          >
            {{ isUploading ? 'Uploading...' : 'Save Photo' }}
          </Button>
          <Button
            variant="outline"
            @click="cancelCrop"
            :disabled="isUploading"
            class="flex-1"
          >
            Cancel
          </Button>
        </div>
      </div>
    </DrawerContent>
  </Drawer>
</template>

<style scoped>

</style>