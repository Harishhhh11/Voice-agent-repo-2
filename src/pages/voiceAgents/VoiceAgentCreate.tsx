import { useState } from "react";
import { useNavigate, NavLink } from "react-router-dom";
import { createVoiceAgent } from "../../api/voiceAgents";
import type {
  SupportedLanguage,
  VoicePersonality,
  TTSProviderType,
  AudioProfileType,
  AudioTransportType,
} from "../../types/realtimeVoice";

export default function VoiceAgentCreate() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [name, setName] = useState("Maruthi Technologies - Front Desk AI");
  const [companyName, setCompanyName] = useState("Maruthi Technologies");
  const [tagline, setTagline] = useState("Realtime Telugu & English Admissions Assistant");
  const [language, setLanguage] = useState<SupportedLanguage>("te-en-hybrid");
  const [dialect, setDialect] = useState<"hyderabad-telangana" | "andhra-standard" | "neutral-conversational">("hyderabad-telangana");
  const [personality, setPersonality] = useState<VoicePersonality>("Professional");
  const [ttsProvider, setTtsProvider] = useState<TTSProviderType>("indic-parler");
  const [voiceId, setVoiceId] = useState("os-parler-lalitha");
  const [voiceName, setVoiceName] = useState("Lalitha (లలిత) - Telugu Receptionist");
  const [speed, setSpeed] = useState(1.0);
  const [bargeInSensitivity, setBargeInSensitivity] = useState(0.85);
  const [initialGreeting, setInitialGreeting] = useState("నమస్తే అండి, మారుతి టెక్నాలజీస్ కి స్వాగతం. పైథాన్ మరియు జావా కోర్సుల వివరాలు చెప్పమంటారా?");
  const [transport, setTransport] = useState<AudioTransportType>("livekit");
  const [audioProfile, setAudioProfile] = useState<AudioProfileType>("BROWSER_AUDIO_PROFILE");
  const [llmModel, setLlmModel] = useState("qwen2.5:7b-instruct-q4_K_M");
  const [sttModel, setSttModel] = useState("faster-whisper-indic");
  const [humanHandoffExtension, setHumanHandoffExtension] = useState("101");

  const voices = [
    { id: "os-parler-lalitha", name: "Lalitha (లలిత) - Warm Receptionist (Female)", provider: "indic-parler" },
    { id: "os-parler-ananya", name: "Ananya (అనన్య) - Academic Counselor (Female)", provider: "indic-parler" },
    { id: "os-parler-mohan", name: "Mohan (మోహన్) - Director Baritone (Male)", provider: "indic-parler" },
    { id: "os-parler-rajesh", name: "Rajesh (రాజేష్) - Technical Advisor (Male)", provider: "indic-parler" },
    { id: "os-parler-neerja", name: "Neerja (నీర్జా) - Bilingual Natural (Female)", provider: "indic-parler" },
    { id: "os-f5-telugu-exp", name: "F5 Indic Telugu Ultra - Expressive Flow (Female)", provider: "indic-f5" },
  ];

  const handleCreate = async () => {
    setIsSubmitting(true);
    try {
      const created = await createVoiceAgent({
        name,
        companyName,
        tagline,
        language,
        dialect,
        personality,
        ttsProvider,
        voiceId,
        voiceName,
        speed,
        pitch: 1.0,
        bargeInEnabled: true,
        bargeInSensitivity,
        backchannelFilterEnabled: true,
        silenceTimeoutMs: 1200,
        thinkingPauseToleranceMs: 800,
        audioProfile,
        transport,
        llmProvider: "ollama",
        llmModel,
        sttModel,
        initialGreeting,
        workingHours: {
          start: "09:00",
          end: "19:00",
          timezone: "Asia/Kolkata",
          days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        },
        knowledgeCategories: ["Courses", "Fees", "Batches", "Placements", "Location"],
        leadCaptureFields: ["Name", "Phone", "Course", "Batch"],
        humanHandoff: {
          enabled: true,
          sipExtension: humanHandoffExtension,
          phoneNumber: "+91 98765 43210",
          transferKeywords: ["human", "person", "counselor", "transfer"],
          autoTransferOnAngry: true,
          autoTransferOnUnansweredCount: 2,
        },
        isActive: true,
      });

      navigate(`/voice-agents/${created.id}/test`);
    } catch (err) {
      console.error("Failed to create agent:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Create Realtime Voice Agent</h1>
          <p className="mt-1 text-xs text-slate-400">
            Step {step} of 4: {step === 1 ? "Persona & Spoken Identity" : step === 2 ? "Knowledge & Business Grounding" : step === 3 ? "Transport & Telephony" : "Models & Interruption Controls"}
          </p>
        </div>
        <NavLink
          to="/voice-agents"
          className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
        >
          Cancel
        </NavLink>
      </div>

      {/* Step Indicator Bar */}
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-300"
          style={{ width: `${(step / 4) * 100}%` }}
        />
      </div>

      {/* Step 1: Persona & Identity */}
      {step === 1 && (
        <div className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl backdrop-blur-sm">
          <h2 className="text-base font-bold text-white">1. Agent Persona & Spoken Voice</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
              <label className="block text-xs font-semibold text-slate-400 mb-1">Company / Organization</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
              <label className="block text-xs font-semibold text-slate-400 mb-1">Speech Speed: {speed.toFixed(1)}x</label>
              <input
                type="range"
                min="0.8"
                max="1.3"
                step="0.05"
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-full accent-indigo-500 mt-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Language Mode</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="te-en-hybrid">Telugu-English Code Mixing (Recommended)</option>
                <option value="te-IN">Telugu (Pure Conversational)</option>
                <option value="en-IN">Indian English</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Dialect & Region</label>
              <select
                value={dialect}
                onChange={(e) => setDialect(e.target.value as "hyderabad-telangana" | "andhra-standard" | "neutral-conversational")}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="hyderabad-telangana">Hyderabad / Telangana Natural</option>
                <option value="andhra-standard">Andhra Standard</option>
                <option value="neutral-conversational">Neutral Professional</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Personality</label>
              <select
                value={personality}
                onChange={(e) => setPersonality(e.target.value as VoicePersonality)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="Professional">Professional Receptionist</option>
                <option value="Warm">Warm & Empathetic</option>
                <option value="Energetic">Energetic Placement Lead</option>
                <option value="Calm">Calm & Composed</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Voice Acoustic Model</label>
            <select
              value={voiceId}
              onChange={(e) => {
                const selected = voices.find((v) => v.id === e.target.value);
                if (selected) {
                  setVoiceId(selected.id);
                  setVoiceName(selected.name);
                  setTtsProvider(selected.provider as TTSProviderType);
                }
              }}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
            >
              {voices.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
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
      )}

      {/* Step 2: Knowledge Grounding */}
      {step === 2 && (
        <div className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl backdrop-blur-sm">
          <h2 className="text-base font-bold text-white">2. Grounded Knowledge & Operating Rules</h2>
          <p className="text-xs text-slate-400">
            Strict factual grounding ensures the agent never invents course prices, schedules, or locations.
          </p>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2 text-xs">
            <h3 className="font-bold text-indigo-300">Verified Course Grounding (Maruthi Technologies)</h3>
            <ul className="list-disc list-inside space-y-1 text-slate-300">
              <li>Core Python Programming: 30 days, ₹4,000 (Morning 7:30 AM / Evening 6:30 PM)</li>
              <li>Core Java Programming: 45 days, ₹5,000 (Morning 8:00 AM / Evening 7:00 PM)</li>
              <li>Full Stack Python: 90 days, ₹12,000 with 100% placement support</li>
              <li>Data Science & Generative AI: 75 days, ₹15,000 with practical portfolio</li>
              <li>Location: Ameerpet Metro Station, Hyderabad</li>
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Operating Hours</label>
              <input
                type="text"
                value="09:00 AM - 07:00 PM (Mon - Sat)"
                readOnly
                className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-400 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Counselor SIP Extension</label>
              <input
                type="text"
                value={humanHandoffExtension}
                onChange={(e) => setHumanHandoffExtension(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Transport & Telephony */}
      {step === 3 && (
        <div className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl backdrop-blur-sm">
          <h2 className="text-base font-bold text-white">3. Telephony Protocol & Audio Engineering</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Transport Layer</label>
              <select
                value={transport}
                onChange={(e) => setTransport(e.target.value as AudioTransportType)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="livekit">LiveKit Server (WebRTC / SIP Gateway)</option>
                <option value="webrtc">Direct Browser WebRTC</option>
                <option value="sip-asterisk">Asterisk / FreePBX PJSIP Trunk</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Acoustic Audio Profile</label>
              <select
                value={audioProfile}
                onChange={(e) => setAudioProfile(e.target.value as AudioProfileType)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="BROWSER_AUDIO_PROFILE">Browser Audio Profile (24kHz Mono, 40ms Jitter)</option>
                <option value="TELEPHONE_AUDIO_PROFILE">Telephone Audio Profile (8kHz G.711, 120ms Jitter)</option>
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs text-slate-400">
            <p className="font-semibold text-white">SIP Trunk Gateway Configuration</p>
            <p className="mt-1">
              LiveKit SIP Gateway binds to UDP 5060, allowing incoming PSTN calls from telecom providers to bridge directly into the full-duplex agent loop.
            </p>
          </div>
        </div>
      )}

      {/* Step 4: AI Models & Interruption Tuning */}
      {step === 4 && (
        <div className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl backdrop-blur-sm">
          <h2 className="text-base font-bold text-white">4. Local AI Models & Barge-In Sensitivity</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Local LLM (Ollama Compatible)</label>
              <input
                type="text"
                value={llmModel}
                onChange={(e) => setLlmModel(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Streaming STT Model</label>
              <input
                type="text"
                value={sttModel}
                onChange={(e) => setSttModel(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-400">Barge-in Sensitivity (Interruption Cutoff)</label>
              <span className="text-xs font-bold text-emerald-400">{(bargeInSensitivity * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.4"
              max="1.0"
              step="0.05"
              value={bargeInSensitivity}
              onChange={(e) => setBargeInSensitivity(parseFloat(e.target.value))}
              className="w-full accent-indigo-500"
            />
            <div className="mt-1 flex justify-between text-[10px] text-slate-500">
              <span>0.4 (Relaxed)</span>
              <span>0.85 (Recommended - Real Interruption Only)</span>
              <span>1.0 (Instant Trigger)</span>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between border-t border-slate-800 pt-4">
        <button
          type="button"
          disabled={step === 1}
          onClick={() => setStep((s) => s - 1)}
          className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 disabled:opacity-40 transition"
        >
          ← Previous
        </button>

        {step < 4 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            className="rounded-xl bg-indigo-500 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-600 transition"
          >
            Continue →
          </button>
        ) : (
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleCreate}
            className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-2.5 text-xs font-black text-white shadow-lg shadow-emerald-500/20 hover:opacity-95 disabled:opacity-50 transition"
          >
            {isSubmitting ? "Deploying Agent..." : "Deploy Realtime Voice Agent"}
          </button>
        )}
      </div>
    </div>
  );
}
