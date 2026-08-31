"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import InteractiveNeuralVortex from "@/components/ui/interactive-neural-vortex-background";
import { Fingerprint, LogIn, Mail, Lock, Radio, Tv } from "lucide-react";

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState<"streamer" | "viewer">("streamer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    
    const cleanEmail = email.trim();
    
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (signInError) throw signInError;
      
      const userRole = data.user?.user_metadata?.role || "streamer";

      if (activeTab === "streamer" && userRole === "viewer") {
        await supabase.auth.signOut();
        throw new Error("Access Denied: This account only has Viewer privileges. Please use the Viewer Login tab.");
      }

      // Trigger vanish animation
      setIsSuccess(true);
      setTimeout(() => {
        if (activeTab === "viewer" || userRole === "viewer") {
          router.push("/viewer");
        } else {
          router.push("/");
        }
      }, 800);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <InteractiveNeuralVortex colorTheme={activeTab === "streamer" ? "red" : "blue"}>
      <div className={`w-full max-w-md bg-white/70 border border-white/40 p-8 rounded-3xl shadow-2xl backdrop-blur-xl space-y-6 transition-all duration-700 ease-in-out ${isSuccess ? 'opacity-0 scale-90 translate-y-4' : 'opacity-100 scale-100 animate-in fade-in zoom-in duration-500'}`}>
        <div className="flex flex-col items-center space-y-3">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-500 ${
            activeTab === "streamer"
              ? "bg-gradient-to-br from-violet-600 to-purple-600 shadow-purple-500/20"
              : "bg-gradient-to-br from-indigo-500 to-blue-600 shadow-blue-500/20"
          }`}>
            <Fingerprint className="w-7 h-7 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">ZoyzaXR</h1>
            <p className="text-sm text-gray-500 mt-1">
              {activeTab === "streamer" ? "Streamer Studio Access" : "Viewer Portal Access"}
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-1.5 bg-gray-200/60 rounded-2xl backdrop-blur-sm border border-white/50">
          <button
            type="button"
            onClick={() => { setActiveTab("streamer"); setError(null); }}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-xs tracking-wide transition-all duration-300 ${
              activeTab === "streamer"
                ? "bg-white text-purple-700 shadow-md font-bold"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            Streamer Login
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("viewer"); setError(null); }}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-xs tracking-wide transition-all duration-300 ${
              activeTab === "viewer"
                ? "bg-white text-blue-600 shadow-md font-bold"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            Viewer Login
          </button>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-600 ml-1">
              {activeTab === "streamer" ? "Streamer Email" : "Viewer Email"}
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full pl-10 pr-4 py-3 rounded-xl bg-white/60 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none transition-all shadow-sm text-sm ${
                  activeTab === "streamer"
                    ? "focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                    : "focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                }`}
                placeholder={activeTab === "streamer" ? "admin@zoyzair.tv" : "viewer@zoyzair.tv"}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-600 ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full pl-10 pr-4 py-3 rounded-xl bg-white/60 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none transition-all shadow-sm text-sm ${
                  activeTab === "streamer"
                    ? "focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                    : "focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                }`}
                placeholder="••••••••"
                required
              />
            </div>
          </div>
          
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || isSuccess}
              className={`w-full py-3.5 rounded-xl text-white font-semibold text-sm transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 ${
                activeTab === "streamer"
                  ? "bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 shadow-red-500/20"
                  : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/20"
              }`}
            >
              <LogIn className={`w-4 h-4 ${isSuccess ? 'animate-bounce' : ''}`} />
              {isSuccess ? 'Authenticating...' : `Sign in as ${activeTab === 'streamer' ? 'Streamer' : 'Viewer'}`}
            </button>
          </div>
        </form>
      </div>
    </InteractiveNeuralVortex>
  );
}
