import { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Play,
  Square,
  Sparkles,
  Award,
  Layers,
  CheckCircle2,
  Bookmark,
  RefreshCw,
  Phone,
  PhoneCall,
  PhoneOff,
  Volume2,
  Gauge,
  Eye,
  EyeOff,
  Search,
  Plus,
  Trash2,
  BarChart3,
  Bot,
  Zap,
  Key,
  ShieldCheck,
} from "lucide-react";
import PageHeader from "../components/common/PageHeader";
import {
  VOICE_PROVIDERS,
  getAllSpeakers,
  type VoiceProviderId,
  type VoiceSpeaker,
} from "../lib/voiceProviders";
import {
  DEFAULT_PRONUNCIATION_RULES,
  type PronunciationRule,
} from "../lib/responsePlanner";
import {
  playVoiceAudio,
  stopVoiceAudio,
} from "../lib/voiceAudioEngine";
import {
  synthesizeVoiceLab,
  getVoiceTests,
  saveVoiceTest,
  deleteVoiceTest,
  getVoiceFavorites,
  toggleVoiceFavorite,
  getReceptionistVoiceConfig,
  setReceptionistDefaultVoice,
  getPronunciationRules,
  savePronunciationRule,
  deletePronunciationRule,
  getPlatformApiKeys,
  updatePlatformApiKeys,
  type PlatformApiKeysState,
  type VoiceTestRecord,
  type ReceptionistVoiceConfig,
  type SynthesizeResponse,
} from "../api/voiceLab";

// Preset Test Benchmark Scripts
const PURE_TELUGU_SCRIPTS = [
  {
    id: "greet",
    title: "1. Greeting & Institute Introduction",
    tag: "Greeting",
    text: "నమస్కారం అండి! మారుతి టెక్నాలజీస్ ట్రైనింగ్ డెస్క్ కి స్వాగతం. నేను మీ సీనియర్ అడ్మిషన్స్ అడ్వైజర్ నేహని. మన ఇన్‌స్టిట్యూట్‌లో కోర్ పైథాన్ మరియు కోర్ జావా లైవ్ ప్రాజెక్ట్ బ్యాచ్‌లు అందుబాటులో ఉన్నాయి. మీకు ఏ కోర్సు వివరాలు కావాలి?",
  },
  {
    id: "pricing",
    title: "2. Fee & Pricing Details (Currency Normalization)",
    tag: "Pricing",
    text: "కోర్ పైథాన్ ఫీజు ₹4,000 మరియు కోర్ జావా ఫీజు ₹5,000. కోర్సు వ్యవధి 30 నుండి 45 రోజులు.",
  },
  {
    id: "timings",
    title: "3. Batch Timings & Schedules (Time Expansion)",
    tag: "Schedules",
    text: "కొత్త బ్యాచ్‌లు ప్రతి సోమవారం ప్రారంభమవుతాయి. ఉదయం 8 AM to 10 AM మరియు సాయంత్రం 6 PM to 8 PM బ్యాచ్‌లు అందుబాటులో ఉన్నాయి.",
  },
  {
    id: "syllabus",
    title: "4. Curriculum & Live Projects Depth",
    tag: "Curriculum",
    text: "మన వద్ద కోర్ పైథాన్ మరియు కోర్ జావా లైవ్ ప్రాజెక్ట్ బ్యాచ్‌లు అందుబాటులో ఉన్నాయి. పూర్తి సిలబస్ ప్రాక్టికల్ ఓరియెంటెడ్‌గా ఉంటుంది.",
  },
  {
    id: "placement",
    title: "5. Placement Assistance & Certification",
    tag: "Career",
    text: "కోర్సు పూర్తయిన తర్వాత వంద శాతం ఇంటర్వ్యూ ప్రిపరేషన్, రెజ్యూమ్ బిల్డింగ్ మరియు ప్లేస్‌మెంట్ అసిస్టెన్స్ కౌన్సెలర్ ద్వారా అందించబడుతుంది.",
  },
  {
    id: "location",
    title: "6. Location & Ameerpet Campus Visit",
    tag: "Campus",
    text: "మా ఇన్‌స్టిట్యూట్ హైదరాబాద్ అమీర్‌పేట పిల్లర్ నంబర్ 1045 ఎదురుగా ఉంది. మీరు నేరుగా వచ్చి డెమో క్లాస్ వినవచ్చు.",
  },
];

const CODE_MIX_SCRIPTS = [
  {
    id: "tanglish-tech",
    title: "1. Technical Tanglish (Framework & API)",
    tag: "Technical Code-Mix",
    text: "పైథాన్ ఫుల్ స్టాక్ డెవలప్‌మెంట్‌లో జాంజో ఫ్రేమ్‌వర్క్ మరియు ఏపీఐ ఇంటిగ్రేషన్ నేర్పిస్తారు.",
  },
  {
    id: "tanglish-admissions",
    title: "2. Admissions Tanglish (Online Demo & WhatsApp)",
    tag: "Admissions Code-Mix",
    text: "ఆన్‌లైన్ డెమో క్లాస్ అటెండ్ అవ్వడానికి మీ వాట్సాప్ నంబర్‌కి జూమ్ లింక్ షేర్ చేస్తాము.",
  },
  {
    id: "tanglish-counseling",
    title: "3. Counseling Tanglish (Weekend Slot Booking)",
    tag: "Counseling Code-Mix",
    text: "ఈ వీకెండ్‌లో కొత్త బ్యాచ్ స్టార్ట్ అవుతుంది, మీరు స్లాట్ రిజర్వ్ చేసుకోవాలనుకుంటున్నారా?",
  },
];

