import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  Globe,
  Phone,
  MessageSquare,
  Code2,
  Trash2,
  Edit3,
  ExternalLink,
  Play,
  Volume2,
  UploadCloud,
  FileText,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import PageHeader from "../components/common/PageHeader";
import {
  createAgent,
  deleteAgent,
  getAgents,
  publishAgent,
  unpublishAgent,
  updateAgent,
  updateAgentKnowledge,
  type Agent,
  type AgentCreate,
} from "../api/agents";
import { getKnowledge, type KnowledgeItem } from "../api/knowledge";
import { uploadDocument } from "../api/documents";

const PERSONALITIES = [
  { id: "friendly", label: "Friendly & Warm", desc: "Approachable, conversational, and helpful." },
  { id: "professional", label: "Corporate & Professional", desc: "Concise, respectful, and business-focused." },
  { id: "sales_oriented", label: "Sales & Qualifier", desc: "Proactive, high-conversion, focused on capturing budget & needs." },
  { id: "support_oriented", label: "Support & Triage", desc: "Patient, thorough, focused on problem resolution." },
];

const VOICES = [
  { id: "maya_warm", label: "Maya — Warm Conversational", gender: "Female" },
  { id: "alex_crisp", label: "Alex — Crisp Executive", gender: "Male" },
  { id: "nova_smooth", label: "Nova — Smooth & Calm", gender: "Female" },
  { id: "echo_deep", label: "Echo — Deep & Authoritative", gender: "Male" },
];

const AVAILABLE_TOOLS = [
  { id: "search_knowledge", name: "Search Knowledge Base", desc: "Retrieves company FAQs and verified manuals." },
  { id: "get_company_info", name: "Company Profile & Location", desc: "Provides verified address, phone, and leadership." },
  { id: "get_business_hours", name: "Working Hours & Schedule", desc: "Answers operating schedule and 24/7 AI availability." },
  { id: "create_lead", name: "Lead Qualification & Capture", desc: "Stores visitor contact info and computes lead score." },
  { id: "schedule_appointment", name: "Book Appointments", desc: "Checks open calendar slots and confirms demos." },
  { id: "transfer_to_human", name: "Human Escalation Handoff", desc: "Alerts live human staff when complaints arise." },
];

const INITIAL_WIZARD_DATA: AgentCreate & {
  personality: string;
  voice_id: string;
  speaking_style: string;
  channels: string[];
  allowed_tools: string[];
} = {
  name: "",
  avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
  public_slug: "",
  welcome_message: "Hello! Welcome to Apex Solutions. I'm your AI receptionist. How can I assist you today?",
  system_instructions: "You are an intelligent digital receptionist. Greet visitors warmly, answer questions accurately from verified knowledge, qualify leads, and schedule consultations.",
  personality: "friendly",
  voice_id: "maya_warm",
  speaking_style: "warm_conversational",
  channels: ["web", "voice", "whatsapp"],
  allowed_tools: ["search_knowledge", "get_company_info", "create_lead", "schedule_appointment", "transfer_to_human"],
  knowledge_item_ids: [],
};

