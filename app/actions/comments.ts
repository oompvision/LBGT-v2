"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function addComment(comment: string) {
  try {
    const supabase = await createClient()

    // Get the current user
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return { success: false, error: "You must be logged in to add a comment" }
    }

    // Insert the comment
    const { error } = await supabase.from("tour_comments").insert({
      user_id: session.user.id,
      comment: comment.trim(),
    })

    if (error) {
      console.error("Error adding comment:", error)
      return { success: false, error: error.message }
    }

    // Revalidate the page to show the new comment
    revalidatePath("/scores/league-rounds")

    return { success: true }
  } catch (error: any) {
    console.error("Error in addComment:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

export async function getComments() {
  try {
    const supabase = await createClient()

    // Use a LEFT JOIN to fetch user data in a single query
    const { data: comments, error } = await supabase
      .from("tour_comments")
      .select(`
        id,
        comment,
        created_at,
        users (
          name
        )
      `)
      .order("created_at", { ascending: false })
      .limit(50)

    if (error) {
      console.error("Error fetching comments:", error)
      return { success: false, error: error.message, comments: [] }
    }

    return { success: true, comments: comments || [] }
  } catch (error: any) {
    console.error("Error in getComments:", error)
    return { success: false, error: error.message || "An unexpected error occurred", comments: [] }
  }
}

export async function deleteComment(commentId: string) {
  try {
    const supabase = await createClient()

    // Get the current user
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return { success: false, error: "You must be logged in to delete a comment" }
    }

    // Delete the comment (RLS policy ensures users can only delete their own comments)
    const { error } = await supabase.from("tour_comments").delete().eq("id", commentId).eq("user_id", session.user.id)

    if (error) {
      console.error("Error deleting comment:", error)
      return { success: false, error: error.message }
    }

    // Revalidate the page
    revalidatePath("/scores/league-rounds")

    return { success: true }
  } catch (error: any) {
    console.error("Error in deleteComment:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}
