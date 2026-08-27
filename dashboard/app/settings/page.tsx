"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogOut, Home, Settings as SettingsIcon } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* ── Navigation ── */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 transition-colors shadow-md group">
              <Home className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
            </Link>
            <div>
              <span className="font-bold text-gray-900 text-lg tracking-tight block">ZoyzaXR</span>
              <span className="text-gray-500 text-xs">Settings</span>
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
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col">
        <div className="bg-white border border-gray-200 rounded-3xl shadow-xl overflow-hidden flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 duration-500">
          <div className="w-20 h-20 rounded-3xl bg-gray-50 text-gray-400 flex items-center justify-center mb-6 shadow-inner border border-gray-100">
            <SettingsIcon className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">Settings Module Offline</h2>
          <p className="text-gray-500 max-w-md">
            This section is currently disabled. Future updates will allow configuring global system preferences, account management, and advanced features here.
          </p>
        </div>
        
        {/* Footer */}
        <div className="mt-8 text-center text-xs text-gray-400">
          ZoyzaXR Project — E299625 | Kingston University London
        </div>
      </main>
    </div>
  );
}
