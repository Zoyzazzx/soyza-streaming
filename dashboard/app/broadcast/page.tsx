"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogOut, Home, Settings, Radio, Video, Mic, Monitor, Network, Save } from "lucide-react";
import NetworkStatus from "@/components/NetworkStatus";
import FailoverLog from "@/components/FailoverLog";

interface Adapter {
  Name: string;
  Status: string;
  InterfaceDescription: string;
}

interface Gateway {
  NextHop: string;
  InterfaceAlias: string;
}

export default function BroadcastStudio() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Devices
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [selectedMic, setSelectedMic] = useState<string>("");
  const [resolution, setResolution] = useState("720p");

  // Network Config
  const [mode, setMode] = useState<"interface" | "gateway">("interface");
  const [primaryNetwork, setPrimaryNetwork] = useState("");
  const [backupNetwork, setBackupNetwork] = useState("");
  const [adapters, setAdapters] = useState<Adapter[]>([]);
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [configSaving, setConfigSaving] = useState(false);
  const [configMsg, setConfigMsg] = useState("");

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Enumerate devices
    async function getDevices() {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(d => d.kind === "videoinput");
        const audioInputs = devices.filter(d => d.kind === "audioinput");
        setCameras(videoInputs);
        setMics(audioInputs);
        if (videoInputs.length > 0) setSelectedCamera(videoInputs[0].deviceId);
        if (audioInputs.length > 0) setSelectedMic(audioInputs[0].deviceId);
      } catch (err) {
        console.error("Device enumeration error:", err);
      }
    }
    getDevices();

    // Fetch initial network config & hardware info
    fetch("/api/settings").then(res => res.json()).then(data => {
       if (data.mode) setMode(data.mode);
       if (data.primary) setPrimaryNetwork(data.primary);
       if (data.backup) setBackupNetwork(data.backup);
       if (data.adapters) setAdapters(data.adapters);
       if (data.gateways) setGateways(data.gateways);
    }).catch(() => {});
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const startCamera = async () => {
    try {
      const constraints: MediaStreamConstraints = {
        video: { 
          deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
          width: resolution === "1080p" ? { ideal: 1920 } : resolution === "720p" ? { ideal: 1280 } : { ideal: 854 },
          height: resolution === "1080p" ? { ideal: 1080 } : resolution === "720p" ? { ideal: 720 } : { ideal: 480 },
        },
        audio: {
          deviceId: selectedMic ? { exact: selectedMic } : undefined,
        },
      };
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
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

      stream.getTracks().forEach((track) => {
        const transceiver = pc.addTransceiver(track, { streams: [stream] });
        if (track.kind === "video") {
          const capabilities = RTCRtpSender.getCapabilities("video");
          if (capabilities) {
            const h264Codecs = capabilities.codecs.filter(
              (c) => c.mimeType.toLowerCase() === "video/h264"
            );
            if (h264Codecs.length > 0) {
              transceiver.setCodecPreferences(h264Codecs);
            }
          }
        }
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === "complete") {
          resolve();
        } else {
          const check = () => {
            if (pc.iceGatheringState === "complete") {
              pc.removeEventListener("icegatheringstatechange", check);
              resolve();
            }
          };
          pc.addEventListener("icegatheringstatechange", check);
          setTimeout(resolve, 4000);
        }
      });

      const whipUrl = "http://localhost:8889/live/stream/whip";
      const response = await fetch(whipUrl, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: pc.localDescription!.sdp,
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

  const stopBroadcast = async () => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    setIsBroadcasting(false);

    try {
      await fetch("http://localhost:4000/api/stitch", { method: "POST" });
    } catch (err) {
      console.error("Could not reach worker to stitch recording:", err);
    }
  };

  useEffect(() => {
    return () => {
      stopBroadcast();
      stopCamera();
    };
  }, []);

  const saveNetworkConfig = async () => {
    setConfigSaving(true);
    setConfigMsg("");
    try {
       const res = await fetch("/api/settings", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ mode, primary: primaryNetwork, backup: backupNetwork })
       });
       if(res.ok) {
         setConfigMsg("Saved! Restart monitor script.");
       } else {
         setConfigMsg("Failed to save.");
       }
    } catch(err) {
       setConfigMsg("Error saving config.");
    } finally {
       setConfigSaving(false);
       setTimeout(() => setConfigMsg(""), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* ── Navigation ── */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="w-full mx-auto px-4 sm:px-8 2xl:px-12 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 transition-colors shadow-md group">
              <Home className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
            </Link>
            <div>
              <span className="font-bold text-gray-900 text-lg tracking-tight block">ZoyzaXR</span>
              <span className="text-gray-500 text-xs">Broadcast Studio</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
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
      <main className="flex-1 w-full mx-auto px-4 sm:px-8 2xl:px-12 py-8 grid grid-cols-1 xl:grid-cols-4 gap-8">
        
        {/* Left Column: Video & Controls */}
        <div className="xl:col-span-3 space-y-6 flex flex-col h-full">
           <div className="bg-white border border-gray-200 rounded-3xl shadow-xl overflow-hidden flex flex-col flex-1 animate-in fade-in slide-in-from-bottom-8 duration-700">
             
             {/* Header */}
             <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
               <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                 <Radio className="w-5 h-5 text-indigo-500" />
                 Studio Preview
               </h2>
               {isBroadcasting && (
                 <div className="bg-red-100 px-3 py-1 rounded-full flex items-center gap-2 shadow-sm border border-red-200">
                   <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                   <span className="text-red-700 text-[10px] font-bold tracking-widest uppercase">Live Broadcast</span>
                 </div>
               )}
             </div>

             {/* Video Canvas */}
             <div className="relative w-full aspect-video bg-black flex items-center justify-center">
                {!stream && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-10">
                    <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                      <Video className="w-8 h-8 text-white/30" />
                    </div>
                    <h3 className="text-white font-medium text-lg">Camera Offline</h3>
                    <p className="text-white/40 text-sm mt-1">Select devices and enable camera to begin</p>
                  </div>
                )}
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className={`w-full h-full object-contain ${stream ? 'opacity-100' : 'opacity-0'}`}
                />
             </div>

             {/* Setup & Controls */}
             <div className="p-6 bg-white space-y-6">
                
                {/* Device Selectors */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                     <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1 flex items-center gap-1.5"><Video className="w-3 h-3" /> Camera</label>
                     <select 
                       value={selectedCamera} 
                       onChange={(e) => setSelectedCamera(e.target.value)}
                       disabled={stream !== null}
                       className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 disabled:opacity-50"
                     >
                       {cameras.map(c => <option key={c.deviceId} value={c.deviceId}>{c.label || `Camera ${c.deviceId.substring(0,5)}`}</option>)}
                     </select>
                  </div>
                  <div className="space-y-1.5">
                     <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1 flex items-center gap-1.5"><Mic className="w-3 h-3" /> Microphone</label>
                     <select 
                       value={selectedMic} 
                       onChange={(e) => setSelectedMic(e.target.value)}
                       disabled={stream !== null}
                       className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 disabled:opacity-50"
                     >
                       {mics.map(m => <option key={m.deviceId} value={m.deviceId}>{m.label || `Mic ${m.deviceId.substring(0,5)}`}</option>)}
                     </select>
                  </div>
                  <div className="space-y-1.5">
                     <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1 flex items-center gap-1.5"><Monitor className="w-3 h-3" /> Resolution</label>
                     <select 
                       value={resolution} 
                       onChange={(e) => setResolution(e.target.value)}
                       disabled={stream !== null}
                       className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 disabled:opacity-50"
                     >
                       <option value="1080p">1080p (FHD)</option>
                       <option value="720p">720p (HD)</option>
                       <option value="480p">480p (SD)</option>
                     </select>
                  </div>
                </div>

                <div className="h-px w-full bg-gray-100"></div>

                {/* Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {!stream ? (
                      <button onClick={startCamera} className="px-6 py-3 rounded-xl bg-gray-900 hover:bg-black text-white font-semibold text-sm transition-all shadow-md flex items-center gap-2">
                        <Video className="w-4 h-4" /> Enable Camera
                      </button>
                    ) : (
                      <button onClick={stopCamera} disabled={isBroadcasting} className="px-6 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm transition-all flex items-center gap-2 disabled:opacity-50">
                        Stop Camera
                      </button>
                    )}
                  </div>
                  
                  {error && <p className="text-xs text-red-500 font-medium px-4">{error}</p>}

                  <div>
                     {!isBroadcasting ? (
                       <button onClick={startBroadcast} disabled={!stream} className="px-8 py-3 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-bold text-sm transition-all shadow-lg shadow-red-500/30 flex items-center gap-2 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed">
                         <Radio className="w-4 h-4" /> Start Broadcast
                       </button>
                     ) : (
                       <button onClick={stopBroadcast} className="px-8 py-3 rounded-xl bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-700 border border-gray-200 font-bold text-sm transition-all flex items-center gap-2 shadow-sm">
                         Stop Broadcast
                       </button>
                     )}
                  </div>
                </div>

             </div>
           </div>
        </div>

        {/* Right Column: Network Config, Status, Logs */}
        <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-700 delay-100">
           
           {/* Network Config */}
           <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 space-y-4">
             <div className="flex items-center justify-between border-b border-gray-100 pb-3">
               <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                 <Network className="w-4 h-4 text-indigo-500" />
                 Failover Configuration
               </h2>
             </div>
             
             <div className="space-y-4 pt-1">
               <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500">Failover Mode</label>
                  <select 
                    value={mode} 
                    onChange={(e) => {
                      setMode(e.target.value as "interface" | "gateway");
                      setPrimaryNetwork("");
                      setBackupNetwork("");
                    }}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block p-2.5"
                  >
                    <option value="interface">By Network Adapter</option>
                    <option value="gateway">By Gateway IP</option>
                  </select>
               </div>
               <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500">Primary {mode === 'interface' ? 'Adapter' : 'Gateway'}</label>
                  <select 
                    value={primaryNetwork} 
                    onChange={(e) => setPrimaryNetwork(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block p-2.5"
                  >
                    <option value="" disabled>Select Primary...</option>
                    {mode === 'interface' 
                      ? adapters.map(opt => (
                          <option key={opt.Name} value={opt.Name}>
                            {opt.Name} ({opt.Status}) — {opt.InterfaceDescription ? opt.InterfaceDescription.substring(0, 30) : ''}...
                          </option>
                        ))
                      : gateways.map(opt => (
                          <option key={opt.NextHop} value={opt.NextHop}>
                            {opt.NextHop} (via {opt.InterfaceAlias})
                          </option>
                        ))
                    }
                  </select>
               </div>
               <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500">Backup {mode === 'interface' ? 'Adapter' : 'Gateway'}</label>
                  <select 
                    value={backupNetwork} 
                    onChange={(e) => setBackupNetwork(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block p-2.5"
                  >
                    <option value="" disabled>Select Backup...</option>
                    {mode === 'interface' 
                      ? adapters.map(opt => (
                          <option key={opt.Name} value={opt.Name}>
                            {opt.Name} ({opt.Status}) — {opt.InterfaceDescription ? opt.InterfaceDescription.substring(0, 30) : ''}...
                          </option>
                        ))
                      : gateways.map(opt => (
                          <option key={opt.NextHop} value={opt.NextHop}>
                            {opt.NextHop} (via {opt.InterfaceAlias})
                          </option>
                        ))
                    }
                  </select>
               </div>
               <div className="flex items-center justify-between pt-2">
                  <span className="text-xs font-medium text-emerald-600">{configMsg}</span>
                  <button 
                    onClick={saveNetworkConfig}
                    disabled={configSaving}
                    className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" /> {configSaving ? 'Saving...' : 'Save Config'}
                  </button>
               </div>
             </div>
           </div>

           <NetworkStatus />
           <FailoverLog />
        </div>
      </main>
    </div>
  );
}
