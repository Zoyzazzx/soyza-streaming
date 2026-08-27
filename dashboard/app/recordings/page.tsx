import Link from "next/link";
import RecordingsList from "@/components/RecordingsList";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Recordings — ZoyzaXR",
  description: "Browse and play all cloud-uploaded stream recordings.",
};

export default function RecordingsPage() {
  return (
    <div className="min-h-screen bg-[#080b14]">
      {/* Nav */}
      <nav className="border-b border-white/8 bg-[#080b14]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <span className="font-semibold text-white text-sm">ZoyzaXR</span>
          </div>
          <div className="flex items-center gap-1">
            <Link href="/" className="px-3 py-1.5 text-xs font-medium text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
              Dashboard
            </Link>
            <Link href="/recordings" className="px-3 py-1.5 text-xs font-medium text-white bg-white/10 rounded-lg">
              Recordings
            </Link>
          </div>
        </div>
      </nav>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-white">Recordings</h1>
          <p className="text-sm text-white/40">
            Auto-uploaded 30-second segments from Supabase Storage. Updates in real-time.
          </p>
        </div>
        <RecordingsList />
      </main>
    </div>
  );
}
