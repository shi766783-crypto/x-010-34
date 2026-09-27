<script setup>
import { ref } from 'vue'
import { compressImageFile } from '../../utils/image'

const props = defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue'])
const inputRef = ref(null)
const processing = ref(false)

async function onChange(event) {
  const file = event.target.files[0]
  event.target.value = ''
  if (!file || processing.value) return

  processing.value = true
  try {
    // 压缩在保存前完成；压缩失败/格式不支持时内部已退回原图
    const dataUrl = await compressImageFile(file)
    if (dataUrl) emit('update:modelValue', dataUrl)
  } catch (error) {
    // 兜底：即使读取本身失败也不阻断后续流程
    console.warn('[ImageUpload] 照片处理失败，已跳过该照片', error)
  } finally {
    processing.value = false
  }
}

function clear() {
  emit('update:modelValue', '')
}
</script>

<template>
  <div class="image-upload">
    <span v-if="label" class="form-label">{{ label }}</span>
    <div v-if="modelValue" class="preview">
      <img :src="modelValue" alt="预览图" />
      <button type="button" class="remove" title="移除照片" @click="clear">×</button>
    </div>
    <button
      v-else
      type="button"
      class="btn btn-ghost btn-sm"
      :disabled="processing"
      @click="inputRef.click()"
    >
      {{ processing ? '处理中…' : '上传照片' }}
    </button>
    <input ref="inputRef" type="file" accept="image/*" hidden @change="onChange" />
  </div>
</template>

<style scoped>
.preview {
  position: relative;
  width: 120px;
  height: 90px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid var(--border);
}

.preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.remove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  line-height: 1;
  font-size: 16px;
}
</style>
