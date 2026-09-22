import { useState, useEffect } from "react";
import { useParams, NavLink } from "react-router-dom";
import VoiceAgentHeader from "../../components/voiceAgents/VoiceAgentHeader";
import { fetchVoiceAgent } from "../../api/voiceAgents";
import type { RealtimeVoiceAgentConfig } from "../../types/realtimeVoice";

export default function VoiceAgentDetail() {
  const { id } = useParams<{ id: string }>();
  const [agent, setAgent] = useState<RealtimeVoiceAgentConfig | null>(null);

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        const ag = await fetchVoiceAgent(id);
        setAgent(ag);
      } catch (err) {
        console.error("Failed to load agent:", err);
      }
    }
    load();
  }, [id]);

  return (
    <div className="space-y-6">
      <VoiceAgentHeader agent={agent} activeTab="overview" />

      {/* Overview Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Left 2 Cols: Agent Specs */}
        <div className="space-y-6 md:col-span-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl backdrop-blur-sm">
            <h2 className="text-base font-bold text-white mb-4">Core Voice & Dialect Configuration</h2>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <span className="text-slate-500 uppercase font-semibold text-[10px]">Primary Language</span>
                <p className="mt-1 font-bold text-white">Telugu-English Code Mixing (te-en-hybrid)</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Hyderabad / Telangana Dialect</p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <span className="text-slate-500 uppercase font-semibold text-[10px]">TTS Synthesis Engine</span>
                <p className="mt-1 font-bold text-indigo-400">Indic-Parler / VEXYL-TTS</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Voice: {agent?.voiceName || "Lalitha (లలిత)"}</p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <span className="text-slate-500 uppercase font-semibold text-[10px]">Barge-In Sensitivity</span>
                <p className="mt-1 font-bold text-emerald-400">
                  {((agent?.bargeInSensitivity ?? 0.85) * 100).toFixed(0)}% (Instant Cutoff)
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Acoustic & Semantic Backchannel Filter</p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <span className="text-slate-500 uppercase font-semibold text-[10px]">Telephony Protocol</span>
                <p className="mt-1 font-bold text-cyan-400">LiveKit Server + Asterisk SIP</p>
                <p className="text-[11px] text-slate-400 mt-0.5">8kHz G.711 & 24kHz WebRTC Profiles</p>
              </div>
            </div>

            <div className="mt-6 border-t border-slate-800 pt-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Initial Spoken Greeting</h3>
              <p className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-xs leading-relaxed text-slate-300">
                "{agent?.initialGreeting}"
              </p>
            </div>
          </div>

          {/* Business Grounding */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl backdrop-blur-sm">
            <h2 className="text-base font-bold text-white mb-4">Grounded Knowledge & Business Rules</h2>
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Institute / Organization</span>
                <span className="font-bold text-white">Maruthi Technologies (Ameerpet, Hyderabad)</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Verified Courses</span>
                <span className="font-bold text-indigo-300">Python (₹4k), Java (₹5k), Full Stack (₹12k), Data Science (₹15k)</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Operating Hours</span>
                <span className="font-bold text-white">Mon - Sat: 09:00 AM - 07:00 PM (IST)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Senior Human Handoff</span>
                <span className="font-bold text-emerald-400">Enabled (Ext: 101 - Counselor Venkat)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Quick Launch & Diagnostics */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl backdrop-blur-sm">
            <h2 className="text-base font-bold text-white mb-4">Live Testing Actions</h2>
            <div className="space-y-3">
              <NavLink
                to={`/voice-agents/${agent?.id || "agent-maruthi-receptionist"}/test`}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-3 text-xs font-bold text-white shadow-lg shadow-indigo-500/25 hover:opacity-95 transition"
              >
                <span>Launch Interactive Studio</span>
              </NavLink>

              <NavLink
                to={`/voice-agents/${agent?.id || "agent-maruthi-receptionist"}/calls`}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
              >
                <span>View Call Recordings & Transcripts</span>
              </NavLink>

              <NavLink
                to={`/voice-agents/${agent?.id || "agent-maruthi-receptionist"}/analytics`}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
              >
                <span>Voice Quality Analytics</span>
              </NavLink>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl backdrop-blur-sm text-xs">
            <h3 className="font-bold text-white mb-2">Full-Duplex Operational Health</h3>
            <div className="space-y-2 text-slate-400">
              <div className="flex justify-between">
                <span>VAD Frame Latency</span>
                <span className="font-bold text-emerald-400">12ms</span>
              </div>
              <div className="flex justify-between">
                <span>Semantic Turn Lock</span>
                <span className="font-bold text-emerald-400">Active</span>
              </div>
              <div className="flex justify-between">
                <span>Interruption Cancel Speed</span>
                <span className="font-bold text-cyan-400">&lt; 40ms</span>
              </div>
              <div className="flex justify-between">
                <span>Telugu Prosody Score</span>
                <span className="font-bold text-amber-400">97.8%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
