"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Message {
  id: string
  title: string
  content: string
  type: "info" | "warning" | "error"
  is_active: boolean
}

export function MessageBox() {
  const [messages, setMessages] = useState<Message[]>([])
  const [dismissedMessages, setDismissedMessages] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        setIsLoading(true)
        setFetchError(null)

        const supabase = createClient()

        if (!supabase) {
          setFetchError("Failed to create Supabase client.")
          return
        }

        // Add a try-catch specifically around the database query
        let data, error
        try {
          const result = await supabase
            .from("site_messages")
            .select("id, title, content, type, is_active")
            .eq("is_active", true)
            .order("created_at", { ascending: false })

          data = result.data
          error = result.error
        } catch (fetchError) {
          console.error("Database fetch error:", fetchError)
          // If there's a fetch error, just return empty messages instead of showing error
          setMessages([])
          return
        }

        if (error) {
          console.error("Error fetching messages:", error)
          // Don't show error to user for message fetching, just log it
          setMessages([])
          return
        }

        setMessages(data || [])
      } catch (error: any) {
        console.error("Error fetching messages:", error)
        // Don't show error to user for message fetching, just set empty messages
        setMessages([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchMessages()
  }, [])

  const dismissMessage = (messageId: string) => {
    setDismissedMessages((prev) => [...prev, messageId])
  }

  const visibleMessages = messages.filter((message) => !dismissedMessages.includes(message.id))

  if (isLoading) {
    return <div className="p-4 text-center">Loading messages...</div>
  }

  if (fetchError) {
    return <div className="p-4 text-center text-red-500">Error: {fetchError}</div>
  }

  if (visibleMessages.length === 0) {
    return null
  }

  // Function to format message content with proper line breaks
  const formatContent = (content: string) => {
    return content.split("\n").map((line, i) => (
      <span key={i}>
        {line}
        {i < content.split("\n").length - 1 && <br />}
      </span>
    ))
  }

  return (
    <div className="space-y-2 p-4">
      {visibleMessages.map((message) => (
        <Alert key={message.id} variant={message.type === "error" ? "destructive" : "default"}>
          <div className="flex items-start justify-between">
            <div className="flex-1 text-center">
              <h4 className="font-medium">{message.title}</h4>
              <AlertDescription className="mt-1 whitespace-pre-wrap">{formatContent(message.content)}</AlertDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => dismissMessage(message.id)} className="ml-2 h-6 w-6 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </Alert>
      ))}
    </div>
  )
}
