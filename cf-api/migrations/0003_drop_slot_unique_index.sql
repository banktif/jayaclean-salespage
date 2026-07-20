-- Drop per-slot uniqueness constraint to allow 100+ bookings/day (multi-booking per time slot)
DROP INDEX IF EXISTS idx_slots_date_time_booked;
