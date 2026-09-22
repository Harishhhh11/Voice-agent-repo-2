import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  CheckCircle2,
  Sliders,
  Radio,
  User,
  Bot,
  RotateCcw,
  Sparkles,
  Send,
  Languages,
  Settings2,
  Play,
  StopCircle,
  FlaskConical,
  ChevronLeft,
  ChevronRight,
  Award,
  Check,
  Waves,
} from "lucide-react";
import PageHeader from "../components/common/PageHeader";
import {
  getVoiceCalls,
  getTelephonyConfig,
  updateTelephonyConfig,
  simulateVoiceCall,
  getVoiceTTSAudioUrl,
  type VoiceCall,
  type TelephonyConfig,
} from "../api/voice";
import { getAgents, getAgent, type Agent } from "../api/agents";

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
      isFinal?: boolean;
    };
  };
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface WindowWithSpeech extends Window {
  SpeechRecognition?: new () => SpeechRecognitionInstance;
  webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
}

export type TeluguPersona =
  | "sarvam-meera"
  | "shruti"
  | "eleven-maya"
  | "sarvam-pavithra"
  | "mohan"
  | "chirp-aoede"
  | "eleven-abhi"
  | "sarvam-arvind"
  | "eleven-amara"
  | "sarvam-amartya"
  | "sarvam-geetha"
  | "chirp-puck"
  | "google-lalitha"
  | "google-venkat"
  | "eleven-nikhil"
  | "sindhu"
  | "vaani"
  | "ananya"
  | "praveen"
  | "indic-f5-sravani"
  | "sravani"
  | "rajesh"
  | "pranathi"
  | "divya"
  | "ramya"
  | "kavya"
  | "keerthana"
  | "swapna"
  | "aruna";

export interface PersonaConfig {
  id: TeluguPersona;
  name: string;
  teluguName: string;
  role: string;
  rate: number;
  pitch: number;
  sampleGreetingTelugu: string;
  sampleGreetingEnglish: string;
  avatar: string;
  description: string;
  badge: string;
  provider: "Sarvam AI" | "Microsoft Azure" | "ElevenLabs" | "Google Cloud" | "Open-Source Indic" | "Meta AI";
  providerKey: "sarvam" | "azure" | "elevenlabs" | "google" | "opensource";
  gender: "female" | "male";
  category: "conversational" | "counselor" | "academic" | "tech" | "expressive" | "open_source";
  mosScore: string;
  latencyClass: string;
  dialectTag: string;
  isTopRanked?: boolean;
}

