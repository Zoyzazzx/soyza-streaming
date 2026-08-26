"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
      isSwitch
        ? "bg-orange-500/15 text-orange-300 border-orange-500/30"
        : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
    }`}>
      {isSwitch ? "⚠ Failover" : "✓ Restored"}
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
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">Failover Log</h2>
        <span className="text-xs text-white/30">{events.length} events</span>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
            <svg className="w-5 h-5 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-white/30 text-sm">No failover events yet</p>
          <p className="text-white/20 text-xs">All networks nominal</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1 scrollbar-thin">
          {events.map((event) => (
            <div
              key={event.id}
              className={`rounded-xl p-3 border transition-all ${
                event.event_type === "SWITCH_TO_BACKUP"
                  ? "border-orange-500/20 bg-orange-500/5"
                  : "border-emerald-500/20 bg-emerald-500/5"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <EventBadge type={event.event_type} />
                <span className="text-xs text-white/30 tabular-nums shrink-0">
                  {new Date(event.created_at).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-xs text-white/70">
                <span className="text-white/50">{event.from_interface}</span>
                <span className="text-white/30 mx-1.5">→</span>
                <span className="text-white/80 font-medium">{event.to_interface}</span>
              </p>
              {event.reason && (
                <p className="text-xs text-white/40 mt-1 leading-relaxed">{event.reason}</p>
              )}
              {event.latency_at_switch !== null && (
                <div className="flex gap-3 mt-1.5 text-xs text-white/30">
                  <span>Latency: {event.latency_at_switch?.toFixed(0)}ms</span>
                  <span>Loss: {event.packet_loss_at_switch?.toFixed(0)}%</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