const SCENARIOS = [
  {
    id: 1,
    title: "Inquiring about Course Fees",
    customerPrompt: "పైథాన్ కోర్సు ఫీజు ఎంత అండి?",
    expectedReply: "మారుతి టెక్నాలజీస్‌లో కోర్ పైథాన్ ఫీజు నాలుగు వేల రూపాయలు మరియు కోర్ జావా ఫీజు ఐదు వేల రూపాయలు. మీకు ఏ కోర్సులో అడ్మిషన్ కావాలి?",
    intent: "fees_inquiry",
  },
  {
    id: 2,
    title: "Ameerpet Batch Timings",
    customerPrompt: "క్లాసెస్ ఎప్పుడు ఉంటాయి? బ్యాచ్ టైమింగ్స్ చెప్పండి.",
    expectedReply: "మన వద్ద మార్నింగ్ 8 AM నుండి 10 AM, మరియు ఈవినింగ్ 6 PM నుండి 8 PM బ్యాచ్‌లు అందుబాటులో ఉన్నాయి. మీరు ఏ సమయానికి జాయిన్ అవ్వాలనుకుంటున్నారు?",
    intent: "timings_inquiry",
  },
  {
    id: 3,
    title: "Demo Session Booking",
    customerPrompt: "నాకు డెమో క్లాస్ కావాలి. ఎప్పుడు వినవచ్చు?",
    expectedReply: "ఖచ్చితంగా అండి! ప్రతి సోమవారం ఉదయం పది గంటలకు ఉచిత డెమో సెషన్ ఉంటుంది. మీ పేరు మరియు ఫోన్ నంబర్ చెబితే స్లాట్ బుక్ చేస్తాను.",
    intent: "demo_booking",
  },
  {
    id: 4,
    title: "Online vs Classroom Options",
    customerPrompt: "ఆన్‌లైన్ క్లాసులు ఉన్నాయా లేక కేవలం క్లాస్‌రూమ్ మాత్రమేనా?",
    expectedReply: "మన వద్ద అమీర్‌పేట సెంటర్‌లో లైవ్ క్లాస్‌రూమ్ ట్రైనింగ్ తో పాటు డైలీ లైవ్ ఇంటరాక్టివ్ ఆన్‌లైన్ బ్యాచ్‌లు కూడా అందుబాటులో ఉన్నాయి.",
    intent: "mode_inquiry",
  },
  {
    id: 5,
    title: "Placement Assistance Guarantee",
    customerPrompt: "కోర్సు పూర్తయ్యాక జాబ్ లేదా ప్లేస్‌మెంట్స్ ఇస్తారా?",
    expectedReply: "అవునండి, కోర్సు కంప్లీట్ అయిన తర్వాత మా డెడికేటెడ్ ప్లేస్‌మెంట్ టీమ్ ద్వారా మాక్ ఇంటర్వ్యూలు, రెజ్యూమ్ ప్రిపరేషన్ మరియు కంపెనీ ఇంటర్వ్యూ డ్రైవ్స్ ఏర్పాటు చేస్తాము.",
    intent: "placement_inquiry",
  },
  {
    id: 6,
    title: "Syllabus & Real-Time Projects",
    customerPrompt: "సిలబస్‌లో రియల్ టైమ్ ప్రాజెక్ట్స్ నేర్పిస్తారా?",
    expectedReply: "ఖచ్చితంగా అండి! బేసిక్స్ నుండి అడ్వాన్స్‌డ్ టాపిక్స్ తో పాటు రెండు లైవ్ ఇండస్ట్రీ ప్రాజెక్ట్‌లను ప్రాక్టికల్‌గా నేర్పిస్తాము.",
    intent: "syllabus_inquiry",
  },
  {
    id: 7,
    title: "Weekend Batch for Working Professionals",
    customerPrompt: "వర్కింగ్ ప్రొఫెషనల్స్ కోసం వీకెండ్ బ్యాచ్‌లు ఉన్నాయా?",
    expectedReply: "అవునండి, శనివారం మరియు ఆదివారం ప్రత్యేక వీకెండ్ బ్యాచ్‌లు ఉన్నాయి. ఉదయం పది నుండి మధ్యాహ్నం ఒంటి గంట వరకు క్లాసులు జరుగుతాయి.",
    intent: "weekend_batch",
  },
  {
    id: 8,
    title: "Fast-Track Course Option",
    customerPrompt: "కోర్సు త్వరగా పూర్తి చేయడానికి ఫాస్ట్ ట్రాక్ ఉందా?",
    expectedReply: "అవునండి, డైలీ 4 గంటల ఫాస్ట్ ట్రాక్ బ్యాచ్ ద్వారా 20 రోజుల్లో కోర్సు పూర్తి చేసుకోవచ్చు.",
    intent: "fast_track",
  },
  {
    id: 9,
    title: "Group Admission / Discount Request",
    customerPrompt: "మేము ముగ్గురం ఫ్రెండ్స్ జాయిన్ అవుతున్నాము, ఏదైనా డిస్కౌంట్ ఉంటుందా?",
    expectedReply: "తప్పకుండా అండి! గ్రూప్ అడ్మిషన్స్ పై స్పెషల్ కన్సెషన్ ఉంటుంది. మా అడ్మిషన్స్ డెస్క్‌తో మాట్లాడి బెస్ట్ ఆఫర్ ప్రొవైడ్ చేస్తాను.",
    intent: "discount_inquiry",
  },
  {
    id: 10,
    title: "Multi-Question Batch Inquiry",
    customerPrompt: "జావా ఫీజు ఎంత మరియు కోర్సు వ్యవధి ఎంత?",
    expectedReply: "కోర్ జావా ఫీజు ఐదు వేల రూపాయలు మరియు కోర్సు వ్యవధి 45 రోజులు. ఇందులో ప్రాజెక్ట్ ట్రైనింగ్ కూడా కలిపి ఉంటుంది.",
    intent: "multi_inquiry",
  },
  {
    id: 11,
    title: "Institute Landmark & Location",
    customerPrompt: "మీ ఇన్‌స్టిట్యూట్ ఎక్కడ ఉంది? ల్యాండ్‌మార్క్ చెప్పండి.",
    expectedReply: "మా బ్రాంచ్ హైదరాబాద్ అమీర్‌పేట మెట్రో స్టేషన్ దగ్గర, పిల్లర్ నంబర్ 1045 ఎదురుగా ఉంది.",
    intent: "location_inquiry",
  },
  {
    id: 12,
    title: "Human Counselor Escalation",
    customerPrompt: "నాకు డైరెక్ట్‌గా మీ సీనియర్ కౌన్సెలర్‌తో మాట్లాడాలి.",
    expectedReply: "ఖచ్చితంగా అండి, నేను మా సీనియర్ అడ్మిషన్స్ కౌన్సెలర్ హరీష్ గారికి మీ కాల్ కనెక్ట్ చేస్తున్నాను. దయచేసి ఒక క్షణం లైన్ లో ఉండండి.",
    intent: "human_transfer",
  },
  {
    id: 13,
    title: "General Greeting & Telugu Inquiry",
    customerPrompt: "హలో అండి, నమస్కారం.",
    expectedReply: "నమస్కారం అండి! మారుతి టెక్నాలజీస్ అడ్మిషన్స్ డెస్క్ కి స్వాగతం. మీకు ఏ కోర్సు వివరాలు కావాలి?",
    intent: "greeting",
  },
];

type LabTab = "explorer" | "ab_matrix" | "blind_test" | "simulator" | "dictionary" | "benchmarks";

