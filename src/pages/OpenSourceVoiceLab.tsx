import { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  STANDARD_BENCHMARK_ITEMS,
  type HardwareStatus,
  type OpenSourceModelInfo,
  type OpenSourceVoiceProfile,
  type SynthesisResponse,
  type BenchmarkScore,
  type PronunciationEntry,
  type ModelId,
  type PerformanceMode,
  type DeviceType,
} from "../lib/openSourceVoiceTypes";
import {
  fetchHardwareStatus,
  fetchOpenSourceModels,
  fetchOpenSourceVoices,
  loadModelApi,
  unloadModelApi,
  synthesizeOpenSource,
  fetchPronunciationDictionary,
  savePronunciationEntry,
  deletePronunciationEntry,
  submitBenchmarkScore,
  fetchBenchmarkScores,
  setReceptionistOpenSourceVoice,
  executeRealtimeTurn,
  playOpenSourceAudio,
  stopCurrentAudioPlayback,
  isAudioPlaying,
  BrowserVAD,
} from "../lib/openSourceVoiceEngine";

type ActiveTab = "models" | "voices" | "compare" | "benchmark" | "realtime" | "settings";

export default function OpenSourceVoiceLab() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("models");

  // Global Engine States
  const [hardware, setHardware] = useState<HardwareStatus | null>(null);
  const [models, setModels] = useState<OpenSourceModelInfo[]>([]);
  const [voices, setVoices] = useState<OpenSourceVoiceProfile[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<ModelId>("indic-parler");
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("os-parler-lalitha");
  const [performanceMode, setPerformanceMode] = useState<PerformanceMode>("balanced");
  const [offlineMode, setOfflineMode] = useState<boolean>(true);
  const [activeReceptionistVoice, setActiveReceptionistVoice] = useState<string>("os-parler-lalitha");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingModelId, setLoadingModelId] = useState<string | null>(null);

  // Audio Playback State
  const [currentlyPlayingUrl, setCurrentlyPlayingUrl] = useState<string | null>(null);
  const [lastSynthesis, setLastSynthesis] = useState<SynthesisResponse | null>(null);

  // Benchmark Tab State
  const [selectedBenchmarkCategory, setSelectedBenchmarkCategory] = useState<string>("all");
  const [selectedBenchmarkId, setSelectedBenchmarkId] = useState<string>("bench-pure-1");
  const [customBenchmarkText, setCustomBenchmarkText] = useState<string>("");
  const [benchmarkScores, setBenchmarkScores] = useState<BenchmarkScore[]>([]);
  const [isBenchmarking, setIsBenchmarking] = useState<boolean>(false);
  const [humanRatings, setHumanRatings] = useState({
    naturalness: 5,
    pronunciation: 5,
    conversational: 5,
    humanLike: 5,
    codeMixing: 5,
    emotionalExpression: 4,
    clarity: 5,
    overall: 5,
    notes: "",
  });

  // Compare Tab State (Blind Voice Test)
  const [compareSentence, setCompareSentence] = useState<string>(
    "నమస్కారం! మారుతి టెక్నాలజీస్‌కి కాల్ చేసినందుకు ధన్యవాదాలు. నేను మీకు ఎలా సహాయం చేయగలను?"
  );
  const [blindResults, setBlindResults] = useState<{
    voiceA?: SynthesisResponse & { label: string };
    voiceB?: SynthesisResponse & { label: string };
    voiceC?: SynthesisResponse & { label: string };
  }>({});
  const [isGeneratingCompare, setIsGeneratingCompare] = useState(false);
  const [blindRevealed, setBlindRevealed] = useState(false);
  const [blindRatings, setBlindRatings] = useState({
    A: { naturalness: 4, pronunciation: 4, conversational: 4 },
    B: { naturalness: 5, pronunciation: 5, conversational: 5 },
    C: { naturalness: 4, pronunciation: 4, conversational: 3 },
  });

  // Realtime Tab State
  const [realtimeStatus, setRealtimeStatus] = useState<"ready" | "listening" | "thinking" | "speaking" | "interrupted">("ready");
  const [isVADActive, setIsVADActive] = useState<boolean>(false);
  const [micVolume, setMicVolume] = useState<number>(0);
  const [conversationHistory, setConversationHistory] = useState<
    Array<{
      id: string;
      role: "user" | "receptionist";
      text: string;
      audioUrl?: string;
      durationSec?: number;
      rtf?: number;
      timestamp: number;
    }>
  >([
    {
      id: "turn-1",
      role: "receptionist",
      text: "నమస్కారం! మారుతి టెక్నాలజీస్ కు స్వాగతం. నేను మీకు ఎలా సహాయం చేయగలను?",
      timestamp: Date.now() - 30000,
    },
  ]);
  const [manualInputText, setManualInputText] = useState<string>("");
  const vadRef = useRef<BrowserVAD | null>(null);

  // Settings / Pronunciation Dictionary State
  const [dictionary, setDictionary] = useState<PronunciationEntry[]>([]);
  const [newWord, setNewWord] = useState("");
  const [newPronunciation, setNewPronunciation] = useState("");
  const [newCategory, setNewCategory] = useState<"brand" | "technical" | "currency" | "timing" | "location" | "custom">("technical");
  const [normTestInput, setNormTestInput] = useState("Python course fee is ₹4,000 for 30 days starting at 10 AM");
  const [normTestOutput, setNormTestOutput] = useState("");

  // Load Initial Hardware, Models, Voices & Scores
  useEffect(() => {
    async function initData() {
      try {
        const [hw, mdls, vcs, bScores, dict] = await Promise.all([
          fetchHardwareStatus().catch(() => null),
          fetchOpenSourceModels().catch(() => []),
          fetchOpenSourceVoices().catch(() => []),
          fetchBenchmarkScores().catch(() => []),
          fetchPronunciationDictionary().catch(() => []),
        ]);

        if (hw) setHardware(hw);
        if (mdls.length) setModels(mdls);
        if (vcs.length) setVoices(vcs);
        if (bScores.length) setBenchmarkScores(bScores);
        if (dict.length) setDictionary(dict);

        // Find active receptionist voice
        const activeVoice = vcs.find((v) => v.isReceptionistActive);
        if (activeVoice) {
          setActiveReceptionistVoice(activeVoice.id);
        }
      } catch (err) {
        console.error("Failed to initialize OpenSourceVoiceLab data:", err);
      }
    }
    initData();
  }, []);

  // Cleanup audio & VAD on unmount
  useEffect(() => {
    return () => {
      stopCurrentAudioPlayback();
      if (vadRef.current) {
        vadRef.current.stopListening();
      }
    };
  }, []);

  // Handle Audio Playback
  const handlePlayAudio = (url: string) => {
    if (!url) return;
    if (currentlyPlayingUrl === url && isAudioPlaying()) {
      stopCurrentAudioPlayback();
      setCurrentlyPlayingUrl(null);
      setRealtimeStatus("ready");
      return;
    }

    setCurrentlyPlayingUrl(url);
    setRealtimeStatus("speaking");

    playOpenSourceAudio(
      url,
      () => {
        setCurrentlyPlayingUrl(url);
        setRealtimeStatus("speaking");
      },
      () => {
        setCurrentlyPlayingUrl(null);
        setRealtimeStatus("ready");
      },
      () => {
        setCurrentlyPlayingUrl(null);
        setRealtimeStatus("ready");
      }
    );
  };

  // Model Loading / Unloading
  const handleToggleLoadModel = async (model: OpenSourceModelInfo, targetDevice: DeviceType = "cpu") => {
    setLoadingModelId(model.id);
    try {
      if (model.status === "loaded") {
        await unloadModelApi(model.id);
        setModels((prev) =>
          prev.map((m) => (m.id === model.id ? { ...m, status: "downloaded", loadedOnDevice: undefined } : m))
        );
      } else {
        const res = await loadModelApi(model.id, targetDevice);
        setModels((prev) =>
          prev.map((m) => (m.id === model.id ? { ...m, status: "loaded", loadedOnDevice: res.loadedOn } : m))
        );
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to toggle model state");
    } finally {
      setLoadingModelId(null);
    }
  };

  // Set Active Receptionist Voice
  const handleSetReceptionistVoice = async (voiceId: string) => {
    try {
      await setReceptionistOpenSourceVoice(voiceId);
      setActiveReceptionistVoice(voiceId);
      setVoices((prev) =>
        prev.map((v) => ({ ...v, isReceptionistActive: v.id === voiceId }))
      );
    } catch {
      alert("Failed to update receptionist voice");
    }
  };

  // Quick Voice Preview / Synthesize
  const handlePreviewVoice = async (voice: OpenSourceVoiceProfile) => {
    setIsLoading(true);
    try {
      const sampleText =
        voice.gender === "female"
          ? "నమస్కారం! మారుతి టెక్నాలజీస్‌కి స్వాగతం. నేను మీకు ఏ కోర్సు వివరాలు అందించగలను?"
          : "నమస్కారం! నేను మీ మారుతి టెక్నాలజీస్ కెరీర్ కౌన్సెలర్‌ను. మీకు పైథాన్ లేదా జావా కోర్సు కావాలా?";

      const res = await synthesizeOpenSource({
        modelId: voice.modelId,
        voiceId: voice.id,
        text: sampleText,
        speed: voice.speed,
        pitch: voice.defaultPitch,
        performanceMode,
        hasReferenceConsent: true,
      });

      setLastSynthesis(res);
      handlePlayAudio(res.audioUrl);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setIsLoading(false);
    }
  };

  // Run Benchmark Test
  const handleRunBenchmark = async () => {
    const item = STANDARD_BENCHMARK_ITEMS.find((b) => b.id === selectedBenchmarkId);
    const textToRun = selectedBenchmarkId === "custom" ? customBenchmarkText : item?.text;

    if (!textToRun || !textToRun.trim()) {
      alert("Please enter a text prompt to benchmark.");
      return;
    }

    setIsBenchmarking(true);
    try {
      const res = await synthesizeOpenSource({
        modelId: selectedModelId,
        voiceId: selectedVoiceId,
        text: textToRun,
        performanceMode,
        hasReferenceConsent: true,
      });

      setLastSynthesis(res);
      handlePlayAudio(res.audioUrl);

      // Create scorecard
      const newScore: BenchmarkScore = {
        id: `bench-score-${Date.now()}`,
        modelId: selectedModelId,
        voiceId: selectedVoiceId,
        benchmarkId: selectedBenchmarkId,
        promptText: textToRun,
        audioUrl: res.audioUrl,
        timestamp: Date.now(),
        metrics: {
          ttfaMs: res.ttfaMs,
          totalGenTimeMs: res.generationTimeMs,
          audioDurationSec: res.audioDurationSec,
          rtf: res.realTimeFactor,
          charPerSec: res.charsPerSecond,
          sampleRate: res.sampleRate,
          device: res.deviceUsed,
          memoryUsedMb: selectedModelId === "pocket-tts-telugu" ? 145 : 1800,
        },
        humanRatings,
      };

      await submitBenchmarkScore(newScore);
      setBenchmarkScores((prev) => [newScore, ...prev]);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Benchmark synthesis failed");
    } finally {
      setIsBenchmarking(false);
    }
  };

  // Run Blind Compare Test
  const handleRunCompareTest = async () => {
    if (!compareSentence.trim()) return;
    setIsGeneratingCompare(true);
    setBlindRevealed(false);

    try {
      const [resA, resB, resC] = await Promise.all([
        synthesizeOpenSource({
          modelId: "indic-parler",
          voiceId: "os-parler-lalitha",
          text: compareSentence,
          hasReferenceConsent: true,
        }),
        synthesizeOpenSource({
          modelId: "pocket-tts-telugu",
          voiceId: "os-pocket-syspin",
          text: compareSentence,
          hasReferenceConsent: true,
        }),
        synthesizeOpenSource({
          modelId: "indic-f5",
          voiceId: "os-f5-reference",
          text: compareSentence,
          hasReferenceConsent: true,
        }),
      ]);

      setBlindResults({
        voiceA: { ...resA, label: "Voice A" },
        voiceB: { ...resB, label: "Voice B" },
        voiceC: { ...resC, label: "Voice C" },
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Comparison generation failed");
    } finally {
      setIsGeneratingCompare(false);
    }
  };

  // Realtime VAD and Microphone Duplex
  const handleToggleMic = async () => {
    if (isVADActive) {
      if (vadRef.current) {
        vadRef.current.stopListening();
        vadRef.current = null;
      }
      setIsVADActive(false);
      setRealtimeStatus("ready");
      setMicVolume(0);
    } else {
      vadRef.current = new BrowserVAD({
        onSpeechStart: () => {
          setRealtimeStatus("listening");
        },
        onSpeechEnd: () => {
          // In real duplex, speechEnd triggers STT -> LLM turn
          setRealtimeStatus("thinking");
        },
        onInterruption: () => {
          // BARGE-IN: Customer spoke while AI was speaking!
          stopCurrentAudioPlayback();
          setCurrentlyPlayingUrl(null);
          setRealtimeStatus("interrupted");
          setTimeout(() => {
            setRealtimeStatus("listening");
          }, 300);
        },
        onVolumeChange: (rms) => {
          setMicVolume(Math.min(100, Math.round(rms * 400)));
        },
      });

      const ok = await vadRef.current.startListening();
      if (ok) {
        setIsVADActive(true);
        setRealtimeStatus("ready");
      } else {
        alert("Microphone access is required for real-time duplex voice test.");
      }
    }
  };

  // Realtime Turn-Taking Handler
  const handleSendRealtimeTurn = async (userText: string) => {
    if (!userText.trim()) return;
    const cleanUserText = userText.trim();
    setManualInputText("");

    // Add user turn to timeline
    const userTurnId = `turn-${Date.now()}`;
    setConversationHistory((prev) => [
      ...prev,
      { id: userTurnId, role: "user", text: cleanUserText, timestamp: Date.now() },
    ]);

    setRealtimeStatus("thinking");

    try {
      const turn = await executeRealtimeTurn(
        cleanUserText,
        conversationHistory.map((h) => ({ role: h.role, text: h.text })),
        selectedModelId,
        selectedVoiceId
      );

      setConversationHistory((prev) => [
        ...prev,
        {
          id: `turn-${Date.now()}-ai`,
          role: "receptionist",
          text: turn.replyText,
          audioUrl: turn.audioUrl,
          durationSec: turn.durationSec,
          rtf: turn.rtf,
          timestamp: Date.now(),
        },
      ]);

      handlePlayAudio(turn.audioUrl);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Conversation turn failed");
      setRealtimeStatus("ready");
    }
  };

  // Pronunciation Dictionary Handlers
  const handleAddPronunciation = async () => {
    if (!newWord.trim() || !newPronunciation.trim()) return;
    try {
      const entry = await savePronunciationEntry({
        word: newWord.trim(),
        pronunciation: newPronunciation.trim(),
        category: newCategory,
        language: "all",
      });
      setDictionary((prev) => [entry, ...prev]);
      setNewWord("");
      setNewPronunciation("");
    } catch {
      alert("Failed to save entry");
    }
  };

  const handleDeletePronunciation = async (id: string) => {
    try {
      await deletePronunciationEntry(id);
      setDictionary((prev) => prev.filter((d) => d.id !== id));
    } catch {
      alert("Failed to delete entry");
    }
  };

  const filteredBenchmarkItems = useMemo(() => {
    if (selectedBenchmarkCategory === "all") return STANDARD_BENCHMARK_ITEMS;
    return STANDARD_BENCHMARK_ITEMS.filter((b) => b.category === selectedBenchmarkCategory);
  }, [selectedBenchmarkCategory]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20">
      {/* 1. Header Banner & Section Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-30 px-4 py-4 sm:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-emerald-500/20 text-emerald-400 font-black text-xs ring-1 ring-emerald-500/30">
                OS
              </span>
              <h1 className="text-xl font-black text-white tracking-tight">Open-Source Telugu Voice Lab</h1>
              <span className="rounded-md bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold tracking-wider text-indigo-300 ring-1 ring-inset ring-indigo-500/30">
                SELF-HOSTED / API-FREE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Zero commercial API dependencies • IndicF5, Indic Parler-TTS & Pocket Telugu • Conversational Telephony
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Offline Mode Indicator */}
            <div
              onClick={() => setOfflineMode(!offlineMode)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 text-xs font-semibold cursor-pointer hover:border-slate-600 transition"
              title="Self-contained local offline mode (No external API calls)"
            >
              <span className={`h-2 w-2 rounded-full ${offlineMode ? "bg-emerald-400" : "bg-amber-400"}`} />
              <span className="text-slate-300">Mode:</span>
              <span className={offlineMode ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                {offlineMode ? "Offline (Local)" : "Online"}
              </span>
            </div>

            {/* Performance Mode Selector */}
            <div className="flex items-center rounded-lg border border-slate-700 bg-slate-800/80 p-0.5 text-xs font-semibold">
              {(["quality", "balanced", "realtime"] as PerformanceMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPerformanceMode(mode)}
                  className={`px-2 py-1 rounded-md transition capitalize text-[11px] ${
                    performanceMode === mode
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            {/* Link to Realtime Voice Agents */}
            <Link
              to="/voice-agents"
              className="flex items-center gap-1.5 text-xs font-bold text-purple-300 hover:text-purple-200 border border-purple-500/40 rounded-lg px-3 py-1.5 bg-purple-950/40 shadow-xs transition"
            >
              <span>🎙</span>
              <span>Realtime Voice Agents</span>
            </Link>

            {/* Link back to Commercial Voice Studio */}
            <Link
              to="/voice/lab"
              className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-indigo-400 border border-slate-800 rounded-lg px-3 py-1.5 bg-slate-900 transition"
            >
              <span>Commercial Voices</span>
              <span>→</span>
            </Link>
          </div>
        </div>

        {/* System Telemetry Bar */}
        {hardware && (
          <div className="max-w-7xl mx-auto mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
            <div className="flex flex-wrap items-center gap-4">
              <span>
                CPU: <strong className="text-slate-200">{hardware.cpuCores} Cores</strong>
              </span>
              <span>
                RAM: <strong className="text-slate-200">{hardware.usedRamGb} / {hardware.totalRamGb} GB</strong> ({hardware.ramUsagePercent}%)
              </span>
              <span>
                GPU: <strong className={hardware.cudaAvailable ? "text-emerald-400" : "text-amber-400"}>
                  {hardware.cudaAvailable ? `CUDA ${hardware.cudaVersion || "Active"}` : "CPU AVX2 Acceleration"}
                </strong>
              </span>
              <span>
                Active Receptionist Voice:{" "}
                <strong className="text-indigo-400">
                  {voices.find((v) => v.id === activeReceptionistVoice)?.name || "Lalitha"}
                </strong>
              </span>
            </div>

            <div className="text-slate-500">
              Target Codec: <strong>24 kHz PCM / Mono</strong>
            </div>
          </div>
        )}
      </header>

      {/* 2. Navigation Tabs */}
      <div className="border-b border-slate-800 bg-slate-900/40 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto flex overflow-x-auto space-x-1 sm:space-x-2 py-2">
          {[
            { id: "models", label: "Models Manager", icon: "📦" },
            { id: "voices", label: "Voice Cards", icon: "🎙" },
            { id: "compare", label: "Blind Voice Test", icon: "⚖" },
            { id: "benchmark", label: "Standard Benchmark", icon: "📊" },
            { id: "realtime", label: "Duplex Conversation", icon: "⚡" },
            { id: "settings", label: "Dictionary & Engine", icon: "⚙" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as ActiveTab)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "text-slate-400 hover:bg-slate-800/80 hover:text-slate-200"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-6">
        {/* ==================================================================== */}
        {/* TAB 1: MODELS MANAGER                                                */}
        {/* ==================================================================== */}
        {activeTab === "models" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white">Self-Hosted Open-Source Models</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Load, unload, and monitor local memory footprint. Only keep active models loaded to respect system VRAM/RAM limits.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {models.map((model) => {
                const isLoaded = model.status === "loaded";
                const isBusy = loadingModelId === model.id;

                return (
                  <div
                    key={model.id}
                    className={`rounded-2xl border p-5 transition flex flex-col justify-between ${
                      isLoaded
                        ? "border-emerald-500/40 bg-slate-900/90 ring-1 ring-emerald-500/20"
                        : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
                    }`}
                  >
                    <div>
                      {/* Top Header */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm text-white">{model.name}</h3>
                            <span className="text-[10px] rounded bg-slate-800 px-1.5 py-0.5 text-slate-400 font-mono">
                              {model.version}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">{model.author}</p>
                        </div>

                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            isLoaded
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "bg-slate-800 text-slate-400 border border-slate-700"
                          }`}
                        >
                          {model.status.replace("_", " ")}
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed mb-4">{model.description}</p>

                      {/* Technical Specs Bento */}
                      <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 mb-4">
                        <div>
                          <span className="text-slate-500">Architecture:</span>
                          <p className="font-semibold text-slate-200">{model.architecture}</p>
                        </div>
                        <div>
                          <span className="text-slate-500">Model Size:</span>
                          <p className="font-semibold text-slate-200">{model.modelSize}</p>
                        </div>
                        <div>
                          <span className="text-slate-500">Required RAM:</span>
                          <p className="font-semibold text-slate-200">{model.requiredRamGb} GB</p>
                        </div>
                        <div>
                          <span className="text-slate-500">License:</span>
                          <p className="font-semibold text-indigo-400 truncate">{model.license}</p>
                        </div>
                      </div>

                      {/* Commercial Use Status */}
                      <div className="flex items-center justify-between text-[11px] px-1 mb-4 text-slate-400">
                        <span>Commercial Status:</span>
                        <span className="font-semibold text-emerald-400">{model.commercialUse}</span>
                      </div>
                    </div>

                    {/* Bottom Controls */}
                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <a
                        href={model.huggingFaceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-slate-400 hover:text-indigo-400 transition underline underline-offset-2"
                      >
                        HuggingFace ↗
                      </a>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleToggleLoadModel(model, hardware?.cudaAvailable ? "cuda" : "cpu")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                            isLoaded
                              ? "bg-slate-800 text-slate-300 hover:bg-rose-950 hover:text-rose-300 border border-slate-700"
                              : "bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm"
                          } disabled:opacity-50`}
                        >
                          {isBusy ? "Processing..." : isLoaded ? "Unload" : "Load Model"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Future Model Plugin Box */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-white">Extensible OpenSourceTTSProvider Plugin System</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Future open-source models (e.g. Meta MMS, Bark, Kokoro) can be dropped in via the <code>OpenSourceTTSProvider</code> TypeScript interface without UI modifications.
                </p>
              </div>
              <span className="text-xs text-indigo-400 font-mono bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/20">
                plugin_ready: true
              </span>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 2: VOICE CARDS                                                   */}
        {/* ==================================================================== */}
        {activeTab === "voices" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white">Open-Source Telugu Voice Profiles</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Native Telugu speakers with human cadence, authentic phonology, and conversational receptionist intonation.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {voices.map((voice) => {
                const isActive = activeReceptionistVoice === voice.id;
                const isSelected = selectedVoiceId === voice.id;

                return (
                  <div
                    key={voice.id}
                    onClick={() => {
                      setSelectedVoiceId(voice.id);
                      setSelectedModelId(voice.modelId);
                    }}
                    className={`rounded-2xl border p-5 transition cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? "border-indigo-500 bg-slate-900/90 ring-1 ring-indigo-500/30"
                        : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
                    }`}
                  >
                    <div>
                      {/* Top Header */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-base text-white">{voice.name}</h3>
                            {isActive && (
                              <span className="rounded-full bg-emerald-500/20 text-emerald-400 px-2 py-0.5 text-[9px] font-bold border border-emerald-500/30">
                                RECEPTIONIST VOICE
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-indigo-400 font-medium">{voice.qualityProfile}</p>
                        </div>

                        <span className="text-[11px] font-semibold text-slate-400 rounded-lg bg-slate-800 px-2 py-0.5">
                          {voice.gender === "female" ? "♀ Female" : "♂ Male"}
                        </span>
                      </div>

                      {/* Conditioning Prompt / Description */}
                      {voice.voiceDescriptionPrompt ? (
                        <div className="rounded-xl bg-slate-950/80 p-3 text-[11px] text-slate-300 italic border border-slate-800 mb-4 leading-relaxed">
                          "{voice.voiceDescriptionPrompt}"
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 mb-4">
                          {voice.requiresReference
                            ? "Diffusion voice cloning using high-quality reference audio and transcript."
                            : "Low-latency CPU optimized voice for instantaneous live phone calls."}
                        </p>
                      )}

                      {/* Technical Specs */}
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 mb-4">
                        <div>
                          <span>Model Engine:</span>
                          <p className="font-semibold text-slate-200">{voice.modelId}</p>
                        </div>
                        <div>
                          <span>Expected Latency:</span>
                          <p className="font-semibold text-emerald-400">{voice.expectedLatencyMs} ms</p>
                        </div>
                        <div>
                          <span>Sample Rate:</span>
                          <p className="font-semibold text-slate-200">{voice.sampleRate / 1000} kHz</p>
                        </div>
                        <div>
                          <span>License:</span>
                          <p className="font-semibold text-slate-200">{voice.license}</p>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePreviewVoice(voice);
                        }}
                        disabled={isLoading}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                      >
                        <span>▶ Preview</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSetReceptionistVoice(voice.id);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                          isActive
                            ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-400"
                            : "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                        }`}
                      >
                        {isActive ? "✓ Selected for AI" : "Use for Receptionist"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Reference Audio Upload Consent Warning */}
            <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-5 flex items-start gap-4">
              <span className="text-xl">⚠️</span>
              <div>
                <h4 className="font-bold text-sm text-amber-300">Voice Cloning & Reference Recording Policy</h4>
                <p className="text-xs text-amber-200/80 mt-1 leading-relaxed">
                  Only use voice recordings for which you have explicit legal permission. The system strictly prohibits unauthorized celebrity or third-party impersonation.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 3: BLIND VOICE TEST (COMPARE)                                    */}
        {/* ==================================================================== */}
        {activeTab === "compare" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white">Blind Voice Comparison Test</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Listen to the exact same sentence generated across three open models without bias. Rate naturalness and conversational warmth, then reveal model identities.
              </p>
            </div>

            {/* Test Sentence Selector / Input */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Standard Comparison Sentence
              </label>
              <textarea
                rows={2}
                value={compareSentence}
                onChange={(e) => setCompareSentence(e.target.value)}
                className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
              />

              <div className="flex items-center justify-between pt-1">
                <div className="flex gap-2">
                  {[
                    "నమస్కారం! మారుతి టెక్నాలజీస్‌కి కాల్ చేసినందుకు ధన్యవాదాలు.",
                    "Sure, మీకు Python course details కావాలా? Online batch కావాలా లేదా classroom batch కావాలా?",
                    "ఈ కోర్సు ఫీజు నాలుగు వేల రూపాయలు, duration ముప్పై రోజులు.",
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCompareSentence(preset)}
                      className="text-[11px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 transition truncate max-w-[240px]"
                    >
                      Sample {idx + 1}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleRunCompareTest}
                  disabled={isGeneratingCompare}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition flex items-center gap-2 shadow-md shadow-indigo-600/20 disabled:opacity-50"
                >
                  <span>{isGeneratingCompare ? "Generating Audio..." : "▶ Run Blind Generation"}</span>
                </button>
              </div>
            </div>

            {/* Blind Voice Cards Grid */}
            {blindResults.voiceA && blindResults.voiceB && blindResults.voiceC && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {[
                  { key: "A" as const, res: blindResults.voiceA },
                  { key: "B" as const, res: blindResults.voiceB },
                  { key: "C" as const, res: blindResults.voiceC },
                ].map(({ key, res }) => (
                  <div
                    key={key}
                    className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="h-8 w-8 rounded-xl bg-indigo-600/20 text-indigo-400 font-black text-sm flex items-center justify-center border border-indigo-500/30">
                          {key}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          RTF: <strong>{res.realTimeFactor}</strong>
                        </span>
                      </div>

                      {/* Playback Button */}
                      <button
                        type="button"
                        onClick={() => handlePlayAudio(res.audioUrl)}
                        className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition flex items-center justify-center gap-2 mb-4 shadow-sm"
                      >
                        <span>▶ Play {res.label}</span>
                      </button>

                      {/* Subjective Rating Sliders */}
                      <div className="space-y-2.5 text-xs text-slate-300">
                        <div>
                          <div className="flex justify-between text-[11px] mb-1">
                            <span>Naturalness:</span>
                            <span className="font-bold text-indigo-400">{blindRatings[key].naturalness} / 5</span>
                          </div>
                          <input
                            type="range"
                            min="1"
                            max="5"
                            value={blindRatings[key].naturalness}
                            onChange={(e) =>
                              setBlindRatings((prev) => ({
                                ...prev,
                                [key]: { ...prev[key], naturalness: parseInt(e.target.value, 10) },
                              }))
                            }
                            className="w-full accent-indigo-500"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between text-[11px] mb-1">
                            <span>Telugu Pronunciation:</span>
                            <span className="font-bold text-indigo-400">{blindRatings[key].pronunciation} / 5</span>
                          </div>
                          <input
                            type="range"
                            min="1"
                            max="5"
                            value={blindRatings[key].pronunciation}
                            onChange={(e) =>
                              setBlindRatings((prev) => ({
                                ...prev,
                                [key]: { ...prev[key], pronunciation: parseInt(e.target.value, 10) },
                              }))
                            }
                            className="w-full accent-indigo-500"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between text-[11px] mb-1">
                            <span>Conversational Warmth:</span>
                            <span className="font-bold text-indigo-400">{blindRatings[key].conversational} / 5</span>
                          </div>
                          <input
                            type="range"
                            min="1"
                            max="5"
                            value={blindRatings[key].conversational}
                            onChange={(e) =>
                              setBlindRatings((prev) => ({
                                ...prev,
                                [key]: { ...prev[key], conversational: parseInt(e.target.value, 10) },
                              }))
                            }
                            className="w-full accent-indigo-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Revealed Identity */}
                    <div className="pt-4 border-t border-slate-800 mt-4">
                      {blindRevealed ? (
                        <div className="rounded-xl bg-slate-950 p-3 border border-indigo-500/30">
                          <p className="text-[10px] uppercase font-bold text-indigo-400">Revealed Model:</p>
                          <p className="font-bold text-sm text-white">{res.modelId}</p>
                          <p className="text-[11px] text-slate-400">{res.voiceId}</p>
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-500 text-center italic">Identity hidden for blind evaluation</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {blindResults.voiceA && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={() => setBlindRevealed(!blindRevealed)}
                  className="px-6 py-2.5 rounded-xl border border-indigo-500/40 bg-indigo-950/40 hover:bg-indigo-900/60 text-indigo-300 font-bold text-xs transition"
                >
                  {blindRevealed ? "Hide Identities" : "🔍 Reveal Model Identities"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 4: BENCHMARK SUITE                                               */}
        {/* ==================================================================== */}
        {activeTab === "benchmark" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white">Objective & Human Benchmarking Suite</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Every open model executes the exact same benchmark prompts. Technical latency (TTFA, RTF) is measured alongside human naturalness ratings.
              </p>
            </div>

            {/* Benchmark Configuration & Prompts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Left Column: Prompt Selector */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Test Sentences</h3>
                  {/* Category Pills */}
                  <div className="flex gap-1">
                    {[
                      { id: "all", label: "All" },
                      { id: "pure_telugu", label: "Pure" },
                      { id: "code_mixing", label: "Code-Mix" },
                      { id: "numbers_currency", label: "Numbers" },
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedBenchmarkCategory(cat.id)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          selectedBenchmarkCategory === cat.id
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-800 text-slate-400 hover:text-white"
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {filteredBenchmarkItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedBenchmarkId(item.id)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition ${
                        selectedBenchmarkId === item.id
                          ? "border-indigo-500 bg-indigo-950/30 text-white"
                          : "border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-200">{item.title}</span>
                        <span className="text-[10px] text-indigo-400 capitalize">{item.category.replace("_", " ")}</span>
                      </div>
                      <p className="line-clamp-2 text-slate-300">{item.text}</p>
                    </div>
                  ))}

                  {/* Custom Test Option */}
                  <div
                    onClick={() => setSelectedBenchmarkId("custom")}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition ${
                      selectedBenchmarkId === "custom"
                        ? "border-indigo-500 bg-indigo-950/30 text-white"
                        : "border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <span className="font-bold text-slate-200 block mb-1">✍ Custom Prompt</span>
                    <textarea
                      rows={2}
                      placeholder="Type custom Telugu text..."
                      value={customBenchmarkText}
                      onChange={(e) => setCustomBenchmarkText(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Middle Column: Model Selection & Execution */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Model & Engine Targets</h3>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Target Model:</label>
                  <select
                    value={selectedModelId}
                    onChange={(e) => setSelectedModelId(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-xs text-white"
                  >
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.architecture})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Speaker Voice:</label>
                  <select
                    value={selectedVoiceId}
                    onChange={(e) => setSelectedVoiceId(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-xs text-white"
                  >
                    {voices.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} - {v.qualityProfile}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleRunBenchmark}
                  disabled={isBenchmarking}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 disabled:opacity-50"
                >
                  <span>{isBenchmarking ? "Synthesizing Benchmark..." : "⚡ Run Benchmark Test"}</span>
                </button>

                {/* Last Result Telemetry */}
                {lastSynthesis && (
                  <div className="rounded-xl bg-slate-950 border border-slate-800 p-3 space-y-2 text-xs">
                    <p className="text-[10px] font-bold text-indigo-400 uppercase">Live Technical Telemetry</p>
                    <div className="grid grid-cols-2 gap-2 text-slate-300">
                      <div>
                        <span className="text-slate-500">TTFA:</span>
                        <p className="font-bold text-white">{lastSynthesis.ttfaMs} ms</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Total Latency:</span>
                        <p className="font-bold text-white">{lastSynthesis.generationTimeMs} ms</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Audio Duration:</span>
                        <p className="font-bold text-white">{lastSynthesis.audioDurationSec} s</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Real-Time Factor:</span>
                        <p className={`font-bold ${lastSynthesis.realTimeFactor < 1 ? "text-emerald-400" : "text-amber-400"}`}>
                          {lastSynthesis.realTimeFactor} (RTF)
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Human Subjective Rating */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Subjective Human Scoring (1-5)</h3>

                <div className="space-y-2 text-xs">
                  {[
                    { key: "naturalness" as const, label: "Naturalness" },
                    { key: "pronunciation" as const, label: "Telugu Pronunciation" },
                    { key: "conversational" as const, label: "Conversational Turn" },
                    { key: "codeMixing" as const, label: "Telugu-English Mixing" },
                    { key: "clarity" as const, label: "Intelligibility & Clarity" },
                    { key: "overall" as const, label: "Overall Human Quality" },
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <div className="flex justify-between text-[11px] mb-0.5">
                        <span className="text-slate-400">{label}:</span>
                        <span className="font-bold text-indigo-400">{humanRatings[key]} / 5</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="5"
                        value={humanRatings[key]}
                        onChange={(e) =>
                          setHumanRatings((prev) => ({ ...prev, [key]: parseInt(e.target.value, 10) }))
                        }
                        className="w-full accent-indigo-500"
                      />
                    </div>
                  ))}

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Human Notes:</label>
                    <input
                      type="text"
                      placeholder="e.g. Authentic AP dialect cadence, natural sentence ending..."
                      value={humanRatings.notes}
                      onChange={(e) => setHumanRatings((prev) => ({ ...prev, notes: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Historic Scorecard Table */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
              <h3 className="text-sm font-bold text-white mb-3">Benchmark Scorecards Log</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="border-b border-slate-800 text-[10px] text-slate-400 uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Model</th>
                      <th className="py-2.5 px-3">Voice</th>
                      <th className="py-2.5 px-3">Prompt</th>
                      <th className="py-2.5 px-3">TTFA</th>
                      <th className="py-2.5 px-3">RTF</th>
                      <th className="py-2.5 px-3">Human Score</th>
                      <th className="py-2.5 px-3">Playback</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {benchmarkScores.slice(0, 8).map((score) => (
                      <tr key={score.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-2.5 px-3 font-bold text-white">{score.modelId}</td>
                        <td className="py-2.5 px-3 text-slate-400">{score.voiceId}</td>
                        <td className="py-2.5 px-3 max-w-xs truncate">{score.promptText}</td>
                        <td className="py-2.5 px-3 font-mono">{score.metrics.ttfaMs} ms</td>
                        <td className="py-2.5 px-3 font-mono text-emerald-400">{score.metrics.rtf}</td>
                        <td className="py-2.5 px-3">
                          <span className="rounded bg-indigo-500/20 text-indigo-300 px-2 py-0.5 font-bold">
                            {score.humanRatings?.overall || 5} / 5
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <button
                            type="button"
                            onClick={() => handlePlayAudio(score.audioUrl)}
                            className="text-xs text-indigo-400 hover:text-indigo-300 underline font-bold"
                          >
                            Play
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 5: REALTIME DUPLEX & BARGE-IN INTERRUPT                          */}
        {/* ==================================================================== */}
        {activeTab === "realtime" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white">Talk to Open-Source AI Receptionist</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Full-duplex conversation with Voice Activity Detection (VAD) and immediate customer Barge-In. Start speaking while the receptionist is talking to test instant speech interruption.
              </p>
            </div>

            {/* Duplex Controls & State HUD */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
              {/* State Indicator */}
              <div className="flex items-center gap-4">
                <div
                  className={`h-14 w-14 rounded-2xl flex items-center justify-center text-xl font-bold transition shadow-lg ${
                    realtimeStatus === "speaking"
                      ? "bg-emerald-600 text-white animate-pulse"
                      : realtimeStatus === "listening"
                      ? "bg-indigo-600 text-white animate-bounce"
                      : realtimeStatus === "interrupted"
                      ? "bg-rose-600 text-white"
                      : realtimeStatus === "thinking"
                      ? "bg-amber-600 text-white animate-spin"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {realtimeStatus === "speaking"
                    ? "🗣"
                    : realtimeStatus === "listening"
                    ? "🎤"
                    : realtimeStatus === "interrupted"
                    ? "🛑"
                    : realtimeStatus === "thinking"
                    ? "⚙"
                    : "Ready"}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-wider text-slate-400 font-bold">System Status:</span>
                    <span
                      className={`font-black text-sm uppercase ${
                        realtimeStatus === "speaking"
                          ? "text-emerald-400"
                          : realtimeStatus === "listening"
                          ? "text-indigo-400"
                          : realtimeStatus === "interrupted"
                          ? "text-rose-400 font-black"
                          : realtimeStatus === "thinking"
                          ? "text-amber-400"
                          : "text-slate-300"
                      }`}
                    >
                      {realtimeStatus}...
                    </span>
                  </div>

                  {realtimeStatus === "interrupted" && (
                    <p className="text-xs font-bold text-rose-400 mt-0.5">
                      Barge-In Active: Receptionist audio playback stopped immediately because customer spoke.
                    </p>
                  )}

                  {/* Volume Level Bar */}
                  {isVADActive && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[10px] text-slate-500">Mic VAD:</span>
                      <div className="h-2 w-36 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className="h-full bg-emerald-500 transition-all duration-75"
                          style={{ width: `${micVolume}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleToggleMic}
                  className={`px-5 py-3 rounded-xl font-bold text-xs transition flex items-center gap-2 shadow-md ${
                    isVADActive
                      ? "bg-rose-600 hover:bg-rose-500 text-white"
                      : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30"
                  }`}
                >
                  <span>{isVADActive ? "⏹ Stop Microphone" : "🎙 Start Voice Conversation"}</span>
                </button>
              </div>
            </div>

            {/* Conversation Timeline */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Conversational Turn History</h3>

              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-2">
                {conversationHistory.map((turn) => (
                  <div
                    key={turn.id}
                    className={`flex flex-col ${turn.role === "user" ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-xl rounded-2xl p-4 text-xs leading-relaxed ${
                        turn.role === "user"
                          ? "bg-indigo-600 text-white rounded-br-none"
                          : "bg-slate-900 border border-slate-800 text-slate-100 rounded-bl-none shadow-md"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4 mb-1 text-[10px] opacity-80">
                        <span className="font-bold">{turn.role === "user" ? "Customer (Telugu)" : "Open-Source AI Receptionist"}</span>
                        {turn.rtf && <span>RTF: {turn.rtf}</span>}
                      </div>
                      <p className="font-medium text-sm">{turn.text}</p>

                      {turn.audioUrl && (
                        <button
                          type="button"
                          onClick={() => handlePlayAudio(turn.audioUrl!)}
                          className="mt-2 text-[11px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                        >
                          <span>▶ Replay Audio</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Manual Input / Test Fallback */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Type a Telugu message (e.g. Python course fee ఎంత? or online batch timings చెప్తారా?)..."
                  value={manualInputText}
                  onChange={(e) => setManualInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSendRealtimeTurn(manualInputText);
                  }}
                  className="flex-1 rounded-xl bg-slate-950 border border-slate-800 px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => handleSendRealtimeTurn(manualInputText)}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition"
                >
                  Send Turn
                </button>
              </div>

              {/* Quick Conversational Prompts */}
              <div className="flex flex-wrap gap-2 pt-1 text-[11px]">
                {[
                  "Python course గురించి తెలుసుకోవాలి",
                  "ఆన్‌లైన్ బ్యాచ్ ఉందా లేదా క్లాస్‌రూమ్ బ్యాచ్ మాత్రమేనా?",
                  "కోర్స్ ఫీజు మరియు డ్యూరేషన్ ఎంత?",
                  "నాకు కౌన్సెలర్ తో మాట్లాడాలని ఉంది",
                ].map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendRealtimeTurn(prompt)}
                    className="rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1 transition"
                  >
                    "{prompt}"
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 6: SETTINGS & PRONUNCIATION DICTIONARY                           */}
        {/* ==================================================================== */}
        {activeTab === "settings" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white">Telugu Speech Normalization & Pronunciation Dictionary</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                All raw text passes through <code>SpeechResponsePlanner</code> to expand numbers, convert ₹ currency to Telugu words, and preserve code mixing.
              </p>
            </div>

            {/* Interactive Speech Normalizer Preview */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Live Speech Normalizer Pipeline Tester
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Raw Input Text (LLM / Agent):</label>
                  <textarea
                    rows={3}
                    value={normTestInput}
                    onChange={(e) => setNormTestInput(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Normalized Spoken Telugu:</label>
                  <div className="w-full rounded-xl bg-slate-950/80 border border-slate-800/80 p-3 text-xs text-emerald-300 min-h-[72px] leading-relaxed">
                    {normTestOutput || "Click test to view spoken normalization..."}
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={async () => {
                    const res = await synthesizeOpenSource({
                      modelId: selectedModelId,
                      voiceId: selectedVoiceId,
                      text: normTestInput,
                      hasReferenceConsent: true,
                    });
                    setNormTestOutput(res.normalizedText);
                    handlePlayAudio(res.audioUrl);
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition"
                >
                  ⚡ Normalize & Listen
                </button>
              </div>
            </div>

            {/* Custom Pronunciation Dictionary Table */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">
                  Custom Pronunciation Dictionary (<code>pronunciation_dictionary.json</code>)
                </h3>
                <span className="text-xs text-slate-400">{dictionary.length} active entries</span>
              </div>

              {/* Add New Entry Row */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <input
                  type="text"
                  placeholder="Source word (e.g. Docker)"
                  value={newWord}
                  onChange={(e) => setNewWord(e.target.value)}
                  className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white"
                />
                <input
                  type="text"
                  placeholder="Spoken Telugu (e.g. డాకర్)"
                  value={newPronunciation}
                  onChange={(e) => setNewPronunciation(e.target.value)}
                  className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white"
                />
                <select
                  value={newCategory}
                  onChange={(e) =>
                    setNewCategory(
                      e.target.value as
                        | "brand"
                        | "technical"
                        | "currency"
                        | "timing"
                        | "location"
                        | "custom"
                    )
                  }
                  className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white"
                >
                  <option value="technical">Technical</option>
                  <option value="brand">Brand</option>
                  <option value="location">Location</option>
                  <option value="custom">Custom</option>
                </select>
                <button
                  type="button"
                  onClick={handleAddPronunciation}
                  className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2 transition"
                >
                  + Add Pronunciation
                </button>
              </div>

              {/* Dictionary List */}
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="border-b border-slate-800 text-[10px] text-slate-400 uppercase">
                    <tr>
                      <th className="py-2 px-3">Word</th>
                      <th className="py-2 px-3">Pronunciation (Telugu)</th>
                      <th className="py-2 px-3">Category</th>
                      <th className="py-2 px-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {dictionary.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-800/30">
                        <td className="py-2.5 px-3 font-bold text-white">{entry.word}</td>
                        <td className="py-2.5 px-3 font-semibold text-emerald-400">{entry.pronunciation}</td>
                        <td className="py-2.5 px-3 capitalize text-slate-400">{entry.category}</td>
                        <td className="py-2.5 px-3">
                          <button
                            type="button"
                            onClick={() => handleDeletePronunciation(entry.id)}
                            className="text-xs text-rose-400 hover:text-rose-300 font-bold"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
