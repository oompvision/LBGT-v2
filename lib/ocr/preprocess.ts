// Minimal image preprocessing before the Gemini call.
//
// Vision LLMs like Gemini 2.5 Flash work best on the original color image —
// aggressive preprocessing (grayscale, adaptive threshold, denoise) actively
// hurt accuracy in testing because they distort character shapes the model
// was trained on.
//
// The only thing we still do is upscale tiny images so the model has enough
// pixels to read handwriting. Perspective correction is a placeholder — if
// we decide it matters later we'll add opencv-wasm or a hand-rolled 4-corner
// detector. For now it's a no-op so callers can pass it without breaking.

import sharp from "sharp"

export type PreprocessOptions = {
  perspective?: boolean // placeholder; not implemented
  upscale?: boolean
  minLongEdge?: number // px; default 1024
}

export type PreprocessResult = {
  buffer: Buffer
  steps: string[]
  mimeType: string
  width: number
  height: number
}

const DEFAULTS: Required<PreprocessOptions> = {
  perspective: false,
  upscale: true,
  minLongEdge: 1024,
}

export async function preprocessImage(
  input: Buffer,
  options: PreprocessOptions = {},
): Promise<PreprocessResult> {
  const opts = { ...DEFAULTS, ...options }
  const steps: string[] = []

  // Honor EXIF orientation so phone portraits land right-side up.
  let pipeline = sharp(input, { failOn: "none" }).rotate()

  if (opts.perspective) {
    steps.push("perspective-skipped (not implemented)")
  }

  let current = await pipeline.toBuffer()
  let meta = await sharp(current).metadata()
  let width = meta.width ?? 0
  let height = meta.height ?? 0

  if (opts.upscale && width > 0 && height > 0) {
    const longEdge = Math.max(width, height)
    if (longEdge < opts.minLongEdge) {
      const scale = opts.minLongEdge / longEdge
      const newW = Math.round(width * scale)
      const newH = Math.round(height * scale)
      current = await sharp(current)
        .resize(newW, newH, { kernel: sharp.kernel.cubic })
        .jpeg({ quality: 92 })
        .toBuffer()
      width = newW
      height = newH
      steps.push(`upscale cubic ${newW}x${newH}`)
    } else {
      steps.push(`upscale skipped (already ${longEdge}px)`)
    }
  }

  // Always JPEG so we know the mime type for the Gemini inline-data part.
  // If we didn't resize (image was already big enough), re-encode without
  // changing dimensions — keeps the downstream contract simple.
  if (!steps.some((s) => s.startsWith("upscale cubic"))) {
    current = await sharp(current).jpeg({ quality: 92 }).toBuffer()
  }

  return { buffer: current, steps, mimeType: "image/jpeg", width, height }
}
