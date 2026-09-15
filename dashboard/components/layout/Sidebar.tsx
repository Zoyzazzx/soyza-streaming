"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Home, MonitorPlay, Radio, Settings, LogOut, ShieldCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

export default function Sidebar({ isOpen = true, setIsOpen }: { isOpen?: boolean, setIsOpen?: (val: boolean) => void }) {
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
    <aside className={`bg-white text-gray-900 flex flex-col h-screen fixed top-0 left-0 border-r border-gray-200 z-50 transition-all duration-300 ${isOpen ? "w-64" : "w-20"}`}>
      {/* Brand */}
      <div className={`flex items-center ${isOpen ? "gap-3 px-6" : "justify-center px-2"} py-8 border-b border-gray-100 relative`}>
        <div className="w-10 h-10 bg-white rounded-md p-1 shadow-md border border-gray-100 flex-shrink-0">
          <img src="/logo.jpg" alt="Z-Live Logo" className="w-full h-full object-contain rounded-sm" />
        </div>
        {isOpen && (
          <div className="flex-1 min-w-0">
            <span className="font-bold text-xl tracking-tight block truncate">Z-Live</span>
            <span className="text-gray-500 text-xs block truncate">Studio</span>
          </div>
        )}
        
        {/* Toggle Button */}
        {setIsOpen && (
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className={`absolute ${isOpen ? "right-4" : "-right-3.5 bg-white border border-gray-200"} top-10 rounded-full p-1 text-gray-400 hover:text-purple-600 shadow-sm z-50 transition-colors`}
            title={isOpen ? "Collapse Sidebar" : "Expand Sidebar"}
          >
            {isOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Nav Links */}
      <div className="flex-1 px-4 py-8 space-y-2">
        {navItems.map((item) => {
          if (userRole === "viewer" && (item.name === "Start Stream" || item.name === "Settings" || item.name === "Home")) {
            // Viewers only need View Stream, maybe Home if we want, but let's hide restricted pages
            if (item.name === "Start Stream" || item.name === "Settings") return null;
          }
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 py-3 rounded-xl transition-all ${
                isOpen ? "px-4" : "justify-center"
              } ${
                isActive
                  ? "bg-purple-50 text-purple-700 shadow-sm shadow-purple-100 font-semibold"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
              }`}
              title={!isOpen ? item.name : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {isOpen && <span className="text-sm truncate">{item.name}</span>}
            </Link>
          );
        })}
      </div>

      {/* User & Logout */}
      <div className="p-4 border-t border-gray-100 space-y-4">
        {userEmail && (
          <div className={`flex items-center ${isOpen ? "gap-2 px-3 py-2" : "justify-center p-2"} bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700`}>
            <ShieldCheck className="w-4 h-4 text-purple-600 flex-shrink-0" />
            {isOpen && (
              <>
                <div className="flex-1 truncate">
                  <span className="block truncate">{userEmail}</span>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[9px] uppercase font-bold bg-purple-100 text-purple-700 flex-shrink-0">
                  {userRole}
                </span>
              </>
            )}
          </div>
        )}
        <button
          onClick={handleLogout}
          title={!isOpen ? "Logout" : undefined}
          className={`flex items-center justify-center gap-2 w-full py-2.5 text-sm font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-transparent hover:border-red-200 ${
            isOpen ? "px-4" : "px-0"
          }`}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {isOpen && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
