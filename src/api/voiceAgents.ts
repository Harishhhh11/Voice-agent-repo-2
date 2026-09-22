import { get, post, put, del } from "./client";
import type {
  RealtimeVoiceAgentConfig,
  RealtimeCallSession,
  FiveMinuteTestReport,
  VoiceQualityEvaluationResult,
  RealtimeDebugTelemetry,
  ConversationMemory,
} from "../types/realtimeVoice";

export async function fetchVoiceAgents(): Promise<RealtimeVoiceAgentConfig[]> {
  return get<RealtimeVoiceAgentConfig[]>("/voice-agents");
}

export async function fetchVoiceAgent(id: string): Promise<RealtimeVoiceAgentConfig> {
  return get<RealtimeVoiceAgentConfig>(`/voice-agents/${id}`);
}

export async function createVoiceAgent(config: Partial<RealtimeVoiceAgentConfig>): Promise<RealtimeVoiceAgentConfig> {
  return post<RealtimeVoiceAgentConfig>("/voice-agents", config);
}

export async function updateVoiceAgent(id: string, config: Partial<RealtimeVoiceAgentConfig>): Promise<RealtimeVoiceAgentConfig> {
  return put<RealtimeVoiceAgentConfig>(`/voice-agents/${id}`, config);
}

export async function deleteVoiceAgent(id: string): Promise<{ success: boolean }> {
  return del<{ success: boolean }>(`/voice-agents/${id}`);
}

export async function executeRealtimeTurn(
  agentId: string,
  payload: {
    userInput: string;
    sessionId?: string;
    memory?: ConversationMemory;
    vadEnergy?: number;
    pauseDurationMs?: number;
  }
): Promise<{
  spokenText: string;
  speechChunks: string[];
  audioBase64?: string;
  audioUrl?: string;
  toolCallsExecuted: string[];
  updatedMemory: ConversationMemory;
  telemetry: RealtimeDebugTelemetry;
}> {
  return post(`/voice-agents/${agentId}/turn`, payload);
}

export async function signalBargeIn(
  agentId: string,
  payload: {
    sessionId?: string;
    interruptionTranscript: string;
    vadEnergy?: number;
  }
): Promise<{
  isInterruption: boolean;
  isBackchannel: boolean;
  actionTaken: string;
  reason: string;
}> {
  return post(`/voice-agents/${agentId}/barge-in`, payload);
}

export async function fetchAgentCalls(agentId: string): Promise<RealtimeCallSession[]> {
  return get<RealtimeCallSession[]>(`/voice-agents/${agentId}/calls`);
}

export async function fetchAgentAnalytics(agentId: string): Promise<{
  activeCalls: number;
  totalCalls: number;
  avgDurationSec: number;
  avgTurnLatencyMs: number;
  leadsGenerated: number;
  appointmentsBooked: number;
  humanTransfers: number;
  callSuccessRate: number;
  interruptionRate: number;
  hourlyVolume: { hour: string; calls: number }[];
  languageBreakdown: { language: string; count: number; percentage: number }[];
}> {
  return get(`/voice-agents/${agentId}/analytics`);
}

export async function runAgentFiveMinuteBenchmark(agentId: string): Promise<FiveMinuteTestReport> {
  return post<FiveMinuteTestReport>(`/voice-agents/${agentId}/benchmark/run-5min`, {});
}

export async function runVoiceQualityBenchmark(agentId: string): Promise<VoiceQualityEvaluationResult[]> {
  return post<VoiceQualityEvaluationResult[]>(`/voice-agents/${agentId}/benchmark/voice-eval`, {});
}
