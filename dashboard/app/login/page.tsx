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
  const [showSignupMessage, setShowSignupMessage] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    setShowSignupMessage(false);
    
    const cleanEmail = email.trim();
    
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          password,
          activeTab,
        }),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || "Login failed. Please check your credentials.");
      }

      setIsSuccess(true);
      setTimeout(() => {
        window.location.href = result.redirectUrl || "/";
      }, 500);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-[#111111] text-white font-sans selection:bg-blue-500/30">
      {/* Left Panel */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-[#0a0a0a]">
        <InteractiveNeuralVortex colorTheme={activeTab === "streamer" ? "red" : "blue"}>
          <div className="absolute inset-0 flex flex-col justify-center items-center z-10">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white rounded-lg p-1.5 shadow-xl">
                <img 
                  src="/logo.jpg" 
                  alt="Z-Live Logo" 
                  className="w-full h-full object-contain rounded-md"
                />
              </div>
              <span className="text-6xl font-bold tracking-tight text-white drop-shadow-lg">Z-Live</span>
            </div>
          </div>
        </InteractiveNeuralVortex>
      </div>

      {/* Right Panel */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center bg-[#18181b] relative z-10">
        <div className="w-full max-w-[360px] px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-semibold text-white mb-2">Sign in</h2>
            <p className="text-sm text-gray-400">Welcome back! Please sign in to continue.</p>
          </div>
          
          {/* Tab Switcher - Simple and less curved */}
          <div className="flex gap-6 mb-8 border-b border-gray-800 pb-[1px]">
            <button 
              type="button" 
              onClick={() => { setActiveTab('streamer'); setError(null); }} 
              className={`text-sm font-medium pb-2 border-b-2 transition-colors ${
                activeTab === 'streamer' 
                  ? 'border-blue-500 text-white' 
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              Streamer
            </button>
            <button 
              type="button" 
              onClick={() => { setActiveTab('viewer'); setError(null); }} 
              className={`text-sm font-medium pb-2 border-b-2 transition-colors ${
                activeTab === 'viewer' 
                  ? 'border-blue-500 text-white' 
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              Viewer
            </button>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-md text-sm bg-red-950/40 text-red-400 border border-red-900/50">
              {error}
            </div>
          )}
          
          {showSignupMessage && (
            <div className="mb-5 p-3 rounded-md text-sm bg-blue-950/40 text-blue-400 border border-blue-900/50">
              Contact admin for account creation.
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-gray-300">Email address</label>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                placeholder={activeTab === "streamer" ? "admin@zlive.tv" : "viewer@zlive.tv"}
                className="w-full px-3 py-2.5 bg-[#27272a] border border-[#3f3f46] rounded-md text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-sm"
                required 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-gray-300">Password</label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2.5 bg-[#27272a] border border-[#3f3f46] rounded-md text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-sm"
                required 
              />
            </div>

            <div className="pt-2">
              <button 
                type="submit"
                disabled={loading || isSuccess}
                className="w-full py-2.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center"
              >
                {isSuccess ? 'Authenticating...' : loading ? 'Signing in...' : 'Continue'}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-400">
              Don't have an account?{' '}
              <button 
                type="button" 
                onClick={() => setShowSignupMessage(true)} 
                className="text-white font-medium hover:underline focus:outline-none"
              >
                Sign up
              </button>
            </p>
          </div>
          
          <div className="mt-12 text-center text-xs text-gray-600 flex justify-center space-x-3">
            <span>© Z-Live</span>
            <span>·</span>
            <span className="hover:text-gray-400 cursor-pointer">Privacy</span>
            <span>·</span>
            <span className="hover:text-gray-400 cursor-pointer">Terms</span>
          </div>
        </div>
      </div>
    </div>
  );
}
