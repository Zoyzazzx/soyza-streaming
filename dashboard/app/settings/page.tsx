"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
  RefreshCw
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

  useEffect(() => {
    if (!loadingAuth) {
      fetchUsers();
    }
  }, [loadingAuth]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* ── Navigation ── */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <Link href="/" className="shrink-0 flex items-center gap-2">
              <img 
                src="/logo.png" 
                alt="ZoyzaXR Logo" 
                className="w-10 h-10 rounded-2xl shadow-md object-cover border border-purple-100" 
              />
            </Link>
            <div>
              <span className="font-bold text-gray-900 text-lg tracking-tight block">ZoyzaXR</span>
              <span className="text-gray-500 text-xs">Settings & Access Control</span>
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
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
        
        {/* Status Notification Banner */}
        {statusMsg && (
          <div className={`p-4 rounded-2xl border flex items-center justify-between shadow-sm animate-in fade-in duration-300 ${
            statusMsg.type === "success" 
              ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
              : "bg-red-50 border-red-200 text-red-800"
          }`}>
            <div className="flex items-center gap-3">
              {statusMsg.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
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
        <div className="bg-white border border-gray-200 rounded-3xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner">
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
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-all shadow-sm hover:shadow"
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
                <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-indigo-600"></div>
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
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <Radio className="w-3 h-3 text-indigo-600" />
                            Streamer (Full Access)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200">
                            <Tv className="w-3 h-3 text-violet-600" />
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
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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

        {/* System Settings & Architecture Info */}
        <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-600 flex items-center justify-center flex-shrink-0">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">Role-Based Access Policy</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                • <b>Streamers</b> have full clearance for Broadcast Studio, failover controls, live viewer, and user management.<br />
                • <b>Viewers</b> are restricted strictly to live playback and cannot modify streaming or hardware failover settings.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 pt-4">
          ZoyzaXR Project — E299625 | Kingston University London
        </div>
      </main>

      {/* ── Create User Modal ── */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-gray-100 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
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
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all ${
                      newRole === "viewer"
                        ? "border-violet-500 bg-violet-50/50 text-violet-900 ring-2 ring-violet-500/20"
                        : "border-gray-200 hover:border-gray-300 text-gray-600"
                    }`}
                  >
                    <Tv className="w-5 h-5 mb-1 text-violet-600" />
                    <span className="text-xs font-bold">Viewer</span>
                    <span className="text-[10px] text-gray-400">Stream Watch Only</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewRole("streamer")}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all ${
                      newRole === "streamer"
                        ? "border-indigo-500 bg-indigo-50/50 text-indigo-900 ring-2 ring-indigo-500/20"
                        : "border-gray-200 hover:border-gray-300 text-gray-600"
                    }`}
                  >
                    <Radio className="w-5 h-5 mb-1 text-indigo-600" />
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
                  placeholder={newRole === "viewer" ? "viewer1@zoyzair.tv" : "streamer1@zoyzair.tv"}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-gray-900 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
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
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-gray-900 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
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
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
                >
                  {createLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  {createLoading ? "Creating..." : "Save Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
