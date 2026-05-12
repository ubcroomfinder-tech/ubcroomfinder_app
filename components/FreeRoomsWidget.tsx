'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type BuildingCount = {
  building: string
  free_room_count: number
}

type FreeRoom = {
  room_number: string
  building: string
  capacity: number
  features: string | null
  earliest_booking: string | null
}

const ROWS_PER_PAGE = 10 

export default function FreeRoomsWidget() {
  const supabase = createClient()

  const [selectedDate, setSelectedDate] = useState<string>('')
  const [startTime, setStartTime] = useState<string>('')
  const [endTime, setEndTime] = useState<string>('')
  const [perBuilding, setPerBuilding] = useState<BuildingCount[]>([])
  const [freeRooms, setFreeRooms] = useState<FreeRoom[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null)
  const [isClient, setIsClient] = useState(false)
  const [typingStart, setTypingStart] = useState<string | null>(null)
  const [typingEnd, setTypingEnd] = useState<string | null> (null)
  const [startDelta, setStartDelta] = useState<number>(180) 
  const [currentBuildingPage, setCurrentBuildingPage] = useState(1)
  const [currentRoomPage, setCurrentRoomPage] = useState(1)
  const [buildingSearch, setBuildingSearch] = useState<string>('')

  const formatBuildingMapLink = (building: string) =>
    `https://maps.ubc.ca/?code=${building}`

  const formatRoomLink = (building: string, room_number: string) =>
    `https://learningspaces.ubc.ca/find-a-space/?classroom=${building.toLowerCase()}-${room_number}`

  useEffect(() => {
    setIsClient(true)
    const now = new Date()
    const later = new Date(now.getTime() + 3 * 60 * 60 * 1000)
    let startTimeStr = now.toTimeString().slice(0, 5)
    let endTimeStr = later.toTimeString().slice(0, 5)

    const initialClamp = (time: string): string => {
      if (time < "07:00") return "07:00"
      if (time > "22:00") return "22:00"
      return time
    }

    startTimeStr = initialClamp(startTimeStr)
    endTimeStr = initialClamp(endTimeStr)

    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const localDateStr = `${year}-${month}-${day}`

    setSelectedDate(localDateStr)
    setStartTime(startTimeStr)
    setEndTime(endTimeStr)

    const deltaMinutes =
      parseInt(endTimeStr.slice(0, 2)) * 60 +
      parseInt(endTimeStr.slice(3)) -
      (parseInt(startTimeStr.slice(0, 2)) * 60 + parseInt(startTimeStr.slice(3)))
    setStartDelta(deltaMinutes)

    fetchData(localDateStr, startTimeStr, endTimeStr)
  }, [])

  useEffect(() => {
    if (!typingStart) return
    const timer = setTimeout(() => {
      const newStart = typingStart
      let [h, m] = newStart.split(":").map(Number)
      let newEndMinutes = h * 60 + m + startDelta
      if (newEndMinutes > 24 * 60) newEndMinutes = 24 * 60 
      if (newEndMinutes < 0) newEndMinutes = 0
      const newEnd = `${String(Math.floor(newEndMinutes / 60) % 24).padStart(2, "0")}:${String(newEndMinutes % 60).padStart(2, "0")}`
      setStartTime(newStart) 
      setEndTime(newEnd)
      setTypingStart(null)
    }, 350)
    return () => clearTimeout(timer)
  }, [typingStart, startDelta])

  useEffect(() => {
    if (!typingEnd) return
    const timer = setTimeout(() => {
      const newEnd = typingEnd
      const startMinutes = parseInt(startTime.slice(0, 2)) * 60 + parseInt(startTime.slice(3))
      const endMinutes = parseInt(newEnd.slice(0, 2)) * 60 + parseInt(newEnd.slice(3))
      setStartDelta(endMinutes - startMinutes)
      setEndTime(newEnd) 
      setTypingEnd(null)
    }, 350)
    return () => clearTimeout(timer)
  }, [typingEnd, startTime])

  const fetchData = async (date?: string, start?: string, end?: string) => {
    const d = date ?? selectedDate
    const sRaw = start ?? startTime
    const eRaw = end ?? endTime
    if (!d || !sRaw || !eRaw) return
    
    setLoading(true)
    const rpcOptions = { head: false, schema: 'public' }
    const startTs = `${d} ${sRaw}:00`
    const endTs = `${d} ${eRaw}:00`

    const { data: perBuildingData } = await supabase.rpc("free_rooms_per_building", { p_start: startTs, p_end: endTs }, rpcOptions) 
    const { data: freeRoomsData } = await supabase.rpc("free_rooms_list", { p_start: startTs, p_end: endTs }, rpcOptions) 
      
    setPerBuilding(perBuildingData ?? [])
    setFreeRooms(freeRoomsData ?? [])
    setSelectedBuilding(null)
    setCurrentBuildingPage(1)
    setCurrentRoomPage(1)
    setLoading(false)
  }

  const handleRoomPageChange = (page: number) => {
    if (page >= 1 && page <= Math.ceil(filteredRooms.length / ROWS_PER_PAGE)) {
      setCurrentRoomPage(page);
    }
  };

  const handleBuildingPageChange = (page: number) => {
    if (page >= 1 && page <= Math.ceil(filteredBuildings.length / ROWS_PER_PAGE)) {
      setCurrentBuildingPage(page);
    }
  };

  const toggleBuilding = (building: string) => {
    setSelectedBuilding((prev) => (prev === building ? null : building))
    setCurrentRoomPage(1)
  }

  const filteredRooms = selectedBuilding
    ? freeRooms.filter((room) => room.building === selectedBuilding)
    : freeRooms

  const filteredBuildings = perBuilding.filter((row) =>
    row.building.toLowerCase().includes(buildingSearch.toLowerCase())
  )

  useEffect(() => {
    setCurrentBuildingPage(1)
  }, [buildingSearch])

  const totalBuildingPages = Math.ceil(filteredBuildings.length / ROWS_PER_PAGE)
  const paginatedBuildings = filteredBuildings.slice((currentBuildingPage - 1) * ROWS_PER_PAGE, currentBuildingPage * ROWS_PER_PAGE)

  const totalRoomPages = Math.ceil(filteredRooms.length / ROWS_PER_PAGE)
  const roomStartIndex = (currentRoomPage - 1) * ROWS_PER_PAGE
  const paginatedRooms = filteredRooms.slice(roomStartIndex, currentRoomPage * ROWS_PER_PAGE)

  if (!isClient) return null

  return (
    <div className="p-4 md:p-8 w-full max-w-4xl mx-auto bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white">Free Room Search</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Locate available study spaces across campus.</p>
      </div>

      <div className="bg-gray-50 dark:bg-gray-800/40 p-4 md:p-6 rounded-2xl mb-10 border border-gray-100 dark:border-gray-700/50">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-6">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 ml-1">Date</label>
            <input 
              type="date" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)} 
              className="w-full min-w-0 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/50 dark:text-gray-100 text-sm md:text-base" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 ml-1">Start Time</label>
            <input 
              type="time" 
              value={typingStart ?? startTime} 
              onChange={(e) => setTypingStart(e.target.value)} 
              className="w-full min-w-0 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/50 dark:text-gray-100 text-sm md:text-base" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 ml-1">End Time</label>
            <input 
              type="time" 
              value={typingEnd ?? endTime} 
              onChange={(e) => setTypingEnd(e.target.value)} 
              className="w-full min-w-0 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/50 dark:text-gray-100 text-sm md:text-base" 
            />
          </div>
        </div>
        <button 
          onClick={() => fetchData()} 
          disabled={loading} 
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20 disabled:bg-gray-400 uppercase tracking-widest text-xs"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Buildings</h2>
          </div>
          <div className="relative group">
            <input type="text" placeholder="Filter buildings..." value={buildingSearch} onChange={(e) => setBuildingSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none" />
            <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <div className="space-y-1">
            {paginatedBuildings.map((row) => (
              <div key={row.building} onClick={() => toggleBuilding(row.building)} className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${selectedBuilding === row.building ? "bg-blue-600 text-white shadow-md" : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"}`}>
                <div className="flex flex-col">
                  <span className="font-bold text-sm uppercase tracking-tight">{row.building}</span>
                  <a href={formatBuildingMapLink(row.building)} target="_blank" onClick={(e) => e.stopPropagation()} className={`text-[10px] font-medium ${selectedBuilding === row.building ? "text-blue-100" : "text-blue-500"} hover:underline uppercase`}>Directions ↗</a>
                </div>
                <span className={`text-xs font-black px-2 py-1 rounded-lg ${selectedBuilding === row.building ? "bg-blue-500" : "bg-gray-100 dark:bg-gray-700"}`}>{row.free_room_count}</span>
              </div>
            ))}
          </div>
          {totalBuildingPages > 1 && (
            <div className="flex items-center justify-between px-1">
              <button onClick={() => handleBuildingPageChange(currentBuildingPage - 1)} disabled={currentBuildingPage === 1} className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-30 text-xs font-bold uppercase">Prev</button>
              <span className="text-[10px] font-bold text-gray-400 uppercase">Page {currentBuildingPage} / {totalBuildingPages}</span>
              <button onClick={() => handleBuildingPageChange(currentBuildingPage + 1)} disabled={currentBuildingPage === totalBuildingPages} className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-30 text-xs font-bold uppercase">Next</button>
            </div>
          )}
        </div>

        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between px-1">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {selectedBuilding ? `Rooms in ${selectedBuilding}` : "All Available Rooms"}
              </h2>
              <p className="text-[10px] text-blue-500 dark:text-blue-400 font-medium italic">
                Click a row to view room photos ↗
              </p>
            </div>
            <span className="text-[10px] font-black bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 rounded text-blue-600 dark:text-blue-400">{filteredRooms.length} Found</span>
          </div>
          
          {/* Table Container with Horizontal Scroll fix */}
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-x-auto shadow-sm">
            <table className="w-full text-left border-collapse min-w-[400px]">
              <thead>
                <tr className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-left">Room</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-left">Capcaity</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-left">Until</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {paginatedRooms.map((room, i) => (
                  <tr key={i} className="group transition-colors">
                    <td colSpan={3} className="p-0">
                      <a 
                        href={formatRoomLink(room.building, room.room_number)} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="grid grid-cols-3 w-full items-center px-6 py-4 hover:bg-blue-50/30 dark:hover:bg-blue-900/20 transition-all cursor-pointer"
                      >
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {room.room_number}
                          </span>
                          {!selectedBuilding && <span className="text-[10px] text-gray-400 uppercase font-bold">{room.building}</span>}
                        </div>
                        <div>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            {room.capacity}
                          </span>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                            {room.earliest_booking ? new Date(room.earliest_booking).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "EOD"}
                          </span>
                        </div>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalRoomPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between px-1 mt-6 gap-4">
              <span className="text-[10px] font-bold text-gray-400 uppercase">Showing {roomStartIndex + 1}-{Math.min(roomStartIndex + ROWS_PER_PAGE, filteredRooms.length)} of {filteredRooms.length}</span>
              <div className="flex gap-2">
                <button onClick={() => handleRoomPageChange(currentRoomPage - 1)} disabled={currentRoomPage === 1} className="px-4 py-1.5 text-xs font-bold border rounded-lg disabled:opacity-30 bg-white dark:bg-gray-800 uppercase">Prev</button>
                <button onClick={() => handleRoomPageChange(currentRoomPage + 1)} disabled={currentRoomPage === totalRoomPages} className="px-4 py-1.5 text-xs font-bold border rounded-lg disabled:opacity-30 bg-white dark:bg-gray-800 uppercase">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}