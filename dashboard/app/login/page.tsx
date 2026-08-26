"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleAuth = async (isSignUp: boolean) => {
    setLoading(true);
    setError(null);
    
    const cleanEmail = email.trim();
    
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
        });
        if (error) throw error;
        // On success, redirect to dashboard or show success message
        router.push("/");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (error) throw error;
        // On success, redirect to dashboard
        router.push("/");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080b14] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/5 border border-white/10 p-8 rounded-2xl backdrop-blur-xl space-y-6">
        <div className="flex flex-col items-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Soyza Stream</h1>
          <p className="text-sm text-white/50">Secure System Access</p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/70">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-black/40 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              placeholder="admin@soyza.tv"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/70">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-black/40 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              placeholder="••••••••"
              required
            />
          </div>
          
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => handleAuth(false)}
              disabled={loading}
              className="flex-1 py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-medium text-sm transition-colors disabled:opacity-50"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => handleAuth(true)}
              disabled={loading}
              className="flex-1 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-white font-medium text-sm transition-colors disabled:opacity-50"
            >
              Register
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
