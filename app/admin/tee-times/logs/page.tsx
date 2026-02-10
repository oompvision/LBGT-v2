import { createClient } from "@/lib/supabase/server"
import { format } from "date-fns"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const dynamic = "force-dynamic"

export default async function TeeTimeLogsPage() {
  const supabase = await createClient()

  // Get the most recent 100 tee time logs
  const { data: logs, error } = await supabase
    .from("tee_time_logs")
    .select("*")
    .order("changed_at", { ascending: false })
    .limit(100)

  if (error) {
    console.error("Error fetching tee time logs:", error)
    return (
      <div className="container py-8">
        <h1 className="text-2xl font-bold mb-4">Tee Time Logs</h1>
        <p className="text-red-500">Error loading logs: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-4">Tee Time Logs</h1>
      <p className="text-muted-foreground mb-6">View the history of changes to tee time availability</p>

      {logs && logs.length > 0 ? (
        <div className="space-y-4">
          {logs.map((log) => (
            <Card key={log.id}>
              <CardHeader>
                <CardTitle>{log.action === "UPDATE" ? "Updated" : log.action} Tee Time</CardTitle>
                <CardDescription>{format(new Date(log.changed_at), "MMMM d, yyyy 'at' h:mm a")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-medium mb-2">Before</h3>
                    <pre className="bg-muted p-2 rounded text-xs overflow-auto">
                      {JSON.stringify(log.old_data, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">After</h3>
                    <pre className="bg-muted p-2 rounded text-xs overflow-auto">
                      {JSON.stringify(log.new_data, null, 2)}
                    </pre>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p>No logs found</p>
      )}
    </div>
  )
}
