<template>
  <div class="border border-border bg-accent rounded-lg overflow-hidden bg-background text-foreground">
    <div v-if="editor" class="flex flex-wrap gap-1 p-3 border-b">
      <div class="flex gap-1">
        <Button
            @click="editor.chain().focus().toggleBold().run()"
            :disabled="!editor.can().chain().focus().toggleBold().run()"
            :variant="editor.isActive('bold') ? 'default' : 'ghost'"
            size="icon"
        >
          <Bold :size="16" />
        </Button>
        <Button
            @click="editor.chain().focus().toggleItalic().run()"
            :disabled="!editor.can().chain().focus().toggleItalic().run()"
            :variant="editor.isActive('italic') ? 'default' : 'ghost'"
            size="icon"
        >
          <Italic :size="16" />
        </Button>
        <Button
            @click="editor.chain().focus().toggleUnderline().run()"
            :disabled="!editor.can().chain().focus().toggleUnderline().run()"
            :variant="editor.isActive('underline') ? 'default' : 'ghost'"
            size="icon"
        >
          <UnderlineIcon :size="16" />
        </Button>
        <Button
            @click="editor.chain().focus().toggleStrike().run()"
            :disabled="!editor.can().chain().focus().toggleStrike().run()"
            :variant="editor.isActive('strike') ? 'default' : 'ghost'"
            size="icon"
        >
          <Strikethrough :size="16" />
        </Button>
        <Button
            @click="editor.chain().focus().toggleCode().run()"
            :disabled="!editor.can().chain().focus().toggleCode().run()"
            :variant="editor.isActive('code') ? 'default' : 'ghost'"
            size="icon"
        >
          <Code :size="16" />
        </Button>
      </div>

      <div class="flex gap-1">
        <Button
            @click="editor.chain().focus().toggleHeading({ level: 1 }).run()"
            :variant="editor.isActive('heading', { level: 1 }) ? 'default' : 'ghost'"
            size="icon"
        >
          <Heading1 :size="16" />
        </Button>
        <Button
            @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
            :variant="editor.isActive('heading', { level: 2 }) ? 'default' : 'ghost'"
            size="icon"
        >
          <Heading2 :size="16" />
        </Button>
        <Button
            @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
            :variant="editor.isActive('heading', { level: 3 }) ? 'default' : 'ghost'"
            size="icon"
        >
          <Heading3 :size="16" />
        </Button>
        <Button
            @click="editor.chain().focus().setParagraph().run()"
            :variant="editor.isActive('paragraph') ? 'default' : 'ghost'"
            size="icon"
        >
          <Pilcrow :size="16" />
        </Button>
      </div>

      <div class="flex gap-1">
        <Button
            @click="editor.chain().focus().toggleBulletList().run()"
            :variant="editor.isActive('bulletList') ? 'default' : 'ghost'"
            size="icon"
        >
          <List :size="16" />
        </Button>
        <Button
            @click="editor.chain().focus().toggleOrderedList().run()"
            :variant="editor.isActive('orderedList') ? 'default' : 'ghost'"
            size="icon"
        >
          <ListOrdered :size="16" />
        </Button>
        <Button
            @click="editor.chain().focus().toggleCodeBlock().run()"
            :variant="editor.isActive('codeBlock') ? 'default' : 'ghost'"
            size="icon"
        >
          <FileCode :size="16" />
        </Button>
        <Button
            @click="editor.chain().focus().toggleBlockquote().run()"
            :variant="editor.isActive('blockquote') ? 'default' : 'ghost'"
            size="icon"
        >
          <Quote :size="16" />
        </Button>
      </div>

      <div class="hidden  gap-1">
        <Button
            @click="editor.chain().focus().setTextAlign('left').run()"
            :variant="editor.isActive({ textAlign: 'left' }) ? 'default' : 'ghost'"
            size="icon"
        >
          <AlignLeft :size="16" />
        </Button>
        <Button
            @click="editor.chain().focus().setTextAlign('center').run()"
            :variant="editor.isActive({ textAlign: 'center' }) ? 'default' : 'ghost'"
            size="icon"
        >
          <AlignCenter :size="16" />
        </Button>
        <Button
            @click="editor.chain().focus().setTextAlign('right').run()"
            :variant="editor.isActive({ textAlign: 'right' }) ? 'default' : 'ghost'"
            size="icon"
        >
          <AlignRight :size="16" />
        </Button>
        <Button
            @click="editor.chain().focus().setTextAlign('justify').run()"
            :variant="editor.isActive({ textAlign: 'justify' }) ? 'default' : 'ghost'"
            size="icon"
        >
          <AlignJustify :size="16" />
        </Button>
      </div>

      <div class="flex gap-1">
        <Button
            @click="editor.chain().focus().setHorizontalRule().run()"
            variant="ghost"
            size="icon"
        >
          <Minus :size="16" />
        </Button>
        <Button
            @click="editor.chain().focus().setHardBreak().run()"
            variant="ghost"
            size="icon"
        >
          <WrapText :size="16" />
        </Button>
      </div>

      <div class="flex gap-1">
        <Button
            @click="editor.chain().focus().undo().run()"
            :disabled="!editor.can().chain().focus().undo().run()"
            variant="ghost"
            size="icon"
        >
          <Undo :size="16" />
        </Button>
        <Button
            @click="editor.chain().focus().redo().run()"
            :disabled="!editor.can().chain().focus().redo().run()"
            variant="ghost"
            size="icon"
        >
          <Redo :size="16" />
        </Button>
      </div>

      <div class="flex gap-1">
        <Button
            @click="editor.chain().focus().unsetAllMarks().run()"
            variant="ghost"
            size="icon"
        >
          <RemoveFormatting :size="16" />
        </Button>
      </div>
    </div>

    <TiptapEditorContent :editor="editor" class="prose prose-pink dark:prose-invert prose-sm max-w-none p-4 min-h-[300px] bg-muted focus:outline-none" />
  </div>
</template>

<script setup>
import { useEditor, EditorContent as TiptapEditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  List,
  ListOrdered,
  FileCode,
  Quote,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Minus,
  WrapText,
  Undo,
  Redo,
  RemoveFormatting,
} from 'lucide-vue-next';

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['update:modelValue']);

const editor = useEditor({
  content: props.modelValue,
  extensions: [
    StarterKit,
    Underline,
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),
  ],
  onUpdate: ({ editor }) => {
    emit('update:modelValue', editor.getHTML());
  },
});

// Watch for external changes to modelValue
watch(
    () => props.modelValue,
    (newValue) => {
      const isSame = editor.value.getHTML() === newValue;
      if (!isSame) {
        editor.value.commands.setContent(newValue, false);
      }
    }
);

onBeforeUnmount(() => {
  editor.value?.destroy();
});
</script>

<style scoped>
:deep(.ProseMirror) {
  outline: none;
}

:deep(.ProseMirror p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  color: #adb5bd;
  pointer-events: none;
  height: 0;
}
</style>