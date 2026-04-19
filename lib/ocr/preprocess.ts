// Server-side scorecard image preprocessing pipeline, built on sharp.
// Mirrors the common cv2/PIL preprocessing recipe that tends to improve
// document-text OCR accuracy: grayscale → upscale → denoise → adaptive threshold.
//
// Every step is individually toggleable so we can A/B test which stages
// actually help on real scorecards.

import sharp from "sharp"

export type PreprocessOptions = {
  grayscale?: boolean
  // 4-point perspective warp to flatten the card. Not implemented yet;
  // placeholder so callers can pass it without breaking when we add it.
  perspective?: boolean
  upscale?: boolean
  minLongEdge?: number // px; default 2000
  denoise?: boolean
  threshold?: boolean
}

export type PreprocessResult = {
  buffer: Buffer
  /** Ordered list of steps actually applied, for debug/logging. */
  steps: string[]
  width: number
  height: number
}

const DEFAULTS: Required<PreprocessOptions> = {
  grayscale: true,
  perspective: false,
  upscale: true,
  minLongEdge: 2000,
  denoise: true,
  threshold: true,
}

export async function preprocessImage(
  input: Buffer,
  options: PreprocessOptions = {},
): Promise<PreprocessResult> {
  const opts = { ...DEFAULTS, ...options }
  const steps: string[] = []

  let pipeline = sharp(input, { failOn: "none" }).rotate() // honor EXIF orientation

  // 1. Grayscale.
  if (opts.grayscale) {
    pipeline = pipeline.greyscale()
    steps.push("grayscale")
  }

  // 2. Perspective transform — intentionally deferred. Detecting the card's
  // 4 corners robustly in pure sharp is non-trivial; if we decide this matters,
  // we'll add @techstark/opencv-js (WASM) or a manual contour finder. For now
  // this path is a no-op that's still exposed so we can wire it in cleanly later.
  if (opts.perspective) {
    steps.push("perspective-skipped (not implemented)")
  }

  // Freeze pipeline to a buffer so we can read metadata and chain further
  // passes (e.g. denoise → threshold) on known raw pixels.
  let current = await pipeline.png().toBuffer()
  let meta = await sharp(current).metadata()
  let width = meta.width ?? 0
  let height = meta.height ?? 0

  // 3. Upscale so the long edge is at least minLongEdge.
  if (opts.upscale && width > 0 && height > 0) {
    const longEdge = Math.max(width, height)
    if (longEdge < opts.minLongEdge) {
      const scale = opts.minLongEdge / longEdge
      const newW = Math.round(width * scale)
      const newH = Math.round(height * scale)
      current = await sharp(current)
        .resize(newW, newH, { kernel: sharp.kernel.cubic })
        .png()
        .toBuffer()
      width = newW
      height = newH
      steps.push(`upscale cubic ${newW}x${newH}`)
    } else {
      steps.push(`upscale skipped (already ${longEdge}px)`)
    }
  }

  // 4. Light denoise: median filter over a 3x3 neighborhood. Close analog to
  // cv2.fastNlMeansDenoising for printed scorecards at this resolution — kills
  // salt-and-pepper noise without blurring character strokes.
  if (opts.denoise) {
    current = await sharp(current).median(3).png().toBuffer()
    steps.push("denoise median(3)")
  }

  // 5. Adaptive Gaussian threshold. Sharp doesn't ship this, so we compute it
  // manually: each output pixel = 255 if original > local-Gaussian-mean - C,
  // else 0. Handles uneven lighting (e.g. fold shadows) far better than a flat
  // global threshold because the cutoff adapts region by region.
  if (opts.threshold) {
    current = await adaptiveGaussianThreshold(current, {
      blockSigma: 15, // σ for the local-mean Gaussian blur
      C: 10, // constant subtracted from the local mean
    })
    steps.push("adaptive Gaussian threshold")
  }

  return { buffer: current, steps, width, height }
}

async function adaptiveGaussianThreshold(
  pngBuffer: Buffer,
  opts: { blockSigma: number; C: number },
): Promise<Buffer> {
  // Work in single-channel grayscale to keep the math cheap. If the source
  // isn't already grayscale (e.g. caller disabled step 1) we'll convert here.
  const { data, info } = await sharp(pngBuffer)
    .greyscale()
    .toColourspace("b-w")
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height, channels } = info
  if (channels !== 1) {
    // Shouldn't happen after toColourspace("b-w"), but guard anyway.
    return pngBuffer
  }

  // Local mean = Gaussian blur of the grayscale image.
  const blurred = await sharp(pngBuffer)
    .greyscale()
    .toColourspace("b-w")
    .blur(opts.blockSigma)
    .raw()
    .toBuffer()

  const out = Buffer.alloc(data.length)
  for (let i = 0; i < data.length; i++) {
    const threshold = blurred[i] - opts.C
    out[i] = data[i] > threshold ? 255 : 0
  }

  return sharp(out, { raw: { width, height, channels: 1 } }).png().toBuffer()
}
