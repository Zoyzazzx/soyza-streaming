"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MonitorPlay, Radio, Settings, LogOut, ShieldCheck, User } from "lucide-react";

export default function HubPage() {
  const router = useRouter();
  const supabase = createClient();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>("streamer");
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      
      const role = session.user.user_metadata?.role || "streamer";
      setUserEmail(session.user.email || null);
      setUserRole(role);

      if (role === "viewer") {
        router.push("/viewer");
        return;
      }
      setCheckingAuth(false);
    }
    checkUser();
  }, [router, supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* ── Navigation ── */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <img 
              src="/logo.png" 
              alt="ZoyzaXR Logo" 
              className="w-10 h-10 rounded-xl shadow-md object-cover border border-purple-100" 
            />
            <div>
              <span className="font-bold text-gray-900 text-lg tracking-tight block">ZoyzaXR</span>
              <span className="text-gray-500 text-xs">Home</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {userEmail && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-lg text-xs font-semibold text-indigo-700">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{userEmail}</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-indigo-200 text-indigo-800">
                  {userRole}
                </span>
              </div>
            )}
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
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-12 flex flex-col items-center justify-center">
        
        <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Welcome to ZoyzaXR</h1>
          <p className="text-gray-500 mt-3 text-lg max-w-2xl mx-auto">
            Select an action to continue. Your hybrid network streaming environment is ready.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
          {/* Card 1: View Stream */}
          <Link href="/viewer" className="group relative bg-white border border-gray-200 rounded-3xl p-8 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all duration-300 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 shadow-sm">
              <MonitorPlay className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">View Stream</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              Watch the live broadcast, check stream status, and browse past recordings.
            </p>
          </Link>

          {/* Card 2: Start Stream */}
          <Link href="/broadcast" className="group relative bg-white border border-gray-200 rounded-3xl p-8 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all duration-300 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 shadow-sm">
              <Radio className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Start Stream</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              Launch the Broadcast Studio, manage network failover, and start streaming.
            </p>
          </Link>

          {/* Card 3: Settings */}
          <Link href="/settings" className="group relative bg-white border border-gray-200 rounded-3xl p-8 shadow-sm hover:shadow-xl hover:border-gray-300 transition-all duration-300 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-500 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-50 text-gray-600 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-gray-800 group-hover:text-white transition-all duration-300 shadow-sm">
              <Settings className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Settings & Accounts</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              Manage streamer & viewer accounts, network settings, and preferences.
            </p>
          </Link>
        </div>

        {/* Footer */}
        <div className="mt-16 text-center text-xs text-gray-400 animate-in fade-in duration-1000 delay-700">
          ZoyzaXR Project — E299625 | Kingston University London
        </div>
      </main>
    </div>
  );
}
