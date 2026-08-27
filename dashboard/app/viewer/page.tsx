"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import HLSPlayer from "@/components/HLSPlayer";
import { createClient } from "@/lib/supabase/client";
import { LogOut, Home, Video, Lock, Key, ChevronRight } from "lucide-react";

interface StreamStatus {
  online: boolean;
  streaming: boolean;
}

export default function ViewerPage() {
  const HLS_URL = process.env.NEXT_PUBLIC_HLS_URL || "http://localhost:8888/live/stream/index.m3u8";

  const [streamStatus, setStreamStatus] = useState<StreamStatus>({ online: false, streaming: false });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [streamId, setStreamId] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/stream-auth");
        const data = await res.json();
        setIsAuthenticated(data.authenticated);
      } catch {
        setIsAuthenticated(false);
      }
    }
    checkAuth();
  }, []);

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

  const handleAuthenticate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);
    setAuthError("");
    
    try {
      const res = await fetch("/api/stream-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streamId, password }),
      });
      const data = await res.json();
      
      if (data.success) {
        setIsAuthenticated(true);
      } else {
        setAuthError(data.error || "Invalid credentials.");
      }
    } catch (err) {
      setAuthError("Failed to authenticate.");
    } finally {
      setIsAuthenticating(false);
    }
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

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
             {!isAuthenticated ? (
               <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-20 px-4">
                 <div className="max-w-md w-full bg-white/10 backdrop-blur-md border border-white/20 p-8 rounded-3xl shadow-2xl">
                   <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mb-6 mx-auto">
                     <Lock className="w-8 h-8 text-white" />
                   </div>
                   <h3 className="text-white font-bold text-2xl text-center tracking-tight mb-2">Protected Stream</h3>
                   <p className="text-white/60 text-sm text-center mb-8">Please enter the Stream ID and Password provided by the broadcaster to access this live feed.</p>
                   
                   <form onSubmit={handleAuthenticate} className="space-y-4">
                     <div>
                       <label className="text-xs font-bold text-white/70 uppercase tracking-wider ml-1">Stream ID</label>
                       <div className="mt-1 relative">
                         <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                           <Video className="h-4 w-4 text-white/40" />
                         </div>
                         <input
                           type="text"
                           value={streamId}
                           onChange={(e) => setStreamId(e.target.value)}
                           className="w-full bg-black/40 border border-white/20 text-white placeholder-white/30 text-sm rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block pl-10 p-3 outline-none"
                           placeholder="e.g. 123456"
                           required
                         />
                       </div>
                     </div>
                     <div>
                       <label className="text-xs font-bold text-white/70 uppercase tracking-wider ml-1">Password</label>
                       <div className="mt-1 relative">
                         <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                           <Key className="h-4 w-4 text-white/40" />
                         </div>
                         <input
                           type="password"
                           value={password}
                           onChange={(e) => setPassword(e.target.value)}
                           className="w-full bg-black/40 border border-white/20 text-white placeholder-white/30 text-sm rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block pl-10 p-3 outline-none"
                           placeholder="••••••••"
                           required
                         />
                       </div>
                     </div>
                     
                     {authError && <p className="text-red-400 text-xs font-medium text-center">{authError}</p>}
                     
                     <button
                       type="submit"
                       disabled={isAuthenticating}
                       className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 mt-4 shadow-lg disabled:opacity-50"
                     >
                       {isAuthenticating ? "Verifying..." : "Unlock Stream"}
                       {!isAuthenticating && <ChevronRight className="w-4 h-4" />}
                     </button>
                   </form>
                 </div>
               </div>
             ) : streamStatus.streaming ? (
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