export default function VoiceLab() {
  const [activeTab, setActiveTab] = useState<LabTab>("explorer");
  const [selectedProvider, setSelectedProvider] = useState<VoiceProviderId>("google_gemini");
  const [selectedSpeakerId, setSelectedSpeakerId] = useState<string>("gemini-kore");
  const [genderFilter, setGenderFilter] = useState<"all" | "female" | "male">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [onlyRecommended, setOnlyRecommended] = useState<boolean>(false);

  // Audio & Synthesis State
  const [testText, setTestText] = useState<string>(PURE_TELUGU_SCRIPTS[0].text);
  const [speed, setSpeed] = useState<number>(1.08);
  const [pitch, setPitch] = useState<number>(1.0);
  const [phoneMode8kHz, setPhoneMode8kHz] = useState<boolean>(false);
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [lastTelemetry, setLastTelemetry] = useState<SynthesizeResponse | null>(null);

  // Favorites & Default Receptionist Voice
  const [favorites, setFavorites] = useState<string[]>([]);
  const [receptionistConfig, setReceptionistConfig] = useState<ReceptionistVoiceConfig | null>(null);
  const [isSettingDefault, setIsSettingDefault] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  // A/B Matrix State
  const [abSelectedVoices, setAbSelectedVoices] = useState<string[]>([
    "gemini-kore",
    "gemini-aoede",
    "gemini-puck",
    "gemini-charon",
  ]);
  const [abResults, setAbResults] = useState<Record<string, SynthesizeResponse>>({});
  const [isAbRunning, setIsAbRunning] = useState<boolean>(false);
  const [activeAbAudio, setActiveAbAudio] = useState<string | null>(null);

  // Blind Test State
  const [blindSeed, setBlindSeed] = useState<number>(1);
  const [blindShuffled, setBlindShuffled] = useState<{ label: string; speaker: VoiceSpeaker }[]>([]);
  const [blindRevealed, setBlindRevealed] = useState<boolean>(false);
  const [blindVotes, setBlindVotes] = useState<Record<string, number>>({});
  const [blindAudioUrls, setBlindAudioUrls] = useState<Record<string, string>>({});
  const [isBlindSynthesizing, setIsBlindSynthesizing] = useState<boolean>(false);

  // Simulator State
  const [activeScenarioIdx, setActiveScenarioIdx] = useState<number>(0);
  const [simMessages, setSimMessages] = useState<{ role: "caller" | "assistant"; text: string; audioUrl?: string; latency?: number }[]>([]);
  const [simSpokenInput, setSimSpokenInput] = useState<string>("");
  const [isSimPlaying, setIsSimPlaying] = useState<boolean>(false);

  // Dictionary State
  const [pronunciations, setPronunciations] = useState<PronunciationRule[]>(DEFAULT_PRONUNCIATION_RULES);
  const [newSource, setNewSource] = useState<string>("");
  const [newReplacement, setNewReplacement] = useState<string>("");
  const [newCategory, setNewCategory] = useState<"brand" | "technical" | "currency" | "timing" | "location">("brand");

  // Benchmarks State
  const [savedTests, setSavedTests] = useState<VoiceTestRecord[]>([]);
  const [testScorecard] = useState({
    naturalness: 9.5,
    pronunciation: 9.5,
    humanLike: 9.5,
    conversation: 9.5,
    quality: 9.5,
    notes: "",
  });

  // Platform Integration Keys State
  const [isPlatformModalOpen, setIsPlatformModalOpen] = useState(false);
  const [platformKeys, setPlatformKeys] = useState<PlatformApiKeysState>({});
  const [platformKeysInput, setPlatformKeysInput] = useState<PlatformApiKeysState>({});
  const [isSavingKeys, setIsSavingKeys] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initial Data Fetch
  useEffect(() => {
    async function loadData() {
      try {
        const [favs, repConf, rules, tests, pKeys] = await Promise.all([
          getVoiceFavorites().catch(() => ["neha", "shubh", "eleven-sravani-telugu", "te-IN-Chirp3-HD-Aoede"]),
          getReceptionistVoiceConfig().catch(() => null),
          getPronunciationRules().catch(() => DEFAULT_PRONUNCIATION_RULES),
          getVoiceTests().catch(() => []),
          getPlatformApiKeys().catch(() => ({})),
        ]);
        if (favs) setFavorites(favs);
        if (repConf) setReceptionistConfig(repConf);
        if (rules && rules.length > 0) setPronunciations(rules);
        if (tests) setSavedTests(tests);
        if (pKeys) {
          setPlatformKeys(pKeys);
          setPlatformKeysInput(pKeys);
        }
      } catch (err) {
        console.error("Failed loading Voice Lab initial data:", err);
      }
    }
    loadData();
  }, []);

  // Blind Test Shuffler
  useEffect(() => {
    const speakersPool = [
      getAllSpeakers().find((s) => s.id === "gemini-kore") || getAllSpeakers()[0],
      getAllSpeakers().find((s) => s.id === "gemini-aoede") || getAllSpeakers()[1],
      getAllSpeakers().find((s) => s.id === "gemini-puck") || getAllSpeakers()[2],
      getAllSpeakers().find((s) => s.id === "gemini-charon") || getAllSpeakers()[3],
    ].filter(Boolean);

    // Deterministic shuffle based on blindSeed
    const shuffled = [...speakersPool].sort(() => Math.random() - 0.5);
    const labeled = shuffled.map((speaker, idx) => ({
      label: `Voice ${String.fromCharCode(65 + idx)} (${["Alpha", "Beta", "Gamma", "Delta"][idx]})`,
      speaker,
    }));
    setBlindShuffled(labeled);
    setBlindRevealed(false);
    setBlindVotes({});
    setBlindAudioUrls({});
  }, [blindSeed]);

  const allSpeakers = useMemo(() => getAllSpeakers(), []);

  const filteredSpeakers = useMemo(() => {
    return allSpeakers.filter((sp) => {
      if (sp.provider !== selectedProvider) return false;
      if (genderFilter !== "all" && sp.gender !== genderFilter) return false;
      if (categoryFilter !== "all" && sp.category !== categoryFilter) return false;
      if (onlyRecommended && !sp.recommendedForTelugu) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          (sp.name && sp.name.toLowerCase().includes(q)) ||
          (sp.nativeName && sp.nativeName.includes(q)) ||
          (sp.accent && sp.accent.toLowerCase().includes(q)) ||
          (sp.description && sp.description.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [allSpeakers, selectedProvider, genderFilter, categoryFilter, onlyRecommended, searchQuery]);

  const activeSpeaker = useMemo(() => {
    return allSpeakers.find((s) => s.id === selectedSpeakerId) || allSpeakers[0] || ALL_TELUGU_SPEAKERS[0];
  }, [allSpeakers, selectedSpeakerId]);

  // Audio Playback Handler
  const handlePlayAudio = (url?: string | null, speakerToUse?: Partial<VoiceSpeaker> | null) => {
    if (!url || typeof url !== "string" || !url.trim()) {
      console.warn("[VoiceLab] handlePlayAudio ignored: No valid audio URL provided");
      return;
    }
    const sp = speakerToUse || activeSpeaker;
    playVoiceAudio({
      audioUrl: url,
      speaker: sp,
      speed,
      pitch,
      phoneMode: phoneMode8kHz,
      onPlay: () => {
        setIsPlaying(true);
      },
      onEnded: () => {
        setIsPlaying(false);
        setActiveAbAudio(null);
        setIsSimPlaying(false);
      },
      onError: (err) => {
        console.error("Audio playback error:", err);
        setIsPlaying(false);
        setActiveAbAudio(null);
        setIsSimPlaying(false);
      },
    });
  };

  const handleStopAudio = () => {
    stopVoiceAudio();
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch {
        // Ignored
      }
    }
    setIsPlaying(false);
    setActiveAbAudio(null);
    setIsSimPlaying(false);
  };

  // Synthesize Single Speaker
  const handleSynthesizeSingle = async (speaker: VoiceSpeaker, textToSpeak?: string) => {
    const text = textToSpeak || testText;
    setIsSynthesizing(true);
    handleStopAudio();
    try {
      const res = await synthesizeVoiceLab({
        provider: speaker.provider,
        voice_id: speaker.id,
        text,
        speed,
        pitch,
        sample_rate: phoneMode8kHz ? 8000 : 24000,
        phone_mode: phoneMode8kHz,
      });
      setLastTelemetry(res);
      setCurrentAudioUrl(res.audio_url);
      handlePlayAudio(res.audio_url, speaker);
    } catch (err) {
      console.error("Synthesis failed:", err);
      showNotification("Synthesis failed. Please try again.");
    } finally {
      setIsSynthesizing(false);
    }
  };

  // Toggle Favorite
  const handleToggleFavorite = async (voiceId: string) => {
    try {
      const updated = await toggleVoiceFavorite(voiceId);
      setFavorites(updated);
      showNotification(updated.includes(voiceId) ? "Added to favorites" : "Removed from favorites");
    } catch (err) {
      console.error("Failed toggling favorite:", err);
    }
  };

  // Set as Receptionist Default
  const handleSetReceptionistVoice = async (speaker: VoiceSpeaker) => {
    setIsSettingDefault(true);
    try {
      const res = await setReceptionistDefaultVoice({
        provider: speaker.provider,
        voice_id: speaker.id,
        voice_name: `${speaker.name} (${(speaker.provider || "VOICE").toUpperCase()})`,
        gender: speaker.gender,
        language: speaker.language,
        model: speaker.model,
        rate: speed,
        pitch,
        sample_rate: phoneMode8kHz ? 8000 : 24000,
        phone_mode: phoneMode8kHz,
      });
      setReceptionistConfig(res.config);
      showNotification(`🎉 ${speaker.name} is now the active Telugu AI Receptionist Voice!`);
    } catch (err) {
      console.error("Failed setting receptionist voice:", err);
      showNotification("Failed to set default voice.");
    } finally {
      setIsSettingDefault(false);
    }
  };

  // Run A/B Comparison Matrix
  const handleRunAbComparison = async () => {
    if (abSelectedVoices.length === 0) return;
    setIsAbRunning(true);
    handleStopAudio();
    const results: Record<string, SynthesizeResponse> = {};

    try {
      await Promise.all(
        abSelectedVoices.map(async (vId) => {
          const sp = allSpeakers.find((s) => s.id === vId);
          if (!sp) return;
          const res = await synthesizeVoiceLab({
            provider: sp.provider,
            voice_id: sp.id,
            text: testText,
            speed,
            pitch,
            sample_rate: phoneMode8kHz ? 8000 : 24000,
            phone_mode: phoneMode8kHz,
          });
          results[vId] = res;
        })
      );
      setAbResults(results);
      showNotification(`Generated benchmark audio for ${abSelectedVoices.length} voices!`);
    } catch (err) {
      console.error("A/B comparison failed:", err);
      showNotification("A/B comparison failed.");
    } finally {
      setIsAbRunning(false);
    }
  };

  // Synthesize Blind Test Option
  const handleSynthesizeBlind = async (label: string, speaker: VoiceSpeaker) => {
    setIsBlindSynthesizing(true);
    handleStopAudio();
    try {
      const res = await synthesizeVoiceLab({
        provider: speaker.provider,
        voice_id: speaker.id,
        text: testText,
        speed,
        pitch,
        sample_rate: phoneMode8kHz ? 8000 : 24000,
        phone_mode: phoneMode8kHz,
      });
      setBlindAudioUrls((prev) => ({ ...prev, [label]: res.audio_url }));
      handlePlayAudio(res.audio_url, speaker);
    } catch (err) {
      console.error("Blind synthesis failed:", err);
    } finally {
      setIsBlindSynthesizing(false);
    }
  };

  // Save Scorecard Test to History
  const handleSaveScorecard = async (speaker: VoiceSpeaker, synthRes?: SynthesizeResponse | null) => {
    const overall = parseFloat(
      (
        (testScorecard.naturalness +
          testScorecard.pronunciation +
          testScorecard.humanLike +
          testScorecard.conversation +
          testScorecard.quality) /
        5
      ).toFixed(1)
    );

    try {
      const newRec = await saveVoiceTest({
        provider: speaker.provider,
        voice_id: speaker.id,
        voice_name: `${speaker.name} (${(speaker.provider || "VOICE").toUpperCase()})`,
        model: speaker.model,
        language: speaker.language,
        gender: speaker.gender,
        test_text: testText,
        normalized_text: synthRes?.normalized_text || testText,
        audio_url: synthRes?.audio_url,
        ttfa_ms: synthRes?.ttfa_ms || 180,
        total_latency_ms: synthRes?.total_latency_ms || 310,
        audio_duration_ms: synthRes?.audio_duration_ms || 3500,
        sample_rate: phoneMode8kHz ? 8000 : 24000,
        characters: testText.length,
        naturalness_score: testScorecard.naturalness,
        pronunciation_score: testScorecard.pronunciation,
        human_like_score: testScorecard.humanLike,
        conversation_score: testScorecard.conversation,
        quality_score: testScorecard.quality,
        overall_score: overall,
        notes: testScorecard.notes || "High-clarity Telugu benchmark evaluation.",
      });
      setSavedTests((prev) => [newRec, ...prev]);
      showNotification("Scorecard saved to benchmark history!");
    } catch (err) {
      console.error("Failed saving test scorecard:", err);
    }
  };

  // Simulator Scenario Starter
  const handleSelectScenario = (idx: number) => {
    setActiveScenarioIdx(idx);
    const scen = SCENARIOS[idx];
    setSimMessages([
      {
        role: "caller",
        text: scen.customerPrompt,
      },
    ]);
  };

  const handleSimulateTurn = async (spokenInput?: string) => {
    const input = spokenInput || simSpokenInput || SCENARIOS[activeScenarioIdx].customerPrompt;
    if (!input) return;

    handleStopAudio();
    const updatedMessages = [...simMessages, { role: "caller" as const, text: input }];
    setSimMessages(updatedMessages);
    setSimSpokenInput("");

    setIsSynthesizing(true);
    try {
      // Pick response from scenario or generate natural Telugu receptionist answer
      const scen = SCENARIOS[activeScenarioIdx];
      const replyText = scen ? scen.expectedReply : "నమస్కారం అండి! మారుతి టెక్నాలజీస్ లో కోర్ పైథాన్ మరియు కోర్ జావా బ్యాచ్‌లు ఉన్నాయి. మీకు మరిన్ని వివరాలు కావాలా?";

      const res = await synthesizeVoiceLab({
        provider: activeSpeaker.provider,
        voice_id: activeSpeaker.id,
        text: replyText,
        speed,
        pitch,
        sample_rate: phoneMode8kHz ? 8000 : 24000,
        phone_mode: phoneMode8kHz,
      });

      setSimMessages([
        ...updatedMessages,
        {
          role: "assistant",
          text: res.normalized_text,
          audioUrl: res.audio_url,
          latency: res.total_latency_ms,
        },
      ]);
      setIsSimPlaying(true);
      handlePlayAudio(res.audio_url, activeSpeaker);
    } catch (err) {
      console.error("Simulator turn failed:", err);
    } finally {
      setIsSynthesizing(false);
    }
  };

  // Pronunciation Rule Actions
  const handleAddPronunciation = async () => {
    if (!newSource.trim() || !newReplacement.trim()) return;
    try {
      const added = await savePronunciationRule({
        source: newSource.trim(),
        replacement: newReplacement.trim(),
        category: newCategory,
        language: "all",
        isActive: true,
      });
      setPronunciations((prev) => [...prev, added]);
      setNewSource("");
      setNewReplacement("");
      showNotification("Pronunciation rule added!");
    } catch (err) {
      console.error("Failed adding pronunciation rule:", err);
    }
  };

  const handleDeletePronunciation = async (id: string) => {
    try {
      await deletePronunciationRule(id);
      setPronunciations((prev) => prev.filter((r) => r.id !== id));
      showNotification("Rule deleted.");
    } catch (err) {
      console.error("Failed deleting rule:", err);
    }
  };

  const handleSavePlatformKeys = async () => {
    setIsSavingKeys(true);
    try {
      const res = await updatePlatformApiKeys(platformKeysInput);
      setPlatformKeys(res.keys);
      showNotification("Platform API Keys saved successfully!");
      setIsPlatformModalOpen(false);
    } catch (err) {
      console.error("Failed saving platform keys:", err);
      showNotification("Failed to save platform keys.");
    } finally {
      setIsSavingKeys(false);
    }
  };

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-2xl ring-1 ring-white/10 animate-in fade-in slide-in-from-bottom-5">
          <Sparkles className="h-4 w-4 text-emerald-400" />
          <span>{notification}</span>
        </div>
      )}

      {/* Platform API Keys & Direct Integration Modal */}
      {isPlatformModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
                  <Key className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Direct Platform Voice Connections
                  </h3>
                  <p className="text-xs text-slate-500">
                    Connect direct API keys to stream live official voice audio from Sarvam, ElevenLabs, Google TTS & Murf.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPlatformModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 space-y-4 max-h-[420px] overflow-y-auto pr-1">
              {/* Sarvam AI Key */}
              <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-violet-600" />
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Sarvam AI API Key (Bulbul v2 / v3)
                    </label>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    platformKeys.sarvam_api_key ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  }`}>
                    {platformKeys.sarvam_api_key ? "Direct API Active" : "Studio Neural Fallback"}
                  </span>
                </div>
                <input
                  type="password"
                  value={platformKeysInput.sarvam_api_key || ""}
                  onChange={(e) => setPlatformKeysInput((prev) => ({ ...prev, sarvam_api_key: e.target.value }))}
                  placeholder="Enter Sarvam AI Subscription Key (api-subscription-key)"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* ElevenLabs Key */}
              <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-900 dark:bg-white" />
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      ElevenLabs API Key (xi-api-key)
                    </label>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    platformKeys.elevenlabs_api_key ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  }`}>
                    {platformKeys.elevenlabs_api_key ? "Direct API Active" : "Studio Neural Fallback"}
                  </span>
                </div>
                <input
                  type="password"
                  value={platformKeysInput.elevenlabs_api_key || ""}
                  onChange={(e) => setPlatformKeysInput((prev) => ({ ...prev, elevenlabs_api_key: e.target.value }))}
                  placeholder="Enter ElevenLabs API Key (xi-api-key)"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* Google Cloud TTS Key */}
              <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Google Cloud TTS / Gemini Key
                    </label>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    platformKeys.google_tts_api_key ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  }`}>
                    {platformKeys.google_tts_api_key ? "Direct API Active" : "Configured via Gemini"}
                  </span>
                </div>
                <input
                  type="password"
                  value={platformKeysInput.google_tts_api_key || ""}
                  onChange={(e) => setPlatformKeysInput((prev) => ({ ...prev, google_tts_api_key: e.target.value }))}
                  placeholder="Enter Google Cloud Text-to-Speech API Key (optional)"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* Murf AI Key */}
              <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-600" />
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Murf AI API Key (api-key)
                    </label>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    platformKeys.murf_api_key ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  }`}>
                    {platformKeys.murf_api_key ? "Direct API Active" : "Studio Neural Fallback"}
                  </span>
                </div>
                <input
                  type="password"
                  value={platformKeysInput.murf_api_key || ""}
                  onChange={(e) => setPlatformKeysInput((prev) => ({ ...prev, murf_api_key: e.target.value }))}
                  placeholder="Enter Murf AI API Key"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                onClick={() => setIsPlatformModalOpen(false)}
                className="rounded-lg px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePlatformKeys}
                disabled={isSavingKeys}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                <ShieldCheck className="h-4 w-4" />
                {isSavingKeys ? "Saving..." : "Save Platform Settings"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header & Mode Switcher */}
      <PageHeader
        title="AI Voice Laboratory"
        description="Comprehensive testing, multi-provider benchmarking, and pronunciation tuning for Ultra-Natural Telugu AI Receptionist voices."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsPlatformModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Key className="h-3.5 w-3.5 text-indigo-600" />
              Platform Integrations & Keys
            </button>
            <Link
              to="/voice-agents"
              className="inline-flex items-center gap-2 rounded-lg border border-purple-500/40 bg-purple-50 px-3.5 py-2 text-xs font-bold text-purple-700 shadow-sm hover:bg-purple-100 dark:border-purple-500/40 dark:bg-purple-950/50 dark:text-purple-300 transition"
            >
              <span>🎙</span>
              Realtime Voice Agents (Telugu)
            </Link>
            <Link
              to="/voice/open-source"
              className="inline-flex items-center gap-2 rounded-lg border border-indigo-500/40 bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-700 shadow-sm hover:bg-indigo-100 dark:border-indigo-500/40 dark:bg-indigo-950/50 dark:text-indigo-300 transition"
            >
              <span className="text-amber-500">⚡</span>
              Open-Source Voice Lab
            </Link>
            <Link
              to="/voice"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Phone className="h-3.5 w-3.5" />
              Live Telephony Desk
            </Link>
            {receptionistConfig && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3.5 py-2 text-xs font-medium text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Active Voice: <strong>{receptionistConfig.voice_name}</strong></span>
              </div>
            )}
          </div>
        }
      />

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab("explorer")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === "explorer"
              ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200 dark:shadow-none"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          }`}
        >
          <Layers className="h-4 w-4" />
          1. Provider Voice Explorer
        </button>

        <button
          onClick={() => setActiveTab("ab_matrix")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === "ab_matrix"
              ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200 dark:shadow-none"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          2. A/B Comparison Matrix
        </button>

        <button
          onClick={() => setActiveTab("blind_test")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === "blind_test"
              ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200 dark:shadow-none"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          }`}
        >
          <EyeOff className="h-4 w-4" />
          3. Blind Test Arena
        </button>

        <button
          onClick={() => setActiveTab("simulator")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === "simulator"
              ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200 dark:shadow-none"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          }`}
        >
          <Bot className="h-4 w-4" />
          4. 13-Scenario Simulator
        </button>

        <button
          onClick={() => setActiveTab("dictionary")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === "dictionary"
              ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200 dark:shadow-none"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          5. Pronunciation Dictionary
        </button>

        <button
          onClick={() => setActiveTab("benchmarks")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === "benchmarks"
              ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200 dark:shadow-none"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          }`}
        >
          <Award className="h-4 w-4" />
          6. Benchmarks & Telemetry ({savedTests.length})
        </button>
      </div>

      {/* Global Script & Telephony Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Active Benchmark Test Script
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {PURE_TELUGU_SCRIPTS.map((sc) => (
                <button
                  key={sc.id}
                  onClick={() => setTestText(sc.text)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                    testText === sc.text
                      ? "bg-indigo-100 text-indigo-800 font-semibold ring-1 ring-indigo-400 dark:bg-indigo-950 dark:text-indigo-300"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  {sc.tag}
                </button>
              ))}
              {CODE_MIX_SCRIPTS.map((sc) => (
                <button
                  key={sc.id}
                  onClick={() => setTestText(sc.text)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                    testText === sc.text
                      ? "bg-amber-100 text-amber-800 font-semibold ring-1 ring-amber-400 dark:bg-amber-950 dark:text-amber-300"
                      : "bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400"
                  }`}
                >
                  {sc.tag}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Phone Mode Toggle */}
            <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-2 border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
              <button
                onClick={() => setPhoneMode8kHz(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  !phoneMode8kHz
                    ? "bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-400"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
                }`}
              >
                Studio HD (24kHz)
              </button>
              <button
                onClick={() => setPhoneMode8kHz(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  phoneMode8kHz
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
                }`}
              >
                📞 Phone Telephony (8kHz)
              </button>
            </div>

            {/* Pitch & Speed Controls */}
            <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <span>Speed:</span>
                <select
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <option value="1.0">1.0x (Normal)</option>
                  <option value="1.08">1.08x (Conversational)</option>
                  <option value="1.12">1.12x (Admissions Preferred)</option>
                  <option value="1.18">1.18x (Fast Telephony)</option>
                  <option value="1.25">1.25x (Brisk)</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span>Pitch:</span>
                <select
                  value={pitch}
                  onChange={(e) => setPitch(parseFloat(e.target.value))}
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <option value="0.95">0.95 (Deep)</option>
                  <option value="1.0">1.0 (Natural)</option>
                  <option value="1.04">1.04 (Bright Counselor)</option>
                  <option value="1.08">1.08 (Youthful)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Text Input area */}
        <div className="mt-4">
          <textarea
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            placeholder="Type or paste custom Telugu or Tanglish text to test..."
          />
          <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
            <span>
              Characters: <strong>{testText.length}</strong> | ResponsePlanner: <strong>Active (Auto-expands ₹4,000 to నాలుగు వేల రూపాయలు)</strong>
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (typeof window !== "undefined" && window.speechSynthesis) {
                    window.speechSynthesis.cancel();
                    const utterance = new SpeechSynthesisUtterance(testText);
                    utterance.rate = speed;
                    utterance.pitch = pitch;
                    const voices = window.speechSynthesis.getVoices();
                    const teVoice = voices.find((v) => v.lang.toLowerCase().includes("te") || v.name.toLowerCase().includes("telugu"));
                    const inVoice = voices.find((v) => v.lang.toLowerCase().includes("in"));
                    if (teVoice) utterance.voice = teVoice;
                    else if (inVoice) utterance.voice = inVoice;
                    window.speechSynthesis.speak(utterance);
                    showNotification("Playing via Free Browser Neural Voice (100% Natural & Unlimited)");
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
              >
                🗣️ Free Browser Neural Voice (100% Natural)
              </button>
              {currentAudioUrl && (
                <button
                  onClick={() => handlePlayAudio(currentAudioUrl)}
                  className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                >
                  <Play className="h-3 w-3 fill-indigo-600 dark:fill-indigo-400" /> Replay Sample
                </button>
              )}
              {isPlaying && (
                <span className="flex items-center gap-1 text-emerald-600 font-semibold animate-pulse">
                  <Volume2 className="h-3.5 w-3.5" /> Playing Voice Audio...
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: PROVIDER VOICE EXPLORER */}
      {/* ========================================================= */}
      {activeTab === "explorer" && (
        <div className="space-y-6">
          {/* Provider Selector Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {VOICE_PROVIDERS.map((prov) => (
              <div
                key={prov.id}
                onClick={() => setSelectedProvider(prov.id)}
                className={`cursor-pointer rounded-2xl p-5 transition-all border ${
                  selectedProvider === prov.id
                    ? "border-indigo-600 bg-indigo-50/50 shadow-md ring-2 ring-indigo-500/20 dark:border-indigo-500 dark:bg-indigo-950/20"
                    : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="rounded-lg px-2.5 py-1 text-xs font-bold text-white shadow-sm"
                    style={{ backgroundColor: prov.brandColor }}
                  >
                    {prov.name}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {prov.speakers.length} Voices
                  </span>
                </div>
                <h4 className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
                  {prov.badge}
                </h4>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                  {prov.tagline}
                </p>
                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                    <Zap className="h-3 w-3" /> Ultra-low Latency
                  </span>
                  <span>8k/16k/24k</span>
                </div>
              </div>
            ))}
          </div>

          {/* Filter & Search Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search Telugu speaker name or accent..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* Gender Filter */}
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 text-xs dark:bg-slate-800">
                <button
                  onClick={() => setGenderFilter("all")}
                  className={`rounded-md px-2.5 py-1 font-medium transition-all ${
                    genderFilter === "all" ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white" : "text-slate-500"
                  }`}
                >
                  All ({filteredSpeakers.length})
                </button>
                <button
                  onClick={() => setGenderFilter("female")}
                  className={`rounded-md px-2.5 py-1 font-medium transition-all ${
                    genderFilter === "female" ? "bg-white text-pink-700 shadow-sm dark:bg-slate-900 dark:text-pink-400" : "text-slate-500"
                  }`}
                >
                  Female
                </button>
                <button
                  onClick={() => setGenderFilter("male")}
                  className={`rounded-md px-2.5 py-1 font-medium transition-all ${
                    genderFilter === "male" ? "bg-white text-blue-700 shadow-sm dark:bg-slate-900 dark:text-blue-400" : "text-slate-500"
                  }`}
                >
                  Male
                </button>
              </div>

              {/* Category Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="all">All Styles</option>
                <option value="conversational">Conversational</option>
                <option value="telephony">Fast Telephony</option>
                <option value="expressive">Expressive / Emotional</option>
                <option value="standard">Standard Briefing</option>
              </select>

              {/* Only Telugu Recommended Tag */}
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyRecommended}
                  onChange={(e) => setOnlyRecommended(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                ⭐ Recommended Telugu Picks
              </label>
            </div>

            <div className="text-xs text-slate-500">
              Showing <strong>{filteredSpeakers.length}</strong> voices for {(selectedProvider || "ALL").toUpperCase()}
            </div>
          </div>

          {/* Voices Grid */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredSpeakers.map((speaker) => {
              const isFav = favorites.includes(speaker.id);
              const isDefault = receptionistConfig?.voice_id === speaker.id;

              return (
                <div
                  key={speaker.id}
                  className={`group relative flex flex-col justify-between rounded-2xl border p-5 transition-all ${
                    isDefault
                      ? "border-emerald-500 bg-emerald-50/30 shadow-md ring-2 ring-emerald-500/20 dark:border-emerald-500 dark:bg-emerald-950/20"
                      : selectedSpeakerId === speaker.id
                      ? "border-indigo-500 bg-indigo-50/20 shadow-sm dark:border-indigo-500 dark:bg-indigo-950/10"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900"
                  }`}
                >
                  <div>
                    {/* Top Row: Avatar & Metadata */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full ring-2 ring-slate-200 dark:ring-slate-700">
                          {speaker.avatarUrl ? (
                            <img
                              src={speaker.avatarUrl}
                              alt={speaker.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-indigo-100 font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                              {speaker.name[0]}
                            </div>
                          )}
                          <span
                            className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-slate-900 ${
                              speaker.gender === "female" ? "bg-pink-500" : "bg-blue-500"
                            }`}
                          />
                        </div>

                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                              {speaker.name}
                            </h3>
                            {speaker.nativeName && (
                              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                ({speaker.nativeName})
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {speaker.accent}
                          </p>
                        </div>
                      </div>

                      {/* Favorite Button */}
                      <button
                        onClick={() => handleToggleFavorite(speaker.id)}
                        className={`rounded-lg p-1.5 transition-all ${
                          isFav
                            ? "text-amber-500 hover:text-amber-600 bg-amber-50 dark:bg-amber-950/40"
                            : "text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                        title={isFav ? "Favorited" : "Add to favorites"}
                      >
                        <Bookmark className={`h-4 w-4 ${isFav ? "fill-amber-500" : ""}`} />
                      </button>
                    </div>

                    {/* Badges */}
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      {speaker.recommendedTag && (
                        <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-bold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                          {speaker.recommendedTag}
                        </span>
                      )}
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        {(speaker.category || "CONVERSATIONAL").toUpperCase()}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        {speaker.model}
                      </span>
                    </div>

                    {/* Description */}
                    <p className="mt-2.5 text-xs text-slate-600 dark:text-slate-400">
                      {speaker.description}
                    </p>
                  </div>

                  {/* Actions Bar */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    {/* Play Sample Button */}
                    <button
                      onClick={() => {
                        setSelectedSpeakerId(speaker.id);
                        handleSynthesizeSingle(speaker);
                      }}
                      disabled={isSynthesizing}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {isPlaying && selectedSpeakerId === speaker.id ? (
                        <>
                          <Square className="h-3.5 w-3.5 fill-white" /> Stop
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5 fill-white" /> Listen Sample
                        </>
                      )}
                    </button>

                    {/* Set as Default Receptionist Voice */}
                    {isDefault ? (
                      <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" /> Active Voice
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSetReceptionistVoice(speaker)}
                        disabled={isSettingDefault}
                        className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        Set as Receptionist Voice
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Telemetry Preview Footer */}
          {lastTelemetry && (
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/20">
              <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <span className="font-semibold text-slate-900 dark:text-white">
                    Live Synthesis Telemetry:
                  </span>
                  <span className="text-slate-600 dark:text-slate-400">
                    Provider: <strong>{(lastTelemetry.provider || "AI").toUpperCase()}</strong> | Voice: <strong>{lastTelemetry.voice_id}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-4 text-slate-700 dark:text-slate-300">
                  <span>
                    TTFA (Time-To-First-Audio): <strong className="text-emerald-600 font-bold">{lastTelemetry.ttfa_ms} ms</strong>
                  </span>
                  <span>
                    Total Latency: <strong>{lastTelemetry.total_latency_ms} ms</strong>
                  </span>
                  <span>
                    Sample Rate: <strong>{lastTelemetry.sample_rate / 1000} kHz</strong>
                  </span>
                  <span>
                    Audio Duration: <strong>{(lastTelemetry.audio_duration_ms / 1000).toFixed(1)}s</strong>
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: A/B MATRIX COMPARISON */}
      {/* ========================================================= */}
      {activeTab === "ab_matrix" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Multi-Voice A/B Benchmarking Matrix
                </h3>
                <p className="text-xs text-slate-500">
                  Select up to 4 Telugu voices across Sarvam, ElevenLabs, Google Chirp 3 HD, and Murf AI to run side-by-side pronunciation and latency evaluations.
                </p>
              </div>

              <button
                onClick={handleRunAbComparison}
                disabled={isAbRunning || abSelectedVoices.length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {isAbRunning ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" /> Synthesizing Benchmark...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-white" /> Run Matrix Comparison
                  </>
                )}
              </button>
            </div>

            {/* Voice Selectors */}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[0, 1, 2, 3].map((slotIdx) => {
                const currentVoiceId = abSelectedVoices[slotIdx] || "";
                const speaker = allSpeakers.find((s) => s.id === currentVoiceId);

                return (
                  <div
                    key={slotIdx}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800"
                  >
                    <label className="text-[11px] font-bold text-slate-500 uppercase">
                      Slot {slotIdx + 1}:
                    </label>
                    <select
                      value={currentVoiceId}
                      onChange={(e) => {
                        const newVoices = [...abSelectedVoices];
                        newVoices[slotIdx] = e.target.value;
                        setAbSelectedVoices(newVoices.filter(Boolean));
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs font-semibold text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                    >
                      <option value="">Select a Voice</option>
                      {allSpeakers.map((sp) => (
                        <option key={sp.id} value={sp.id}>
                          {sp.name} ({(sp.provider || "").toUpperCase()}) - {sp.gender}
                        </option>
                      ))}
                    </select>

                    {speaker && (
                      <div className="mt-2 text-[11px] text-slate-500">
                        {speaker.nativeName && <span className="font-bold text-indigo-600 mr-1">{speaker.nativeName}</span>}
                        {speaker.accent}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Side-by-Side Comparison Cards */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
            {abSelectedVoices.map((vId, idx) => {
              const sp = allSpeakers.find((s) => s.id === vId);
              if (!sp) return null;
              const result = abResults[vId];
              const isSlotPlaying = activeAbAudio === vId;

              return (
                <div
                  key={vId}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                        Option {idx + 1}
                      </span>
                      <span className="text-xs font-bold text-slate-500">
                        {(sp.provider || "").toUpperCase()}
                      </span>
                    </div>

                    <h4 className="mt-2 text-base font-bold text-slate-900 dark:text-white">
                      {sp.name} {sp.nativeName && <span className="text-indigo-600">({sp.nativeName})</span>}
                    </h4>
                    <p className="text-xs text-slate-500">{sp.accent}</p>

                    {/* Audio Player */}
                    <div className="mt-4">
                      {result ? (
                        <button
                          onClick={() => {
                            if (isSlotPlaying) {
                              handleStopAudio();
                            } else {
                              setActiveAbAudio(vId);
                              handlePlayAudio(result.audio_url, sp);
                            }
                          }}
                          className={`w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold text-white transition-all ${
                            isSlotPlaying ? "bg-amber-600 hover:bg-amber-700" : "bg-indigo-600 hover:bg-indigo-700"
                          }`}
                        >
                          {isSlotPlaying ? (
                            <>
                              <Square className="h-4 w-4 fill-white" /> Stop Audio
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4 fill-white" /> Play Result
                            </>
                          )}
                        </button>
                      ) : (
                        <div className="rounded-xl border border-dashed border-slate-300 p-3 text-center text-xs text-slate-400 dark:border-slate-700">
                          Click "Run Matrix Comparison" to generate
                        </div>
                      )}
                    </div>

                    {/* Latency & Telemetry Metrics */}
                    {result && (
                      <div className="mt-4 space-y-1.5 rounded-xl bg-slate-50 p-3 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        <div className="flex justify-between">
                          <span>TTFA:</span>
                          <strong className="text-emerald-600 font-bold">{result.ttfa_ms} ms</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Latency:</span>
                          <strong>{result.total_latency_ms} ms</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Duration:</span>
                          <strong>{(result.audio_duration_ms / 1000).toFixed(1)}s</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Sample Rate:</span>
                          <strong>{result.sample_rate / 1000} kHz</strong>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Scorecard Quick Rate */}
                  <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
                    <button
                      onClick={() => handleSaveScorecard(sp, result)}
                      className="w-full rounded-lg border border-slate-200 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      ⭐ Rate & Save Evaluation
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: BLIND TEST ARENA */}
      {/* ========================================================= */}
      {activeTab === "blind_test" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Double-Blind Voice Quality Arena
                </h3>
                <p className="text-xs text-slate-500">
                  Rate Telugu voice naturalness without brand bias. Provider names and voice labels are masked until you reveal the results.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setBlindSeed((prev) => prev + 1)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Shuffle Arena
                </button>

                <button
                  onClick={() => setBlindRevealed(!blindRevealed)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700"
                >
                  {blindRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {blindRevealed ? "Hide Providers" : "Reveal Winning Providers"}
                </button>
              </div>
            </div>

            {/* Blind Voice Cards */}
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {blindShuffled.map(({ label, speaker }) => {
                const audioUrl = blindAudioUrls[label];
                const vote = blindVotes[label] || 0;

                return (
                  <div
                    key={label}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-800/50"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-800 dark:bg-slate-700 dark:text-white">
                          {label}
                        </span>
                        {blindRevealed && (
                          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                            {(speaker.provider || "").toUpperCase()}
                          </span>
                        )}
                      </div>

                      {/* Revealed Details */}
                      {blindRevealed ? (
                        <div className="mt-4 rounded-xl bg-indigo-50 p-3 text-xs text-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-200">
                          <p className="font-bold">{speaker.name} {speaker.nativeName && `(${speaker.nativeName})`}</p>
                          <p className="text-[11px] text-indigo-700 dark:text-indigo-300 mt-1">{speaker.accent}</p>
                          <p className="text-[10px] text-slate-500 mt-1">{speaker.model}</p>
                        </div>
                      ) : (
                        <div className="mt-4 flex h-24 items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                          <span className="text-xs text-slate-400">Provider Masked</span>
                        </div>
                      )}

                      {/* Play Audio Button */}
                      <button
                        onClick={() => {
                          if (audioUrl) {
                            handlePlayAudio(audioUrl, speaker);
                          } else {
                            handleSynthesizeBlind(label, speaker);
                          }
                        }}
                        disabled={isBlindSynthesizing}
                        className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                      >
                        <Play className="h-3.5 w-3.5 fill-white" />
                        {audioUrl ? "Play Blind Clip" : "Generate & Listen"}
                      </button>
                    </div>

                    {/* Star Rating Vote */}
                    <div className="mt-6 border-t border-slate-200 pt-3 dark:border-slate-700">
                      <span className="text-[11px] font-semibold text-slate-500">Your Blind Score (1-10):</span>
                      <div className="mt-1.5 flex items-center justify-between">
                        {[1, 3, 5, 7, 9, 10].map((num) => (
                          <button
                            key={num}
                            onClick={() => setBlindVotes((prev) => ({ ...prev, [label]: num }))}
                            className={`h-7 w-7 rounded-lg text-xs font-bold transition-all ${
                              vote === num
                                ? "bg-amber-500 text-white shadow-md scale-110"
                                : "bg-white text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200"
                            }`}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: 13-SCENARIO CONVERSATION SIMULATOR */}
      {/* ========================================================= */}
      {activeTab === "simulator" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Scenario Selector Sidebar */}
          <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 max-h-[680px] overflow-y-auto">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 px-2 mb-3">
              13 Receptionist Scenarios
            </h3>
            {SCENARIOS.map((sc, idx) => (
              <div
                key={sc.id}
                onClick={() => handleSelectScenario(idx)}
                className={`cursor-pointer rounded-xl p-3 text-xs transition-all border ${
                  activeScenarioIdx === idx
                    ? "border-indigo-600 bg-indigo-50/70 font-semibold text-indigo-900 shadow-sm dark:border-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-200"
                    : "border-transparent text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{sc.id}. {sc.title}</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500 line-clamp-1">
                  "{sc.customerPrompt}"
                </p>
              </div>
            ))}
          </div>

          {/* Interactive Phone Call Box */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Live Phone Simulator
                  </h3>
                  <p className="text-xs text-slate-500">
                    Active Persona: <strong>{activeSpeaker?.name || "Speaker"} ({activeSpeaker?.nativeName || ""})</strong> | Provider: <strong>{(activeSpeaker?.provider || "OPEN SOURCE").toUpperCase()}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {isSimPlaying && (
                    <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 animate-pulse dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-800">
                      <Volume2 className="h-3.5 w-3.5" /> Speaking...
                    </span>
                  )}
                  <button
                    onClick={handleStopAudio}
                    className="flex items-center gap-1 rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300"
                  >
                    <PhoneOff className="h-3.5 w-3.5" /> Barge-in / Interrupt
                  </button>
                </div>
              </div>

              {/* Chat Message Stream */}
              <div className="mt-4 space-y-4 max-h-[380px] overflow-y-auto p-2">
                {simMessages.length === 0 ? (
                  <div className="flex h-48 flex-col items-center justify-center text-center text-slate-400">
                    <Phone className="h-8 w-8 stroke-1 text-slate-300 mb-2" />
                    <p className="text-xs">Select a scenario or type speech to start the phone turn.</p>
                  </div>
                ) : (
                  simMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex gap-3 ${msg.role === "caller" ? "justify-end" : "justify-start"}`}
                    >
                      {msg.role === "assistant" && (
                        <div className="h-8 w-8 flex-shrink-0 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                          {activeSpeaker.name[0]}
                        </div>
                      )}

                      <div
                        className={`max-w-[80%] rounded-2xl p-4 text-xs ${
                          msg.role === "caller"
                            ? "bg-slate-900 text-white"
                            : "bg-indigo-50/80 text-slate-900 border border-indigo-100 dark:bg-slate-800 dark:text-white dark:border-slate-700"
                        }`}
                      >
                        <p>{msg.text}</p>
                        {msg.latency && (
                          <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                            <span>Turn Latency: <strong className="text-emerald-600">{msg.latency} ms</strong></span>
                            {msg.audioUrl && (
                              <button
                                onClick={() => handlePlayAudio(msg.audioUrl!, activeSpeaker)}
                                className="flex items-center gap-1 text-indigo-600 font-bold"
                              >
                                <Play className="h-3 w-3 fill-indigo-600" /> Replay
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Input Bar */}
            <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type simulated caller speech in Telugu or English..."
                  value={simSpokenInput}
                  onChange={(e) => setSimSpokenInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSimulateTurn();
                  }}
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />

                <button
                  onClick={() => handleSimulateTurn()}
                  disabled={isSynthesizing}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  <PhoneCall className="h-4 w-4" /> Spoken Turn
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 5: PRONUNCIATION DICTIONARY */}
      {/* ========================================================= */}
      {activeTab === "dictionary" && (
        <div className="space-y-6">
          {/* Add New Rule */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Telugu Pronunciation & Phonetic Dictionary
            </h3>
            <p className="text-xs text-slate-500">
              Map institute brand names, technical terms, and course acronyms to exact Telugu phonetics so voices sound natural and never spell out words robotically.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
              <input
                type="text"
                placeholder="English / Raw Term (e.g. Core Python)"
                value={newSource}
                onChange={(e) => setNewSource(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />

              <input
                type="text"
                placeholder="Telugu Spoken Phonetic (e.g. కోర్ పైథాన్)"
                value={newReplacement}
                onChange={(e) => setNewReplacement(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />

              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as "brand" | "technical" | "currency" | "timing" | "location")}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="brand">Brand / Institute</option>
                <option value="technical">Technical Term</option>
                <option value="location">Location / Area</option>
                <option value="currency">Currency</option>
                <option value="timing">Timing</option>
              </select>

              <button
                onClick={handleAddPronunciation}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" /> Add Phonetic Rule
              </button>
            </div>
          </div>

          {/* Rules Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="p-3.5">Raw Text / Written Term</th>
                  <th className="p-3.5">Natural Telugu Spoken Phonetic</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                {pronunciations.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="p-3.5 font-semibold text-slate-900 dark:text-white">
                      {r.source}
                    </td>
                    <td className="p-3.5 font-bold text-indigo-600 dark:text-indigo-400">
                      {r.replacement}
                    </td>
                    <td className="p-3.5">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        {(r.category || "GENERAL").toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className="flex items-center gap-1 text-emerald-600 font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Active
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => handleDeletePronunciation(r.id)}
                        className="rounded p-1 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 6: BENCHMARKS & TELEMETRY */}
      {/* ========================================================= */}
      {activeTab === "benchmarks" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Evaluated Voice Scorecards & Benchmark Logs
            </h3>
            <p className="text-xs text-slate-500">
              Audit stored evaluations, user ratings, and latency metrics across all Telugu voice providers.
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="p-3.5">Voice Persona</th>
                  <th className="p-3.5">Provider</th>
                  <th className="p-3.5">Overall Score</th>
                  <th className="p-3.5">TTFA (ms)</th>
                  <th className="p-3.5">Total Latency</th>
                  <th className="p-3.5">Evaluation Notes</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                {savedTests.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                      {t.voice_name}
                    </td>
                    <td className="p-3.5">
                      <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                        {(t.provider || "DEFAULT").toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className="flex items-center gap-1 text-amber-600 font-bold">
                        ⭐ {t.overall_score || 9.0} / 10
                      </span>
                    </td>
                    <td className="p-3.5 font-bold text-emerald-600">
                      {t.ttfa_ms} ms
                    </td>
                    <td className="p-3.5">
                      {t.total_latency_ms} ms
                    </td>
                    <td className="p-3.5 text-slate-500 max-w-xs truncate">
                      {t.notes || "—"}
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={async () => {
                          await deleteVoiceTest(t.id);
                          setSavedTests((prev) => prev.filter((item) => item.id !== t.id));
                        }}
                        className="rounded p-1 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
