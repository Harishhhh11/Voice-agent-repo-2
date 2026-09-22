import { NavLink, useParams } from "react-router-dom";
import type { RealtimeVoiceAgentConfig } from "../../types/realtimeVoice";

interface Props {
  agent?: RealtimeVoiceAgentConfig | null;
  activeTab?: "overview" | "test" | "calls" | "analytics" | "settings";
}

export default function VoiceAgentHeader({ agent }: Props) {
  const { id } = useParams<{ id: string }>();
  const agentId = id || agent?.id || "agent-maruthi-receptionist";

  const tabs = [
    { key: "overview", label: "Overview", path: `/voice-agents/${agentId}` },
    { key: "test", label: "Realtime Voice Studio", path: `/voice-agents/${agentId}/test`, badge: "FULL-DUPLEX" },
    { key: "calls", label: "Call History", path: `/voice-agents/${agentId}/calls` },
    { key: "analytics", label: "Analytics & Quality", path: `/voice-agents/${agentId}/analytics` },
    { key: "settings", label: "Configuration", path: `/voice-agents/${agentId}/settings` },
  ];

  return (
    <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/90 p-6 backdrop-blur-sm shadow-xl">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-2xl font-black text-white shadow-lg shadow-indigo-500/25">
            {agent?.personality === "Professional" ? "🎙" : agent?.personality === "Warm" ? "🌸" : "⚡"}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-white tracking-tight">
                {agent?.name || "Maruthi Technologies - Front Desk AI"}
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live SIP/WebRTC
              </span>
              <span className="rounded-md bg-indigo-500/15 px-2 py-0.5 text-xs font-medium text-indigo-300 border border-indigo-500/25">
                {agent?.voiceName || "Lalitha (లలిత)"}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {agent?.companyName || "Maruthi Technologies"} • {agent?.tagline || "Ultra-fast Telugu & English Receptionist"} • Dialect: {agent?.dialect || "hyderabad-telangana"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <NavLink
            to={`/voice-agents/${agentId}/test`}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-500/20 hover:opacity-95 transition"
          >
            <span>Start Live Test Call</span>
            <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px]">WebRTC</span>
          </NavLink>
        </div>
      </div>

      <div className="mt-6 flex border-b border-slate-800 text-sm">
        {tabs.map((tab) => (
          <NavLink
            key={tab.key}
            to={tab.path}
            end={tab.key === "overview"}
            className={({ isActive }) =>
              `flex items-center gap-2 border-b-2 px-4 py-3 font-medium transition-all ${
                isActive
                  ? "border-indigo-500 text-white font-semibold"
                  : "border-transparent text-slate-400 hover:border-slate-700 hover:text-slate-200"
              }`
            }
          >
            <span>{tab.label}</span>
            {tab.badge && (
              <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-indigo-300">
                {tab.badge}
              </span>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