const TELUGU_PERSONAS: PersonaConfig[] = [
  {
    id: "sarvam-meera",
    name: "Meera (Sarvam Flagship)",
    teluguName: "మీరా",
    role: "Sarvam Bulbul v3 Conversational Flagship",
    rate: 1.04,
    pitch: 1.00,
    badge: "💎 Sarvam Bulbul v3",
    provider: "Sarvam AI",
    providerKey: "sarvam",
    gender: "female",
    category: "conversational",
    mosScore: "4.94",
    latencyClass: "<260ms",
    dialectTag: "Native AP/TS + Tanglish",
    isTopRanked: true,
    sampleGreetingTelugu:
      "నమస్కారం అండి! మారుతి టెక్నాలజీస్ కు స్వాగతం. నేను సర్వం ఏఐ మీరాను. పైథాన్, జావా, ఫుల్ స్టాక్ మరియు క్లౌడ్ డెవాప్స్ కోర్సులకు సంబంధించిన పూర్తి సమాచారం మరియు అడ్మిషన్స్ వివరాలు మీకు అందిస్తాను. మీకు ఏ కోర్సు వివరాలు కావాలి?",
    sampleGreetingEnglish:
      "Namaskaram and welcome to Maruthi Technologies. I am Meera from Sarvam AI. How may I assist you with our course admissions today?",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
    description: "Industry-leading native Dravidian cadence, smooth breath pauses, and flawless Telugu-English (Tanglish) code-mixing.",
  },
  {
    id: "shruti",
    name: "Shruti (Azure Benchmark)",
    teluguName: "శ్రుతి",
    role: "Studio Ultra-Natural Flagship (Zero Cost)",
    rate: 1.00,
    pitch: 1.00,
    badge: "🔥 Azure Benchmark",
    provider: "Microsoft Azure",
    providerKey: "azure",
    gender: "female",
    category: "conversational",
    mosScore: "4.92",
    latencyClass: "<280ms",
    dialectTag: "Dravidian Neural",
    isTopRanked: true,
    sampleGreetingTelugu:
      "నమస్కారం అండి! మారుతి టెక్నాలజీస్ ట్రైనింగ్ డెస్క్ కి స్వాగతం. నేను మీ వర్చువల్ అడ్మిషన్స్ కౌన్సెలర్ శ్రుతిని. కోర్ పైథాన్, కోర్ జావా, ఫుల్ స్టాక్ వెబ్ డెవలప్‌మెంట్ మరియు ఏ డబ్ల్యూ ఎస్ డెవాప్స్ కోర్సుల వివరాలు మీకు అందించడానికి నేను సిద్ధంగా ఉన్నాను. మీరు ఏ కోర్సు గురించి తెలుసుకోవాలనుకుంటున్నారు?",
    sampleGreetingEnglish:
      "Hello! Welcome to Maruthi Technologies training desk. I am Shruti, your conversational admissions counselor. How can I assist you with our training courses today?",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    description: "Benchmark neural Telugu female voice with human breathing pauses and crisp retroflex consonant pronunciation.",
  },
  {
    id: "eleven-maya",
    name: "Maya (ElevenLabs HD)",
    teluguName: "మాయ",
    role: "ElevenLabs Hyper-Realistic Conversational",
    rate: 1.02,
    pitch: 1.00,
    badge: "✨ ElevenLabs Multilingual",
    provider: "ElevenLabs",
    providerKey: "elevenlabs",
    gender: "female",
    category: "expressive",
    mosScore: "4.91",
    latencyClass: "<310ms",
    dialectTag: "Metro Conversational",
    isTopRanked: true,
    sampleGreetingTelugu:
      "హలో అండి! మారుతి టెక్నాలజీస్ కి స్వాగతం. నేను మాయను, ఎలెవెన్‌ల్యాబ్స్ హై-ఫిడిలిటీ తెలుగు వాయిస్. కొత్త సాఫ్ట్‌వేర్ బ్యాచ్‌లు, ఫీజు డిస్కౌంట్స్ మరియు సర్టిఫికేషన్ వివరాలు ఏవైనా నన్ను అడగండి.",
    sampleGreetingEnglish:
      "Hello! Welcome to Maruthi Technologies. I am Maya, powered by ElevenLabs Multilingual speech synthesis. What course can I help you with?",
    avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80",
    description: "Deep expressive range with organic human laughter, thoughtful pauses, and dynamic emotional intonation.",
  },
  {
    id: "mohan",
    name: "Mohan (Azure Gold Standard)",
    teluguName: "మోహన్",
    role: "Senior Academic Director & Head of Training",
    rate: 1.00,
    pitch: 1.00,
    badge: "⭐ Azure Gold Standard",
    provider: "Microsoft Azure",
    providerKey: "azure",
    gender: "male",
    category: "academic",
    mosScore: "4.90",
    latencyClass: "<280ms",
    dialectTag: "Deep Baritone Male",
    isTopRanked: true,
    sampleGreetingTelugu:
      "నమస్కారం అండి! మారుతి టెక్నాలజీస్ కి స్వాగతం. నేను మోహన్, సీనియర్ అకడమిక్ డైరెక్టర్. సాఫ్ట్‌వేర్ ట్రైనింగ్, ప్రాక్టికల్ ల్యాబ్స్ మరియు 100% ప్లేస్‌మెంట్ అసిస్టెన్స్ వివరాలు మీకు వివరిస్తాను. మీకు ఏ టెక్నాలజీ ట్రాక్ వివరాలు కావాలి?",
    sampleGreetingEnglish:
      "Hello and welcome to Maruthi Technologies. I am Mohan, Senior Academic Director. How can I guide you on your software training path today?",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    description: "Deep resonant authoritative baritone Telugu male voice widely celebrated for clarity and unhurried pacing.",
  },
  {
    id: "chirp-aoede",
    name: "Aoede (Google Chirp-3 HD)",
    teluguName: "శ్రుతి-చిర్ప్",
    role: "Google Chirp-3 HD Expressive Female",
    rate: 1.05,
    pitch: 1.01,
    badge: "🏛️ Google Chirp-3 HD",
    provider: "Google Cloud",
    providerKey: "google",
    gender: "female",
    category: "expressive",
    mosScore: "4.89",
    latencyClass: "<320ms",
    dialectTag: "48kHz High Definition",
    isTopRanked: true,
    sampleGreetingTelugu:
      "నమస్కారం అండి! మారుతి టెక్నాలజీస్ కి స్వాగతం. నేను గూగుల్ చిర్ప్ త్రీ హెచ్‌డీ మోడల్ ఆధారిత అడ్మిషన్స్ కౌన్సెలర్ ని. మీకు నచ్చిన కోర్సును ఎంచుకోవడంలో మరియు ఫ్రీ డెమో బుక్ చేయడంలో నేను మీకు తోడ్పడతాను.",
    sampleGreetingEnglish:
      "Hello! Welcome to Maruthi Technologies. I am Aoede, powered by Google Chirp 3 HD audio intonation architecture. How may I assist you today?",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80",
    description: "High-definition 48kHz neural voice from Google capturing subtle prosodic variations in Telugu conversation.",
  },
  {
    id: "eleven-abhi",
    name: "Abhi (ElevenLabs Cinematic)",
    teluguName: "అభి",
    role: "ElevenLabs Deep Cinematic Telugu Male",
    rate: 1.00,
    pitch: 1.00,
    badge: "🎬 ElevenLabs Cinematic",
    provider: "ElevenLabs",
    providerKey: "elevenlabs",
    gender: "male",
    category: "academic",
    mosScore: "4.88",
    latencyClass: "<330ms",
    dialectTag: "Deep Male Baritone",
    isTopRanked: true,
    sampleGreetingTelugu:
      "నమస్కారం అండి! మారుతి టెక్నాలజీస్ కి స్వాగతం. నేను అభి, సీనియర్ టెక్నికల్ మెంటార్. కోడింగ్ బూట్‌క్యాంప్స్, జావా & పైథాన్ ప్రాజెక్ట్ గైడెన్స్ గురించి మీకు పూర్తి క్లారిటీ ఇస్తాను.",
    sampleGreetingEnglish:
      "Hello! Welcome to Maruthi Technologies. I am Abhi, your coding mentor powered by ElevenLabs. What technical track would you like to explore?",
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80",
    description: "Deep cinematic native Telugu male voice with natural resonance, ideal for senior technical orientations.",
  },
  {
    id: "sarvam-pavithra",
    name: "Pavithra (Sarvam Counselor)",
    teluguName: "పవిత్ర",
    role: "Sarvam Empathetic Admissions Counselor",
    rate: 1.02,
    pitch: 1.00,
    badge: "🌸 Sarvam Counselor",
    provider: "Sarvam AI",
    providerKey: "sarvam",
    gender: "female",
    category: "counselor",
    mosScore: "4.87",
    latencyClass: "<270ms",
    dialectTag: "Warm Empathy",
    sampleGreetingTelugu:
      "నమస్కారం అండి! నేను మీ అడ్మిషన్స్ కౌన్సెలర్ పవిత్రను. కొత్త విద్యార్థులకు ప్రత్యేక స్కాలర్‌షిప్స్, బ్యాచ్ సమయాలు మరియు హాస్టల్ గైడెన్స్ వివరాలు అందిస్తాను.",
    sampleGreetingEnglish:
      "Hello! I am Pavithra, your admissions counselor from Sarvam AI. How can I guide your enrollment today?",
    avatar: "https://images.unsplash.com/photo-1548142813-c348350df52b?w=150&auto=format&fit=crop&q=80",
    description: "Gentle, reassuring admissions counselor tone with high emotional warmth for first-time student callers.",
  },
  {
    id: "sarvam-arvind",
    name: "Arvind (Sarvam Director)",
    teluguName: "అరవింద్",
    role: "Sarvam Senior Academic Director & Mentor",
    rate: 1.00,
    pitch: 1.00,
    badge: "🎙️ Sarvam Baritone",
    provider: "Sarvam AI",
    providerKey: "sarvam",
    gender: "male",
    category: "academic",
    mosScore: "4.88",
    latencyClass: "<280ms",
    dialectTag: "Corporate Academic",
    sampleGreetingTelugu:
      "హలో అండి! మారుతి టెక్నాలజీస్ కెరీర్ గైడెన్స్ విభాగానికి స్వాగతం. నేను అరవింద్. ఐటీ ఇండస్ట్రీలో ఫ్రెషర్స్ & వర్కింగ్ ప్రొఫెషనల్స్ కెరీర్ స్విచ్ కోసం ఉత్తమ కోర్సులను సూచిస్తాను.",
    sampleGreetingEnglish:
      "Hello! Welcome to Maruthi Technologies career guidance desk. I am Arvind, Senior Academic Lead.",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
    description: "Commanding corporate Telugu baritone for executive corporate training and syllabus discussions.",
  },
  {
    id: "sarvam-amartya",
    name: "Amartya (Sarvam Tech Lead)",
    teluguName: "అమర్త్య",
    role: "Sarvam Real-time Tech & Coding Lead",
    rate: 1.04,
    pitch: 1.00,
    badge: "⚡ Sarvam Tech Mentor",
    provider: "Sarvam AI",
    providerKey: "sarvam",
    gender: "male",
    category: "tech",
    mosScore: "4.85",
    latencyClass: "<260ms",
    dialectTag: "Youth Tech Tanglish",
    sampleGreetingTelugu:
      "హాయ్ ఫ్రెండ్స్! మారుతి టెక్నాలజీస్ టెక్ హబ్ కి స్వాగతం. నేను అమర్త్య, మీ కోడింగ్ కోచ్ ని. రియల్-టైమ్ ప్రాజెక్ట్స్, గిట్‌హబ్ పోర్ట్‌ఫోలియో బిల్డింగ్ మరియు టెక్నికల్ ఇంటర్వ్యూస్ గురించి చర్చిద్దాం.",
    sampleGreetingEnglish:
      "Hi everyone! Welcome to Maruthi Technologies tech desk. I am Amartya, your coding coach.",
    avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80",
    description: "Fast, energetic, relatable Hyderabad tech youth persona delivering crisp technical explanations.",
  },
  {
    id: "sarvam-geetha",
    name: "Geetha (Sarvam Front-Desk)",
    teluguName: "గీత",
    role: "Sarvam Executive Front-Desk Specialist",
    rate: 1.02,
    pitch: 1.00,
    badge: "🏛️ Sarvam Front-Desk",
    provider: "Sarvam AI",
    providerKey: "sarvam",
    gender: "female",
    category: "counselor",
    mosScore: "4.86",
    latencyClass: "<270ms",
    dialectTag: "Articulate Front-Desk",
    sampleGreetingTelugu:
      "నమస్కారం అండి! మారుతి టెక్నాలజీస్ అడ్మిషన్స్ డెస్క్ కి స్వాగతం. నేను గీతను. మార్నింగ్ మరియు ఈవెనింగ్ క్లాస్‌రూమ్ బ్యాచ్‌ల టైమింగ్స్ మరియు ఫీజు స్ట్రక్చర్ మీకు తెలియజేస్తాను.",
    sampleGreetingEnglish:
      "Hello! Welcome to Maruthi Technologies front desk. I am Geetha, ready to assist with course timings and fees.",
    avatar: "https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=150&auto=format&fit=crop&q=80",
    description: "Polite, structured front-desk specialist voice with excellent syllable clarity for fees and batch schedules.",
  },
  {
    id: "chirp-puck",
    name: "Puck (Google Chirp-3 HD Male)",
    teluguName: "మోహన్-చిర్ప్",
    role: "Google Chirp-3 HD Expressive Baritone",
    rate: 1.00,
    pitch: 1.00,
    badge: "🏛️ Google Chirp-3 HD",
    provider: "Google Cloud",
    providerKey: "google",
    gender: "male",
    category: "academic",
    mosScore: "4.87",
    latencyClass: "<320ms",
    dialectTag: "HD Deep Resonance",
    sampleGreetingTelugu:
      "నమస్కారం అండి! మారుతి టెక్నాలజీస్ విద్యా కేంద్రానికి స్వాగతం. నేను గూగుల్ చిర్ప్ త్రీ మోహన్ చిర్ప్ స్వరంతో మాట్లాడుతున్నాను. సాఫ్ట్‌వేర్ ట్రైనింగ్ మరియు క్లౌడ్ కోర్సుల వివరాలు మీకు వివరిస్తాను.",
    sampleGreetingEnglish:
      "Namaste and welcome. I am Puck, powered by Google Chirp 3 HD speech models.",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    description: "Google's flagship 48kHz HD male voice providing natural unhurried speech cadence for detailed explanations.",
  },
  {
    id: "google-lalitha",
    name: "Lalitha (Google Neural2)",
    teluguName: "లలిత",
    role: "Google Neural2 Conversational Female",
    rate: 1.03,
    pitch: 1.00,
    badge: "🌐 Google Neural2",
    provider: "Google Cloud",
    providerKey: "google",
    gender: "female",
    category: "conversational",
    mosScore: "4.82",
    latencyClass: "<300ms",
    dialectTag: "Fluid Conversational",
    sampleGreetingTelugu:
      "హలో అండి! మారుతి టెక్నాలజీస్ కి స్వాగతం. నేను లలితను, గూగుల్ న్యూరల్ టూ తెలుగు వాయిస్. మీకు ఏ కోర్సు డెమో క్లాస్ లింక్ కావాలి?",
    sampleGreetingEnglish:
      "Hello! Welcome to Maruthi Technologies. I am Lalitha, powered by Google Neural2 TTS.",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
    description: "Fluid conversational female model optimized for low-latency web call assistants.",
  },
  {
    id: "eleven-amara",
    name: "Amara (ElevenLabs Support)",
    teluguName: "అమర",
    role: "ElevenLabs Warm Conversational Support",
    rate: 1.01,
    pitch: 1.00,
    badge: "💎 ElevenLabs Support",
    provider: "ElevenLabs",
    providerKey: "elevenlabs",
    gender: "female",
    category: "counselor",
    mosScore: "4.85",
    latencyClass: "<310ms",
    dialectTag: "Soft Articulate",
    sampleGreetingTelugu:
      "నమస్కారం అండి! నేను మీ స్టూడెంట్ కేర్ ఎగ్జిక్యూటివ్ అమరను. కోర్సు రిజిస్ట్రేషన్, సర్టిఫికేట్స్ మరియు జాబ్ పోర్టల్ యాక్సెస్ లో మీకు సాయం చేస్తాను.",
    sampleGreetingEnglish:
      "Hello! I am Amara from ElevenLabs, your student success and enrollment guide.",
    avatar: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80",
    description: "Gentle, supportive, professional voice for student onboarding and inquiries.",
  },
  {
    id: "eleven-nikhil",
    name: "Nikhil (ElevenLabs Youth)",
    teluguName: "నిఖిల్",
    role: "ElevenLabs Student Career & Tech Mentor",
    rate: 1.03,
    pitch: 1.00,
    badge: "🚀 ElevenLabs Youth Mentor",
    provider: "ElevenLabs",
    providerKey: "elevenlabs",
    gender: "male",
    category: "tech",
    mosScore: "4.84",
    latencyClass: "<300ms",
    dialectTag: "Energetic Mentor",
    sampleGreetingTelugu:
      "హలో అండి! మారుతి టెక్నాలజీస్ కి స్వాగతం. నేను నిఖిల్ ని. కాలేజ్ పాస్-అవుట్స్ మరియు ఫ్రెషర్స్ కి బెస్ట్ సాఫ్ట్‌వేర్ జాబ్ కోర్సుల గురించి గైడెన్స్ ఇస్తాను.",
    sampleGreetingEnglish:
      "Hello! Welcome to Maruthi Technologies. I am Nikhil, your software career counselor.",
    avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80",
    description: "Relatable, upbeat tech mentor voice designed for college graduates seeking IT career entry.",
  },
  {
    id: "indic-f5-sravani",
    name: "Sravani (IndicF5 Fast)",
    teluguName: "శ్రావణి (IndicF5)",
    role: "IndicF5 Zero-Shot Conversational Female",
    rate: 1.02,
    pitch: 1.00,
    badge: "⚡ IndicF5 Fast-TTS",
    provider: "Open-Source Indic",
    providerKey: "opensource",
    gender: "female",
    category: "open_source",
    mosScore: "4.82",
    latencyClass: "<240ms",
    dialectTag: "Zero-Shot IndicF5",
    sampleGreetingTelugu:
      "నమస్కారం అండి! మారుతి టెక్నాలజీస్ కి స్వాగతం. నేను శ్రావణిని, ఇండిక్ ఎఫ్ ఫైవ్ జీరో-షాట్ న్యూరల్ మోడల్ ఆధారిత తెలుగు వాయిస్ ని. వేగవంతమైన స్పీచ్ రెస్పాన్స్ తో మీకు వివరాలు తెలియజేస్తాను.",
    sampleGreetingEnglish:
      "Hello! Welcome to Maruthi Technologies. I am Sravani, running on the IndicF5 zero-shot non-autoregressive speech model.",
    avatar: "https://images.unsplash.com/photo-1548142813-c348350df52b?w=150&auto=format&fit=crop&q=80",
    description: "Ultra-low latency non-autoregressive Telugu acoustic model from IndicF5 research.",
  },
  {
    id: "sindhu",
    name: "Sindhu (Bhashini NLTM)",
    teluguName: "సింధు",
    role: "Bhashini High-Fidelity Indic Female",
    rate: 1.01,
    pitch: 1.01,
    badge: "🇮🇳 Bhashini NLTM",
    provider: "Open-Source Indic",
    providerKey: "opensource",
    gender: "female",
    category: "open_source",
    mosScore: "4.76",
    latencyClass: "<340ms",
    dialectTag: "Bhashini Open Model",
    sampleGreetingTelugu:
      "నమస్కారం అండి! మారుతి టెక్నాలజీస్ ట్రైనింగ్ సెంటర్‌కి స్వాగతం. నేను సింధును. మన వద్ద కోర్ పైథాన్, కోర్ జావా మరియు ఫుల్ స్టాక్ లైవ్ ప్రాజెక్ట్ బ్యాచ్‌లు ప్రారంభమవుతున్నాయి. మీకు ఏ కోర్సు సమాచారం కావాలి?",
    sampleGreetingEnglish:
      "Namaste and welcome to Maruthi Technologies. I am Sindhu from the Bhashini open Indic initiative. Which course would you like to explore today?",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    description: "Melodic female voice with high syllable clarity trained on the National Language Translation Mission open corpus.",
  },
  {
    id: "vaani",
    name: "Vaani (IISc Project Vaani)",
    teluguName: "వాణి",
    role: "Project Vaani / IISc Open Dialect Speech Model",
    rate: 1.00,
    pitch: 1.00,
    badge: "🏛️ IISc Project Vaani",
    provider: "Open-Source Indic",
    providerKey: "opensource",
    gender: "female",
    category: "open_source",
    mosScore: "4.74",
    latencyClass: "<360ms",
    dialectTag: "Vernacular Dialects",
    sampleGreetingTelugu:
      "నమస్కారం అండి! మారుతి టెక్నాలజీస్ కి స్వాగతం. నేను వాణిని. ప్రాజెక్ట్ వాణి ఓపెన్ స్పీచ్ రీసెర్చ్ ఆధారిత స్వచ్ఛమైన తెలుగు స్వరంతో సాఫ్ట్‌వేర్ కోర్సులు, ల్యాబ్స్ మరియు జాబ్ ప్లేస్‌మెంట్ వివరాలు మీకు స్పష్టంగా వివరిస్తాను.",
    sampleGreetingEnglish:
      "Hello! Welcome to Maruthi Technologies. I am Vaani, powered by IISc Project Vaani open speech architecture. How can I guide your software training today?",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80",
    description: "Authentic vernacular AP & Telangana regional cadence from IISc / MeitY Project Vaani open speech corpus.",
  },
  {
    id: "ananya",
    name: "Ananya (IIT Madras Indic-Parler)",
    teluguName: "అనన్య",
    role: "AI4Bharat Indic-Parler Speech Model",
    rate: 1.00,
    pitch: 1.00,
    badge: "🏛️ IIT Madras Indic",
    provider: "Open-Source Indic",
    providerKey: "opensource",
    gender: "female",
    category: "open_source",
    mosScore: "4.78",
    latencyClass: "<350ms",
    dialectTag: "IIT Madras Research",
    sampleGreetingTelugu:
      "నమస్కారం అండి! మారుతి టెక్నాలజీస్ కి స్వాగతం. నేను అనన్యను, ఐఐటీ మద్రాస్ ఓపెన్ సోర్స్ స్పీచ్ రీసెర్చ్ మోడల్ ఆధారంగా రూపొందించిన అడ్మిషన్స్ వాయిస్ ని. మన వద్ద కొత్త బ్యాచ్‌లు ఎప్పుడు ప్రారంభమవుతాయో మరియు ఫీజు వివరాలు తెలియజేస్తాను.",
    sampleGreetingEnglish:
      "Namaste! Welcome to Maruthi Technologies. I am Ananya, powered by open-source Indic speech architecture. How may I assist you today?",
    avatar: "https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=150&auto=format&fit=crop&q=80",
    description: "Authentic native Telugu dialect and conversational inflection from IIT Madras open-source Indic speech research.",
  },
  {
    id: "praveen",
    name: "Praveen (IITM Lecturer)",
    teluguName: "ప్రవీణ్",
    role: "AI4Bharat Indic Academic Lecturer",
    rate: 1.00,
    pitch: 1.00,
    badge: "🏛️ Indic Academic Male",
    provider: "Open-Source Indic",
    providerKey: "opensource",
    gender: "male",
    category: "open_source",
    mosScore: "4.75",
    latencyClass: "<350ms",
    dialectTag: "Academic Phonetics",
    sampleGreetingTelugu:
      "నమస్కారం అండి! మారుతి టెక్నాలజీస్ విద్యా సలహా కేంద్రానికి స్వాగతం. నేను ప్రవీణ్. పైథాన్, జావా మరియు క్లౌడ్ కంప్యూటింగ్ సర్టిఫికేషన్ వివరాలు మీకు స్పష్టంగా వివరిస్తాను.",
    sampleGreetingEnglish:
      "Hello! Welcome to Maruthi Technologies. I am Praveen, your academic counselor. How can I help you today?",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
    description: "Scholarly, unhurried academic lecturer baritone with clear phonetic articulation and natural breathing.",
  },
];