export default function Agents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Wizard modal state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [formData, setFormData] = useState(INITIAL_WIZARD_DATA);
  const [saving, setSaving] = useState(false);
  const [editingAgentId, setEditingAgentId] = useState<number | null>(null);

  // Widget embed modal state
  const [embedAgent, setEmbedAgent] = useState<Agent | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [deletingAgentId, setDeletingAgentId] = useState<number | null>(null);

  // Wizard document attachment state
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docUploadSuccess, setDocUploadSuccess] = useState("");
  const [docUploadError, setDocUploadError] = useState("");
  const wizardDocInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([getAgents(), getKnowledge(undefined, "all")])
      .then(([agentData, knowledgeData]) => {
        if (!mounted) return;
        setAgents(agentData);
        setKnowledge(knowledgeData);
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : "Unable to load receptionists.");
      });
    return () => {
      mounted = false;
    };
  }, []);

  function slugify(val: string) {
    return val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100);
  }

  function openCreateWizard() {
    setEditingAgentId(null);
    setFormData({ ...INITIAL_WIZARD_DATA });
    setWizardStep(1);
    setWizardOpen(true);
    setError("");
    setSuccess("");
  }

  function openEditWizard(agent: Agent) {
    setEditingAgentId(agent.id);
    setFormData({
      name: agent.name,
      avatar: agent.avatar || INITIAL_WIZARD_DATA.avatar,
      public_slug: agent.public_slug,
      welcome_message: agent.welcome_message,
      system_instructions: agent.system_instructions || "",
      personality: agent.personality || "friendly",
      voice_id: agent.voice_id || "maya_warm",
      speaking_style: agent.speaking_style || "warm_conversational",
      channels: agent.channels || ["web", "voice"],
      allowed_tools: agent.allowed_tools || ["search_knowledge", "create_lead"],
      knowledge_item_ids: agent.knowledge_item_ids || [],
    });
    setWizardStep(1);
    setWizardOpen(true);
    setError("");
    setSuccess("");
  }

  async function handleWizardSubmit(e?: FormEvent) {
    if (e) e.preventDefault();
    if (saving) return;
    const name = formData.name.trim();
    const slug = slugify(formData.public_slug || name);
    if (!name) {
      setError("Please provide a name for the receptionist.");
      return;
    }
    setSaving(true);
    setError("");

    try {
      if (editingAgentId) {
        const updated = await updateAgent(editingAgentId, {
          name,
          avatar: formData.avatar,
          public_slug: slug,
          welcome_message: formData.welcome_message,
          system_instructions: formData.system_instructions,
          personality: formData.personality,
          voice_id: formData.voice_id,
          speaking_style: formData.speaking_style,
          channels: formData.channels,
          allowed_tools: formData.allowed_tools,
          knowledge_item_ids: formData.knowledge_item_ids,
        });
        await updateAgentKnowledge(editingAgentId, { knowledge_item_ids: formData.knowledge_item_ids });
        setAgents((prev) => prev.map((a) => (a.id === editingAgentId ? updated : a)));
        setSuccess("AI Receptionist updated successfully.");
      } else {
        const created = await createAgent({
          name,
          avatar: formData.avatar,
          public_slug: slug,
          welcome_message: formData.welcome_message,
          system_instructions: formData.system_instructions,
          personality: formData.personality,
          voice_id: formData.voice_id,
          speaking_style: formData.speaking_style,
          channels: formData.channels,
          allowed_tools: formData.allowed_tools,
          knowledge_item_ids: formData.knowledge_item_ids,
        });
        setAgents((prev) => [created, ...prev]);
        setSuccess("AI Receptionist created and configured.");
      }
      setWizardOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save receptionist.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTogglePublish(agent: Agent) {
    try {
      if (agent.is_published) {
        const unpublished = await unpublishAgent(agent.id);
        setAgents((prev) => prev.map((a) => (a.id === agent.id ? unpublished : a)));
      } else {
        const published = await publishAgent(agent.id);
        setAgents((prev) => prev.map((a) => (a.id === agent.id ? published : a)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle publish status.");
    }
  }

  async function handleDeleteAgent(id: number) {
    try {
      await deleteAgent(id);
      setAgents((prev) => prev.filter((a) => a.id !== id));
      setDeletingAgentId(null);
      setSuccess("Receptionist deleted successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete receptionist.");
    }
  }

  async function handleWizardFileUpload(file: File) {
    if (!file) return;
    setUploadingDoc(true);
    setDocUploadSuccess("");
    setDocUploadError("");
    try {
      const res = await uploadDocument(file, "Receptionist Documents", editingAgentId ?? undefined);
      const uploadedId = res.data.id || (res.data as unknown as { item?: { id: number } }).item?.id;
      
      // Refresh knowledge list
      const freshKnowledge = await getKnowledge(undefined, "all");
      setKnowledge(freshKnowledge);

      // Auto-bind this document to the current receptionist form
      if (uploadedId) {
        setFormData((prev) => ({
          ...prev,
          knowledge_item_ids: Array.from(new Set([...prev.knowledge_item_ids, uploadedId])),
        }));
      } else {
        const found = freshKnowledge.find((k) => k.title === file.name.replace(/\.[^/.]+$/, ""));
        if (found) {
          setFormData((prev) => ({
            ...prev,
            knowledge_item_ids: Array.from(new Set([...prev.knowledge_item_ids, found.id])),
          }));
        }
      }

      setDocUploadSuccess(`Document "${file.name}" uploaded and attached! The AI will strictly ground its responses in it.`);
      if (wizardDocInputRef.current) wizardDocInputRef.current.value = "";
    } catch (err) {
      setDocUploadError(err instanceof Error ? err.message : "Failed to upload document.");
    } finally {
      setUploadingDoc(false);
    }
  }

  function getEmbedSnippet(slug: string) {
    return `<!-- Apex Solutions AI Receptionist Widget -->
<script
  src="https://apexsolutions.ai/widget.js"
  data-agent-slug="${slug}"
  data-theme="indigo"
  data-position="bottom-right"
  async>
</script>`;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="AI Receptionists"
        description="Build, customize, and deploy conversational digital receptionists across website chat, telephone voice lines, and WhatsApp."
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/build-receptionist"
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-600/25 hover:from-indigo-500 hover:to-violet-500 transition active:scale-95"
            >
              <Sparkles className="h-4 w-4 text-amber-300" />
              + Build Your Own Receptionist
            </Link>
            <button
              onClick={openCreateWizard}
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition active:scale-95"
            >
              <Plus className="h-4 w-4" />
              Quick Wizard
            </button>
          </div>
        }
      />

      {/* Build Receptionist Dedicated Section Callout Banner */}
      <div className="rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-semibold text-indigo-300 ring-1 ring-indigo-400/30">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" /> Dedicated Receptionist Studio
            </div>
            <h2 className="text-xl font-bold tracking-tight">Create & Train Your Custom AI Receptionist</h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Design a realistic front-desk receptionist trained on your course brochures, clinic policies, or legal fee schedules with instant voice playback, custom avatar picker, and real-time live interactive testing.
            </p>
          </div>
          <Link
            to="/build-receptionist"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-xs font-bold text-indigo-950 shadow-md hover:bg-indigo-50 transition active:scale-95 shrink-0"
          >
            Launch Builder Studio →
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {success}
        </div>
      )}

      {/* Receptionists List */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition"
          >
            <div>
              {/* Header with Avatar, Name, Slug, & Status */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <img
                    src={
                      agent.avatar ||
                      "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80"
                    }
                    alt={agent.name}
                    className="h-12 w-12 rounded-2xl object-cover ring-2 ring-indigo-50 shadow-sm"
                  />
                  <div>
                    <h2 className="text-base font-bold text-slate-900">{agent.name}</h2>
                    <p className="font-mono text-xs text-slate-400">/{agent.public_slug}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTogglePublish(agent)}
                    className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${
                      agent.is_published
                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {agent.is_published ? "● Published" : "Draft"}
                  </button>
                </div>
              </div>

              {/* Welcome Message Preview */}
              <div className="mt-4 rounded-2xl bg-slate-50 p-3.5 text-xs text-slate-700 border border-slate-100">
                <p className="font-bold text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                  Greeting Message
                </p>
                <p className="italic">"{agent.welcome_message}"</p>
              </div>

              {/* Channels & Properties */}
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                {agent.channels?.map((ch) => (
                  <span
                    key={ch}
                    className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700"
                  >
                    {ch === "web" ? <Globe className="h-3 w-3" /> : ch === "voice" ? <Phone className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />}
                    {ch.toUpperCase()}
                  </span>
                ))}
                <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 capitalize">
                  {agent.personality || "Friendly"}
                </span>
                <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                  {agent.knowledge_item_ids?.length || 0} Knowledge Docs
                </span>
              </div>
            </div>

            {/* Bottom Actions Toolbar */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
              <div className="flex items-center gap-2">
                <Link
                  to={`/chat/agent/${agent.id}`}
                  className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition"
                >
                  <Play className="h-3.5 w-3.5" />
                  Test Chat
                </Link>
                <Link
                  to="/voice"
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  <Phone className="h-3.5 w-3.5" />
                  Voice Call
                </Link>
                <button
                  onClick={() => setEmbedAgent(agent)}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  <Code2 className="h-3.5 w-3.5" />
                  Embed Widget
                </button>
                <Link
                  to={`/agents/builder/${agent.id}`}
                  className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition"
                  title="Open Full Studio Builder"
                >
                  <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                  Studio
                </Link>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => openEditWizard(agent)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                  title="Configure"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
                {agents.length > 1 && (
                  deletingAgentId === agent.id ? (
                    <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                      <button
                        onClick={() => handleDeleteAgent(agent.id)}
                        className="rounded-xl bg-rose-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-rose-700 transition"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setDeletingAgentId(null)}
                        className="rounded-xl border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeletingAgentId(agent.id)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                      title="Delete Receptionist"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Multi-Step Receptionist Builder Modal */}
      {wizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl space-y-6 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingAgentId ? "Configure AI Receptionist" : "Build AI Receptionist"}
                </h3>
                <p className="text-xs text-slate-500">Step {wizardStep} of 4: Customize identity, voice, knowledge, and tools</p>
              </div>
              <button
                onClick={() => setWizardOpen(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {/* Step Indicators */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
              {[
                { step: 1, label: "Identity & Name" },
                { step: 2, label: "Personality & Voice" },
                { step: 3, label: "Knowledge Base" },
                { step: 4, label: "Channels & Tools" },
              ].map((s) => (
                <button
                  key={s.step}
                  type="button"
                  onClick={() => setWizardStep(s.step)}
                  className={`flex-1 py-1.5 text-center text-xs font-bold rounded-lg transition ${
                    wizardStep === s.step
                      ? "bg-indigo-50 text-indigo-700"
                      : wizardStep > s.step
                      ? "text-emerald-600"
                      : "text-slate-400"
                  }`}
                >
                  {s.step}. {s.label}
                </button>
              ))}
            </div>

            {/* Step 1: Identity & Greeting */}
            {wizardStep === 1 && (
              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Receptionist Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Maya — Head Receptionist"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white placeholder-slate-400 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Public URL Slug</label>
                    <input
                      type="text"
                      value={formData.public_slug}
                      onChange={(e) => setFormData({ ...formData, public_slug: e.target.value })}
                      placeholder="e.g. apex-maya"
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white placeholder-slate-400 focus:border-indigo-500 focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Avatar Image URL</label>
                    <input
                      type="text"
                      value={formData.avatar}
                      onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
                      placeholder="https://..."
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white placeholder-slate-400 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Opening Greeting Message</label>
                  <textarea
                    rows={2}
                    value={formData.welcome_message}
                    onChange={(e) => setFormData({ ...formData, welcome_message: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">System Instructions & Mission</label>
                  <textarea
                    rows={3}
                    value={formData.system_instructions || ""}
                    onChange={(e) => setFormData({ ...formData, system_instructions: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Personality & Voice */}
            {wizardStep === 2 && (
              <div className="space-y-5 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-2">Personality Tone</label>
                  <div className="grid grid-cols-2 gap-3">
                    {PERSONALITIES.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, personality: p.id })}
                        className={`rounded-2xl border p-3.5 text-left transition ${
                          formData.personality === p.id
                            ? "border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <p className="font-bold text-slate-900 text-xs">{p.label}</p>
                        <p className="text-[11px] text-slate-500 mt-1">{p.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-2">Voice Model (Telephony & Speech)</label>
                  <div className="grid grid-cols-2 gap-3">
                    {VOICES.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, voice_id: v.id })}
                        className={`flex items-center justify-between rounded-xl border p-3 text-left transition ${
                          formData.voice_id === v.id
                            ? "border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600 text-indigo-900"
                            : "border-slate-200 hover:border-slate-300 text-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Volume2 className="h-4 w-4 text-indigo-600" />
                          <span className="font-bold text-xs">{v.label}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-semibold uppercase">{v.gender}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Knowledge Base Binding & Strict Grounding */}
            {wizardStep === 3 && (
              <div className="space-y-4 text-xs">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-bold text-slate-800 text-sm">Select Knowledge Documents to Bind</p>
                    <p className="text-slate-500 mt-0.5">
                      The AI receptionist will strictly extract data and answer only from the selected documents below.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, knowledge_item_ids: knowledge.map((k) => k.id) }))}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, knowledge_item_ids: [] }))}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                {/* Strict Grounding Assurance Banner */}
                <div className="flex items-start gap-2.5 rounded-2xl border border-indigo-200/80 bg-indigo-50/70 p-3 text-indigo-950">
                  <ShieldCheck className="h-5 w-5 shrink-0 text-indigo-600 mt-0.5" />
                  <div>
                    <p className="font-bold text-xs">Strict Factual RAG Grounding Active</p>
                    <p className="text-[11px] leading-relaxed text-indigo-800/90 mt-0.5">
                      This receptionist is restricted to the documents selected below. If a visitor asks questions not found in these files, the receptionist will politely decline rather than inventing false facts or courses.
                    </p>
                  </div>
                </div>

                {/* Direct Document Attachment Box */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <UploadCloud className="h-4 w-4 text-indigo-600" />
                      Attach New Document Directly
                    </span>
                    <span className="text-[11px] text-slate-500">PDF, TXT, DOCX, CSV</span>
                  </div>
                  <div className="mt-2.5 flex items-center gap-2">
                    <input
                      ref={wizardDocInputRef}
                      type="file"
                      accept=".pdf,.docx,.txt,.csv"
                      disabled={uploadingDoc}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleWizardFileUpload(file);
                      }}
                      className="text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"
                    />
                    {uploadingDoc && (
                      <span className="text-xs font-semibold text-indigo-600 animate-pulse">
                        Uploading & indexing…
                      </span>
                    )}
                  </div>
                  {docUploadSuccess && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-xl px-2.5 py-1.5 border border-emerald-200">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      <span>{docUploadSuccess}</span>
                    </div>
                  )}
                  {docUploadError && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-xl px-2.5 py-1.5 border border-red-200">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>{docUploadError}</span>
                    </div>
                  )}
                </div>

                {/* Available Documents List */}
                <div className="max-h-56 overflow-y-auto space-y-2 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  {knowledge.length === 0 ? (
                    <div className="text-center py-6 text-slate-400">
                      <FileText className="h-6 w-6 mx-auto mb-1 opacity-50" />
                      No documents available yet. Attach one above!
                    </div>
                  ) : (
                    knowledge.map((item) => {
                      const isChecked = formData.knowledge_item_ids.includes(item.id);
                      return (
                        <label
                          key={item.id}
                          className={`flex items-start gap-3 rounded-xl p-2.5 border transition cursor-pointer ${
                            isChecked ? "border-indigo-400 bg-white shadow-xs" : "border-slate-200 bg-white/60 hover:bg-slate-100"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setFormData((prev) => ({
                                ...prev,
                                knowledge_item_ids: isChecked
                                  ? prev.knowledge_item_ids.filter((id) => id !== item.id)
                                  : [...prev.knowledge_item_ids, item.id],
                              }));
                            }}
                            className="mt-0.5 h-4 w-4 rounded text-indigo-600"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-bold text-slate-900 text-xs truncate">{item.title}</p>
                              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                                {item.category || "General"}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{item.content}</p>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                  <span>{formData.knowledge_item_ids.length} of {knowledge.length} document(s) bound</span>
                  <span>{formData.knowledge_item_ids.length === 0 ? "No documents bound (receptionist will not cite documents)" : "Strict document grounding active"}</span>
                </div>
              </div>
            )}

            {/* Step 4: Channels & Tools */}
            {wizardStep === 4 && (
              <div className="space-y-5 text-xs">
                <div>
                  <label className="block font-bold text-slate-800 mb-2">Enabled Channels</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: "web", name: "Website Chat Widget", icon: Globe },
                      { id: "voice", name: "Voice Phone Call", icon: Phone },
                      { id: "whatsapp", name: "WhatsApp Business", icon: MessageSquare },
                    ].map((ch) => {
                      const enabled = formData.channels.includes(ch.id);
                      return (
                        <button
                          key={ch.id}
                          type="button"
                          onClick={() => {
                            setFormData((prev) => ({
                              ...prev,
                              channels: enabled
                                ? prev.channels.filter((c) => c !== ch.id)
                                : [...prev.channels, ch.id],
                            }));
                          }}
                          className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition ${
                            enabled
                              ? "border-indigo-600 bg-indigo-50/50 text-indigo-900"
                              : "border-slate-200 text-slate-500 hover:border-slate-300"
                          }`}
                        >
                          <ch.icon className="h-5 w-5 mb-1" />
                          <span className="font-bold text-xs">{ch.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-2">Enabled Agent Tools</label>
                  <div className="space-y-2">
                    {AVAILABLE_TOOLS.map((tool) => {
                      const isChecked = formData.allowed_tools.includes(tool.id);
                      return (
                        <label
                          key={tool.id}
                          className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3 cursor-pointer"
                        >
                          <div>
                            <p className="font-bold text-slate-900 text-xs">{tool.name}</p>
                            <p className="text-[11px] text-slate-500">{tool.desc}</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setFormData((prev) => ({
                                ...prev,
                                allowed_tools: isChecked
                                  ? prev.allowed_tools.filter((t) => t !== tool.id)
                                  : [...prev.allowed_tools, tool.id],
                              }));
                            }}
                            className="h-4 w-4 rounded text-indigo-600"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              {wizardStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setWizardStep((s) => s - 1)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:bg-slate-50"
                >
                  Back
                </button>
              ) : (
                <div />
              )}

              {wizardStep < 4 ? (
                <button
                  type="button"
                  onClick={() => setWizardStep((s) => s + 1)}
                  className="rounded-xl bg-indigo-600 px-5 py-2 font-bold text-white hover:bg-indigo-500"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleWizardSubmit()}
                  className="rounded-xl bg-indigo-600 px-6 py-2 font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {saving ? "Deploying..." : "Deploy AI Receptionist"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Embed Code Modal */}
      {embedAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <Code2 className="h-5 w-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Embed Receptionist on Any Website</h3>
              </div>
              <button
                onClick={() => setEmbedAgent(null)}
                className="rounded-xl p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Paste this snippet right before the closing <code className="bg-slate-100 px-1 py-0.5 rounded">&lt;/body&gt;</code> tag on your WordPress, Webflow, Shopify, or custom HTML site.
            </p>

            <div className="relative rounded-2xl bg-slate-950 p-4 font-mono text-xs text-slate-200">
              <pre className="overflow-x-auto whitespace-pre-wrap">{getEmbedSnippet(embedAgent.public_slug)}</pre>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Link
                to={`/chat/${embedAgent.public_slug}`}
                target="_blank"
                className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"
              >
                Open live test window <ExternalLink className="h-3 w-3" />
              </Link>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(getEmbedSnippet(embedAgent.public_slug));
                  setCopiedSnippet(true);
                  setTimeout(() => setCopiedSnippet(false), 2500);
                }}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500"
              >
                {copiedSnippet ? "Copied Snippet!" : "Copy Embed Code"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
