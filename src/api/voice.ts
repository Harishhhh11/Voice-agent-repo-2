import { get, post, put } from "./client";

export interface VoiceCall {
  id: number;
  organization_id: number;
  agent_id: number;
  conversation_id: number;
  call_sid: string;
  direction: "inbound" | "outbound";
  caller_number: string;
  recipient_number: string;
  status: "completed" | "in-progress" | "missed" | "transferred";
  duration_seconds: number;
  recording_url: string | null;
  outcome: "lead_captured" | "appointment_booked" | "transferred" | "inquiry_resolved" | "dropped";
  transcript: { role: string; text: string; timestamp: string }[];
  created_at: string;
}

export interface TelephonyConfig {
  provider: string;
  virtual_phone_number: string;
  sip_endpoint: string;
  voice_engine: string;
  barge_in_enabled: boolean;
  silence_timeout_ms: number;
  record_calls: boolean;
}

export interface SimulateCallResponse {
  session_id?: string;
  call_sid: string;
  voice_reply: string;
  audio_synthesis: {
    voice_id: string;
    speaking_style: string;
    rate: number;
    pitch: number;
  };
  outcome: string;
  quick_replies?: string[];
  call_record: VoiceCall;
}

export async function getVoiceCalls(): Promise<VoiceCall[]> {
  const res = await get<VoiceCall[] | { data: VoiceCall[] }>("/voice/calls");
  return Array.isArray(res) ? res : res.data;
}

export async function getTelephonyConfig(): Promise<TelephonyConfig> {
  return get<TelephonyConfig>("/voice/telephony-config");
}

export async function updateTelephonyConfig(data: Partial<TelephonyConfig>): Promise<TelephonyConfig> {
  return put<TelephonyConfig, Partial<TelephonyConfig>>("/voice/telephony-config", data);
}

export async function simulateVoiceCall(params: {
  spoken_input: string;
  caller_number?: string;
  agent_id?: number;
  session_id?: string;
  call_sid?: string;
  language?: string;
}): Promise<SimulateCallResponse> {
  return post<SimulateCallResponse, typeof params>("/voice/simulate-call", params);
}

export function getVoiceTTSAudioUrl(
  text: string,
  lang: string = "te",
  voiceId: string = "pooja",
  provider: string = "sarvam",
  speed: number = 1.05,
  pitch: number = 1.0
): string {
  return `/api/v1/voice/tts?text=${encodeURIComponent(text)}&lang=${encodeURIComponent(lang)}&voice_id=${encodeURIComponent(voiceId)}&provider=${encodeURIComponent(provider)}&speed=${speed}&pitch=${pitch}&t=${Date.now()}`;
}

export async function fetchVoiceTTSBase64(text: string, lang: string = "te"): Promise<string | null> {
  try {
    const res = await post<{ audio_base64: string; mime_type: string }, { text: string; lang: string }>(
      "/voice/tts",
      { text, lang }
    );
    if (res && res.audio_base64) {
      return `data:${res.mime_type || "audio/mpeg"};base64,${res.audio_base64}`;
    }
    return null;
  } catch (err) {
    console.error("Failed to fetch TTS base64:", err);
    return null;
  }
}

