import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import VoiceAgentHeader from "../../components/voiceAgents/VoiceAgentHeader";
import { fetchVoiceAgent, fetchAgentCalls } from "../../api/voiceAgents";
import type { RealtimeVoiceAgentConfig, RealtimeCallSession } from "../../types/realtimeVoice";

export default function VoiceAgentCalls() {
  const { id } = useParams<{ id: string }>();
  const [agent, setAgent] = useState<RealtimeVoiceAgentConfig | null>(null);
  const [calls, setCalls] = useState<RealtimeCallSession[]>([]);
  const [selectedCall, setSelectedCall] = useState<RealtimeCallSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        const [ag, callList] = await Promise.all([
          fetchVoiceAgent(id),
          fetchAgentCalls(id),
        ]);
        setAgent(ag);
        setCalls(callList);
        if (callList.length > 0) {
          setSelectedCall(callList[0]);
        }
      } catch (err) {
        console.error("Failed to load calls:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  return (
    <div className="space-y-6">
      <VoiceAgentHeader agent={agent} activeTab="calls" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Calls List */}
        <div className="space-y-3 lg:col-span-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Inbound Call Logs ({calls.length})</h2>
            <span className="text-[11px] text-slate-400">Recorded Live</span>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading call history...</div>
          ) : calls.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center text-xs text-slate-400">
              No calls recorded for this agent yet. Launch a studio call to generate records!
            </div>
          ) : (
            <div className="space-y-2.5">
              {calls.map((call) => (
                <div
                  key={call.id}
                  onClick={() => setSelectedCall(call)}
                  className={`cursor-pointer rounded-xl border p-4 transition ${
                    selectedCall?.id === call.id
                      ? "border-indigo-500 bg-indigo-500/10 shadow-lg"
                      : "border-slate-800 bg-slate-900/70 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white">
                      {call.callerName || call.callerNumber}
                    </span>
                    <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                      {call.durationSeconds}s Duration
                    </span>
                  </div>

                  <p className="mt-1 text-[11px] text-slate-400 truncate">
                    {call.memory.rollingSummary || "Inbound course inquiry"}
                  </p>

                  <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-500">
                    <span>{new Date(call.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    <span>•</span>
                    <span>TTFA: {call.metrics.averageTTFAMs}ms</span>
                    <span>•</span>
                    <span className="text-indigo-400">{call.memory.leadStage}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Selected Call Detail Drawer */}
        <div className="space-y-4 lg:col-span-7">
          {selectedCall ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl backdrop-blur-sm">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white">
                    {selectedCall.callerName || selectedCall.callerNumber}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Call ID: {selectedCall.id} • {new Date(selectedCall.startedAt).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/20">
                    {selectedCall.memory.leadStage}
                  </span>
                </div>
              </div>

              {/* Call Summary & Captured State */}
              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs space-y-2">
                <p className="text-slate-300">
                  <span className="font-bold text-white">Summary: </span>
                  {selectedCall.memory.rollingSummary}
                </p>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
                  <div>
                    <span className="text-slate-500">Course Interested: </span>
                    <span className="font-semibold text-indigo-300">
                      {selectedCall.memory.interestedCourse || "Core Java"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Demo Scheduled: </span>
                    <span className="font-semibold text-emerald-400">
                      {selectedCall.memory.appointmentState?.date || "Tomorrow 11:00 AM"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Avg First Audio (TTFA): </span>
                    <span className="font-semibold text-amber-400">{selectedCall.metrics.averageTTFAMs}ms</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Barge-in Interruptions: </span>
                    <span className="font-semibold text-slate-200">{selectedCall.metrics.totalInterruptions}</span>
                  </div>
                </div>
              </div>

              {/* Turn-by-Turn Transcript */}
              <div className="mt-5 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Verified Call Audio Transcript
                </h4>

                <div className="max-h-80 overflow-y-auto space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4 app-scrollbar">
                  {selectedCall.messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex flex-col ${m.role === "assistant" ? "items-start" : "items-end"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl p-3 text-xs ${
                          m.role === "assistant"
                            ? "bg-indigo-500/15 text-slate-200 border border-indigo-500/25"
                            : "bg-emerald-500/15 text-slate-200 border border-emerald-500/25"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4 mb-1">
                          <span className="font-bold text-[10px] text-slate-400 uppercase">
                            {m.role === "assistant" ? "Agent (Lalitha)" : "Caller"}
                          </span>
                          {m.metrics && (
                            <span className="text-[9px] font-semibold text-amber-400">
                              TTFA: {m.metrics.ttfaMs}ms
                            </span>
                          )}
                        </div>
                        <p className="leading-relaxed">{m.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center text-xs text-slate-400">
              Select a call to view full transcript and metrics.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
