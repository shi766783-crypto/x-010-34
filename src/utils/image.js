// 照片压缩：上传后、保存前按比例缩小过大的图片，降低 localStorage 占用。
// 压缩失败或格式不支持时退回原图，保证保存流程不中断。

const MAX_EDGE = 1280 // 压缩后最长边像素（预览区域均为缩略图，该尺寸仍清晰可辨）
const KEEP_ORIGIN_SIZE = 200 * 1024 // 体积小于该值且尺寸不大时，无需重新编码
const JPEG_QUALITY = 0.85
const SKIP_TYPES = new Set(['image/gif', 'image/svg+xml']) // 动图/矢量图不做画布压缩

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error || new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}

// 探测浏览器是否支持指定格式的画布编码
const encoderSupport = new Map()
function canEncode(type) {
  if (!encoderSupport.has(type)) {
    try {
      const canvas = document.createElement('canvas')
      encoderSupport.set(type, canvas.toDataURL(type).startsWith(`data:${type}`))
    } catch {
      encoderSupport.set(type, false)
    }
  }
  return encoderSupport.get(type)
}

// 解码图片：优先 createImageBitmap（可按 EXIF 方向自动翻转），不支持时退回 <img>
function decodeImage(file) {
  if (typeof createImageBitmap === 'function') {
    // 部分浏览器不支持 imageOrientation 参数，选项被拒时退回默认解码
    return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() =>
      createImageBitmap(file)
    )
  }
  const url = URL.createObjectURL(file)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片解码失败'))
    }
    img.src = url
  })
}

function releaseImage(image) {
  if (typeof image.close === 'function') image.close()
  else if (image && image.src?.startsWith('blob:')) URL.revokeObjectURL(image.src)
}

// 依据源类型选择编码格式，按「目标格式 -> JPEG -> WebP」顺序兜底
function resolveOutputType(sourceType) {
  const candidates = sourceType === 'image/png' ? ['image/png', 'image/jpeg'] : [sourceType, 'image/jpeg', 'image/webp']
  return candidates.find((t) => t && t !== 'image/gif' && t !== 'image/svg+xml' && canEncode(t)) || 'image/jpeg'
}

/**
 * 读取并按需压缩照片，返回可直接持久化的 data URL。
 * - 动图、SVG 等画布不适合处理的格式：返回原图
 * - 体积小且尺寸不大的图片：返回原图
 * - 压缩结果反而更大或压缩过程异常：返回原图
 * - 文件本身读取失败：返回空字符串，调用方按“未选照片”处理
 */
export async function compressImageFile(file) {
  const original = await readAsDataURL(file)

  // 非图片或不适合压缩的格式，直接使用原图
  if (!file.type || !file.type.startsWith('image/') || SKIP_TYPES.has(file.type)) {
    return original
  }

  let image
  try {
    image = await decodeImage(file)
    const { width, height } = image
    if (!width || !height) return original

    // 体积与尺寸都不大，无需重编码
    if (file.size <= KEEP_ORIGIN_SIZE && Math.max(width, height) <= MAX_EDGE) {
      return original
    }

    // 按比例缩放到最长边以内
    const scale = Math.min(1, MAX_EDGE / Math.max(width, height))
    const targetWidth = Math.max(1, Math.round(width * scale))
    const targetHeight = Math.max(1, Math.round(height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return original
    ctx.drawImage(image, 0, 0, targetWidth, targetHeight)

    const outputType = resolveOutputType(file.type)
    let compressed
    if (outputType === 'image/png') {
      compressed = canvas.toDataURL(outputType)
    } else {
      compressed = canvas.toDataURL(outputType, JPEG_QUALITY)
    }

    // 压缩没有收益（小图重编码等情况）时保留原图
    if (!compressed || compressed.length >= original.length) return original
    return compressed
  } catch (error) {
    console.warn('[image] 压缩失败，退回使用原图', error)
    return original
  } finally {
    if (image) releaseImage(image)
  }
}
