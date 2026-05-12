'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type AvailabilityGap = {
  gap_start: string
  gap_end: string
}

type RoomSuggestion = {
  room_label: string
  building: string
  room_number: string
}

export default function RoomAvailabilitySearch() {
  const supabase = createClient()

  // State
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<RoomSuggestion[]>([])
  const [activeIndex, setActiveIndex] = useState(-1) 
  const [selectedRoom, setSelectedRoom] = useState<RoomSuggestion | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>('') 
  const [availability, setAvailability] = useState<AvailabilityGap[]>([])
  const [loading, setLoading] = useState(false)

  // 1. Set initial date on client mount
  useEffect(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const localDateStr = `${year}-${month}-${day}`
    setSelectedDate(localDateStr)
  }, [])

  // 2. Handle Autocomplete Search
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (query.length < 2) {
        setSuggestions([])
        setActiveIndex(-1)
        return
      }
      const { data } = await supabase.rpc('search_rooms', { p_query: query })
      const results = data || []
      setSuggestions(results)
      setActiveIndex(results.length > 0 ? 0 : -1) 
    }

    const timer = setTimeout(fetchSuggestions, 300)
    return () => clearTimeout(timer)
  }, [query, supabase])

  // 3. Fetch Room Schedule
  const fetchSchedule = async (room: RoomSuggestion, date: string) => {
    setLoading(true)
    const { data, error } = await supabase.rpc('get_room_availability', {
      p_building: room.building,
      p_room_number: room.room_number,
      p_date: date
    })
    if (!error) setAvailability(data || [])
    setLoading(false)
  }

  // Helpers
  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  }

  const calculateDuration = (start: string, end: string) => {
    const startDate = new Date(start)
    const endDate = new Date(end)
    const diffInMs = endDate.getTime() - startDate.getTime()
    
    const totalMinutes = Math.floor(diffInMs / (1000 * 60))
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60

    if (hours === 15 && minutes === 0) {
      return "Free all day"
    }

    return `${hours}h ${minutes.toString().padStart(2, '0')}m`
  }

  const formatRoomLink = (building: string, room_number: string) =>
    `https://learningspaces.ubc.ca/find-a-space/?classroom=${building.toLowerCase()}-${room_number}`

  const handleSelectRoom = (room: RoomSuggestion) => {
    setSelectedRoom(room)
    setQuery(room.room_label)
    setSuggestions([])
    setActiveIndex(-1)
    fetchSchedule(room, selectedDate)
  }

  const handleInputChange = (val: string) => {
    setQuery(val)
    if (selectedRoom && val !== selectedRoom.room_label) {
      setSelectedRoom(null)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : prev))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        handleSelectRoom(suggestions[activeIndex])
      }
    } else if (e.key === 'Escape') {
      setSuggestions([])
      setActiveIndex(-1)
    }
  }

  return (
    /* Change 1: Responsive padding and overflow-hidden */
    <div className="p-4 md:p-8 w-full max-w-4xl mx-auto bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
      <div className="mb-8">
        <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Room Availability</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Find real-time gaps in classroom schedules.</p>
      </div>
      
      {/* Change 2: Adjusted gap and grid behavior */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-10">
        <div className="relative md:col-span-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 ml-1">Building or Room</label>
          <div className="relative group">
            <input
              type="text"
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. ORCH 3052"
              /* Added min-w-0 and adjusted padding */
              className="w-full min-w-0 pl-4 pr-10 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 dark:text-gray-100 transition-all text-sm md:text-base"
            />
            {query && (
              <button 
                onClick={() => { setQuery(''); setSelectedRoom(null); setSuggestions([]); }}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>

          {suggestions.length > 0 && (
            <ul className="absolute z-30 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl mt-2 overflow-hidden ring-1 ring-black ring-opacity-5">
              {suggestions.map((s, index) => (
                <li
                  key={s.room_label}
                  onClick={() => handleSelectRoom(s)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`px-4 py-3 cursor-pointer text-sm dark:text-gray-100 flex justify-between items-center transition-colors ${
                    index === activeIndex ? 'bg-blue-600 text-white' : 'hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{s.room_label}</span>
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${index === activeIndex ? 'bg-blue-500' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                    {s.building}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 ml-1">Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value)
              if (selectedRoom) fetchSchedule(selectedRoom, e.target.value)
            }}
            /* Change 3: Added min-w-0 and text-sm for better mobile scaling */
            className="w-full min-w-0 px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 dark:text-gray-100 transition-all text-sm md:text-base"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-blue-100 dark:border-blue-900"></div>
            <div className="absolute top-0 h-12 w-12 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
          </div>
          <p className="mt-4 text-sm font-medium text-gray-500 dark:text-gray-400 animate-pulse">Syncing schedule...</p>
        </div>
      ) : selectedRoom ? (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {selectedRoom.room_label}
                </h3>
                <a href={formatRoomLink(selectedRoom.building, selectedRoom.room_number)} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1">
                  View Room Details
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                </a>
              </div>
            </div>
          </div>

          {availability.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {availability.map((gap, i) => {
                const durationText = calculateDuration(gap.gap_start, gap.gap_end);
                const isAllDay = durationText === "Free all day";
                return (
                  <div key={i} className={`group flex flex-col sm:flex-row items-center justify-between p-4 md:p-5 rounded-2xl border transition-all duration-300 ${
                    isAllDay 
                    ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/50' 
                    : 'bg-gray-50 dark:bg-gray-800/40 border-gray-100 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'
                  }`}>
                    <div className="flex items-center gap-4 w-full sm:w-auto mb-4 sm:mb-0">
                      <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${isAllDay ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-700 text-gray-400 dark:text-gray-300 shadow-sm'}`}>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Time Slot</span>
                        <div className="flex items-center gap-2">
                          <span className="text-base md:text-lg font-bold text-gray-900 dark:text-gray-100">{formatTime(gap.gap_start)}</span>
                          <span className="text-gray-400">→</span>
                          <span className="text-base md:text-lg font-bold text-gray-900 dark:text-gray-100">{formatTime(gap.gap_end)}</span>
                        </div>
                      </div>
                    </div>

                    <div className={`w-full sm:w-auto text-center px-6 py-2 rounded-full text-sm font-bold shadow-sm ${
                      isAllDay 
                      ? 'bg-blue-600 text-white ring-4 ring-blue-500/20' 
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-100 dark:border-gray-600'
                    }`}>
                      {durationText}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-10 text-center bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-2xl">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 mb-4">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <p className="text-red-800 dark:text-red-300 font-semibold italic">Fully booked for the entire day.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 md:py-20 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-2xl bg-gray-50/30 dark:bg-gray-900/30 transition-all">
          <div className="mx-auto h-16 w-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4 text-gray-400">
             <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <h4 className="text-gray-900 dark:text-gray-100 font-bold px-4">No room selected</h4>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-xs mx-auto px-4">Type a room code above to see exactly when it's free today.</p>
        </div>
      )}
    </div>
  )
}