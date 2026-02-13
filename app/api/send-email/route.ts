import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { createClient, createAdminClient } from "@/lib/supabase/server"
import { buildBrandedEmailHtml } from "@/lib/email-template"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    // Verify admin
    const supabase = await createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabaseAdmin = createAdminClient()
    const { data: userData } = await supabaseAdmin
      .from("users")
      .select("id, is_admin")
      .eq("id", session.user.id)
      .single()

    if (!userData?.is_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { subject, body, ctaText, ctaUrl, recipientType, recipientIds } = await request.json()

    if (!subject || !body) {
      return NextResponse.json({ error: "Subject and body are required" }, { status: 400 })
    }

    // Get recipients
    let recipients: { id: string; email: string; name: string }[]

    if (recipientType === "selected" && recipientIds?.length > 0) {
      const { data, error } = await supabaseAdmin
        .from("users")
        .select("id, email, name")
        .in("id", recipientIds)

      if (error) throw error
      recipients = data || []
    } else {
      const { data, error } = await supabaseAdmin
        .from("users")
        .select("id, email, name")

      if (error) throw error
      recipients = data || []
    }

    if (recipients.length === 0) {
      return NextResponse.json({ error: "No recipients found" }, { status: 400 })
    }

    // Build the branded HTML
    const html = buildBrandedEmailHtml({
      subject,
      body,
      ctaText: ctaText || undefined,
      ctaUrl: ctaUrl || undefined,
    })

    // Send emails via Resend (batch up to 100 at a time)
    const batchSize = 100
    let totalSent = 0
    const errors: string[] = []

    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize)

      const results = await Promise.allSettled(
        batch.map((recipient) =>
          resend.emails.send({
            from: "Long Beach Golf Tour <commissioner@updates.longbeachgolftour.com>",
            to: recipient.email,
            subject,
            html,
          })
        )
      )

      for (const result of results) {
        if (result.status === "fulfilled" && !result.value.error) {
          totalSent++
        } else {
          const errorMsg =
            result.status === "rejected"
              ? result.reason?.message
              : result.value.error?.message
          errors.push(errorMsg || "Unknown error")
        }
      }
    }

    // Save to email history
    await supabaseAdmin.from("email_campaigns").insert({
      subject,
      body,
      cta_text: ctaText || null,
      cta_url: ctaUrl || null,
      recipient_type: recipientType === "selected" ? "selected" : "all",
      recipient_ids: recipientType === "selected" ? recipientIds : null,
      recipient_count: totalSent,
      sent_by: session.user.id,
    })

    return NextResponse.json({
      success: true,
      sent: totalSent,
      total: recipients.length,
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
    })
  } catch (error: any) {
    console.error("Send email error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to send emails" },
      { status: 500 }
    )
  }
}
