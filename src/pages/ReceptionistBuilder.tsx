import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Bot,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  Volume2,
  UploadCloud,
  FileText,
  CheckCircle2,
  Building,
  Sliders,
  RefreshCw,
  Phone,
  MessageSquare,
  Globe,
  Plus,
  X,
} from "lucide-react";
import PageHeader from "../components/common/PageHeader";
import {
  createAgent,
  getAgent,
  updateAgent,
  updateAgentKnowledge,
  type Agent,
} from "../api/agents";
import { getKnowledge, type KnowledgeItem } from "../api/knowledge";
import { uploadDocument } from "../api/documents";
import { getUniversalIndustriesApi, type IndustryTemplateItem } from "../api/lab";

// Pre-built curated avatar options
const AVATAR_OPTIONS = [
  {
    id: "maya",
    name: "Maya (Warm Corporate)",
    url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
    gender: "Female",
  },
  {
    id: "priya",
    name: "Priya (Admissions Specialist)",
    url: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80",
    gender: "Female",
  },
  {
    id: "alex",
    name: "Alex (Executive Qualifier)",
    url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    gender: "Male",
  },
  {
    id: "david",
    name: "David (Senior Consultant)",
    url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    gender: "Male",
  },
  {
    id: "sophia",
    name: "Sophia (Clinic Concierge)",
    url: "https://images.unsplash.com/photo-1594824813589-983058863f68?w=150&auto=format&fit=crop&q=80",
    gender: "Female",
  },
  {
    id: "elena",
    name: "Elena (Legal Front Desk)",
    url: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=150&auto=format&fit=crop&q=80",
    gender: "Female",
  },
  {
    id: "marcus",
    name: "Marcus (Enterprise Account Desk)",
    url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
    gender: "Male",
  },
  {
    id: "aisha",
    name: "Aisha (Hospitality & VIP)",
    url: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=150&auto=format&fit=crop&q=80",
    gender: "Female",
  },
];

const PERSONALITIES = [
  { id: "friendly", label: "Friendly & Warm", desc: "Welcoming, polite, highly conversational, and supportive." },
  { id: "professional", label: "Corporate & Professional", desc: "Concise, respectful, business-focused, and structured." },
  { id: "sales_oriented", label: "Sales & Qualifier", desc: "Proactive, high-conversion, focused on capturing budget & contact info." },
  { id: "support_oriented", label: "Empathetic Support", desc: "Patient, thorough, active listener focused on problem resolution." },
  { id: "formal", label: "Formal & Executive", desc: "Distinguished, discreet, high-etiquette tone." },
];

const VOICES = [
  { id: "maya_warm", label: "Maya — Warm Conversational", gender: "Female", lang: "English / Multilingual" },
  { id: "alex_crisp", label: "Alex — Crisp Executive", gender: "Male", lang: "English / Multilingual" },
  { id: "nova_smooth", label: "Nova — Smooth & Gentle", gender: "Female", lang: "English / Multilingual" },
  { id: "echo_deep", label: "Echo — Deep Studio", gender: "Male", lang: "English / Multilingual" },
];

const AVAILABLE_TOOLS = [
  { id: "search_knowledge", name: "Search Knowledge Base & FAQs", desc: "Retrieves company policies, course curriculum, and verified answers." },
  { id: "get_company_info", name: "Company Profile & Location", desc: "Answers address, contact phone, leadership, and operating hours." },
  { id: "create_lead", name: "Step-by-Step Lead Capture", desc: "Gathers visitor name, phone, email, and records lead score in CRM." },
  { id: "schedule_appointment", name: "Book Calendar Appointments", desc: "Checks open slots, books consultations, and sends confirmation." },
  { id: "transfer_to_human", name: "Human Operator Escalation", desc: "Transfers to human staff when complaints or urgent requests occur." },
];

