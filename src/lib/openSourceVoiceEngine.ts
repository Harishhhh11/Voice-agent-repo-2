/**
 * Open-Source Voice Client Engine
 * 
 * Features:
 * - VAD (Voice Activity Detection) with spectral energy thresholding
 * - Barge-in interruption coordinator (cancels/stops audio immediately on user speech)
 * - REST API client for all open-source models, voices, benchmarking, and dictionary
 * - Duplex real-time turn taking coordinator
 */

import type {
  HardwareStatus,
  OpenSourceModelInfo,
  OpenSourceVoiceProfile,
  SynthesisRequest,
  SynthesisResponse,
  BenchmarkScore,
  PronunciationEntry,
  ModelId,
  DeviceType,
} from "./openSourceVoiceTypes";

// --------------------------------------------------------------------------
// 1. Audio Playback with Immediate Interruption (Barge-In)
// --------------------------------------------------------------------------

let currentAudio: HTMLAudioElement | null = null;
let currentAudioAbortController: AbortController | null = null;

export function stopCurrentAudioPlayback(): void {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio.src = "";
    } catch {
      // ignore
    }
    currentAudio = null;
  }
  if (currentAudioAbortController) {
    currentAudioAbortController.abort();
    currentAudioAbortController = null;
  }
}

export function playOpenSourceAudio(
  audioUrl: string,
  onPlay?: () => void,
  onEnded?: () => void,
  onError?: (err: Error) => void
): HTMLAudioElement {
  stopCurrentAudioPlayback();

  const audio = new Audio(audioUrl);
  currentAudio = audio;

  audio.onplay = () => {
    onPlay?.();
  };

  audio.onended = () => {
    if (currentAudio === audio) {
      currentAudio = null;
    }
    onEnded?.();
  };

  audio.onerror = () => {
    if (currentAudio === audio) {
      currentAudio = null;
    }
    onError?.(new Error("Audio playback failed"));
  };

  audio.play().catch((err) => {
    console.warn("Audio autoplay blocked or cancelled:", err);
    onError?.(err);
  });

  return audio;
}

export function isAudioPlaying(): boolean {
  return !!currentAudio && !currentAudio.paused && !currentAudio.ended;
}

// --------------------------------------------------------------------------
// 2. Voice Activity Detection (VAD) & Barge-In Engine
// --------------------------------------------------------------------------

export interface VADCallbacks {
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  onInterruption?: () => void; // Barge-in triggered
  onVolumeChange?: (rms: number) => void;
}

export class BrowserVAD {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private isListening = false;
  private animFrameId: number | null = null;
  private speechActive = false;
  private silenceCounter = 0;
  private energyThreshold = 0.045; // RMS threshold for voice detection
  private silenceFramesRequired = 25; // ~500ms of silence to trigger speech_end

  constructor(private callbacks: VADCallbacks = {}) {}

  public async startListening(): Promise<boolean> {
    if (this.isListening) return true;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioContextClass();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.3;

      this.microphone = this.audioContext.createMediaStreamSource(this.stream);
      this.microphone.connect(this.analyser);

      this.isListening = true;
      this.monitorAudioEnergy();
      return true;
    } catch (err) {
      console.error("VAD initialization failed:", err);
      return false;
    }
  }

  private monitorAudioEnergy() {
    if (!this.isListening || !this.analyser) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(dataArray);

    // Compute RMS Energy
    let sumSquares = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = (dataArray[i] - 128) / 128;
      sumSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquares / dataArray.length);

    this.callbacks.onVolumeChange?.(rms);

    if (rms > this.energyThreshold) {
      this.silenceCounter = 0;
      if (!this.speechActive) {
        this.speechActive = true;
        this.callbacks.onSpeechStart?.();

        // Check if AI is speaking -> Trigger immediate Barge-In!
        if (isAudioPlaying()) {
          stopCurrentAudioPlayback();
          this.callbacks.onInterruption?.();
        }
      }
    } else {
      if (this.speechActive) {
        this.silenceCounter++;
        if (this.silenceCounter > this.silenceFramesRequired) {
          this.speechActive = false;
          this.callbacks.onSpeechEnd?.();
          this.silenceCounter = 0;
        }
      }
    }

    this.animFrameId = requestAnimationFrame(() => this.monitorAudioEnergy());
  }

  public stopListening() {
    this.isListening = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.speechActive = false;
  }
}

