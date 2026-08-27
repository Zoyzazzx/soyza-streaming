"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import HLSPlayer from "@/components/HLSPlayer";
import { createClient } from "@/lib/supabase/client";
import { LogOut, Home, Video } from "lucide-react";

interface StreamStatus {
  online: boolean;
  streaming: boolean;
}

export default function ViewerPage() {
  const HLS_URL = process.env.NEXT_PUBLIC_HLS_URL || "http://localhost:8888/live/stream/index.m3u8";

  const [streamStatus, setStreamStatus] = useState<StreamStatus>({ online: false, streaming: false });
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch("/api/stream-status");
        const data = await res.json();
        setStreamStatus(data);
      } catch {
        setStreamStatus({ online: false, streaming: false });
      }
    }
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* ── Navigation ── */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 transition-colors shadow-md group">
              <Home className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
            </Link>
            <div>
              <span className="font-bold text-gray-900 text-lg tracking-tight block">ZoyzaXR</span>
              <span className="text-gray-500 text-xs">Live Viewer</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/recordings" className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
              <Video className="w-4 h-4" />
              Recordings
            </Link>
            
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold shadow-sm transition-all ${
              streamStatus.streaming
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : streamStatus.online
                ? "bg-amber-50 border-amber-200 text-amber-700"
                : "bg-gray-100 border-gray-200 text-gray-500"
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                streamStatus.streaming ? "bg-emerald-500 animate-pulse" :
                streamStatus.online ? "bg-amber-500" : "bg-gray-400"
              }`} />
              {streamStatus.streaming ? "Live" : streamStatus.online ? "Idle" : "Offline"}
            </div>
            
            <div className="w-px h-6 bg-gray-200 mx-1"></div>
            
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </nav>

      {/* ── Main content ── */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col">
        <div className="bg-white border border-gray-200 rounded-3xl shadow-xl overflow-hidden flex-1 flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${streamStatus.streaming ? 'bg-red-500 animate-pulse' : 'bg-gray-300'}`}></div>
              Live Stream Broadcast
            </h2>
            <a
              href={HLS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-indigo-500 hover:text-indigo-700 transition-colors bg-indigo-50 px-3 py-1 rounded-full"
            >
              Open HLS Link ↗
            </a>
          </div>
          
          {/* Player */}
          <div className="flex-1 bg-black flex items-center justify-center relative min-h-[500px]">
             {streamStatus.streaming ? (
                <HLSPlayer url={HLS_URL} />
             ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-10">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                    <Video className="w-8 h-8 text-white/30" />
                  </div>
                  <h3 className="text-white font-medium text-lg">Stream Offline</h3>
                  <p className="text-white/40 text-sm mt-1">Waiting for broadcast to begin...</p>
                </div>
             )}
          </div>
        </div>
        
        {/* Footer */}
        <div className="mt-8 text-center text-xs text-gray-400">
          ZoyzaXR Project — E299625 | Kingston University London
        </div>
      </main>
    </div>
  );
}
