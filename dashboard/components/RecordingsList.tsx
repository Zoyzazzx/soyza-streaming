"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Trash2, Play, VideoOff } from "lucide-react";

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
  const [isDeleting, setIsDeleting] = useState(false);
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

  const handleDeleteAll = async () => {
    if (!window.confirm("Are you sure you want to delete all recordings? This action cannot be undone.")) return;
    setIsDeleting(true);
    try {
      const res = await fetch("/api/recordings", { method: "DELETE" });
      const data = await res.json();
      
      if (res.ok && data.success) {
        setRecordings([]);
      } else {
        alert("Failed to delete recordings: " + (data.error || "Unknown error"));
      }
    } catch (err: any) {
      console.error(err);
      alert("An error occurred while deleting recordings: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {recordings.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={handleDeleteAll}
            disabled={isDeleting}
            className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-medium text-sm rounded-xl transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {isDeleting ? "Deleting..." : "Delete All Recordings"}
          </button>
        </div>
      )}

      {recordings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 bg-white border border-gray-200 rounded-3xl shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center border border-gray-100">
            <VideoOff className="w-8 h-8 text-gray-300" />
          </div>
          <div className="text-center">
            <p className="text-gray-900 font-medium text-lg">No recordings yet</p>
            <p className="text-gray-500 text-sm mt-1 max-w-sm mx-auto">Recordings appear every 30 seconds once streaming starts in the Broadcast Studio.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {recordings.map((rec) => (
            <div
              key={rec.id}
              className="group rounded-2xl border border-gray-200 bg-white hover:border-indigo-300 hover:shadow-lg transition-all overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-500"
            >
              {/* Video preview / play area */}
              <div className="relative aspect-video bg-gray-900">
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
                    className="absolute inset-0 flex items-center justify-center group/btn focus:outline-none"
                  >
                    <div className="w-14 h-14 rounded-full bg-white/10 group-hover/btn:bg-indigo-600/90 group-hover/btn:scale-110 backdrop-blur-md flex items-center justify-center transition-all shadow-lg border border-white/20">
                      <Play className="w-6 h-6 text-white ml-1" fill="currentColor" />
                    </div>
                    <span className="absolute bottom-3 right-3 text-xs font-bold text-white bg-black/70 backdrop-blur-sm px-2 py-1 rounded-md border border-white/10">
                      {rec.duration_seconds ? `${rec.duration_seconds}s` : "30s"}
                    </span>
                  </button>
                )}
              </div>

              {/* Metadata */}
              <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                <p className="text-sm font-semibold text-gray-800 truncate" title={rec.filename}>{rec.filename}</p>
                <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-50">
                  <span className="text-xs font-medium text-gray-500">{formatDate(rec.created_at)}</span>
                  <div className="flex items-center gap-2">
                    {rec.upload_status === "failed" && (
                      <span className="text-[10px] uppercase font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">Failed</span>
                    )}
                    <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">{formatBytes(rec.file_size_bytes)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