// --------------------------------------------------------------------------
// 3. API Communication Layer
// --------------------------------------------------------------------------

export async function fetchHardwareStatus(): Promise<HardwareStatus> {
  const res = await fetch("/api/v1/voice/open-source/status");
  if (!res.ok) throw new Error("Failed to fetch hardware status");
  return res.json();
}

export async function fetchOpenSourceModels(): Promise<OpenSourceModelInfo[]> {
  const res = await fetch("/api/v1/voice/open-source/models");
  if (!res.ok) throw new Error("Failed to fetch open-source models");
  return res.json();
}

export async function fetchOpenSourceVoices(): Promise<OpenSourceVoiceProfile[]> {
  const res = await fetch("/api/v1/voice/open-source/voices");
  if (!res.ok) throw new Error("Failed to fetch open-source voices");
  return res.json();
}

export async function loadModelApi(modelId: ModelId, device: DeviceType): Promise<{ success: boolean; loadedOn: DeviceType; memoryMb: number }> {
  const res = await fetch("/api/v1/voice/open-source/load", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modelId, device }),
  });
  if (!res.ok) throw new Error("Failed to load model");
  return res.json();
}

export async function unloadModelApi(modelId: ModelId): Promise<boolean> {
  const res = await fetch("/api/v1/voice/open-source/unload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modelId }),
  });
  if (!res.ok) throw new Error("Failed to unload model");
  const data = await res.json();
  return data.success;
}

export async function synthesizeOpenSource(req: SynthesisRequest): Promise<SynthesisResponse> {
  currentAudioAbortController = new AbortController();
  const res = await fetch("/api/v1/voice/open-source/synthesize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal: currentAudioAbortController.signal,
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Open-source synthesis failed");
  }
  return res.json();
}

export async function fetchPronunciationDictionary(): Promise<PronunciationEntry[]> {
  const res = await fetch("/api/v1/voice/open-source/dictionary");
  if (!res.ok) throw new Error("Failed to fetch pronunciation dictionary");
  return res.json();
}

export async function savePronunciationEntry(entry: Partial<PronunciationEntry>): Promise<PronunciationEntry> {
  const res = await fetch("/api/v1/voice/open-source/dictionary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
  if (!res.ok) throw new Error("Failed to save pronunciation entry");
  return res.json();
}

export async function deletePronunciationEntry(id: string): Promise<boolean> {
  const res = await fetch(`/api/v1/voice/open-source/dictionary/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete pronunciation entry");
  return true;
}

export async function submitBenchmarkScore(score: BenchmarkScore): Promise<void> {
  await fetch("/api/v1/voice/open-source/benchmark", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(score),
  });
}

export async function fetchBenchmarkScores(): Promise<BenchmarkScore[]> {
  const res = await fetch("/api/v1/voice/open-source/benchmark");
  if (!res.ok) return [];
  return res.json();
}

export async function setReceptionistOpenSourceVoice(voiceId: string): Promise<boolean> {
  const res = await fetch("/api/v1/voice/open-source/set-receptionist-voice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ voiceId }),
  });
  return res.ok;
}

export async function executeRealtimeTurn(
  userInput: string,
  history: Array<{ role: "user" | "receptionist"; text: string }>,
  modelId: ModelId = "indic-parler",
  voiceId: string = "os-parler-lalitha"
): Promise<{ replyText: string; audioUrl: string; durationSec: number; rtf: number }> {
  const res = await fetch("/api/v1/voice/open-source/realtime-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userInput, history, modelId, voiceId }),
  });
  if (!res.ok) throw new Error("Realtime conversation turn failed");
  return res.json();
}
