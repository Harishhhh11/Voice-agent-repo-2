/**
 * Open-Source Telugu Voice AI Lab Types & Interfaces
 */

export type ModelId = "indic-f5" | "indic-parler" | "pocket-tts-telugu" | string;

export type ModelStatus = "not_downloaded" | "downloaded" | "loading" | "loaded" | "error";

export type PerformanceMode = "quality" | "balanced" | "realtime";

export type DeviceType = "cuda" | "cpu";

export interface HardwareStatus {
  cpu: string;
  cpuCores: number;
  totalRamGb: number;
  freeRamGb: number;
  usedRamGb: number;
  ramUsagePercent: number;
  gpuAvailable: boolean;
  gpuName?: string;
  totalVramGb?: number;
  freeVramGb?: number;
  usedVramGb?: number;
  cudaAvailable: boolean;
  cudaVersion?: string;
  availableDiskGb: number;
  offlineMode: boolean;
}

export interface OpenSourceModelInfo {
  id: ModelId;
  name: string;
  author: string;
  repository: string;
  huggingFaceUrl: string;
  version: string;
  architecture:
    | "Diffusion Transformer"
    | "Autoregressive / Parler"
    | "Lightweight VITS / Pocket"
    | "Multilingual Flow-TTS"
    | "Non-Autoregressive FastSpeech"
    | "Zero-Shot Acoustic Diffusion";
  status: ModelStatus;
  loadedOnDevice?: DeviceType;
  modelSize: string;
  downloadSize: string;
  diskRequirement: string;
  requiredRamGb: number;
  recommendedVramGb: number;
  license: string;
  licenseUrl: string;
  commercialUse: "Permitted" | "Research / Non-Commercial" | "Attribution Required";
  requiresReferenceAudio: boolean;
  targetSampleRate: number; // e.g. 24000
  supportedLanguages: string[];
  description: string;
  notes: string;
}

export interface OpenSourceVoiceProfile {
  id: string;
  modelId: ModelId;
  name: string;
  nativeName: string;
  gender: "male" | "female";
  language: string;
  qualityProfile: "Studio Ultra-Natural" | "High-Fidelity Conversational" | "Low-Latency Real-Time";
  speed: number;
  defaultPitch: number;
  expectedLatencyMs: number;
  deviceTarget: DeviceType;
  sampleRate: number;
  license: string;
  requiresReference: boolean;
  voiceDescriptionPrompt?: string; // for Parler natural-language conditioning
  isFavorite?: boolean;
  isReceptionistActive?: boolean;
}

export interface SynthesisRequest {
  modelId: ModelId;
  voiceId: string;
  text: string;
  speed?: number;
  pitch?: number;
  performanceMode?: PerformanceMode;
  stylePrompt?: string;
  referenceAudioBase64?: string;
  referenceTranscript?: string;
  hasReferenceConsent?: boolean;
  telephoneMode?: boolean;
}

export interface SynthesisResponse {
  audioUrl: string;
  modelId: ModelId;
  voiceId: string;
  normalizedText: string;
  rawText: string;
  audioDurationSec: number;
  generationTimeMs: number;
  ttfaMs: number;
  realTimeFactor: number; // generationTimeSec / audioDurationSec
  sampleRate: number;
  deviceUsed: DeviceType;
  charsPerSecond: number;
  cached: boolean;
  timestamp: number;
}

export interface BenchmarkItem {
  id: string;
  category: "pure_telugu" | "code_mixing" | "numbers_currency" | "custom";
  title: string;
  text: string;
  referenceNotes: string;
}

export interface BenchmarkScore {
  id: string;
  modelId: ModelId;
  voiceId: string;
  benchmarkId: string;
  promptText: string;
  audioUrl: string;
  timestamp: number;
  metrics: {
    ttfaMs: number;
    totalGenTimeMs: number;
    audioDurationSec: number;
    rtf: number;
    charPerSec: number;
    sampleRate: number;
    device: DeviceType;
    memoryUsedMb: number;
  };
  humanRatings?: {
    naturalness: number; // 1-5
    pronunciation: number; // 1-5
    conversational: number; // 1-5
    humanLike: number; // 1-5
    codeMixing: number; // 1-5
    emotionalExpression: number; // 1-5
    clarity: number; // 1-5
    overall: number; // 1-5
    notes?: string;
  };
}

export interface PronunciationEntry {
  id: string;
  word: string;
  language: "te" | "en" | "all";
  pronunciation: string;
  category: "brand" | "technical" | "currency" | "timing" | "location" | "custom";
  notes?: string;
  isActive: boolean;
}

export interface BlindTestEvaluation {
  id: string;
  sentence: string;
  voiceA: { modelId: ModelId; voiceId: string; audioUrl: string; rtf: number };
  voiceB: { modelId: ModelId; voiceId: string; audioUrl: string; rtf: number };
  voiceC: { modelId: ModelId; voiceId: string; audioUrl: string; rtf: number };
  scores: Record<"A" | "B" | "C", {
    naturalness: number;
    pronunciation: number;
    humanLike: number;
    conversational: number;
    clarity: number;
    warmth: number;
  }>;
  revealed: boolean;
}