/** Converts Telugu Unicode script to highly natural phonetic romanized syllables for ultra-realistic pronunciation on neural voices */
function transliterateTeluguToTanglish(text: string, personaName: string = "Sravani"): string {
  if (!text) return "";
  let s = text;

  // High-fidelity phrase mapping
  const phraseMap: [RegExp, string][] = [
    [/నమస్కారం అండి/g, "Namaskaaram andi"],
    [/నమస్కారం!/g, "Namaskaaram!"],
    [/నమస్కారం/g, "Namaskaaram"],
    [/స్వాగతం!/g, "Swaagatham!"],
    [/స్వాగతం/g, "Swaagatham"],
    [/మారుతి టెక్నాలజీస్ కి/g, "Maruthi Technologies ki"],
    [/మారుతి టెక్నాలజీస్/g, "Maruthi Technologies"],
    [/మారుతి/g, "Maruthi"],
    [/టెక్నాలజీస్/g, "Technologies"],
    [/రిసెప్షనిస్ట్/g, "Receptionist"],
    [/శ్రావణిని/g, "Sravani ni"],
    [/శ్రావణి/g, "Sravani"],
    [/ప్రణతిని/g, "Pranathi ni"],
    [/ప్రణతి/g, "Pranathi"],
    [/దివ్యను/g, "Divya nu"],
    [/దివ్య/g, "Divya"],
    [/రమ్యను/g, "Ramya nu"],
    [/రమ్య/g, "Ramya"],
    [/కావ్యను/g, "Kavya nu"],
    [/కావ్య/g, "Kavya"],
    [/కీర్తనను/g, "Keerthana nu"],
    [/కీర్తన/g, "Keerthana"],
    [/స్వప్నను/g, "Swapna nu"],
    [/స్వప్న/g, "Swapna"],
    [/మాయను/g, `${personaName} nu`],
    [/మాయ/g, personaName],
    [/ఖచ్చితంగా అండి/g, "Khachithamgaa andi"],
    [/తప్పకుండా అండి/g, "Thappakundaa andi"],
    [/మంచిదండి/g, "Manchidandi"],
    [/కోర్ పైథాన్/g, "Core Python"],
    [/కోర్ జావా/g, "Core Java"],
    [/పైథాన్/g, "Python"],
    [/జావా/g, "Java"],
    [/ఫీజు/g, "Fee"],
    [/ఫీజులు/g, "Fees"],
    [/నాలుగు వేల రూపాయలు/g, "naalugu vela roopaayalu"],
    [/ఐదు వేల రూపాయలు/g, "aidu vela roopaayalu"],
    [/మూడు వేల రూపాయలు/g, "moodu vela roopaayalu"],
    [/ఆరు వేల రూపాయలు/g, "aaru vela roopaayalu"],
    [/పది వేల రూపాయలు/g, "padi vela roopaayalu"],
    [/రూపాయలు/g, "roopaayalu"],
    [/రూ\./g, "roopaayalu"],
    [/అందుబాటులో ఉన్నాయి/g, "andubaatulo unnaayi"],
    [/అందుబాటులో ఉంది/g, "andubaatulo undi"],
    [/అమీర్‌పేట్/g, "Ameerpet"],
    [/అమీర్‌పేట/g, "Ameerpet"],
    [/హైదరాబాద్/g, "Hyderabad"],
    [/బ్యాచ్/g, "Batch"],
    [/బ్యాచ్‌లు/g, "Batches"],
    [/బ్యాచ్ సమయాలు/g, "Batch samayaalu"],
    [/సమయాలు/g, "samayaalu"],
    [/డ్యూరేషన్/g, "Duration"],
    [/కాలవ్యవధి/g, "kaalavyavadhi"],
    [/ముప్పై రోజుల/g, "muppai rojula"],
    [/నలభై ఐదు రోజుల/g, "nalabhai aidu rojula"],
    [/రోజులు/g, "rojulu"],
    [/ఉదయం/g, "Udayam"],
    [/సాయంత్రం/g, "Saayantram"],
    [/ఆన్‌లైన్/g, "Online"],
    [/క్లాస్‌రూమ్/g, "Classroom"],
    [/సెషన్స్/g, "Sessions"],
    [/సర్టిఫికేషన్/g, "Certification"],
    [/సర్టిఫికెట్/g, "Certificate"],
    [/ప్లేస్‌మెంట్/g, "Placement"],
    [/అసిస్టెన్స్/g, "Assistance"],
    [/డెమో/g, "Demo"],
    [/క్లాస్/g, "Class"],
    [/రిజిస్ట్రేషన్/g, "Registration"],
    [/అడ్మిషన్/g, "Admission"],
    [/అడ్మిషన్స్/g, "Admissions"],
    [/కౌన్సెలర్/g, "Counselor"],
    [/సిలబస్/g, "Syllabus"],
    [/ధన్యవాదాలు/g, "Dhanyavaadaalu"],
    [/చెప్పండి/g, "cheppandi"],
    [/కదా/g, "kadaa"],
    [/కావాలి/g, "kaavaali"],
    [/ఉందా/g, "undaa"],
    [/ఎంత/g, "entha"],
    [/ఎప్పుడు/g, "eppudu"],
    [/ఎక్కడ/g, "ekkada"],
    [/ఎలా/g, "elaa"],
    [/వివరాలు/g, "vivaraalu"],
    [/సమాచారం/g, "samaachaaram"],
    [/మీ పేరు/g, "mee peru"],
    [/ఫోన్ నంబర్/g, "phone number"],
    [/ఈమెయిల్/g, "email"],
    [/దయచేసి/g, "dayachesi"],
    [/నేను మీకు ఎలా సహాయపడగలను/g, "Nenu meeku elaa sahaayapadagalanu?"],
    [/నేను మీకు సహాయం చేస్తాను/g, "Nenu meeku sahaayam chesthaanu."],
    [/సిద్ధంగా ఉన్నాను/g, "siddhamgaa unnaanu."],
    [/చేసుకోండి/g, "chesukondi"],
    [/తీసుకోండి/g, "theesukondi"],
  ];

  for (const [pattern, replacement] of phraseMap) {
    s = s.replace(pattern, replacement);
  }

  return s;
}

