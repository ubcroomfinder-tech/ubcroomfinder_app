'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type DisclaimerWidgetProps = {
  title?: string
  text?: React.ReactNode
}

export default function DisclaimerWidget({ title = "Disclaimer", text }: DisclaimerWidgetProps) {
  const supabase = createClient()
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [latestBookingEnd, setLatestBookingEnd] = useState<string | null>(null)
  const [earliestBookingStart, setEarliestBookingStart] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: rpcData } = await supabase.rpc('get_table_last_modified')
        const lastModified = rpcData?.[0]?.last_modified || rpcData?.[0]?.last_autoanalyze || rpcData?.[0]?.last_autovacuum
        setLastUpdated(lastModified ? new Date(lastModified).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "Unknown")

        const { data: endData } = await supabase
          .from('bookings')
          .select('end_time')
          .order('end_time', { ascending: false })
          .limit(1)
          .maybeSingle()
        setLatestBookingEnd(endData?.end_time ? new Date(endData.end_time).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "Unknown")

        const { data: startData } = await supabase
          .from('bookings')
          .select('start_time')
          .order('start_time', { ascending: true })
          .limit(1)
          .maybeSingle()
        setEarliestBookingStart(startData?.start_time ? new Date(startData.start_time).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "Unknown")

      } catch (error) {
        console.error("Error fetching disclaimer data:", error)
        setLastUpdated("Unknown")
        setLatestBookingEnd("Unknown")
        setEarliestBookingStart("Unknown")
      }
    }
    fetchData()
  }, [supabase])

  return (
    <div className="p-8 w-full max-w-4xl mx-auto bg-[#0f172a] rounded-2xl shadow-2xl border border-orange-500/30 relative overflow-hidden">
      {/* Accent Glow */}
      <div className="absolute top-0 left-0 w-1 h-full bg-orange-500" />

      <div className="flex items-center gap-3 mb-4">
        <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h2 className="text-xl font-black text-white uppercase tracking-tighter">{title}</h2>
      </div>

      <div className="space-y-6 text-[15px] leading-relaxed">
        <p className="text-slate-300">
          This site is for informational purposes only and is <span className="font-black text-orange-500 underline decoration-2 underline-offset-4">NOT affiliated with UBC</span> in any official capacity. Room availability data is a static snapshot from the {" "}
          <a
            href="https://sws-van.as.it.ubc.ca/SWS_2025/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 font-bold hover:text-blue-300 transition-colors underline decoration-blue-400/30"
          >
            UBC Online Timetable
          </a>{" "}
          and may be inaccurate or outdated.
        </p>

        {/* Data Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4 border-y border-slate-800">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Last Refresh</span>
            <span className="text-xs font-mono text-blue-400">{lastUpdated || 'Loading...'}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Data Start</span>
            <span className="text-xs font-mono text-slate-400">{earliestBookingStart || 'Loading...'}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Data End</span>
            <span className="text-xs font-mono text-slate-400">{latestBookingEnd || 'Loading...'}</span>
          </div>
        </div>

        <p className="text-slate-300 font-medium">
          <span className="text-orange-500 font-black italic">ALERT:</span> This is <span className="text-white font-bold">NOT</span> a booking system. A room listed as free does <span className="text-white font-bold">NOT</span> guarantee that it is unoccupied.
        </p>

        <div className="mt-8 p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-start gap-3">
          <svg className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm leading-relaxed text-orange-200/90">
            <span className="font-black uppercase tracking-tighter mr-1 text-orange-500">Important:</span> 
            Please <span className="text-white font-bold underline decoration-orange-500/50">do not share this site widely</span>. 
            High traffic may force this site offline and more users may also lead to fewer unoccupied rooms.</p>
        </div>
      </div>
    </div>
  )
}