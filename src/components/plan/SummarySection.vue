<script setup>
import { reactive, ref } from 'vue'
import { useTravelStore } from '../../stores/travel'
import { compressImageFile } from '../../utils/image'
import StarRating from '../common/StarRating.vue'

const props = defineProps({
  plan: { type: Object, required: true },
})

const store = useTravelStore()

const form = reactive({
  rating: props.plan.summary?.rating || 0,
  highlights: props.plan.summary?.highlights || '',
  regrets: props.plan.summary?.regrets || '',
  suggestions: props.plan.summary?.suggestions || '',
  photos: [...(props.plan.summary?.photos || [])],
})

const fileInput = ref(null)
const saved = ref(false)
const photoProcessing = ref(false)

async function onPhoto(event) {
  const file = event.target.files[0]
  event.target.value = ''
  if (!file || photoProcessing.value) return

  photoProcessing.value = true
  try {
    // 压缩在保存前完成；压缩失败/格式不支持时内部已退回原图
    const dataUrl = await compressImageFile(file)
    if (dataUrl) form.photos.push(dataUrl)
  } catch (error) {
    // 兜底：即使读取本身失败也不阻断总结保存流程
    console.warn('[SummarySection] 照片处理失败，已跳过该照片', error)
  } finally {
    photoProcessing.value = false
  }
}

function removePhoto(index) {
  form.photos.splice(index, 1)
}

function save() {
  if (!form.rating) {
    saved.value = false
    return
  }
  store.saveSummary(props.plan.id, {
    rating: form.rating,
    highlights: form.highlights,
    regrets: form.regrets,
    suggestions: form.suggestions,
    photos: [...form.photos],
  })
  saved.value = true
  setTimeout(() => (saved.value = false), 2000)
}
</script>

<template>
  <div class="summary">
    <div class="form-group">
      <label class="form-label">总体评分</label>
      <StarRating v-model="form.rating" size="28px" />
    </div>

    <div class="form-group">
      <label class="form-label">亮点</label>
      <textarea v-model="form.highlights" class="textarea" placeholder="这次出行最难忘、最满意的地方"></textarea>
    </div>

    <div class="form-group">
      <label class="form-label">遗憾</label>
      <textarea v-model="form.regrets" class="textarea" placeholder="未能完成或留下遗憾的地方"></textarea>
    </div>

    <div class="form-group">
      <label class="form-label">建议</label>
      <textarea v-model="form.suggestions" class="textarea" placeholder="给下次出行的建议"></textarea>
    </div>

    <div class="form-group">
      <label class="form-label">精选照片</label>
      <div class="photo-grid">
        <div v-for="(photo, i) in form.photos" :key="i" class="photo">
          <img :src="photo" alt="精选照片" />
          <button type="button" class="photo-remove" @click="removePhoto(i)">×</button>
        </div>
        <button
          type="button"
          class="photo-add"
          :disabled="photoProcessing"
          :title="photoProcessing ? '照片处理中…' : ''"
          @click="fileInput.click()"
        >{{ photoProcessing ? '…' : '+' }}</button>
      </div>
      <input ref="fileInput" type="file" accept="image/*" hidden @change="onPhoto" />
    </div>

    <div class="flex gap-8">
      <button type="button" class="btn btn-primary" @click="save">保存总结</button>
      <span v-if="saved" class="text-success">已保存</span>
      <span v-if="!form.rating" class="text-warning">请先选择评分</span>
    </div>
  </div>
</template>

<style scoped>
.photo-grid {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.photo {
  position: relative;
  width: 100px;
  height: 76px;
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  line-height: 1;
}

.photo-add {
  width: 100px;
  height: 76px;
  border: 2px dashed var(--border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  font-size: 24px;
}

.photo-add:hover {
  border-color: var(--primary);
  color: var(--primary);
}
</style>
