"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

interface HLSPlayerProps {
  url: string;
}

export default function HLSPlayer({ url }: HLSPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [status, setStatus] = useState<"loading" | "playing" | "paused" | "offline">("loading");
  const [retryCount, setRetryCount] = useState(0);

  const tryPlay = (video: HTMLVideoElement) => {
    video.play().catch(() => {
      // Autoplay blocked — show click-to-play state
      setStatus("paused");
    });
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    function initPlayer() {
      if (!video) return;
      setStatus("loading");

      if (Hls.isSupported()) {
        if (hlsRef.current) {
          hlsRef.current.destroy();
        }

        const hls = new Hls({
          liveSyncDurationCount: 2,
          liveMaxLatencyDurationCount: 5,
          enableWorker: true,
          lowLatencyMode: false,
        });

        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(video);

        // Trigger play once manifest is ready
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          tryPlay(video);
        });

        // Also trigger when first fragment is loaded (belt & suspenders)
        hls.on(Hls.Events.FRAG_LOADED, () => {
          if (video.paused) tryPlay(video);
        });

        // Mark as playing once video actually starts rendering frames
        video.addEventListener("playing", () => setStatus("playing"), { once: false });
        video.addEventListener("waiting", () => {
          if (status === "playing") setStatus("loading");
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            hls.destroy();
            setStatus("offline");
            setTimeout(() => setRetryCount((c) => c + 1), 5000);
          }
        });

      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // Safari native HLS
        video.src = url;
        video.addEventListener("loadedmetadata", () => tryPlay(video));
        video.addEventListener("playing", () => setStatus("playing"));
      }
    }

    initPlayer();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [url, retryCount]);

  return (
    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-white/10">
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        muted
        playsInline
        autoPlay
      />

      {/* Loading spinner */}
      {status === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-white/60">Buffering stream...</p>
        </div>
      )}

      {/* Click to play (autoplay blocked) */}
      {status === "paused" && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 cursor-pointer"
          onClick={() => videoRef.current?.play().then(() => setStatus("playing"))}
        >
          <div className="w-16 h-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors">
            <svg className="w-7 h-7 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <p className="text-white/60 text-sm">Click to play</p>
        </div>
      )}

      {/* Offline state */}
      {status === "offline" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
            <svg className="w-8 h-8 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9A2.25 2.25 0 004.5 18.75z" />
            </svg>
          </div>
          <p className="text-white/60 text-sm">Stream offline</p>
          <p className="text-white/30 text-xs">Retrying in 5 seconds...</p>
        </div>
      )}

      {/* Live badge */}
      {status === "playing" && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-600/90 backdrop-blur px-2.5 py-1 rounded-full">
          <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
          <span className="text-white text-xs font-semibold tracking-wide">LIVE</span>
        </div>
      )}
    </div>
  );
}
