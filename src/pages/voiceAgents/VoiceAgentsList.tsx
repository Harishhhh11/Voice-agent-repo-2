import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { fetchVoiceAgents } from "../../api/voiceAgents";
import type { RealtimeVoiceAgentConfig } from "../../types/realtimeVoice";

export default function VoiceAgentsList() {
  const [agents, setAgents] = useState<RealtimeVoiceAgentConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const list = await fetchVoiceAgents();
        setAgents(list);
      } catch (err) {
        console.error("Failed to load voice agents:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const stats = [
    { label: "Active Calls", value: "3", change: "Live right now", icon: "✆", color: "text-emerald-400" },
    { label: "Total Calls Handled", value: "1,482", change: "+18% this week", icon: "☎", color: "text-indigo-400" },
    { label: "Avg Call Duration", value: "3m 04s", change: "Optimal efficiency", icon: "◷", color: "text-cyan-400" },
    { label: "Avg Response Latency", value: "385ms", change: "Sub-400ms TTFA", icon: "⚡", color: "text-amber-400" },
    { label: "Leads Generated", value: "846", change: "72% inquiry conversion", icon: "↗", color: "text-purple-400" },
    { label: "Appointments Booked", value: "512", change: "Demo classes confirmed", icon: "📅", color: "text-blue-400" },
    { label: "Human Transfers", value: "4.1%", change: "Escalated to counselors", icon: "👥", color: "text-rose-400" },
    { label: "Call Success Rate", value: "98.4%", change: "Zero hallucinations", icon: "✓", color: "text-emerald-400" },
  ];

  return (
    <div className="space-y-8">
      {/* Voice Subsystem Top Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <NavLink
          to="/voice-agents"
          className="flex items-center gap-2 rounded-xl bg-indigo-600/20 px-3.5 py-2 text-xs font-bold text-indigo-300 ring-1 ring-inset ring-indigo-500/40"
        >
          <span>🎙 Realtime Voice Agents</span>
          <span className="rounded-md bg-indigo-500/30 px-1.5 py-0.5 text-[9px] font-black uppercase text-indigo-200">
            TELUGU AI
          </span>
        </NavLink>
        <NavLink
          to="/voice/lab"
          className="flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 transition"
        >
          <span>💎 Commercial Voices</span>
        </NavLink>
        <NavLink
          to="/voice/open-source"
          className="flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 transition"
        >
          <span>⚡ Open-Source Voices</span>
          <span className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-black uppercase text-emerald-400">
            LOCAL
          </span>
        </NavLink>
        <NavLink
          to="/voice"
          className="flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 transition"
        >
          <span>✆ Telephony & Calls</span>
        </NavLink>
      </div>

      {/* Top Banner */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white tracking-tight">Realtime Voice Agents</h1>
            <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-xs font-bold text-indigo-400 border border-indigo-500/30">
              TELUGU FIRST-CLASS
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Self-hosted full-duplex conversational voice agents with LiveKit WebRTC, instant barge-in, and semantic turn taking.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <NavLink
            to="/voice-agents/create"
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-500/20 hover:opacity-95 transition"
          >
            <span>+ Create Voice Agent</span>
          </NavLink>
        </div>
      </div>

      {/* 8 Metric Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">{s.label}</span>
              <span className="text-lg">{s.icon}</span>
            </div>
            <p className={`mt-2 text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="mt-1 text-[11px] text-slate-500">{s.change}</p>
          </div>
        ))}
      </div>

      {/* Voice Agents Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white">Active Receptionist Lines ({agents.length})</h2>
          <span className="text-xs text-slate-400">Grounded in verified curriculum & instant barge-in</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400">Loading voice agents...</div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="group flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl transition hover:border-slate-700 hover:shadow-2xl"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-xl font-black text-white shadow-md">
                        {agent.personality === "Professional" ? "🎙" : agent.personality === "Warm" ? "🌸" : "⚡"}
                      </div>
                      <div>
                        <h3 className="font-bold text-white group-hover:text-indigo-400 transition">
                          {agent.name}
                        </h3>
                        <p className="text-xs text-slate-400">{agent.companyName}</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-500/20">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Live
                    </span>
                  </div>

                  <p className="mt-3 text-xs leading-relaxed text-slate-300">
                    "{agent.initialGreeting}"
                  </p>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                      {agent.voiceName}
                    </span>
                    <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                      {agent.personality}
                    </span>
                    <span className="rounded-md bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-300">
                      {agent.transport.toUpperCase()}
                    </span>
                    <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                      Barge-in: {(agent.bargeInSensitivity * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                <div className="mt-6 flex items-center gap-2 border-t border-slate-800 pt-4">
                  <NavLink
                    to={`/voice-agents/${agent.id}/test`}
                    className="flex-1 rounded-xl bg-indigo-500/20 px-3 py-2 text-center text-xs font-bold text-indigo-300 hover:bg-indigo-500 hover:text-white transition"
                  >
                    Launch Studio Call
                  </NavLink>
                  <NavLink
                    to={`/voice-agents/${agent.id}`}
                    className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
                  >
                    View
                  </NavLink>
                  <NavLink
                    to={`/voice-agents/${agent.id}/settings`}
                    className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
                  >
                    ⚙
                  </NavLink>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
