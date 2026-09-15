"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MonitorPlay, Radio, Settings, LogOut, ShieldCheck, User } from "lucide-react";
import HoverRevealCards, { CardItem } from "@/components/ui/cards";
import DashboardLayout from "@/components/layout/DashboardLayout";

const homeCards: CardItem[] = [
  {
    id: 1,
    title: 'View Stream',
    subtitle: 'Watch & Browse',
    imageUrl: '/card_view_stream.jpg',
    href: '/viewer',
  },
  {
    id: 2,
    title: 'Start Stream',
    subtitle: 'Broadcast Studio',
    imageUrl: '/card_start_stream.jpg',
    href: '/broadcast',
  },
  {
    id: 3,
    title: 'Settings & Accounts',
    subtitle: 'Manage Network',
    imageUrl: '/card_settings.jpg',
    href: '/settings',
  }
];

export default function HubPage() {
  const router = useRouter();
  const supabase = createClient();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      
      const role = session.user.user_metadata?.role || "streamer";

      if (role === "viewer") {
        router.push("/viewer");
        return;
      }
      setCheckingAuth(false);
    }
    checkUser();
  }, [router, supabase]);

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-12 flex flex-col items-center justify-center">
        
        <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Welcome to Z-Live</h1>
          <p className="text-gray-500 mt-3 text-lg max-w-2xl mx-auto">
            Select an action to continue. Your hybrid network streaming environment is ready.
          </p>
        </div>

        <div className="w-full max-w-5xl animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
          <HoverRevealCards items={homeCards} />
        </div>

        {/* Footer */}
        <div className="mt-16 text-center text-xs text-gray-500 animate-in fade-in duration-1000 delay-700">
          Z-Live Project — E299625 | Kingston University London
        </div>
      </div>
    </DashboardLayout>
  );
}
