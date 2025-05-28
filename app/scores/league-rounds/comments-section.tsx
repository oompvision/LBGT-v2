"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { MessageCircle, Send, Trash2, User } from "lucide-react"
import { format } from "date-fns"
import { addComment, getComments, deleteComment } from "../../actions/comments"
import { createClient } from "@/lib/supabase/client"

interface Comment {
  id: string
  comment: string
  created_at: string
  users: {
    name: string
  } | null
}

export function CommentsSection() {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Get current user
  useEffect(() => {
    const getCurrentUser = async () => {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      setCurrentUserId(session?.user?.id || null)
    }
    getCurrentUser()
  }, [])

  // Load comments
  useEffect(() => {
    const loadComments = async () => {
      setIsLoading(true)
      const result = await getComments()
      if (result.success) {
        setComments(result.comments)
      }
      setIsLoading(false)
    }
    loadComments()
  }, [])

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newComment.trim()) return

    setIsSubmitting(true)
    const result = await addComment(newComment)

    if (result.success) {
      setNewComment("")
      // Reload comments
      const updatedComments = await getComments()
      if (updatedComments.success) {
        setComments(updatedComments.comments)
      }
    } else {
      alert(result.error || "Failed to add comment")
    }

    setIsSubmitting(false)
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("Are you sure you want to delete this comment?")) return

    const result = await deleteComment(commentId)

    if (result.success) {
      // Reload comments
      const updatedComments = await getComments()
      if (updatedComments.success) {
        setComments(updatedComments.comments)
      }
    } else {
      alert(result.error || "Failed to delete comment")
    }
  }

  return (
    <Card className="mt-8">
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          <CardTitle>Tour Comments</CardTitle>
        </div>
        <CardDescription>Share your thoughts about recent rounds and tour performance</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add Comment Form */}
        {currentUserId && (
          <form onSubmit={handleSubmitComment} className="space-y-4">
            <Textarea
              placeholder="Share your thoughts about the tour..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="min-h-[100px]"
              maxLength={500}
            />
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{newComment.length}/500 characters</span>
              <Button type="submit" disabled={isSubmitting || !newComment.trim()} size="sm">
                <Send className="mr-2 h-4 w-4" />
                {isSubmitting ? "Posting..." : "Post Comment"}
              </Button>
            </div>
          </form>
        )}

        {!currentUserId && (
          <div className="text-center py-4 text-muted-foreground">Please sign in to leave a comment</div>
        )}

        {/* Comments List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-4 text-muted-foreground">Loading comments...</div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageCircle className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No comments yet. Be the first to share your thoughts!</p>
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{comment.users?.name || "Unknown User"}</span>
                    <Badge variant="outline" className="text-xs">
                      {format(new Date(comment.created_at), "MMM d, yyyy 'at' h:mm a")}
                    </Badge>
                  </div>
                  {currentUserId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteComment(comment.id)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="text-sm leading-relaxed pl-6">{comment.comment}</p>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
