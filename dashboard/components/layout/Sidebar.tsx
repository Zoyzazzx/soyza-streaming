"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Home, MonitorPlay, Radio, Settings, LogOut, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>("streamer");

  useEffect(() => {
    async function getUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUserEmail(session.user.email || null);
        setUserRole(session.user.user_metadata?.role || "streamer");
      }
    }
    getUser();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const navItems = [
    { name: "Home", href: "/", icon: Home },
    { name: "View Stream", href: "/viewer", icon: MonitorPlay },
    { name: "Start Stream", href: "/broadcast", icon: Radio },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <aside className="w-64 bg-white text-gray-900 flex flex-col h-screen fixed top-0 left-0 border-r border-gray-200 z-50">
      {/* Brand */}
      <div className="flex items-center gap-3 px-6 py-8 border-b border-gray-100">
        <div className="w-10 h-10 bg-white rounded-md p-1 shadow-md border border-gray-100">
          <img src="/logo.jpg" alt="Z-Live Logo" className="w-full h-full object-contain rounded-sm" />
        </div>
        <div>
          <span className="font-bold text-xl tracking-tight block">Z-Live</span>
          <span className="text-gray-500 text-xs">Studio</span>
        </div>
      </div>

      {/* Nav Links */}
      <div className="flex-1 px-4 py-8 space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                isActive
                  ? "bg-indigo-50 text-indigo-700 shadow-sm shadow-indigo-100 font-semibold"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm">{item.name}</span>
            </Link>
          );
        })}
      </div>

      {/* User & Logout */}
      <div className="p-4 border-t border-gray-100 space-y-4">
        {userEmail && (
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <div className="flex-1 truncate">
              <span className="block truncate">{userEmail}</span>
            </div>
            <span className="px-1.5 py-0.5 rounded text-[9px] uppercase font-bold bg-indigo-100 text-indigo-700">
              {userRole}
            </span>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-transparent hover:border-red-200"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
