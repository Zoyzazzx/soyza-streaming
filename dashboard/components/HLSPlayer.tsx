"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize, 
  RotateCcw, 
  Radio, 
  RefreshCw 
} from "lucide-react";

interface HLSPlayerProps {
  url: string;
}

export default function HLSPlayer({ url }: HLSPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  
  const [status, setStatus] = useState<"loading" | "playing" | "paused" | "offline">("loading");
  const [retryCount, setRetryCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const hideControlsTimerRef = useRef<NodeJS.Timeout | null>(null);

  // DVR Timeline state
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLive, setIsLive] = useState(true);
  const [liveEdge, setLiveEdge] = useState(0);

  const tryPlay = (video: HTMLVideoElement) => {
    video.play().then(() => {
      setIsPlaying(true);
    }).catch(() => {
      setStatus("paused");
      setIsPlaying(false);
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
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: 10,
          enableWorker: true,
          lowLatencyMode: false,
          manifestLoadingTimeOut: 10000,
          manifestLoadingMaxRetry: 10,
          manifestLoadingRetryDelay: 1000,
          levelLoadingTimeOut: 10000,
          levelLoadingMaxRetry: 10,
          levelLoadingRetryDelay: 1000,
          fragLoadingTimeOut: 20000,
          fragLoadingMaxRetry: 10,
          fragLoadingRetryDelay: 1000,
        });

        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          tryPlay(video);
        });

        hls.on(Hls.Events.FRAG_LOADED, () => {
          tryPlay(video);
        });

        const onPlaying = () => {
          setStatus("playing");
          setIsPlaying(true);
        };
        const onPause = () => {
          setIsPlaying(false);
        };
        const onWaiting = () => {
          if (status === "playing") setStatus("loading");
        };

        const onTimeUpdate = () => {
          setCurrentTime(video.currentTime);
          
          if (hls.liveSyncPosition) {
            const edge = hls.liveSyncPosition;
            setLiveEdge(edge);
            setDuration(edge);
            // If we are within 4 seconds of the live edge, consider it live
            setIsLive(Math.abs(video.currentTime - edge) <= 5);
          } else if (video.seekable && video.seekable.length > 0) {
            const end = video.seekable.end(video.seekable.length - 1);
            setLiveEdge(end);
            setDuration(end);
            setIsLive(Math.abs(video.currentTime - end) <= 5);
          }
        };

        video.addEventListener("playing", onPlaying);
        video.addEventListener("pause", onPause);
        video.addEventListener("waiting", onWaiting);
        video.addEventListener("timeupdate", onTimeUpdate);

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                hls.destroy();
                setStatus("offline");
                setTimeout(() => setRetryCount((c) => c + 1), 3000);
                break;
            }
          }
        });

      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = url;
        const onLoadedMetadata = () => tryPlay(video);
        const onPlaying = () => {
          setStatus("playing");
          setIsPlaying(true);
        };
        const onPause = () => setIsPlaying(false);
        const onTimeUpdate = () => {
          setCurrentTime(video.currentTime);
          if (video.seekable && video.seekable.length > 0) {
            const end = video.seekable.end(video.seekable.length - 1);
            setLiveEdge(end);
            setDuration(end);
            setIsLive(Math.abs(video.currentTime - end) <= 5);
          }
        };
        const onError = () => {
          setStatus("offline");
          setTimeout(() => setRetryCount((c) => c + 1), 3000);
        };

        video.addEventListener("loadedmetadata", onLoadedMetadata);
        video.addEventListener("playing", onPlaying);
        video.addEventListener("pause", onPause);
        video.addEventListener("timeupdate", onTimeUpdate);
        video.addEventListener("error", onError);
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

  // Handle Play/Pause toggle
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => setIsPlaying(true));
      setStatus("playing");
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  // Handle Mute toggle
  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
    if (!video.muted && volume === 0) {
      setVolume(0.5);
      video.volume = 0.5;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (video) {
      video.volume = val;
      if (val === 0) {
        video.muted = true;
        setIsMuted(true);
      } else {
        video.muted = false;
        setIsMuted(false);
      }
    }
  };

  // Jump to Live Edge
  const jumpToLive = () => {
    const video = videoRef.current;
    if (!video) return;
    if (hlsRef.current && hlsRef.current.liveSyncPosition) {
      video.currentTime = hlsRef.current.liveSyncPosition;
    } else if (video.seekable && video.seekable.length > 0) {
      video.currentTime = video.seekable.end(video.seekable.length - 1);
    }
    video.play();
    setIsLive(true);
  };

  // Seek backward by 10s
  const seekRelative = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, video.currentTime + seconds);
    setIsLive(false);
  };

  // Timeline slider change
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const seekTime = parseFloat(e.target.value);
    video.currentTime = seekTime;
    setCurrentTime(seekTime);
    if (liveEdge > 0 && Math.abs(seekTime - liveEdge) <= 4) {
      setIsLive(true);
    } else {
      setIsLive(false);
    }
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Auto-hide controls on mouse idle
  const handleMouseMove = () => {
    setShowControls(true);
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
    }
    hideControlsTimerRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3500);
  };

  // Calculate formatted time helper
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return "00:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const h = Math.floor(m / 60);
    if (h > 0) {
      const remM = m % 60;
      return `${h}:${remM < 10 ? "0" : ""}${remM}:${s < 10 ? "0" : ""}${s}`;
    }
    return `${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // Time difference from live edge (e.g. -01:35)
  const timeBehindLive = Math.max(0, liveEdge - currentTime);

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 group select-none flex flex-col justify-between"
    >
      <video
        ref={videoRef}
        className="w-full h-full object-contain cursor-pointer"
        muted={isMuted}
        playsInline
        autoPlay
        onClick={togglePlay}
      />

      {/* Loading spinner */}
      {status === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 z-20 pointer-events-auto">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-white/70 font-medium">Connecting & buffering stream...</p>
          <button
            onClick={() => setRetryCount((c) => c + 1)}
            className="mt-2 text-xs px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/90 transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry Connection
          </button>
        </div>
      )}

      {/* Click to play prompt (autoplay blocked) */}
      {status === "paused" && !isPlaying && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 cursor-pointer z-20"
          onClick={togglePlay}
        >
          <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center hover:scale-110 hover:bg-white/20 transition-all shadow-xl">
            <Play className="w-8 h-8 text-white fill-white ml-1" />
          </div>
          <p className="text-white/90 text-sm font-semibold">Click to Play</p>
        </div>
      )}

      {/* Offline state */}
      {status === "offline" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 z-20">
          <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center">
            <Radio className="w-7 h-7 text-white/30" />
          </div>
          <p className="text-white/70 text-sm font-medium">Stream Offline</p>
          <button
            onClick={() => setRetryCount((c) => c + 1)}
            className="text-xs font-semibold px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg transition-all"
          >
            Reconnect Now
          </button>
        </div>
      )}

      {/* Top Bar (Status Indicator & Time Diff) */}
      <div className={`absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 via-black/30 to-transparent transition-opacity duration-300 z-10 flex items-center justify-between ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="flex items-center gap-2">
          <button
            onClick={jumpToLive}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all shadow-md ${
              isLive 
                ? "bg-red-600/90 text-white animate-pulse" 
                : "bg-gray-800/80 hover:bg-red-600/80 text-gray-300 hover:text-white"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-white' : 'bg-gray-400'}`} />
            {isLive ? "LIVE" : `DVR (-${formatTime(timeBehindLive)})`}
          </button>
          {!isLive && (
            <span className="text-[11px] text-white/70 bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded-md">
              Past Playback
            </span>
          )}
        </div>

        <button
          onClick={() => setRetryCount(c => c + 1)}
          title="Reload Player Stream"
          className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* YouTube Style DVR Control Bar */}
      <div className={`absolute bottom-0 left-0 right-0 px-4 py-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent transition-opacity duration-300 z-10 flex flex-col gap-2 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        
        {/* Timeline Scrubber */}
        <div className="relative w-full flex items-center group/scrubber cursor-pointer">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.5}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 group-hover/scrubber:h-2.5 bg-white/20 hover:bg-white/30 rounded-lg appearance-none cursor-pointer accent-red-600 transition-all"
          />
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="p-1.5 rounded-lg hover:bg-white/15 text-white transition-colors"
              title={isPlaying ? "Pause (k)" : "Play (k)"}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-white" />}
            </button>

            {/* Jump -10s */}
            <button
              onClick={() => seekRelative(-10)}
              className="p-1.5 rounded-lg hover:bg-white/15 text-white/80 hover:text-white transition-colors flex items-center gap-1 text-xs"
              title="Go back 10 seconds"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="text-[10px] font-bold">-10s</span>
            </button>

            {/* Volume Control */}
            <div className="flex items-center gap-1.5 group/vol">
              <button
                onClick={toggleMute}
                className="p-1.5 rounded-lg hover:bg-white/15 text-white transition-colors"
                title={isMuted ? "Unmute (m)" : "Mute (m)"}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5 text-red-400" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-14 sm:w-20 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer accent-white hidden group-hover/vol:inline-block transition-all"
              />
            </div>

            {/* Timestamps */}
            <div className="text-xs text-white/80 font-medium tracking-tight ml-1 flex items-center gap-1">
              <span>{formatTime(currentTime)}</span>
              <span className="text-white/40">/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Go Live Button */}
            {!isLive && (
              <button
                onClick={jumpToLive}
                className="px-2.5 py-1 rounded-md bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Catch Up To Live</span>
              </button>
            )}

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg hover:bg-white/15 text-white transition-colors"
              title={isFullscreen ? "Exit Fullscreen (f)" : "Fullscreen (f)"}
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
