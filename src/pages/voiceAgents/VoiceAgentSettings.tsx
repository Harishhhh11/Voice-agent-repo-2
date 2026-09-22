import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import VoiceAgentHeader from "../../components/voiceAgents/VoiceAgentHeader";
import { fetchVoiceAgent, updateVoiceAgent } from "../../api/voiceAgents";
import type { RealtimeVoiceAgentConfig } from "../../types/realtimeVoice";

export default function VoiceAgentSettings() {
  const { id } = useParams<{ id: string }>();
  const [agent, setAgent] = useState<RealtimeVoiceAgentConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Form Fields
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [tagline, setTagline] = useState("");
  const [initialGreeting, setInitialGreeting] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [bargeInSensitivity, setBargeInSensitivity] = useState(0.85);
  const [silenceTimeoutMs, setSilenceTimeoutMs] = useState(1200);
  const [thinkingPauseToleranceMs, setThinkingPauseToleranceMs] = useState(800);
  const [humanHandoffSipExt, setHumanHandoffSipExt] = useState("101");

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        const ag = await fetchVoiceAgent(id);
        setAgent(ag);
        setName(ag.name);
        setCompanyName(ag.companyName);
        setTagline(ag.tagline);
        setInitialGreeting(ag.initialGreeting);
        setVoiceId(ag.voiceId);
        setBargeInSensitivity(ag.bargeInSensitivity);
        setSilenceTimeoutMs(ag.silenceTimeoutMs);
        setThinkingPauseToleranceMs(ag.thinkingPauseToleranceMs);
        setHumanHandoffSipExt(ag.humanHandoff?.sipExtension || "101");
      } catch (err) {
        console.error("Failed to load agent:", err);
      }
    }
    load();
  }, [id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setIsSaving(true);
    setSavedSuccess(false);

    try {
      const updated = await updateVoiceAgent(id, {
        name,
        companyName,
        tagline,
        initialGreeting,
        voiceId,
        bargeInSensitivity,
        silenceTimeoutMs,
        thinkingPauseToleranceMs,
        humanHandoff: {
          enabled: true,
          sipExtension: humanHandoffSipExt,
          phoneNumber: "+91 98765 43210",
          transferKeywords: ["human", "counselor", "transfer", "person"],
          autoTransferOnAngry: true,
          autoTransferOnUnansweredCount: 2,
        },
      });
      setAgent(updated);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to update agent:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <VoiceAgentHeader agent={agent} activeTab="settings" />

      <form onSubmit={handleSave} className="space-y-6">
        {savedSuccess && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-400">
            ✓ Voice agent configuration updated and synced with LiveKit & Asterisk runtime.
          </div>
        )}

        {/* General Settings */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl backdrop-blur-sm space-y-4">
          <h2 className="text-base font-bold text-white">General Identity & Greeting</h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Agent Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Company</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Tagline</label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Initial Receptionist Spoken Greeting</label>
            <textarea
              rows={2}
              value={initialGreeting}
              onChange={(e) => setInitialGreeting(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Full-Duplex & Barge-In Timing Tuning */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl backdrop-blur-sm space-y-4">
          <h2 className="text-base font-bold text-white">Full-Duplex Speech & Turn Taking Parameters</h2>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-semibold text-slate-400">Barge-in Sensitivity (Interruption Cutoff)</span>
              <span className="font-bold text-emerald-400">{(bargeInSensitivity * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="1.0"
              step="0.05"
              value={bargeInSensitivity}
              onChange={(e) => setBargeInSensitivity(parseFloat(e.target.value))}
              className="w-full accent-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Silence Timeout (ms)</label>
              <input
                type="number"
                value={silenceTimeoutMs}
                onChange={(e) => setSilenceTimeoutMs(parseInt(e.target.value))}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
              <p className="mt-1 text-[10px] text-slate-500">Silence before turn end is confirmed (default: 1200ms)</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Thinking Pause Tolerance (ms)</label>
              <input
                type="number"
                value={thinkingPauseToleranceMs}
                onChange={(e) => setThinkingPauseToleranceMs(parseInt(e.target.value))}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
              <p className="mt-1 text-[10px] text-slate-500">Allows natural mid-sentence pauses without agent cutoff</p>
            </div>
          </div>
        </div>

        {/* Human Handoff */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl backdrop-blur-sm space-y-4">
          <h2 className="text-base font-bold text-white">Telephony Handoff & SIP Trunk</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Counselor SIP Extension</label>
              <input
                type="text"
                value={humanHandoffSipExt}
                onChange={(e) => setHumanHandoffSipExt(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">LiveKit WebRTC Gateway</label>
              <input
                type="text"
                value="ws://localhost:7880"
                readOnly
                className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-400"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-500/20 hover:opacity-95 disabled:opacity-50 transition"
          >
            {isSaving ? "Saving..." : "Save Voice Agent Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
