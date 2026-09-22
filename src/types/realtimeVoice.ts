export type VoiceAgentState =
  | "IDLE"
  | "LISTENING"
  | "THINKING"
  | "SPEAKING"
  | "INTERRUPTED"
  | "WAITING"
  | "TOOL_EXECUTION"
  | "HANDOFF"
  | "ENDING"
  | "ENDED";

export type SupportedLanguage = "te-IN" | "en-IN" | "te-en-hybrid";

export type VoicePersonality =
  | "Professional"
  | "Friendly"
  | "Warm"
  | "Energetic"
  | "Calm"
  | "Premium"
  | "Casual";

export type TTSProviderType = "indic-parler" | "vexyl-tts" | "indic-f5" | "pocket-tts" | "edge-neural" | "gemini-live";

export type LLMProviderType = "ollama" | "openai-compatible" | "gemini-native" | "local-qwen";

export type AudioTransportType = "webrtc" | "livekit" | "sip-asterisk" | "websocket";

export type AudioProfileType = "BROWSER_AUDIO_PROFILE" | "TELEPHONE_AUDIO_PROFILE";

export interface RealtimeVoiceAgentConfig {
  id: string;
  tenantId: string;
  name: string;
  companyName: string;
  tagline?: string;
  language: SupportedLanguage;
  dialect: "hyderabad-telangana" | "andhra-standard" | "neutral-conversational";
  personality: VoicePersonality;
  ttsProvider: TTSProviderType;
  voiceId: string;
  voiceName: string;
  speed: number;
  pitch: number;
  bargeInEnabled: boolean;
  bargeInSensitivity: number; // 0.1 - 1.0 (threshold for interruption detection)
  backchannelFilterEnabled: boolean;
  silenceTimeoutMs: number; // e.g. 1500ms
  thinkingPauseToleranceMs: number; // e.g. 800ms for continuing phrases
  audioProfile: AudioProfileType;
  transport: AudioTransportType;
  llmProvider: LLMProviderType;
  llmModel: string;
  sttModel: string;
  systemPrompt?: string;
  initialGreeting: string;
  workingHours: {
    start: string; // "09:00"
    end: string; // "19:00"
    timezone: string; // "Asia/Kolkata"
    days: string[]; // ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  };
  knowledgeCategories: string[];
  leadCaptureFields: string[];
  humanHandoff: {
    enabled: boolean;
    sipExtension?: string;
    phoneNumber?: string;
    transferKeywords: string[];
    autoTransferOnAngry: boolean;
    autoTransferOnUnansweredCount: number;
  };
  telephonyConfig?: {
    sipServer?: string;
    sipUser?: string;
    livekitUrl?: string;
    livekitApiKey?: string;
    livekitApiSecret?: string;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMemory {
  currentTurn: number;
  callerName?: string;
  callerPhone?: string;
  callerEmail?: string;
  interestedCourse?: string;
  preferredBatch?: "Morning" | "Evening" | "Weekend" | "Online" | "Offline" | string;
  educationBackground?: string;
  budget?: number;
  leadStage: "New" | "Inquiry" | "Qualified" | "Appointment_Booked" | "Follow_Up" | "Handoff";
  appointmentState?: {
    date?: string;
    time?: string;
    mode?: "Online Demo" | "Offline In-Person" | "Counselor Call";
    confirmed?: boolean;
  };
  whatsappRequested?: boolean;
  rollingSummary: string;
  unresolvedQuestions: string[];
  interruptionsCount: number;
  backchannelsIgnoredCount: number;
  sentiment: "Positive" | "Neutral" | "Interested" | "Frustrated" | "Urgent";
}

export interface ConversationMessage {
  id: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  spokenAudioUrl?: string;
  timestamp: string;
  isInterrupted?: boolean;
  speechDurationSec?: number;
  languageDetected?: "Telugu" | "Telugu-English" | "English";
  metrics?: {
    ttftMs?: number; // Time to first token
    ttfaMs?: number; // Time to first audio packet
    sttLatencyMs?: number;
    llmLatencyMs?: number;
    ttsLatencyMs?: number;
    totalTurnLatencyMs?: number;
  };
}

export interface RealtimeCallSession {
  id: string;
  agentId: string;
  tenantId: string;
  callerNumber?: string;
  callerName?: string;
  channel: "web-browser" | "sip-telephony" | "livekit-webrtc";
  state: VoiceAgentState;
  startedAt: string;
  endedAt?: string;
  durationSeconds: number;
  messages: ConversationMessage[];
  memory: ConversationMemory;
  metrics: {
    averageTTFAMs: number;
    averageTurnLatencyMs: number;
    totalInterruptions: number;
    totalBackchannels: number;
    sttAccuracyScore: number;
    humanHandoffTriggered: boolean;
  };
  leadId?: string;
  appointmentId?: string;
}

export interface RealtimeDebugTelemetry {
  state: VoiceAgentState;
  vadActive: boolean;
  vadEnergy: number;
  turnCompletenessProbability: number;
  interruptionProbability: number;
  isBackchannelCandidate: boolean;
  lastBackchannelPhrase?: string;
  partialTranscript: string;
  finalTranscript: string;
  currentSpeechChunk?: string;
  activeTTSQueueLength: number;
  activeProvider: TTSProviderType;
  activeVoice: string;
  lastRAGRetrieval?: {
    query: string;
    matchedCategory?: string;
    confidence: number;
  };
  lastToolCall?: {
    toolName: string;
    args: Record<string, unknown>;
    result: unknown;
  };
  latencyTracker: {
    sttMs: number;
    llmFirstTokenMs: number;
    ttsFirstAudioMs: number;
    totalTurnMs: number;
  };
}

export interface VoiceQualityEvaluationResult {
  id: string;
  testedAt: string;
  modelId: string;
  voiceId: string;
  provider: TTSProviderType;
  samplePhrase: string;
  language: string;
  ttfaMs: number;
  totalGenLatencyMs: number;
  interruptionResponseMs: number;
  intelligibilityScore: number; // 1-100
  naturalnessScore: number; // 1-100
  teluguProsodyScore: number; // 1-100
  codeMixingAccuracy: number; // 1-100
  pronunciationScore: number; // 1-100
  passed: boolean;
  notes: string;
}

export interface BenchmarkMilestoneReport {
  milestoneIndex: number;
  milestoneName: string;
  callerInput: string;
  expectedBehavior: string;
  agentResponse: string;
  passed: boolean;
  turnLatencyMs: number;
  ttfaMs: number;
  notes: string;
}

export interface FiveMinuteTestReport {
  testId: string;
  runAt: string;
  agentName: string;
  scenario: string;
  totalDurationSec: number;
  overallScore: number; // 1-100
  passed: boolean;
  milestones: BenchmarkMilestoneReport[];
  aggregatedMetrics: {
    averageTTFAMs: number;
    averageTurnLatencyMs: number;
    interruptionSuccessRate: number;
    leadExtractionScore: number;
    hallucinationFree: boolean;
    naturalnessMOS: number;
  };
  extractedLead: {
    name?: string;
    phone?: string;
    course?: string;
    batch?: string;
    appointmentBooked?: boolean;
    whatsappRequested?: boolean;
  };
}

export const DEFAULT_CONVERSATION_MEMORY: ConversationMemory = {
  currentTurn: 0,
  slots: {},
  discussionsCount: 0,
  isInterrupted: false,
  handoffRequested: false,
};

export const DEFAULT_DEBUG_TELEMETRY: RealtimeDebugTelemetry = {
  vadEnergy: 0,
  isSpeechDetected: false,
  turnLatencyMs: 0,
  ttfaMs: 0,
  sttLatencyMs: 0,
  llmLatencyMs: 0,
  ttsLatencyMs: 0,
  interruptionDetected: false,
  backchannelFiltered: false,
  lastIntent: "",
  activeAudioProfile: "BROWSER_AUDIO_PROFILE",
};
