"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import InteractiveNeuralVortex from "@/components/ui/interactive-neural-vortex-background";
import { Fingerprint, LogIn, Mail, Lock } from "lucide-react";

export default function LoginPage() {
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
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (error) throw error;
      
      // Trigger vanish animation
      setIsSuccess(true);
      setTimeout(() => {
        router.push("/");
      }, 800);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <InteractiveNeuralVortex>
      <div className={`w-full max-w-md bg-white/70 border border-white/40 p-8 rounded-3xl shadow-2xl backdrop-blur-xl space-y-8 transition-all duration-700 ease-in-out ${isSuccess ? 'opacity-0 scale-90 translate-y-4' : 'opacity-100 scale-100 animate-in fade-in zoom-in duration-500'}`}>
        <div className="flex flex-col items-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg">
            <Fingerprint className="w-7 h-7 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">ZoyzaXR</h1>
            <p className="text-sm text-gray-500 mt-1">Secure System Access</p>
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 ml-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/60 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm"
                placeholder="admin@zoyzair.tv"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/60 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm"
                placeholder="••••••••"
                required
              />
            </div>
          </div>
          
          <div className="pt-4">
            <button
              type="submit"
              disabled={loading || isSuccess}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-semibold text-sm transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <LogIn className={`w-4 h-4 ${isSuccess ? 'animate-bounce' : ''}`} />
              {isSuccess ? 'Authenticating...' : 'Sign In'}
            </button>
          </div>
        </form>
      </div>
    </InteractiveNeuralVortex>
  );
}
