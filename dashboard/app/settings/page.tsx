"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  LogOut,
  Home,
  Settings as SettingsIcon,
  Users,
  UserPlus,
  Trash2,
  Radio,
  Tv,
  CheckCircle2,
  AlertCircle,
  Shield,
  KeyRound,
  RefreshCw,
  Globe,
  Laptop,
  Server,
  Save,
  ExternalLink
} from "lucide-react";

interface UserItem {
  id: string;
  email: string;
  role: "streamer" | "viewer";
  created_at: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  
  // Modal & Form State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"viewer" | "streamer">("viewer");
  const [createLoading, setCreateLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Stream Routing (Local vs Tunneled) State
  const [routingMode, setRoutingMode] = useState<"local" | "tunneled">("local");
  const [tunnelUrl, setTunnelUrl] = useState<string>("");
  const [routingSaving, setRoutingSaving] = useState<boolean>(false);
  const [loadingRouting, setLoadingRouting] = useState<boolean>(true);

  // Check auth & role
  useEffect(() => {
    async function checkRole() {
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
      setLoadingAuth(false);
    }
    checkRole();
  }, [router, supabase]);

  // Fetch users list
  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (data.success) {
        setUsers(data.users || []);
      } else {
        setStatusMsg({ type: "error", text: data.error || "Failed to load users" });
      }
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message });
    } finally {
      setLoadingUsers(false);
    }
  };

  // Fetch stream routing config
  const fetchRouting = async () => {
    setLoadingRouting(true);
    try {
      const res = await fetch("/api/stream-routing");
      const data = await res.json();
      if (data.routingMode) {
        setRoutingMode(data.routingMode);
      }
      if (data.tunnelUrl !== undefined) {
        setTunnelUrl(data.tunnelUrl || "");
      }
    } catch (err: any) {
      console.warn("Error fetching stream routing:", err);
    } finally {
      setLoadingRouting(false);
    }
  };

  const handleSaveRouting = async () => {
    setRoutingSaving(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/stream-routing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routingMode,
          tunnelUrl,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({
          type: "success",
          text: `Stream route updated to ${routingMode === "tunneled" ? "Cloudflare Tunnel" : "Local Direct"} successfully!`,
        });
      } else {
        setStatusMsg({ type: "error", text: data.error || "Failed to update routing" });
      }
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message });
    } finally {
      setRoutingSaving(false);
    }
  };

  useEffect(() => {
    if (!loadingAuth) {
      fetchUsers();
      fetchRouting();
    }
  }, [loadingAuth]);



  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setStatusMsg(null);

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail,
          password: newPassword,
          role: newRole,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setStatusMsg({ type: "success", text: `Successfully created ${newRole} account for ${newEmail}!` });
        setNewEmail("");
        setNewPassword("");
        setIsCreateOpen(false);
        fetchUsers();
      } else {
        setStatusMsg({ type: "error", text: data.error || "Failed to create account" });
      }
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message });
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeleteUser = async (id: string, email: string) => {
    if (!confirm(`Are you sure you want to delete account ${email}?`)) return;

    try {
      const res = await fetch(`/api/users?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ type: "success", text: `Account ${email} deleted.` });
        setUsers(users.filter(u => u.id !== id));
      } else {
        setStatusMsg({ type: "error", text: data.error || "Failed to delete account" });
      }
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message });
    }
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
        
        {/* Status Notification Banner */}
        {statusMsg && (
          <div className={`p-4 rounded-2xl border flex items-center justify-between ${
            statusMsg.type === "success" 
              ? "bg-purple-50 border-purple-200 text-purple-800" 
              : "bg-red-50 border-red-200 text-red-800"
          }`}>
            <div className="flex items-center gap-3">
              {statusMsg.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 text-purple-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              )}
              <span className="text-sm font-medium">{statusMsg.text}</span>
            </div>
            <button 
              onClick={() => setStatusMsg(null)} 
              className="text-xs opacity-70 hover:opacity-100 font-bold ml-4"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* User Account Management Section */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">User Account Management</h2>
                <p className="text-xs text-gray-500">
                  Create and manage separate login accounts for Streamers and Viewers
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchUsers}
                className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-all"
                title="Refresh users"
              >
                <RefreshCw className={`w-4 h-4 ${loadingUsers ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setIsCreateOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs transition-all"
              >
                <UserPlus className="w-4 h-4" />
                Create New Login
              </button>
            </div>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto">
            {loadingUsers ? (
              <div className="py-12 flex justify-center items-center">
                <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-purple-600"></div>
              </div>
            ) : users.length === 0 ? (
              <div className="py-12 text-center text-gray-500 text-sm">
                No users found. Click &quot;Create New Login&quot; to add one.
              </div>
            ) : (
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50/80 text-gray-500 uppercase text-[11px] font-bold border-b border-gray-100">
                  <tr>
                    <th className="py-3.5 px-6">Email / Username</th>
                    <th className="py-3.5 px-6">Role / Portal</th>
                    <th className="py-3.5 px-6">Created On</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-4 px-6 font-medium text-gray-900">
                        {user.email}
                      </td>
                      <td className="py-4 px-6">
                        {user.role === "streamer" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                            <Radio className="w-3 h-3 text-purple-600" />
                            Streamer (Full Access)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                            <Tv className="w-3 h-3 text-purple-600" />
                            Viewer Only
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-xs text-gray-500">
                        {new Date(user.created_at).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => handleDeleteUser(user.id, user.email)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                          title="Delete User"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── Stream Routing & Remote Access Configuration (Local vs Tunneled) ── */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden animate-in fade-in duration-300">
          <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Stream Source Routing</h2>
                <p className="text-xs text-gray-500">
                  Switch video traffic between direct local loopback and Cloudflare Tunnel for Netlify viewers
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1.5 ${
                routingMode === "tunneled"
                  ? "bg-purple-50 border-purple-200 text-purple-800"
                  : "bg-purple-50 border-purple-200 text-purple-800"
              }`}>
                <span className={`w-2 h-2 rounded-full ${routingMode === "tunneled" ? "bg-purple-500 animate-pulse" : "bg-purple-500"}`} />
                {routingMode === "tunneled" ? "Cloudflare Tunneled Route" : "Local Direct Route"}
              </span>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Mode selection cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Option 1: Local Direct */}
              <button
                type="button"
                onClick={() => setRoutingMode("local")}
                className={`p-5 rounded-xl border text-left transition-all ${
                  routingMode === "local"
                    ? "border-purple-500 bg-purple-50/50 ring-2 ring-purple-500/20"
                    : "border-gray-200 bg-gray-50/50 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    routingMode === "local" ? "bg-purple-100 text-purple-700" : "bg-gray-200 text-gray-600"
                  }`}>
                    <Laptop className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-sm text-gray-900 block">Local Direct Mode</span>
                    <span className="text-[11px] text-gray-500 block">Localhost / LAN loopback</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed mt-2">
                  Routes HLS stream directly via <code className="text-purple-600 font-mono text-[11px] bg-white px-1.5 py-0.5 rounded border">http://localhost:8888</code>. Ideal for local testing and zero internet latency.
                </p>
              </button>

              {/* Option 2: Cloudflare Tunneled */}
              <button
                type="button"
                onClick={() => setRoutingMode("tunneled")}
                className={`p-5 rounded-xl border text-left transition-all ${
                  routingMode === "tunneled"
                    ? "border-purple-500 bg-purple-50/50 ring-2 ring-purple-500/20"
                    : "border-gray-200 bg-gray-50/50 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    routingMode === "tunneled" ? "bg-purple-100 text-purple-700" : "bg-gray-200 text-gray-600"
                  }`}>
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-sm text-gray-900 block">Cloudflare Tunnel Mode</span>
                    <span className="text-[11px] text-purple-600 font-bold block">Netlify & Remote Viewers</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed mt-2">
                  Routes HLS stream chunks via your active Cloudflare Tunnel. Required so viewers on Netlify can receive the stream from your PC.
                </p>
              </button>
            </div>

            {/* Tunnel URL input (shown if tunneled or to configure ahead) */}
            <div className={`p-5 rounded-xl border transition-all ${
              routingMode === "tunneled" ? "bg-purple-50/30 border-purple-200" : "bg-gray-50 border-gray-200"
            }`}>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-700 block mb-1">
                Active Cloudflare Tunnel Base URL
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Run <code className="bg-white px-1.5 py-0.5 rounded border font-mono text-purple-700 text-[11px]">.\launcher\run_tunnel.bat</code> on your PC, then paste the generated <code className="font-mono text-gray-700 text-[11px]">https://...trycloudflare.com</code> URL here:
              </p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <input
                  type="url"
                  value={tunnelUrl}
                  onChange={(e) => setTunnelUrl(e.target.value)}
                  placeholder="https://example-subdomain.trycloudflare.com"
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-900 text-sm focus:outline-none focus:border-purple-500 font-mono"
                />
                <button
                  type="button"
                  disabled={routingSaving}
                  onClick={handleSaveRouting}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs transition-all flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span>{routingSaving ? "Saving..." : "Save Route Setting"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>


        {/* Footer */}
        <div className="text-center text-xs text-gray-400 pt-4">
          Z-Live Project — E299625 | Kingston University London
        </div>
      </div>

      {/* ── Create User Modal ── */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-gray-100 rounded-2xl max-w-md w-full p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-gray-900 text-base">Create New Login</h3>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              {/* Role Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Select Role & Access Level
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewRole("viewer")}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                      newRole === "viewer"
                        ? "border-purple-500 bg-purple-50/50 text-purple-900 ring-2 ring-purple-500/20"
                        : "border-gray-200 hover:border-gray-300 text-gray-600"
                    }`}
                  >
                    <Tv className="w-5 h-5 mb-1 text-purple-600" />
                    <span className="text-xs font-bold">Viewer</span>
                    <span className="text-[10px] text-gray-400">Stream Watch Only</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewRole("streamer")}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                      newRole === "streamer"
                        ? "border-purple-500 bg-purple-50/50 text-purple-900 ring-2 ring-purple-500/20"
                        : "border-gray-200 hover:border-gray-300 text-gray-600"
                    }`}
                  >
                    <Radio className="w-5 h-5 mb-1 text-purple-600" />
                    <span className="text-xs font-bold">Streamer</span>
                    <span className="text-[10px] text-gray-400">Full System Access</span>
                  </button>
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700">Account Email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder={newRole === "viewer" ? "viewer1@zlive.tv" : "streamer1@zlive.tv"}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-gray-900 text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                  required
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700">Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  minLength={6}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-gray-900 text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {createLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  {createLoading ? "Creating..." : "Save Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
