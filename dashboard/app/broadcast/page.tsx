"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LogOut,
  Home,
  Settings,
  Radio,
  Video,
  Mic,
  Monitor,
  Network,
  Save,
  X,
  RefreshCw,
  Lock,
  Globe,
  HardDrive,
  Sliders,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Key,
  Copy,
  Check,
  Eye,
  EyeOff,
  Volume2,
  VideoOff,
  MicOff,
  Shield,
  Server,
  Activity,
  Layers,
  AlertTriangle,
  PanelLeftClose,
  PanelLeft,
  ChevronDown,
  User,
  Tv,
  CheckCircle2,
  AlertCircle,
  Cpu,
  UploadCloud,
  Laptop
} from "lucide-react";
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

interface ServiceHealth {
  online: boolean;
  message?: string;
  streaming?: boolean;
}

interface SystemHealthState {
  allHealthy: boolean;
  services: {
    mediamtx: ServiceHealth;
    worker: ServiceHealth;
    monitor: ServiceHealth;
  };
}

export default function BroadcastStudio() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [broadcastStartTime, setBroadcastStartTime] = useState<number | null>(null);
  const [sessionCreatedTime, setSessionCreatedTime] = useState<number>(Date.now());
  const [broadcastDuration, setBroadcastDuration] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Backend system health tracking
  const [systemHealth, setSystemHealth] = useState<SystemHealthState>({
    allHealthy: false,
    services: {
      mediamtx: { online: false, message: "Checking..." },
      worker: { online: false, message: "Checking..." },
      monitor: { online: false, message: "Checking..." },
    },
  });

  // User auth state
  const [userEmail, setUserEmail] = useState<string>("admin@zoyzair.tv");
  const [userRole, setUserRole] = useState<string>("Streamer");

  // Progressive Wizard States (5 Steps: Identity, Privacy, Failover, Archival, Hardware)
  const [isWizardComplete, setIsWizardComplete] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Stream Configuration
  const [streamName, setStreamName] = useState("My Live Broadcast");
  const [isPublic, setIsPublic] = useState(false);
  const [streamId, setStreamId] = useState("");
  const [streamPassword, setStreamPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showSidebarPassword, setShowSidebarPassword] = useState(false);
  const [recordEnabled, setRecordEnabled] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [routingMode, setRoutingMode] = useState<"local" | "tunneled">("local");

  // Hardware & Devices
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [selectedMic, setSelectedMic] = useState<string>("");
  const [resolution, setResolution] = useState("720p");
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);

  // Hydrate persistent broadcast session from localStorage on initial mount
  useEffect(() => {
    try {
      const savedSession = localStorage.getItem("zoyzair_active_session");
      if (savedSession) {
        const parsed = JSON.parse(savedSession);
        if (parsed.isWizardComplete) {
          setIsWizardComplete(true);
          if (parsed.streamName) setStreamName(parsed.streamName);
          if (parsed.isPublic !== undefined) setIsPublic(parsed.isPublic);
          if (parsed.streamId) setStreamId(parsed.streamId);
          if (parsed.streamPassword) setStreamPassword(parsed.streamPassword);
          if (parsed.recordEnabled !== undefined) setRecordEnabled(parsed.recordEnabled);
          if (parsed.sessionCreatedTime) setSessionCreatedTime(parsed.sessionCreatedTime);
          if (parsed.resolution) setResolution(parsed.resolution);
        }
      }
    } catch {}
  }, []);

  // Save session state to localStorage
  const saveSessionToStorage = (overrides?: any) => {
    try {
      const stateToSave = {
        isWizardComplete: true,
        streamName: overrides?.streamName ?? streamName,
        isPublic: overrides?.isPublic ?? isPublic,
        streamId: overrides?.streamId ?? streamId,
        streamPassword: overrides?.streamPassword ?? streamPassword,
        recordEnabled: overrides?.recordEnabled ?? recordEnabled,
        sessionCreatedTime: overrides?.sessionCreatedTime ?? sessionCreatedTime,
        resolution: overrides?.resolution ?? resolution,
      };
      localStorage.setItem("zoyzair_active_session", JSON.stringify(stateToSave));
    } catch {}
  };

  const clearSessionStorage = () => {
    try {
      localStorage.removeItem("zoyzair_active_session");
    } catch {}
  };

  // Sidebar collapsible state
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Privacy change confirmation modals
  const [privacyWarningModal, setPrivacyWarningModal] = useState<{
    target: "public" | "private";
    isOpen: boolean;
  }>({ target: "public", isOpen: false });
  const [pendingPrivateId, setPendingPrivateId] = useState("");
  const [pendingPrivatePassword, setPendingPrivatePassword] = useState("");

  // Network Config
  const [mode, setMode] = useState<"interface" | "gateway">("interface");
  const [primaryNetwork, setPrimaryNetwork] = useState("");
  const [backupNetwork, setBackupNetwork] = useState("");
  const [adapters, setAdapters] = useState<Adapter[]>([]);
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [configSaving, setConfigSaving] = useState(false);
  const [configMsg, setConfigMsg] = useState("");
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function checkRole() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      const role = session.user.user_metadata?.role || "streamer";
      if (session.user.email) setUserEmail(session.user.email);
      setUserRole(role.charAt(0).toUpperCase() + role.slice(1));

      if (role === "viewer") {
        router.push("/viewer");
        return;
      }
    }
    checkRole();

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
  }, [router, supabase]);

  // Periodic system health & routing polling
  useEffect(() => {
    async function checkHealthAndRouting() {
      try {
        const res = await fetch("/api/system-health");
        if (res.ok) {
          const data = await res.json();
          setSystemHealth(data);
        }
      } catch (err) {
        console.error("Health check error:", err);
      }

      try {
        const routeRes = await fetch("/api/stream-routing");
        if (routeRes.ok) {
          const routeData = await routeRes.json();
          if (routeData.routingMode) {
            setRoutingMode(routeData.routingMode);
          }
        }
      } catch {}
    }
    checkHealthAndRouting();
    const interval = setInterval(checkHealthAndRouting, 3000);
    return () => clearInterval(interval);
  }, []);

  // Restart camera preview whenever selected camera/mic/resolution changes
  const startCamera = async (camId = selectedCamera, micId = selectedMic, res = resolution) => {
    try {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      const constraints: MediaStreamConstraints = {
        video: { 
          deviceId: camId ? { exact: camId } : undefined,
          width: res === "1080p" ? { ideal: 1920 } : res === "720p" ? { ideal: 1280 } : { ideal: 854 },
          height: res === "1080p" ? { ideal: 1080 } : res === "720p" ? { ideal: 720 } : { ideal: 480 },
        },
        audio: {
          deviceId: micId ? { exact: micId } : undefined,
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

  // Toggle video/audio tracks
  const toggleMute = () => {
    if (stream) {
      const audioTracks = stream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideoMute = () => {
    if (stream) {
      const videoTracks = stream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = isVideoMuted;
      });
      setIsVideoMuted(!isVideoMuted);
    }
  };

  // Synchronize stream settings to the server
  const syncStreamMetadata = async (customOverrides?: any) => {
    try {
      await fetch("/api/stream-auth", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          streamId: customOverrides?.streamId || streamId,
          password: customOverrides?.password || streamPassword,
          isPublic: customOverrides?.isPublic !== undefined ? customOverrides.isPublic : isPublic,
          title: customOverrides?.title || streamName,
          recordEnabled: customOverrides?.recordEnabled !== undefined ? customOverrides.recordEnabled : recordEnabled,
        })
      });
    } catch (err) {
      console.error("Failed to sync stream settings", err);
    }
  };

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const handleFinishWizard = async () => {
    await syncStreamMetadata();
    const startTime = Date.now();
    setSessionCreatedTime(startTime);
    saveSessionToStorage({ sessionCreatedTime: startTime });
    setIsWizardComplete(true);
    setHasUnsavedChanges(false);
  };

  const handleRestartWizard = () => {
    clearSessionStorage();
    setIsWizardComplete(false);
    setWizardStep(1);
  };

  const handleDeleteStream = async () => {
    try {
      // If actively broadcasting, stop it
      if (isBroadcasting) {
        await stopBroadcast();
      }
      stopCamera();

      // Clear on server
      await fetch("/api/stream-auth", { method: "DELETE" });

      // Clear local state and storage
      clearSessionStorage();
      setStreamName("My Live Broadcast");
      setIsPublic(false);
      setStreamId("");
      setStreamPassword("");
      setIsWizardComplete(false);
      setWizardStep(1);
      setIsDeleteModalOpen(false);
    } catch (err) {
      console.error("Failed to delete stream:", err);
    }
  };

  const generateRandomCredentials = () => {
    setStreamId(Math.floor(100000 + Math.random() * 900000).toString());
    setStreamPassword(Math.random().toString(36).slice(-8));
  };

  const copyCredentials = () => {
    navigator.clipboard.writeText(`Stream ID: ${streamId}\nPassword: ${streamPassword}`);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  // Privacy change handlers with confirmation
  const requestPrivacyChange = (target: "public" | "private") => {
    if (target === "public") {
      setPrivacyWarningModal({ target: "public", isOpen: true });
    } else {
      setPendingPrivateId(streamId || Math.floor(100000 + Math.random() * 900000).toString());
      setPendingPrivatePassword(streamPassword || Math.random().toString(36).slice(-8));
      setPrivacyWarningModal({ target: "private", isOpen: true });
    }
  };

  const confirmMakePublic = async () => {
    setIsPublic(true);
    setHasUnsavedChanges(true);
    setPrivacyWarningModal({ target: "public", isOpen: false });
  };

  const confirmMakePrivate = async () => {
    setIsPublic(false);
    setStreamId(pendingPrivateId);
    setStreamPassword(pendingPrivatePassword);
    setHasUnsavedChanges(true);
    setPrivacyWarningModal({ target: "private", isOpen: false });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // We use a ref to hold the latest startBroadcast function so the event listener doesn't use stale closures
  const startBroadcastRef = useRef<((isRetry?: boolean) => Promise<void>) | null>(null);
  const intendedStopRef = useRef<boolean>(false);

  const startBroadcast = async (isRetry = false) => {
    intendedStopRef.current = false;

    // Helper to trigger retry loop
    const scheduleRetry = (msg: string) => {
      if (intendedStopRef.current) return;
      
      // If we are actively retrying, we hide the top error banner and rely on the UI overlay
      if (!isRetry) {
        setError(msg);
      }
      
      if (isRetry) {
        setTimeout(() => {
          if (startBroadcastRef.current && !intendedStopRef.current) {
            startBroadcastRef.current(true);
          }
        }, 3000);
      }
    };

    // 1. Verify all 3 backend infrastructure components are online
    if (!systemHealth.services.mediamtx.online) {
      scheduleRetry("MediaMTX streaming server is offline or unreachable.");
      return;
    }
    if (!systemHealth.services.worker.online) {
      scheduleRetry("Upload Worker service is offline or unreachable.");
      return;
    }
    if (!systemHealth.services.monitor.online) {
      scheduleRetry("Connectivity Monitor is offline.");
      return;
    }

    if (!stream) {
      await startCamera();
    }
    if (!primaryNetwork || !backupNetwork) {
      setError("Failover configuration is incomplete. Please select primary and backup connections in Failover Settings.");
      setIsConfigModalOpen(true);
      return;
    }
    setError(null);

    // Sync latest stream params and mark session start
    const startTime = Date.now();
    setSessionCreatedTime(startTime);
    await syncStreamMetadata();

    try {
      const activeStream = stream || (await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      }));

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      pcRef.current = pc;

      // Handle unexpected disconnects (e.g. MediaMTX crashes)
      pc.addEventListener("connectionstatechange", () => {
        if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
          if (pcRef.current === pc && !intendedStopRef.current) {
            console.warn("WebRTC connection lost. Attempting auto-reconnect...");
            // DO NOT set isBroadcasting(false) so the stream UI doesn't visually "end".
            // Instead, set isReconnecting(true) to trigger the overlay.
            setIsReconnecting(true);
            setError(null); 
            pc.close();
            pcRef.current = null;
            
            setTimeout(() => {
              if (startBroadcastRef.current && !intendedStopRef.current) {
                startBroadcastRef.current(true);
              }
            }, 3000);
          }
        }
      });

      activeStream.getTracks().forEach((track) => {
        const transceiver = pc.addTransceiver(track, { streams: [activeStream] });
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
      setIsReconnecting(false);
      setBroadcastStartTime(startTime);
      setBroadcastDuration(0);
      setError(null);

      // Notify Supabase cloud that live broadcast is active
      try {
        await supabase.from("system_settings").upsert([
          { key: "is_streaming", value: "true", updated_at: new Date().toISOString() },
          { key: "stream_title", value: streamName, updated_at: new Date().toISOString() },
          { key: "is_public", value: isPublic ? "true" : "false", updated_at: new Date().toISOString() }
        ], { onConflict: "key" });
      } catch (e) {
        console.warn("Notice updating cloud is_streaming:", e);
      }
    } catch (err: any) {
      scheduleRetry(`Broadcast failed: ${err.message}`);
      if (!isRetry) setIsBroadcasting(false);
    }
  };

  useEffect(() => {
    startBroadcastRef.current = startBroadcast;
  }, [startBroadcast]);

  const stopBroadcast = async () => {
    intendedStopRef.current = true;
    const wasBroadcasting = !!pcRef.current;
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    setIsBroadcasting(false);
    setIsReconnecting(false);
    setBroadcastStartTime(null);
    setBroadcastDuration(0);

    // Notify Supabase cloud that live broadcast has stopped
    try {
      await supabase.from("system_settings").upsert([
        { key: "is_streaming", value: "false", updated_at: new Date().toISOString() }
      ], { onConflict: "key" });
    } catch (e) {
      console.warn("Notice updating cloud is_streaming:", e);
    }

    if (wasBroadcasting && recordEnabled) {
      try {
        await fetch("http://localhost:4000/api/stitch", { 
          method: "POST", 
          keepalive: true 
        });
      } catch (err) {
        console.error("Could not reach worker to stitch recording:", err);
      }
    }
  };

  useEffect(() => {
    return () => {
      stopBroadcast();
      stopCamera();
    };
  }, []);

  // Prevent accidental page refresh when broadcasting
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isBroadcasting) {
        e.preventDefault();
        e.returnValue = "You are currently broadcasting. Are you sure you want to leave?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isBroadcasting]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isBroadcasting && broadcastStartTime) {
      interval = setInterval(() => {
        setBroadcastDuration(Math.floor((Date.now() - broadcastStartTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isBroadcasting, broadcastStartTime]);

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const saveNetworkConfig = async () => {
    setConfigSaving(true);
    setConfigMsg("");
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, primary: primaryNetwork, backup: backupNetwork })
      });
      if (!res.ok) throw new Error("Failed to save settings");
      setConfigMsg("Network failover targets saved successfully!");
      setTimeout(() => {
        setIsConfigModalOpen(false);
        setConfigMsg("");
      }, 1500);
    } catch (err: any) {
      setConfigMsg(`Error: ${err.message}`);
    } finally {
      setConfigSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-row font-sans selection:bg-purple-600 selection:text-white w-full overflow-x-hidden">
      
      {/* ═══════════════════════════════════════════════════════════════════
          LEFT SIDEBAR (Royal Purple Theme)
          ═══════════════════════════════════════════════════════════════════ */}
      <aside className={`${
        isSidebarOpen ? "w-72" : "w-20"
      } bg-white border-r border-gray-200 shrink-0 transition-all duration-300 flex flex-col justify-between z-40 sticky top-0 h-screen shadow-xs`}>
        
        {/* Top Branding Section */}
        <div>
          <div className={`h-16 flex items-center border-b border-gray-100 transition-all ${
            isSidebarOpen ? "px-4 justify-between" : "px-2 justify-center flex-col gap-1 py-1"
          }`}>
            {isSidebarOpen ? (
              <>
                <div className="flex items-center gap-3 overflow-hidden">
                  <img 
                    src="/logo.png" 
                    alt="ZoyzaXR Logo" 
                    className="w-10 h-10 rounded-2xl shadow-md object-cover border border-purple-100 shrink-0" 
                  />
                  <div className="truncate animate-in fade-in duration-200">
                    <span className="font-extrabold text-gray-900 text-base tracking-tight block">ZoyzaXR</span>
                    <span className="text-[10px] text-purple-600 font-bold uppercase tracking-wider block">Broadcast Studio</span>
                  </div>
                </div>

                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors shrink-0"
                  title="Collapse Sidebar"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </>
            ) : (
              <div className="flex items-center justify-center gap-1.5">
                <img 
                  src="/logo.png" 
                  alt="ZoyzaXR Logo" 
                  className="w-8 h-8 rounded-xl shadow-md object-cover border border-purple-100 shrink-0" 
                />
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                  title="Expand Sidebar"
                >
                  <PanelLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <div className="p-3 space-y-1">
            <Link
              href="/"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors ${
                !isSidebarOpen ? "justify-center px-0" : ""
              }`}
              title="Home"
            >
              <Home className="w-4 h-4 shrink-0" />
              {isSidebarOpen && <span>Home</span>}
            </Link>

            <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-xs bg-purple-50 text-purple-700 border border-purple-100 ${
              !isSidebarOpen ? "justify-center px-0" : ""
            }`} title="Broadcast Stage">
              <Radio className="w-4 h-4 shrink-0 text-purple-600" />
              {isSidebarOpen && <span>Broadcast Stage</span>}
            </div>

            <a
              href="/viewer"
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors ${
                !isSidebarOpen ? "justify-center px-0" : ""
              }`}
              title="Live Viewer (Opens in new tab)"
            >
              <Tv className="w-4 h-4 shrink-0" />
              {isSidebarOpen && <span>Live Viewer ↗</span>}
            </a>

            <a
              href="/recordings"
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors ${
                !isSidebarOpen ? "justify-center px-0" : ""
              }`}
              title="Recordings Library (Opens in new tab)"
            >
              <Video className="w-4 h-4 shrink-0" />
              {isSidebarOpen && <span>Recordings Library ↗</span>}
            </a>
          </div>

          {/* Sidebar Stream Controls & Parameters */}
          {isSidebarOpen && isWizardComplete && (
            <div className="px-4 py-3 space-y-4 border-t border-gray-100 animate-in fade-in duration-300">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Stream Controls</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsDeleteModalOpen(true)}
                    className="text-[10px] text-red-600 hover:underline font-bold"
                  >
                    Delete Stream
                  </button>
                  <span className="text-gray-300">•</span>
                  <button
                    onClick={handleRestartWizard}
                    className="text-[10px] text-purple-600 hover:underline font-bold"
                  >
                    Edit
                  </button>
                </div>
              </div>

              {/* Title Input */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-gray-600">Stream Title</label>
                <input
                  type="text"
                  value={streamName}
                  onChange={(e) => {
                    setStreamName(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-xs focus:outline-none focus:border-purple-500 shadow-xs"
                />
              </div>

              {/* Privacy Selector with confirmation */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-gray-600">Visibility Mode</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (!isPublic) requestPrivacyChange("public");
                    }}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                      isPublic ? "bg-emerald-50 border-emerald-300 text-emerald-700 shadow-xs" : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" /> Public
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (isPublic) requestPrivacyChange("private");
                    }}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                      !isPublic ? "bg-purple-50 border-purple-300 text-purple-700 shadow-xs" : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" /> Private
                  </button>
                </div>
              </div>

              {/* Private credentials snippet */}
              {!isPublic && (
                <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-200 space-y-1 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">ID:</span>
                    <span className="font-mono font-bold text-gray-900">{streamId || "Not set"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Pass:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-gray-900">
                        {showSidebarPassword ? (streamPassword || "Not set") : (streamPassword ? "••••••••" : "Not set")}
                      </span>
                      {streamPassword && (
                        <button
                          type="button"
                          onClick={() => setShowSidebarPassword(!showSidebarPassword)}
                          className="text-gray-400 hover:text-gray-700 p-0.5 rounded transition-colors"
                          title={showSidebarPassword ? "Hide Password" : "Show Password"}
                        >
                          {showSidebarPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Hardware Selection */}
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <label className="text-[11px] font-semibold text-gray-600 block">Camera Input</label>
                <select
                  value={selectedCamera}
                  onChange={(e) => {
                    setSelectedCamera(e.target.value);
                    startCamera(e.target.value, selectedMic, resolution);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-xs focus:outline-none focus:border-purple-500 shadow-xs"
                >
                  {cameras.map(c => <option key={c.deviceId} value={c.deviceId}>{c.label || "Camera"}</option>)}
                </select>

                <label className="text-[11px] font-semibold text-gray-600 block pt-1">Audio Input</label>
                <select
                  value={selectedMic}
                  onChange={(e) => {
                    setSelectedMic(e.target.value);
                    startCamera(selectedCamera, e.target.value, resolution);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-xs focus:outline-none focus:border-purple-500 shadow-xs"
                >
                  {mics.map(m => <option key={m.deviceId} value={m.deviceId}>{m.label || "Microphone"}</option>)}
                </select>
              </div>

              {/* Recording Toggle */}
              <div className="pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setRecordEnabled(!recordEnabled);
                    setHasUnsavedChanges(true);
                  }}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-between ${
                    recordEnabled ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-gray-50 border-gray-200 text-gray-500"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-3.5 h-3.5" />
                    <span>{recordEnabled ? "Recording Active" : "Recording Disabled"}</span>
                  </div>
                  <span className={`w-2 h-2 rounded-full ${recordEnabled ? "bg-blue-600" : "bg-gray-300"}`} />
                </button>
              </div>

              {/* Failover Config Trigger */}
              <button
                type="button"
                onClick={() => setIsConfigModalOpen(true)}
                className="w-full py-2 px-3 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors flex items-center justify-center gap-2"
              >
                <Settings className="w-3.5 h-3.5 text-gray-500" />
                <span>Failover Config</span>
              </button>

              {/* Save Stream Settings */}
              <button
                type="button"
                disabled={!hasUnsavedChanges}
                onClick={async () => {
                  await syncStreamMetadata();
                  saveSessionToStorage();
                  setHasUnsavedChanges(false);
                }}
                className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm ${
                  hasUnsavedChanges 
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-[0_0_10px_rgba(16,185,129,0.3)] active:scale-95" 
                    : "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                }`}
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Stream Settings</span>
              </button>
            </div>
          )}
        </div>

        {/* Bottom User & Logout Section */}
        <div className="p-3 border-t border-gray-100 space-y-2">
          {isSidebarOpen ? (
            <div className="flex items-center justify-between p-2 rounded-2xl bg-gray-50 border border-gray-100">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <span className="font-bold text-gray-900 text-xs block truncate">{userEmail}</span>
                  <span className="text-[10px] text-purple-600 block uppercase font-bold">{userRole}</span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors shrink-0"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          )}

          {isSidebarOpen && (
            <div className="text-center text-[10px] text-gray-400 font-medium">
              ZoyzaXR • Kingston University
            </div>
          )}
        </div>
      </aside>

      {/* ═══════════════════════════════════════════════════════════════════
          RIGHT MAIN CONTENT AREA
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        
        {/* Top Header Bar - ONLY VISIBLE AFTER WIZARD IS FINISHED */}
        {isWizardComplete ? (
          <header className="h-16 bg-white border-b border-gray-200 px-6 sm:px-8 flex items-center justify-between shrink-0 animate-in fade-in duration-300">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-extrabold text-gray-900 tracking-tight">{streamName}</h1>
              
              {/* Status pills */}
              {isPublic ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5" /> Public
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" /> Private ({streamId})
                </span>
              )}

              {recordEnabled ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                  <HardDrive className="w-3.5 h-3.5" /> Recording Enabled
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200 flex items-center gap-1">
                  <HardDrive className="w-3.5 h-3.5 text-gray-400" /> Recording Off
                </span>
              )}

              {/* Stream Route Pill */}
              <Link
                href="/settings"
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 hover:opacity-80 transition-opacity ${
                  routingMode === "tunneled"
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : "bg-blue-50 text-blue-700 border-blue-200"
                }`}
                title="Click to configure Local vs Tunneled route in Settings"
              >
                {routingMode === "tunneled" ? (
                  <>
                    <Globe className="w-3 h-3 text-amber-600" /> Tunneled Route
                  </>
                ) : (
                  <>
                    <Laptop className="w-3 h-3 text-blue-600" /> Local Direct
                  </>
                )}
              </Link>
            </div>

            {/* Middle / Right: 3 Backend Infrastructure Component Health Indicators */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-2xl bg-gray-50 border border-gray-200 shadow-2xs">
                {/* 1. MediaMTX Server */}
                <div 
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white transition-colors cursor-help"
                  title={`MediaMTX Streaming Server: ${systemHealth.services.mediamtx.message}`}
                >
                  <Server className={`w-3.5 h-3.5 ${systemHealth.services.mediamtx.online ? "text-indigo-600" : "text-red-500"}`} />
                  <span className="text-[11px] font-bold text-gray-700 hidden xl:inline">MediaMTX</span>
                  <span className={`w-2 h-2 rounded-full ${
                    systemHealth.services.mediamtx.online ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]" : "bg-red-500 animate-pulse shadow-[0_0_6px_rgba(239,68,68,0.7)]"
                  }`} />
                </div>

                <div className="w-px h-3.5 bg-gray-200" />

                {/* 2. Upload Worker */}
                <div 
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white transition-colors cursor-help"
                  title={`Upload Worker (Port 4000): ${systemHealth.services.worker.message}`}
                >
                  <UploadCloud className={`w-3.5 h-3.5 ${systemHealth.services.worker.online ? "text-cyan-600" : "text-red-500"}`} />
                  <span className="text-[11px] font-bold text-gray-700 hidden xl:inline">Upload Worker</span>
                  <span className={`w-2 h-2 rounded-full ${
                    systemHealth.services.worker.online ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]" : "bg-red-500 animate-pulse shadow-[0_0_6px_rgba(239,68,68,0.7)]"
                  }`} />
                </div>

                <div className="w-px h-3.5 bg-gray-200" />

                {/* 3. Connectivity Monitor */}
                <div 
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white transition-colors cursor-help"
                  title={`Connectivity & Failover Monitor: ${systemHealth.services.monitor.message}`}
                >
                  <Activity className={`w-3.5 h-3.5 ${systemHealth.services.monitor.online ? "text-purple-600" : "text-red-500"}`} />
                  <span className="text-[11px] font-bold text-gray-700 hidden xl:inline">Monitor</span>
                  <span className={`w-2 h-2 rounded-full ${
                    systemHealth.services.monitor.online ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]" : "bg-red-500 animate-pulse shadow-[0_0_6px_rgba(239,68,68,0.7)]"
                  }`} />
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-500 mr-2">
                <span>Status: <b className={isBroadcasting ? "text-red-600 font-bold" : "text-gray-700"}>{isBroadcasting ? "LIVE" : "STANDBY"}</b></span>
                <span>•</span>
                <span>Duration: <b className="font-mono text-gray-900">{formatDuration(broadcastDuration)}</b></span>
              </div>

              {!isPublic && (
                <button
                  onClick={copyCredentials}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 border border-gray-200 text-xs font-semibold text-gray-700 transition-all shadow-xs"
                  title="Copy Stream ID & Password"
                >
                  {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey ? "Copied" : "Copy Keys"}</span>
                </button>
              )}

              {/* Delete / Discard Stream Action */}
              <button
                onClick={() => setIsDeleteModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-xs font-semibold text-red-700 transition-all shadow-xs"
                title="Delete created stream"
              >
                <span>Delete Stream</span>
              </button>

              {/* Dedicated Red Accent ONLY when on air or to end stream */}
              {isBroadcasting ? (
                <button
                  onClick={stopBroadcast}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-all shadow-sm active:scale-95 animate-pulse"
                >
                  <span className="w-2 h-2 rounded-full bg-white" />
                  End Broadcast
                </button>
              ) : (
                <button
                  onClick={() => startBroadcast()}
                  className="flex items-center gap-2 px-6 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white font-bold text-xs transition-all shadow-md active:scale-95"
                >
                  <Radio className="w-3.5 h-3.5" />
                  Go Live Now
                </button>
              )}
            </div>
          </header>
        ) : (
          /* Clean Minimal Header during Wizard */
          <header className="h-16 bg-white/60 backdrop-blur-md border-b border-gray-200/80 px-6 sm:px-8 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-purple-600 animate-pulse" />
              <span className="text-sm font-bold text-gray-800 tracking-tight">Stream Broadcast Setup</span>
            </div>
            <span className="text-xs font-semibold text-gray-400">Complete setup steps to enter live studio</span>
          </header>
        )}

        {/* Main Stage Content */}
        <main className="flex-1 p-6 sm:p-8 flex flex-col gap-6">
          
          {/* Error Alert */}
          {error && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                <span>{error}</span>
              </div>
              <button onClick={() => setError(null)} className="text-xs font-bold text-red-500 hover:text-red-800">✕</button>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              PROGRESSIVE SETUP WIZARD (Royal Purple Aesthetics)
              ═══════════════════════════════════════════════════════════════ */}
          {!isWizardComplete ? (
            <div className="flex-1 flex flex-col items-center justify-center py-6 animate-in fade-in duration-300">
              <div className="w-full max-w-2xl bg-white border border-gray-200 rounded-3xl p-8 shadow-xl relative overflow-hidden">
                
                {/* Top Progress Tracker */}
                <div className="mb-8">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
                    <span>Step {wizardStep} of 5</span>
                    <span className="text-purple-600 font-extrabold">
                      {wizardStep === 1 && "Stream Identity"}
                      {wizardStep === 2 && "Privacy & Access"}
                      {wizardStep === 3 && "Failover Network Config"}
                      {wizardStep === 4 && "Recording Archival"}
                      {wizardStep === 5 && "Hardware & Preview"}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden flex">
                    <div 
                      className="bg-gradient-to-r from-purple-600 to-violet-500 h-full transition-all duration-500 rounded-full"
                      style={{ width: `${(wizardStep / 5) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Step 1: Stream Identity */}
                {wizardStep === 1 && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center mb-2 shadow-xs">
                        <Radio className="w-6 h-6" />
                      </div>
                      <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Name Your Live Stream</h2>
                      <p className="text-sm text-gray-500">
                        Give your broadcast a descriptive title so viewers know what you are streaming.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-gray-600">Stream Title</label>
                      <input
                        type="text"
                        value={streamName}
                        onChange={(e) => setStreamName(e.target.value)}
                        placeholder="e.g. Field Operation Alpha — Live Feed"
                        className="w-full px-4 py-3.5 rounded-2xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 text-base transition-all shadow-xs"
                        required
                      />
                    </div>
                  </div>
                )}

                {/* Step 2: Privacy & Access */}
                {wizardStep === 2 && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center mb-2 shadow-xs">
                        <Shield className="w-6 h-6" />
                      </div>
                      <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Stream Access & Privacy</h2>
                      <p className="text-sm text-gray-500">
                        Choose whether this stream is open to everyone or protected with credentials.
                      </p>
                    </div>

                    {/* Privacy Selector */}
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => setIsPublic(true)}
                        className={`p-5 rounded-2xl border text-left transition-all ${
                          isPublic
                            ? "border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20 shadow-xs"
                            : "border-gray-200 bg-gray-50/50 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Globe className={`w-5 h-5 ${isPublic ? "text-emerald-600" : "text-gray-400"}`} />
                          <span className="font-bold text-sm text-gray-900">Public Stream</span>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed">
                          Anyone with the viewer link can watch immediately without entering a password.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsPublic(false)}
                        className={`p-5 rounded-2xl border text-left transition-all ${
                          !isPublic
                            ? "border-purple-500 bg-purple-50/60 ring-2 ring-purple-500/20 shadow-xs"
                            : "border-gray-200 bg-gray-50/50 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Lock className={`w-5 h-5 ${!isPublic ? "text-purple-600" : "text-gray-400"}`} />
                          <span className="font-bold text-sm text-gray-900">Private Stream</span>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed">
                          Requires a Stream ID & Password to unlock and view the live broadcast.
                        </p>
                      </button>
                    </div>

                    {/* Credential Customizer (if private) */}
                    {!isPublic && (
                      <div className="p-5 rounded-2xl bg-gray-50 border border-gray-200 space-y-4 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-gray-600">Access Credentials</span>
                          <button
                            type="button"
                            onClick={generateRandomCredentials}
                            className="flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-700 font-semibold"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Randomize
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] font-semibold text-gray-600 block mb-1">Stream ID</label>
                            <input
                              type="text"
                              value={streamId}
                              onChange={(e) => setStreamId(e.target.value)}
                              placeholder="Enter ID or click randomize"
                              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-900 text-sm focus:outline-none focus:border-purple-500 shadow-xs"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-semibold text-gray-600 block mb-1">Password</label>
                            <div className="relative">
                              <input
                                type={showPassword ? "text" : "password"}
                                value={streamPassword}
                                onChange={(e) => setStreamPassword(e.target.value)}
                                placeholder="Enter password"
                                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-900 text-sm focus:outline-none focus:border-purple-500 pr-9 shadow-xs"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                              >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 3: Mandatory Failover Network Configuration */}
                {wizardStep === 3 && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center mb-2 shadow-xs">
                        <Sliders className="w-6 h-6" />
                      </div>
                      <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Network Failover Setup</h2>
                      <p className="text-sm text-gray-500">
                        Configure redundant primary and backup network routes. This is mandatory for seamless failover protection.
                      </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-gray-50 border border-gray-200 space-y-4">
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5 block">Failover Routing Mode</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setMode("interface")}
                            className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                              mode === "interface" ? "bg-purple-50 border-purple-300 text-purple-700 shadow-xs" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                            }`}
                          >
                            Interface Priority
                          </button>
                          <button
                            type="button"
                            onClick={() => setMode("gateway")}
                            className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                              mode === "gateway" ? "bg-purple-50 border-purple-300 text-purple-700 shadow-xs" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                            }`}
                          >
                            Gateway NextHop
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-bold uppercase tracking-wider text-gray-600 block mb-1">
                            Primary Connection (High Speed) <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={primaryNetwork}
                            onChange={(e) => setPrimaryNetwork(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-900 text-xs focus:outline-none focus:border-purple-500 shadow-xs"
                          >
                            <option value="">Select Primary Connection...</option>
                            {mode === "interface" ? (
                              adapters.map(a => <option key={a.Name} value={a.Name}>{a.Name} ({a.Status})</option>)
                            ) : (
                              gateways.map(g => <option key={g.NextHop} value={g.NextHop}>{g.NextHop} ({g.InterfaceAlias})</option>)
                            )}
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-bold uppercase tracking-wider text-gray-600 block mb-1">
                            Backup Connection (5G / 4G / Wi-Fi) <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={backupNetwork}
                            onChange={(e) => setBackupNetwork(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-900 text-xs focus:outline-none focus:border-purple-500 shadow-xs"
                          >
                            <option value="">Select Backup Connection...</option>
                            {mode === "interface" ? (
                              adapters.map(a => <option key={a.Name} value={a.Name}>{a.Name} ({a.Status})</option>)
                            ) : (
                              gateways.map(g => <option key={g.NextHop} value={g.NextHop}>{g.NextHop} ({g.InterfaceAlias})</option>)
                            )}
                          </select>
                        </div>
                      </div>

                      {/* Critical Warning if using identical adapter for testing */}
                      {primaryNetwork && backupNetwork && primaryNetwork === backupNetwork && (
                        <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900 animate-in fade-in duration-200">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <span className="font-bold text-amber-800 block">Single Adapter Test Mode (Critical Warning)</span>
                            <p className="text-amber-700 leading-relaxed">
                              Primary and Backup are set to the same target (<span className="font-mono font-bold">{primaryNetwork}</span>). Failover metrics will adjust on this adapter, but physical hardware redundancy is not active.
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl text-xs text-purple-900 leading-relaxed">
                        💡 <b>Autonomous failover:</b> When primary connection latency &gt; 150ms or packet loss &gt; 20%, the system will instantly reroute your live stream to the backup connection.
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 4: Recording Options */}
                {wizardStep === 4 && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center mb-2 shadow-xs">
                        <HardDrive className="w-6 h-6" />
                      </div>
                      <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Cloud & Local Archiving</h2>
                      <p className="text-sm text-gray-500">
                        Decide if this session should be recorded for on-demand playback and download.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => setRecordEnabled(true)}
                        className={`p-5 rounded-2xl border text-left transition-all ${
                          recordEnabled
                            ? "border-purple-500 bg-purple-50/60 ring-2 ring-purple-500/20 shadow-xs"
                            : "border-gray-200 bg-gray-50/50 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-purple-600 animate-pulse" />
                          <span className="font-bold text-sm text-gray-900">Enable Recording</span>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed">
                          Automatically captures live segments and stitches them into Supabase Cloud Storage upon ending stream.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setRecordEnabled(false)}
                        className={`p-5 rounded-2xl border text-left transition-all ${
                          !recordEnabled
                            ? "border-gray-400 bg-gray-100 ring-2 ring-gray-400/20 shadow-xs"
                            : "border-gray-200 bg-gray-50/50 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <HardDrive className="w-4 h-4 text-gray-500" />
                          <span className="font-bold text-sm text-gray-900">Disable Recording</span>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed">
                          Live broadcast only. No video clips or files will be saved to storage.
                        </p>
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 5: Hardware & Live Preview */}
                {wizardStep === 5 && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center mb-2 shadow-xs">
                        <Video className="w-6 h-6" />
                      </div>
                      <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Camera & Audio Preview</h2>
                      <p className="text-sm text-gray-500">
                        Configure your capture devices and test your live video feed before entering the studio.
                      </p>
                    </div>

                    {/* Video Preview Box */}
                    <div className="relative aspect-video bg-gray-900 rounded-2xl overflow-hidden border border-gray-200 shadow-inner flex items-center justify-center">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      {!stream && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/90 text-white">
                          <button
                            type="button"
                            onClick={() => startCamera()}
                            className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs transition-all shadow-lg flex items-center gap-2"
                          >
                            <Video className="w-4 h-4" />
                            Start Preview
                          </button>
                        </div>
                      )}
                      {stream && (
                        <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg text-xs font-semibold text-white border border-white/10 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          Preview Active ({resolution})
                        </div>
                      )}
                    </div>

                    {/* Device Selectors */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-gray-600 block mb-1">Camera</label>
                        <select
                          value={selectedCamera}
                          onChange={(e) => {
                            setSelectedCamera(e.target.value);
                            startCamera(e.target.value, selectedMic, resolution);
                          }}
                          className="w-full px-3 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-900 text-xs focus:outline-none focus:border-purple-500 shadow-xs"
                        >
                          {cameras.map(c => <option key={c.deviceId} value={c.deviceId}>{c.label || "Camera"}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-gray-600 block mb-1">Microphone</label>
                        <select
                          value={selectedMic}
                          onChange={(e) => {
                            setSelectedMic(e.target.value);
                            startCamera(selectedCamera, e.target.value, resolution);
                          }}
                          className="w-full px-3 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-900 text-xs focus:outline-none focus:border-purple-500 shadow-xs"
                        >
                          {mics.map(m => <option key={m.deviceId} value={m.deviceId}>{m.label || "Microphone"}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-gray-600 block mb-1">Resolution</label>
                        <select
                          value={resolution}
                          onChange={(e) => {
                            setResolution(e.target.value);
                            startCamera(selectedCamera, selectedMic, e.target.value);
                          }}
                          className="w-full px-3 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-900 text-xs focus:outline-none focus:border-purple-500 shadow-xs"
                        >
                          <option value="1080p">1080p (FHD)</option>
                          <option value="720p">720p (HD)</option>
                          <option value="480p">480p (SD)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Wizard Navigation Bar */}
                <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-between">
                  {wizardStep > 1 ? (
                    <button
                      type="button"
                      onClick={() => setWizardStep((wizardStep - 1) as any)}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-gray-600 hover:text-gray-900 text-xs font-semibold hover:bg-gray-100 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </button>
                  ) : <div />}

                  {wizardStep < 5 ? (
                    <button
                      type="button"
                      onClick={async () => {
                        if (wizardStep === 1 && !streamName.trim()) {
                          setError("Please specify a stream name.");
                          return;
                        }
                        if (wizardStep === 2 && !isPublic && (!streamId.trim() || !streamPassword.trim())) {
                          setError("Please enter or randomize a Stream ID and Password for the private stream.");
                          return;
                        }
                        if (wizardStep === 3) {
                          if (!primaryNetwork || !backupNetwork) {
                            setError("Failover configuration is mandatory. Please select both Primary and Backup network targets.");
                            return;
                          }
                          // Automatically save network failover configuration
                          await fetch("/api/settings", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ mode, primary: primaryNetwork, backup: backupNetwork })
                          });
                        }
                        setError(null);
                        setWizardStep((wizardStep + 1) as any);
                      }}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-md hover:shadow-lg"
                    >
                      Continue
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleFinishWizard}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white text-xs font-bold transition-all shadow-md hover:shadow-lg"
                    >
                      <Sparkles className="w-4 h-4" />
                      Enter Studio Dashboard
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (

          /* ═══════════════════════════════════════════════════════════════
              CLEAN BROADCAST DASHBOARD: FULL VISIBLE PLAYER + NETWORK & UNIQUE LOGS
              ═══════════════════════════════════════════════════════════════ */
            <div className="flex flex-col gap-6 w-full animate-in fade-in duration-300">
              
              {/* Top Row: Full-AspectRatio Video Monitor on the Left + Network Status on the Right */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full items-start">
                
                {/* 16:9 Video Monitor (2 cols) */}
                <div className="lg:col-span-2 relative aspect-video bg-black rounded-3xl overflow-hidden border border-gray-200 shadow-xl flex items-center justify-center group w-full">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  
                  {/* System Failure Overlay (Prominent Alert) */}
                  {isBroadcasting && (!systemHealth.allHealthy || isReconnecting) && (
                    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-red-950/85 backdrop-blur-md text-white p-6 text-center animate-in fade-in">
                      <AlertTriangle className="w-16 h-16 text-red-500 mb-4 animate-bounce" />
                      <h2 className="text-2xl font-black uppercase tracking-widest mb-2 text-red-100">Critical Infrastructure Warning</h2>
                      <div className="space-y-2 text-sm font-semibold max-w-lg text-red-200">
                        {isReconnecting && (
                           <div className="bg-amber-900/50 p-3 rounded-xl border border-amber-500/50 flex flex-col items-center justify-center gap-2 mb-2 shadow-lg animate-pulse">
                             <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
                             <span className="font-bold text-amber-200 text-base">Reconnecting to Server... Please wait.</span>
                           </div>
                        )}
                        {!systemHealth.services.mediamtx.online && (
                           <p className="bg-red-900/50 p-2 rounded-lg border border-red-500/30 text-left">❌ <b>MediaMTX Offline:</b> The streaming server dropped. Your live feed is currently disconnected from viewers!</p>
                        )}
                        {!systemHealth.services.worker.online && (
                           <p className="bg-red-900/50 p-2 rounded-lg border border-red-500/30 text-left">⚠️ <b>Upload Worker Offline:</b> The recording archiver stopped responding. Cloud saving may be interrupted.</p>
                        )}
                        {!systemHealth.services.monitor.online && (
                           <p className="bg-red-900/50 p-2 rounded-lg border border-red-500/30 text-left">⚠️ <b>Monitor Offline:</b> The failover agent lost heartbeat. Autonomous failover is temporarily disabled.</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Overlaid Studio HUD */}
                  <div className="absolute top-4 left-4 flex items-center gap-2">
                    <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-md flex items-center gap-1.5 shadow-md border ${
                      isBroadcasting 
                        ? "bg-red-600/90 border-red-400/30 text-white animate-pulse"
                        : "bg-black/60 border-white/10 text-gray-200"
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${isBroadcasting ? "bg-white" : "bg-gray-400"}`} />
                      {isBroadcasting ? "ON AIR" : "STUDIO PREVIEW"}
                    </div>
                    <div className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[11px] font-semibold text-gray-200">
                      {resolution} • 30 FPS
                    </div>
                  </div>

                  {/* Quick Control Bar Overlay */}
                  <div className="absolute bottom-4 inset-x-4 flex items-center justify-between bg-black/60 backdrop-blur-md border border-white/15 px-4 py-2 rounded-2xl opacity-90 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={toggleVideoMute}
                        className={`p-2 rounded-xl text-xs font-semibold transition-all ${
                          isVideoMuted ? "bg-purple-600 text-white" : "bg-white/20 hover:bg-white/30 text-white"
                        }`}
                        title={isVideoMuted ? "Turn Camera On" : "Mute Camera"}
                      >
                        {isVideoMuted ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={toggleMute}
                        className={`p-2 rounded-xl text-xs font-semibold transition-all ${
                          isMuted ? "bg-purple-600 text-white" : "bg-white/20 hover:bg-white/30 text-white"
                        }`}
                        title={isMuted ? "Unmute Mic" : "Mute Mic"}
                      >
                        {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startCamera()}
                        className="p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition-all"
                        title="Reload Camera"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Side: Network Status & Failover Log Stacked for Maximum Visibility */}
                <div className="w-full flex flex-col gap-6">
                  <NetworkStatus />
                  <FailoverLog sessionStartTime={sessionCreatedTime} />
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── Privacy Change Warning & Credential Definition Modals ── */}
      {privacyWarningModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-gray-200 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-5 animate-in zoom-in-95 duration-200">
            
            {/* Warning: Making Private stream PUBLIC */}
            {privacyWarningModal.target === "public" ? (
              <>
                <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shadow-xs">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">Make Stream Public?</h3>
                    <p className="text-xs text-gray-500">Anyone with the viewer link will be able to watch.</p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs text-amber-800 leading-relaxed space-y-2">
                  <p>
                    <b>Warning:</b> By switching this broadcast to Public, all access password locks will be removed immediately.
                  </p>
                  <p>
                    Any viewer on the viewer page will instantly see the live video feed without needing credentials.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setPrivacyWarningModal({ target: "public", isOpen: false })}
                    className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmMakePublic}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md"
                  >
                    Yes, Make Public
                  </button>
                </div>
              </>
            ) : (
              /* Configuration & Confirmation: Making Public stream PRIVATE */
              <>
                <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
                  <div className="w-10 h-10 rounded-2xl bg-purple-50 border border-purple-200 text-purple-600 flex items-center justify-center shadow-xs">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">Protect Stream with Password</h3>
                    <p className="text-xs text-gray-500">Define Stream ID & Password before switching</p>
                  </div>
                </div>

                <div className="space-y-3.5 text-xs">
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Stream ID</label>
                    <input
                      type="text"
                      value={pendingPrivateId}
                      onChange={(e) => setPendingPrivateId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-sm focus:outline-none focus:border-purple-500 shadow-xs"
                      placeholder="e.g. 849201"
                      required
                    />
                  </div>

                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Access Password</label>
                    <input
                      type="text"
                      value={pendingPrivatePassword}
                      onChange={(e) => setPendingPrivatePassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-sm focus:outline-none focus:border-purple-500 shadow-xs"
                      placeholder="••••••••"
                      required
                    />
                  </div>

                  <p className="text-[11px] text-gray-400 leading-relaxed pt-1">
                    Once switched to Private, all public viewers who don't have these credentials will be locked out immediately.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setPrivacyWarningModal({ target: "private", isOpen: false })}
                    className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmMakePrivate}
                    disabled={!pendingPrivateId || !pendingPrivatePassword}
                    className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-md disabled:opacity-50"
                  >
                    Apply & Make Private
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Failover Configuration Modal ── */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center shadow-xs">
                  <Network className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-gray-900 text-base">Network Failover Settings</h3>
              </div>
              <button
                onClick={() => setIsConfigModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {configMsg && (
              <div className={`p-3 rounded-xl text-xs font-semibold ${
                configMsg.includes("Error") ? "bg-red-50 border border-red-200 text-red-700" : "bg-emerald-50 border border-emerald-200 text-emerald-700"
              }`}>
                {configMsg}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-600 mb-1 block">Failover Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMode("interface")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      mode === "interface" ? "bg-purple-50 border-purple-300 text-purple-700 shadow-xs" : "bg-gray-50 border-gray-200 text-gray-500"
                    }`}
                  >
                    Interface Priority
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("gateway")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      mode === "gateway" ? "bg-purple-50 border-purple-300 text-purple-700 shadow-xs" : "bg-gray-50 border-gray-200 text-gray-500"
                    }`}
                  >
                    Gateway NextHop
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-600 mb-1 block">Primary Target</label>
                <select
                  value={primaryNetwork}
                  onChange={(e) => setPrimaryNetwork(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-xs focus:outline-none focus:border-purple-500 shadow-xs"
                >
                  <option value="">Select Primary...</option>
                  {mode === "interface" ? (
                    adapters.map(a => <option key={a.Name} value={a.Name}>{a.Name} ({a.Status})</option>)
                  ) : (
                    gateways.map(g => <option key={g.NextHop} value={g.NextHop}>{g.NextHop} ({g.InterfaceAlias})</option>)
                  )}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-600 mb-1 block">Backup Target (5G / 4G)</label>
                <select
                  value={backupNetwork}
                  onChange={(e) => setBackupNetwork(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-xs focus:outline-none focus:border-purple-500 shadow-xs"
                >
                  <option value="">Select Backup...</option>
                  {mode === "interface" ? (
                    adapters.map(a => <option key={a.Name} value={a.Name}>{a.Name} ({a.Status})</option>)
                  ) : (
                    gateways.map(g => <option key={g.NextHop} value={g.NextHop}>{g.NextHop} ({g.InterfaceAlias})</option>)
                  )}
                </select>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsConfigModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveNetworkConfig}
                disabled={configSaving}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2"
              >
                {configSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                {configSaving ? "Saving..." : "Apply Failover Settings"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete / Discard Stream Confirmation Modal ── */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-gray-200 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
              <div className="w-10 h-10 rounded-2xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center shadow-xs">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">Delete Live Stream?</h3>
                <p className="text-xs text-gray-500">This will terminate the stream and clear credentials.</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-red-50/70 border border-red-200 text-xs text-red-800 leading-relaxed space-y-2">
              <p>
                <b>Warning:</b> Deleting this stream will immediately end the broadcast feed, reset stream settings, and return to the step-by-step setup wizard.
              </p>
              <p>
                Viewers will no longer be able to watch or access this stream.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteStream}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-md active:scale-95"
              >
                Yes, Delete Stream
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
