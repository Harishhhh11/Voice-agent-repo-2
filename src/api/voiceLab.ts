import { get, post, del } from "./client";
import type { VoiceProviderId } from "../lib/voiceProviders";
import type { PronunciationRule } from "../lib/responsePlanner";

export interface VoiceTestRecord {
  id: number;
  user_id?: number | null;
  organization_id: number;
  provider: VoiceProviderId;
  voice_id: string;
  voice_name: string;
  model: string;
  language: string;
  gender: "female" | "male";
  test_text: string;
  normalized_text?: string;
  audio_url?: string;
  audio_base64?: string;
  ttfa_ms: number;
  total_latency_ms: number;
  audio_duration_ms: number;
  sample_rate: number;
  characters: number;
  naturalness_score?: number;
  pronunciation_score?: number;
  human_like_score?: number;
  conversation_score?: number;
  quality_score?: number;
  overall_score?: number;
  notes?: string;
  created_at: string;
}

export interface SynthesizeRequest {
  provider: VoiceProviderId;
  voice_id: string;
  text: string;
  speed?: number;
  pitch?: number;
  sample_rate?: number;
  audio_format?: string;
  phone_mode?: boolean;
  emotional_context?: string;
  model?: string;
}

export interface SynthesizeResponse {
  audio_url: string;
  audio_base64: string;
  mime_type: string;
  ttfa_ms: number;
  total_latency_ms: number;
  audio_duration_ms: number;
  characters: number;
  provider: VoiceProviderId;
  voice_id: string;
  voice_name?: string;
  model: string;
  sample_rate: number;
  normalized_text: string;
  streaming_available: boolean;
}

export interface ReceptionistVoiceConfig {
  provider: VoiceProviderId;
  voice_id: string;
  voice_name: string;
  gender: "female" | "male";
  language: string;
  model: string;
  rate: number;
  pitch: number;
  sample_rate: number;
  phone_mode: boolean;
  updated_at: string;
}

export async function synthesizeVoiceLab(params: SynthesizeRequest): Promise<SynthesizeResponse> {
  return post<SynthesizeResponse, SynthesizeRequest>("/voice/lab/synthesize", params);
}

export async function getVoiceTests(): Promise<VoiceTestRecord[]> {
  const res = await get<VoiceTestRecord[] | { data: VoiceTestRecord[] }>("/voice/lab/tests");
  return Array.isArray(res) ? res : res.data || [];
}

export async function saveVoiceTest(test: Partial<VoiceTestRecord>): Promise<VoiceTestRecord> {
  return post<VoiceTestRecord, Partial<VoiceTestRecord>>("/voice/lab/tests", test);
}

export async function deleteVoiceTest(id: number): Promise<void> {
  return del<void>(`/voice/lab/tests/${id}`);
}

export async function getVoiceFavorites(): Promise<string[]> {
  const res = await get<string[] | { data: string[] }>("/voice/lab/favorites");
  return Array.isArray(res) ? res : res.data || [];
}

export async function toggleVoiceFavorite(voiceId: string): Promise<string[]> {
  return post<string[], { voice_id: string }>("/voice/lab/favorites/toggle", { voice_id: voiceId });
}

export async function getReceptionistVoiceConfig(): Promise<ReceptionistVoiceConfig> {
  return get<ReceptionistVoiceConfig>("/voice/lab/receptionist-voice");
}

export async function setReceptionistDefaultVoice(
  data: Partial<ReceptionistVoiceConfig>
): Promise<{ success: boolean; message: string; config: ReceptionistVoiceConfig }> {
  return post<{ success: boolean; message: string; config: ReceptionistVoiceConfig }, Partial<ReceptionistVoiceConfig>>(
    "/voice/lab/receptionist-voice",
    data
  );
}

export async function getPronunciationRules(): Promise<PronunciationRule[]> {
  const res = await get<PronunciationRule[] | { data: PronunciationRule[] }>("/voice/lab/pronunciations");
  return Array.isArray(res) ? res : res.data || [];
}

export async function savePronunciationRule(rule: Partial<PronunciationRule>): Promise<PronunciationRule> {
  return post<PronunciationRule, Partial<PronunciationRule>>("/voice/lab/pronunciations", rule);
}

export async function deletePronunciationRule(id: string): Promise<void> {
  return del<void>(`/voice/lab/pronunciations/${id}`);
}

export interface PlatformApiKeysState {
  sarvam_api_key?: string;
  elevenlabs_api_key?: string;
  google_tts_api_key?: string;
  murf_api_key?: string;
}

export async function getPlatformApiKeys(): Promise<PlatformApiKeysState> {
  return get<PlatformApiKeysState>("/voice/platform-keys");
}

export async function updatePlatformApiKeys(
  keys: Partial<PlatformApiKeysState>
): Promise<{ success: boolean; keys: PlatformApiKeysState }> {
  return post<{ success: boolean; keys: PlatformApiKeysState }, Partial<PlatformApiKeysState>>(
    "/voice/platform-keys",
    keys
  );
}
