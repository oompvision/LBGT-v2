"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/use-toast"
import { Loader2, Plus, Pencil, Trash2, Eye, GripVertical } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getAllInfoBoxes, createInfoBox, updateInfoBox, deleteInfoBox } from "@/app/actions/info-boxes"
import type { InfoBox } from "@/types/supabase"
import ReactMarkdown from "react-markdown"

export function InfoBoxManager() {
  const [infoBoxes, setInfoBoxes] = useState<InfoBox[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingBox, setEditingBox] = useState<InfoBox | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [boxToDelete, setBoxToDelete] = useState<InfoBox | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewContent, setPreviewContent] = useState({ title: "", content: "" })

  // Form state
  const [formTitle, setFormTitle] = useState("")
  const [formContent, setFormContent] = useState("")
  const [formOrder, setFormOrder] = useState(0)

  const fetchInfoBoxes = async () => {
    const result = await getAllInfoBoxes()
    if (result.success) {
      setInfoBoxes(result.infoBoxes)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchInfoBoxes()
  }, [])

  const resetForm = () => {
    setFormTitle("")
    setFormContent("")
    setFormOrder(infoBoxes.length + 1)
    setEditingBox(null)
    setIsCreating(false)
  }

  const startCreate = () => {
    setFormTitle("")
    setFormContent("")
    setFormOrder(infoBoxes.length + 1)
    setEditingBox(null)
    setIsCreating(true)
  }

  const startEdit = (box: InfoBox) => {
    setFormTitle(box.title)
    setFormContent(box.content)
    setFormOrder(box.display_order)
    setEditingBox(box)
    setIsCreating(true)
  }

  const handleSave = async () => {
    if (!formTitle.trim()) {
      toast({ title: "Error", description: "Title is required.", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      if (editingBox) {
        const result = await updateInfoBox(editingBox.id, {
          title: formTitle,
          content: formContent,
          display_order: formOrder,
        })
        if (result.success) {
          toast({ title: "Success", description: "Info box updated." })
        } else {
          toast({ title: "Error", description: result.error || "Failed to update.", variant: "destructive" })
        }
      } else {
        const result = await createInfoBox({
          title: formTitle,
          content: formContent,
          display_order: formOrder,
        })
        if (result.success) {
          toast({ title: "Success", description: "Info box created." })
        } else {
          toast({ title: "Error", description: result.error || "Failed to create.", variant: "destructive" })
        }
      }
      resetForm()
      await fetchInfoBoxes()
    } catch (error) {
      toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (box: InfoBox) => {
    const result = await updateInfoBox(box.id, { is_active: !box.is_active })
    if (result.success) {
      toast({
        title: "Success",
        description: `Info box ${box.is_active ? "hidden" : "shown"}.`,
      })
      await fetchInfoBoxes()
    } else {
      toast({ title: "Error", description: result.error || "Failed to update.", variant: "destructive" })
    }
  }

  const handleDelete = async () => {
    if (!boxToDelete) return
    const result = await deleteInfoBox(boxToDelete.id)
    if (result.success) {
      toast({ title: "Success", description: "Info box deleted." })
      await fetchInfoBoxes()
    } else {
      toast({ title: "Error", description: result.error || "Failed to delete.", variant: "destructive" })
    }
    setDeleteDialogOpen(false)
    setBoxToDelete(null)
  }

  const openPreview = (title: string, content: string) => {
    setPreviewContent({ title, content })
    setPreviewOpen(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Existing boxes */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Info Boxes ({infoBoxes.length})</h2>
          {!isCreating && (
            <Button onClick={startCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add Info Box
            </Button>
          )}
        </div>

        {infoBoxes.length === 0 && !isCreating && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No info boxes yet. Click "Add Info Box" to create one.
            </CardContent>
          </Card>
        )}

        {infoBoxes.map((box) => (
          <Card key={box.id} className={!box.is_active ? "opacity-60" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-lg">{box.title}</CardTitle>
                    <CardDescription>Order: {box.display_order}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 mr-2">
                    <Label htmlFor={`active-${box.id}`} className="text-xs text-muted-foreground">
                      {box.is_active ? "Visible" : "Hidden"}
                    </Label>
                    <Switch
                      id={`active-${box.id}`}
                      checked={box.is_active}
                      onCheckedChange={() => handleToggleActive(box)}
                    />
                  </div>
                  <Button variant="outline" size="sm" onClick={() => openPreview(box.title, box.content)}>
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => startEdit(box)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setBoxToDelete(box)
                      setDeleteDialogOpen(true)
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground line-clamp-2">{box.content}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create/Edit form */}
      {isCreating && (
        <Card>
          <CardHeader>
            <CardTitle>{editingBox ? "Edit Info Box" : "New Info Box"}</CardTitle>
            <CardDescription>
              Use markdown for formatting: **bold**, *italic*, [links](url), bullet lists with -.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Where, When, Rules"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="order">Display Order</Label>
                <Input
                  id="order"
                  type="number"
                  min={1}
                  value={formOrder}
                  onChange={(e) => setFormOrder(Number(e.target.value) || 1)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Content (Markdown)</Label>
              <Textarea
                id="content"
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="Enter content using markdown. **bold**, *italic*, [link](url)"
                rows={5}
              />
            </div>

            {formContent && (
              <div className="space-y-2">
                <Label>Preview</Label>
                <Card className="p-4">
                  <h3 className="text-xl font-semibold mb-2">{formTitle || "Untitled"}</h3>
                  <div className="prose prose-sm max-w-none text-muted-foreground">
                    <ReactMarkdown>{formContent}</ReactMarkdown>
                  </div>
                </Card>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingBox ? "Save Changes" : "Create"}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete info box?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the "{boxToDelete?.title}" info box.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Preview</DialogTitle>
          </DialogHeader>
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{previewContent.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none text-muted-foreground">
                <ReactMarkdown>{previewContent.content}</ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>
    </div>
  )
}
