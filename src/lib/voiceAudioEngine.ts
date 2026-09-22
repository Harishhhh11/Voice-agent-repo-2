import { type VoiceSpeaker } from "./voiceProviders";

// Web Audio Context Singleton
let audioCtx: AudioContext | null = null;
let currentSourceNode: AudioBufferSourceNode | null = null;
let currentHtmlAudio: HTMLAudioElement | null = null;
let isAudioPlaying = false;
const audioBufferCache = new Map<string, AudioBuffer>();

function getAudioContext(): AudioContext {
  if (!audioCtx || audioCtx.state === "closed") {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

export interface PlayVoiceOptions {
  audioUrl: string;
  speaker?: Partial<VoiceSpeaker> | null;
  speed?: number;
  pitch?: number;
  phoneMode?: boolean;
  onPlay?: () => void;
  onEnded?: () => void;
  onError?: (err: unknown) => void;
}

/**
 * Calculates custom detune cents and EQ profile for a specific speaker
 */
export function getSpeakerAcousticProfile(speaker?: Partial<VoiceSpeaker> | null, userPitch = 1.0) {
  const isMale = speaker?.gender === "male";
  const speakerId = (speaker?.id || "").toLowerCase();
  const provider = (speaker?.provider || "").toLowerCase();

  // 1. Base detune in cents (100 cents = 1 semitone)
  let baseDetuneCents = 0;

  // Neural server voices (Edge, AI4Bharat, Meta MMS, Sarvam, ElevenLabs) already possess
  // native, highly natural acoustic vocal tracts and do not need artificial pitch-shifting!
  const isNeuralServerVoice =
    provider === "edge_neural" ||
    provider === "ai4bharat_indic" ||
    provider === "meta_mms" ||
    provider === "sarvam" ||
    provider === "elevenlabs" ||
    provider === "google_cloud" ||
    speakerId.startsWith("edge-") ||
    speakerId.startsWith("ai4bharat-") ||
    speakerId.startsWith("meta-") ||
    speakerId.startsWith("sarvam-") ||
    speakerId.startsWith("eleven-") ||
    speakerId.startsWith("chirp-") ||
    speakerId.startsWith("google-") ||
    speakerId.startsWith("indic-") ||
    speakerId === "shruti" ||
    speakerId === "mohan" ||
    speakerId === "sravani" ||
    speakerId === "rajesh" ||
    speakerId === "ananya" ||
    speakerId === "praveen" ||
    speakerId === "vaani" ||
    speakerId === "sindhu" ||
    speakerId === "venkatesh" ||
    speakerId === "aruna" ||
    speakerId === "manoj";

  if (isNeuralServerVoice) {
    baseDetuneCents = 0;
  } else if (isMale) {
    // Specific male voices pitch calibration for simulated fallback
    switch (speakerId) {
      case "shubh":
        baseDetuneCents = -460;
        break;
      case "ratan":
        baseDetuneCents = -580; // Senior, deep counselor
        break;
      case "ajay":
        baseDetuneCents = -510;
        break;
      case "kabir":
        baseDetuneCents = -560; // Deep resonant
        break;
      case "aditya":
        baseDetuneCents = -360; // Youthful tech
        break;
      case "rahul":
        baseDetuneCents = -420;
        break;
      case "rohan":
        baseDetuneCents = -390;
        break;
      case "amit":
        baseDetuneCents = -480;
        break;
      case "dev":
        baseDetuneCents = -440;
        break;
      case "varun":
        baseDetuneCents = -470;
        break;
      case "anand":
        baseDetuneCents = -490;
        break;
      case "tarun":
        baseDetuneCents = -350;
        break;
      case "sunny":
        baseDetuneCents = -370;
        break;
      case "mani":
        baseDetuneCents = -450;
        break;
      case "gokul":
        baseDetuneCents = -520;
        break;
      case "vijay":
        baseDetuneCents = -480;
        break;
      case "eleven-arjun-telugu":
      case "eleven-karthik-telugu":
      case "eleven-venkat-telugu":
      case "eleven-suresh-telugu":
        baseDetuneCents = -500;
        break;
      case "te-in-chirp3-hd-puck":
      case "te-in-chirp3-hd-fenrir":
      case "te-in-chirp3-hd-charon":
      case "te-in-neural2-b":
        baseDetuneCents = -480;
        break;
      case "murf-te-vikram":
      case "murf-te-krishna":
      case "murf-te-suresh":
        baseDetuneCents = -540;
        break;
      default:
        baseDetuneCents = -480; // Standard male pitch drop for simulated voice
        break;
    }
  } else {
    // Specific female voices pitch calibration
    switch (speakerId) {
      case "neha":
        baseDetuneCents = 0; // Reference baseline
        break;
      case "priya":
        baseDetuneCents = 70; // Crisp and articulate
        break;
      case "ritu":
        baseDetuneCents = 150; // Youthful and bright
        break;
      case "pooja":
        baseDetuneCents = 0; // True natural baseline for Pooja
        break;
      case "simran":
        baseDetuneCents = 80;
        break;
      case "kavya":
        baseDetuneCents = 110; // Fast energetic
        break;
      case "ishita":
        baseDetuneCents = 50;
        break;
      case "shreya":
        baseDetuneCents = 90;
        break;
      case "roopa":
        baseDetuneCents = -30;
        break;
      case "tanya":
        baseDetuneCents = 120;
        break;
      case "shruti":
        baseDetuneCents = 0;
        break;
      case "suhani":
        baseDetuneCents = 40;
        break;
      case "kavitha":
        baseDetuneCents = -20;
        break;
      case "rupali":
        baseDetuneCents = 10;
        break;
      case "eleven-sravani-telugu":
      case "eleven-ananya-telugu":
      case "eleven-deepika-telugu":
      case "eleven-meera-telugu":
        baseDetuneCents = 60;
        break;
      case "te-in-chirp3-hd-aoede":
      case "te-in-chirp3-hd-kore":
      case "te-in-chirp3-hd-leda":
      case "te-in-neural2-a":
        baseDetuneCents = 80;
        break;
      case "murf-te-swathi":
      case "murf-te-ananya":
      case "murf-te-jyothi":
        baseDetuneCents = 40;
        break;
      default:
        baseDetuneCents = 0;
        break;
    }
  }

  // Add user pitch slider offset (1.0 = 0 cents, 1.2 = ~+315 cents, 0.8 = ~-386 cents)
  const userPitchCents = Math.round(1200 * Math.log2(Math.max(0.5, Math.min(2.0, userPitch))));
  const totalDetuneCents = baseDetuneCents + userPitchCents;

  return {
    isMale,
    totalDetuneCents,
    provider,
    speakerId,
  };
}

/**
 * Stop any currently active voice playback
 */
export function stopVoiceAudio() {
  if (currentSourceNode) {
    try {
      currentSourceNode.stop();
      currentSourceNode.disconnect();
    } catch {
      // Ignored
    }
    currentSourceNode = null;
  }

  if (currentHtmlAudio) {
    try {
      currentHtmlAudio.pause();
      currentHtmlAudio.currentTime = 0;
    } catch {
      // Ignored
    }
    currentHtmlAudio = null;
  }

  isAudioPlaying = false;
}

export function isVoiceAudioCurrentlyPlaying(): boolean {
  return isAudioPlaying;
}

/**
 * Plays voice audio with speaker-specific timbre, formant shaping, pitch detuning, and EQ
 */
export async function playVoiceAudio(options: PlayVoiceOptions): Promise<void> {
  stopVoiceAudio();

  const {
    audioUrl,
    speaker,
    speed = 1.0,
    pitch = 1.0,
    phoneMode = false,
    onPlay,
    onEnded,
    onError,
  } = options;

  if (!audioUrl) {
    onError?.(new Error("No audio URL provided"));
    return;
  }

  const profile = getSpeakerAcousticProfile(speaker, pitch);

  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    // 1. Fetch & Decode AudioBuffer (with caching for instant repeat playback)
    let audioBuffer = audioBufferCache.get(audioUrl);
    if (!audioBuffer) {
      const response = await fetch(audioUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      audioBufferCache.set(audioUrl, audioBuffer);
    }

    // 2. Create Source Node
    const sourceNode = ctx.createBufferSource();
    sourceNode.buffer = audioBuffer;
    currentSourceNode = sourceNode;

    // Apply speed and detune:
    // If the audio is already synthesized by the server with speed/pitch baked into the waveform,
    // we keep playbackRate at 1.0 to prevent unnatural robotic chipmunk acceleration!
    const isServerSynthesized = audioUrl.includes("/api/v1/voice/tts") || audioUrl.includes("speed=") || audioUrl.includes("pitch=");
    sourceNode.playbackRate.value = isServerSynthesized ? 1.0 : Math.max(0.6, Math.min(2.0, speed));
    if (sourceNode.detune) {
      sourceNode.detune.value = isServerSynthesized ? 0 : profile.totalDetuneCents;
    }

    // 3. Build DSP Signal Chain
    let lastNode: AudioNode = sourceNode;

    if (phoneMode) {
      // Telephony 8kHz PSTN Bandpass Filter (300Hz - 3400Hz)
      const highpass = ctx.createBiquadFilter();
      highpass.type = "highpass";
      highpass.frequency.value = 320;
      highpass.Q.value = 1.0;

      const lowpass = ctx.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.value = 3400;
      lowpass.Q.value = 1.0;

      const phoneMid = ctx.createBiquadFilter();
      phoneMid.type = "peaking";
      phoneMid.frequency.value = 1800;
      phoneMid.gain.value = 3.0;

      lastNode.connect(highpass);
      highpass.connect(lowpass);
      lowpass.connect(phoneMid);
      lastNode = phoneMid;
    } else {
      // Studio Acoustic Profiling Chain
      if (profile.isMale) {
        // Deep Male Resonant EQ
        const subCut = ctx.createBiquadFilter();
        subCut.type = "highpass";
        subCut.frequency.value = 75;

        const chestBoost = ctx.createBiquadFilter();
        chestBoost.type = "lowshelf";
        chestBoost.frequency.value = 180;
        chestBoost.gain.value = 6.5; // Rich baritone body

        const nasalCut = ctx.createBiquadFilter();
        nasalCut.type = "peaking";
        nasalCut.frequency.value = 1400;
        nasalCut.gain.value = -3.0;
        nasalCut.Q.value = 1.2;

        const presenceBoost = ctx.createBiquadFilter();
        presenceBoost.type = "peaking";
        presenceBoost.frequency.value = 2600;
        presenceBoost.gain.value = 2.5;

        const airSmooth = ctx.createBiquadFilter();
        airSmooth.type = "highshelf";
        airSmooth.frequency.value = 7500;
        airSmooth.gain.value = -2.0;

        lastNode.connect(subCut);
        subCut.connect(chestBoost);
        chestBoost.connect(nasalCut);
        nasalCut.connect(presenceBoost);
        presenceBoost.connect(airSmooth);
        lastNode = airSmooth;
      } else {
        // Crisp Female Clarity EQ
        const lowCut = ctx.createBiquadFilter();
        lowCut.type = "highpass";
        lowCut.frequency.value = 130;

        const warmBody = ctx.createBiquadFilter();
        warmBody.type = "lowshelf";
        warmBody.frequency.value = 240;
        warmBody.gain.value = 1.5;

        const vocalPresence = ctx.createBiquadFilter();
        vocalPresence.type = "peaking";
        vocalPresence.frequency.value = 3400;
        vocalPresence.gain.value = 4.0; // High speech intelligibility
        vocalPresence.Q.value = 1.1;

        const airSparkle = ctx.createBiquadFilter();
        airSparkle.type = "highshelf";
        airSparkle.frequency.value = 9500;
        airSparkle.gain.value = 2.5;

        lastNode.connect(lowCut);
        lowCut.connect(warmBody);
        warmBody.connect(vocalPresence);
        vocalPresence.connect(airSparkle);
        lastNode = airSparkle;
      }

      // Provider-specific coloration
      if (profile.provider === "elevenlabs") {
        const studioCompress = ctx.createBiquadFilter();
        studioCompress.type = "peaking";
        studioCompress.frequency.value = 4500;
        studioCompress.gain.value = 3.0;
        lastNode.connect(studioCompress);
        lastNode = studioCompress;
      } else if (profile.provider === "murf") {
        const broadcastMid = ctx.createBiquadFilter();
        broadcastMid.type = "peaking";
        broadcastMid.frequency.value = 2200;
        broadcastMid.gain.value = 3.5;
        lastNode.connect(broadcastMid);
        lastNode = broadcastMid;
      }
    }

    // 4. Studio Dynamics Compressor
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.knee.value = 8;
    compressor.ratio.value = 3.5;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.12;

    // Master Gain
    const masterGain = ctx.createGain();
    masterGain.gain.value = profile.isMale ? 1.25 : 1.1;

    lastNode.connect(compressor);
    compressor.connect(masterGain);
    masterGain.connect(ctx.destination);

    // 5. Playback Events
    sourceNode.onended = () => {
      isAudioPlaying = false;
      currentSourceNode = null;
      onEnded?.();
    };

    sourceNode.start(0);
    isAudioPlaying = true;
    onPlay?.();
  } catch (err) {
    console.warn("[VoiceAudioEngine] Web Audio graph playback failed, using fallback:", err);
    // Fallback to standard HTML5 Audio with playbackRate
    try {
      const audio = new Audio(audioUrl);
      currentHtmlAudio = audio;
      audio.playbackRate = speed;
      audio.onended = () => {
        isAudioPlaying = false;
        currentHtmlAudio = null;
        onEnded?.();
      };
      audio.onerror = (e) => {
        isAudioPlaying = false;
        currentHtmlAudio = null;
        onError?.(e);
      };
      await audio.play();
      isAudioPlaying = true;
      onPlay?.();
    } catch (fallbackErr) {
      isAudioPlaying = false;
      onError?.(fallbackErr);
    }
  }
}
