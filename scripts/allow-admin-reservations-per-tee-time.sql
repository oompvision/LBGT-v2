-- Migration: allow admin-created reservations to coexist on the same tee time.
--
-- The reservations table has a unique constraint on (tee_time_id, user_id)
-- (reservations_tee_time_id_user_id_key) from back when user_id always meant
-- "the player who booked" — i.e. one person can't double-book a tee time.
--
-- adminCreateReservation (app/actions/reservation-edits.ts) stores the ADMIN's
-- user_id on every admin-created row as the audit owner, with the admin not
-- actually on the tee time. Under the old constraint that means an admin can
-- only ever create ONE reservation per tee time, and none in a slot where the
-- admin personally already has a reservation — so a second admin booking on
-- the same tee time fails with:
--   duplicate key value violates unique constraint "reservations_tee_time_id_user_id_key"
--
-- Fix: replace the table-level constraint with a PARTIAL unique index that
-- only applies to regular (member-owned) bookings. Admin-created rows are
-- identified exactly the way the app does it (lib/booking-summary.ts ->
-- isAdminCreatedReservation): array_length(player_names) == slots. Regular
-- bookings always have slots = 1 + player_names.length (booker + additional
-- players), so the predicate below covers every regular booking and excludes
-- every admin-created one — the "no double-booking a real player" guarantee
-- is unchanged for members.
--
-- Safe to run as-is: the old constraint guaranteed no duplicate (tee_time_id,
-- user_id) pairs among regular bookings, so the unique index will build; any
-- duplicate admin rows are excluded by the WHERE clause. Re-running is a no-op.
--
-- Run this in the Supabase SQL Editor.

ALTER TABLE reservations
  DROP CONSTRAINT IF EXISTS reservations_tee_time_id_user_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS reservations_tee_time_user_regular_unique
  ON reservations (tee_time_id, user_id)
  WHERE COALESCE(array_length(player_names, 1), 0) <> slots;
