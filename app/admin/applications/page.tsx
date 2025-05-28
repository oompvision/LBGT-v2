import { AdminTabs } from "@/app/admin/admin-tabs"
import { ApplicationsManager } from "./applications-manager"

export default function ApplicationsPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      <AdminTabs />
      <div className="mt-6">
        <h2 className="text-2xl font-semibold mb-4">Membership Applications</h2>
        <ApplicationsManager />
      </div>
    </div>
  )
}
