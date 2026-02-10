"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { updateUserProfile, uploadProfilePicture, removeProfilePicture } from "@/app/actions/auth"
import { CalendarIcon, Mail, User, Camera, X } from "lucide-react"
import Image from "next/image"

interface UserProfileProps {
  user: {
    name: string | null
    email: string | null
    profile_picture_url: string | null
    created_at: string
    strokes_given: number | null
  }
}

export function UserProfile({ user }: UserProfileProps) {
  const [name, setName] = useState(user.name || "")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploadingPicture, setIsUploadingPicture] = useState(false)
  const [isRemovingPicture, setIsRemovingPicture] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const handleUpdateProfile = async () => {
    setIsSubmitting(true)

    try {
      const result = await updateUserProfile({
        name,
      })

      if (!result.success) {
        throw new Error(result.error)
      }

      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
      })

      router.refresh()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleProfilePictureUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploadingPicture(true)

    try {
      const formData = new FormData()
      formData.append("profilePicture", file)

      const result = await uploadProfilePicture(formData)

      if (!result.success) {
        throw new Error(result.error)
      }

      toast({
        title: "Profile Picture Updated",
        description: "Your profile picture has been updated successfully.",
      })

      router.refresh()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to upload profile picture",
        variant: "destructive",
      })
    } finally {
      setIsUploadingPicture(false)
      // Reset the input
      event.target.value = ""
    }
  }

  const handleRemoveProfilePicture = async () => {
    setIsRemovingPicture(true)

    try {
      const result = await removeProfilePicture()

      if (!result.success) {
        throw new Error(result.error)
      }

      toast({
        title: "Profile Picture Removed",
        description: "Your profile picture has been removed successfully.",
      })

      router.refresh()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to remove profile picture",
        variant: "destructive",
      })
    } finally {
      setIsRemovingPicture(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile Picture</CardTitle>
          <CardDescription>Upload or update your profile picture</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              {user.profile_picture_url ? (
                <div className="relative">
                  <Image
                    src={user.profile_picture_url || "/placeholder.svg"}
                    alt={`${user.name}'s profile picture`}
                    width={80}
                    height={80}
                    className="rounded-full object-cover border-2 border-border"
                  />
                  {user.profile_picture_url && (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                      onClick={handleRemoveProfilePicture}
                      disabled={isRemovingPicture}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ) : (
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center border-2 border-border">
                  <User className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <Label htmlFor="profile-picture" className="cursor-pointer">
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" disabled={isUploadingPicture} className="pointer-events-none">
                    <Camera className="h-4 w-4 mr-2" />
                    {isUploadingPicture ? "Uploading..." : "Upload Picture"}
                  </Button>
                </div>
              </Label>
              <Input
                id="profile-picture"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleProfilePictureUpload}
                disabled={isUploadingPicture}
              />
              <p className="text-xs text-muted-foreground mt-1">JPG, PNG or GIF. Max file size 5MB.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Update your personal information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>{user.email}</span>
            </div>
            <p className="text-xs text-muted-foreground">Email cannot be changed</p>
          </div>
          <div className="space-y-2">
            <Label>Member Since</Label>
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <span>{new Date(user.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleUpdateProfile} disabled={isSubmitting}>
            {isSubmitting ? "Updating..." : "Update Profile"}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Handicap Information</CardTitle>
          <CardDescription>Your current handicap settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Strokes Given</Label>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{user.strokes_given || 0}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              This value can only be changed by an administrator. It represents the number of strokes subtracted from
              your score based on the course handicap system.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