export const STANDARD_BENCHMARK_ITEMS: BenchmarkItem[] = [
  // 1. Pure Telugu Conversational Sentences
  {
    id: "bench-pure-1",
    category: "pure_telugu",
    title: "Receptionist Greeting",
    text: "నమస్కారం! మారుతి టెక్నాలజీస్‌కి కాల్ చేసినందుకు ధన్యవాదాలు. నేను మీకు ఎలా సహాయం చేయగలను?",
    referenceNotes: "Tests formal honorific greeting, brand pronunciation, and helpful conversational inflection.",
  },
  {
    id: "bench-pure-2",
    category: "pure_telugu",
    title: "Course Inquiry & Choice",
    text: "తప్పకుండా. మా పైథాన్ కోర్సు గురించి మీకు పూర్తి వివరాలు చెప్తాను. మీరు ఆన్‌లైన్ బ్యాచ్ కావాలనుకుంటున్నారా లేదా క్లాస్‌రూమ్ బ్యాచ్ కావాలనుకుంటున్నారా?",
    referenceNotes: "Tests natural affirmation pause, technical term articulation, and disjunctive question intonation.",
  },
  {
    id: "bench-pure-3",
    category: "pure_telugu",
    title: "Lead Qualification",
    text: "మీ పేరు చెప్పగలరా? మీకు సరైన కోర్స్ వివరాలు మరియు బ్యాచ్ టైమింగ్స్ చెప్తాను.",
    referenceNotes: "Tests polite identity inquiry with soft conversational cadence.",
  },
  {
    id: "bench-pure-4",
    category: "pure_telugu",
    title: "Wait / Processing State",
    text: "ఒక్క నిమిషం, నేను మీ వివరాలు చెక్ చేసి చెప్తాను.",
    referenceNotes: "Tests short turn-taking pause and natural colloquial rhythm.",
  },
  {
    id: "bench-pure-5",
    category: "pure_telugu",
    title: "Batch Availability Confirmation",
    text: "అవును, ఆ బ్యాచ్ ప్రస్తుతం అందుబాటులో ఉంది.",
    referenceNotes: "Tests decisive affirmation with authentic Telugu pitch decay.",
  },
  {
    id: "bench-pure-6",
    category: "pure_telugu",
    title: "Counselor Escalation",
    text: "మీకు కావాలంటే మా టీమ్ నుంచి ఒక వ్యక్తి మీకు కాల్ చేయడానికి నేను రిక్వెస్ట్ చేయగలను.",
    referenceNotes: "Tests multi-clause prosody without robotic monotone.",
  },

  // 2. Telugu-English Code Mixing (Tanglish)
  {
    id: "bench-code-1",
    category: "code_mixing",
    title: "Code-Mix: Course Details & Batch Mode",
    text: "Sure, మీకు Python course details కావాలా? Online batch కావాలా లేదా classroom batch కావాలా?",
    referenceNotes: "Mandatory test for non-robotic English loanword phonology in Telugu syntax.",
  },
  {
    id: "bench-code-2",
    category: "code_mixing",
    title: "Code-Mix: Contact & Details Share",
    text: "Okay, మీ పేరు మరియు phone number చెప్తారా? నేను మీకు complete course details share చేస్తాను.",
    referenceNotes: "Tests transition between English conversational particles and Telugu verbs.",
  },
  {
    id: "bench-code-3",
    category: "code_mixing",
    title: "Code-Mix: Schedule & Start Date",
    text: "Actually, మా next batch Monday నుంచి start అవుతుంది.",
    referenceNotes: "Tests adverbial opening 'Actually' and calendar entity blending.",
  },
  {
    id: "bench-code-4",
    category: "code_mixing",
    title: "Code-Mix: Online Training Explanation",
    text: "మీకు online training కావాలంటే, నేను complete details explain చేస్తాను.",
    referenceNotes: "Tests natural fluid delivery of corporate IT training vocabulary.",
  },

  // 3. Numbers, Currency, Timings & Phone Numbers
  {
    id: "bench-num-1",
    category: "numbers_currency",
    title: "Currency Expansion (₹4,000)",
    text: "ఈ కోర్సు ఫీజు నాలుగు వేల రూపాయలు.",
    referenceNotes: "Raw text input ₹4,000 normalized to spoken words.",
  },
  {
    id: "bench-num-2",
    category: "numbers_currency",
    title: "Duration (30 days)",
    text: "కోర్స్ duration ముప్పై రోజులు.",
    referenceNotes: "Numeric duration normalized to native Telugu numerals.",
  },
  {
    id: "bench-num-3",
    category: "numbers_currency",
    title: "Time Expansion (10 AM)",
    text: "మా next batch ఉదయం పది గంటలకు start అవుతుంది.",
    referenceNotes: "AM/PM time normalization into regional morning indicator.",
  },
  {
    id: "bench-num-4",
    category: "numbers_currency",
    title: "Phone Digit Grouping",
    text: "మీ phone number చెప్పగలరా?",
    referenceNotes: "Speech cadence for phone number request.",
  },
];
