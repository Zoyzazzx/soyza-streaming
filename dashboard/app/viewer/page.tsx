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
  Sliders,
  Copy,
  Check,
  ExternalLink
} from "lucide-react";

interface StreamStatus {
  online: boolean;
  streaming: boolean;
}

export default function ViewerPage() {
  const HLS_URL = "/api/streams/live/stream/index.m3u8";
  const [fullHlsUrl, setFullHlsUrl] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

  const [streamStatus, setStreamStatus] = useState<StreamStatus>({ online: false, streaming: false });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isPublicStream, setIsPublicStream] = useState<boolean>(false);
  const [streamTitle, setStreamTitle] = useState<string>("Live Stream Broadcast");
  const [userRole, setUserRole] = useState<string>("viewer");
  
  // Track viewer stream duration
  const [streamDuration, setStreamDuration] = useState<number>(0);

  // Private modal & credentials
  const [isPrivateModalOpen, setIsPrivateModalOpen] = useState(false);
  const [streamId, setStreamId] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (typeof window !== "undefined") {
      setFullHlsUrl(`${window.location.origin}/api/streams/live/stream/index.m3u8`);
    }
  }, []);

  const handleCopyLink = async () => {
    const urlToCopy = fullHlsUrl || `${window.location.origin}/api/streams/live/stream/index.m3u8`;
    try {
      await navigator.clipboard.writeText(urlToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback
      prompt("Copy HLS Stream URL:", urlToCopy);
    }
  };

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
    checkAuth();
  }, []);

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

  // Duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (streamStatus.streaming) {
      interval = setInterval(() => {
        setStreamDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setStreamDuration(0);
    }
    return () => clearInterval(interval);
  }, [streamStatus.streaming]);

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

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
        <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Determine if there is actually a live stream right now
  const isLive = streamStatus.streaming;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans selection:bg-purple-600 selection:text-white w-full">
      {/* ── Top Header Navigation (Matching Studio Header Exactly) ── */}
      <header className="h-16 bg-white border-b border-gray-200 px-6 sm:px-8 flex items-center justify-between shrink-0 sticky top-0 z-50 shadow-xs">
        <div className="flex items-center gap-4">
          <Link href="/" className="shrink-0 flex items-center gap-3 group">
            <img 
              src="/logo.png" 
              alt="ZoyzaXR Logo" 
              className="w-10 h-10 rounded-2xl shadow-md object-cover border border-purple-100 group-hover:scale-105 transition-transform" 
            />
            <div className="hidden sm:block">
              <span className="font-extrabold text-gray-900 text-base tracking-tight block">ZoyzaXR</span>
              <span className="text-[10px] text-purple-600 font-bold uppercase tracking-wider block">Live Viewer</span>
            </div>
          </Link>

          <div className="w-px h-6 bg-gray-200 hidden sm:block"></div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-base sm:text-lg font-extrabold text-gray-900 tracking-tight">
              {isLive ? streamTitle : "No Active Stream"}
            </h1>
            
            {/* Status pills matching studio */}
            {isLive && (
              isPublicStream ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5" /> Public
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" /> Private
                </span>
              )
            )}
          </div>
        </div>

        {/* Right Header Controls: Status, Duration, Private Connect, HLS link & Logout */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 text-xs text-gray-500 mr-1">
            <span>Status: <b className={isLive ? "text-red-600 font-bold animate-pulse" : "text-gray-700"}>{isLive ? "LIVE ON AIR" : "STANDBY"}</b></span>
            <span>•</span>
            <span>Duration: <b className="font-mono text-gray-900">{formatDuration(streamDuration)}</b></span>
          </div>

          <button
            onClick={() => setIsPrivateModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 border border-gray-200 text-xs font-semibold text-gray-700 transition-all shadow-xs"
            title="Connect with Private Stream Key"
          >
            <Lock className="w-3.5 h-3.5 text-purple-600" />
            <span className="hidden sm:inline">Connect Private</span>
          </button>

          {isLive && (
            <button
              onClick={handleCopyLink}
              className="text-xs font-semibold text-purple-700 hover:text-purple-800 transition-colors bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-xs"
              title="Copy direct stream link for external players (VLC, OBS, PotPlayer)"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-bold">Copied URL!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-purple-600" />
                  <span>Copy Player Link</span>
                </>
              )}
            </button>
          )}

          <Link
            href="/recordings"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 border border-gray-200 text-xs font-semibold text-gray-700 transition-all shadow-xs"
          >
            <Video className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Recordings</span>
          </Link>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
            title="Logout"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* ── Main Content Stage ── */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-8 flex flex-col justify-center">
        
        {/* Stream Video Player Card */}
        <div className="bg-white border border-gray-200 rounded-3xl shadow-xl overflow-hidden flex flex-col transition-all">
          
          {/* Player / Standby Area */}
          <div className="bg-black relative aspect-video flex items-center justify-center overflow-hidden">
             
             {/* SCENARIO 1: Live stream is currently broadcasting and authenticated */}
             {isLive && isAuthenticated ? (
                <HLSPlayer url={HLS_URL} />
             ) : isLive && !isAuthenticated ? (
                /* SCENARIO 2: Private stream is live but needs unlock */
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950/95 z-20 px-4">
                  <div className="max-w-md w-full bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-3xl shadow-2xl text-center">
                    <div className="w-16 h-16 rounded-2xl bg-purple-500/20 border border-purple-500/30 text-purple-400 flex items-center justify-center mb-5 mx-auto">
                      <Lock className="w-8 h-8" />
                    </div>
                    <h3 className="text-white font-bold text-2xl tracking-tight mb-2">Private Broadcast Live</h3>
                    <p className="text-white/70 text-xs mb-6">
                      This stream is protected. Enter the Stream ID and Password from the broadcaster to watch.
                    </p>
                    
                    <button
                      onClick={() => setIsPrivateModalOpen(true)}
                      className="w-full bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-bold text-xs py-3.5 px-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
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
                    <div className="w-32 h-32 rounded-full border border-purple-500/20 animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite] absolute" />
                    <div className="w-24 h-24 rounded-full border border-violet-500/30 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite] absolute" />
                    
                    <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-purple-500/20 to-violet-600/20 border border-white/10 backdrop-blur-md flex items-center justify-center shadow-2xl relative z-10 animate-[bounce_4s_infinite]">
                      <Tv className="w-9 h-9 text-purple-400" />
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
                  <div className="mt-8 flex flex-col items-center gap-3">
                    <button
                      onClick={() => setIsPrivateModalOpen(true)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-semibold backdrop-blur-md transition-all shadow-lg hover:scale-105 active:scale-95"
                    >
                      <Lock className="w-3.5 h-3.5 text-purple-400" />
                      <span>Have a Private Stream Key? Click to Connect</span>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                    </button>

                    {userRole === "streamer" && (
                      <Link
                        href="/"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-400/30 text-purple-200 hover:text-white text-xs font-semibold backdrop-blur-md transition-all shadow-md hover:scale-105 active:scale-95"
                      >
                        <Home className="w-3.5 h-3.5" />
                        <span>Return to Studio Home</span>
                      </Link>
                    )}
                  </div>
                </div>
             )}
          </div>

          {/* Stream Link bar for viewers & external players */}
          {isLive && (
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-gray-600 min-w-0">
                <Radio className="w-4 h-4 text-purple-600 shrink-0" />
                <span className="font-semibold text-gray-900 shrink-0">External Player Stream Link:</span>
                <code className="bg-white border border-gray-200 px-2 py-1 rounded text-purple-700 font-mono text-[11px] truncate select-all max-w-xs sm:max-w-md">
                  {fullHlsUrl || "/api/streams/live/stream/index.m3u8"}
                </code>
              </div>
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 font-medium transition-all shadow-2xs shrink-0 self-end sm:self-auto"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700 font-semibold">Copied to Clipboard</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-gray-500" />
                    <span>Copy for VLC / OBS</span>
                  </>
                )}
              </button>
            </div>
          )}
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
                <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center shadow-xs">
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
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-gray-200 text-gray-900 text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 shadow-xs"
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
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-gray-200 text-gray-900 text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 shadow-xs"
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
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
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
