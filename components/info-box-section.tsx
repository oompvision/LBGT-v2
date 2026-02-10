"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getActiveInfoBoxes } from "@/app/actions/info-boxes"
import type { InfoBox } from "@/types/supabase"
import ReactMarkdown from "react-markdown"

export function InfoBoxSection() {
  const [infoBoxes, setInfoBoxes] = useState<InfoBox[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBoxes = async () => {
      const result = await getActiveInfoBoxes()
      if (result.success) {
        setInfoBoxes(result.infoBoxes)
      }
      setLoading(false)
    }
    fetchBoxes()
  }, [])

  if (loading || infoBoxes.length === 0) return null

  // Determine grid columns based on number of boxes
  const gridCols =
    infoBoxes.length === 1
      ? "md:grid-cols-1"
      : infoBoxes.length === 2
        ? "md:grid-cols-2"
        : "md:grid-cols-3"

  return (
    <section className="py-16 bg-muted/50">
      <div className="container max-w-5xl">
        <div className={`grid gap-8 ${gridCols}`}>
          {infoBoxes.map((box) => (
            <Card key={box.id}>
              <CardHeader>
                <CardTitle className="text-2xl">{box.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none text-muted-foreground [&_p]:text-base [&_strong]:text-foreground [&_a]:text-primary">
                  <ReactMarkdown>{box.content}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