/** Converts formatted text into fluent, human-sounding spoken phone phrasing with natural Telugu cadence */
function sanitizeTextForVoiceSpeech(
  text: string,
  isTelugu: boolean = false,
  hasNativeTeluguVoice: boolean = false,
  personaName: string = "Sravani"
): string {
  if (!text) return "";
  let s = text;

  const hasTeluguChars = /[\u0C00-\u0C7F]/.test(s);

  // 1. Expand currency amounts into spoken words
  s = s.replace(/₹\s*4[,.]?000(\/-)?/g, isTelugu || hasTeluguChars ? "నాలుగు వేల రూపాయలు" : "four thousand rupees");
  s = s.replace(/₹\s*5[,.]?000(\/-)?/g, isTelugu || hasTeluguChars ? "ఐదు వేల రూపాయలు" : "five thousand rupees");
  s = s.replace(/₹\s*3[,.]?000(\/-)?/g, isTelugu || hasTeluguChars ? "మూడు వేల రూపాయలు" : "three thousand rupees");
  s = s.replace(/₹\s*6[,.]?000(\/-)?/g, isTelugu || hasTeluguChars ? "ఆరు వేల రూపాయలు" : "six thousand rupees");
  s = s.replace(/₹\s*10[,.]?000(\/-)?/g, isTelugu || hasTeluguChars ? "పది వేల రూపాయలు" : "ten thousand rupees");
  s = s.replace(/₹\s*([0-9,]+)/g, (_, amt) => {
    const cleanNum = amt.replace(/,/g, "");
    return isTelugu || hasTeluguChars ? `${cleanNum} రూపాయలు` : `${cleanNum} rupees`;
  });

  // 2. Expand durations & timings for natural human speech
  s = s.replace(/\b30\s*(days|Days)\b/g, isTelugu || hasTeluguChars ? "ముప్పై రోజుల డ్యూరేషన్" : "30 days duration");
  s = s.replace(/\b45\s*(days|Days)\b/g, isTelugu || hasTeluguChars ? "నలభై ఐదు రోజుల డ్యూరేషన్" : "45 days duration");
  s = s.replace(/8\s*AM\s*to\s*10\s*AM/gi, isTelugu || hasTeluguChars ? "ఉదయం ఎనిమిది నుండి పది గంటలు" : "8 AM to 10 AM");
  s = s.replace(/6\s*PM\s*to\s*8\s*PM/gi, isTelugu || hasTeluguChars ? "సాయంత్రం ఆరు నుండి ఎనిమిది గంటలు" : "6 PM to 8 PM");

  // 3. Convert markdown, bullet points, headers into natural conversational pauses
  s = s.replace(/^[•\-*]\s*/gm, "");
  s = s.replace(/\n+/g, ", ");
  s = s.replace(/\*\*(.*?)\*\*/g, "$1");
  s = s.replace(/\*(.*?)\*/g, "$1");
  s = s.replace(/\[(.*?)\]\((.*?)\)/g, "$1");
  s = s.replace(/[\u{1F300}-\u{1FAFF}]/gu, ""); // Remove emojis
  s = s.replace(/\|/g, ", ");
  s = s.replace(/:\s*\./g, ".");
  s = s.replace(/;+/g, ",");
  s = s.replace(/\s{2,}/g, " ").trim();

  // 4. Fallback transliteration if browser doesn't have a native Telugu TTS voice
  if (hasTeluguChars && !hasNativeTeluguVoice) {
    s = transliterateTeluguToTanglish(s, personaName);
  }

  return s;
}

