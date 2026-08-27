"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface FailoverEvent {
  id: number;
  created_at: string;
  event_type: "SWITCH_TO_BACKUP" | "RESTORED_PRIMARY";
  from_interface: string;
  to_interface: string;
  reason: string | null;
  latency_at_switch: number | null;
  packet_loss_at_switch: number | null;
}

function EventBadge({ type }: { type: FailoverEvent["event_type"] }) {
  const isSwitch = type === "SWITCH_TO_BACKUP";
  return (
    <span className={`text-[11px] px-2.5 py-1 rounded-full border font-bold flex items-center gap-1 uppercase tracking-wider ${
      isSwitch
        ? "bg-orange-100 text-orange-700 border-orange-200"
        : "bg-emerald-100 text-emerald-700 border-emerald-200"
    }`}>
      {isSwitch ? <AlertCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
      {isSwitch ? "Failover" : "Restored"}
    </span>
  );
}

export default function FailoverLog() {
  const [events, setEvents] = useState<FailoverEvent[]>([]);
  const supabase = createClient();

  // Initial fetch — last 20 events
  useEffect(() => {
    supabase
      .from("failover_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) setEvents(data as FailoverEvent[]);
      });
  }, []);

  // Realtime subscription — new events appear instantly
  useEffect(() => {
    const channel = supabase
      .channel("failover-events-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "failover_events" },
        (payload) => {
          setEvents((prev) => [payload.new as FailoverEvent, ...prev].slice(0, 20));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Failover Log</h2>
        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
          {events.length} events
        </span>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-3 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
             <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-center">
            <p className="text-gray-800 font-bold text-sm">No failover events yet</p>
            <p className="text-gray-500 text-xs mt-0.5">All networks operating nominally</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto pr-2 scrollbar-thin">
          {events.map((event) => (
            <div
              key={event.id}
              className={`rounded-xl p-4 border transition-all ${
                event.event_type === "SWITCH_TO_BACKUP"
                  ? "border-orange-200 bg-orange-50/50"
                  : "border-emerald-200 bg-emerald-50/50"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <EventBadge type={event.event_type} />
                <span className="text-xs font-semibold text-gray-400 tabular-nums shrink-0 bg-white px-2 py-1 rounded-md shadow-sm border border-gray-100">
                  {new Date(event.created_at).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-sm text-gray-600 font-medium flex items-center gap-2">
                <span className="text-gray-500 line-through decoration-gray-400">{event.from_interface}</span>
                <span className="text-gray-400 font-bold">→</span>
                <span className="text-gray-900 font-bold">{event.to_interface}</span>
              </p>
              {event.reason && (
                <p className="text-xs text-gray-500 mt-2 leading-relaxed bg-white/60 p-2 rounded-lg border border-gray-100 italic">
                  {event.reason}
                </p>
              )}
              {event.latency_at_switch !== null && (
                <div className="flex gap-3 mt-2.5 text-xs font-semibold text-gray-500">
                  <span className="bg-white px-2 py-1 rounded border border-gray-100">Latency: <span className="text-red-600">{event.latency_at_switch?.toFixed(0)}ms</span></span>
                  <span className="bg-white px-2 py-1 rounded border border-gray-100">Loss: <span className="text-red-600">{event.packet_loss_at_switch?.toFixed(0)}%</span></span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
