"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import HLSPlayer from "@/components/HLSPlayer";
import NetworkStatus from "@/components/NetworkStatus";
import FailoverLog from "@/components/FailoverLog";

interface StreamStatus {
  online: boolean;
  streaming: boolean;
}

export default function DashboardPage() {
  const HLS_URL = process.env.NEXT_PUBLIC_HLS_URL || "http://localhost:8888/live/stream/index.m3u8";

  const [streamStatus, setStreamStatus] = useState<StreamStatus>({ online: false, streaming: false });
  const [currentTime, setCurrentTime] = useState("");

  // Poll MediaMTX status every 5 seconds
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

  // Clock
  useEffect(() => {
    function tick() {
      setCurrentTime(new Date().toLocaleTimeString("en-GB", { hour12: false }));
    }
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-[#080b14]">
      {/* ── Navigation ── */}
      <nav className="border-b border-white/8 bg-[#080b14]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <span className="font-semibold text-white text-sm">SoyzaStream</span>
            <span className="hidden sm:block text-white/20 text-xs ml-1">Hybrid Network Dashboard</span>
          </div>

          {/* Nav links */}
          <div className="flex items-center gap-1">
            <Link href="/" className="px-3 py-1.5 text-xs font-medium text-white bg-white/10 rounded-lg">
              Viewer
            </Link>
            <Link href="/broadcast" className="px-3 py-1.5 text-xs font-medium text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
              Broadcast Studio
            </Link>
            <Link href="/recordings" className="px-3 py-1.5 text-xs font-medium text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
              Recordings
            </Link>
          </div>

          {/* Status pill & Logout */}
          <div className="flex items-center gap-3">
            <span className="text-white/30 text-xs font-mono hidden sm:block">{currentTime}</span>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-all ${
              streamStatus.streaming
                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                : streamStatus.online
                ? "bg-yellow-500/15 border-yellow-500/30 text-yellow-300"
                : "bg-white/5 border-white/10 text-white/40"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                streamStatus.streaming ? "bg-emerald-400 animate-pulse" :
                streamStatus.online ? "bg-yellow-400" : "bg-white/30"
              }`} />
              {streamStatus.streaming ? "Live" : streamStatus.online ? "Idle" : "Offline"}
            </div>
            <button
              onClick={async () => {
                const { createClient } = await import("@/lib/supabase/client");
                const supabase = createClient();
                await supabase.auth.signOut();
                window.location.href = "/login";
              }}
              className="px-2 py-1 text-xs text-white/50 hover:text-red-400 transition-colors border-l border-white/10 pl-3"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* ── Main content ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-white">Live Dashboard</h1>
          <p className="text-sm text-white/40">
            Hybrid 5G + 4G network streaming system with automatic failover
          </p>
        </div>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: "MediaMTX",
              value: streamStatus.online ? "Online" : "Offline",
              color: streamStatus.online ? "text-emerald-400" : "text-red-400",
              icon: "🖥",
            },
            {
              label: "Stream",
              value: streamStatus.streaming ? "Active" : "Waiting",
              color: streamStatus.streaming ? "text-emerald-400" : "text-white/40",
              icon: "📡",
            },
            {
              label: "Segment Length",
              value: "30s",
              color: "text-indigo-300",
              icon: "🎬",
            },
            {
              label: "Protocol",
              value: "HLS",
              color: "text-violet-300",
              icon: "⚡",
            },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-white/8 bg-white/4 p-4">
              <div className="text-lg mb-1">{stat.icon}</div>
              <p className={`text-sm font-semibold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-white/30 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* ── Stream + side panel ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Player — 2/3 width */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Live Stream</h2>
              <a
                href={HLS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-white/30 hover:text-indigo-400 transition-colors"
              >
                Open HLS ↗
              </a>
            </div>
            <HLSPlayer url={HLS_URL} />
            <p className="text-xs text-white/25 font-mono">{HLS_URL}</p>
          </div>

          {/* Side panel — 1/3 width */}
          <div className="space-y-4">
            <NetworkStatus />
          </div>
        </div>

        {/* ── Failover log ── */}
        <FailoverLog />

        {/* ── Footer ── */}
        <div className="border-t border-white/5 pt-4 flex items-center justify-between text-xs text-white/20">
          <span>Soyza Project — E299625 | Kingston University London</span>
          <span>C16600 Individual Project</span>
        </div>
      </main>
    </div>
  );
}