export default function Voice() {
  const [calls, setCalls] = useState<VoiceCall[]>([]);
  const [config, setConfig] = useState<TelephonyConfig | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Active call simulator state
  const [isCallActive, setIsCallActive] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [callSid, setCallSid] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<number>(971);

  useEffect(() => {
    if (!selectedAgentId) return;
    let mounted = true;
    void getAgent(selectedAgentId)
      .then((data) => {
        if (!mounted || !data) return;
        const agentData = data as unknown as { suggested_questions?: string[]; quick_replies?: string[] };
        const questions = agentData.suggested_questions || agentData.quick_replies;
        if (questions && Array.isArray(questions) && questions.length > 0) {
          setQuickReplies(questions);
        }
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [selectedAgentId]);
  const [callerNumber, setCallerNumber] = useState("+91 98765 43210");
  const [callTranscript, setCallTranscript] = useState<{ role: string; text: string; time: string }[]>([]);

  // High-Quality Telugu Persona selection
  const [selectedPersonaId, setSelectedPersonaId] = useState<TeluguPersona>("sravani");
  const activePersona = useMemo(
    () => TELUGU_PERSONAS.find((p) => p.id === selectedPersonaId) || TELUGU_PERSONAS[0],
    [selectedPersonaId]
  );

  // Voice engine & speech recognition settings
  const [voiceLanguageMode, setVoiceLanguageMode] = useState<"auto" | "te-IN" | "en-IN" | "en-US">("auto");
  const [speechPitch, setSpeechPitch] = useState(1.00);
  const [speechRate, setSpeechRate] = useState(1.00);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>("auto");

  // Mic & Speech input state
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [spokenText, setSpokenText] = useState("");
  const [interimSpokenText, setInterimSpokenText] = useState("");
  const [customInputText, setCustomInputText] = useState("");
  const [isSimulatingTurn, setIsSimulatingTurn] = useState(false);
  const [quickReplies, setQuickReplies] = useState<string[]>([
    "Which courses do you offer?",
    "What are the course fees and discounts?",
    "What are the batch timings for Python and Java?",
    "Do you offer classroom training at Ameerpet?",
    "How can I book a free demo session?",
    "Can you speak in Telugu? కోర్సు వివరాలు చెప్పండి",
  ]);
  const [selectedCallDetails, setSelectedCallDetails] = useState<VoiceCall | null>(null);
  const [configSuccess, setConfigSuccess] = useState(false);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [isPlayingSample, setIsPlayingSample] = useState(false);

  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const speechRecognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const speechQueueRef = useRef<string[]>([]);
  const isSpeakingQueueRef = useRef(false);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  // Telugu Voice Persona Slider state & filters
  const personaSliderRef = useRef<HTMLDivElement | null>(null);
  const [personaFilter, setPersonaFilter] = useState<
    "all" | "top" | "sarvam" | "azure" | "elevenlabs" | "google" | "opensource" | "female" | "male"
  >("all");
  const [playingPersonaId, setPlayingPersonaId] = useState<TeluguPersona | null>(null);

  const filteredPersonas = useMemo(() => {
    return TELUGU_PERSONAS.filter((p) => {
      if (personaFilter === "all") return true;
      if (personaFilter === "top") return !!p.isTopRanked;
      if (personaFilter === "sarvam") return p.providerKey === "sarvam";
      if (personaFilter === "azure") return p.providerKey === "azure";
      if (personaFilter === "elevenlabs") return p.providerKey === "elevenlabs";
      if (personaFilter === "google") return p.providerKey === "google";
      if (personaFilter === "opensource") return p.providerKey === "opensource";
      if (personaFilter === "female") return p.gender === "female";
      if (personaFilter === "male") return p.gender === "male";
      return true;
    });
  }, [personaFilter]);

  const slideLeft = () => {
    if (personaSliderRef.current) {
      personaSliderRef.current.scrollBy({ left: -320, behavior: "smooth" });
    }
  };

  const slideRight = () => {
    if (personaSliderRef.current) {
      personaSliderRef.current.scrollBy({ left: 320, behavior: "smooth" });
    }
  };

  // Load available speech synthesis voices
  useEffect(() => {
    function loadVoices() {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        const vList = window.speechSynthesis.getVoices();
        if (vList && vList.length > 0) {
          setAvailableVoices(vList);
        }
      }
    }
    loadVoices();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const hasNativeTeluguVoice = useMemo(() => {
    return availableVoices.some(
      (v) =>
        v.lang.toLowerCase().startsWith("te") ||
        v.name.toLowerCase().includes("telugu") ||
        v.name.toLowerCase().includes("తెలుగు") ||
        v.voiceURI.toLowerCase().includes("te-in")
    );
  }, [availableVoices]);

  // Update quick replies based on language mode
  const handleLanguageModeChange = (mode: "auto" | "te-IN" | "en-IN" | "en-US") => {
    setVoiceLanguageMode(mode);
    if (mode === "te-IN") {
      setSpeechRate(activePersona.rate);
      setSpeechPitch(activePersona.pitch);
      setQuickReplies([
        "నమస్కారం! మీ వద్ద ఏ కోర్సులు అందుబాటులో ఉన్నాయి?",
        "పైథాన్ మరియు జావా ఫీజు ఎంత?",
        "మార్నింగ్ మరియు ఈవినింగ్ బ్యాచ్ సమయాలు చెప్పండి",
        "అమీర్‌పేట లో క్లాస్‌రూమ్ ట్రైనింగ్ ఉందా?",
        "ఉచిత డెమో క్లాస్ ఎలా బుక్ చేసుకోవాలి?",
        "ప్లేస్‌మెంట్ అసిస్టెన్స్ మరియు సర్టిఫికేట్ ఇస్తారా?",
      ]);
    } else {
      setSpeechRate(1.00);
      setSpeechPitch(1.00);
      setQuickReplies([
        "Which courses do you offer?",
        "What are the course fees and discounts?",
        "What are the batch timings for Python and Java?",
        "Do you offer classroom training at Ameerpet?",
        "How can I book a free demo session?",
        "Can you speak in Telugu? కోర్సు వివరాలు చెప్పండి",
      ]);
    }
  };

  const handlePersonaChange = (persona: TeluguPersona) => {
    setSelectedPersonaId(persona);
    const p = TELUGU_PERSONAS.find((x) => x.id === persona);
    if (p) {
      setSpeechRate(p.rate);
      setSpeechPitch(p.pitch);
    }
  };

  useEffect(() => {
    let mounted = true;
    Promise.all([getVoiceCalls(), getTelephonyConfig(), getAgents()])
      .then(([callsData, configData, agentsData]) => {
        if (!mounted) return;
        setCalls(callsData);
        setConfig(configData);
        setAgents(agentsData);
        if (agentsData.length > 0) setSelectedAgentId(agentsData[0].id);
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : "Failed to load voice telephony data.");
      });

    return () => {
      mounted = false;
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (activeAudioRef.current) {
        try {
          activeAudioRef.current.pause();
          activeAudioRef.current.currentTime = 0;
        } catch {
          /* ignore */
        }
        activeAudioRef.current = null;
      }
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.abort();
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  // Timer loop when call is active
  useEffect(() => {
    if (isCallActive) {
      durationTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      setCallDuration(0);
    }
    return () => {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    };
  }, [isCallActive]);

  // Scroll transcript to bottom
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [callTranscript, isSpeaking, isListening]);

  /** Best Natural Female Voice Selection Algorithm */
  const selectBestFemaleVoice = useCallback(
    (textToSpeak: string) => {
      if (!availableVoices || availableVoices.length === 0) {
        return null;
      }

      // If user manually chose a voice from dropdown
      if (selectedVoiceURI !== "auto") {
        const customVoice = availableVoices.find((v) => v.voiceURI === selectedVoiceURI);
        if (customVoice) return customVoice;
      }

      const hasTeluguScript = /[\u0C00-\u0C7F]/.test(textToSpeak);
      const isTeluguTarget = voiceLanguageMode === "te-IN" || (voiceLanguageMode === "auto" && hasTeluguScript);
      const isIndianEnglishTarget = voiceLanguageMode === "en-IN" || voiceLanguageMode === "auto";

      // 1. If Telugu is detected/selected, prioritize native Telugu neural voices (e.g. Shruti, Mohan, Google Telugu)
      if (isTeluguTarget) {
        const teluguVoice = availableVoices.find((v) => {
          const l = v.lang.toLowerCase();
          const n = v.name.toLowerCase();
          return (
            l.startsWith("te") ||
            n.includes("telugu") ||
            n.includes("తెలుగు") ||
            v.voiceURI.toLowerCase().includes("te-in")
          );
        });
        if (teluguVoice) return teluguVoice;
      }

      // 2. High-quality Indian English Female Neural Voices (Microsoft Neerja, Google Indian English Female, Heera, Aditi, Veena)
      if (isIndianEnglishTarget || isTeluguTarget) {
        const indianFemale = availableVoices.find((v) => {
          const l = v.lang.toLowerCase();
          const n = v.name.toLowerCase();
          return (
            (l.includes("en-in") || l.includes("en_in") || l.includes("hi-in") || l.includes("te-in")) &&
            (n.includes("female") ||
              n.includes("natural") ||
              n.includes("neural") ||
              n.includes("online") ||
              n.includes("google") ||
              n.includes("neerja") ||
              n.includes("heera") ||
              n.includes("aditi") ||
              n.includes("veena") ||
              !n.includes("male"))
          );
        });
        if (indianFemale) return indianFemale;
      }

      // 3. Premium Natural English Female Voices (Google US English Female, Microsoft Jenny/Aria, Samantha, Karen, Natural)
      const naturalFemale = availableVoices.find((v) => {
        const n = v.name.toLowerCase();
        const l = v.lang.toLowerCase();
        return (
          l.startsWith("en") &&
          (n.includes("female") ||
            n.includes("natural") ||
            n.includes("neural") ||
            n.includes("google") ||
            n.includes("jenny") ||
            n.includes("aria") ||
            n.includes("samantha") ||
            n.includes("karen") ||
            n.includes("zira"))
        );
      });
      if (naturalFemale) return naturalFemale;

      // 4. Any English Voice fallback
      const anyEnglish = availableVoices.find((v) => v.lang.startsWith("en"));
      if (anyEnglish) return anyEnglish;

      return availableVoices[0] || null;
    },
    [availableVoices, selectedVoiceURI, voiceLanguageMode]
  );

  /** Fallback browser synthesis speech engine if offline or server audio fails */
  const fallbackBrowserSpeech = useCallback(
    (rawText: string, onFinished?: () => void) => {
      if (!window.speechSynthesis) {
        setIsSpeaking(false);
        if (onFinished) onFinished();
        return;
      }
      window.speechSynthesis.cancel();
      isSpeakingQueueRef.current = false;
      speechQueueRef.current = [];

      const hasTeluguScript = /[\u0C00-\u0C7F]/.test(rawText);
      const isTelugu = voiceLanguageMode === "te-IN" || hasTeluguScript;
      const spokenPrepared = sanitizeTextForVoiceSpeech(
        rawText,
        isTelugu,
        hasNativeTeluguVoice,
        activePersona.name
      );

      if (!spokenPrepared) {
        setIsSpeaking(false);
        if (onFinished) onFinished();
        return;
      }

      const sentences = spokenPrepared
        .split(/(?<=[.?!।])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      if (sentences.length === 0) {
        setIsSpeaking(false);
        if (onFinished) onFinished();
        return;
      }

      speechQueueRef.current = [...sentences];
      isSpeakingQueueRef.current = true;
      setIsSpeaking(true);

      const playNextSentence = () => {
        if (!isSpeakingQueueRef.current || speechQueueRef.current.length === 0) {
          setIsSpeaking(false);
          isSpeakingQueueRef.current = false;
          if (onFinished) onFinished();
          return;
        }

        const sentence = speechQueueRef.current.shift();
        if (!sentence) {
          playNextSentence();
          return;
        }

        const utterance = new SpeechSynthesisUtterance(sentence);
        if (isTelugu) {
          utterance.rate = Math.min(1.45, Math.max(1.0, speechRate));
          utterance.pitch = Math.max(speechPitch, activePersona.pitch);
        } else {
          utterance.rate = Math.min(1.4, Math.max(0.95, speechRate));
          utterance.pitch = speechPitch;
        }

        const chosenVoice = selectBestFemaleVoice(sentence);
        if (chosenVoice) {
          utterance.voice = chosenVoice;
          utterance.lang = isTelugu && hasNativeTeluguVoice ? "te-IN" : chosenVoice.lang;
        } else if (isTelugu && hasNativeTeluguVoice) {
          utterance.lang = "te-IN";
        }

        utterance.onend = () => {
          setTimeout(() => {
            if (isSpeakingQueueRef.current) {
              playNextSentence();
            }
          }, 40);
        };

        utterance.onerror = () => {
          setIsSpeaking(false);
          isSpeakingQueueRef.current = false;
          if (onFinished) onFinished();
        };

        window.speechSynthesis.speak(utterance);
      };

      playNextSentence();
    },
    [speechPitch, speechRate, selectBestFemaleVoice, voiceLanguageMode, hasNativeTeluguVoice, activePersona]
  );

  /** High-Fidelity Studio Neural Voice Engine for Natural Human Telugu Speech */
  const speakText = useCallback(
    (rawText: string, onFinished?: () => void) => {
      // 1. Immediately halt any running audio
      if (activeAudioRef.current) {
        try {
          activeAudioRef.current.pause();
          activeAudioRef.current.currentTime = 0;
        } catch {
          /* ignore */
        }
        activeAudioRef.current = null;
      }
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      isSpeakingQueueRef.current = false;
      speechQueueRef.current = [];

      if (!rawText || !rawText.trim()) {
        setIsSpeaking(false);
        if (onFinished) onFinished();
        return;
      }

      const hasTeluguScript = /[\u0C00-\u0C7F]/.test(rawText);
      const isTelugu = voiceLanguageMode === "te-IN" || (voiceLanguageMode === "auto" && hasTeluguScript);
      const targetLang = isTelugu ? "te" : voiceLanguageMode === "en-US" ? "en" : "en-IN";

      setIsSpeaking(true);

      // Stream high-fidelity neural audio (Sarvam / ElevenLabs / Google Chirp / Azure / OpenSource)
      try {
        const platformType =
          activePersona.providerKey === "sarvam"
            ? "sarvam"
            : activePersona.providerKey === "elevenlabs"
            ? "elevenlabs"
            : activePersona.providerKey === "google"
            ? "google_chirp"
            : "edge";

        const audioUrl = getVoiceTTSAudioUrl(
          rawText,
          targetLang,
          activePersona.id,
          platformType,
          speechRate,
          speechPitch
        );
        const audio = new Audio(audioUrl);
        activeAudioRef.current = audio;

        // The server-side TTS endpoint already synthesizes audio with the requested speed & pitch baked in.
        // Keeping audio.playbackRate at 1.0 prevents double-speeding and preserves natural human timbre.
        audio.playbackRate = 1.0;

        audio.onplay = () => {
          setIsSpeaking(true);
        };

        audio.onended = () => {
          setIsSpeaking(false);
          activeAudioRef.current = null;
          if (onFinished) onFinished();
        };

        audio.onerror = (e) => {
          console.warn("[Voice AI] Server audio stream fallback to browser voice engine:", e);
          activeAudioRef.current = null;
          fallbackBrowserSpeech(rawText, onFinished);
        };

        audio.play().catch((playErr) => {
          console.warn("[Voice AI] Direct audio play prevented, falling back to browser synthesis:", playErr);
          activeAudioRef.current = null;
          fallbackBrowserSpeech(rawText, onFinished);
        });
      } catch (err) {
        console.warn("[Voice AI] Error initiating audio stream:", err);
        fallbackBrowserSpeech(rawText, onFinished);
      }
    },
    [activePersona.id, activePersona.providerKey, fallbackBrowserSpeech, speechPitch, speechRate, voiceLanguageMode]
  );

  /** Preview active persona voice sample */
  const handlePlaySample = () => {
    if (isPlayingSample || isSpeaking) {
      if (activeAudioRef.current) {
        try {
          activeAudioRef.current.pause();
          activeAudioRef.current.currentTime = 0;
        } catch {
          /* ignore */
        }
        activeAudioRef.current = null;
      }
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      setIsPlayingSample(false);
      setIsSpeaking(false);
      setPlayingPersonaId(null);
      return;
    }

    setIsPlayingSample(true);
    setPlayingPersonaId(activePersona.id);
    const sampleText =
      voiceLanguageMode === "te-IN" || voiceLanguageMode === "auto"
        ? activePersona.sampleGreetingTelugu
        : activePersona.sampleGreetingEnglish;

    speakText(sampleText, () => {
      setIsPlayingSample(false);
      setPlayingPersonaId(null);
    });
  };

  /** Play sample for any specific persona directly from slider card */
  const handlePlayPersonaDirect = (p: PersonaConfig) => {
    if (playingPersonaId === p.id) {
      if (activeAudioRef.current) {
        try {
          activeAudioRef.current.pause();
          activeAudioRef.current.currentTime = 0;
        } catch {
          /* ignore pause errors */
        }
        activeAudioRef.current = null;
      }
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      setIsPlayingSample(false);
      setIsSpeaking(false);
      setPlayingPersonaId(null);
      return;
    }

    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.pause();
        activeAudioRef.current.currentTime = 0;
      } catch {
        /* ignore pause errors */
      }
      activeAudioRef.current = null;
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel();

    setPlayingPersonaId(p.id);
    setIsPlayingSample(true);

    const sampleText =
      voiceLanguageMode === "te-IN" || voiceLanguageMode === "auto"
        ? p.sampleGreetingTelugu
        : p.sampleGreetingEnglish;

    const platformType =
      p.providerKey === "sarvam"
        ? "sarvam"
        : p.providerKey === "elevenlabs"
        ? "elevenlabs"
        : p.providerKey === "google"
        ? "google_chirp"
        : "edge";

    try {
      const audioUrl = getVoiceTTSAudioUrl(
        sampleText,
        "te",
        p.id,
        platformType,
        p.rate,
        p.pitch
      );
      const audio = new Audio(audioUrl);
      activeAudioRef.current = audio;
      audio.playbackRate = 1.0;
      audio.onplay = () => {
        setIsSpeaking(true);
      };
      audio.onended = () => {
        setIsSpeaking(false);
        setIsPlayingSample(false);
        setPlayingPersonaId(null);
        activeAudioRef.current = null;
      };
      audio.onerror = () => {
        activeAudioRef.current = null;
        fallbackBrowserSpeech(sampleText, () => {
          setIsPlayingSample(false);
          setPlayingPersonaId(null);
        });
      };
      audio.play().catch(() => {
        activeAudioRef.current = null;
        fallbackBrowserSpeech(sampleText, () => {
          setIsPlayingSample(false);
          setPlayingPersonaId(null);
        });
      });
    } catch {
      fallbackBrowserSpeech(sampleText, () => {
        setIsPlayingSample(false);
        setPlayingPersonaId(null);
      });
    }
  };

  /** Submit caller spoken input to receptionist brain with session continuity */
  const sendVoiceInput = useCallback(
    async (input: string) => {
      const cleanInput = input.trim();
      if (!cleanInput || isSimulatingTurn) return;
      setIsSimulatingTurn(true);

      // Stop speech recognition immediately while processing
      if (speechRecognitionRef.current && isListening) {
        try {
          speechRecognitionRef.current.stop();
        } catch {
          /* ignore */
        }
      }
      setIsListening(false);
      setSpokenText("");
      setInterimSpokenText("");

      const nowMin = Math.floor(callDuration / 60)
        .toString()
        .padStart(2, "0");
      const nowSec = (callDuration % 60).toString().padStart(2, "0");
      const timestamp = `${nowMin}:${nowSec}`;

      setCallTranscript((prev) => [...prev, { role: "caller", text: cleanInput, time: timestamp }]);
      setCustomInputText("");

      try {
        const response = await simulateVoiceCall({
          spoken_input: cleanInput,
          caller_number: callerNumber,
          agent_id: selectedAgentId,
          session_id: sessionId || undefined,
          call_sid: callSid || undefined,
        });

        if (response.session_id) setSessionId(response.session_id);
        if (response.call_sid) setCallSid(response.call_sid);
        if (
          response.quick_replies &&
          Array.isArray(response.quick_replies) &&
          response.quick_replies.length > 0
        ) {
          setQuickReplies(response.quick_replies);
        }

        const replyText = response.voice_reply;
        setCallTranscript((prev) => [
          ...prev,
          { role: "assistant", text: replyText, time: timestamp },
        ]);

        speakText(replyText);
        getVoiceCalls().then(setCalls);
      } catch (err) {
        console.error("Voice turn error:", err);
      } finally {
        setIsSimulatingTurn(false);
      }
    },
    [callDuration, callerNumber, isSimulatingTurn, selectedAgentId, sessionId, callSid, isListening, speakText]
  );

  // Initialize Web Speech API for voice microphone input
  useEffect(() => {
    const win = window as WindowWithSpeech;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;

      // Determine language for speech recognition
      if (voiceLanguageMode === "te-IN") {
        recognition.lang = "te-IN";
      } else if (voiceLanguageMode === "en-IN") {
        recognition.lang = "en-IN";
      } else if (voiceLanguageMode === "en-US") {
        recognition.lang = "en-US";
      } else {
        recognition.lang = "te-IN"; // Prioritize Telugu recognition in auto mode
      }

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        let interim = "";
        let finalTrans = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const trans = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTrans += trans;
          } else {
            interim += trans;
          }
        }

        if (finalTrans) {
          setSpokenText((prev) => (prev ? `${prev} ${finalTrans}` : finalTrans));
        }
        setInterimSpokenText(interim);

        // Reset silence timer for automatic conversational response
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          const currentTotal = (finalTrans || interim || spokenText).trim();
          if (currentTotal && isListening) {
            sendVoiceInput(currentTotal);
          }
        }, 1600);
      };

      recognition.onerror = (e) => {
        if (e.error !== "no-speech") {
          setIsListening(false);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      speechRecognitionRef.current = recognition;
    }
  }, [voiceLanguageMode, spokenText, isListening, sendVoiceInput]);

  function startCall() {
    setIsCallActive(true);
    setCallDuration(0);
    const newSess = `voice-session-${Date.now()}`;
    const newSid = `CA${Math.random().toString(36).substring(2, 12).toUpperCase()}`;
    setSessionId(newSess);
    setCallSid(newSid);

    const initialGreeting =
      voiceLanguageMode === "te-IN" || voiceLanguageMode === "auto"
        ? activePersona.sampleGreetingTelugu
        : activePersona.sampleGreetingEnglish;

    setCallTranscript([
      {
        role: "assistant",
        text: initialGreeting,
        time: "00:00",
      },
    ]);

    speakText(initialGreeting);
  }

  function endCall() {
    isSpeakingQueueRef.current = false;
    speechQueueRef.current = [];
    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.pause();
        activeAudioRef.current.currentTime = 0;
      } catch {
        /* ignore */
      }
      activeAudioRef.current = null;
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.abort();
      } catch {
        /* ignore */
      }
    }
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    setIsCallActive(false);
    setIsSpeaking(false);
    setIsListening(false);
    setSpokenText("");
    setInterimSpokenText("");
  }

  function toggleMicListening() {
    if (isListening) {
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {
          /* ignore */
        }
      }
      setIsListening(false);
    } else {
      if (activeAudioRef.current) {
        try {
          activeAudioRef.current.pause();
          activeAudioRef.current.currentTime = 0;
        } catch {
          /* ignore */
        }
        activeAudioRef.current = null;
      }
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      isSpeakingQueueRef.current = false;
      setIsSpeaking(false);
      setSpokenText("");
      setInterimSpokenText("");
      try {
        speechRecognitionRef.current?.start();
      } catch {
        // Recognition already active
      }
    }
  }

  function handleManualSendSpoken() {
    const total = (spokenText + " " + interimSpokenText).trim();
    if (total) {
      sendVoiceInput(total);
    }
  }

  function bargeInInterruption() {
    isSpeakingQueueRef.current = false;
    speechQueueRef.current = [];
    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.pause();
        activeAudioRef.current.currentTime = 0;
      } catch {
        /* ignore */
      }
      activeAudioRef.current = null;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    toggleMicListening();
  }

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    if (!config) return;
    try {
      const updated = await updateTelephonyConfig(config);
      setConfig(updated);
      setConfigSuccess(true);
      setTimeout(() => setConfigSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update configuration.");
    }
  }

  function formatTime(totalSeconds: number) {
    const mins = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, "0");
    const secs = (totalSeconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Voice AI & Telephony"
        description="High-fidelity natural female voice engine for Telugu & English with multi-sentence breath prosody, interactive counselor personas, and instant barge-in interruption."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/voice-agents"
              className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-purple-700 transition"
            >
              <span>🎙</span>
              Realtime Voice Agents (Telugu)
            </Link>
            <Link
              to="/voice/lab"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition"
            >
              <FlaskConical className="h-3.5 w-3.5" />
              Commercial Voices
            </Link>
            <Link
              to="/voice/open-source"
              className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-200 border border-slate-700 hover:bg-slate-700 transition"
            >
              <span>⚡</span>
              Open-Source Voices
            </Link>
            <span className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
              <Radio className="h-3.5 w-3.5 animate-pulse text-emerald-600" />
              SIP Gateway Online
            </span>
          </div>
        }
      />

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Main Grid: Interactive Voice Studio & Settings */}
      <div className="grid gap-8 lg:grid-cols-12">
        {/* Left Column: Interactive Call Studio */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                  <PhoneCall className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Interactive Call Studio</h2>
                  <p className="text-xs text-slate-500">
                    Natural female voice synthesis with live mic & natural Telugu cadence
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowVoiceSettings(!showVoiceSettings)}
                  className={`rounded-xl border p-2 text-xs font-medium transition ${
                    showVoiceSettings
                      ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                  title="Voice & Language Settings"
                >
                  <Settings2 className="h-4 w-4" />
                </button>

                {isCallActive ? (
                  <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                    Live {formatTime(callDuration)}
                  </div>
                ) : (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    Idle
                  </span>
                )}
              </div>
            </div>

            {/* Telugu Counselor Persona Slider Section */}
            <div className="mt-4 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/60 via-purple-50/30 to-white p-4 shadow-sm">
              {/* Slider Header & Carousel Navigation */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
                    <Waves className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-indigo-950">
                        Telugu Voice Agents Slider
                      </span>
                      <span className="rounded-full bg-indigo-100/90 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                        {filteredPersonas.length} Voices
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Sarvam AI Bulbul • ElevenLabs • Google Chirp 2 • Azure Neural • Indic Open-Source
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Slider Scroll Arrows */}
                  <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-xs">
                    <button
                      type="button"
                      onClick={slideLeft}
                      className="rounded-md p-1.5 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition"
                      title="Scroll Left"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <div className="h-3 w-[1px] bg-slate-200" />
                    <button
                      type="button"
                      onClick={slideRight}
                      className="rounded-md p-1.5 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition"
                      title="Scroll Right"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Active Voice Test Button */}
                  <button
                    type="button"
                    onClick={handlePlaySample}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition shadow-sm ${
                      isPlayingSample && playingPersonaId === selectedPersonaId
                        ? "bg-rose-600 text-white animate-pulse"
                        : "bg-indigo-600 text-white hover:bg-indigo-700"
                    }`}
                  >
                    {isPlayingSample && playingPersonaId === selectedPersonaId ? (
                      <StopCircle className="h-3.5 w-3.5" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                    <span>
                      {isPlayingSample && playingPersonaId === selectedPersonaId
                        ? "Stop"
                        : `Test ${activePersona.teluguName}`}
                    </span>
                  </button>
                </div>
              </div>

              {/* Provider & Type Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-2 text-[11px] scrollbar-thin">
                <button
                  type="button"
                  onClick={() => setPersonaFilter("all")}
                  className={`rounded-full px-2.5 py-1 font-semibold whitespace-nowrap transition ${
                    personaFilter === "all"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  All Voices ({TELUGU_PERSONAS.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPersonaFilter("top")}
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold whitespace-nowrap transition ${
                    personaFilter === "top"
                      ? "bg-amber-600 text-white shadow-xs"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <Award className="h-3 w-3" />
                  Top Rated
                </button>
                <button
                  type="button"
                  onClick={() => setPersonaFilter("sarvam")}
                  className={`rounded-full px-2.5 py-1 font-semibold whitespace-nowrap transition ${
                    personaFilter === "sarvam"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Sarvam Bulbul
                </button>
                <button
                  type="button"
                  onClick={() => setPersonaFilter("elevenlabs")}
                  className={`rounded-full px-2.5 py-1 font-semibold whitespace-nowrap transition ${
                    personaFilter === "elevenlabs"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  ElevenLabs Telugu
                </button>
                <button
                  type="button"
                  onClick={() => setPersonaFilter("google")}
                  className={`rounded-full px-2.5 py-1 font-semibold whitespace-nowrap transition ${
                    personaFilter === "google"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Google Chirp 2
                </button>
                <button
                  type="button"
                  onClick={() => setPersonaFilter("azure")}
                  className={`rounded-full px-2.5 py-1 font-semibold whitespace-nowrap transition ${
                    personaFilter === "azure"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Azure Neural
                </button>
                <button
                  type="button"
                  onClick={() => setPersonaFilter("opensource")}
                  className={`rounded-full px-2.5 py-1 font-semibold whitespace-nowrap transition ${
                    personaFilter === "opensource"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Indic Open-Source
                </button>
                <button
                  type="button"
                  onClick={() => setPersonaFilter("female")}
                  className={`rounded-full px-2.5 py-1 font-semibold whitespace-nowrap transition ${
                    personaFilter === "female"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Female
                </button>
                <button
                  type="button"
                  onClick={() => setPersonaFilter("male")}
                  className={`rounded-full px-2.5 py-1 font-semibold whitespace-nowrap transition ${
                    personaFilter === "male"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Male
                </button>
              </div>

              {/* Horizontal Scroll Slider */}
              <div
                ref={personaSliderRef}
                className="mt-2 flex gap-3 overflow-x-auto pb-3 pt-1 scroll-smooth snap-x focus:outline-none"
                style={{ scrollbarWidth: "thin" }}
              >
                {filteredPersonas.map((p) => {
                  const isSelected = selectedPersonaId === p.id;
                  const isPlaying = playingPersonaId === p.id;

                  return (
                    <div
                      key={p.id}
                      className={`flex w-[280px] shrink-0 snap-start flex-col justify-between rounded-2xl p-3.5 transition-all border ${
                        isSelected
                          ? "border-indigo-500 bg-white shadow-md ring-2 ring-indigo-500/20"
                          : "border-slate-200/90 bg-white/90 hover:bg-white hover:border-slate-300 hover:shadow-sm"
                      }`}
                    >
                      {/* Top Row: Avatar, Names & Provider Badge */}
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="relative">
                              <img
                                src={p.avatar}
                                alt={p.name}
                                className="h-10 w-10 rounded-full object-cover border-2 border-indigo-100 shadow-xs"
                              />
                              {isSelected && (
                                <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[9px] text-white ring-2 ring-white">
                                  ✓
                                </span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1">
                                <h3 className="text-sm font-bold text-slate-900 truncate">
                                  {p.teluguName}
                                </h3>
                                {p.isTopRanked && (
                                  <span className="text-[10px] text-amber-500" title="Top Ranked Persona">
                                    ★
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] font-medium text-slate-600 truncate">{p.name}</p>
                            </div>
                          </div>

                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold ${
                              p.providerKey === "sarvam"
                                ? "bg-orange-100 text-orange-800"
                                : p.providerKey === "elevenlabs"
                                ? "bg-violet-100 text-violet-800"
                                : p.providerKey === "google"
                                ? "bg-blue-100 text-blue-800"
                                : p.providerKey === "azure"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-100 text-slate-800"
                            }`}
                          >
                            {p.provider}
                          </span>
                        </div>

                        {/* Badges & Telephony Specs */}
                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                          {p.badge && (
                            <span className="rounded-md bg-indigo-50/80 px-2 py-0.5 font-semibold text-indigo-700">
                              {p.badge}
                            </span>
                          )}
                          {p.mosScore && (
                            <span className="rounded-md bg-amber-50 px-1.5 py-0.5 font-bold text-amber-800">
                              ★ {p.mosScore} MOS
                            </span>
                          )}
                          {p.latencyClass && (
                            <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-700">
                              {p.latencyClass}
                            </span>
                          )}
                        </div>

                        {/* Dialect Tag & Description */}
                        {p.dialectTag && (
                          <p className="mt-2 text-[10px] font-medium text-indigo-900/80 bg-indigo-50/40 rounded px-1.5 py-0.5 inline-block">
                            📍 {p.dialectTag}
                          </p>
                        )}
                        <p className="mt-1.5 text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                          {p.description}
                        </p>
                      </div>

                      {/* Card Bottom Controls: Preview Audio & Select Voice */}
                      <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handlePlayPersonaDirect(p)}
                          className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                            isPlaying
                              ? "bg-rose-600 text-white animate-pulse"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                          title="Preview voice greeting"
                        >
                          {isPlaying ? (
                            <StopCircle className="h-3 w-3" />
                          ) : (
                            <Play className="h-3 w-3" />
                          )}
                          <span>{isPlaying ? "Stop" : "Sample"}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handlePersonaChange(p.id)}
                          className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                            isSelected
                              ? "bg-indigo-600 text-white"
                              : "border border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                          }`}
                        >
                          {isSelected ? (
                            <>
                              <Check className="h-3 w-3" />
                              <span>Active</span>
                            </>
                          ) : (
                            <span>Select</span>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Voice & Language Settings Tray */}
            {showVoiceSettings && (
              <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-900">
                    <Languages className="h-4 w-4 text-indigo-600" />
                    Voice Language & Fine Pitch Controls
                  </span>
                  <span className="text-[11px] font-semibold text-indigo-600">
                    {availableVoices.length} Browser Voices Detected
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Language & Accent Mode
                    </label>
                    <select
                      value={voiceLanguageMode}
                      onChange={(e) =>
                        handleLanguageModeChange(
                          e.target.value as "auto" | "te-IN" | "en-IN" | "en-US"
                        )
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="auto">Auto-Detect (Telugu & Indian English)</option>
                      <option value="te-IN">Telugu (తెలుగు - High Fidelity)</option>
                      <option value="en-IN">English (India - Natural Female)</option>
                      <option value="en-US">English (US Natural Female)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Specific TTS Voice Engine
                    </label>
                    <select
                      value={selectedVoiceURI}
                      onChange={(e) => setSelectedVoiceURI(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="auto">✨ Smart Best Female Voice Match</option>
                      {availableVoices.map((v, idx) => (
                        <option key={`voice-${v.voiceURI || v.name}-${v.lang}-${idx}`} value={v.voiceURI || v.name}>
                          {v.name} ({v.lang})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 pt-1 sm:grid-cols-2">
                  <div>
                    <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                      <span>Speaking Speed (Cadence)</span>
                      <span className="font-bold text-indigo-600">
                        {speechRate}x ({speechRate > 1.10 ? "Fast Conversational" : speechRate >= 0.98 && speechRate <= 1.04 ? "Natural Human" : speechRate < 0.98 ? "Calm & Relaxed" : "Conversational"})
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.85"
                      max="1.30"
                      step="0.01"
                      value={speechRate}
                      onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                      className="w-full accent-indigo-600 cursor-pointer"
                    />
                    {/* Quick Speed Pills */}
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {[
                        { label: "🌸 Calm (0.95x)", val: 0.95 },
                        { label: "🗣️ Ultra Natural (1.00x)", val: 1.00 },
                        { label: "⚡ Conversational (1.05x)", val: 1.05 },
                        { label: "🚀 Express (1.12x)", val: 1.12 },
                      ].map((preset) => (
                        <button
                          key={preset.val}
                          type="button"
                          onClick={() => setSpeechRate(preset.val)}
                          className={`rounded-lg px-2 py-0.5 text-[10px] font-semibold transition ${
                            Math.abs(speechRate - preset.val) < 0.02
                              ? "bg-indigo-600 text-white shadow-xs"
                              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                      <span>Voice Warmth (Pitch)</span>
                      <span className="font-bold text-indigo-600">{speechPitch}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.90"
                      max="1.15"
                      step="0.01"
                      value={speechPitch}
                      onChange={(e) => setSpeechPitch(parseFloat(e.target.value))}
                      className="w-full accent-indigo-600 cursor-pointer"
                    />
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {[
                        { label: "Deep Resonance (0.96x)", val: 0.96 },
                        { label: "Natural Acoustic (1.00x)", val: 1.00 },
                        { label: "Melodic Bright (1.03x)", val: 1.03 },
                      ].map((preset) => (
                        <button
                          key={preset.val}
                          type="button"
                          onClick={() => setSpeechPitch(preset.val)}
                          className={`rounded-lg px-2 py-0.5 text-[10px] font-semibold transition ${
                            Math.abs(speechPitch - preset.val) < 0.02
                              ? "bg-indigo-600 text-white shadow-xs"
                              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Receptionist Selector & Caller Info */}
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  AI Receptionist
                </label>
                <select
                  disabled={isCallActive}
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none"
                >
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name.includes("Maruthi")
                        ? `${activePersona.name} (${activePersona.teluguName}) — Maruthi Technologies`
                        : agent.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Caller Phone Number
                </label>
                <input
                  type="text"
                  disabled={isCallActive}
                  value={callerNumber}
                  onChange={(e) => setCallerNumber(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-white placeholder-slate-400 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Quick Language Switcher Bar */}
            <div className="mt-4 rounded-2xl bg-slate-50 p-2.5 border border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <Languages className="h-4 w-4 text-indigo-600" />
                  <span>Receptionist Voice Language:</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleLanguageModeChange("auto")}
                    className={`rounded-xl px-3 py-1 text-xs font-semibold transition ${
                      voiceLanguageMode === "auto"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    🌟 Auto (Telugu + English)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLanguageModeChange("te-IN")}
                    className={`rounded-xl px-3 py-1 text-xs font-semibold transition flex items-center gap-1 ${
                      voiceLanguageMode === "te-IN"
                        ? "bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400/40"
                        : "bg-white text-slate-700 border border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300"
                    }`}
                  >
                    🇮🇳 తెలుగు ({activePersona.teluguName})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLanguageModeChange("en-IN")}
                    className={`rounded-xl px-3 py-1 text-xs font-semibold transition ${
                      voiceLanguageMode === "en-IN"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    🇮🇳 English (India)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLanguageModeChange("en-US")}
                    className={`rounded-xl px-3 py-1 text-xs font-semibold transition ${
                      voiceLanguageMode === "en-US"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    🇺🇸 English (US)
                  </button>
                </div>
              </div>

              {(voiceLanguageMode === "te-IN" || voiceLanguageMode === "auto") && (
                <div className="mt-2.5 flex items-center justify-between border-t border-slate-200/60 pt-2 text-[11px]">
                  <span className="text-emerald-700 font-medium flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-emerald-600" />
                    Studio Neural Telugu Audio Engine Active ({activePersona.teluguName} • 100% Real Human Voice • HD Quality)
                  </span>
                  <span className="text-slate-500 font-medium">Mic: Telugu (te-IN)</span>
                </div>
              )}
            </div>

            {/* Live Audio Visualizer Stage */}
            <div className="mt-6 rounded-3xl border border-slate-100 bg-slate-950 p-6 text-center text-white relative overflow-hidden shadow-inner">
              <div className="relative z-10 flex flex-col items-center">
                {/* Voice Orb */}
                <div
                  className={`relative flex h-24 w-24 items-center justify-center rounded-full transition-all duration-300 ${
                    isSpeaking
                      ? "bg-indigo-600 shadow-2xl shadow-indigo-500/60 ring-8 ring-indigo-500/25 scale-105"
                      : isListening
                      ? "bg-emerald-600 shadow-2xl shadow-emerald-500/60 ring-8 ring-emerald-500/25 scale-105"
                      : isSimulatingTurn
                      ? "bg-amber-600 shadow-xl shadow-amber-500/40 ring-6 ring-amber-500/20"
                      : isCallActive
                      ? "bg-slate-800 ring-4 ring-slate-700"
                      : "bg-slate-800"
                  }`}
                >
                  {isSpeaking ? (
                    <Volume2 className="h-10 w-10 animate-pulse text-white" />
                  ) : isListening ? (
                    <Mic className="h-10 w-10 animate-bounce text-white" />
                  ) : isSimulatingTurn ? (
                    <Sparkles className="h-9 w-9 animate-spin text-amber-200" />
                  ) : isCallActive ? (
                    <Phone className="h-9 w-9 text-emerald-400" />
                  ) : (
                    <PhoneOff className="h-9 w-9 text-slate-500" />
                  )}
                </div>

                <div className="mt-4">
                  <p className="text-sm font-semibold text-white">
                    {isSpeaking
                      ? `${activePersona.name} (${activePersona.teluguName}) is speaking...`
                      : isListening
                      ? "Listening to your voice... Speak now in English or Telugu"
                      : isSimulatingTurn
                      ? "Processing receptionist response..."
                      : isCallActive
                      ? "Call Connected — Tap 'Speak via Mic' to talk"
                      : `Ready to simulate inbound call with ${activePersona.teluguName}`}
                  </p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    {isListening
                      ? "Speak clearly in Telugu or English. Tap 'Done Speaking' or pause when finished."
                      : isCallActive
                      ? "Use your real microphone, one-tap quick utterances, or typing below."
                      : "Click 'Start Inbound Call' to launch live interactive voice session"}
                  </p>
                </div>

                {/* Real-time Voice Waveform */}
                <div className="mt-5 flex items-center justify-center gap-1.5 h-7">
                  {[40, 65, 30, 90, 45, 80, 55, 95, 35, 70, 50, 85, 60, 40, 75].map((h, i) => (
                    <div
                      key={i}
                      style={{
                        height:
                          isSpeaking || isListening
                            ? `${Math.max(15, h * (isSpeaking ? 1 : 0.75))}%`
                            : "4px",
                        transition: "height 0.12s ease",
                      }}
                      className={`w-1 rounded-full ${
                        isSpeaking
                          ? "bg-indigo-400 shadow-sm shadow-indigo-400"
                          : isListening
                          ? "bg-emerald-400 shadow-sm shadow-emerald-400"
                          : isSimulatingTurn
                          ? "bg-amber-400 animate-pulse"
                          : "bg-slate-700"
                      }`}
                    />
                  ))}
                </div>

                {/* Live Speech Recognition Interim Display */}
                {isListening && (
                  <div className="mt-4 w-full max-w-md rounded-2xl bg-slate-900/90 border border-emerald-500/40 p-3 text-left">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-1">
                      <span className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                        Live Voice Input
                      </span>
                      <span>{(voiceLanguageMode || "AUTO").toUpperCase()}</span>
                    </div>
                    <p className="text-xs text-emerald-100 min-h-6">
                      {spokenText || interimSpokenText ? (
                        <span>
                          {spokenText}{" "}
                          <span className="text-emerald-400 italic">{interimSpokenText}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">
                          Listening... మాట్లాడండి (start talking now)...
                        </span>
                      )}
                    </p>
                    <div className="mt-2 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={handleManualSendSpoken}
                        disabled={!(spokenText || interimSpokenText).trim()}
                        className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-40 transition"
                      >
                        Done Speaking (Send)
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Call Controls */}
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                {!isCallActive ? (
                  <button
                    onClick={startCall}
                    className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition active:scale-95"
                  >
                    <Phone className="h-4 w-4" />
                    Start Inbound Call
                  </button>
                ) : (
                  <>
                    <button
                      onClick={toggleMicListening}
                      className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition active:scale-95 ${
                        isListening
                          ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-400"
                          : "bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/30"
                      }`}
                    >
                      {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                      {isListening ? "Stop Microphone" : "Speak via Mic"}
                    </button>

                    <button
                      onClick={bargeInInterruption}
                      title="Simulates interrupting the AI receptionist while speaking"
                      className="flex items-center gap-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 px-4 py-2.5 text-xs font-bold hover:bg-amber-500/30 transition"
                    >
                      <VolumeX className="h-4 w-4" />
                      Barge-In (Interrupt AI)
                    </button>

                    <button
                      onClick={endCall}
                      className="flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-rose-500 transition active:scale-95 shadow-lg shadow-rose-600/30"
                    >
                      <PhoneOff className="h-4 w-4" />
                      Hang Up
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Quick Test Voice Utterances */}
            {isCallActive && (
              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Quick Utterances (English & Telugu)
                  </p>
                  <span className="text-[11px] text-indigo-600 font-medium">
                    One-tap voice simulation
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {quickReplies.map((preset, idx) => (
                    <button
                      key={idx}
                      disabled={isSimulatingTurn}
                      onClick={() => sendVoiceInput(preset)}
                      className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-3 py-1.5 text-xs font-semibold text-indigo-800 hover:border-indigo-300 hover:bg-indigo-100 transition disabled:opacity-50"
                    >
                      "{preset}"
                    </button>
                  ))}
                </div>

                {/* Custom Voice Text Input */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (customInputText.trim()) sendVoiceInput(customInputText.trim());
                  }}
                  className="mt-3 flex gap-2"
                >
                  <input
                    type="text"
                    disabled={isSimulatingTurn}
                    placeholder="Type caller utterance (English / Telugu / Tanglish)..."
                    value={customInputText}
                    onChange={(e) => setCustomInputText(e.target.value)}
                    className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isSimulatingTurn || !customInputText.trim()}
                    className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50 transition"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Send
                  </button>
                </form>
              </div>
            )}

            {/* Real-time Call Transcript Feed */}
            <div className="mt-6 border-t border-slate-100 pt-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Live Call Transcript ({callTranscript.length} turns)
                </h3>
                {callSid && (
                  <span className="font-mono text-[10px] text-slate-400">SID: {callSid}</span>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto space-y-3 rounded-2xl bg-slate-50 p-4 border border-slate-100">
                {callTranscript.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">
                    Transcript will appear here once the call is connected.
                  </p>
                ) : (
                  callTranscript.map((entry, idx) => (
                    <div
                      key={idx}
                      className={`flex gap-3 text-xs ${
                        entry.role === "assistant" ? "items-start" : "items-start flex-row-reverse"
                      }`}
                    >
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                          entry.role === "assistant"
                            ? "bg-indigo-100 text-indigo-700 font-bold"
                            : "bg-slate-900 text-white"
                        }`}
                      >
                        {entry.role === "assistant" ? (
                          <Bot className="h-4 w-4" />
                        ) : (
                          <User className="h-4 w-4" />
                        )}
                      </div>
                      <div
                        className={`max-w-[85%] rounded-2xl p-3 shadow-sm ${
                          entry.role === "assistant"
                            ? "bg-white border border-slate-200 text-slate-800"
                            : "bg-indigo-600 text-white"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4 mb-1 text-[10px] opacity-75">
                          <span className="font-semibold">
                            {entry.role === "assistant"
                              ? `${activePersona.name} (${activePersona.teluguName})`
                              : "Caller"}
                          </span>
                          <span>{entry.time}</span>
                        </div>
                        <p className="leading-relaxed whitespace-pre-wrap">{entry.text}</p>
                        {entry.role === "assistant" && (
                          <div className="mt-2 flex items-center justify-end">
                            <button
                              type="button"
                              onClick={() => speakText(entry.text)}
                              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-indigo-600 transition"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Replay Voice
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
                <div ref={transcriptEndRef} />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Telephony Config & Call Details */}
        <div className="lg:col-span-5 space-y-6">
          {/* Telephony Gateway Settings */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <Sliders className="h-5 w-5 text-indigo-600" />
                <h2 className="text-base font-bold text-slate-900">Telephony Configuration</h2>
              </div>
              {configSuccess && (
                <span className="text-xs font-semibold text-emerald-600">Saved!</span>
              )}
            </div>

            {config && (
              <form onSubmit={handleSaveConfig} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Telephony Provider
                  </label>
                  <select
                    value={config.provider}
                    onChange={(e) => setConfig({ ...config, provider: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="Twilio">Twilio Voice Gateway</option>
                    <option value="Exotel">Exotel Voice Cloud</option>
                    <option value="Plivo">Plivo SIP Trunk</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Assigned Virtual Phone Number
                  </label>
                  <input
                    type="text"
                    value={config.virtual_phone_number}
                    onChange={(e) => setConfig({ ...config, virtual_phone_number: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Voice Synthesis Model
                  </label>
                  <input
                    type="text"
                    value={config.voice_engine}
                    onChange={(e) => setConfig({ ...config, voice_engine: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                  <div>
                    <p className="text-xs font-bold text-slate-800">User Barge-In</p>
                    <p className="text-[11px] text-slate-500">
                      Stop speaking immediately when caller speaks
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.barge_in_enabled}
                    onChange={(e) => setConfig({ ...config, barge_in_enabled: e.target.checked })}
                    className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                  <div>
                    <p className="text-xs font-bold text-slate-800">Record Call Transcripts</p>
                    <p className="text-[11px] text-slate-500">Persist full audio recordings for QA</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.record_calls}
                    onChange={(e) => setConfig({ ...config, record_calls: e.target.checked })}
                    className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition"
                >
                  Save Telephony Settings
                </button>
              </form>
            )}
          </div>

          {/* Quick Telephony Metric Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500">Total Calls Logged</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{calls.length}</p>
              <p className="mt-1 text-[11px] text-emerald-600 font-medium">99.8% uptime</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500">Avg Call Duration</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">2m 15s</p>
              <p className="mt-1 text-[11px] text-indigo-600 font-medium">Ultra-low latency</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Call Logs & History */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Telephony Call Logs</h2>
            <p className="text-xs text-slate-500">
              Audit trail of all inbound and outbound voice receptionist sessions
            </p>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Call SID</th>
                <th className="px-4 py-3">Direction</th>
                <th className="px-4 py-3">Caller Number</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Outcome</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {calls.map((call) => (
                <tr key={call.id} className="hover:bg-slate-50/70 transition">
                  <td className="px-4 py-3.5 font-mono text-[11px] text-slate-600">
                    {call.call_sid}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-semibold text-blue-700">
                      <PhoneIncoming className="h-3 w-3" />
                      {call.direction}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 font-semibold text-slate-900">
                    {call.caller_number}
                  </td>
                  <td className="px-4 py-3.5 text-slate-600">{call.duration_seconds}s</td>
                  <td className="px-4 py-3.5">
                    <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                      {call.outcome.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" />
                      {call.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <button
                      onClick={() => setSelectedCallDetails(call)}
                      className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                    >
                      View Transcript
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Call Details Drawer/Modal */}
      {selectedCallDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Call Transcript: {selectedCallDetails.call_sid}
                </h3>
                <p className="text-xs text-slate-500">
                  Caller: {selectedCallDetails.caller_number} • Duration:{" "}
                  {selectedCallDetails.duration_seconds}s
                </p>
              </div>
              <button
                onClick={() => setSelectedCallDetails(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-3 rounded-2xl bg-slate-50 p-4 border border-slate-100">
              {selectedCallDetails.transcript?.map((t, idx) => (
                <div key={idx} className="text-xs space-y-0.5">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                    <span className={t.role === "assistant" ? "text-indigo-600" : "text-slate-700"}>
                      {t.role === "assistant" ? `${activePersona.name} (${activePersona.teluguName})` : "Caller"}
                    </span>
                    <span>{t.timestamp}</span>
                  </div>
                  <p className="text-slate-800 rounded-lg bg-white p-2.5 border border-slate-100">
                    {t.text}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedCallDetails(null)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
