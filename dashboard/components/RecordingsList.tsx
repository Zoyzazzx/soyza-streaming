"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Recording {
  id: number;
  created_at: string;
  filename: string;
  public_url: string;
  file_size_bytes: number | null;
  duration_seconds: number | null;
  upload_status: string;
}

function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function RecordingsList() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [playing, setPlaying] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase
      .from("recordings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => {
        if (data) setRecordings(data as Recording[]);
      });
  }, []);

  // Realtime: new recordings appear instantly
  useEffect(() => {
    const channel = supabase
      .channel("recordings-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "recordings" },
        (payload) => {
          setRecordings((prev) => [payload.new as Recording, ...prev].slice(0, 30));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (recordings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center">
          <svg className="w-7 h-7 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5" />
          </svg>
        </div>
        <p className="text-white/30 text-sm">No recordings yet</p>
        <p className="text-white/20 text-xs">Recordings appear every 30 seconds once streaming starts</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {recordings.map((rec) => (
        <div
          key={rec.id}
          className="group rounded-xl border border-white/10 bg-white/5 hover:border-indigo-500/40 hover:bg-white/8 transition-all overflow-hidden"
        >
          {/* Video preview / play area */}
          <div className="relative aspect-video bg-black">
            {playing === rec.public_url ? (
              <video
                src={rec.public_url}
                controls
                autoPlay
                className="w-full h-full object-contain"
                onEnded={() => setPlaying(null)}
              />
            ) : (
              <button
                onClick={() => setPlaying(rec.public_url)}
                className="absolute inset-0 flex items-center justify-center group/btn"
              >
                <div className="w-12 h-12 rounded-full bg-white/10 group-hover/btn:bg-indigo-500/80 backdrop-blur flex items-center justify-center transition-all">
                  <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
                <span className="absolute bottom-2 right-2 text-xs text-white/40 bg-black/60 px-1.5 py-0.5 rounded">
                  {rec.duration_seconds ? `${rec.duration_seconds}s` : "30s"}
                </span>
              </button>
            )}
          </div>

          {/* Metadata */}
          <div className="p-3 space-y-1">
            <p className="text-xs font-medium text-white/70 truncate">{rec.filename}</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/30">{formatDate(rec.created_at)}</span>
              <span className="text-xs text-white/30">{formatBytes(rec.file_size_bytes)}</span>
            </div>
            {rec.upload_status === "failed" && (
              <span className="text-xs text-red-400">Upload failed</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
