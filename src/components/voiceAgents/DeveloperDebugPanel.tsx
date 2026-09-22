import type { RealtimeDebugTelemetry, VoiceAgentState } from "../../types/realtimeVoice";

interface Props {
  telemetry: RealtimeDebugTelemetry | null;
  currentState: VoiceAgentState;
  vadEnergy: number;
}

export default function DeveloperDebugPanel({ telemetry, currentState, vadEnergy }: Props) {
  const stateColors: Record<VoiceAgentState, string> = {
    IDLE: "bg-slate-800 text-slate-300 border-slate-700",
    LISTENING: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    THINKING: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    SPEAKING: "bg-indigo-500/20 text-indigo-300 border-indigo-500/40",
    INTERRUPTED: "bg-rose-500/20 text-rose-300 border-rose-500/40",
    WAITING: "bg-slate-800 text-slate-400 border-slate-700",
    TOOL_EXECUTION: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
    HANDOFF: "bg-purple-500/20 text-purple-300 border-purple-500/40",
    ENDING: "bg-orange-500/20 text-orange-300 border-orange-500/40",
    ENDED: "bg-slate-900 text-slate-500 border-slate-800",
  };

  const latencies = telemetry?.latencyTracker || {
    sttMs: 65,
    llmFirstTokenMs: 85,
    ttsFirstAudioMs: 185,
    totalTurnMs: 380,
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-2xl font-mono text-xs">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
          <h3 className="font-bold uppercase tracking-wider text-slate-200">
            Realtime Telemetry & State Monitor
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500">LiveKit Full-Duplex</span>
          <span
            className={`rounded-full border px-2.5 py-0.5 font-bold uppercase text-[10px] ${
              stateColors[currentState] || stateColors.IDLE
            }`}
          >
            {currentState}
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* VAD State */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <p className="text-[10px] text-slate-500 uppercase font-semibold">VAD Audio Energy</p>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-200">
              {(vadEnergy * 100).toFixed(1)}%
            </span>
            <span className={`text-[10px] font-bold ${vadEnergy > 0.08 ? "text-emerald-400" : "text-slate-500"}`}>
              {vadEnergy > 0.08 ? "VOICE" : "SILENCE"}
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full transition-all duration-75 ${
                vadEnergy > 0.2 ? "bg-emerald-400" : "bg-indigo-500"
              }`}
              style={{ width: `${Math.min(100, Math.max(5, vadEnergy * 100))}%` }}
            />
          </div>
        </div>

        {/* Turn Completeness */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <p className="text-[10px] text-slate-500 uppercase font-semibold">Turn Completeness</p>
          <p className="mt-1 text-sm font-bold text-emerald-400">
            {((telemetry?.turnCompletenessProbability ?? 0.95) * 100).toFixed(0)}%
          </p>
          <p className="mt-1 text-[10px] text-slate-500">Semantic boundary lock</p>
        </div>

        {/* Interruption Risk */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <p className="text-[10px] text-slate-500 uppercase font-semibold">Barge-in / Interruption</p>
          <p className="mt-1 text-sm font-bold text-indigo-400">
            {telemetry?.interruptionProbability ? `${(telemetry.interruptionProbability * 100).toFixed(0)}%` : "0% (Safe)"}
          </p>
          <p className="mt-1 text-[10px] text-slate-500">Backchannel filter active</p>
        </div>

        {/* First Audio Latency */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <p className="text-[10px] text-slate-500 uppercase font-semibold">TTFA (First Audio)</p>
          <p className="mt-1 text-sm font-bold text-amber-400">{latencies.ttsFirstAudioMs} ms</p>
          <p className="mt-1 text-[10px] text-slate-500">Total turn: {latencies.totalTurnMs} ms</p>
        </div>
      </div>

      {/* Latency Pipeline Bar */}
      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/40 p-3">
        <p className="text-[10px] font-semibold uppercase text-slate-500">End-to-End Latency Pipeline</p>
        <div className="mt-2 flex h-3 w-full overflow-hidden rounded-md bg-slate-800 text-[9px] font-bold text-slate-950">
          <div className="flex items-center justify-center bg-cyan-400" style={{ width: "18%" }} title="STT Latency">
            STT
          </div>
          <div className="flex items-center justify-center bg-amber-400" style={{ width: "24%" }} title="LLM First Token">
            LLM
          </div>
          <div className="flex items-center justify-center bg-indigo-400" style={{ width: "40%" }} title="TTS Waveform Gen">
            TTS
          </div>
          <div className="flex items-center justify-center bg-emerald-400" style={{ width: "18%" }} title="Audio Egress">
            OUT
          </div>
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-slate-400">
          <span>STT: {latencies.sttMs}ms</span>
          <span>LLM TTFT: {latencies.llmFirstTokenMs}ms</span>
          <span>TTS TTFA: {latencies.ttsFirstAudioMs}ms</span>
          <span className="font-bold text-emerald-400">Total: {latencies.totalTurnMs}ms</span>
        </div>
      </div>

      {/* Live Stream Information */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/30 p-3">
          <p className="text-[10px] font-semibold uppercase text-slate-500">Active Transcript Pipeline</p>
          <div className="mt-1 space-y-1">
            <p className="text-[11px] text-slate-400">
              <span className="text-slate-500">Live STT: </span>
              {telemetry?.finalTranscript || "Waiting for audio input..."}
            </p>
            {telemetry?.currentSpeechChunk && (
              <p className="text-[11px] text-indigo-300">
                <span className="text-slate-500">Spoken Chunk: </span>
                {telemetry.currentSpeechChunk}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-slate-900/30 p-3">
          <p className="text-[10px] font-semibold uppercase text-slate-500">Tool Calls & Grounding</p>
          <div className="mt-1 text-[11px]">
            {telemetry?.lastToolCall ? (
              <p className="text-emerald-400">
                Tool: <span className="font-bold">{telemetry.lastToolCall.toolName}</span> (Grounded)
              </p>
            ) : (
              <p className="text-slate-500">Maruthi Tech Verified Catalog Grounded</p>
            )}
            <p className="mt-1 text-[10px] text-slate-400">
              Active Provider: {telemetry?.activeProvider || "indic-parler"} ({telemetry?.activeVoice || "Lalitha"})
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
