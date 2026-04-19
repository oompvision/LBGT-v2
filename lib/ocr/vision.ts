// Thin wrapper around Google Cloud Vision's REST API.
// We call it directly so we don't pull in the full @google-cloud/vision SDK
// (which expects a service account JSON file and bloats the serverless bundle).

export type Vertex = { x: number; y: number }

export type VisionWord = {
  text: string
  vertices: Vertex[]
  confidence: number
  // True when this token was synthesized by splitting a multi-digit word
  // into its constituent digit characters (e.g. Vision returned "57" and
  // we emitted "5" and "7"). Single-hole score columns use these splits;
  // Out/In/Total columns should stick to the original unsplit word.
  split?: boolean
}

export type VisionResponse = {
  words: VisionWord[]
  fullText: string
}

// Minimal shape of the Vision API response we care about.
// Full schema: https://cloud.google.com/vision/docs/reference/rest/v1/images/annotate
type RawVisionResponse = {
  responses: Array<{
    fullTextAnnotation?: {
      text?: string
      pages?: Array<{
        blocks?: Array<{
          paragraphs?: Array<{
            words?: Array<{
              symbols?: Array<{
                text?: string
                confidence?: number
                boundingBox?: { vertices?: Vertex[] }
              }>
              confidence?: number
              boundingBox?: { vertices?: Vertex[] }
            }>
          }>
        }>
      }>
    }
    error?: { message?: string }
  }>
}

export async function detectDocumentText(
  imageBase64: string,
  apiKey: string,
): Promise<VisionResponse> {
  const url = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`
  const body = {
    requests: [
      {
        image: { content: imageBase64 },
        features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
      },
    ],
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`Vision API error (${res.status}): ${errBody}`)
  }

  const json = (await res.json()) as RawVisionResponse
  const response = json.responses?.[0]

  if (response?.error?.message) {
    throw new Error(`Vision API error: ${response.error.message}`)
  }

  return flattenWords(response)
}

export function flattenWords(
  response: RawVisionResponse["responses"][number] | undefined,
): VisionResponse {
  const words: VisionWord[] = []
  const fullText = response?.fullTextAnnotation?.text ?? ""

  for (const page of response?.fullTextAnnotation?.pages ?? []) {
    for (const block of page.blocks ?? []) {
      for (const paragraph of block.paragraphs ?? []) {
        for (const word of paragraph.words ?? []) {
          const text = (word.symbols ?? []).map((s) => s.text ?? "").join("")
          const vertices = word.boundingBox?.vertices ?? []
          if (!text || vertices.length < 4) continue

          // Vision's handwriting OCR tends to merge adjacent digits into one
          // word (e.g. "57" for scores "5" and "7" written side-by-side in
          // two hole cells). If every character is a digit, emit one
          // VisionWord per digit so the parser sees each in its own hole
          // column. Prefer per-symbol bounding boxes when available, else
          // fall back to splitting the word's box evenly across characters.
          const symbols = word.symbols ?? []
          const allDigits = text.length > 1 && /^\d+$/.test(text)
          // Always keep the original word. For all-digit words we ALSO emit
          // split per-character tokens so single-hole score columns can
          // pick them up individually.
          words.push({
            text,
            vertices: vertices.map((v) => ({ x: v.x ?? 0, y: v.y ?? 0 })),
            confidence: word.confidence ?? 0,
          })

          if (!allDigits) continue

          const haveSymbolBoxes = symbols.every(
            (s) => (s.boundingBox?.vertices?.length ?? 0) >= 4,
          )
          if (haveSymbolBoxes && symbols.length === text.length) {
            for (const s of symbols) {
              const sv = s.boundingBox!.vertices!
              words.push({
                text: s.text ?? "",
                vertices: sv.map((v) => ({ x: v.x ?? 0, y: v.y ?? 0 })),
                confidence: s.confidence ?? word.confidence ?? 0,
                split: true,
              })
            }
            continue
          }

          // Fallback: evenly distribute characters across the word's box.
          const xs = vertices.map((v) => v.x ?? 0)
          const ys = vertices.map((v) => v.y ?? 0)
          const left = Math.min(...xs)
          const right = Math.max(...xs)
          const top = Math.min(...ys)
          const bottom = Math.max(...ys)
          const charWidth = (right - left) / text.length
          for (let i = 0; i < text.length; i++) {
            const cLeft = left + charWidth * i
            const cRight = left + charWidth * (i + 1)
            words.push({
              text: text[i],
              vertices: [
                { x: cLeft, y: top },
                { x: cRight, y: top },
                { x: cRight, y: bottom },
                { x: cLeft, y: bottom },
              ],
              confidence: word.confidence ?? 0,
              split: true,
            })
          }
        }
      }
    }
  }

  return { words, fullText }
}

export function wordCenter(word: VisionWord): Vertex {
  const xs = word.vertices.map((v) => v.x)
  const ys = word.vertices.map((v) => v.y)
  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  }
}
