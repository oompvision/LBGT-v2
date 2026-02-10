"use server"

import { createAdminClient } from "@/lib/supabase/server"
import { formatDate } from "@/lib/utils"

// Create a Supabase client with service role key to bypass RLS
const supabaseAdmin = createAdminClient()

// Helper function to convert array of objects to CSV
function objectsToCSV(data: Record<string, unknown>[], columns: { key: string; header: string }[]): string {
  // Create header row
  const headerRow = columns.map((col) => `"${col.header}"`).join(",")

  // Create data rows
  const rows = data.map((item) => {
    return columns
      .map((col) => {
        const value = col.key.split(".").reduce((obj, key) => (obj && obj[key] !== undefined ? obj[key] : ""), item)
        // Escape quotes and wrap in quotes
        return `"${String(value || "").replace(/"/g, '""')}"`
      })
      .join(",")
  })

  // Combine header and rows
  return [headerRow, ...rows].join("\n")
}

// Function to export reservations for a specific week
export async function exportReservationsToCSV(weekDate: string) {
  try {
    // Parse the provided date and get the month's start and end dates
    const date = new Date(weekDate)

    // Use the entire month instead of just a week
    const startDate = new Date(date.getFullYear(), date.getMonth(), 1)
    const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0)

    const startDateStr = formatDate(startDate).split("T")[0]
    const endDateStr = formatDate(endDate).split("T")[0]

    // Fetch all reservations for the month
    const { data: reservations, error } = await supabaseAdmin
      .from("reservations")
      .select(`
        id,
        user_id,
        slots,
        player_names,
        play_for_money,
        created_at,
        users (
          name,
          email
        ),
        tee_times (
          date,
          time
        )
      `)
      .gte("tee_times.date", startDateStr)
      .lte("tee_times.date", endDateStr)
      .order("tee_times(date)", { ascending: true })
      .order("tee_times(time)", { ascending: true })

    if (error) {
      console.error("Error fetching reservations:", error)
      return { success: false, error: error.message }
    }

    // Initialize an empty array to hold all player rows
    const playerRows: Record<string, unknown>[] = []

    // Process each reservation
    for (const reservation of reservations || []) {
      // Skip reservations with missing tee_times data
      if (!reservation.tee_times || !reservation.tee_times.date || !reservation.tee_times.time) {
        continue
      }

      const date = formatDate(new Date(reservation.tee_times.date))
      // Handle time formatting - reservation.tee_times.time is a string like "14:30:00"
      const timeString = reservation.tee_times.time
      let time = timeString
      if (timeString) {
        // Parse the time string and format it to 12-hour format
        const [hours, minutes] = timeString.split(":").map(Number)
        const date = new Date()
        date.setHours(hours, minutes, 0, 0)
        time = date.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
      }
      const createdAt = reservation.created_at ? new Date(reservation.created_at).toLocaleString() : "Unknown"

      // Add the main player (who made the reservation)
      playerRows.push({
        date,
        time,
        reservationId: reservation.id,
        playerName: reservation.users?.name || "Unknown User",
        playerEmail: reservation.users?.email || "No Email",
        playerType: "Main Player",
        playingForMoney: Array.isArray(reservation.play_for_money) && reservation.play_for_money[0] ? "Yes" : "No",
        created: createdAt,
      })

      // Add each additional player
      if (Array.isArray(reservation.player_names)) {
        for (let i = 0; i < reservation.player_names.length; i++) {
          const playerName = reservation.player_names[i]
          if (!playerName) continue // Skip empty player names

          // Determine if this player is playing for money
          let playingForMoney = "No"
          if (
            Array.isArray(reservation.play_for_money) &&
            reservation.play_for_money.length > i + 1 &&
            reservation.play_for_money[i + 1]
          ) {
            playingForMoney = "Yes"
          }

          playerRows.push({
            date,
            time,
            reservationId: reservation.id,
            playerName,
            playerEmail: "", // Additional players don't have emails in the system
            playerType: "Additional Player",
            playingForMoney,
            created: createdAt,
          })
        }
      }
    }

    if (playerRows.length === 0) {
      return {
        success: true,
        csv: "No valid reservations found for the selected period",
        filename: `reservations-${startDateStr}-to-${endDateStr}.csv`,
        count: 0,
      }
    }

    // Define CSV columns
    const columns = [
      { key: "date", header: "Date" },
      { key: "time", header: "Time" },
      { key: "reservationId", header: "Reservation ID" },
      { key: "playerName", header: "Player Name" },
      { key: "playerEmail", header: "Player Email" },
      { key: "playerType", header: "Player Type" },
      { key: "playingForMoney", header: "Playing for Money" },
      { key: "created", header: "Reservation Created" },
    ]

    // Generate CSV
    const csv = objectsToCSV(playerRows, columns)

    return {
      success: true,
      csv,
      filename: `reservations-${startDateStr}-to-${endDateStr}.csv`,
      count: playerRows.length,
    }
  } catch (error: any) {
    console.error("Error exporting reservations:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

// Function to export round scores (either for a specific week or all rounds)
export async function exportScoresToCSV(weekDate?: string) {
  try {
    let query = supabaseAdmin.from("scores").select(`
        id,
        hole_1, hole_2, hole_3, hole_4, hole_5, hole_6, hole_7, hole_8, hole_9,
        hole_10, hole_11, hole_12, hole_13, hole_14, hole_15, hole_16, hole_17, hole_18,
        total_score,
        net_hole_1, net_hole_2, net_hole_3, net_hole_4, net_hole_5, net_hole_6, net_hole_7, net_hole_8, net_hole_9,
        net_hole_10, net_hole_11, net_hole_12, net_hole_13, net_hole_14, net_hole_15, net_hole_16, net_hole_17, net_hole_18,
        net_total_score,
        strokes_given,
        users (
          id,
          name,
          email,
          strokes_given
        ),
        rounds (
          id,
          date,
          submitted_by,
          users:submitted_by (
            name,
            email
          )
        )
      `)

    // If a specific week is provided, filter by date range
    if (weekDate) {
      const date = new Date(weekDate)
      const startDate = new Date(date)
      startDate.setDate(date.getDate() - date.getDay()) // Sunday
      const endDate = new Date(startDate)
      endDate.setDate(startDate.getDate() + 6) // Saturday

      const startDateStr = formatDate(startDate).split("T")[0]
      const endDateStr = formatDate(endDate).split("T")[0]

      query = query.gte("rounds.date", startDateStr).lte("rounds.date", endDateStr)
    }

    // Execute the query
    const { data: scores, error } = await query.order("rounds(date)", { ascending: false })

    if (error) {
      console.error("Error fetching scores:", error)
      return { success: false, error: error.message }
    }

    // Filter out scores with missing rounds data
    const validScores = (scores || []).filter((score) => score.rounds && score.rounds.date)

    if (validScores.length === 0) {
      // Generate filename
      let filename = "all-scores.csv"
      if (weekDate) {
        const date = new Date(weekDate)
        const startDate = new Date(date)
        startDate.setDate(date.getDate() - date.getDay())
        const endDate = new Date(startDate)
        endDate.setDate(startDate.getDate() + 6)

        const startDateStr = formatDate(startDate).split("T")[0]
        const endDateStr = formatDate(endDate).split("T")[0]
        filename = `scores-${startDateStr}-to-${endDateStr}.csv`
      }

      return {
        success: true,
        csv: "No valid scores found for the selected criteria",
        filename,
        count: 0,
      }
    }

    // Format data for CSV
    const formattedData = validScores.map((score) => {
      // Create arrays of all hole scores (gross and net)
      const grossHoleScores = [
        score.hole_1 || 0,
        score.hole_2 || 0,
        score.hole_3 || 0,
        score.hole_4 || 0,
        score.hole_5 || 0,
        score.hole_6 || 0,
        score.hole_7 || 0,
        score.hole_8 || 0,
        score.hole_9 || 0,
        score.hole_10 || 0,
        score.hole_11 || 0,
        score.hole_12 || 0,
        score.hole_13 || 0,
        score.hole_14 || 0,
        score.hole_15 || 0,
        score.hole_16 || 0,
        score.hole_17 || 0,
        score.hole_18 || 0,
      ]

      const netHoleScores = [
        score.net_hole_1 || 0,
        score.net_hole_2 || 0,
        score.net_hole_3 || 0,
        score.net_hole_4 || 0,
        score.net_hole_5 || 0,
        score.net_hole_6 || 0,
        score.net_hole_7 || 0,
        score.net_hole_8 || 0,
        score.net_hole_9 || 0,
        score.net_hole_10 || 0,
        score.net_hole_11 || 0,
        score.net_hole_12 || 0,
        score.net_hole_13 || 0,
        score.net_hole_14 || 0,
        score.net_hole_15 || 0,
        score.net_hole_16 || 0,
        score.net_hole_17 || 0,
        score.net_hole_18 || 0,
      ]

      // Calculate front nine, back nine (gross and net)
      const frontNineGross = grossHoleScores.slice(0, 9).reduce((sum, score) => sum + (score || 0), 0)
      const backNineGross = grossHoleScores.slice(9, 18).reduce((sum, score) => sum + (score || 0), 0)
      const frontNineNet = netHoleScores.slice(0, 9).reduce((sum, score) => sum + (score || 0), 0)
      const backNineNet = netHoleScores.slice(9, 18).reduce((sum, score) => sum + (score || 0), 0)

      return {
        date: formatDate(new Date(score.rounds.date)),
        player: score.users?.name || "Unknown Player",
        email: score.users?.email || "No Email",
        strokesGiven: score.strokes_given || score.users?.strokes_given || 0,
        submittedBy: score.rounds.users?.name || "Unknown Submitter",
        submitterEmail: score.rounds.users?.email || "No Email",
        // Gross scores
        hole1: score.hole_1 || 0,
        hole2: score.hole_2 || 0,
        hole3: score.hole_3 || 0,
        hole4: score.hole_4 || 0,
        hole5: score.hole_5 || 0,
        hole6: score.hole_6 || 0,
        hole7: score.hole_7 || 0,
        hole8: score.hole_8 || 0,
        hole9: score.hole_9 || 0,
        frontNineGross,
        hole10: score.hole_10 || 0,
        hole11: score.hole_11 || 0,
        hole12: score.hole_12 || 0,
        hole13: score.hole_13 || 0,
        hole14: score.hole_14 || 0,
        hole15: score.hole_15 || 0,
        hole16: score.hole_16 || 0,
        hole17: score.hole_17 || 0,
        hole18: score.hole_18 || 0,
        backNineGross,
        totalGrossScore: score.total_score || 0,
        // Net scores
        netHole1: score.net_hole_1 || 0,
        netHole2: score.net_hole_2 || 0,
        netHole3: score.net_hole_3 || 0,
        netHole4: score.net_hole_4 || 0,
        netHole5: score.net_hole_5 || 0,
        netHole6: score.net_hole_6 || 0,
        netHole7: score.net_hole_7 || 0,
        netHole8: score.net_hole_8 || 0,
        netHole9: score.net_hole_9 || 0,
        frontNineNet,
        netHole10: score.net_hole_10 || 0,
        netHole11: score.net_hole_11 || 0,
        netHole12: score.net_hole_12 || 0,
        netHole13: score.net_hole_13 || 0,
        netHole14: score.net_hole_14 || 0,
        netHole15: score.net_hole_15 || 0,
        netHole16: score.net_hole_16 || 0,
        netHole17: score.net_hole_17 || 0,
        netHole18: score.net_hole_18 || 0,
        backNineNet,
        totalNetScore: score.net_total_score || 0,
      }
    })

    // Define CSV columns
    const columns = [
      { key: "date", header: "Date" },
      { key: "player", header: "Player" },
      { key: "email", header: "Email" },
      { key: "strokesGiven", header: "Strokes Given" },
      { key: "submittedBy", header: "Submitted By" },
      { key: "submitterEmail", header: "Submitter Email" },
      // Gross score columns
      { key: "hole1", header: "Hole 1 (Gross)" },
      { key: "hole2", header: "Hole 2 (Gross)" },
      { key: "hole3", header: "Hole 3 (Gross)" },
      { key: "hole4", header: "Hole 4 (Gross)" },
      { key: "hole5", header: "Hole 5 (Gross)" },
      { key: "hole6", header: "Hole 6 (Gross)" },
      { key: "hole7", header: "Hole 7 (Gross)" },
      { key: "hole8", header: "Hole 8 (Gross)" },
      { key: "hole9", header: "Hole 9 (Gross)" },
      { key: "frontNineGross", header: "Front 9 (Gross)" },
      { key: "hole10", header: "Hole 10 (Gross)" },
      { key: "hole11", header: "Hole 11 (Gross)" },
      { key: "hole12", header: "Hole 12 (Gross)" },
      { key: "hole13", header: "Hole 13 (Gross)" },
      { key: "hole14", header: "Hole 14 (Gross)" },
      { key: "hole15", header: "Hole 15 (Gross)" },
      { key: "hole16", header: "Hole 16 (Gross)" },
      { key: "hole17", header: "Hole 17 (Gross)" },
      { key: "hole18", header: "Hole 18 (Gross)" },
      { key: "backNineGross", header: "Back 9 (Gross)" },
      { key: "totalGrossScore", header: "Total Score (Gross)" },
      // Net score columns
      { key: "netHole1", header: "Hole 1 (Net)" },
      { key: "netHole2", header: "Hole 2 (Net)" },
      { key: "netHole3", header: "Hole 3 (Net)" },
      { key: "netHole4", header: "Hole 4 (Net)" },
      { key: "netHole5", header: "Hole 5 (Net)" },
      { key: "netHole6", header: "Hole 6 (Net)" },
      { key: "netHole7", header: "Hole 7 (Net)" },
      { key: "netHole8", header: "Hole 8 (Net)" },
      { key: "netHole9", header: "Hole 9 (Net)" },
      { key: "frontNineNet", header: "Front 9 (Net)" },
      { key: "netHole10", header: "Hole 10 (Net)" },
      { key: "netHole11", header: "Hole 11 (Net)" },
      { key: "netHole12", header: "Hole 12 (Net)" },
      { key: "netHole13", header: "Hole 13 (Net)" },
      { key: "netHole14", header: "Hole 14 (Net)" },
      { key: "netHole15", header: "Hole 15 (Net)" },
      { key: "netHole16", header: "Hole 16 (Net)" },
      { key: "netHole17", header: "Hole 17 (Net)" },
      { key: "netHole18", header: "Hole 18 (Net)" },
      { key: "backNineNet", header: "Back 9 (Net)" },
      { key: "totalNetScore", header: "Total Score (Net)" },
    ]

    // Generate CSV
    const csv = objectsToCSV(formattedData, columns)

    // Generate filename
    let filename = "all-scores.csv"
    if (weekDate) {
      const date = new Date(weekDate)
      const startDate = new Date(date)
      startDate.setDate(date.getDate() - date.getDay())
      const endDate = new Date(startDate)
      endDate.setDate(startDate.getDate() + 6)

      const startDateStr = formatDate(startDate).split("T")[0]
      const endDateStr = formatDate(endDate).split("T")[0]
      filename = `scores-${startDateStr}-to-${endDateStr}.csv`
    }

    return {
      success: true,
      csv,
      filename,
      count: formattedData.length,
    }
  } catch (error: any) {
    console.error("Error exporting scores:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}
