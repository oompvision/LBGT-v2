"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Edit, Loader2, Search, Trash2, User, AlertTriangle, Camera, X } from "lucide-react"
import {
  updateUser,
  updateStrokesGivenDirectly,
  deleteUser,
  adminUploadProfilePicture,
  adminRemoveProfilePicture,
} from "@/app/actions/admin-management"

interface UserManagementProps {
  users: any[]
}

export function UserManagement({ users }: UserManagementProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [editedUser, setEditedUser] = useState<{
    name: string
    email: string
    strokes_given: number
  }>({
    name: "",
    email: "",
    strokes_given: 0,
  })
  const router = useRouter()
  const { toast } = useToast()
  const [isUploadingPicture, setIsUploadingPicture] = useState<string | null>(null)
  const [selectedPictureUser, setSelectedPictureUser] = useState<any>(null)
  const [isPictureDialogOpen, setIsPictureDialogOpen] = useState(false)

  // Filter users based on search term
  const filteredUsers = users.filter((user) => {
    const searchLower = searchTerm.toLowerCase()
    return user.name?.toLowerCase().includes(searchLower) || user.email?.toLowerCase().includes(searchLower)
  })

  const handleEditUser = (user: any) => {
    setSelectedUser(user)
    setEditedUser({
      name: user.name || "",
      email: user.email || "",
      strokes_given: user.strokes_given !== undefined ? user.strokes_given : 0,
    })
    setIsEditing(true)
  }

  const handleSaveUser = async () => {
    setIsSubmitting(true)

    try {
      // Validate strokes_given is between 0 and 20
      const strokesGiven = Number(editedUser.strokes_given)
      if (isNaN(strokesGiven) || strokesGiven < 0 || strokesGiven > 20) {
        toast({
          title: "Validation Error",
          description: "Strokes Given must be a number between 0 and 20",
          variant: "destructive",
        })
        setIsSubmitting(false)
        return
      }

      console.log("Submitting strokes_given update:", strokesGiven)

      // First update the name and email
      const nameEmailResult = await updateUser(selectedUser.id, {
        name: editedUser.name,
        email: editedUser.email,
      })

      if (!nameEmailResult.success) {
        throw new Error(nameEmailResult.error)
      }

      // Then update the strokes_given using our new direct SQL function
      const strokesResult = await updateStrokesGivenDirectly(selectedUser.id, strokesGiven)

      if (!strokesResult.success) {
        throw new Error(strokesResult.error)
      }

      toast({
        title: "Success",
        description: "User profile updated successfully",
      })

      setIsEditing(false)

      // Force a complete refresh to ensure the UI updates
      router.refresh()

      // Add a small delay before closing the dialog to ensure the refresh completes
      setTimeout(() => {
        setIsSubmitting(false)
      }, 500)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update user",
        variant: "destructive",
      })
      setIsSubmitting(false)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      return
    }

    setIsDeleting(userId)

    try {
      const result = await deleteUser(userId)

      if (!result.success) {
        throw new Error(result.error)
      }

      toast({
        title: "Success",
        description: "User deleted successfully",
      })

      router.refresh()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete user",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(null)
    }
  }

  const handleProfilePictureUpload = async (userId: string, formData: FormData) => {
    setIsUploadingPicture(userId)

    try {
      const result = await adminUploadProfilePicture(userId, formData)

      if (!result.success) {
        throw new Error(result.error)
      }

      toast({
        title: "Success",
        description: "Profile picture updated successfully",
      })

      setIsPictureDialogOpen(false)
      router.refresh()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to upload profile picture",
        variant: "destructive",
      })
    } finally {
      setIsUploadingPicture(null)
    }
  }

  const handleRemoveProfilePicture = async (userId: string) => {
    if (!confirm("Are you sure you want to remove this user's profile picture?")) {
      return
    }

    setIsUploadingPicture(userId)

    try {
      const result = await adminRemoveProfilePicture(userId)

      if (!result.success) {
        throw new Error(result.error)
      }

      toast({
        title: "Success",
        description: "Profile picture removed successfully",
      })

      router.refresh()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to remove profile picture",
        variant: "destructive",
      })
    } finally {
      setIsUploadingPicture(null)
    }
  }

  return (
    <>
      <div className="mb-6 flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search users by name or email..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Link href="/admin/fix-user">
          <Button variant="outline" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Fix User Issues
          </Button>
        </Link>
      </div>

      <div className="space-y-4">
        {filteredUsers.length > 0 ? (
          filteredUsers.map((user) => (
            <Card key={user.id}>
              <CardHeader className="pb-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      {user.profile_picture_url ? (
                        <img
                          src={user.profile_picture_url || "/placeholder.svg"}
                          alt={`${user.name}'s profile`}
                          className="h-12 w-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{user.name || "Unnamed User"}</CardTitle>
                        {user.is_admin && <Badge>Admin</Badge>}
                      </div>
                      <CardDescription>{user.email || "No email"}</CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedPictureUser(user)
                        setIsPictureDialogOpen(true)
                      }}
                      disabled={isUploadingPicture === user.id}
                    >
                      {isUploadingPicture === user.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Camera className="mr-2 h-4 w-4" />
                      )}
                      Picture
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleEditUser(user)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteUser(user.id)}
                      disabled={isDeleting === user.id || user.is_admin}
                    >
                      {isDeleting === user.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="mr-2 h-4 w-4" />
                      )}
                      Delete
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium">Joined</p>
                    <p className="text-sm text-muted-foreground">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : "Unknown"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Strokes Given</p>
                    <p className="text-sm text-muted-foreground">{user.strokes_given || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>No Users Found</CardTitle>
              <CardDescription>
                {searchTerm ? "No users match your search criteria." : "No users have been created yet."}
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>

      {/* Edit User Dialog */}
      <Dialog
        open={isEditing}
        onOpenChange={(open) => {
          if (!isSubmitting) {
            setIsEditing(open)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Profile</DialogTitle>
            <DialogDescription>Update user information and handicap settings</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={editedUser.name}
                onChange={(e) => setEditedUser({ ...editedUser, name: e.target.value })}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={editedUser.email}
                onChange={(e) => setEditedUser({ ...editedUser, email: e.target.value })}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="strokes_given">Strokes Given (0-20)</Label>
              <Input
                id="strokes_given"
                type="number"
                min="0"
                max="20"
                value={editedUser.strokes_given}
                onChange={(e) =>
                  setEditedUser({
                    ...editedUser,
                    strokes_given: e.target.value === "" ? 0 : Number(e.target.value),
                  })
                }
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                Number of strokes to subtract from the player's score based on handicap
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditing(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleSaveUser} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Profile Picture Management Dialog */}
      <Dialog
        open={isPictureDialogOpen}
        onOpenChange={(open) => {
          if (!isUploadingPicture) {
            setIsPictureDialogOpen(open)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Profile Picture</DialogTitle>
            <DialogDescription>Upload or remove profile picture for {selectedPictureUser?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedPictureUser?.profile_picture_url && (
              <div className="flex flex-col items-center gap-4">
                <img
                  src={selectedPictureUser.profile_picture_url || "/placeholder.svg"}
                  alt="Current profile picture"
                  className="h-24 w-24 rounded-full object-cover"
                />
                <Button
                  variant="outline"
                  onClick={() => handleRemoveProfilePicture(selectedPictureUser.id)}
                  disabled={!!isUploadingPicture}
                >
                  <X className="mr-2 h-4 w-4" />
                  Remove Picture
                </Button>
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget)
                handleProfilePictureUpload(selectedPictureUser.id, formData)
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="profilePicture">Upload New Picture</Label>
                <Input
                  id="profilePicture"
                  name="profilePicture"
                  type="file"
                  accept="image/*"
                  disabled={!!isUploadingPicture}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Maximum file size: 5MB. Supported formats: JPG, PNG, GIF
                </p>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsPictureDialogOpen(false)}
                  disabled={!!isUploadingPicture}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={!!isUploadingPicture}>
                  {isUploadingPicture ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    "Upload Picture"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
