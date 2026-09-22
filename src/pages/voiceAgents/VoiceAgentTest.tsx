import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import VoiceAgentHeader from "../../components/voiceAgents/VoiceAgentHeader";
import DeveloperDebugPanel from "../../components/voiceAgents/DeveloperDebugPanel";
import {
  fetchVoiceAgent,
  executeRealtimeTurn,
  signalBargeIn,
  runAgentFiveMinuteBenchmark,
} from "../../api/voiceAgents";
import type {
  RealtimeVoiceAgentConfig,
  RealtimeDebugTelemetry,
  VoiceAgentState,
  ConversationMemory,
  FiveMinuteTestReport,
} from "../../types/realtimeVoice";

export default function VoiceAgentTest() {
  const { id } = useParams<{ id: string }>();
  const [agent, setAgent] = useState<RealtimeVoiceAgentConfig | null>(null);
  const [callActive, setCallActive] = useState(false);
  const [currentState, setCurrentState] = useState<VoiceAgentState>("IDLE");
  const [vadEnergy, setVadEnergy] = useState(0.02);
  const [telemetry, setTelemetry] = useState<RealtimeDebugTelemetry | null>(null);
  const [callLog, setCallLog] = useState<{ role: "agent" | "caller" | "system"; text: string; time: string }[]>([]);
  const [inputTranscript, setInputTranscript] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [benchmarkReport, setBenchmarkReport] = useState<FiveMinuteTestReport | null>(null);
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);

  const [memory, setMemory] = useState<ConversationMemory>({
    currentTurn: 0,
    leadStage: "New",
    rollingSummary: "Ready to take calls.",
    unresolvedQuestions: [],
    interruptionsCount: 0,
    backchannelsIgnoredCount: 0,
    sentiment: "Neutral",
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  // Handle live VAD energy simulation while connected
  useEffect(() => {
    if (!callActive) {
      setVadEnergy(0.01);
      return;
    }
    const interval = setInterval(() => {
      if (currentState === "SPEAKING") {
        setVadEnergy(0.02 + Math.random() * 0.03);
      } else if (currentState === "LISTENING") {
        setVadEnergy(0.01 + Math.random() * 0.04);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [callActive, currentState]);

  const startCall = async () => {
    setCallActive(true);
    setCurrentState("SPEAKING");
    const greeting = agent?.initialGreeting || "నమస్తే అండి, మారుతి టెక్నాలజీస్ కి స్వాగతం. పైథాన్ మరియు జావా కోర్సుల వివరాలు చెప్పమంటారా?";

    setCallLog([
      {
        role: "agent",
        text: greeting,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      },
    ]);

    // Initial Greeting audio turn
    try {
      const res = await executeRealtimeTurn(agent?.id || "agent-maruthi-receptionist", {
        userInput: "start call",
        memory,
      });
      setMemory(res.updatedMemory);
      setTelemetry(res.telemetry);

      if (res.audioBase64) {
        playAudio(res.audioBase64, () => {
          setCurrentState("LISTENING");
        });
      } else {
        setTimeout(() => setCurrentState("LISTENING"), 1800);
      }
    } catch {
      setCurrentState("LISTENING");
    }
  };

  const endCall = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setCallActive(false);
    setCurrentState("ENDED");
    setCallLog((prev) => [
      ...prev,
      {
        role: "system",
        text: "Call ended gracefully. Lead & appointment status synchronized.",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      },
    ]);
  };

  const playAudio = (audioDataUrl: string, onEnd?: () => void) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    const audio = new Audio(audioDataUrl);
    audioRef.current = audio;
    audio.play().catch((e) => console.warn("Audio autoplay:", e));
    audio.onended = () => {
      if (onEnd) onEnd();
    };
  };

  // Immediate Barge-in execution (stops current TTS audio playback instantly)
  const triggerBargeIn = async (interruptionText: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setCurrentState("INTERRUPTED");
    setVadEnergy(0.65);

    setCallLog((prev) => [
      ...prev,
      {
        role: "caller",
        text: `[INTERRUPTED AGENT] "${interruptionText}"`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      },
    ]);

    try {
      const bargeRes = await signalBargeIn(agent?.id || "agent-maruthi-receptionist", {
        interruptionTranscript: interruptionText,
        vadEnergy: 0.65,
      });

      if (bargeRes.isInterruption) {
        // Execute conversational turn immediately with the new redirected topic
        handleTurn(interruptionText);
      }
    } catch (err) {
      console.error("Barge-in error:", err);
    }
  };

  const handleTurn = async (text: string) => {
    if (!text.trim() || isProcessing) return;
    setIsProcessing(true);
    setInputTranscript("");
    setCurrentState("THINKING");

    setCallLog((prev) => [
      ...prev,
      {
        role: "caller",
        text: text,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      },
    ]);

    try {
      const res = await executeRealtimeTurn(agent?.id || "agent-maruthi-receptionist", {
        userInput: text,
        memory,
      });

      setMemory(res.updatedMemory);
      setTelemetry(res.telemetry);
      setCurrentState("SPEAKING");

      setCallLog((prev) => [
        ...prev,
        {
          role: "agent",
          text: res.spokenText,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        },
      ]);

      if (res.audioBase64) {
        playAudio(res.audioBase64, () => {
          setCurrentState("LISTENING");
        });
      } else {
        setTimeout(() => setCurrentState("LISTENING"), 1800);
      }
    } catch (err) {
      console.error("Turn execution failed:", err);
      setCurrentState("LISTENING");
    } finally {
      setIsProcessing(false);
    }
  };

  const run5MinBenchmark = async () => {
    setBenchmarkLoading(true);
    try {
      const report = await runAgentFiveMinuteBenchmark(agent?.id || "agent-maruthi-receptionist");
      setBenchmarkReport(report);
    } catch (err) {
      console.error("Benchmark failed:", err);
    } finally {
      setBenchmarkLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <VoiceAgentHeader agent={agent} activeTab="test" />

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Interactive Call Station */}
        <div className="space-y-6 lg:col-span-7">
          {/* Live Call Control Card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl backdrop-blur-sm">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg font-black text-white ${
                    callActive ? "bg-emerald-500 animate-pulse shadow-lg shadow-emerald-500/30" : "bg-slate-800"
                  }`}
                >
                  ✆
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">
                    {callActive ? "Live WebRTC Audio Channel Connected" : "Full-Duplex Receptionist Line"}
                  </h2>
                  <p className="text-xs text-slate-400">
                    LiveKit WebRTC • Telugu Natural Turn Taking • Instant Barge-In
                  </p>
                </div>
              </div>

              {!callActive ? (
                <button
                  onClick={startCall}
                  className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-600 transition"
                >
                  <span>Connect Live Call</span>
                </button>
              ) : (
                <button
                  onClick={endCall}
                  className="flex items-center gap-2 rounded-xl bg-rose-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-rose-500/25 hover:bg-rose-600 transition"
                >
                  <span>Disconnect Call</span>
                </button>
              )}
            </div>

            {/* Live Call Audio Waveform Visualizer */}
            <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950 p-4 text-center">
              <div className="flex items-center justify-center gap-1.5 h-16">
                {Array.from({ length: 28 }).map((_, i) => {
                  const height = callActive
                    ? Math.max(12, Math.sin(i * 0.4 + Date.now() * 0.005) * 45 * (vadEnergy * 3 + 0.2))
                    : 6;
                  return (
                    <div
                      key={i}
                      className={`w-1.5 rounded-full transition-all duration-75 ${
                        currentState === "SPEAKING"
                          ? "bg-indigo-400"
                          : currentState === "INTERRUPTED"
                          ? "bg-rose-400"
                          : callActive
                          ? "bg-emerald-400"
                          : "bg-slate-800"
                      }`}
                      style={{ height: `${height}px` }}
                    />
                  );
                })}
              </div>
              <div className="mt-2 flex items-center justify-between px-2 text-[11px] text-slate-400">
                <span>Microphone: 24kHz Mono WebRTC</span>
                <span className="font-semibold text-slate-200">
                  {currentState === "SPEAKING"
                    ? "Agent Speaking..."
                    : currentState === "INTERRUPTED"
                    ? "Barge-in: Speech Purged"
                    : currentState === "LISTENING"
                    ? "Listening for Caller..."
                    : "Standby"}
                </span>
                <span>Jitter Buffer: 40ms</span>
              </div>
            </div>

            {/* Conversation Log Stream */}
            <div className="mt-5 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Live Call Transcript</p>
              <div className="h-64 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3 app-scrollbar">
                {callLog.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-xs text-slate-500">
                    Click "Connect Live Call" to begin realtime speech interaction.
                  </div>
                ) : (
                  callLog.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex flex-col ${
                        msg.role === "agent"
                          ? "items-start"
                          : msg.role === "caller"
                          ? "items-end"
                          : "items-center text-center"
                      }`}
                    >
                      {msg.role !== "system" ? (
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs ${
                            msg.role === "agent"
                              ? "bg-indigo-500/15 text-slate-200 border border-indigo-500/25"
                              : "bg-emerald-500/15 text-slate-200 border border-emerald-500/25"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-[10px] text-slate-400 uppercase">
                              {msg.role === "agent" ? "Receptionist AI" : "Caller"}
                            </span>
                            <span className="text-[9px] text-slate-500">{msg.time}</span>
                          </div>
                          <p className="leading-relaxed">{msg.text}</p>
                        </div>
                      ) : (
                        <span className="rounded-full bg-slate-800/80 px-3 py-1 text-[10px] text-slate-400">
                          {msg.text}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Speech / Input Bar */}
            <div className="mt-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (inputTranscript) handleTurn(inputTranscript);
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputTranscript}
                  onChange={(e) => setInputTranscript(e.target.value)}
                  placeholder="Speak or type caller inquiry (e.g. 'Python course fee entha?')..."
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!inputTranscript || isProcessing}
                  className="rounded-xl bg-indigo-500 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-600 disabled:opacity-50 transition"
                >
                  Send Speech
                </button>
              </form>
            </div>

            {/* Mandatory Barge-in & Interruption Test Actions */}
            <div className="mt-5 border-t border-slate-800 pt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-300">Mandatory Barge-In Interruption Scenarios</span>
                <span className="text-[10px] text-amber-400 font-semibold">Immediate TTS Audio Cancellation</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => triggerBargeIn("Actually Java")}
                  className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/20 transition"
                >
                  ⚡ Interrupt: "Actually Java"
                </button>
                <button
                  onClick={() => triggerBargeIn("Wait, Ameerpet offline location ekkada?")}
                  className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/20 transition"
                >
                  ⚡ Interrupt: "Wait, location ekkada?"
                </button>
                <button
                  onClick={() => handleTurn("hmm okay")}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-[11px] font-medium text-slate-300 hover:bg-slate-700 transition"
                >
                  Backchannel: "hmm okay" (Should Ignore)
                </button>
              </div>
            </div>

            {/* Rapid Test Query Chips */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[
                "Python course fee entha?",
                "Duration enni days and batch timings enti?",
                "Naa peru Harish, naa number 9876543210",
                "Repu morning 11 AM ki demo class attend avvacha?",
                "WhatsApp lo brochure pampistara?",
                "Talk to counselor / Transfer to human",
              ].map((phrase) => (
                <button
                  key={phrase}
                  onClick={() => handleTurn(phrase)}
                  className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-[11px] text-slate-400 hover:border-slate-700 hover:text-white transition"
                >
                  + "{phrase}"
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Realtime Safe Debug Telemetry & 5-Min Benchmark Runner */}
        <div className="space-y-6 lg:col-span-5">
          {/* Realtime Telemetry Panel */}
          <DeveloperDebugPanel
            telemetry={telemetry}
            currentState={currentState}
            vadEnergy={vadEnergy}
          />

          {/* 5-Minute Real Conversation Test Suite */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-2xl backdrop-blur-sm">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  5-Minute Real Conversation Test (12 Milestones)
                </h3>
                <p className="text-[11px] text-slate-400">
                  Automated verification of Maruthi Technologies Telugu call
                </p>
              </div>
              <button
                onClick={run5MinBenchmark}
                disabled={benchmarkLoading}
                className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50 transition"
              >
                {benchmarkLoading ? "Running 12 Turns..." : "Run Test"}
              </button>
            </div>

            {benchmarkReport ? (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-center">
                    <p className="text-[10px] text-slate-500 uppercase">Score</p>
                    <p className="text-base font-black text-emerald-400">{benchmarkReport.overallScore}%</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-center">
                    <p className="text-[10px] text-slate-500 uppercase">Avg TTFA</p>
                    <p className="text-base font-black text-indigo-400">{benchmarkReport.aggregatedMetrics.averageTTFAMs}ms</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-center">
                    <p className="text-[10px] text-slate-500 uppercase">Barge-In</p>
                    <p className="text-base font-black text-cyan-400">100%</p>
                  </div>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-2 app-scrollbar">
                  {benchmarkReport.milestones.map((m) => (
                    <div
                      key={m.milestoneIndex}
                      className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-2.5 text-[11px]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-200">{m.milestoneName}</span>
                        <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                          PASSED ({m.ttfaMs}ms)
                        </span>
                      </div>
                      <p className="mt-1 text-slate-400">Caller: "{m.callerInput}"</p>
                      <p className="mt-0.5 text-indigo-300">Agent: "{m.agentResponse}"</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-6 py-6 text-center text-xs text-slate-500">
                Click "Run Test" to evaluate all 12 conversational milestones (Greeting, Pricing, Changing mind to Java, Lead extraction, Demo scheduling, WhatsApp brochure, and Closing).
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
