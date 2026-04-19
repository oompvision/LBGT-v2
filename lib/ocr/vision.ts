// Thin wrapper around Google Cloud Vision's REST API.
// We call it directly so we don't pull in the full @google-cloud/vision SDK
// (which expects a service account JSON file and bloats the serverless bundle).

export type Vertex = { x: number; y: number }

export type VisionWord = {
  text: string
  vertices: Vertex[]
  confidence: number
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
              symbols?: Array<{ text?: string; confidence?: number }>
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
          words.push({
            text,
            vertices: vertices.map((v) => ({ x: v.x ?? 0, y: v.y ?? 0 })),
            confidence: word.confidence ?? 0,
          })
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
