import { hasEnvVars } from "@/lib/utils";
import FreeRoomsWidget from "@/components/FreeRoomsWidget";
import DisclaimerWidget from "@/components/DisclaimerWidget";
import RoomAvailabilitySearch from "@/components/RoomAvailabitySearch";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center bg-[#020617] text-white">
      <div className="flex-1 w-full flex flex-col gap-8 items-center">
        
        {/* Navigation - Left Aligned to Widgets */}
        <nav className="w-full flex justify-center border-b border-white/5 bg-[#0f172a]/50 backdrop-blur-md sticky top-0 z-50 py-4">
          <div className="w-full max-w-4xl flex justify-start items-center px-4">
            {/* Title with Favicon aligned flush left */}
            <div className="flex items-center gap-3">
              {/* Icon Container - Transparent background, no shadow */}
              <div className="w-10 h-10 overflow-hidden flex-shrink-0 bg-transparent">
                <img 
                  src="/favicon.ico" 
                  alt="UBC Logo" 
                  className="w-full h-full block object-contain" 
                />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tighter uppercase italic">
                UBC <span className="text-blue-500">Room</span> Finder
              </h1>
            </div>
          </div>           
        </nav>

        {/* Content Blocks */}
        <div className="w-full max-w-4xl px-4 flex flex-col gap-8">
          <DisclaimerWidget />
          <FreeRoomsWidget />
          <RoomAvailabilitySearch />
        </div>

        {/* Footer */}
        <footer className="w-full flex flex-col sm:flex-row items-center justify-center border-t border-white/5 mx-auto text-center text-xs gap-6 py-12 mt-10">
          <p className="text-gray-500">
            Powered by{" "}
            <a
              href="https://supabase.com"
              target="_blank"
              className="font-bold text-gray-400 hover:text-white transition-colors"
              rel="noreferrer"
            >
              Supabase
            </a>
          </p>
          
          <div className="flex items-center gap-6">
            <a
              href="https://forms.gle/Q11hjrXg4bS2XjKt5"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-red-600/10 border border-red-600/20 text-red-500 rounded-xl hover:bg-red-600 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest"
            >
              Report Issue
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
}