interface EmailTemplateOptions {
  subject: string
  body: string
  ctaText?: string
  ctaUrl?: string
}

export function buildBrandedEmailHtml({ subject, body, ctaText, ctaUrl }: EmailTemplateOptions): string {
  const currentYear = new Date().getFullYear()

  const ctaSection =
    ctaText && ctaUrl
      ? `
          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding: 24px 40px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="background-color: #3A5A40; border-radius: 8px;">
                    <a href="${ctaUrl}" target="_blank" style="display: inline-block; padding: 14px 36px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; letter-spacing: 0.3px;">${ctaText}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
      : ""

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #DAD7CD; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #DAD7CD; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(58, 90, 64, 0.08);">

          <!-- Header with logo -->
          <tr>
            <td align="center" style="background-color: #3A5A40; padding: 32px 40px;">
              <img src="https://longbeachgolftour.com/images/osprey-logo.png" alt="LBGT Osprey Logo" width="80" height="80" style="display: block; border: 0; border-radius: 50%; background-color: #DAD7CD;" />
              <p style="margin: 16px 0 0; font-size: 18px; font-weight: 600; color: #DAD7CD; letter-spacing: 0.5px;">The Long Beach Golf Tour</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px 40px 16px;">
              <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: #3A5A40;">${subject}</h1>
              <div style="margin: 0; font-size: 15px; line-height: 1.6; color: #4a4a4a;">
                ${body}
              </div>
            </td>
          </tr>
${ctaSection}
          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <hr style="border: none; border-top: 1px solid #e8e5de; margin: 0;" />
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="background-color: #f5f3ee; padding: 24px 40px;">
              <p style="margin: 0; font-size: 12px; color: #999999;">
                &copy; ${currentYear} The Long Beach Golf Tour
              </p>
              <p style="margin: 6px 0 0; font-size: 12px;">
                <a href="https://longbeachgolftour.com" style="color: #588157; text-decoration: none;">longbeachgolftour.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
