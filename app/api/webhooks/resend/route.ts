import { NextRequest, NextResponse } from "next/server"
import { Webhook } from "svix"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)
const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
const forwardTo = process.env.FORWARD_EMAIL_TO

export async function POST(request: NextRequest) {
  if (!webhookSecret || !forwardTo) {
    console.error("Missing RESEND_WEBHOOK_SECRET or FORWARD_EMAIL_TO env vars")
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }

  // Read raw body for signature verification
  const body = await request.text()

  // Extract Svix headers
  const svixId = request.headers.get("svix-id")
  const svixTimestamp = request.headers.get("svix-timestamp")
  const svixSignature = request.headers.get("svix-signature")

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 })
  }

  // Verify webhook signature
  let payload: any
  try {
    const wh = new Webhook(webhookSecret)
    payload = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    })
  } catch (err) {
    console.error("Webhook signature verification failed:", err)
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  // Only handle inbound emails
  if (payload.type !== "email.received") {
    return NextResponse.json({ message: "Event ignored" }, { status: 200 })
  }

  try {
    const { from, subject, html, text } = payload.data

    const senderEmail = typeof from === "string" ? from : from?.email || from
    const originalSubject = subject || "(no subject)"
    const forwardSubject = originalSubject.startsWith("Fwd:")
      ? originalSubject
      : `Fwd: ${originalSubject}`

    await resend.emails.send({
      from: "Long Beach Golf Tour <commissioner@updates.longbeachgolftour.com>",
      to: forwardTo,
      replyTo: senderEmail,
      subject: forwardSubject,
      html: html || undefined,
      text: text || `Forwarded message from ${senderEmail}`,
    })

    return NextResponse.json({ message: "Forwarded successfully" }, { status: 200 })
  } catch (err: any) {
    console.error("Failed to forward email:", err)
    return NextResponse.json(
      { error: err.message || "Failed to forward email" },
      { status: 500 }
    )
  }
}