const STEPS = [
  { id: 1, key: "persona", label: "Persona & Voice", icon: Bot, desc: "Name, avatar, speech profile & tone" },
  { id: 2, key: "knowledge", label: "Knowledge & Business", icon: Building, desc: "Campus profile, documents & RAG knowledge" },
  { id: 3, key: "rules", label: "Intake Rules & Prompt", icon: Sliders, desc: "Welcome greeting, lead rules & AI prompt" },
  { id: 4, key: "deploy", label: "Channels & Launch", icon: Globe, desc: "Web widget, phone, WhatsApp & live status" },
] as const;

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function ReceptionistBuilder() {
  const { id: agentIdParam } = useParams<{ id?: string }>();

  // Active step in the slider wizard (1 to 4)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Main Receptionist Form State
  const [formData, setFormData] = useState({
    name: "",
    public_slug: "",
    avatar: AVATAR_OPTIONS[0].url,
    welcome_message: "",
    system_instructions: "",
    personality: "friendly",
    language: "multilingual",
    voice_id: "maya_warm",
    speaking_style: "warm_conversational",
    channels: ["web", "voice", "whatsapp"],
    allowed_tools: ["search_knowledge", "get_company_info", "create_lead", "schedule_appointment", "transfer_to_human"],
    knowledge_item_ids: [] as number[],
    is_published: true,
  });

  // Business Profile Quick Info
  const [businessProfile, setBusinessProfile] = useState({
    companyName: "",
    phone: "",
    email: "",
    address: "",
    workingHours: "",
  });

  // Knowledge list from API
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [createdAgent, setCreatedAgent] = useState<Agent | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // Document upload state inside builder
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docSuccessMsg, setDocSuccessMsg] = useState("");
  const [docErrorMsg, setDocErrorMsg] = useState("");
  const docInputRef = useRef<HTMLInputElement | null>(null);

  // Voice playback test state
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Multi-Industry Presets state
  const [industryPresets, setIndustryPresets] = useState<IndustryTemplateItem[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null);

  // Fetch multi-industry presets
  useEffect(() => {
    getUniversalIndustriesApi()
      .then((res) => {
        if (res?.industries) {
          setIndustryPresets(res.industries);
        }
      })
      .catch((err) => console.warn("Failed to load industry presets:", err));
  }, []);

  function applyIndustryPreset(preset: IndustryTemplateItem) {
    setSelectedPresetId(preset.agent.id);

    // Pick avatar by industry
    let matchedAvatar = AVATAR_OPTIONS[0].url;
    if (preset.agent.industry.includes("Hospitality")) {
      matchedAvatar = AVATAR_OPTIONS.find((a) => a.id === "aisha")?.url || AVATAR_OPTIONS[7].url;
    } else if (preset.agent.industry.includes("Healthcare") || preset.agent.industry.includes("Medical")) {
      matchedAvatar = AVATAR_OPTIONS.find((a) => a.id === "sophia")?.url || AVATAR_OPTIONS[4].url;
    } else if (preset.agent.industry.includes("Real Estate")) {
      matchedAvatar = AVATAR_OPTIONS.find((a) => a.id === "alex")?.url || AVATAR_OPTIONS[2].url;
    } else if (preset.agent.industry.includes("Restaurant")) {
      matchedAvatar = AVATAR_OPTIONS.find((a) => a.id === "maya")?.url || AVATAR_OPTIONS[0].url;
    } else if (preset.agent.industry.includes("Software") || preset.agent.industry.includes("SaaS")) {
      matchedAvatar = AVATAR_OPTIONS.find((a) => a.id === "marcus")?.url || AVATAR_OPTIONS[6].url;
    } else if (preset.agent.industry.includes("EdTech") || preset.agent.industry.includes("Academy")) {
      matchedAvatar = AVATAR_OPTIONS.find((a) => a.id === "priya")?.url || AVATAR_OPTIONS[1].url;
    }

    setFormData((prev) => ({
      ...prev,
      name: preset.agent.name,
      public_slug: slugify(preset.agent.name),
      avatar: matchedAvatar,
      welcome_message: preset.agent.greeting_message,
      system_instructions: preset.agent.system_prompt,
      personality: preset.agent.industry.includes("Hospitality")
        ? "friendly"
        : preset.agent.industry.includes("Healthcare")
        ? "support_oriented"
        : preset.agent.industry.includes("Real Estate")
        ? "sales_oriented"
        : "professional",
    }));

    // Extract quick business contact from documents if present
    const firstDoc = preset.documents[0]?.content || "";
    const phoneMatch = firstDoc.match(/Phone\s*:\s*([^\n\r]+)/i);
    const emailMatch = firstDoc.match(/Email\s*:\s*([^\n\r]+)/i);
    const addressMatch = firstDoc.match(/Location\s*:\s*([^\n\r]+)/i);
    const hoursMatch = firstDoc.match(/(?:Check-in Time|Consultation Timings|Office Hours|Timings)\s*:\s*([^\n\r]+)/i);

    const compName = preset.agent.name.includes("—")
      ? preset.agent.name.split("—")[1].trim()
      : preset.agent.name;

    setBusinessProfile({
      companyName: compName,
      phone: phoneMatch ? phoneMatch[1].trim() : "+1 (555) 019-2831",
      email: emailMatch ? emailMatch[1].trim() : "desk@company.com",
      address: addressMatch ? addressMatch[1].trim() : "Downtown Business Park",
      workingHours: hoursMatch ? hoursMatch[1].trim() : "9:00 AM - 6:00 PM (Mon-Sat)",
    });

    setSuccess(`Applied ${preset.agent.industry} preset for ${preset.agent.name}!`);
    setTimeout(() => setSuccess(""), 4000);
  }

  // Load existing agent if editing or fetch initial knowledge items
  useEffect(() => {
    let mounted = true;

    getKnowledge(undefined, "all")
      .then((kList) => {
        if (!mounted) return;
        setKnowledgeItems(kList);
      })
      .catch((err) => {
        if (mounted) console.warn("Failed to load knowledge list:", err);
      });

    if (agentIdParam) {
      getAgent(Number(agentIdParam))
        .then((agent) => {
          if (!mounted) return;
          setFormData({
            name: agent.name,
            public_slug: agent.public_slug,
            avatar: agent.avatar || AVATAR_OPTIONS[0].url,
            welcome_message: agent.welcome_message,
            system_instructions: agent.system_instructions || "",
            personality: agent.personality || "friendly",
            language: agent.language || "multilingual",
            voice_id: agent.voice_id || "maya_warm",
            speaking_style: agent.speaking_style || "warm_conversational",
            channels: agent.channels || ["web", "voice"],
            allowed_tools: agent.allowed_tools || ["search_knowledge", "get_company_info", "create_lead"],
            knowledge_item_ids: agent.knowledge_item_ids || [],
            is_published: agent.is_published,
          });
        })
        .catch((err) => {
          if (mounted) setError(err instanceof Error ? err.message : "Failed to load agent");
        });
    }

    return () => {
      mounted = false;
    };
  }, [agentIdParam]);

  function handleNameChange(name: string) {
    setFormData((prev) => {
      const shouldUpdateSlug = !agentIdParam && (!prev.public_slug || prev.public_slug === slugify(prev.name));
      return {
        ...prev,
        name,
        public_slug: shouldUpdateSlug ? slugify(name) : prev.public_slug,
      };
    });
  }

  function toggleTool(toolId: string) {
    setFormData((prev) => ({
      ...prev,
      allowed_tools: prev.allowed_tools.includes(toolId)
        ? prev.allowed_tools.filter((t) => t !== toolId)
        : [...prev.allowed_tools, toolId],
    }));
  }

  function toggleChannel(channelId: string) {
    setFormData((prev) => ({
      ...prev,
      channels: prev.channels.includes(channelId)
        ? prev.channels.filter((c) => c !== channelId)
        : [...prev.channels, channelId],
    }));
  }

  function toggleKnowledgeItem(kId: number) {
    setFormData((prev) => ({
      ...prev,
      knowledge_item_ids: prev.knowledge_item_ids.includes(kId)
        ? prev.knowledge_item_ids.filter((id) => id !== kId)
        : [...prev.knowledge_item_ids, kId],
    }));
  }

  // Voice greeting playback test
  function testVoiceGreeting() {
    if (!("speechSynthesis" in window)) {
      alert("Speech synthesis is not supported in this browser window.");
      return;
    }
    window.speechSynthesis.cancel();
    if (isSpeaking) {
      setIsSpeaking(false);
      return;
    }

    const textToSpeak = formData.welcome_message.trim() || `Hello! Welcome. I'm ${formData.name.trim() || "your AI receptionist"}. How can I assist you today?`;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = formData.voice_id === "alex_crisp" ? 1.05 : 0.95;
    utterance.pitch = formData.voice_id.includes("maya") || formData.voice_id.includes("nova") ? 1.1 : 0.9;
    
    const voices = window.speechSynthesis.getVoices();
    const isFemale = formData.voice_id.includes("maya") || formData.voice_id.includes("nova");
    const matchedVoice = voices.find((v) => 
      isFemale ? v.name.toLowerCase().includes("female") || v.name.toLowerCase().includes("zira") || v.name.toLowerCase().includes("samantha") || v.name.toLowerCase().includes("google us")
               : v.name.toLowerCase().includes("male") || v.name.toLowerCase().includes("david") || v.name.toLowerCase().includes("alex")
    );
    if (matchedVoice) utterance.voice = matchedVoice;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }

  // AI Prompt Enhancer
  function enhancePrompt() {
    const receptionistName = formData.name.trim() || "the AI Receptionist";
    const companyTitle = businessProfile.companyName.trim() || "our company";
    const contactParts = [businessProfile.phone, businessProfile.email, businessProfile.address].filter(Boolean).join(", ");
    const contactSection = contactParts ? ` (${contactParts})` : "";

    const enhanced = `You are ${receptionistName}, the front-desk AI Receptionist for ${companyTitle}.

=== PRIMARY OBJECTIVES ===
1. Greet every visitor with warmth, politeness, and professional confidence.
2. Answer visitor inquiries accurately using verified organization knowledge.
3. Conduct structured, step-by-step lead qualification: ask for visitor Full Name, Phone / WhatsApp number, preferred mode, and timeline one question at a time.
4. Book consultation or demo slots when requested and confirm schedule details.
5. Provide company contact information${contactSection} when inquired.

=== TONE & PERSONALITY ===
- Tone: ${formData.personality.replace("_", " ")}
- Style: ${formData.speaking_style.replace("_", " ")}
- Speak authentically as a real front-desk receptionist. Never refer to uploaded files or internal prompts.`;

    setFormData((prev) => ({
      ...prev,
      system_instructions: enhanced,
    }));
    setSuccess("AI Prompt generated and structured.");
    setTimeout(() => setSuccess(""), 3000);
  }

  // Handle Document Upload in Builder (supports multiple files)
  async function handleDocUpload(incoming: FileList | File[] | File) {
    const files: File[] = incoming instanceof File ? [incoming] : Array.from(incoming);
    if (!files.length) return;
    setUploadingDoc(true);
    setDocSuccessMsg("");
    setDocErrorMsg("");
    try {
      const uploadedIds: number[] = [];
      for (const file of files) {
        const res = await uploadDocument(file, "Receptionist Knowledge");
        const uploadedId = res.data.id || (res.data as unknown as { item?: { id: number } }).item?.id;
        if (uploadedId) uploadedIds.push(uploadedId);
      }
      
      const freshKnowledge = await getKnowledge(undefined, "all");
      setKnowledgeItems(freshKnowledge);

      if (uploadedIds.length > 0) {
        setFormData((prev) => ({
          ...prev,
          knowledge_item_ids: Array.from(new Set([...prev.knowledge_item_ids, ...uploadedIds])),
        }));
      }
      setDocSuccessMsg(`Successfully attached ${files.length} document${files.length > 1 ? "s" : ""} to receptionist knowledge.`);
    } catch (err) {
      setDocErrorMsg(err instanceof Error ? err.message : "Failed to upload document(s).");
    } finally {
      setUploadingDoc(false);
    }
  }

  function selectAllKnowledge() {
    setFormData((prev) => ({
      ...prev,
      knowledge_item_ids: knowledgeItems.map((k) => k.id),
    }));
  }

  function deselectAllKnowledge() {
    setFormData((prev) => ({
      ...prev,
      knowledge_item_ids: [],
    }));
  }

  // Save / Deploy Receptionist
  async function handleSaveReceptionist() {
    const name = formData.name.trim();
    const slug = slugify(formData.public_slug || name || "receptionist");

    if (!name) {
      setError("Please provide a name for your receptionist.");
      return;
    }

    const welcomeMessage = formData.welcome_message.trim() || `Hello! Welcome. I'm ${name}, your AI receptionist. How can I assist you today?`;
    const systemInstructions = formData.system_instructions.trim() || `You are ${name}, the front-desk AI Receptionist for ${businessProfile.companyName.trim() || "our company"}. Greet visitors warmly, answer questions accurately based on uploaded knowledge documents, and assist with their inquiries.`;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      let saved: Agent;
      if (agentIdParam) {
        saved = await updateAgent(Number(agentIdParam), {
          name,
          avatar: formData.avatar,
          public_slug: slug,
          welcome_message: welcomeMessage,
          system_instructions: systemInstructions,
          personality: formData.personality as Agent["personality"],
          language: formData.language as Agent["language"],
          voice_id: formData.voice_id,
          speaking_style: formData.speaking_style,
          channels: formData.channels,
          allowed_tools: formData.allowed_tools,
          knowledge_item_ids: formData.knowledge_item_ids,
          is_active: true,
          is_published: formData.is_published,
        });
        await updateAgentKnowledge(saved.id, { knowledge_item_ids: formData.knowledge_item_ids });
      } else {
        saved = await createAgent({
          name,
          avatar: formData.avatar,
          public_slug: slug,
          welcome_message: welcomeMessage,
          system_instructions: systemInstructions,
          personality: formData.personality,
          language: formData.language,
          voice_id: formData.voice_id,
          speaking_style: formData.speaking_style,
          channels: formData.channels,
          allowed_tools: formData.allowed_tools,
          knowledge_item_ids: formData.knowledge_item_ids,
        });
      }

      setCreatedAgent(saved);
      setShowSuccessModal(true);
      setSuccess("Receptionist built and deployed successfully!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to build receptionist.");
    } finally {
      setSaving(false);
    }
  }

  const activeSlug = formData.public_slug || slugify(formData.name) || "your-receptionist";
  const publicUrl = `${window.location.origin}/chat/${activeSlug}`;
  const widgetSnippet = `<script src="${window.location.origin}/widget.js" data-agent="${activeSlug}" async></script>`;

  const progressPercentage = (currentStep / 4) * 100;

  return (
    <div className="flex-1 min-h-screen bg-slate-900 pb-16 text-slate-100">
      <PageHeader
        title={agentIdParam ? `Edit Receptionist: ${formData.name || "Receptionist"}` : "Build Your AI Receptionist"}
        description="Design, customize, train, and deploy your custom front-desk AI receptionist with realistic voice, company knowledge, and lead capture."
      >
        <div className="flex items-center gap-3">
          <Link
            to="/agents"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-700 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Receptionists
          </Link>
          <button
            type="button"
            onClick={handleSaveReceptionist}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-500 hover:to-violet-500 transition disabled:opacity-50"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                {agentIdParam ? "Update Receptionist" : "Build & Deploy Receptionist"}
              </>
            )}
          </button>
        </div>
      </PageHeader>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Status Alerts */}
        {error && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-950/40 p-4 text-sm text-rose-200">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-rose-400" />
              <span>{error}</span>
            </div>
            <button type="button" onClick={() => setError("")} className="text-xs font-semibold text-rose-400 hover:text-white">
              Dismiss
            </button>
          </div>
        )}

        {success && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-4 text-sm text-emerald-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{success}</span>
            </div>
            <button type="button" onClick={() => setSuccess("")} className="text-xs font-semibold text-emerald-400 hover:text-white">
              Dismiss
            </button>
          </div>
        )}

        {/* Main Step Wizard Window */}
        <div className="max-w-4xl mx-auto">
          <div className="rounded-3xl border border-slate-800 bg-slate-950/90 shadow-2xl flex flex-col overflow-hidden">
              
              {/* Wizard Window Top Bar with Stepper & Progress */}
              <div className="border-b border-slate-800 bg-slate-900/90 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400">
                      <Sliders className="w-4 h-4" />
                    </span>
                    <div>
                      <h2 className="text-sm font-bold text-white">Receptionist Builder Wizard</h2>
                      <p className="text-[11px] text-slate-400">
                        Step {currentStep} of 4 • {STEPS[currentStep - 1].label}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-bold text-indigo-400 border border-indigo-500/20">
                      {progressPercentage}% Completed
                    </span>
                  </div>
                </div>

                {/* Progress Bar Track */}
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-violet-500 h-1.5 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>

                {/* Interactive Step Slider Pills */}
                <div className="grid grid-cols-4 gap-2 pt-1">
                  {STEPS.map((step) => {
                    const isActive = currentStep === step.id;
                    const isCompleted = currentStep > step.id;
                    return (
                      <button
                        key={step.id}
                        type="button"
                        onClick={() => setCurrentStep(step.id)}
                        className={`flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1.5 p-2 rounded-xl border text-left transition ${
                          isActive
                            ? "border-indigo-500 bg-indigo-950/50 text-white shadow-sm ring-1 ring-indigo-500/30"
                            : isCompleted
                            ? "border-slate-800 bg-slate-900/60 text-emerald-400 hover:bg-slate-800"
                            : "border-slate-800/80 bg-slate-900/30 text-slate-500 hover:text-slate-400 hover:bg-slate-900/60"
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                            isActive
                              ? "bg-indigo-600 text-white"
                              : isCompleted
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {isCompleted ? "✓" : step.id}
                        </span>
                        <span className="text-[11px] font-semibold truncate hidden sm:inline">
                          {step.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Wizard Window Body (Stepped View Content) */}
              <div className="p-6 space-y-6 min-h-[480px]">
                
                {/* STEP 1: PERSONA & VOICE */}
                {currentStep === 1 && (
                  <div className="space-y-5 animate-fadeIn">
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <Bot className="w-5 h-5 text-indigo-400" />
                        Step 1: Receptionist Identity & Persona
                      </h3>
                      <p className="mt-1 text-xs text-slate-400">
                        Define the name, avatar photo, speech style, and welcoming tone for your front-desk assistant.
                      </p>
                    </div>

                    {/* Quick Industry Starter Templates */}
                    {industryPresets.length > 0 && (
                      <div className="rounded-2xl border border-indigo-500/20 bg-indigo-950/20 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-amber-300" />
                            <span className="text-xs font-bold uppercase tracking-wider text-indigo-200">
                              Quick Industry Starter Templates
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400">
                            1-Click Domain Setup
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {industryPresets.map((preset) => {
                            const isSelected = selectedPresetId === preset.agent.id;
                            return (
                              <button
                                key={preset.agent.id}
                                type="button"
                                onClick={() => applyIndustryPreset(preset)}
                                className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                                  isSelected
                                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-2 ring-indigo-400"
                                    : "bg-slate-900/90 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800"
                                }`}
                              >
                                <span>{preset.agent.industry}</span>
                                <span className="text-[10px] opacity-75 font-normal">
                                  ({preset.agent.business_type})
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                          Receptionist Name & Title
                        </label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => handleNameChange(e.target.value)}
                          placeholder="e.g. Maya / Alex / Sarah (Front Desk Assistant)"
                          className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                          Public Handle / URL Slug
                        </label>
                        <div className="mt-1.5 flex rounded-xl border border-slate-800 bg-slate-900 overflow-hidden focus-within:border-indigo-500">
                          <span className="bg-slate-800/80 px-3 py-2.5 text-xs text-slate-400 select-none">/chat/</span>
                          <input
                            type="text"
                            value={formData.public_slug}
                            onChange={(e) => setFormData((p) => ({ ...p, public_slug: slugify(e.target.value) }))}
                            placeholder="custom-receptionist-slug"
                            className="w-full bg-transparent px-2.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Avatar Selection */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                        Select Avatar Photo
                      </label>
                      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5">
                        {AVATAR_OPTIONS.map((av) => (
                          <button
                            key={av.id}
                            type="button"
                            onClick={() => setFormData((p) => ({ ...p, avatar: av.url }))}
                            className={`group relative rounded-xl overflow-hidden border-2 transition aspect-square ${
                              formData.avatar === av.url
                                ? "border-indigo-500 ring-2 ring-indigo-500/30 scale-105"
                                : "border-slate-800 opacity-70 hover:opacity-100 hover:border-slate-600"
                            }`}
                            title={av.name}
                          >
                            <img src={av.url} alt={av.name} className="w-full h-full object-cover" />
                            {formData.avatar === av.url && (
                              <div className="absolute inset-0 bg-indigo-600/30 flex items-center justify-center">
                                <Check className="w-4 h-4 text-white drop-shadow-md" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                      <div className="mt-2.5 flex items-center gap-2">
                        <input
                          type="text"
                          value={formData.avatar}
                          onChange={(e) => setFormData((p) => ({ ...p, avatar: e.target.value }))}
                          placeholder="Or enter custom image URL"
                          className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Personality Tone */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                        Personality Tone
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {PERSONALITIES.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setFormData((prev) => ({ ...prev, personality: p.id }))}
                            className={`flex flex-col text-left p-3 rounded-xl border transition ${
                              formData.personality === p.id
                                ? "border-indigo-500 bg-indigo-950/40 text-white"
                                : "border-slate-800 bg-slate-900/60 text-slate-300 hover:bg-slate-900"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold">{p.label}</span>
                              {formData.personality === p.id && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                            </div>
                            <p className="mt-1 text-[11px] text-slate-400">{p.desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Voice Engine Profile */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                          Voice Engine & Audio Persona
                        </label>
                        <button
                          type="button"
                          onClick={testVoiceGreeting}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-950/50 px-2.5 py-1 text-xs font-semibold text-indigo-300 hover:bg-indigo-900/60 transition"
                        >
                          <Volume2 className={`w-3.5 h-3.5 ${isSpeaking ? "animate-pulse text-emerald-400" : ""}`} />
                          {isSpeaking ? "Speaking..." : "🔊 Test Voice Greeting"}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {VOICES.map((v) => (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => setFormData((prev) => ({ ...prev, voice_id: v.id }))}
                            className={`flex items-center justify-between p-3 rounded-xl border transition text-left ${
                              formData.voice_id === v.id
                                ? "border-indigo-500 bg-indigo-950/40 text-white"
                                : "border-slate-800 bg-slate-900/60 text-slate-300 hover:bg-slate-900"
                            }`}
                          >
                            <div>
                              <p className="text-xs font-bold">{v.label}</p>
                              <p className="text-[10px] text-slate-400">{v.gender} • {v.lang}</p>
                            </div>
                            {formData.voice_id === v.id && <Check className="w-4 h-4 text-indigo-400" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 2: BUSINESS & KNOWLEDGE */}
                {currentStep === 2 && (
                  <div className="space-y-5 animate-fadeIn">
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <Building className="w-5 h-5 text-indigo-400" />
                        Step 2: Business Profile & Verified Knowledge
                      </h3>
                      <p className="mt-1 text-xs text-slate-400">
                        Equip your receptionist with verified organizational details, curriculum documents, and FAQ databases.
                      </p>
                    </div>

                    {/* Organization Fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 rounded-xl border border-slate-800/80 bg-slate-900/50 p-4">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 uppercase">Organization / Institute Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Acme Institute / Maruthi Tech"
                          value={businessProfile.companyName}
                          onChange={(e) => setBusinessProfile((p) => ({ ...p, companyName: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 uppercase">Front-Desk Phone Line</label>
                        <input
                          type="text"
                          placeholder="e.g. +91 98765 43210"
                          value={businessProfile.phone}
                          onChange={(e) => setBusinessProfile((p) => ({ ...p, phone: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 uppercase">Official Email Address</label>
                        <input
                          type="email"
                          placeholder="e.g. contact@example.com"
                          value={businessProfile.email}
                          onChange={(e) => setBusinessProfile((p) => ({ ...p, email: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 uppercase">Campus / Center Address</label>
                        <input
                          type="text"
                          placeholder="e.g. 123 Innovation Blvd, Suite 400"
                          value={businessProfile.address}
                          onChange={(e) => setBusinessProfile((p) => ({ ...p, address: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Instant Document Upload */}
                    <div className="rounded-xl border border-dashed border-indigo-500/30 bg-indigo-950/20 p-4">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400">
                            <UploadCloud className="w-5 h-5" />
                          </span>
                          <div>
                            <p className="text-xs font-bold text-white">Upload Knowledge Documents</p>
                            <p className="text-[11px] text-slate-400">PDF, DOCX, TXT, CSV, MD, JSON — Upload any document, any data</p>
                          </div>
                        </div>
                        <div>
                          <input
                            ref={docInputRef}
                            type="file"
                            multiple
                            accept=".pdf,.docx,.txt,.csv,.md,.json"
                            className="hidden"
                            onChange={(e) => {
                              const files = e.target.files;
                              if (files && files.length > 0) handleDocUpload(files);
                            }}
                          />
                          <button
                            type="button"
                            disabled={uploadingDoc}
                            onClick={() => docInputRef.current?.click()}
                            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition disabled:opacity-50"
                          >
                            {uploadingDoc ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Ingesting...
                              </>
                            ) : (
                              <>
                                <Plus className="w-3.5 h-3.5" /> Attach Documents
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                      {docSuccessMsg && <p className="mt-2 text-xs font-semibold text-emerald-400">{docSuccessMsg}</p>}
                      {docErrorMsg && <p className="mt-2 text-xs font-semibold text-rose-400">{docErrorMsg}</p>}
                    </div>

                    {/* Knowledge Base Multi-Selection */}
                    <div>
                      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                          Bind Knowledge Base Items ({formData.knowledge_item_ids.length} of {knowledgeItems.length} selected)
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={selectAllKnowledge}
                            className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 transition"
                          >
                            Select All
                          </button>
                          <span className="text-slate-600">•</span>
                          <button
                            type="button"
                            onClick={deselectAllKnowledge}
                            className="text-[11px] font-semibold text-slate-400 hover:text-slate-300 transition"
                          >
                            Deselect All
                          </button>
                          <span className="text-slate-600">•</span>
                          <Link to="/knowledge" className="text-[11px] font-semibold text-slate-400 hover:text-white transition">
                            Manage Knowledge →
                          </Link>
                        </div>
                      </div>
                      <div className="app-scrollbar max-h-52 space-y-2 overflow-y-auto pr-1">
                        {knowledgeItems.map((item) => {
                          const isSelected = formData.knowledge_item_ids.includes(item.id);
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => toggleKnowledgeItem(item.id)}
                              className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition ${
                                isSelected
                                  ? "border-indigo-500/60 bg-indigo-950/30 text-white"
                                  : "border-slate-800 bg-slate-900/50 text-slate-300 hover:bg-slate-900"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0 pr-3">
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-xs text-indigo-400">
                                  <FileText className="w-3.5 h-3.5" />
                                </span>
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-bold text-white">{item.title}</p>
                                  <p className="truncate text-[10px] text-slate-400">{item.category} • {item.content.slice(0, 60)}...</p>
                                </div>
                              </div>
                              <span
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs ${
                                  isSelected ? "border-indigo-500 bg-indigo-600 text-white" : "border-slate-700 bg-slate-800 text-transparent"
                                }`}
                              >
                                ✓
                              </span>
                            </button>
                          );
                        })}
                        {knowledgeItems.length === 0 && (
                          <div className="rounded-xl border border-slate-800 p-4 text-center text-xs text-slate-500">
                            No knowledge items found. Upload a syllabus or FAQ document above.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 3: INTAKE RULES & AI PROMPT */}
                {currentStep === 3 && (
                  <div className="space-y-5 animate-fadeIn">
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <Sliders className="w-5 h-5 text-indigo-400" />
                        Step 3: Behavior, Lead Intake Rules & Prompting
                      </h3>
                      <p className="mt-1 text-xs text-slate-400">
                        Configure greeting messages, lead qualification steps, and autonomous front-desk tool capabilities.
                      </p>
                    </div>

                    {/* Welcome Greeting Message */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                        Opening Welcome Greeting
                      </label>
                      <textarea
                        rows={2}
                        value={formData.welcome_message}
                        onChange={(e) => setFormData((p) => ({ ...p, welcome_message: e.target.value }))}
                        placeholder="e.g. Hello! Welcome. How can I assist you today?"
                        className="w-full rounded-xl border border-slate-800 bg-slate-900 p-3 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>

                    {/* System Prompt with AI Enhancer */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                          System Instructions / Core Prompt
                        </label>
                        <button
                          type="button"
                          onClick={enhancePrompt}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          ✨ AI Prompt Enhancer
                        </button>
                      </div>
                      <textarea
                        rows={5}
                        value={formData.system_instructions}
                        onChange={(e) => setFormData((p) => ({ ...p, system_instructions: e.target.value }))}
                        placeholder="Enter custom receptionist behavior guidelines, policies, and tone rules (or click AI Prompt Enhancer to auto-generate)..."
                        className="w-full font-mono text-xs rounded-xl border border-slate-800 bg-slate-900 p-3 text-slate-200 leading-relaxed placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>

                    {/* Allowed Tools */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                        Autonomous Receptionist Tools
                      </label>
                      <div className="space-y-2">
                        {AVAILABLE_TOOLS.map((tool) => {
                          const isChecked = formData.allowed_tools.includes(tool.id);
                          return (
                            <button
                              key={tool.id}
                              type="button"
                              onClick={() => toggleTool(tool.id)}
                              className={`flex w-full items-center justify-between p-3 rounded-xl border text-left transition ${
                                isChecked
                                  ? "border-indigo-500/60 bg-indigo-950/30 text-white"
                                  : "border-slate-800 bg-slate-900/50 text-slate-400 hover:bg-slate-900"
                              }`}
                            >
                              <div>
                                <p className="text-xs font-bold text-white">{tool.name}</p>
                                <p className="text-[11px] text-slate-400">{tool.desc}</p>
                              </div>
                              <span
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs ${
                                  isChecked ? "border-indigo-500 bg-indigo-600 text-white" : "border-slate-700 bg-slate-800 text-transparent"
                                }`}
                              >
                                ✓
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 4: CHANNELS & DEPLOYMENT */}
                {currentStep === 4 && (
                  <div className="space-y-5 animate-fadeIn">
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <Globe className="w-5 h-5 text-indigo-400" />
                        Step 4: Channels, Public Link & Deployment
                      </h3>
                      <p className="mt-1 text-xs text-slate-400">
                        Activate channels where this receptionist is accessible, copy the embed snippet, and launch.
                      </p>
                    </div>

                    {/* Channels Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { id: "web", name: "Web Chat Widget", icon: MessageSquare, desc: "Floating bubble on your website" },
                        { id: "voice", name: "Voice Phone Line", icon: Phone, desc: "Low-latency telephony & dial-in" },
                        { id: "whatsapp", name: "WhatsApp Bot", icon: Globe, desc: "Direct messaging & lead sync" },
                      ].map((ch) => {
                        const active = formData.channels.includes(ch.id);
                        return (
                          <button
                            key={ch.id}
                            type="button"
                            onClick={() => toggleChannel(ch.id)}
                            className={`flex flex-col text-left p-3.5 rounded-xl border transition ${
                              active
                                ? "border-indigo-500 bg-indigo-950/40 text-white"
                                : "border-slate-800 bg-slate-900/60 text-slate-400 hover:bg-slate-900"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <ch.icon className={`w-4 h-4 ${active ? "text-indigo-400" : "text-slate-500"}`} />
                              <span
                                className={`h-2 w-2 rounded-full ${active ? "bg-emerald-400 shadow-sm shadow-emerald-400/50" : "bg-slate-700"}`}
                              />
                            </div>
                            <p className="text-xs font-bold text-white">{ch.name}</p>
                            <p className="mt-0.5 text-[10px] text-slate-400">{ch.desc}</p>
                          </button>
                        );
                      })}
                    </div>

                    {/* Shareable Public URL */}
                    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-white flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-indigo-400" />
                          Public Shareable Chat Page
                        </label>
                        <a
                          href={publicUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300"
                        >
                          Open in Tab <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={publicUrl}
                          className="flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-300 font-mono select-all"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(publicUrl);
                            setCopiedLink(true);
                            setTimeout(() => setCopiedLink(false), 2000);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
                        >
                          {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedLink ? "Copied" : "Copy"}
                        </button>
                      </div>
                    </div>

                    {/* Embed Widget Snippet */}
                    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-white flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                          1-Click Embeddable HTML Widget Snippet
                        </label>
                        <span className="text-[10px] text-slate-400">Place before &lt;/body&gt;</span>
                      </div>
                      <div className="relative">
                        <pre className="rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] text-indigo-300 overflow-x-auto">
                          {widgetSnippet}
                        </pre>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(widgetSnippet);
                            setCopiedSnippet(true);
                            setTimeout(() => setCopiedSnippet(false), 2000);
                          }}
                          className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2 py-1 text-[10px] font-semibold text-slate-300 hover:bg-slate-700"
                        >
                          {copiedSnippet ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          {copiedSnippet ? "Copied" : "Copy"}
                        </button>
                      </div>
                    </div>

                    {/* Publish Toggle */}
                    <div className="flex items-center justify-between rounded-xl border border-indigo-500/20 bg-indigo-950/20 p-4">
                      <div>
                        <p className="text-xs font-bold text-white">Publish Receptionist Immediately</p>
                        <p className="text-[11px] text-slate-400">Make accessible via live chat widgets, voice line, and public links</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData((p) => ({ ...p, is_published: !p.is_published }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                          formData.is_published ? "bg-indigo-600" : "bg-slate-700"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                            formData.is_published ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Wizard Window Bottom Slider Navigation Controls */}
              <div className="border-t border-slate-800 bg-slate-900/90 p-4 px-6 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
                  disabled={currentStep === 1}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Previous Step
                </button>

                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4].map((stepNum) => (
                    <button
                      key={stepNum}
                      type="button"
                      onClick={() => setCurrentStep(stepNum)}
                      className={`h-2 rounded-full transition-all ${
                        currentStep === stepNum ? "w-6 bg-indigo-500" : "w-2 bg-slate-700 hover:bg-slate-600"
                      }`}
                      title={`Go to Step ${stepNum}`}
                    />
                  ))}
                </div>

                {currentStep < 4 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentStep((prev) => Math.min(4, prev + 1))}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-indigo-600/30 hover:bg-indigo-500 transition active:scale-95"
                  >
                    Next Step <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSaveReceptionist}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-500 hover:to-violet-500 transition active:scale-95 disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    {saving ? "Saving..." : agentIdParam ? "Update Receptionist" : "Build & Deploy Receptionist"}
                  </button>
                )}
              </div>

            </div>
          </div>
        </div>

      {/* Deployment Success Modal */}
      {showSuccessModal && createdAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-lg rounded-3xl border border-indigo-500/30 bg-slate-950 p-6 shadow-2xl text-slate-100 space-y-5 animate-fadeIn">
            {/* Close (X) button at top right */}
            <button
              type="button"
              onClick={() => setShowSuccessModal(false)}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              aria-label="Close window"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 pr-8">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </span>
              <div>
                <h3 className="text-lg font-bold text-white">Receptionist Deployed Successfully!</h3>
                <p className="text-xs text-slate-400">
                  {createdAgent.name} is now live and ready to greet visitors.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span>Public Shareable Link</span>
                <span className="text-emerald-400 font-bold">Active</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/chat/${createdAgent.public_slug}`}
                  className="flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-300 font-mono select-all"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/chat/${createdAgent.public_slug}`);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold hover:bg-slate-700"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSuccessModal(false)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-700"
              >
                <X className="w-3.5 h-3.5" />
                Close Window
              </button>
              <a
                href={`/chat/${createdAgent.public_slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
              >
                Open Live Receptionist <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <Link
                to="/agents"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
              >
                Go to AI Receptionists
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
