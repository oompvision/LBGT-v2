"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/use-toast"
import { Loader2, PlusCircle, Trash2 } from "lucide-react"
import { createMessage, updateMessage, deleteMessage } from "@/app/actions/admin-messages"

interface Message {
  id: string
  content: string
  created_at: string
  is_active: boolean
}

export function MessageManager() {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [newMessage, setNewMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function fetchMessages() {
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from("site_messages")
          .select("*")
          .order("created_at", { ascending: false })

        if (error) {
          console.error("Error fetching messages:", error)
          toast({
            title: "Error",
            description: "Failed to load messages. Please try again.",
            variant: "destructive",
          })
          return
        }

        setMessages(data || [])
      } catch (error) {
        console.error("Error in fetchMessages:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchMessages()

    // Set up real-time subscription for message updates
    const channel = supabase
      .channel("site_messages_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "site_messages",
        },
        (payload) => {
          fetchMessages()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  const handleCreateMessage = async () => {
    if (!newMessage.trim()) {
      toast({
        title: "Error",
        description: "Message content cannot be empty",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSubmitting(true)
      const result = await createMessage(newMessage)

      if (result.success) {
        setNewMessage("")
        toast({
          title: "Success",
          description: "Message created successfully",
        })
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to create message",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error creating message:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const result = await updateMessage(id, { is_active: !currentStatus })

      if (!result.success) {
        toast({
          title: "Error",
          description: result.error || "Failed to update message",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error toggling message status:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    }
  }

  const handleDeleteMessage = async (id: string) => {
    if (!confirm("Are you sure you want to delete this message?")) {
      return
    }

    try {
      const result = await deleteMessage(id)

      if (result.success) {
        toast({
          title: "Success",
          description: "Message deleted successfully",
        })
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to delete message",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error deleting message:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create New Message</CardTitle>
          <CardDescription>
            Create a new site-wide announcement. Only one message can be active at a time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Enter your message here..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="min-h-[100px]"
          />
        </CardContent>
        <CardFooter>
          <Button onClick={handleCreateMessage} disabled={isSubmitting || !newMessage.trim()}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...
              </>
            ) : (
              <>
                <PlusCircle className="mr-2 h-4 w-4" /> Create Message
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Existing Messages</h2>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-lbgt-medium" />
          </div>
        ) : messages.length === 0 ? (
          <p className="py-4 text-center text-muted-foreground">No messages found. Create one above.</p>
        ) : (
          messages.map((message) => (
            <Card key={message.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">
                  {new Date(message.created_at).toLocaleDateString()} at{" "}
                  {new Date(message.created_at).toLocaleTimeString()}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{message.content}</p>
                <div className="mt-4 flex items-center space-x-2">
                  <Switch
                    id={`active-${message.id}`}
                    checked={message.is_active}
                    onCheckedChange={() => handleToggleActive(message.id, message.is_active)}
                  />
                  <Label htmlFor={`active-${message.id}`}>{message.is_active ? "Active" : "Inactive"}</Label>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="destructive" size="sm" onClick={() => handleDeleteMessage(message.id)}>
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </Button>
              </CardFooter>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
