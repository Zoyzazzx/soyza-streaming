import Link from "next/link";
import RecordingsList from "@/components/RecordingsList";
import type { Metadata } from "next";
import { Home } from "lucide-react";

export const metadata: Metadata = {
  title: "Recordings — ZoyzaXR",
  description: "Browse and play all cloud-uploaded stream recordings.",
};

export default function RecordingsPage() {
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
              <span className="text-gray-500 text-xs">Recordings</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Link href="/" className="px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
              Dashboard
            </Link>
            <Link href="/recordings" className="px-3 py-1.5 text-sm font-medium text-indigo-700 bg-indigo-50 rounded-lg">
              Recordings
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Main content ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="space-y-1 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Stream Recordings</h1>
          <p className="text-gray-500">
            Auto-uploaded 30-second segments from Supabase Storage. Updates in real-time.
          </p>
        </div>
        
        <RecordingsList />
      </main>
    </div>
  );
}
