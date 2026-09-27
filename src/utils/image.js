// 图片读取与压缩：过大的图片按比例缩小后再转 DataURL，压缩失败时退回原图
const MAX_DIMENSION = 1600 // 压缩后最长边像素
const COMPRESS_THRESHOLD = 300 * 1024 // 超过 300KB 才压缩
const JPEG_QUALITY = 0.82
// 动图与矢量图经 canvas 会丢失动画/效果，直接使用原图
const SKIP_TYPES = ['image/gif', 'image/svg+xml']

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片解码失败'))
    img.src = src
  })
}

async function compress(file, dataUrl) {
  const img = await loadImage(dataUrl)
  const { naturalWidth: width, naturalHeight: height } = img
  if (!width || !height) throw new Error('图片尺寸无效')
  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
  // PNG 保留原格式以维持透明背景，其余统一转 JPEG
  const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
  const result = canvas.toDataURL(type, JPEG_QUALITY)
  // 压缩结果无效或反而更大时保留原图
  return result.startsWith('data:image') && result.length < dataUrl.length ? result : dataUrl
}

// 读取图片文件为 DataURL：大图自动压缩，压缩失败或格式不支持时退回原图
export async function fileToDataUrl(file) {
  const dataUrl = await readAsDataURL(file)
  const type = file.type || ''
  if (!type.startsWith('image/') || SKIP_TYPES.includes(type) || file.size <= COMPRESS_THRESHOLD) {
    return dataUrl
  }
  try {
    return await compress(file, dataUrl)
  } catch (error) {
    console.warn('[image] 压缩失败，使用原图', error)
    return dataUrl
  }
}
