"use client"

import { useState, useEffect } from "react"
import { AdminTabs } from "@/app/admin/admin-tabs"
import { RichTextEditor } from "@/components/rich-text-editor"
import { getAllMembers, getEmailHistory } from "@/app/actions/emails"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, Send, AlertCircle, CheckCircle, Mail, Users, Clock, ChevronDown, ChevronUp } from "lucide-react"

interface Member {
  id: string
  name: string
  email: string
}

interface Campaign {
  id: string
  subject: string
  body: string
  cta_text: string | null
  cta_url: string | null
  recipient_type: string
  recipient_count: number
  sent_at: string
  users: { name: string } | null
}

export default function AdminEmailsPage() {
  // Compose state
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [showCta, setShowCta] = useState(false)
  const [ctaText, setCtaText] = useState("")
  const [ctaUrl, setCtaUrl] = useState("")
  const [recipientType, setRecipientType] = useState<"all" | "selected">("all")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isSending, setIsSending] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Data state
  const [members, setMembers] = useState<Member[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [memberSearch, setMemberSearch] = useState("")

  // History expand state
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      const [membersResult, historyResult] = await Promise.all([getAllMembers(), getEmailHistory()])

      if (membersResult.success && membersResult.members) {
        setMembers(membersResult.members)
      }
      if (historyResult.success && historyResult.campaigns) {
        setCampaigns(historyResult.campaigns as Campaign[])
      }
      setIsLoading(false)
    }
    loadData()
  }, [])

  const filteredMembers = members.filter(
    (m) =>
      m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
      m.email.toLowerCase().includes(memberSearch.toLowerCase())
  )

  const toggleMember = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
  }

  const selectAll = () => {
    if (selectedIds.length === filteredMembers.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredMembers.map((m) => m.id))
    }
  }

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      setMessage({ type: "error", text: "Subject and body are required." })
      return
    }

    if (recipientType === "selected" && selectedIds.length === 0) {
      setMessage({ type: "error", text: "Please select at least one recipient." })
      return
    }

    const recipientCount = recipientType === "all" ? members.length : selectedIds.length
    const confirmed = window.confirm(
      `Send this email to ${recipientCount} ${recipientCount === 1 ? "member" : "members"}?`
    )
    if (!confirmed) return

    setIsSending(true)
    setMessage(null)

    try {
      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          body,
          ctaText: showCta ? ctaText.trim() : undefined,
          ctaUrl: showCta ? ctaUrl.trim() : undefined,
          recipientType,
          recipientIds: recipientType === "selected" ? selectedIds : undefined,
        }),
      })

      const result = await response.json()

      if (result.success) {
        setMessage({
          type: "success",
          text: `Email sent successfully to ${result.sent} of ${result.total} recipients.${
            result.errors ? ` ${result.errors.length} failed.` : ""
          }`,
        })
        // Reset form
        setSubject("")
        setBody("")
        setCtaText("")
        setCtaUrl("")
        setShowCta(false)
        setSelectedIds([])
        // Refresh history
        const historyResult = await getEmailHistory()
        if (historyResult.success && historyResult.campaigns) {
          setCampaigns(historyResult.campaigns as Campaign[])
        }
      } else {
        setMessage({ type: "error", text: result.error || "Failed to send emails." })
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "An unexpected error occurred." })
    } finally {
      setIsSending(false)
    }
  }

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
          <p className="text-muted-foreground">Send emails to members</p>
        </div>
        <AdminTabs />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="container py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
        <p className="text-muted-foreground">Send emails to members</p>
      </div>

      <AdminTabs />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Compose Email */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Compose Email
              </CardTitle>
              <CardDescription>
                Send a branded email to your members. Emails are sent from commissioner@updates.longbeachgolftour.com
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Subject */}
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  placeholder="e.g. Weekend Tournament Update"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>

              {/* Body */}
              <div className="space-y-2">
                <Label>Body</Label>
                <RichTextEditor content={body} onChange={setBody} />
              </div>

              {/* CTA Button */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Switch id="cta-toggle" checked={showCta} onCheckedChange={setShowCta} />
                  <Label htmlFor="cta-toggle">Include a button</Label>
                </div>
                {showCta && (
                  <div className="grid gap-3 sm:grid-cols-2 pl-2 border-l-2 border-muted">
                    <div className="space-y-1">
                      <Label htmlFor="cta-text" className="text-sm">
                        Button text
                      </Label>
                      <Input
                        id="cta-text"
                        placeholder="e.g. View Schedule"
                        value={ctaText}
                        onChange={(e) => setCtaText(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="cta-url" className="text-sm">
                        Button URL
                      </Label>
                      <Input
                        id="cta-url"
                        placeholder="https://longbeachgolftour.com/..."
                        value={ctaUrl}
                        onChange={(e) => setCtaUrl(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Message */}
              {message && (
                <Alert variant={message.type === "error" ? "destructive" : "default"}>
                  {message.type === "error" ? (
                    <AlertCircle className="h-4 w-4" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  <AlertTitle>{message.type === "error" ? "Error" : "Success"}</AlertTitle>
                  <AlertDescription>{message.text}</AlertDescription>
                </Alert>
              )}

              {/* Send */}
              <Button onClick={handleSend} disabled={isSending || !subject.trim() || !body.trim()} className="w-full">
                {isSending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Email
                    {recipientType === "all"
                      ? ` to All Members (${members.length})`
                      : selectedIds.length > 0
                        ? ` to ${selectedIds.length} Selected`
                        : ""}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Email History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Email History
              </CardTitle>
              <CardDescription>Previously sent emails</CardDescription>
            </CardHeader>
            <CardContent>
              {campaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No emails sent yet.</p>
              ) : (
                <div className="space-y-3">
                  {campaigns.map((campaign) => (
                    <div key={campaign.id} className="border rounded-lg p-3">
                      <div
                        className="flex items-start justify-between cursor-pointer"
                        onClick={() =>
                          setExpandedCampaign(expandedCampaign === campaign.id ? null : campaign.id)
                        }
                      >
                        <div className="space-y-1">
                          <p className="font-medium text-sm">{campaign.subject}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{new Date(campaign.sent_at).toLocaleDateString()}</span>
                            <span>&middot;</span>
                            <Badge variant="secondary" className="text-xs">
                              {campaign.recipient_type === "all" ? "All members" : "Selected"}
                            </Badge>
                            <span>&middot;</span>
                            <span>{campaign.recipient_count} sent</span>
                          </div>
                        </div>
                        {expandedCampaign === campaign.id ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                      </div>
                      {expandedCampaign === campaign.id && (
                        <div className="mt-3 pt-3 border-t">
                          <div
                            className="text-sm text-muted-foreground prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: campaign.body }}
                          />
                          {campaign.cta_text && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              Button: {campaign.cta_text} &rarr; {campaign.cta_url}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recipient Picker - Sidebar */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Recipients
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Toggle */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setRecipientType("all")}
                  className={`w-full text-left p-3 rounded-lg border text-sm transition-colors ${
                    recipientType === "all" ? "border-primary bg-primary/5 font-medium" : "hover:bg-muted/50"
                  }`}
                >
                  All Members ({members.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRecipientType("selected")}
                  className={`w-full text-left p-3 rounded-lg border text-sm transition-colors ${
                    recipientType === "selected" ? "border-primary bg-primary/5 font-medium" : "hover:bg-muted/50"
                  }`}
                >
                  Select Specific Members
                </button>
              </div>

              {/* Member List */}
              {recipientType === "selected" && (
                <div className="space-y-3">
                  <Input
                    placeholder="Search members..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                  />

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{selectedIds.length} selected</span>
                    <button type="button" className="underline hover:text-foreground" onClick={selectAll}>
                      {selectedIds.length === filteredMembers.length ? "Deselect all" : "Select all"}
                    </button>
                  </div>

                  <div className="max-h-[400px] overflow-y-auto space-y-1 border rounded-md p-2">
                    {filteredMembers.map((member) => (
                      <label
                        key={member.id}
                        className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedIds.includes(member.id)}
                          onCheckedChange={() => toggleMember(member.id)}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{member.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                        </div>
                      </label>
                    ))}
                    {filteredMembers.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-2">No members found.</p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
