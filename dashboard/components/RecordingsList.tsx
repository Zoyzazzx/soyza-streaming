"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Trash2, Play, VideoOff, Film, Layers, Sparkles } from "lucide-react";

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
  const [activeTab, setActiveTab] = useState<"all" | "masters" | "segments">("all");
  const supabase = createClient();

  const fetchRecordings = () => {
    supabase
      .from("recordings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(60)
      .then(({ data }) => {
        if (data) setRecordings(data as Recording[]);
      });
  };

  useEffect(() => {
    fetchRecordings();
  }, []);

  // Realtime: updates when new recordings are uploaded or deleted after stitching
  useEffect(() => {
    const channel = supabase
      .channel("recordings-live-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "recordings" },
        () => {
          fetchRecordings();
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

  const isMaster = (filename: string) => filename.startsWith("master_");

  const filteredRecordings = recordings.filter((rec) => {
    if (activeTab === "masters") return isMaster(rec.filename);
    if (activeTab === "segments") return !isMaster(rec.filename);
    return true;
  });

  const masterCount = recordings.filter(r => isMaster(r.filename)).length;
  const segmentCount = recordings.filter(r => !isMaster(r.filename)).length;

  return (
    <div className="space-y-6">
      {/* Filter Tabs & Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div className="flex items-center gap-2 bg-gray-100/80 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("all")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "all"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            All Recordings ({recordings.length})
          </button>
          <button
            onClick={() => setActiveTab("masters")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "masters"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Full Broadcasts ({masterCount})
          </button>
          <button
            onClick={() => setActiveTab("segments")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "segments"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Live 30s Chunks ({segmentCount})
          </button>
        </div>

        {recordings.length > 0 && (
          <button
            onClick={handleDeleteAll}
            disabled={isDeleting}
            className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-medium text-xs rounded-xl transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {isDeleting ? "Deleting..." : "Delete All"}
          </button>
        )}
      </div>

      {filteredRecordings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 bg-white border border-gray-200 rounded-3xl shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center border border-gray-100">
            <VideoOff className="w-8 h-8 text-gray-300" />
          </div>
          <div className="text-center">
            <p className="text-gray-900 font-medium text-lg">
              {activeTab === "masters" ? "No full broadcasts yet" : "No recordings found"}
            </p>
            <p className="text-gray-500 text-sm mt-1 max-w-sm mx-auto">
              {activeTab === "masters"
                ? "Full stitched videos appear here after you stop a broadcast."
                : "Recordings appear every 30 seconds once streaming starts in the Broadcast Studio."}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredRecordings.map((rec) => {
            const isFullMaster = isMaster(rec.filename);
            return (
              <div
                key={rec.id}
                className={`group rounded-2xl border bg-white transition-all overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-500 ${
                  isFullMaster 
                    ? "border-indigo-200 hover:border-indigo-400 hover:shadow-xl ring-1 ring-indigo-500/10" 
                    : "border-gray-200 hover:border-indigo-300 hover:shadow-lg"
                }`}
              >
                {/* Video preview / play area */}
                <div className="relative aspect-video bg-gray-900">
                  {isFullMaster && (
                    <div className="absolute top-2 left-2 z-10 bg-indigo-600/90 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
                      <Film className="w-3 h-3" />
                      FULL VIDEO
                    </div>
                  )}

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
                      <div className={`w-14 h-14 rounded-full backdrop-blur-md flex items-center justify-center transition-all shadow-lg border border-white/20 ${
                        isFullMaster 
                          ? "bg-indigo-600/80 group-hover/btn:bg-indigo-600 group-hover/btn:scale-110" 
                          : "bg-white/10 group-hover/btn:bg-indigo-600/90 group-hover/btn:scale-110"
                      }`}>
                        <Play className="w-6 h-6 text-white ml-1" fill="currentColor" />
                      </div>
                      <span className="absolute bottom-3 right-3 text-xs font-bold text-white bg-black/70 backdrop-blur-sm px-2 py-1 rounded-md border border-white/10">
                        {isFullMaster ? "Full" : rec.duration_seconds ? `${rec.duration_seconds}s` : "30s"}
                      </span>
                    </button>
                  )}
                </div>

                {/* Metadata */}
                <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      {isFullMaster ? (
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                          Master Recording
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          Segment
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-gray-800 truncate" title={rec.filename}>
                      {rec.filename}
                    </p>
                  </div>

                  <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-50">
                    <span className="text-xs font-medium text-gray-500">{formatDate(rec.created_at)}</span>
                    <div className="flex items-center gap-2">
                      {rec.upload_status === "failed" && (
                        <span className="text-[10px] uppercase font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">Failed</span>
                      )}
                      <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">
                        {formatBytes(rec.file_size_bytes)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
