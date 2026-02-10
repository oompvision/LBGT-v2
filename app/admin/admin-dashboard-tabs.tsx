"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
import { CalendarIcon, Edit, Loader2, Search, Trash2, User } from "lucide-react"
import { formatDate, formatTime } from "@/lib/utils"
import { updateUser, deleteUser } from "@/app/actions/admin-management"
import type { User, TeeTime, ReservationWithDetails } from "@/types/supabase"
import { MAX_STROKES_GIVEN } from "@/lib/constants"

interface AdminDashboardTabsProps {
  users: User[]
  teeTimes: TeeTime[]
  reservations: ReservationWithDetails[]
}

export function AdminDashboardTabs({ users, teeTimes, reservations }: AdminDashboardTabsProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("tee-times")
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
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

  // Filter users based on search term
  const filteredUsers = users.filter((user) => {
    const searchLower = searchTerm.toLowerCase()
    return (
      (user.name || "").toLowerCase().includes(searchLower) || (user.email || "").toLowerCase().includes(searchLower)
    )
  })

  // Filter tee times based on search term
  const filteredTeeTimes = teeTimes.filter((teeTime) => {
    const searchLower = searchTerm.toLowerCase()
    return teeTime.date.toLowerCase().includes(searchLower) || teeTime.time.toLowerCase().includes(searchLower)
  })

  // Filter reservations based on search term
  const filteredReservations = reservations.filter((reservation) => {
    const searchLower = searchTerm.toLowerCase()
    return (
      (reservation.users?.name || "").toLowerCase().includes(searchLower) ||
      (reservation.users?.email || "").toLowerCase().includes(searchLower) ||
      (reservation.tee_times?.date || "").toLowerCase().includes(searchLower) ||
      (reservation.player_names &&
        reservation.player_names.some((name: string) => name.toLowerCase().includes(searchLower)))
    )
  })

  const handleEditUser = (user: User) => {
    setSelectedUser(user)
    setEditedUser({
      name: user.name || "",
      email: user.email || "",
      strokes_given: user.strokes_given || 0,
    })
    setIsEditing(true)
  }

  const handleSaveUser = async () => {
    try {
      // Validate strokes_given is between 0 and 20
      const strokesGiven = Number.parseInt(editedUser.strokes_given.toString())
      if (isNaN(strokesGiven) || strokesGiven < 0 || strokesGiven > MAX_STROKES_GIVEN) {
        toast({
          title: "Validation Error",
          description: `Strokes Given must be a number between 0 and ${MAX_STROKES_GIVEN}`,
          variant: "destructive",
        })
        return
      }

      const result = await updateUser(selectedUser.id, {
        name: editedUser.name,
        email: editedUser.email,
        strokes_given: strokesGiven,
      })

      if (!result.success) {
        throw new Error(result.error)
      }

      toast({
        title: "Success",
        description: "User profile updated successfully",
      })

      setIsEditing(false)
      router.refresh()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update user",
        variant: "destructive",
      })
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

  return (
    <>
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search users, tee times, or reservations..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="tee-times">Tee Times</TabsTrigger>
          <TabsTrigger value="reservations">Reservations</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        <TabsContent value="tee-times" className="mt-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Manage Tee Times</h2>
            </div>

            {filteredTeeTimes.length > 0 ? (
              <div className="space-y-4">
                {filteredTeeTimes.map((teeTime) => (
                  <Card key={teeTime.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                            <CardTitle className="text-base">{formatDate(new Date(teeTime.date))}</CardTitle>
                          </div>
                          <CardDescription>{formatTime(teeTime.time)}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>No Tee Times Found</CardTitle>
                  <CardDescription>
                    {searchTerm ? "No tee times match your search criteria." : "No tee times have been created yet."}
                  </CardDescription>
                </CardHeader>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="reservations" className="mt-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Manage Reservations</h2>
            </div>

            {filteredReservations.length > 0 ? (
              <div className="space-y-4">
                {filteredReservations.map((reservation) => (
                  <Card key={reservation.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base">{reservation.users?.name || "Unknown User"}</CardTitle>
                          <CardDescription>{reservation.users?.email || "No email"}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <p className="text-sm font-medium">Date & Time</p>
                          <p className="text-sm text-muted-foreground">
                            {reservation.tee_times?.date
                              ? formatDate(new Date(reservation.tee_times.date))
                              : "Unknown date"}{" "}
                            at {reservation.tee_times?.time ? formatTime(reservation.tee_times.time) : "Unknown time"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Players</p>
                          <p className="text-sm text-muted-foreground">
                            {reservation.slots} {reservation.slots === 1 ? "player" : "players"}
                          </p>
                          {reservation.player_names && reservation.player_names.length > 0 && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              Additional players: {reservation.player_names.join(", ")}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>No Reservations Found</CardTitle>
                  <CardDescription>
                    {searchTerm ? "No reservations match your search criteria." : "No reservations have been made yet."}
                  </CardDescription>
                </CardHeader>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="users" className="mt-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Manage Users</h2>
            </div>

            {filteredUsers.length > 0 ? (
              <div className="space-y-4">
                {filteredUsers.map((user) => (
                  <Card key={user.id}>
                    <CardHeader className="pb-2">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <CardTitle className="text-base">{user.name || "Unnamed User"}</CardTitle>
                            {user.is_admin && <Badge>Admin</Badge>}
                          </div>
                          <CardDescription>{user.email || "No email"}</CardDescription>
                        </div>
                        <div className="flex gap-2">
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
                ))}
              </div>
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
        </TabsContent>
      </Tabs>

      {/* Edit User Dialog */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
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
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={editedUser.email}
                onChange={(e) => setEditedUser({ ...editedUser, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="strokes_given">Strokes Given (0-{MAX_STROKES_GIVEN})</Label>
              <Input
                id="strokes_given"
                type="number"
                min="0"
                max={MAX_STROKES_GIVEN}
                value={editedUser.strokes_given}
                onChange={(e) => setEditedUser({ ...editedUser, strokes_given: Number.parseInt(e.target.value) || 0 })}
              />
              <p className="text-xs text-muted-foreground">
                Number of strokes to subtract from the player's score based on handicap
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveUser}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
