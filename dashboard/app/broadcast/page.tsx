"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function BroadcastStudio() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      setError(`Failed to access camera: ${err.message}`);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const startBroadcast = async () => {
    if (!stream) return;
    setError(null);
    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      pcRef.current = pc;

      // Add tracks to PeerConnection
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Create Offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // WHIP endpoint is usually POST /live/stream/whip on the webrtc port (8889)
      const whipUrl = "http://localhost:8889/live/stream/whip";
      
      const response = await fetch(whipUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/sdp",
        },
        body: offer.sdp,
      });

      if (!response.ok) {
        throw new Error(`WHIP server responded with ${response.status}`);
      }

      const answerSdp = await response.text();
      await pc.setRemoteDescription(new RTCSessionDescription({
        type: "answer",
        sdp: answerSdp,
      }));

      setIsBroadcasting(true);
    } catch (err: any) {
      setError(`Broadcast failed: ${err.message}`);
      setIsBroadcasting(false);
    }
  };

  const stopBroadcast = () => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    setIsBroadcasting(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopBroadcast();
      stopCamera();
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#080b14] flex flex-col">
      {/* Nav */}
      <nav className="border-b border-white/8 bg-[#080b14]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="8" />
              </svg>
            </div>
            <span className="font-semibold text-white text-sm">Broadcaster Studio</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="px-3 py-1.5 text-xs font-medium text-white/50 hover:text-white transition-colors">
              Viewer Dashboard
            </Link>
            <button onClick={handleLogout} className="px-3 py-1.5 text-xs font-medium text-white/50 hover:text-red-400 transition-colors">
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main Studio */}
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-4xl bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
          {/* Video Preview */}
          <div className="relative aspect-video bg-black flex items-center justify-center">
            {!stream && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                  <svg className="w-8 h-8 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-white/40 text-sm">Camera Offline</p>
              </div>
            )}
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={`w-full h-full object-contain ${stream ? 'opacity-100' : 'opacity-0'}`}
            />
            {isBroadcasting && (
              <div className="absolute top-4 left-4 bg-red-600 px-3 py-1 rounded-full flex items-center gap-2 shadow-lg">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                <span className="text-white text-xs font-bold tracking-widest uppercase">Live</span>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="p-6 bg-white/5 border-t border-white/10 flex items-center justify-between">
            <div className="flex gap-3">
              {!stream ? (
                <button
                  onClick={startCamera}
                  className="px-5 py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-medium text-sm transition-colors"
                >
                  Enable Camera
                </button>
              ) : (
                <button
                  onClick={stopCamera}
                  disabled={isBroadcasting}
                  className="px-5 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-medium text-sm transition-colors disabled:opacity-50"
                >
                  Disable Camera
                </button>
              )}
            </div>

            <div className="flex-1 px-6">
              {error && (
                <p className="text-xs text-red-400 text-center">{error}</p>
              )}
            </div>

            <div>
              {!isBroadcasting ? (
                <button
                  onClick={startBroadcast}
                  disabled={!stream}
                  className="px-6 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium text-sm transition-colors shadow-[0_0_15px_rgba(239,68,68,0.3)] disabled:opacity-50 disabled:shadow-none"
                >
                  Start Broadcast
                </button>
              ) : (
                <button
                  onClick={stopBroadcast}
                  className="px-6 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-white font-medium text-sm transition-colors"
                >
                  Stop Broadcast
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
