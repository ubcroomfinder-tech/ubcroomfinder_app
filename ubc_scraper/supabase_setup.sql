-- DROPING TABLES
DROP TABLE IF EXISTS Bookings CASCADE;
DROP TABLE IF EXISTS Rooms CASCADE;

-- Table for Rooms
CREATE TABLE Rooms (
    room_number VARCHAR(50),
    building VARCHAR(50),
    capacity INT,
    features VARCHAR(1000),
    PRIMARY KEY (room_number,building)
);

-- Table for Bookings
CREATE TABLE Bookings (
    booking_id SERIAL PRIMARY KEY,
    room_number VARCHAR(50),
    building VARCHAR(50),
    FOREIGN KEY (room_number,building) REFERENCES Rooms,
    start_time  TIMESTAMP,
    end_time    TIMESTAMP,
    course_code VARCHAR(100),
    instructor VARCHAR(100),
    booking_type VARCHAR(20) -- e.g., LEC, MAINT
);

alter table Rooms enable row level security;
create policy "Allow public read access" on Rooms
for select
using (true);

alter table Bookings enable row level security;
create policy "Allow public read access" on Bookings
for select
using (true);

--------------------------------------------------------------------
-- INDICIES FOR QUERY OPTIMIZATION
--------------------------------------------------------------------

-- 1. For the Anti-Join (Overlap Check)
CREATE INDEX IF NOT EXISTS idx_bookings_overlap 
ON public.bookings (building, room_number, start_time, end_time);

-- 2. For the Lateral Join (Next Booking Lookup)
CREATE INDEX IF NOT EXISTS idx_bookings_next_time 
ON public.bookings (building, room_number, start_time);

-- Optional but recommended for the main table lookup
CREATE INDEX IF NOT EXISTS idx_rooms_pk ON public.rooms (building, room_number);

--------------------------------------------------------------------
-- QUERIES
--------------------------------------------------------------------

-- Drop old functions if they exist
DROP FUNCTION IF EXISTS public.free_rooms_per_building(timestamp, timestamp) CASCADE;
DROP FUNCTION IF EXISTS public.free_rooms_list(timestamp, timestamp) CASCADE;
DROP FUNCTION IF EXISTS public.get_table_last_modified() CASCADE;

-- Function: Gets free rooms per building
CREATE OR REPLACE FUNCTION public.free_rooms_per_building(
  p_start timestamp,
  p_end timestamp
)
RETURNS TABLE(building text, free_room_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    r.building::text,
    COUNT(*)::bigint AS free_room_count
  FROM Rooms r
  WHERE NOT EXISTS (
    SELECT 1
    FROM Bookings b
    WHERE b.room_number = r.room_number
      AND b.building = r.building
      AND b.start_time < p_end
      AND b.end_time > p_start
  )
  GROUP BY r.building
  ORDER BY free_room_count DESC, building ASC;
END;
$function$;

-- Function: Gets the free rooms given a time 
CREATE OR REPLACE FUNCTION public.free_rooms_list(
  p_start timestamp,
  p_end timestamp
)
RETURNS TABLE(
  room_number text,  -- Changed from int to text
  building text,
  capacity int,
  features text,
  earliest_booking timestamp
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH free_count AS (
    SELECT 
      r.building,
      COUNT(*) AS free_room_count
    FROM Rooms r
    WHERE NOT EXISTS (
      SELECT 1
      FROM Bookings b
      WHERE b.room_number = r.room_number
        AND b.building = r.building
        AND b.start_time < p_end
        AND b.end_time > p_start
    )
    GROUP BY r.building
  )
  SELECT
    r.room_number::text,  -- Added ::text cast for safety
    r.building::text,
    r.capacity,
    r.features::text,
    (
      SELECT MIN(b.start_time)
      FROM Bookings b
      WHERE b.room_number = r.room_number
        AND b.building = r.building
        AND b.start_time >= p_end
        AND DATE(b.start_time) = DATE(p_start)  -- only same day bookings
    ) AS earliest_booking
  FROM Rooms r
  JOIN free_count fc ON r.building = fc.building
  WHERE NOT EXISTS (
    SELECT 1
    FROM Bookings b
    WHERE b.room_number = r.room_number
      AND b.building = r.building
      AND b.start_time < p_end
      AND b.end_time > p_start
  )
  ORDER BY 
    fc.free_room_count DESC, 
    earliest_booking DESC NULLS FIRST, -- "Free rest of day" and latest times first
    r.building ASC, 
    r.room_number ASC;
END;
$$;

-- Function: Gets the last time the DB was modified
CREATE OR REPLACE FUNCTION get_table_last_modified()
RETURNS TABLE(last_autoanalyze timestamptz, last_autovacuum timestamptz) 
LANGUAGE sql
SECURITY DEFINER
AS $function$
  SELECT last_autoanalyze, last_autovacuum
  FROM pg_stat_user_tables
  WHERE schemaname = 'public' 
  AND relname = 'bookings';
$function$;

-- Function: Gets availability for a single room
CREATE OR REPLACE FUNCTION public.get_room_availability(
  p_building text,
  p_room_number text,
  p_date date
)
RETURNS TABLE(
  gap_start timestamp,
  gap_end timestamp
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  day_start timestamp := p_date + time '07:00'; -- Campus opens
  day_end   timestamp := p_date + time '22:00'; -- Campus closes
BEGIN
  RETURN QUERY
  WITH RECURSIVE
  -- 1. Get all bookings for the day
  actual_bookings AS (
    SELECT start_time, end_time
    FROM Bookings
    WHERE building = p_building
      AND room_number = p_room_number
      AND start_time < day_end
      AND end_time > day_start
    ORDER BY start_time ASC
  ),
  -- 2. Create a list of all relevant "time points" (opening, start/ends of classes, closing)
  time_points AS (
    SELECT day_start AS pt
    UNION
    SELECT start_time FROM actual_bookings
    UNION
    SELECT end_time FROM actual_bookings
    UNION
    SELECT day_end
  ),
  -- 3. Create segments between every time point
  segments AS (
    SELECT 
      pt AS s_start, 
      LEAD(pt) OVER (ORDER BY pt) AS s_end
    FROM time_points
  )
  -- 4. Return only segments that don't overlap with any booking
  SELECT s_start, s_end
  FROM segments
  WHERE s_end > s_start
    AND NOT EXISTS (
      SELECT 1 FROM actual_bookings b
      WHERE b.start_time < s_end 
        AND b.end_time > s_start
    )
  ORDER BY s_start ASC;
END;
$$;

-- Function: Gets feilds for autocomplete
CREATE OR REPLACE FUNCTION public.search_rooms(p_query text)
RETURNS TABLE(room_label text, building text, room_number text)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    building || ' ' || room_number as room_label,
    building,
    room_number
  FROM Rooms
  WHERE (building || ' ' || room_number) ILIKE '%' || p_query || '%'
     OR (building || room_number) ILIKE '%' || p_query || '%'
  ORDER BY building ASC, room_number ASC
  LIMIT 10;
$$;
