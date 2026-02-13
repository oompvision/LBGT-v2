# Plan: Resend Inbound Email Webhook → Gmail Forwarding

## Problem
Broadcast emails are sent from `commissioner@updates.longbeachgolftour.com`. When members reply, Resend receives those replies (DNS receiving is enabled), but they go nowhere. We need to forward them to your personal Gmail.

## Flow

```
Member replies to commissioner@updates.longbeachgolftour.com
        ↓
Resend receives inbound email (DNS already configured)
        ↓
Resend POSTs to /api/webhooks/resend
        ↓
Webhook verifies signature, extracts email content
        ↓
Forwards to your Gmail via resend.emails.send()
  - Preserves original sender in reply-to
  - Preserves subject, body (HTML + text)
```

## Changes

### 1. Install `svix` (webhook signature verification)
Resend signs webhooks with Svix. We verify using the `svix` package + a signing secret from the Resend dashboard.

### 2. Create `app/api/webhooks/resend/route.ts` (single new file)
- `POST` handler
- Read raw body + Svix headers (`svix-id`, `svix-timestamp`, `svix-signature`)
- Verify signature using `RESEND_WEBHOOK_SECRET`
- Check event type is `email.received`
- Extract: `from`, `subject`, `html`/`text`
- Call `resend.emails.send()` to forward to `FORWARD_EMAIL_TO`
  - `from`: same commissioner address (so Gmail threads nicely)
  - `reply-to`: original sender's email (so you can reply back to them)
  - `subject`: prefixed with `Fwd:` if not already
- Return 200

### 3. New environment variables
| Variable | Purpose |
|----------|---------|
| `RESEND_WEBHOOK_SECRET` | Svix signing secret from Resend webhook config |
| `FORWARD_EMAIL_TO` | Your personal Gmail address |

(`RESEND_API_KEY` already exists)

## Files touched
1. `package.json` — add `svix`
2. `app/api/webhooks/resend/route.ts` — **new file**, the webhook handler

## After deploy (manual steps)
1. In Resend dashboard → Webhooks → Add endpoint
2. URL: `https://longbeachgolftour.com/api/webhooks/resend`
3. Subscribe to `email.received` event
4. Copy the signing secret → add as `RESEND_WEBHOOK_SECRET` in Vercel env vars
5. Add `FORWARD_EMAIL_TO` with your Gmail address in Vercel env vars
