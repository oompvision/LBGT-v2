"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "@/components/ui/use-toast"
import { getApplications, updateApplicationStatus, deleteApplication } from "@/app/actions/applications"
import { format } from "date-fns"

type Application = {
  id: string
  name: string
  email: string
  phone: string
  hometown: string
  handicap: string
  referral_source: string
  notes: string | null
  status: string
  created_at: string
}

export function ApplicationsManager() {
  const [applications, setApplications] = useState<Application[]>([])
  const [filteredApplications, setFilteredApplications] = useState<Application[]>([])
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("all")
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    fetchApplications()
  }, [])

  useEffect(() => {
    if (activeTab === "all") {
      setFilteredApplications(applications)
    } else {
      setFilteredApplications(applications.filter((app) => app.status === activeTab))
    }
  }, [activeTab, applications])

  async function fetchApplications() {
    setIsLoading(true)
    try {
      const result = await getApplications()
      if (result.success && result.data) {
        setApplications(result.data as Application[])
        setFilteredApplications(result.data as Application[])
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to fetch applications",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error fetching applications:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred while fetching applications",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  async function handleStatusChange(id: string, newStatus: string) {
    setIsUpdating(true)
    try {
      const result = await updateApplicationStatus(id, newStatus)
      if (result.success) {
        setApplications((prevApps) => prevApps.map((app) => (app.id === id ? { ...app, status: newStatus } : app)))
        toast({
          title: "Status Updated",
          description: `Application status has been updated to ${newStatus}`,
        })
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to update application status",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error updating application status:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred while updating status",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  async function handleDelete() {
    if (!selectedApplication) return

    setIsDeleting(true)
    try {
      const result = await deleteApplication(selectedApplication.id)
      if (result.success) {
        setApplications((prevApps) => prevApps.filter((app) => app.id !== selectedApplication.id))
        setIsDeleteDialogOpen(false)
        setSelectedApplication(null)
        toast({
          title: "Application Deleted",
          description: "The application has been deleted successfully",
        })
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to delete application",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error deleting application:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred while deleting the application",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
            Pending
          </Badge>
        )
      case "approved":
        return (
          <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
            Approved
          </Badge>
        )
      case "rejected":
        return (
          <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
            Rejected
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-lg">Loading applications...</p>
      </div>
    )
  }

  return (
    <div>
      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="all">All Applications</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {filteredApplications.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">No applications found</p>
              </CardContent>
            </Card>
          ) : (
            filteredApplications.map((application) => (
              <Card key={application.id} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{application.name}</CardTitle>
                      <CardDescription>{application.email}</CardDescription>
                    </div>
                    {getStatusBadge(application.status)}
                  </div>
                </CardHeader>
                <CardContent className="pb-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <p className="text-sm font-medium">Phone:</p>
                      <p className="text-sm text-muted-foreground">{application.phone}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Hometown:</p>
                      <p className="text-sm text-muted-foreground">{application.hometown}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Handicap:</p>
                      <p className="text-sm text-muted-foreground">{application.handicap}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Applied on:</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(application.created_at), "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedApplication(application)
                      setIsDetailsOpen(true)
                    }}
                  >
                    View Details
                  </Button>
                  <div className="space-x-2">
                    {application.status !== "approved" && (
                      <Button
                        variant="outline"
                        className="bg-green-100 text-green-800 hover:bg-green-200 hover:text-green-900"
                        onClick={() => handleStatusChange(application.id, "approved")}
                        disabled={isUpdating}
                      >
                        Approve
                      </Button>
                    )}
                    {application.status !== "rejected" && (
                      <Button
                        variant="outline"
                        className="bg-red-100 text-red-800 hover:bg-red-200 hover:text-red-900"
                        onClick={() => handleStatusChange(application.id, "rejected")}
                        disabled={isUpdating}
                      >
                        Reject
                      </Button>
                    )}
                    {application.status !== "pending" && (
                      <Button
                        variant="outline"
                        onClick={() => handleStatusChange(application.id, "pending")}
                        disabled={isUpdating}
                      >
                        Mark as Pending
                      </Button>
                    )}
                  </div>
                </CardFooter>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Application Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl">
          {selectedApplication && (
            <>
              <DialogHeader>
                <DialogTitle>Application Details</DialogTitle>
                <DialogDescription>
                  Submitted on {format(new Date(selectedApplication.created_at), "MMMM d, yyyy 'at' h:mm a")}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-medium">Name</h3>
                    <p>{selectedApplication.name}</p>
                  </div>
                  <div>
                    <h3 className="font-medium">Email</h3>
                    <p>{selectedApplication.email}</p>
                  </div>
                  <div>
                    <h3 className="font-medium">Phone</h3>
                    <p>{selectedApplication.phone}</p>
                  </div>
                  <div>
                    <h3 className="font-medium">Hometown</h3>
                    <p>{selectedApplication.hometown}</p>
                  </div>
                  <div>
                    <h3 className="font-medium">Handicap</h3>
                    <p>{selectedApplication.handicap}</p>
                  </div>
                  <div>
                    <h3 className="font-medium">Referral Source</h3>
                    <p>{selectedApplication.referral_source}</p>
                  </div>
                </div>
                <div>
                  <h3 className="font-medium">Additional Notes</h3>
                  <p className="whitespace-pre-wrap">{selectedApplication.notes || "No additional notes provided."}</p>
                </div>
                <div>
                  <h3 className="font-medium">Status</h3>
                  <div className="mt-1">{getStatusBadge(selectedApplication.status)}</div>
                </div>
              </div>
              <DialogFooter className="flex justify-between items-center">
                <Button
                  variant="destructive"
                  onClick={() => {
                    setIsDetailsOpen(false)
                    setIsDeleteDialogOpen(true)
                  }}
                >
                  Delete Application
                </Button>
                <div className="space-x-2">
                  {selectedApplication.status !== "approved" && (
                    <Button
                      variant="outline"
                      className="bg-green-100 text-green-800 hover:bg-green-200 hover:text-green-900"
                      onClick={() => {
                        handleStatusChange(selectedApplication.id, "approved")
                        setIsDetailsOpen(false)
                      }}
                      disabled={isUpdating}
                    >
                      Approve
                    </Button>
                  )}
                  {selectedApplication.status !== "rejected" && (
                    <Button
                      variant="outline"
                      className="bg-red-100 text-red-800 hover:bg-red-200 hover:text-red-900"
                      onClick={() => {
                        handleStatusChange(selectedApplication.id, "rejected")
                        setIsDetailsOpen(false)
                      }}
                      disabled={isUpdating}
                    >
                      Reject
                    </Button>
                  )}
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this application? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
