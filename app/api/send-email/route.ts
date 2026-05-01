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

    const { subject, body, ctaText, ctaUrl, recipientType, recipientIds, additionalEmails } = await request.json()

    if (!subject || !body) {
      return NextResponse.json({ error: "Subject and body are required" }, { status: 400 })
    }

    // Get member recipients. Only confirmed users are ever eligible (pending
    // applicants don't get league mailings). "all_active" further restricts
    // to is_active = true; "all_with_inactive" pulls every confirmed user.
    let recipients: { id?: string; email: string; name: string }[]

    if (recipientType === "selected" && recipientIds?.length > 0) {
      const { data, error } = await supabaseAdmin
        .from("users")
        .select("id, email, name")
        .in("id", recipientIds)
        .eq("is_confirmed", true)

      if (error) throw error
      recipients = data || []
    } else if (recipientType === "all_active") {
      const { data, error } = await supabaseAdmin
        .from("users")
        .select("id, email, name")
        .eq("is_confirmed", true)
        .eq("is_active", true)

      if (error) throw error
      recipients = data || []
    } else if (recipientType === "all_with_inactive") {
      const { data, error } = await supabaseAdmin
        .from("users")
        .select("id, email, name")
        .eq("is_confirmed", true)

      if (error) throw error
      recipients = data || []
    } else {
      recipients = []
    }

    // Add additional non-member emails
    if (additionalEmails?.length > 0) {
      const memberEmails = new Set(recipients.map((r) => r.email.toLowerCase()))
      for (const email of additionalEmails) {
        if (!memberEmails.has(email.toLowerCase())) {
          recipients.push({ email, name: email })
        }
      }
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

    // Send emails via Resend batch API (up to 100 per batch call)
    const batchSize = 100
    let totalSent = 0
    let totalFailed = 0
    const errorSamples: string[] = []

    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize)

      const batchPayload = batch.map((recipient) => ({
        from: "Long Beach Golf Tour <commissioner@updates.longbeachgolftour.com>",
        to: recipient.email,
        subject,
        html,
      }))

      try {
        const { data, error } = await resend.batch.send(batchPayload)

        if (error) {
          // Entire batch failed
          totalFailed += batch.length
          if (errorSamples.length < 3) {
            errorSamples.push(error.message || "Batch send failed")
          }
        } else if (data) {
          // Batch succeeded — count individual results
          totalSent += data.data.length
        }
      } catch (err: any) {
        totalFailed += batch.length
        if (errorSamples.length < 3) {
          errorSamples.push(err.message || "Batch send error")
        }
      }
    }

    // Save to email history
    await supabaseAdmin.from("email_campaigns").insert({
      subject,
      body,
      cta_text: ctaText || null,
      cta_url: ctaUrl || null,
      // Stored verbatim so history can distinguish active-only blasts from
      // ones that intentionally swept in inactive members. Legacy rows from
      // before this split keep their "all" value and are rendered as
      // "All members" (legacy) in the history badge.
      recipient_type: recipientType,
      recipient_ids: recipientType === "selected" ? recipientIds : null,
      recipient_count: totalSent,
      sent_by: session.user.id,
    })

    return NextResponse.json({
      success: true,
      sent: totalSent,
      total: recipients.length,
      failed: totalFailed,
      errors: errorSamples.length > 0 ? errorSamples : undefined,
    })
  } catch (error: any) {
    console.error("Send email error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to send emails" },
      { status: 500 }
    )
  }
}
