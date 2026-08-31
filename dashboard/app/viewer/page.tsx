"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import HLSPlayer from "@/components/HLSPlayer";
import { createClient } from "@/lib/supabase/client";
import {
  LogOut,
  Home,
  Video,
  Lock,
  Key,
  ChevronRight,
  Radio,
  Globe,
  Sparkles,
  Wifi,
  WifiOff,
  Tv,
  RefreshCw,
  Eye,
  Sliders
} from "lucide-react";

interface StreamStatus {
  online: boolean;
  streaming: boolean;
}

export default function ViewerPage() {
  const HLS_URL = process.env.NEXT_PUBLIC_HLS_URL || "http://localhost:8888/live/stream/index.m3u8";

  const [streamStatus, setStreamStatus] = useState<StreamStatus>({ online: false, streaming: false });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isPublicStream, setIsPublicStream] = useState<boolean>(false);
  const [streamTitle, setStreamTitle] = useState<string>("Live Stream Broadcast");
  const [userRole, setUserRole] = useState<string>("viewer");
  
  // Private modal & credentials
  const [isPrivateModalOpen, setIsPrivateModalOpen] = useState(false);
  const [streamId, setStreamId] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function checkUserSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUserRole(session.user.user_metadata?.role || "streamer");
      }
    }
    checkUserSession();
  }, [supabase]);

  const checkAuth = async () => {
    try {
      const res = await fetch("/api/stream-auth");
      const data = await res.json();
      setIsAuthenticated(data.authenticated);
      if (data.title) setStreamTitle(data.title);
      if (data.isPublic !== undefined) setIsPublicStream(data.isPublic);
    } catch {
      setIsAuthenticated(false);
    }
  };

  useEffect(() => {
    async function fetchStatusAndAuth() {
      try {
        const res = await fetch("/api/stream-status");
        const data = await res.json();
        setStreamStatus(data);
      } catch {
        setStreamStatus({ online: false, streaming: false });
      }

      // Check stream auth/privacy changes dynamically while on air
      checkAuth();
    }

    fetchStatusAndAuth();
    const interval = setInterval(fetchStatusAndAuth, 2500);
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
        setIsPrivateModalOpen(false);
        checkAuth();
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

  // Determine if there is actually a live stream right now
  const isLive = streamStatus.streaming;

  return (
    <div className="min-h-screen bg-gray-50/60 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* ── Minimalist Top Navigation ── */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <Link href="/" className="shrink-0">
              <img 
                src="/logo.png" 
                alt="ZoyzaXR Logo" 
                className="w-10 h-10 rounded-2xl shadow-md object-cover border border-purple-100" 
              />
            </Link>
            <div>
              <span className="font-bold text-gray-900 text-base tracking-tight block">ZoyzaXR</span>
              <span className="text-gray-400 text-xs">Live Viewer Portal</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link 
              href="/recordings" 
              className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-gray-600 hover:text-indigo-600 hover:bg-indigo-50/80 rounded-xl transition-all border border-gray-200/80 bg-white shadow-xs"
            >
              <Video className="w-3.5 h-3.5" />
              <span>Recordings</span>
            </Link>
            
            {/* Live Indicator Pill */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold transition-all shadow-xs ${
              isLive
                ? "bg-emerald-50 border-emerald-200 text-emerald-700 shadow-emerald-500/10"
                : streamStatus.online
                ? "bg-amber-50 border-amber-200 text-amber-700"
                : "bg-gray-100/80 border-gray-200 text-gray-500"
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                isLive ? "bg-emerald-500 animate-ping" :
                streamStatus.online ? "bg-amber-500" : "bg-gray-400"
              }`} />
              <span>{isLive ? "LIVE" : streamStatus.online ? "IDLE" : "OFFLINE"}</span>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </nav>

      {/* ── Main Content Stage ── */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col justify-center">
        
        {/* Stream Card */}
        <div className="bg-white border border-gray-200/90 rounded-3xl shadow-xl shadow-gray-200/50 overflow-hidden flex flex-col transition-all">
          
          {/* Header Bar */}
          <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3 bg-gray-50/40">
            <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${isLive ? 'bg-red-500 animate-pulse' : 'bg-gray-300'}`} />
              <h2 className="text-sm font-bold text-gray-900 tracking-tight">
                {isLive ? streamTitle : "No Active Public Stream"}
              </h2>
              {isLive && (
                isPublicStream ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Public
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    Private
                  </span>
                )
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPrivateModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200/80 text-gray-700 font-semibold text-xs transition-all border border-gray-200"
              >
                <Lock className="w-3.5 h-3.5 text-gray-500" />
                <span>Connect Private Stream</span>
              </button>

              {isLive && (
                <a
                  href={HLS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-xl"
                >
                  Direct HLS ↗
                </a>
              )}
            </div>
          </div>
          
          {/* Player / Standby Area */}
          <div className="bg-black relative min-h-[500px] flex items-center justify-center overflow-hidden">
             
             {/* SCENARIO 1: Live stream is currently broadcasting and authenticated */}
             {isLive && isAuthenticated ? (
                <HLSPlayer url={HLS_URL} />
             ) : isLive && !isAuthenticated ? (
                /* SCENARIO 2: Private stream is live but needs unlock */
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950/95 z-20 px-4">
                  <div className="max-w-md w-full bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-3xl shadow-2xl text-center">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mb-5 mx-auto">
                      <Lock className="w-8 h-8" />
                    </div>
                    <h3 className="text-white font-bold text-2xl tracking-tight mb-2">Private Broadcast Live</h3>
                    <p className="text-white/70 text-xs mb-6">
                      This stream is protected. Enter the Stream ID and Password from the broadcaster to watch.
                    </p>
                    
                    <button
                      onClick={() => setIsPrivateModalOpen(true)}
                      className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs py-3.5 px-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                      <Key className="w-4 h-4" />
                      Enter Credentials
                    </button>
                  </div>
                </div>
             ) : (
                /* SCENARIO 3: No stream is ongoing right now -> Clean minimal radar & floating animation */
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-radial from-gray-900 via-gray-950 to-black z-10 px-6 text-center select-none">
                  
                  {/* Radar Pulse animation */}
                  <div className="relative flex items-center justify-center mb-6">
                    <div className="w-32 h-32 rounded-full border border-indigo-500/20 animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite] absolute" />
                    <div className="w-24 h-24 rounded-full border border-violet-500/30 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite] absolute" />
                    
                    <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500/20 to-violet-600/20 border border-white/10 backdrop-blur-md flex items-center justify-center shadow-2xl relative z-10 animate-[bounce_4s_infinite]">
                      <Tv className="w-9 h-9 text-indigo-400" />
                    </div>
                  </div>

                  <div className="max-w-sm space-y-2">
                    <h3 className="text-white font-bold text-xl tracking-tight">
                      No Public Stream Ongoing
                    </h3>
                    <p className="text-gray-400 text-xs leading-relaxed">
                      The broadcaster has not started a public feed yet. When a stream goes live, it will appear here automatically.
                    </p>
                  </div>

                  {/* Private stream invitation pill */}
                  <div className="mt-8">
                    <button
                      onClick={() => setIsPrivateModalOpen(true)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-semibold backdrop-blur-md transition-all shadow-lg hover:scale-105 active:scale-95"
                    >
                      <Lock className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Have a Private Stream Key? Click to Connect</span>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                  </div>
                </div>
             )}
          </div>
        </div>
        
        {/* Footer */}
        <div className="mt-8 text-center text-xs text-gray-400">
          ZoyzaXR Project — E299625 | Kingston University London
        </div>
      </main>

      {/* ── Connect to Private Stream Modal ── */}
      {isPrivateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-gray-200 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shadow-xs">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Connect to Private Stream</h3>
                  <p className="text-[11px] text-gray-400">Enter broadcaster access credentials</p>
                </div>
              </div>
              <button
                onClick={() => { setIsPrivateModalOpen(false); setAuthError(""); }}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-xs font-semibold text-center">
                {authError}
              </div>
            )}

            <form onSubmit={handleAuthenticate} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-600">Stream ID</label>
                <div className="relative">
                  <Video className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={streamId}
                    onChange={(e) => setStreamId(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-gray-200 text-gray-900 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-xs"
                    placeholder="e.g. 849201"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-600">Stream Password</label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-gray-200 text-gray-900 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-xs"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPrivateModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAuthenticating}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
                >
                  {isAuthenticating && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  {isAuthenticating ? "Verifying..." : "Unlock & Watch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
