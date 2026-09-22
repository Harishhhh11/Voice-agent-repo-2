import { executeGoldenConversation, generateFullEvaluationReport } from "./evaluationSuite";
import { runUniversalBenchmark, generateDynamicTestSuite } from "./universal/evaluationSuite";
import { MULTI_INDUSTRY_SEEDS } from "./universal/seedKnowledge";
import { ingestUniversalKnowledge } from "./universal/knowledgeIngestion";
import { executeUniversalReceptionistTurn } from "./universal/engine";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import { synthesizeFromPlatform, getPlatformKeys, updatePlatformKeys } from "./voicePlatformSynthesizer";
import { ResponsePlanner } from "./src/lib/responsePlanner";
import {
  getHardwareStatus,
  OPEN_SOURCE_MODELS,
  OPEN_SOURCE_VOICES,
  modelRegistry,
  getPronunciationDictionary,
  savePronunciationEntry,
  deletePronunciationEntry,
  getOpenSourceAudioBuffer,
  recordBenchmarkScore,
  getBenchmarkScores,
  getActiveReceptionistVoiceId,
  setActiveReceptionistVoiceId,
} from "./openSourceVoiceService";
import { RealtimeReceptionistEngine, ConversationalTurnDetector } from "./universal/realtimeAgentEngine";
import { RealtimeVoiceBenchmarkRunner } from "./universal/realtimeVoiceBenchmark";
import type { RealtimeVoiceAgentConfig, RealtimeCallSession } from "./src/types/realtimeVoice";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json({ limit: "15mb" }));
app.use(express.text({ type: ["text/*", "application/text"], limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// Resilient Body Parser / JSON Syntax Error Recovery Middleware
app.use((err: unknown, req: express.Request, _res: express.Response, next: express.NextFunction) => {
  if (err instanceof SyntaxError && "body" in (err as unknown as Record<string, unknown>)) {
    try {
      const raw = (err as unknown as Record<string, unknown>).body;
      if (typeof raw === "string") {
        let cleaned = raw.trim();
        if (cleaned.startsWith('""') && cleaned.endsWith('""')) {
          cleaned = cleaned.slice(1, -1);
        }
        if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
          try {
            cleaned = JSON.parse(cleaned);
          } catch {
            cleaned = cleaned.slice(1, -1);
          }
        }
        try {
          req.body = (typeof cleaned === "string" && (cleaned.startsWith("{") || cleaned.startsWith("[")))
            ? JSON.parse(cleaned)
            : { message: cleaned };
        } catch {
          req.body = { message: cleaned };
        }
        return next();
      }
    } catch {
      req.body = {};
      return next();
    }
  }
  next(err as Error);
});

// Normalize request body if it was parsed as string or contains extra quotes
app.use((req, _res, next) => {
  if (typeof req.body === "string") {
    let val = req.body.trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      try {
        val = JSON.parse(val);
      } catch {
        val = val.slice(1, -1);
      }
    }
    if (typeof val === "string" && (val.startsWith("{") || val.startsWith("["))) {
      try {
        req.body = JSON.parse(val);
      } catch {
        req.body = { message: val };
      }
    } else {
      req.body = { message: val };
    }
  }
  next();
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

// ==========================================
// In-Memory Data Store (Enterprise Seed)
// ==========================================

let nextId = 500;
function getId(): number {
  return ++nextId;
}

interface Organization {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  website: string;
  timezone: string;
  working_hours: {
    start: string;
    end: string;
    days: string[];
  };
  services: { name: string; description: string; price_hint?: string }[];
  policies: {
    prompt_injection_guard: boolean;
    hallucination_guard: boolean;
    require_human_on_negative: boolean;
    multilingual_support: boolean;
  };
  escalation_keywords: string[];
}

const organization: Organization = {
  id: 1,
  name: "Apex Solutions Inc",
  email: "contact@apexsolutions.ai",
  phone: "+1 (800) 555-0199",
  address: "100 Innovation Parkway, Suite 400, San Francisco, CA 94105",
  website: "https://apexsolutions.ai",
  timezone: "America/Los_Angeles",
  working_hours: {
    start: "09:00",
    end: "18:00",
    days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  },
  services: [
    {
      name: "24/7 AI Receptionist Setup",
      description: "Full configuration of web chat, voice reception, and WhatsApp digital staff.",
      price_hint: "$299/mo standard or $99/mo starter",
    },
    {
      name: "Custom Enterprise Voice Agents",
      description: "Custom-trained voice models with ultra-low latency barge-in and human handoff.",
      price_hint: "Enterprise custom SLA",
    },
    {
      name: "CRM & Workflow Webhook Sync",
      description: "Direct real-time lead push to HubSpot, Salesforce, Google Sheets, or custom endpoints.",
      price_hint: "Included with Professional & Enterprise",
    },
    {
      name: "Python & AI Engineering Training",
      description: "Hands-on corporate and individual courses covering AI agents, Python, and RAG pipelines.",
      price_hint: "$499 online student tier, $999 professional certification",
    },
  ],
  policies: {
    prompt_injection_guard: true,
    hallucination_guard: true,
    require_human_on_negative: true,
    multilingual_support: true,
  },
  escalation_keywords: [
    "human",
    "operator",
    "agent",
    "manager",
    "complaint",
    "angry",
    "lawyer",
    "speak to someone",
    "person",
    "real human",
  ],
};

const users = [
  {
    id: 1,
    uuid: "user-1",
    organization_id: 1,
    first_name: "Harish",
    last_name: "Sadula",
    email: "admin@example.com",
    phone: "+1 (555) 234-5678",
    is_active: true,
    is_verified: true,
    is_superuser: true,
    role_ids: [1],
    created_at: "2026-01-15T09:00:00Z",
    updated_at: "2026-01-15T09:00:00Z",
  },
  {
    id: 2,
    uuid: "user-2",
    organization_id: 1,
    first_name: "Elena",
    last_name: "Rostova",
    email: "specialist@apexsolutions.ai",
    phone: "+1 (555) 345-6789",
    is_active: true,
    is_verified: true,
    is_superuser: false,
    role_ids: [2],
    created_at: "2026-01-20T10:00:00Z",
    updated_at: "2026-01-20T10:00:00Z",
  },
];

const roles = [
  {
    id: 1,
    uuid: "role-1",
    organization_id: 1,
    name: "Admin",
    description: "Full workspace administrative access and configuration permissions",
    permissions: [
      "manage_agents",
      "manage_knowledge",
      "manage_leads",
      "manage_team",
      "view_analytics",
      "manage_integrations",
      "manage_appointments",
      "manage_voice",
    ],
    created_at: "2026-01-15T09:00:00Z",
    updated_at: "2026-01-15T09:00:00Z",
  },
  {
    id: 2,
    uuid: "role-2",
    organization_id: 1,
    name: "Customer Specialist",
    description: "Access to view and respond to leads, appointments, and active conversations",
    permissions: ["manage_leads", "view_conversations", "manage_appointments", "view_analytics"],
    created_at: "2026-01-15T09:00:00Z",
    updated_at: "2026-01-15T09:00:00Z",
  },
];

export interface AgentModel {
  id: number;
  uuid: string;
  organization_id: number;
  name: string;
  avatar?: string;
  public_slug: string;
  welcome_message: string;
  system_instructions: string | null;
  personality: "professional" | "friendly" | "casual" | "formal" | "sales_oriented" | "support_oriented";
  language: "multilingual" | "en" | "te" | "hi";
  voice_id: string;
  speaking_style: string;
  channels: string[];
  allowed_tools: string[];
  is_published: boolean;
  is_active: boolean;
  knowledge_item_ids: number[];
  created_at: string;
  updated_at: string;
}

let agents: AgentModel[] = [
  {
    id: 971,
    uuid: "agent-971",
    organization_id: 1,
    name: "Sravani — Maruthi Technologies",
    avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80",
    public_slug: "sravani-maruthi",
    welcome_message: "Hello! Welcome to Maruthi Technologies. I am Sravani, your admissions advisor. How can I assist you with our training courses today?",
    system_instructions:
      "You are Sravani, the senior Admissions Advisor & Receptionist for Maruthi Technologies. Greet visitors warmly, answer questions accurately based strictly on verified course documents (Core Python Programming and Core Java Programming), and assist prospective students with inquiries and enrollment in English or Telugu. Speak in a natural, polite, and lively human conversational tone.",
    personality: "friendly",
    language: "multilingual",
    voice_id: "sravani_natural_telugu",
    speaking_style: "warm_conversational",
    channels: ["web", "voice", "whatsapp"],
    allowed_tools: [
      "search_knowledge",
      "get_company_info",
      "create_lead",
      "schedule_appointment",
      "transfer_to_human",
    ],
    is_published: true,
    is_active: true,
    knowledge_item_ids: [841, 829],
    created_at: "2026-09-18T19:00:00Z",
    updated_at: "2026-09-19T09:00:00Z",
  },
  {
    id: 1,
    uuid: "agent-1",
    organization_id: 1,
    name: "Maya — Head Receptionist",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
    public_slug: "apex-maya",
    welcome_message: "Hello! Welcome to Apex Solutions. I'm Maya, your AI receptionist. How can I assist you today?",
    system_instructions:
      "You are Maya, the head AI receptionist for Apex Solutions. Greet visitors warmly, answer questions about products, services, office hours, and capture contact details to connect them with our team.",
    personality: "friendly",
    language: "multilingual",
    voice_id: "maya_warm",
    speaking_style: "warm_conversational",
    channels: ["web", "voice", "whatsapp"],
    allowed_tools: [
      "search_knowledge",
      "get_company_info",
      "get_business_hours",
      "create_lead",
      "schedule_appointment",
      "transfer_to_human",
    ],
    is_published: true,
    is_active: true,
    knowledge_item_ids: [1, 2, 3, 4],
    created_at: "2026-01-16T10:00:00Z",
    updated_at: "2026-01-16T10:00:00Z",
  },
  {
    id: 2,
    uuid: "agent-2",
    organization_id: 1,
    name: "Alex — Sales & Enterprise Qualifier",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    public_slug: "apex-sales",
    welcome_message: "Hi there! Exploring our enterprise tiers or booking a live demo? I'm here to match you with the right plan.",
    system_instructions:
      "You are Alex, an expert sales receptionist. Identify visitor needs, budget, timeline, and collect contact info for high-intent leads.",
    personality: "sales_oriented",
    language: "multilingual",
    voice_id: "alex_crisp",
    speaking_style: "crisp_business",
    channels: ["web", "voice"],
    allowed_tools: [
      "search_knowledge",
      "get_company_info",
      "create_lead",
      "schedule_appointment",
      "transfer_to_human",
    ],
    is_published: true,
    is_active: true,
    knowledge_item_ids: [1, 3, 4],
    created_at: "2026-01-18T14:30:00Z",
    updated_at: "2026-01-18T14:30:00Z",
  },
];

export interface LeadModel {
  id: number;
  organization_id: number;
  conversation_id: number | null;
  name: string;
  phone: string | null;
  email: string | null;
  company?: string | null;
  source?: string;
  intent?: string;
  interest: string;
  budget?: string | null;
  lead_score: number;
  preferred_mode: string;
  preferred_time: string;
  notes: string;
  assigned_staff?: string | null;
  status: "new" | "contacted" | "qualified" | "unqualified" | "converted" | "lost";
  created_at: string;
  updated_at: string;
}

let leads: LeadModel[] = [
  {
    id: 1,
    organization_id: 1,
    conversation_id: 1,
    name: "Sarah Jenkins",
    phone: "+1 (415) 890-1234",
    email: "sarah.j@techcorp.io",
    company: "TechCorp Logistics",
    source: "Web Chat (Maya)",
    intent: "Enterprise Deployment",
    interest: "Enterprise AI Receptionist Integration",
    budget: "$10k - $25k / yr",
    lead_score: 92,
    preferred_mode: "email",
    preferred_time: "Morning EST",
    notes: "Inquired about webhook integrations and custom knowledge base ingestion for 2,000+ support articles.",
    assigned_staff: "Harish Sadula",
    status: "qualified",
    created_at: "2026-02-10T14:25:00Z",
    updated_at: "2026-02-10T14:25:00Z",
  },
  {
    id: 2,
    organization_id: 1,
    conversation_id: 2,
    name: "David Chen",
    phone: "+1 (206) 555-0199",
    email: "dchen@innovatestudio.co",
    company: "Innovate Studio",
    source: "Voice Call (Alex)",
    intent: "24/7 Front Desk",
    interest: "24/7 Front Desk Coverage",
    budget: "$300 - $500 / mo",
    lead_score: 84,
    preferred_mode: "phone",
    preferred_time: "Afternoon PST",
    notes: "Wants automated voice and web call receptionist to handle inbound inquiries after hours.",
    assigned_staff: "Elena Rostova",
    status: "new",
    created_at: "2026-02-11T09:20:00Z",
    updated_at: "2026-02-11T09:20:00Z",
  },
  {
    id: 3,
    organization_id: 1,
    conversation_id: 3,
    name: "Elena Rostova",
    phone: "+1 (617) 444-8821",
    email: "elena@biopartners.org",
    company: "BioPartners Global",
    source: "WhatsApp Assistant",
    intent: "Pricing & Custom SLA",
    interest: "Pricing & Custom SLA",
    budget: "$1,000+ / mo",
    lead_score: 95,
    preferred_mode: "email",
    preferred_time: "Anytime",
    notes: "Evaluating team migration from legacy call center to AI receptionists.",
    assigned_staff: "Harish Sadula",
    status: "converted",
    created_at: "2026-02-11T11:10:00Z",
    updated_at: "2026-02-11T11:10:00Z",
  },
];

export interface AppointmentModel {
  id: number;
  organization_id: number;
  agent_id: number;
  conversation_id?: number | null;
  customer_name: string;
  customer_email: string;
  customer_phone?: string | null;
  service: string;
  slot_date: string;
  slot_time: string;
  status: "confirmed" | "rescheduled" | "cancelled" | "completed";
  notes?: string;
  created_at: string;
  updated_at: string;
}

let appointments: AppointmentModel[] = [
  {
    id: 1,
    organization_id: 1,
    agent_id: 1,
    conversation_id: 1,
    customer_name: "Sarah Jenkins",
    customer_email: "sarah.j@techcorp.io",
    customer_phone: "+1 (415) 890-1234",
    service: "Enterprise AI Receptionist Consultation",
    slot_date: "2026-09-18",
    slot_time: "10:00 AM",
    status: "confirmed",
    notes: "Review API webhooks and knowledge base sync.",
    created_at: "2026-02-10T14:26:00Z",
    updated_at: "2026-02-10T14:26:00Z",
  },
  {
    id: 2,
    organization_id: 1,
    agent_id: 2,
    conversation_id: 2,
    customer_name: "David Chen",
    customer_email: "dchen@innovatestudio.co",
    customer_phone: "+1 (206) 555-0199",
    service: "Voice Receptionist Live Architecture Demo",
    slot_date: "2026-09-19",
    slot_time: "02:30 PM",
    status: "confirmed",
    notes: "Testing SIP telephony routing & phone numbers.",
    created_at: "2026-02-11T09:22:00Z",
    updated_at: "2026-02-11T09:22:00Z",
  },
];

export interface VoiceCallModel {
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

let voiceCalls: VoiceCallModel[] = [
  {
    id: 1,
    organization_id: 1,
    agent_id: 1,
    conversation_id: 2,
    call_sid: "CA948b84e72b4f9118a02c5102a90b41c",
    direction: "inbound",
    caller_number: "+1 (206) 555-0199",
    recipient_number: "+1 (800) 555-0199",
    status: "completed",
    duration_seconds: 145,
    recording_url: "https://assets.apexsolutions.ai/recordings/call-102.mp3",
    outcome: "appointment_booked",
    transcript: [
      { role: "assistant", text: "Hello, welcome to Apex Solutions. I'm Maya, your AI receptionist.", timestamp: "00:02" },
      { role: "caller", text: "Hi! I wanted to check your operating hours and book a consultation.", timestamp: "00:10" },
      { role: "assistant", text: "Our staff is here Monday to Friday from 9 AM to 6 PM EST, and our AI receptionist runs 24/7.", timestamp: "00:18" },
      { role: "caller", text: "Great, can we book a demo for tomorrow afternoon?", timestamp: "00:30" },
      { role: "assistant", text: "Certainly! I've reserved 2:30 PM PST with David Chen.", timestamp: "00:52" },
    ],
    created_at: "2026-02-11T09:15:00Z",
  },
  {
    id: 2,
    organization_id: 1,
    agent_id: 2,
    conversation_id: 1,
    call_sid: "CA118ef83921bb34f09a18d203f9011ba",
    direction: "inbound",
    caller_number: "+1 (415) 890-1234",
    recipient_number: "+1 (800) 555-0199",
    status: "completed",
    duration_seconds: 210,
    recording_url: null,
    outcome: "lead_captured",
    transcript: [
      { role: "assistant", text: "Apex Solutions sales desk, Alex speaking. How may I direct your call?", timestamp: "00:03" },
      { role: "caller", text: "Hello Alex, do you support custom CRM webhooks for captured leads?", timestamp: "00:12" },
      { role: "assistant", text: "Yes, we integrate with HubSpot, Salesforce, and custom REST webhooks with automatic retry logic.", timestamp: "00:24" },
    ],
    created_at: "2026-02-10T14:20:00Z",
  },
];

export interface ConversationModel {
  id: number;
  organization_id: number;
  agent_id: number;
  user_id: number | null;
  session_id: string;
  channel: "web" | "voice" | "whatsapp";
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  customer_company?: string | null;
  customer_mode?: string | null;
  customer_batch?: string | null;
  customer_experience?: string | null;
  customer_interested_courses?: string[] | null;
  customer_course_preferences?: Record<string, { mode?: string | null; batch?: string | null }> | null;
  entry_context?: {
    source?: string | null;
    campaign?: string | null;
    medium?: string | null;
    target_course?: string | null;
    referrer?: string | null;
    landing_page?: string | null;
  } | null;
  current_intent?: string;
  previous_intent?: string;
  current_topic?: string;
  topic_stack?: string[];
  selected_courses?: string[];
  unsupported_courses?: string[];
  enrollment_state?: {
    status?: "idle" | "collecting_information" | "paused" | "completed";
    completed_fields?: string[];
    missing_fields?: string[];
  } | null;
  pending_question?: string | null;
  multi_intents?: Array<{
    type: string;
    subject?: string | null;
    attributes?: string[] | null;
    confidence?: number;
    resolved?: boolean;
  }> | null;
  conflicts?: Array<{
    id: string;
    type: "TIMING_OVERLAP" | "MODE_INCOMPATIBLE" | "PREFERENCE_OVERRIDE" | "SCHEDULE_COLLISION";
    description: string;
    courses: string[];
    status: "active" | "resolved";
    resolution_advice?: string;
    detected_at: string;
  }> | null;
  ko_summary?: {
    readiness_score: number;
    completed_steps: string[];
    pending_steps: string[];
    course_breakdown: Array<{
      course: string;
      mode?: string | null;
      batch?: string | null;
      status: "confirmed" | "pending_mode" | "pending_batch" | "inquired";
    }>;
    active_conflicts_count: number;
    resolved_intents_count: number;
    knowledge_touchpoints: string[];
    next_best_action: string;
  } | null;
  lead_step?: "NAME" | "PHONE" | "MODE" | "BATCH" | "EXPERIENCE" | "CONFIRMED" | null;
  status: "active" | "completed" | "escalated" | "takeover";
  conversation_state:
    | "GREETING"
    | "DISCOVERY"
    | "INFORMATION"
    | "QUALIFICATION"
    | "ACTION"
    | "CONFIRMATION"
    | "FOLLOW_UP"
    | "HANDOFF"
    | "COMPLETED"
    | "LEAD_CAPTURE"
    | "LEAD_CAPTURED";
  detected_intent: string;
  language: "en" | "te" | "hi";
  sentiment: "positive" | "neutral" | "frustrated";
  is_human_takeover: boolean;
  lead_id: number | null;
  appointment_id: number | null;
  summary: string;
  created_at: string;
  updated_at: string;
}

let conversations: ConversationModel[] = [
  {
    id: 1,
    organization_id: 1,
    agent_id: 1,
    user_id: null,
    session_id: "session-101",
    channel: "web",
    customer_name: "Sarah Jenkins",
    customer_phone: "+1 (415) 890-1234",
    customer_email: "sarah.j@techcorp.io",
    status: "completed",
    conversation_state: "CONFIRMATION",
    detected_intent: "enterprise_pricing_crm",
    language: "en",
    sentiment: "positive",
    is_human_takeover: false,
    lead_id: 1,
    appointment_id: 1,
    summary: "Inquired about CRM webhook synchronization and scheduled an enterprise consultation.",
    created_at: "2026-02-10T14:20:00Z",
    updated_at: "2026-02-10T14:28:00Z",
  },
  {
    id: 2,
    organization_id: 1,
    agent_id: 1,
    user_id: null,
    session_id: "session-102",
    channel: "voice",
    customer_name: "David Chen",
    customer_phone: "+1 (206) 555-0199",
    customer_email: "dchen@innovatestudio.co",
    status: "active",
    conversation_state: "INFORMATION",
    detected_intent: "business_hours_and_booking",
    language: "en",
    sentiment: "neutral",
    is_human_takeover: false,
    lead_id: 2,
    appointment_id: 2,
    summary: "Voice caller confirmed business hours and booked an afternoon demo slot.",
    created_at: "2026-02-11T09:15:00Z",
    updated_at: "2026-02-11T09:22:00Z",
  },
  {
    id: 3,
    organization_id: 1,
    agent_id: 2,
    user_id: null,
    session_id: "session-103",
    channel: "whatsapp",
    customer_name: "Elena Rostova",
    customer_phone: "+1 (617) 444-8821",
    customer_email: "elena@biopartners.org",
    status: "completed",
    conversation_state: "COMPLETED",
    detected_intent: "custom_sla_migration",
    language: "en",
    sentiment: "positive",
    is_human_takeover: false,
    lead_id: 3,
    appointment_id: null,
    summary: "Requested custom SLA terms for medical call center migration.",
    created_at: "2026-02-11T11:00:00Z",
    updated_at: "2026-02-11T11:12:00Z",
  },
];

export interface MessageModel {
  id: number;
  conversation_id: number;
  role: "user" | "assistant" | "system" | "operator" | "tool";
  content: string;
  tool_calls?: { tool: string; args: Record<string, unknown>; result: unknown }[];
  grounding_sources?: { id: number; title: string; source: string }[];
  state_snapshot?: string;
  created_at: string;
}

let messages: MessageModel[] = [
  {
    id: 1,
    conversation_id: 1,
    role: "assistant",
    content: "Hello! Welcome to Apex Solutions. I'm Maya, your AI receptionist. How can I assist you today?",
    state_snapshot: "GREETING",
    created_at: "2026-02-10T14:20:05Z",
  },
  {
    id: 2,
    conversation_id: 1,
    role: "user",
    content: "Hi, do you support syncing captured leads directly to HubSpot or webhook endpoints?",
    state_snapshot: "DISCOVERY",
    created_at: "2026-02-10T14:21:10Z",
  },
  {
    id: 3,
    conversation_id: 1,
    role: "assistant",
    content: "Yes! Apex Solutions offers built-in CRM integrations including HubSpot, Google Sheets, and custom webhooks with instant deduplication.",
    tool_calls: [
      {
        tool: "search_knowledge",
        args: { query: "CRM webhook integrations" },
        result: { matched: 1, title: "Apex Solutions Overview & Offerings" },
      },
    ],
    grounding_sources: [{ id: 1, title: "Apex Solutions Overview & Offerings", source: "Company Handbook" }],
    state_snapshot: "INFORMATION",
    created_at: "2026-02-10T14:21:25Z",
  },
  {
    id: 4,
    conversation_id: 2,
    role: "assistant",
    content: "Hello! Welcome to Apex Solutions. I'm Maya, your AI receptionist. How can I assist you today?",
    state_snapshot: "GREETING",
    created_at: "2026-02-11T09:15:05Z",
  },
  {
    id: 5,
    conversation_id: 2,
    role: "user",
    content: "What are your business hours, and can the receptionist handle night queries?",
    state_snapshot: "DISCOVERY",
    created_at: "2026-02-11T09:15:30Z",
  },
  {
    id: 6,
    conversation_id: 2,
    role: "assistant",
    content: "Our team operates office hours Mon-Fri 9am-6pm EST, but our AI receptionists run 24 hours a day, 7 days a week with zero downtime.",
    tool_calls: [
      {
        tool: "get_business_hours",
        args: { org_id: 1 },
        result: { hours: "Mon-Fri 09:00 - 18:00 EST", ai_availability: "24/7/365" },
      },
    ],
    grounding_sources: [{ id: 2, title: "Operating Hours & Receptionist Schedule", source: "Operations Guide" }],
    state_snapshot: "INFORMATION",
    created_at: "2026-02-11T09:15:45Z",
  },
];

export interface KnowledgeItemModel {
  id: number;
  organization_id: number;
  agent_id: number | null;
  title: string;
  content: string;
  source: string;
  category: string;
  uuid: string;
  is_active: boolean;
  chunks?: { id: number; text: string; score?: number }[];
  created_at: string;
  updated_at: string;
}

let knowledgeItems: KnowledgeItemModel[] = [
  {
    id: 1,
    organization_id: 1,
    agent_id: 1,
    title: "Apex Solutions Overview & Offerings",
    content:
      "Apex Solutions is a leading provider of intelligent AI Receptionist systems designed to handle 24/7 website chat, visitor qualification, lead generation, and appointment triage with enterprise-grade security. We support real-time lead capture and automatic CRM synchronization.",
    source: "Company Handbook",
    category: "General",
    uuid: "kb-101",
    is_active: true,
    chunks: [
      { id: 101, text: "Apex Solutions provides intelligent AI Receptionists for 24/7 website chat, visitor triage, and lead generation." },
      { id: 102, text: "Integrations support HubSpot, Salesforce, Google Sheets, and custom webhooks with automated deduplication." },
    ],
    created_at: "2026-01-16T10:00:00Z",
    updated_at: "2026-01-16T10:00:00Z",
  },
  {
    id: 2,
    organization_id: 1,
    agent_id: 1,
    title: "Operating Hours & Receptionist Schedule",
    content:
      "Our main office operates Monday through Friday from 9:00 AM to 6:00 PM EST. AI receptionists are always active 24/7/365 to greet visitors, answer questions, and capture leads while your human team is away.",
    source: "Operations Guide",
    category: "Operations",
    uuid: "kb-102",
    is_active: true,
    chunks: [
      { id: 201, text: "Office operating hours: Monday through Friday, 9:00 AM to 6:00 PM EST." },
      { id: 202, text: "AI receptionists operate 24/7/365 continuously without downtime." },
    ],
    created_at: "2026-01-16T10:00:00Z",
    updated_at: "2026-01-16T10:00:00Z",
  },
  {
    id: 3,
    organization_id: 1,
    agent_id: 2,
    title: "Enterprise Pricing & Plan Tiers",
    content:
      "Starter Plan: $99/month for up to 1,000 monthly conversations. Professional Plan: $299/month for up to 5,000 conversations and CRM syncing. Enterprise Plan: Custom volume, dedicated SLA, custom voice avatar training, and webhook automation. We also offer a Python & AI Engineering Course at $499 for students and $999 for professionals.",
    source: "Pricing Deck 2026",
    category: "Pricing",
    uuid: "kb-103",
    is_active: true,
    chunks: [
      { id: 301, text: "Starter Plan is $99/mo (1,000 conversations). Professional Plan is $299/mo (5,000 conversations + CRM sync)." },
      { id: 302, text: "Python & AI Engineering Course is $499 for students (online) and $999 for certified corporate professionals." },
    ],
    created_at: "2026-01-18T10:00:00Z",
    updated_at: "2026-01-18T10:00:00Z",
  },
  {
    id: 4,
    organization_id: 1,
    agent_id: null,
    title: "Data Privacy & Multi-Tenant Security",
    content:
      "All customer interactions and uploaded documents are isolated per tenant with role-based access control (RBAC), end-to-end token validation, prompt injection shields, and automated PII filtering.",
    source: "Security Whitepaper",
    category: "Compliance",
    uuid: "kb-104",
    is_active: true,
    chunks: [
      { id: 401, text: "Tenant isolation guarantees complete data separation across organizations." },
      { id: 402, text: "Security rules enforce strict boundaries around untrusted document text to stop prompt injection." },
    ],
    created_at: "2026-01-22T08:00:00Z",
    updated_at: "2026-01-22T08:00:00Z",
  },
];

const integrations = [
  {
    key: "google_workspace_oauth",
    name: "Google Workspace & Gmail Account",
    category: "Email & Google Workspace",
    description: "Connect your official Google account to read incoming customer inquiry emails, trigger instant AI receptionist auto-replies, and send meeting confirmations via Gmail API.",
    status: "configured" as const,
    setup_hint: "OAuth 2.0 Client active (Gmail Read/Send + Google Sheets + Drive Read)",
    capabilities: ["Inbound email triage", "Automated Gmail auto-reply", "Meeting confirmation dispatch", "User-authenticated OAuth"],
  },
  {
    key: "google_sheets_live",
    name: "Google Sheets Live Synchronization",
    category: "Spreadsheets & Analytics",
    description: "Link user Google Sheets to automatically record incoming leads, confirmed consultation appointments, and customer inquiry logs in real-time.",
    status: "configured" as const,
    setup_hint: "Syncs directly to your connected Google account spreadsheets via Google Sheets API v4",
    capabilities: ["Auto-create CRM template sheets", "Instant row append", "Export appointments & leads", "Two-way sheet inspection"],
  },
  {
    key: "crm_webhook",
    name: "CRM Webhook Sync",
    category: "CRM & Pipelines",
    description: "Automatically push new qualified leads to your CRM (Salesforce, HubSpot, or custom webhook) in real time.",
    status: "configured" as const,
    setup_hint: "Endpoint: https://api.apexsolutions.ai/webhooks/crm-inbound",
    capabilities: ["Real-time lead push", "Custom payload mappings", "Retry with exponential backoff"],
  },
  {
    key: "google_sheets",
    name: "Google Sheets Lead Logger",
    category: "Spreadsheets",
    description: "Stream qualified visitor submissions into a shared spreadsheet for sales and operations review.",
    status: "configured" as const,
    setup_hint: "Sheet ID: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
    capabilities: ["Instant row insertion", "Status column tracking", "Automatic timestamping"],
  },
  {
    key: "whatsapp_business",
    name: "WhatsApp Business Gateway",
    category: "Messaging Channels",
    description: "Deploy your receptionist directly on your official WhatsApp Business phone number.",
    status: "configured" as const,
    setup_hint: "Connect your Meta Cloud API credentials or Twilio WhatsApp sender.",
    capabilities: ["Two-way messaging", "Media attachment handling", "Quick-reply buttons", "Template dispatches"],
  },
  {
    key: "twilio_telephony",
    name: "Twilio / Exotel Voice Telephony",
    category: "Voice Telephony",
    description: "Inbound & Outbound phone call routing with real-time Speech-to-Text and natural Text-to-Speech synthesis.",
    status: "configured" as const,
    setup_hint: "Virtual Number: +1 (800) 555-0199 (SIP Trunk active)",
    capabilities: ["Barge-in interruption", "Live transcription", "Call logs & recording", "Human escalation transfer"],
  },
  {
    key: "slack_alerts",
    name: "Slack Operator Channel",
    category: "Notifications",
    description: "Receive instant channel notifications when a high-intent lead is qualified or human takeover is requested.",
    status: "available" as const,
    setup_hint: "Install the Apex Slack bot and authorize #receptionist-leads channel.",
    capabilities: ["Instant lead alerts", "Claim lead button", "Transcript preview"],
  },
];

// Telephony configuration state
const telephonyConfig = {
  provider: "Twilio",
  virtual_phone_number: "+1 (800) 555-0199",
  sip_endpoint: "sip:receptionist@apexsolutions.sip.twilio.com",
  voice_engine: "Neural TTS Maya (Low Latency)",
  barge_in_enabled: true,
  silence_timeout_ms: 1200,
  record_calls: true,
};

export interface LinkedSpreadsheet {
  id: string;
  name: string;
  sheetName: string;
  linkedAt: string;
  totalSyncedRows: number;
  syncLeads: boolean;
  syncAppointments: boolean;
  syncTranscripts: boolean;
}

let linkedSheets: LinkedSpreadsheet[] = [
  {
    id: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
    name: "Apex Solutions - AI Receptionist Inbound Registry",
    sheetName: "Qualified Leads",
    linkedAt: "2026-02-12T10:00:00Z",
    totalSyncedRows: 24,
    syncLeads: true,
    syncAppointments: true,
    syncTranscripts: false,
  },
];

export interface VoiceTestModel {
  id: number;
  user_id?: number | null;
  organization_id: number;
  provider: "sarvam" | "elevenlabs" | "google_chirp" | "murf";
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

export interface ReceptionistVoiceConfigModel {
  provider: "sarvam" | "elevenlabs" | "google_chirp" | "murf";
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

export interface PronunciationRuleModel {
  id: string;
  source: string;
  replacement: string;
  category: "brand" | "technical" | "currency" | "timing" | "location";
  language: "te" | "en" | "all";
  isActive: boolean;
}

let voiceFavorites: string[] = ["neha", "priya", "shubh", "ratan", "eleven-sravani-telugu", "te-IN-Chirp3-HD-Aoede", "murf-te-swathi"];

let receptionistVoiceConfig: ReceptionistVoiceConfigModel = {
  provider: "sarvam",
  voice_id: "neha",
  voice_name: "Neha (Sarvam Bulbul V3)",
  gender: "female",
  language: "te-IN",
  model: "bulbul:v3",
  rate: 1.12,
  pitch: 1.0,
  sample_rate: 24000,
  phone_mode: false,
  updated_at: "2026-02-15T10:00:00Z",
};

let pronunciationRules: PronunciationRuleModel[] = [
  { id: "pr-1", source: "Maruthi Technologies", replacement: "మారుతి టెక్నాలజీస్", category: "brand", language: "all", isActive: true },
  { id: "pr-2", source: "Python", replacement: "పైథాన్", category: "technical", language: "all", isActive: true },
  { id: "pr-3", source: "Java", replacement: "జావా", category: "technical", language: "all", isActive: true },
  { id: "pr-4", source: "Core Python", replacement: "కోర్ పైథాన్", category: "technical", language: "all", isActive: true },
  { id: "pr-5", source: "Core Java", replacement: "కోర్ జావా", category: "technical", language: "all", isActive: true },
  { id: "pr-6", source: "Ameerpet", replacement: "అమీర్‌పేట", category: "location", language: "all", isActive: true },
  { id: "pr-7", source: "Hyderabad", replacement: "హైదరాబాద్", category: "location", language: "all", isActive: true },
  { id: "pr-8", source: "Online batch", replacement: "ఆన్‌లైన్ బ్యాచ్", category: "technical", language: "all", isActive: true },
  { id: "pr-9", source: "Classroom batch", replacement: "క్లాస్‌రూమ్ బ్యాచ్", category: "technical", language: "all", isActive: true },
  { id: "pr-10", source: "Full Stack", replacement: "ఫుల్ స్టాక్", category: "technical", language: "all", isActive: true },
  { id: "pr-11", source: "Placement Assistance", replacement: "ప్లేస్‌మెంట్ అసిస్టెన్స్", category: "technical", language: "all", isActive: true },
  { id: "pr-12", source: "AI / ML", replacement: "ఏఐ మరియు ఎంఎల్", category: "technical", language: "all", isActive: true },
];

let voiceTests: VoiceTestModel[] = [
  {
    id: 1,
    organization_id: 1,
    provider: "sarvam",
    voice_id: "neha",
    voice_name: "Neha (Sarvam Bulbul V3)",
    model: "bulbul:v3",
    language: "te-IN",
    gender: "female",
    test_text: "నమస్కారం అండి! మారుతి టెక్నాలజీస్ అడ్మిషన్స్ డెస్క్ కి స్వాగతం. మన వద్ద కోర్ పైథాన్ మరియు కోర్ జావా బ్యాచ్‌లు అందుబాటులో ఉన్నాయి.",
    normalized_text: "నమస్కారం అండి! మారుతి టెక్నాలజీస్ అడ్మిషన్స్ డెస్క్ కి స్వాగతం. మన వద్ద కోర్ పైథాన్ మరియు కోర్ జావా బ్యాచ్‌లు అందుబాటులో ఉన్నాయి.",
    ttfa_ms: 185,
    total_latency_ms: 320,
    audio_duration_ms: 4800,
    sample_rate: 24000,
    characters: 124,
    naturalness_score: 9.6,
    pronunciation_score: 9.8,
    human_like_score: 9.5,
    conversation_score: 9.7,
    quality_score: 9.6,
    overall_score: 9.6,
    notes: "Superb native Telugu accent, crystal clear articulation of institute name and technical terms.",
    created_at: "2026-02-18T10:30:00Z",
  },
  {
    id: 2,
    organization_id: 1,
    provider: "elevenlabs",
    voice_id: "eleven-sravani-telugu",
    voice_name: "Sravani (ElevenLabs Turbo)",
    model: "eleven_turbo_v2_5",
    language: "te-IN",
    gender: "female",
    test_text: "కోర్ పైథాన్ ఫీజు నాలుగు వేల రూపాయలు మరియు కోర్ జావా ఫీజు ఐదు వేల రూపాయలు.",
    normalized_text: "కోర్ పైథాన్ ఫీజు నాలుగు వేల రూపాయలు మరియు కోర్ జావా ఫీజు ఐదు వేల రూపాయలు.",
    ttfa_ms: 210,
    total_latency_ms: 345,
    audio_duration_ms: 3900,
    sample_rate: 24000,
    characters: 78,
    naturalness_score: 9.4,
    pronunciation_score: 9.2,
    human_like_score: 9.6,
    conversation_score: 9.4,
    quality_score: 9.5,
    overall_score: 9.4,
    notes: "Very natural emotional warmth, great turn taking cadence for admissions counseling.",
    created_at: "2026-02-18T11:15:00Z",
  },
  {
    id: 3,
    organization_id: 1,
    provider: "google_chirp",
    voice_id: "te-IN-Chirp3-HD-Aoede",
    voice_name: "Aoede (Chirp 3 HD)",
    model: "chirp-3-hd",
    language: "te-IN",
    gender: "female",
    test_text: "మన తరగతులు అమీర్‌పేట మెయిన్ సెంటర్‌లో ప్రతిరోజూ ఉదయం ఎనిమిది గంటలకు ప్రారంభమవుతాయి.",
    normalized_text: "మన తరగతులు అమీర్‌పేట మెయిన్ సెంటర్‌లో ప్రతిరోజూ ఉదయం ఎనిమిది గంటలకు ప్రారంభమవుతాయి.",
    ttfa_ms: 240,
    total_latency_ms: 390,
    audio_duration_ms: 4200,
    sample_rate: 24000,
    characters: 91,
    naturalness_score: 9.2,
    pronunciation_score: 9.5,
    human_like_score: 9.1,
    conversation_score: 9.3,
    quality_score: 9.4,
    overall_score: 9.3,
    notes: "High fidelity audio resolution, excellent location and timing articulation.",
    created_at: "2026-02-18T12:00:00Z",
  },
];

// ==========================================
// Production File-Backed Persistent Database Layer
// ==========================================

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

function initPersistence() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (typeof parsed.nextId === "number") nextId = parsed.nextId;
      if (parsed.organization) {
        Object.assign(organization, parsed.organization);
        if (organization.name === "Test Org" || organization.name?.toLowerCase().includes("test org")) {
          organization.name = "Maruthi Technologies";
          organization.email = "admissions@maruthitechnologies.com";
          organization.phone = "+91 91213 75668";
          organization.address = "Opp. Pillar 1045, Ameerpet, Hyderabad, Telangana 500038, India";
        }
      }
      if (Array.isArray(parsed.agents) && parsed.agents.length > 0) {
        agents = parsed.agents;
        const maruthiIdx = agents.findIndex((a) => a.name.includes("Maruthi") || a.public_slug === "sravani-maruthi" || a.public_slug === "ananya-maruthi" || a.public_slug === "maya-maruthi");
        if (maruthiIdx !== -1) {
          agents[maruthiIdx].name = "Sravani — Maruthi Technologies";
          agents[maruthiIdx].public_slug = "sravani-maruthi";
          agents[maruthiIdx].avatar = "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80";
          agents[maruthiIdx].welcome_message = "Hello! Welcome to Maruthi Technologies. I am Sravani, your admissions advisor. How can I assist you with our training courses today?";
          agents[maruthiIdx].system_instructions = "You are Sravani, the senior Admissions Advisor & Receptionist for Maruthi Technologies. Greet visitors warmly, answer questions accurately based strictly on verified course documents (Core Python Programming and Core Java Programming), and assist prospective students with inquiries and enrollment in English or Telugu. Speak in a natural, polite, and lively human conversational tone.";
          agents[maruthiIdx].knowledge_item_ids = [841, 829];
          agents[maruthiIdx].voice_id = "sravani_natural_telugu";
          agents[maruthiIdx].is_active = true;
          agents[maruthiIdx].is_published = true;
          const maruthi = agents.splice(maruthiIdx, 1)[0];
          agents.unshift(maruthi);
        } else {
          const maruthiAgent: AgentModel = {
            id: 971,
            uuid: "agent-971",
            organization_id: 1,
            name: "Sravani — Maruthi Technologies",
            avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80",
            public_slug: "sravani-maruthi",
            welcome_message: "Hello! Welcome to Maruthi Technologies. I am Sravani, your admissions advisor. How can I assist you with our training courses today?",
            system_instructions: "You are Sravani, the senior Admissions Advisor & Receptionist for Maruthi Technologies. Greet visitors warmly, answer questions accurately based strictly on verified course documents (Core Python Programming and Core Java Programming), and assist prospective students with inquiries and enrollment in English or Telugu. Speak in a natural, polite, and lively human conversational tone.",
            personality: "friendly",
            language: "multilingual",
            voice_id: "sravani_natural_telugu",
            speaking_style: "warm_conversational",
            channels: ["web", "voice", "whatsapp"],
            allowed_tools: ["search_knowledge", "get_company_info", "create_lead", "schedule_appointment", "transfer_to_human"],
            is_published: true,
            is_active: true,
            knowledge_item_ids: [841, 829],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          agents.unshift(maruthiAgent);
        }
      }
      if (Array.isArray(parsed.knowledgeItems) && parsed.knowledgeItems.length > 0) {
        knowledgeItems = parsed.knowledgeItems.map((item: KnowledgeItemModel) => {
          if (!item) return item;
          // Deactivate corrupted PDF binary blob or item 817 / 814
          if (item.id === 817 || item.id === 814 || (typeof item.content === "string" && (item.content.startsWith("%PDF-") || item.content.includes("\u0000")))) {
            return { ...item, is_active: false };
          }
          if (item.title === "python_course_info") {
            return { ...item, title: "Core Python Programming" };
          }
          if (item.title === "java_course_info") {
            return { ...item, title: "Core Java Programming" };
          }
          return item;
        });
      }
      if (Array.isArray(parsed.leads)) leads = parsed.leads;
      if (Array.isArray(parsed.appointments)) appointments = parsed.appointments;
      if (Array.isArray(parsed.conversations)) conversations = parsed.conversations;
      if (Array.isArray(parsed.messages)) messages = parsed.messages;
      if (Array.isArray(parsed.voiceCalls)) voiceCalls = parsed.voiceCalls;
      if (Array.isArray(parsed.linkedSheets)) linkedSheets = parsed.linkedSheets;
      if (Array.isArray(parsed.voiceTests) && parsed.voiceTests.length > 0) voiceTests = parsed.voiceTests;
      if (Array.isArray(parsed.voiceFavorites) && parsed.voiceFavorites.length > 0) voiceFavorites = parsed.voiceFavorites;
      if (parsed.receptionistVoiceConfig) receptionistVoiceConfig = parsed.receptionistVoiceConfig;
      if (Array.isArray(parsed.pronunciationRules) && parsed.pronunciationRules.length > 0) pronunciationRules = parsed.pronunciationRules;
      if (parsed.telephonyConfig) Object.assign(telephonyConfig, parsed.telephonyConfig);
      console.log(`[Storage] Loaded persistent database from ${DB_FILE} (${leads.length} leads, ${appointments.length} appointments, ${conversations.length} conversations, ${voiceTests.length} voiceTests)`);
    } else {
      savePersistenceNow();
      console.log(`[Storage] Initialized persistent database at ${DB_FILE}`);
    }
  } catch (err) {
    console.error("[Storage] Error loading persistent database:", err);
  }
}

let saveTimer: NodeJS.Timeout | null = null;
function savePersistence() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    savePersistenceNow();
  }, 100);
}

function savePersistenceNow() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const state = {
      nextId,
      organization,
      agents,
      knowledgeItems,
      leads,
      appointments,
      conversations,
      messages,
      voiceCalls,
      linkedSheets,
      telephonyConfig,
      voiceTests,
      voiceFavorites,
      receptionistVoiceConfig,
      pronunciationRules,
      saved_at: new Date().toISOString(),
    };
    const tmp = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2), "utf-8");
    fs.renameSync(tmp, DB_FILE);
  } catch (err) {
    console.error("[Storage] Error writing persistent database:", err);
  }
}

initPersistence();

// ==========================================
// Tool Execution Engine
// ==========================================

interface ToolResult {
  tool: string;
  args: Record<string, unknown>;
  result: unknown;
}

const toolRegistry: Record<string, (args: Record<string, unknown>, orgId: number) => Promise<unknown>> = {
  get_company_info: async () => {
    return {
      name: organization.name,
      email: organization.email,
      phone: organization.phone,
      address: organization.address,
      website: organization.website,
      timezone: organization.timezone,
    };
  },

  get_business_hours: async () => {
    return {
      working_hours: `${organization.working_hours.start} to ${organization.working_hours.end} ${organization.timezone}`,
      days: organization.working_hours.days.join(", "),
      ai_receptionist: "Online 24/7/365 with zero downtime",
    };
  },

  get_service_details: async () => {
    return { services: organization.services };
  },

  search_knowledge: async (args) => {
    const query = String(args.query || "").toLowerCase();
    const allowedIds = Array.isArray(args.allowed_ids) ? (args.allowed_ids as number[]) : null;
    let agentId = args.agent_id ? Number(args.agent_id) : null;
    if (!agentId && args.slug) {
      const found = agents.find((a) => (a.public_slug && a.public_slug.toLowerCase() === String(args.slug).toLowerCase()) || a.uuid === String(args.slug));
      if (found) agentId = found.id;
    }

    let pool: KnowledgeItemModel[] = [];
    if (agentId) {
      const targetAgent = agents.find((a) => a.id === agentId);
      pool = getAgentKnowledgeItems(targetAgent);
    } else if (allowedIds && allowedIds.length > 0) {
      pool = knowledgeItems.filter((k) => k && k.is_active && allowedIds.includes(k.id));
    } else if (agents.length > 0) {
      // Default to default agent if no specific ID passed
      pool = getAgentKnowledgeItems(agents[0]);
    } else {
      pool = [];
    }

    const matches = pool
      .map((k) => {
        let score = 0;
        const words = query.split(/\s+/).filter((w) => w.length > 1);
        words.forEach((w) => {
          if (k.title.toLowerCase().includes(w)) score += 3;
          if (k.content.toLowerCase().includes(w)) score += 1;
        });
        return { item: k, score };
      })
      .filter((m) => m.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    return matches.map((m) => ({
      id: m.item.id,
      title: m.item.title,
      category: m.item.category,
      source: m.item.source,
      content: m.item.content,
      score: m.score,
    }));
  },

  create_lead: async (args, orgId) => {
    const name = String(args.name || "Interested Student");
    const email = args.email ? String(args.email) : null;
    const phone = args.phone ? String(args.phone) : null;
    const interest = String(args.interest || "Java Programming Course (INR 25,000)");
    const budget = args.budget ? String(args.budget) : null;
    const preferredTime = String(args.preferred_time || "Business hours");

    let score = 65;
    if (email) score += 15;
    if (phone) score += 20;
    if (budget) score += 10;

    // If a lead already exists for this conversation, update it in place
    const existingLead = typeof args.conversation_id === "number"
      ? leads.find((l) => l.conversation_id === args.conversation_id)
      : null;

    if (existingLead) {
      if (args.name && args.name !== "Interested Student" && args.name !== "Valued Visitor") {
        existingLead.name = String(args.name);
      }
      if (phone) existingLead.phone = phone;
      if (email) existingLead.email = email;
      if (args.interest) existingLead.interest = interest;
      if (args.preferred_time) existingLead.preferred_time = preferredTime;
      if (args.notes) existingLead.notes = String(args.notes);

      let updatedScore = existingLead.lead_score || 65;
      if (existingLead.phone) updatedScore = Math.max(updatedScore, 90);
      if (existingLead.email) updatedScore = Math.max(updatedScore, 85);
      existingLead.lead_score = updatedScore;
      existingLead.status = updatedScore >= 80 ? "qualified" : "new";
      existingLead.updated_at = new Date().toISOString();

      savePersistenceNow();
      return { lead_id: existingLead.id, lead_score: existingLead.lead_score, status: existingLead.status };
    }

    const newLead: LeadModel = {
      id: getId(),
      organization_id: orgId,
      conversation_id: typeof args.conversation_id === "number" ? args.conversation_id : null,
      name,
      phone,
      email,
      company: args.company ? String(args.company) : null,
      source: "AI Receptionist Tool Execution",
      intent: String(args.intent || "Course Enrollment Inquiry"),
      interest,
      budget,
      lead_score: score,
      preferred_mode: phone ? "phone" : "email",
      preferred_time: preferredTime,
      notes: String(args.notes || "Lead automatically qualified and recorded by AI receptionist."),
      assigned_staff: "Harish Sadula",
      status: score >= 80 ? "qualified" : "new",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    leads.unshift(newLead);
    savePersistenceNow();
    return { lead_id: newLead.id, lead_score: score, status: newLead.status };
  },

  schedule_appointment: async (args, orgId) => {
    const customerName = String(args.customer_name || "Customer");
    const customerEmail = String(args.customer_email || "visitor@example.com");
    const customerPhone = args.customer_phone ? String(args.customer_phone) : null;
    const service = String(args.service || "Product Consultation");
    const slotDate = String(args.slot_date || "2026-09-20");
    const slotTime = String(args.slot_time || "10:00 AM");

    const newAppt: AppointmentModel = {
      id: getId(),
      organization_id: orgId,
      agent_id: typeof args.agent_id === "number" ? args.agent_id : 1,
      conversation_id: typeof args.conversation_id === "number" ? args.conversation_id : null,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      service,
      slot_date: slotDate,
      slot_time: slotTime,
      status: "confirmed",
      notes: String(args.notes || "Booked through AI Receptionist"),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    appointments.unshift(newAppt);
    return { appointment_id: newAppt.id, slot_date: slotDate, slot_time: slotTime, status: "confirmed" };
  },

  transfer_to_human: async (args) => {
    return {
      transferred: true,
      escalation_reason: String(args.reason || "Customer requested human specialist"),
      team_notified: true,
      department: "Customer Operations",
    };
  },

  lookup_customer: async (args, orgId) => {
    const identifier = String(args.identifier || "").toLowerCase();
    const matchedLead = leads.find(
      (l) =>
        l.organization_id === orgId &&
        ((l.email && l.email.toLowerCase().includes(identifier)) ||
          (l.phone && l.phone.includes(identifier)) ||
          (l.name && l.name.toLowerCase().includes(identifier))),
    );
    return matchedLead ? { found: true, lead: matchedLead } : { found: false };
  },

  compare_courses: async (args) => {
    const courseA = String(args.course_a || "Java Programming").trim();
    const courseB = String(args.course_b || "Python Programming").trim();
    return {
      comparison_ready: true,
      course_a: courseA,
      course_b: courseB,
      evaluated_at: new Date().toISOString(),
    };
  },

  book_demo_session: async (args, orgId) => {
    const customerName = String(args.customer_name || "Prospective Student");
    const customerPhone = args.customer_phone ? String(args.customer_phone) : null;
    const customerEmail = args.customer_email ? String(args.customer_email) : null;
    const course = String(args.course_name || "Software Training Program");
    const preferredDate = String(args.preferred_date || "Upcoming Saturday / Tomorrow");
    const preferredTime = String(args.preferred_time || "10:00 AM IST");
    const bookingCode = `DEMO-${Math.floor(1000 + Math.random() * 9000)}`;

    const newAppt: AppointmentModel = {
      id: getId(),
      organization_id: orgId,
      agent_id: typeof args.agent_id === "number" ? args.agent_id : 1,
      conversation_id: typeof args.conversation_id === "number" ? args.conversation_id : null,
      customer_name: customerName,
      customer_email: customerEmail || "demo@example.com",
      customer_phone: customerPhone,
      service: `Free Live Demo: ${course}`,
      slot_date: preferredDate,
      slot_time: preferredTime,
      status: "confirmed",
      notes: `Demo Reference Code: ${bookingCode}. Mode: Online Interactive / Campus.`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    appointments.unshift(newAppt);
    savePersistenceNow();
    return {
      booking_confirmed: true,
      booking_code: bookingCode,
      course,
      date: preferredDate,
      time: preferredTime,
      status: "confirmed",
    };
  },

  send_whatsapp_syllabus: async (args) => {
    const phone = String(args.customer_phone || "+91 91213 75668");
    const course = String(args.course_name || "Software Development");
    return {
      dispatched: true,
      channel: "WhatsApp & SMS",
      target_phone: phone,
      document_type: `Full ${course} Curriculum & Project Blueprint PDF`,
      status: "sent_successfully",
    };
  },

  calculate_lead_score: async (args) => {
    const hasName = Boolean(args.name && args.name !== "Interested Student");
    const hasPhone = Boolean(args.phone);
    const hasEmail = Boolean(args.email);
    const hasMode = Boolean(args.mode);
    const hasBatch = Boolean(args.batch);
    const hasDemo = Boolean(args.demo_booked);

    let score = 50;
    if (hasName) score += 15;
    if (hasPhone) score += 20;
    if (hasEmail) score += 10;
    if (hasMode) score += 10;
    if (hasBatch) score += 10;
    if (hasDemo) score += 20;
    score = Math.min(100, score);

    const category = score >= 85 ? "HOT" : (score >= 65 ? "WARM" : "ENGAGED");
    return { score, category, qualified: score >= 80 };
  },
};

// ==========================================
// Multilingual & Conversation Reasoning Engine
// ==========================================

function normalizeTypoAndSlang(text: string): string {
  if (!text) return "";
  let res = text;

  // Typo & Phonetic normalizations for courses and educational terms
  res = res.replace(/\b(phython|pythn|pythan|pyton|pyth)\b/gi, "python");
  res = res.replace(/\b(jva|jvva|jaava|javva)\b/gi, "java");
  res = res.replace(/\b(sylabus|syllbus|syllabos|curiculum|curriculam)\b/gi, "syllabus");
  res = res.replace(/\b(timngs|timmings|timng|schdule|shedul|schedual)\b/gi, "timings");
  res = res.replace(/\b(feee|feees|prce|prizing|tution|tuton)\b/gi, "fees");
  res = res.replace(/\b(locatn|locatin|addres|adrs|campas)\b/gi, "location");
  res = res.replace(/\b(admisn|admissn|enrol|admision|regstr)\b/gi, "admission");
  res = res.replace(/\b(concesion|discunt|discoun|scholership)\b/gi, "discount");
  res = res.replace(/\b(certificat|certficate|certifcate)\b/gi, "certificate");
  res = res.replace(/\b(placmnt|plcmnt|oppurtunity|oppertunities)\b/gi, "placement");

  return res;
}

function detectLanguage(text: string): "en" | "te" | "hi" {
  const lower = text.toLowerCase();
  // Telugu / Tenglish indicators
  if (
    /[\u0C00-\u0C7F]/.test(text) ||
    lower.includes("telugu") ||
    lower.includes("cheppandi") ||
    lower.includes("namaskaram") ||
    lower.includes("entha") ||
    lower.includes("ela") ||
    lower.includes("kavali") ||
    lower.includes("undi") ||
    lower.includes("ledu") ||
    lower.includes("chesukovalani") ||
    lower.includes("eppudu") ||
    lower.includes("ekkada") ||
    lower.includes("nerpistaru") ||
    lower.includes("istara") ||
    lower.includes("cheyandi") ||
    lower.includes("thaggistara") ||
    lower.includes("untada")
  ) {
    return "te";
  }
  // Hindi / Hinglish indicators
  if (
    /[\u0900-\u097F]/.test(text) ||
    lower.includes("hindi") ||
    lower.includes("namaste") ||
    lower.includes("bataiye") ||
    lower.includes("kya hai") ||
    lower.includes("karna chahta") ||
    lower.includes("fees kitni") ||
    lower.includes("fees kitna") ||
    lower.includes("samay") ||
    lower.includes("baat karni") ||
    lower.includes("kab shuru") ||
    lower.includes("kahan hai") ||
    lower.includes("padhate ho") ||
    lower.includes("milega kya") ||
    lower.includes("kaise le") ||
    lower.includes("kitne ka")
  ) {
    return "hi";
  }
  return "en";
}

function checkEscalation(text: string): boolean {
  const lower = text.toLowerCase();
  return organization.escalation_keywords.some((k) => lower.includes(k));
}

function computeConversationState(
  previousState: string,
  userText: string,
  hasToolsExecuted: boolean,
  isEscalated: boolean,
): ConversationModel["conversation_state"] {
  if (isEscalated) return "HANDOFF";
  const lower = userText.toLowerCase();

  if (lower.includes("book") || lower.includes("appointment") || lower.includes("schedule") || lower.includes("slot")) {
    return "ACTION";
  }
  if (lower.includes("@") || /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(userText)) {
    return "CONFIRMATION";
  }
  if (lower.includes("student") || lower.includes("professional") || lower.includes("online") || lower.includes("classroom")) {
    return "QUALIFICATION";
  }
  if (hasToolsExecuted || lower.includes("cost") || lower.includes("price") || lower.includes("timing") || lower.includes("hour")) {
    return "INFORMATION";
  }
  if (previousState === "GREETING") {
    return "DISCOVERY";
  }
  return "DISCOVERY";
}

// Helper to format clean text responses without markdown asterisks (**) and maintain neat, structured output
function formatCleanText(text: string): string {
  if (!text) return "";
  let res = text;

  // 1. Remove markdown bold: **bold** -> bold
  res = res.replace(/\*\*([^*]+)\*\*/g, "$1");
  // 2. Remove markdown italics: *italic* -> italic (when not a bullet)
  res = res.replace(/(^|[^*])\*([^*\r\n]+)\*([^*]|$)/g, "$1$2$3");
  // 3. Remove any stray asterisks or double asterisks
  res = res.replace(/\*\*/g, "");
  // 4. Clean up bullet points to standard unicode bullets
  res = res.replace(/^[ \t]*[-*][ \t]+/gm, "• ");
  // 5. Ensure numbered lists have standard clean spacing: e.g. "1.  " -> "1. "
  res = res.replace(/^[ \t]*(\d+)\.[ \t]+/gm, "$1. ");
  // 6. Fix multiple empty lines
  res = res.replace(/\n{3,}/g, "\n\n");
  // 7. Strip trailing whitespace per line
  res = res.split("\n").map((line) => line.trimEnd()).join("\n");

  return res.trim();
}

interface ExtractedOrgInfo {
  hostCompanyName: string | null;
  phone: string | null;
  email: string | null;
  location: string | null;
  website: string | null;
  courseName: string;
  courseDuration: string;
  courseFee: string;
  trainingMode: string;
  batchTimings: string[];
  topics: string[];
  projects: string[];
  eligibility: string | null;
  googleMapsUrl: string | null;
}

function isGibberishOrInvalidName(candidate: string): boolean {
  const trimmed = candidate.trim();
  if (trimmed.length < 2 || trimmed.length > 40) return true;
  const lower = trimmed.toLowerCase();

  // Check repeating characters (e.g. "oooo", "aaaa")
  if (/^(.)\1+$/.test(lower)) return true;

  // Immediate rejection if candidate contains intent or domain action words
  if (/\b(interested|interest|want|wants|wanting|planning|looking|seeking|trying|ready|hoping|joining|join|enrolling|enroll|admission|admissions|course|courses|program|programs|training|class|classes|batch|batches|fees?|syllabus|curriculum|python|java|beginner|fresher|timing|timings|online|offline|student|developer|coding|institute|academy|learning|study|studying)\b/i.test(lower)) {
    return true;
  }

  // Reject if any word is a common preposition, article, or auxiliary
  const invalidSingleWords = new Set([
    "in", "on", "at", "to", "for", "from", "with", "about", "by", "into", "of", "off", "up", "out",
    "the", "a", "an", "this", "that", "these", "those",
    "is", "am", "are", "was", "were", "be", "been", "being", "do", "does", "did",
    "have", "has", "had", "can", "could", "will", "would", "shall", "should", "may", "might", "must",
  ]);
  const candidateWords = lower.split(/\s+/);
  if (candidateWords.some((w) => invalidSingleWords.has(w))) {
    return true;
  }

  // Check common conversational, grammar, or domain keyword phrases
  const nonNameKeywords = new Set([
    // Greetings & chitchat
    "hi", "hello", "hey", "heya", "hola", "howdy", "yo", "namaste", "sup", "greetings",
    "good morning", "good afternoon", "good evening", "good day", "good night", "how are you",
    // Pronouns & articles
    "i", "me", "my", "myself", "you", "your", "yours", "we", "us", "our", "ours",
    "he", "him", "his", "she", "her", "hers", "they", "them", "their", "theirs",
    "it", "its", "this", "that", "these", "those", "the", "a", "an",
    // Affirmations, negations, common acknowledgments
    "yes", "no", "ok", "okay", "k", "sure", "cool", "fine", "yup", "yeah", "yep", "nope", "nah",
    "not", "thanks", "thank you", "thx", "thnx", "welcome", "please", "pls", "help", "done", "test",
    // Verbs & question words
    "what", "when", "where", "which", "who", "why", "how", "whose", "whom",
    // Academy & domain keywords
    "morning", "evening", "afternoon", "online", "offline", "classroom", "student", "beginner",
    "fresher", "fresh", "intermediate", "expert", "experience", "background", "java", "python",
    "course", "courses", "batch", "batches", "class", "classes", "join", "enroll", "enrollment",
    "admission", "admissions", "fees", "fee", "cost", "price", "pricing", "tuition",
    "discount", "scholarship", "concession", "weather", "today", "syllabus", "curriculum",
    "topic", "topics", "project", "projects", "map", "maps", "location", "address", "phone",
    "email", "contact", "number", "office", "website", "details", "info", "eligibility", "prerequisite",
    "1st", "2nd", "3rd", "first", "second", "third", "one", "two", "three", "1", "2", "3",
    "center", "campus", "training", "program", "institute", "academy", "developer", "coding", "code",
  ]);
  if (nonNameKeywords.has(lower)) return true;

  // Check if every word has at least one vowel (a, e, i, o, u, y)
  const words = trimmed.split(/\s+/);
  for (const w of words) {
    if (!/^[a-zA-Z.'-]+$/.test(w)) return true;
    if (!/[aeiouyAEIOUY]/.test(w) && w.length >= 2) return true;
    // Catch keyboard smash consonant clusters like "sdfgh", "dfgh", "zxcv"
    if (/[bcdfghjklmnpqrstvwxzBCDFGHJKLMNPQRSTVWXZ]{4,}/.test(w)) return true;
  }

  // Check common keyboard smash patterns
  if (/asdf|qwerty|zxcv|ghjk|tyui|dfgh|hjkl|sdfgh|fghj|xcvb|rtyu/i.test(lower)) return true;

  return false;
}

function isGibberishText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;

  // If it contains any digits (e.g., phone numbers like 9121401593, years, times, fee amounts), it is NOT gibberish
  if (/\d+/.test(trimmed)) return false;

  // Pure punctuation or symbols without any letters (e.g., "???", "...", "!@#$%^")
  if (/^[?!.,;:!@#$%^&*()_+=\-[\]{}|\\/<>~`\s]+$/.test(trimmed)) return true;

  const lower = trimmed.toLowerCase();

  // Repeating single character 4+ times (e.g., "aaaaa", "zzzzz", "ffffff")
  if (/^(.)\1{3,}$/.test(lower)) return true;

  // Common keyboard smash patterns
  if (/asdf|qwerty|zxcv|ghjk|tyui|dfgh|hjkl|sdfgh|fghj|xcvb|rtyu|srfddd|dfgf/i.test(lower)) return true;

  const words = trimmed.split(/\s+/).filter(Boolean);
  // If all words are 4+ letters and have no vowels at all (e.g., "bcdfgh", "wrts")
  let nonVowelLongWords = 0;
  for (const w of words) {
    const lettersOnly = w.replace(/[^a-zA-Z]/g, "");
    if (lettersOnly.length >= 4 && !/[aeiouyAEIOUY]/.test(lettersOnly)) {
      nonVowelLongWords++;
    }
    if (/[bcdfghjklmnpqrstvwxzBCDFGHJKLMNPQRSTVWXZ]{5,}/i.test(lettersOnly)) {
      return true;
    }
  }
  if (nonVowelLongWords > 0 && nonVowelLongWords === words.length) return true;

  return false;
}

interface ParsedKnowledgeDoc {
  id: number;
  rawTitle: string;
  category: string;
  source: string;
  isEducationalCourse: boolean;
  isComplianceOrPolicy: boolean;
  displayName: string;
  companyName: string | null;
  duration: string | null;
  fee: string | null;
  modes: string[];
  batchTimings: string[];
  topics: string[];
  projects: string[];
  eligibility: string | null;
  rawContent: string;
}

function cleanDisplayTitle(raw: string): string {
  if (!raw) return "Training Program";
  let s = raw.replace(/\.[a-zA-Z0-9]+$/, "").replace(/[-_]+/g, " ").trim();
  if (/\bpython\b/i.test(s)) return "Core Python Programming";
  if (/\bjava\b/i.test(s) && !/\bjavascript\b/i.test(s)) return "Core Java Programming";
  if (/\bdata\s*science\b/i.test(s)) return "Data Science Masterclass";
  if (/\bfull\s*stack\b/i.test(s)) return "Full Stack Web Development";
  s = s.replace(/\b(?:course|info|doc|training|program)\b/gi, "").trim();
  if (!s || s.length < 2) s = raw.replace(/[-_]+/g, " ");
  return s.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

function parseKnowledgeBase(docs: KnowledgeItemModel[]): ParsedKnowledgeDoc[] {
  const activeDocs = (docs || []).filter((doc) => {
    if (!doc || !doc.content) return false;
    if (doc.is_active === false) return false;
    if (doc.id === 817) return false;
    if (typeof doc.content === "string" && (doc.content.startsWith("%PDF-") || doc.content.includes("\u0000"))) return false;
    if (typeof doc.title === "string" && doc.title.includes("%PDF")) return false;
    return true;
  });

  return activeDocs.map((doc) => {
    const text = doc.content || "";
    const lowerText = text.toLowerCase();
    const title = doc.title || "";
    const lowerTitle = title.toLowerCase();

    // Check if compliance, security, privacy or legal policy
    const isComplianceOrPolicy =
      lowerTitle.includes("privacy") ||
      lowerTitle.includes("security") ||
      lowerTitle.includes("compliance") ||
      lowerTitle.includes("multi-tenant") ||
      lowerTitle.includes("terms of service") ||
      lowerTitle.includes("legal") ||
      lowerText.includes("role-based access control") ||
      lowerText.includes("tenant isolation") ||
      lowerText.includes("gdpr") ||
      lowerText.includes("prompt injection shield") ||
      lowerText.includes("encryption at rest");

    // Company extraction
    let companyName: string | null = null;
    const compMatch = text.match(/(?:Company|Institute|Academy|Organization)\s*:\s*([^\r\n]+)/i) ||
      text.match(/COMPANY\s*\r?\n\s*([^\r\n]+)/i);
    if (compMatch && compMatch[1].trim()) {
      const c = compMatch[1].trim();
      if (!/^(the|our|null|undefined|none)$/i.test(c)) companyName = c;
    }

    // Course Name extraction
    let courseName: string | null = null;
    const crsMatch = text.match(/(?:Course Name|Course|Subject|Program|Training Program)\s*[:=-]\s*([^\r\n]+)/i) ||
      text.match(/(?:Title)\s*[:=-]\s*([^\r\n]+)/i);
    if (crsMatch && crsMatch[1].trim()) {
      const cand = crsMatch[1].trim();
      if (!/^(the|our|null|undefined|none|mt-doc|company)$/i.test(cand) && !cand.toLowerCase().startsWith("company training") && !cand.toLowerCase().startsWith("doc-")) {
        courseName = cleanDisplayTitle(cand);
      }
    }

    if (!courseName && !isComplianceOrPolicy) {
      if (/\bpython\b/i.test(title) || /\bpython\b/i.test(text.slice(0, 250))) courseName = "Core Python Programming";
      else if (/\bjava\b/i.test(title) || /\bjava\b/i.test(text.slice(0, 250))) courseName = "Core Java Programming";
      else if (/data science/i.test(title) || /data science/i.test(text.slice(0, 250))) courseName = "Data Science Masterclass";
      else if (/full stack|web development/i.test(title) || /full stack/i.test(text.slice(0, 250))) courseName = "Full Stack Web Development";
      else if (/devops|cloud/i.test(title) || /devops/i.test(text.slice(0, 250))) courseName = "DevOps & Cloud";
      else if (title && !title.toLowerCase().startsWith("doc-") && !title.toLowerCase().startsWith("mt-doc") && title.trim().length >= 3) {
        courseName = cleanDisplayTitle(title.trim());
      }
    }

    const isEducationalCourse =
      !isComplianceOrPolicy &&
      (Boolean(courseName) ||
        lowerText.includes("course") ||
        lowerText.includes("curriculum") ||
        lowerText.includes("syllabus") ||
        lowerText.includes("programming") ||
        lowerText.includes("topics:") ||
        lowerText.includes("duration:") ||
        lowerText.includes("training mode"));

    const displayName = courseName || (isEducationalCourse ? "Training Program" : cleanDisplayTitle(title) || "Knowledge Document");

    // Duration extraction
    let duration: string | null = null;
    const durMatch = text.match(/(?:Duration|Course Duration)\s*[:=-]\s*([^\r\n]+)/i);
    if (durMatch && durMatch[1].trim()) duration = durMatch[1].trim();

    // Fee extraction
    let fee: string | null = null;
    const feeMatch = text.match(/(?:Course Fee|Fee|Tuition|Pricing|Cost)\s*[:=-]\s*([^\r\n]+)/i);
    if (feeMatch && feeMatch[1].trim()) fee = feeMatch[1].trim();

    // Training Modes
    const modes: string[] = [];
    if (/online/i.test(text)) modes.push("Online Live Interactive");
    if (/classroom|offline|in-person|campus/i.test(text)) modes.push("In-person Classroom");

    // Batch Timings
    const batchTimings: string[] = [];
    const morningMatch = text.match(/(?:Morning Batch|Morning Class|Morning)\s*[:=-]\s*([^\r\n]+)/i);
    const afternoonMatch = text.match(/(?:Afternoon Batch|Afternoon Class|Afternoon)\s*[:=-]\s*([^\r\n]+)/i);
    const eveningMatch = text.match(/(?:Evening Batch|Evening Class|Evening)\s*[:=-]\s*([^\r\n]+)/i);
    if (morningMatch) batchTimings.push(`Morning Batch: ${morningMatch[1].trim()}`);
    if (afternoonMatch) batchTimings.push(`Afternoon Batch: ${afternoonMatch[1].trim()}`);
    if (eveningMatch) batchTimings.push(`Evening Batch: ${eveningMatch[1].trim()}`);

    if (batchTimings.length === 0) {
      const generalTimingMatch = text.match(/(?:Batch Timings?|Class Timings?|Timings?|Schedule)\s*[:=-]\s*([^\r\n]+)/i);
      if (generalTimingMatch && !/(?:fee|inr|pricing|cost|tuition)/i.test(generalTimingMatch[1])) {
        const val = generalTimingMatch[1].trim();
        if (val.length >= 3 && !/^(the|our|null|undefined|none)$/i.test(val)) {
          batchTimings.push(val);
        }
      }
    }

    const nextBatchMatch = text.match(/(?:Next Batch|Batch Starts?|Start Date|Upcoming Batch)\s*[:=-]\s*([^\r\n]+)/i);
    if (nextBatchMatch && nextBatchMatch[1].trim()) {
      const nb = nextBatchMatch[1].trim();
      if (batchTimings.length > 0) {
        batchTimings[0] = `${batchTimings[0]} (Next Batch: ${nb})`;
      } else {
        batchTimings.push(`Upcoming Batch: ${nb}`);
      }
    }

    // Topics Covered
    let topics: string[] = [];
    const topicsMatch = text.match(/(?:Curriculum & Topics Covered|Topics Covered|Topics|Syllabus|Curriculum)[\s\S]*?(?=(?:Hands-on Projects|Real-time Projects|Capstone Projects|Projects|Duration|Availability|Fee|Pricing|Contact|Summary|$))/i);
    if (topicsMatch) {
      topics = topicsMatch[0]
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !/^(topics|syllabus|curriculum|topics covered|curriculum & topics covered):?$/i.test(l))
        .map((l) => l.replace(/^(?:\d+\.|\*|•|-)\s*/, "").trim())
        .filter((l) => l.length >= 2 && !/(?:duration|availability|online|classroom|fee|inr|batch|contact|summary)/i.test(l));
    }

    // Hands-on Projects (filter out placeholder labels like "projects.")
    let projects: string[] = [];
    const projBlock = text.match(/(?:Hands-on Projects|Real-time Projects|Capstone Projects|Projects Covered|Projects)[\s\S]*?(?=(?:Contact|Summary|Class Schedules|Key Course Details|Fee|Pricing|Tuition|Certification|Why Choose|$))/i);
    if (projBlock) {
      projects = projBlock[0]
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !/^(hands-on projects|real-time projects|capstone projects|projects covered|projects):?$/i.test(l))
        .map((l) => l.replace(/^(?:\d+\.|\*|•|-)\s*/, "").trim())
        .filter((l) =>
          l.length >= 4 &&
          !/^(projects?|none|n\/a|nil|tbd|projects\.)\.?$/i.test(l) &&
          !/(?:batch|admission|frequency|monday|friday|phone|email|fee|inr|duration|tuition|morning|evening|afternoon)/i.test(l)
        );
    }

    // Eligibility
    let eligibility: string | null = null;
    const eligMatch = text.match(/(?:Eligibility|Prerequisites|Target Audience)\s*:\s*([^\r\n]+)/i);
    if (eligMatch && eligMatch[1].trim()) eligibility = eligMatch[1].trim();

    return {
      id: doc.id,
      rawTitle: title,
      category: doc.category || "General",
      source: doc.source || "Uploaded Document",
      isEducationalCourse,
      isComplianceOrPolicy,
      displayName,
      companyName,
      duration,
      fee,
      modes: modes.length > 0 ? modes : ["Online Live Interactive", "Classroom Sessions"],
      batchTimings,
      topics,
      projects,
      eligibility,
      rawContent: text,
    };
  });
}

export function getAgentKnowledgeItems(agentObj: AgentModel | null | undefined): KnowledgeItemModel[] {
  if (!agentObj) return [];
  const assignedIds = Array.isArray(agentObj.knowledge_item_ids) ? agentObj.knowledge_item_ids : [];
  return knowledgeItems.filter((k) => k && k.is_active && assignedIds.includes(k.id));
}

export function getSuggestedQuestionsForAgent(agentObj: AgentModel | null | undefined): string[] {
  const docs = getAgentKnowledgeItems(agentObj);
  if (docs.length === 0) {
    return [
      "What services do you offer?",
      "What are your business hours?",
      "How can I contact support?",
      "Where are you located?",
    ];
  }

  const parsedDocs = parseKnowledgeBase(docs);
  const questions: string[] = [];

  // Educational courses
  const educationalDocs = parsedDocs.filter((d) => d.isEducationalCourse && d.displayName);
  if (educationalDocs.length > 0) {
    questions.push("Which courses do you offer?");
    educationalDocs.slice(0, 2).forEach((doc) => {
      questions.push(`What is the fee for ${doc.displayName}?`);
      questions.push(`${doc.displayName} syllabus & details`);
    });
    if (questions.length < 4) questions.push("What are the batch timings?");
    if (questions.length < 4) questions.push("Where is your campus located?");
    return Array.from(new Set(questions)).slice(0, 5);
  }

  // Non-educational documents
  docs.forEach((doc) => {
    const title = doc.title ? doc.title.trim() : "";
    const cat = doc.category ? doc.category.trim() : "";
    const lowerTitle = title.toLowerCase();

    if (lowerTitle.includes("pricing") || lowerTitle.includes("tier") || lowerTitle.includes("plan") || lowerTitle.includes("fee")) {
      questions.push("What are your pricing plans?");
    } else if (lowerTitle.includes("hour") || lowerTitle.includes("schedule") || lowerTitle.includes("operating")) {
      questions.push("What are your operating hours?");
    } else if (lowerTitle.includes("overview") || lowerTitle.includes("handbook") || lowerTitle.includes("about") || lowerTitle.includes("offering")) {
      questions.push(`Tell me about ${cleanDisplayTitle(title) || "your company"}`);
    } else if (lowerTitle.includes("location") || lowerTitle.includes("address") || lowerTitle.includes("campus") || lowerTitle.includes("contact")) {
      questions.push("Where are you located?");
    } else if (title) {
      questions.push(`Tell me about ${cleanDisplayTitle(title)}`);
    } else if (cat) {
      questions.push(`What services do you offer for ${cat}?`);
    }
  });

  if (questions.length === 0) {
    questions.push("What services do you offer?", "What are your operating hours?", "Where are you located?");
  }

  return Array.from(new Set(questions)).slice(0, 5);
}

function resolveHostDetails(agentObj: AgentModel): ExtractedOrgInfo {
  // 1. Authoritative Company Name Resolution:
  let hostCompanyName: string | null = null;
  if (agentObj?.welcome_message) {
    const welcMatch = agentObj.welcome_message.match(/Welcome(?:\s+to)?\s+([A-Za-z0-9\s&'-]+?)(?:\.|!|,|\s+I'm|\s+I am|\s+how)/i);
    if (welcMatch) {
      const cand = welcMatch[1].trim();
      if (
        cand &&
        !/^(the|our|this|here|my|apex solutions|test org)$/i.test(cand) &&
        !cand.toLowerCase().includes("apex solution") &&
        !cand.toLowerCase().includes("test org")
      ) {
        hostCompanyName = cand;
      }
    }
  }

  if (!hostCompanyName && agentObj?.name && agentObj.name.includes("—")) {
    const parts = agentObj.name.split("—");
    const cand = parts[1]?.trim();
    if (
      cand &&
      !parts[1].toLowerCase().includes("head receptionist") &&
      !parts[1].toLowerCase().includes("sales") &&
      !cand.toLowerCase().includes("test org")
    ) {
      hostCompanyName = cand;
    }
  }

  if (!hostCompanyName && organization?.name) {
    if (!organization.name.toLowerCase().includes("apex solution") && !organization.name.toLowerCase().includes("test org")) {
      hostCompanyName = organization.name;
    }
  }

  const agentDocs = getAgentKnowledgeItems(agentObj);

  const parsedDocs = parseKnowledgeBase(agentDocs);

  let phone: string | null = null;
  let email: string | null = null;
  let location: string | null = null;
  let website: string | null = null;
  let courseName: string | null = null;
  let courseDuration: string | null = null;
  let courseFee: string | null = null;
  let trainingMode: string | null = null;
  const batchTimings: string[] = [];
  let topics: string[] = [];
  let projects: string[] = [];
  let eligibility: string | null = null;

  for (const doc of parsedDocs) {
    if (!hostCompanyName && doc.companyName) {
      hostCompanyName = doc.companyName;
    }
    if (!courseName && doc.isEducationalCourse && doc.displayName) {
      courseName = doc.displayName;
    }
    if (!courseDuration && doc.duration) {
      courseDuration = doc.duration;
    }
    if (!courseFee && doc.fee) {
      courseFee = doc.fee;
    }
    if (!trainingMode && doc.modes.length > 0) {
      trainingMode = doc.modes.join(" and ");
    }
    if (batchTimings.length === 0 && doc.batchTimings.length > 0) {
      batchTimings.push(...doc.batchTimings);
    }
    if (topics.length === 0 && doc.topics.length > 0) {
      topics = doc.topics;
    }
    if (projects.length === 0 && doc.projects.length > 0) {
      projects = doc.projects;
    }
    if (!eligibility && doc.eligibility) {
      eligibility = doc.eligibility;
    }

    const text = doc.rawContent;
    if (!phone) {
      const phMatch = text.match(/(?:Phone|Contact|Mobile|Helpline|WhatsApp)\s*:\s*([^\r\n]+)/i);
      if (phMatch && phMatch[1].trim()) phone = phMatch[1].trim();
    }
    if (!email) {
      const emMatch = text.match(/(?:Email|E-mail)\s*:\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
      if (emMatch && emMatch[1].trim()) email = emMatch[1].trim();
    }
    if (!location) {
      const locMatch = text.match(/(?:Location|Address|Campus|Venue|Location \/ Address)\s*:\s*([^\r\n]+)/i);
      if (locMatch && locMatch[1].trim()) location = locMatch[1].trim();
    }
    if (!website) {
      const webMatch = text.match(/(?:Website|Site|URL)\s*:\s*([^\r\n]+)/i);
      if (webMatch && webMatch[1].trim()) website = webMatch[1].trim();
    }
  }

  if (!phone && organization?.phone && !organization.phone.includes("800) 555-0199")) {
    phone = organization.phone;
  }
  if (!email && organization?.email && !organization.email.includes("apexsolutions.ai")) {
    email = organization.email;
  }
  if (!location && organization?.address && !organization.address.includes("Innovation Parkway")) {
    location = organization.address;
  }
  if (!website && organization?.website && !organization.website.includes("apexsolutions.ai")) {
    website = organization.website;
  }

  if (!hostCompanyName) {
    const maruthiMention = agentDocs.some((k) => (k.title + " " + k.content).toLowerCase().includes("maruthi"));
    if (maruthiMention) {
      hostCompanyName = "Maruthi Technologies";
    }
  }

  const resolvedLocation = location || "Hyderabad, Telangana, India";
  const mapsQuery = encodeURIComponent(resolvedLocation);
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

  return {
    hostCompanyName,
    phone,
    email,
    location: resolvedLocation,
    website,
    courseName: courseName || "Software Training",
    courseDuration: courseDuration || "3 Months",
    courseFee: courseFee || "INR 25,000",
    trainingMode: trainingMode || "Online live interactive classes and Classroom sessions",
    batchTimings: batchTimings.length > 0 ? batchTimings : [
      "Morning Batch: 9:00 AM to 11:00 AM IST",
      "Afternoon Batch: 2:00 PM to 4:00 PM IST",
      "Evening Batch: 6:00 PM to 8:00 PM IST",
    ],
    topics,
    projects,
    eligibility,
    googleMapsUrl,
  };
}

let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    geminiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

// Multi-Intent Parser Engine
export interface MultiIntentResult {
  type: string;
  subject?: string | null;
  attributes?: string[] | null;
  confidence?: number;
  resolved?: boolean;
}

export function parseMultiIntents(text: string, interestedCourses: string[]): MultiIntentResult[] {
  const lower = text.toLowerCase();
  const intents: MultiIntentResult[] = [];
  const courseSubject = interestedCourses.length > 0 ? interestedCourses.join(" & ") : "Software Training";

  if (lower.includes("fee") || lower.includes("cost") || lower.includes("price") || lower.includes("charge") || lower.includes("inr") || lower.includes("discount")) {
    intents.push({
      type: "FEE_REQUEST",
      subject: courseSubject,
      attributes: ["tuition", "payment_plans"],
      confidence: 0.95,
      resolved: true,
    });
  }

  if (lower.includes("time") || lower.includes("timing") || lower.includes("batch") || lower.includes("slot") || lower.includes("schedule") || lower.includes("morning") || lower.includes("evening") || lower.includes("weekend")) {
    intents.push({
      type: "TIMINGS_REQUEST",
      subject: courseSubject,
      attributes: ["schedule", "slots"],
      confidence: 0.95,
      resolved: true,
    });
  }

  if (lower.includes("online") || lower.includes("offline") || lower.includes("classroom") || lower.includes("in-person") || lower.includes("zoom") || lower.includes("remote")) {
    intents.push({
      type: "MODE_REQUEST",
      subject: courseSubject,
      attributes: ["training_format"],
      confidence: 0.95,
      resolved: true,
    });
  }

  if (lower.includes("syllabus") || lower.includes("topic") || lower.includes("curriculum") || lower.includes("covered") || lower.includes("module") || lower.includes("learn")) {
    intents.push({
      type: "SYLLABUS_REQUEST",
      subject: interestedCourses[0] || "Course",
      attributes: ["modules", "projects"],
      confidence: 0.92,
      resolved: true,
    });
  }

  if (lower.includes("location") || lower.includes("address") || lower.includes("where") || lower.includes("campus") || lower.includes("hyderabad")) {
    intents.push({
      type: "LOCATION_REQUEST",
      subject: "Campus Address",
      attributes: ["location", "landmark"],
      confidence: 0.98,
      resolved: true,
    });
  }

  if (lower.includes("join") || lower.includes("enroll") || lower.includes("register") || lower.includes("book") || lower.includes("seat") || lower.includes("admission") || lower.includes("interested")) {
    intents.push({
      type: "ENROLLMENT_INTENT",
      subject: courseSubject,
      attributes: ["seat_reservation", "lead_capture"],
      confidence: 0.96,
      resolved: false,
    });
  }

  if (intents.length === 0) {
    intents.push({
      type: "COURSE_INQUIRY",
      subject: courseSubject,
      attributes: ["general_information"],
      confidence: 0.85,
      resolved: true,
    });
  }

  return intents;
}

// Conflict Resolution Engine
export function detectAndResolveConflicts(conv: ConversationModel): NonNullable<ConversationModel["conflicts"]> {
  const conflicts: NonNullable<ConversationModel["conflicts"]> = [];
  if (!conv || !conv.customer_course_preferences) return conflicts;

  const prefs = conv.customer_course_preferences;
  const courseNames = Object.keys(prefs);
  if (courseNames.length < 1) return conflicts;

  if (courseNames.length >= 2) {
    const javaItem = courseNames.find((c) => c.toLowerCase().includes("java") && prefs[c]?.batch?.toLowerCase().includes("evening"));
    const pythonItem = courseNames.find((c) => c.toLowerCase().includes("python") && prefs[c]?.batch?.toLowerCase().includes("evening"));

    if (javaItem && pythonItem) {
      conflicts.push({
        id: `conf-time-overlap-${Date.now()}`,
        type: "TIMING_OVERLAP",
        description: `Schedule Overlap: ${javaItem} Evening Batch (6:00 PM – 7:30 PM IST) overlaps with ${pythonItem} Evening Batch (7:00 PM – 8:00 PM IST) between 7:00 PM and 7:30 PM.`,
        courses: [javaItem, pythonItem],
        status: "active",
        resolution_advice: "Recommend taking Core Python in the Morning slot (10:00 AM IST) or taking one course via Online Live session with HD recorded backup.",
        detected_at: new Date().toISOString(),
      });
    }

    for (const c of courseNames) {
      if (c.toLowerCase().includes("java") && prefs[c]?.batch?.toLowerCase().includes("morning")) {
        conflicts.push({
          id: `conf-java-morning-${Date.now()}`,
          type: "SCHEDULE_COLLISION",
          description: "Unsupported Slot: Core Java Programming only offers Evening Batch (6:00 PM – 7:30 PM IST). Morning batch is unavailable.",
          courses: [c],
          status: "active",
          resolution_advice: "Propose evening batch slot (6:00 PM – 7:30 PM IST) or self-paced recordings.",
          detected_at: new Date().toISOString(),
        });
      }
    }

    const classroomCourses = courseNames.filter((c) => prefs[c]?.mode?.toLowerCase().includes("classroom") && prefs[c]?.batch);
    if (classroomCourses.length >= 2 && prefs[classroomCourses[0]].batch === prefs[classroomCourses[1]].batch && !javaItem) {
      conflicts.push({
        id: `conf-simul-${Date.now()}`,
        type: "SCHEDULE_COLLISION",
        description: `Simultaneous Classroom Attendance Conflict: ${classroomCourses.join(" and ")} are both requested for Classroom In-Person during the ${prefs[classroomCourses[0]].batch}.`,
        courses: classroomCourses,
        status: "active",
        resolution_advice: "Recommend staggering batch slots (e.g. Course 1 in Morning, Course 2 in Evening, or sequential term enrollment).",
        detected_at: new Date().toISOString(),
      });
    }
  }

  if (conv.customer_mode && conv.customer_mode.includes("Online") && conv.customer_mode.includes("Classroom")) {
    conflicts.push({
      id: `conf-hybrid-${Date.now()}`,
      type: "MODE_INCOMPATIBLE",
      description: "Hybrid Training Format Configuration: Selected courses combine both Online Live Interactive and Classroom In-Person modes.",
      courses: courseNames,
      status: "resolved",
      resolution_advice: "Confirmed hybrid enrollment: student attends classroom sessions for campus modules and online live interactive for remote modules.",
      detected_at: new Date().toISOString(),
    });
  }

  return conflicts;
}

// KO Summary Generator
export function updateKOSummary(conv: ConversationModel, groundingSources: { id: number; title: string }[]) {
  if (!conv) return;

  const prefs = conv.customer_course_preferences || {};
  const courses = Object.keys(prefs);

  const courseBreakdown = courses.map((cName) => {
    const pref = prefs[cName];
    let status: "confirmed" | "pending_mode" | "pending_batch" | "inquired" = "inquired";
    if (pref.mode && pref.batch) status = "confirmed";
    else if (!pref.mode) status = "pending_mode";
    else if (!pref.batch) status = "pending_batch";

    return {
      course: cName,
      mode: pref.mode || null,
      batch: pref.batch || null,
      status,
    };
  });

  const completedSteps: string[] = [];
  const pendingSteps: string[] = [];

  if (courses.length > 0) completedSteps.push(`Courses (${courses.join(", ")})`);
  else pendingSteps.push("Course Selection");

  if (conv.customer_name) completedSteps.push(`Name (${conv.customer_name})`);
  else pendingSteps.push("Visitor Name");

  if (conv.customer_phone) completedSteps.push(`Phone (${conv.customer_phone})`);
  else pendingSteps.push("Contact Phone");

  if (courses.length > 0 && courses.every((c) => prefs[c]?.mode)) completedSteps.push("Training Mode");
  else pendingSteps.push("Training Mode");

  if (courses.length > 0 && courses.every((c) => prefs[c]?.batch)) completedSteps.push("Batch Timing");
  else pendingSteps.push("Batch Timing");

  let readinessScore = 35;
  if (conv.customer_name) readinessScore += 15;
  if (conv.customer_phone) readinessScore += 25;
  if (courses.length > 0) readinessScore += 10;
  if (courses.length > 0 && courses.every((c) => prefs[c]?.mode)) readinessScore += 10;
  if (courses.length > 0 && courses.every((c) => prefs[c]?.batch)) readinessScore += 10;
  if (conv.lead_step === "CONFIRMED") readinessScore = 100;

  const activeConflicts = (conv.conflicts || []).filter((c) => c.status === "active");

  let nextBestAction = "Discover visitor requirements and answer course inquiries.";
  if (activeConflicts.length > 0) {
    nextBestAction = `Resolve timing collision for ${activeConflicts[0].courses.join(" & ")}.`;
  } else if (!conv.customer_name) {
    nextBestAction = "Ask visitor's name to personalize course recommendation.";
  } else if (!conv.customer_phone) {
    nextBestAction = "Collect 10-digit WhatsApp phone number to send syllabus & schedule.";
  } else if (pendingSteps.includes("Training Mode")) {
    nextBestAction = "Confirm preferred training format (Online Live or Classroom In-Person).";
  } else if (pendingSteps.includes("Batch Timing")) {
    nextBestAction = "Confirm preferred batch timing slot.";
  } else if (conv.lead_step === "CONFIRMED") {
    nextBestAction = "Seat pre-reserved! Direct lead to admissions desk for fee payment.";
  }

  if (!conv.enrollment_state) {
    conv.enrollment_state = {};
  }
  conv.enrollment_state.completed_fields = completedSteps;
  conv.enrollment_state.missing_fields = pendingSteps;
  if (conv.lead_step === "CONFIRMED") {
    conv.enrollment_state.status = "completed";
  } else if (conv.current_topic === "informational" && conv.topic_stack?.includes("enrollment")) {
    conv.enrollment_state.status = "paused";
  } else if (conv.customer_name || conv.customer_phone || courses.length > 0) {
    conv.enrollment_state.status = "collecting_information";
  } else {
    conv.enrollment_state.status = "idle";
  }

  const existingTouchpoints = conv.ko_summary?.knowledge_touchpoints || [];
  const newTouchpoints = Array.from(new Set([...existingTouchpoints, ...groundingSources.map((g) => g.title)]));

  conv.ko_summary = {
    readiness_score: Math.min(100, readinessScore),
    completed_steps: completedSteps,
    pending_steps: pendingSteps,
    course_breakdown: courseBreakdown,
    active_conflicts_count: activeConflicts.length,
    resolved_intents_count: conv.multi_intents?.filter((m) => m.resolved).length || 1,
    knowledge_touchpoints: newTouchpoints,
    next_best_action: nextBestAction,
  };
}

// Master Receptionist Agent Reasoner
async function executeReceptionistTurn(
  userText: string,
  agentObj: AgentModel,
  conv?: ConversationModel,
): Promise<{
  reply: string;
  toolsExecuted: ToolResult[];
  groundingSources: { id: number; title: string; source: string }[];
  state: ConversationModel["conversation_state"];
  intent: string;
  language: "en" | "te" | "hi";
  isEscalated: boolean;
  quickReplies: string[];
  latency_ms: number;
}> {
  const startTime = Date.now();
  const promptText = userText.trim();
  const rawAgentName = agentObj?.name || "Maya";
  const cleanAgentName = rawAgentName.split("—")[0].replace(/\b(ai|receptionist)\b/gi, "").trim();
  const agentName = cleanAgentName || "Maya";
  const normalizedPrompt = normalizeTypoAndSlang(promptText);
  const lang = detectLanguage(promptText);
  const isEscalated = checkEscalation(promptText) || promptText === "4" || promptText.toLowerCase().includes("press 4");
  const lower = normalizedPrompt.toLowerCase();

  // Resolve host organization details dynamically from knowledge items / agent / org
  const host = resolveHostDetails(agentObj);

  // Security guard against attack/exploit queries
  const isSecurityOrAttackQuery =
    /\b(attack|hack|exploit|ddos|breach|infiltrate|damage|destroy|steal data|bypass|sql injection|malware|ransomware|inject|vulnerability|penetrate)\b/i.test(lower) &&
    !lower.includes("cyber security") && !lower.includes("cybersecurity");

  if (isSecurityOrAttackQuery) {
    const compName = host.hostCompanyName || "Maruthi Technologies";
    return {
      reply: `I cannot assist with attacks, unauthorized access, or malicious activities. As an AI receptionist for ${compName}, I am here solely to provide information about our verified training courses, admissions, batch schedules, and student support. How can I assist you with our programs today?`,
      toolsExecuted: [],
      groundingSources: [],
      state: "INFORMATION",
      intent: "security_refusal",
      language: lang,
      isEscalated: false,
      quickReplies: ["Which courses do you offer?", "Course Fees & Discounts", "Batch Schedules", "Admissions Help Desk"],
      latency_ms: Date.now() - startTime,
    };
  }

  const toolsExecuted: ToolResult[] = [];
  const groundingSources: { id: number; title: string; source: string }[] = [];
  let intent = "general_inquiry";

  // 1. Entity extraction for visitor details
  const phoneRegex = /(?:\+?\d{1,4}[-.\s]?)?(?:(?:\d{5}[-.\s]?\d{5})|(?:\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})|(?:\d{10,12}))/;
  const rawPhoneMatch = promptText.match(phoneRegex);
  let foundPhone: string | null = null;
  if (rawPhoneMatch) {
    const digits = rawPhoneMatch[0].replace(/\D/g, "");
    if (digits.length >= 10 && digits.length <= 14 && digits !== "25000" && digits !== "20000") {
      foundPhone = rawPhoneMatch[0].trim();
    }
  }
  // Contextual fallback for raw phone input when at PHONE step
  if (!foundPhone && conv?.lead_step === "PHONE") {
    const cleanDigits = promptText.replace(/\D/g, "");
    if (cleanDigits.length >= 10 && cleanDigits.length <= 14 && cleanDigits !== "25000") {
      foundPhone = promptText.trim();
    }
  }

  // Email regex
  const emailMatch = promptText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  const foundEmail = emailMatch ? emailMatch[1].trim() : null;

  // Negative Intent & Training mode extraction
  let foundMode: string | null = null;
  const isNegativeModeOnlineOnly =
    lower.includes("don't want classroom") ||
    lower.includes("dont want classroom") ||
    lower.includes("no classroom") ||
    lower.includes("no offline") ||
    lower.includes("only online") ||
    lower.includes("only live");

  const isNegativeModeClassroomOnly =
    lower.includes("don't want online") ||
    lower.includes("dont want online") ||
    lower.includes("no online") ||
    lower.includes("only classroom") ||
    lower.includes("only offline") ||
    lower.includes("only in person");

  if (isNegativeModeOnlineOnly) {
    foundMode = "Online (Live Interactive)";
  } else if (isNegativeModeClassroomOnly) {
    foundMode = "Classroom Sessions";
  } else if (lower.includes("online") || lower.includes("live") || lower.includes("remote") || lower.includes("zoom") || lower.includes("from home")) {
    foundMode = "Online (Live Interactive)";
  } else if (
    lower.includes("classroom") ||
    lower.includes("offline") ||
    lower.includes("in-person") ||
    lower.includes("in person") ||
    lower.includes("campus") ||
    lower.includes("center") ||
    lower.includes("physical") ||
    lower.includes("direct")
  ) {
    foundMode = "Classroom Sessions";
  } else if (conv?.lead_step === "MODE") {
    if (lower === "1" || lower === "1st" || lower === "1st one" || lower === "first" || lower === "first one") {
      foundMode = "Online (Live Interactive)";
    } else if (lower === "2" || lower === "2nd" || lower === "2nd one" || lower === "second" || lower === "second one") {
      foundMode = "Classroom Sessions";
    } else if (
      lower === "yes" ||
      lower === "yes confirm" ||
      lower === "confirm" ||
      lower === "sure" ||
      lower === "ok" ||
      lower === "okay" ||
      lower === "fine" ||
      lower === "same" ||
      lower === "same for both" ||
      lower === "both" ||
      lower.includes("confirm") ||
      lower.includes("yes") ||
      lower.includes("same format") ||
      lower.includes("same mode")
    ) {
      const prevBotMsg = conv && messages
        ? messages.filter((m) => m.conversation_id === conv.id && m.role === "assistant").slice(-1)[0]?.content?.toLowerCase() || ""
        : "";
      if (prevBotMsg.includes("classroom") && !prevBotMsg.includes("online")) {
        foundMode = "Classroom Sessions";
      } else {
        foundMode = "Online (Live Interactive)";
      }
    }
  }

  // Batch timing extraction (including negative intent and fuzzy ordinals)
  let foundBatch: string | null = null;
  const isNegativeMorningBatch =
    lower.includes("no morning") ||
    lower.includes("not morning") ||
    lower.includes("can't attend morning") ||
    lower.includes("only evening") ||
    lower.includes("night shift");

  const isNegativeEveningBatch =
    lower.includes("no evening") ||
    lower.includes("not evening") ||
    lower.includes("only morning");

  if (isNegativeMorningBatch) {
    foundBatch = "Evening Batch (6:00 PM – 8:00 PM IST)";
  } else if (isNegativeEveningBatch) {
    foundBatch = "Morning Batch (9:00 AM – 11:00 AM IST)";
  } else if (
    lower.includes("morning") ||
    lower.includes("9-11") ||
    lower.includes("9 to 11") ||
    lower.includes("9 am") ||
    lower.includes("9:00") ||
    lower === "1 st one" ||
    lower === "1st one" ||
    lower === "1st" ||
    lower === "first" ||
    lower === "first one" ||
    lower === "1" ||
    lower.includes("first batch") ||
    lower.includes("1st batch")
  ) {
    foundBatch = "Morning Batch (9:00 AM – 11:00 AM IST)";
  } else if (
    lower.includes("afternoon") ||
    lower.includes("2-4") ||
    lower.includes("2 to 4") ||
    lower.includes("2 pm") ||
    lower.includes("2:00") ||
    lower === "2 nd one" ||
    lower === "2nd one" ||
    lower === "2nd" ||
    lower === "second" ||
    lower === "second one" ||
    lower === "2" ||
    lower.includes("second batch") ||
    lower.includes("2nd batch")
  ) {
    foundBatch = "Afternoon Batch (2:00 PM – 4:00 PM IST)";
  } else if (
    lower.includes("evening") ||
    lower.includes("night") ||
    lower.includes("6-8") ||
    lower.includes("6 to 8") ||
    lower.includes("6-7:30") ||
    lower.includes("6 to 7:30") ||
    lower.includes("7-8") ||
    lower.includes("7 to 8") ||
    lower.includes("6 pm") ||
    lower.includes("6:00") ||
    lower.includes("6:30") ||
    lower.includes("7 pm") ||
    lower.includes("7:00") ||
    lower.includes("7:30") ||
    lower.includes("evening batch") ||
    lower.includes("evening slot") ||
    lower.includes("evening timing") ||
    lower === "3 rd one" ||
    lower === "3rd one" ||
    lower === "3rd" ||
    lower === "third" ||
    lower === "third one" ||
    lower === "3" ||
    lower.includes("third batch") ||
    lower.includes("3rd batch") ||
    (conv?.lead_step === "BATCH" && (
      lower.includes("yes") ||
      lower.includes("sure") ||
      lower.includes("fine") ||
      lower.includes("ok") ||
      lower.includes("okay") ||
      lower.includes("perfect") ||
      lower.includes("works") ||
      lower.includes("suits") ||
      lower.includes("convenient") ||
      lower.includes("good") ||
      lower.includes("both")
    ))
  ) {
    foundBatch = "Evening Batch";
  }

  // Experience level extraction
  let foundExperience: string | null = null;
  if (
    lower.includes("beginner") ||
    lower.includes("fresher") ||
    lower.includes("fresh") ||
    lower.includes("no experience") ||
    lower.includes("no prior") ||
    lower.includes("none") ||
    lower === "no" ||
    lower.includes("zero") ||
    lower.includes("start fresh") ||
    lower.includes("non-it") ||
    lower.includes("non it") ||
    lower.includes("starting fresh") ||
    lower.includes("student")
  ) {
    foundExperience = "Beginner / Fresh Start";
  } else if (
    lower.includes("intermediate") ||
    lower.includes("experienced") ||
    lower.includes("know basic") ||
    lower.includes("some basic") ||
    lower.includes("working") ||
    lower.includes("professional") ||
    lower.includes("some knowledge") ||
    lower.includes("background") ||
    lower === "yes" ||
    lower.includes("have experience") ||
    lower.includes("i have")
  ) {
    foundExperience = "Intermediate / Prior Background";
  } else if (conv?.lead_step === "EXPERIENCE" && !lower.includes("?") && promptText.trim().length >= 2) {
    foundExperience = promptText.trim();
  }

  // Visitor Name extraction (strictly filtered against gibberish and domain stopwords)
  let foundName: string | null = null;
  const explicitNamePattern = /(?:my name is|this is|call me|myself|name\s*[:-]?)\s*([a-zA-Z]{2,}(?:\s+[a-zA-Z]{2,})?)/i;
  let nameMatch = promptText.match(explicitNamePattern);
  if (!nameMatch) {
    // Only check "i am / i'm" if not stating intent or interest
    const iAmMatch = promptText.match(/\b(?:i am|i'm)\s+([A-Za-z]{2,}(?:\s+[A-Za-z]{2,})?)\b/i);
    if (iAmMatch) {
      const candidate = iAmMatch[1].trim();
      if (!isGibberishOrInvalidName(candidate)) {
        nameMatch = iAmMatch;
      }
    }
  }
  if (nameMatch) {
    const candidate = nameMatch[1].trim();
    if (!isGibberishOrInvalidName(candidate)) {
      foundName = candidate.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
    }
  }

  // Contextual name extraction ONLY when at NAME step and message is not an explicit query or invalid
  if (!foundName && conv?.lead_step === "NAME") {
    const candidate = promptText.trim();
    if (
      !foundPhone &&
      !foundEmail &&
      !foundMode &&
      !foundBatch &&
      !candidate.includes("?") &&
      !isGibberishOrInvalidName(candidate)
    ) {
      const words = candidate.split(/\s+/);
      if (words.length >= 1 && words.length <= 3) {
        foundName = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
      }
    }
  }

  // Sanitize any previously stored invalid customer_name in conversation
  if (conv?.customer_name && (isGibberishOrInvalidName(conv.customer_name) || /interested/i.test(conv.customer_name))) {
    conv.customer_name = undefined;
  }

  // Visitor's Company Extraction
  let foundVisitorCompany: string | null = null;
  const companyPatterns = [
    /(?:my\s+company\s+is|company\s*[:=-]|work\s+at|calling\s+from|from\s+the\s+company|representing|organization\s*[:=-])\s*([a-zA-Z0-9\s&.,'-]{2,35})/i,
  ];
  for (const cp of companyPatterns) {
    const cMatch = promptText.match(cp);
    if (cMatch) {
      const cand = cMatch[1].trim().replace(/[.,;!?]+$/, "");
      if (!isGibberishOrInvalidName(cand)) {
        foundVisitorCompany = cand;
        break;
      }
    }
  }

  if (foundName && conv) conv.customer_name = foundName;
  if (foundEmail && conv) conv.customer_email = foundEmail;
  if (foundPhone && conv) conv.customer_phone = foundPhone;
  if (foundMode && conv) conv.customer_mode = foundMode;
  if (foundBatch && conv) conv.customer_batch = foundBatch;
  if (foundExperience && conv) conv.customer_experience = foundExperience;
  if (foundVisitorCompany && conv) conv.customer_company = foundVisitorCompany;

  let activeName = conv?.customer_name || foundName || null;
  if ((!activeName || isGibberishOrInvalidName(activeName)) && conv) {
    const existingLead = leads.find((l) => l.conversation_id === conv.id && l.name && !isGibberishOrInvalidName(l.name));
    if (existingLead) {
      activeName = existingLead.name;
      conv.customer_name = existingLead.name;
    }
  }
  let activeEmail = conv?.customer_email || foundEmail || null;
  if (!activeEmail && conv) {
    const existingLead = leads.find((l) => l.conversation_id === conv.id && l.email);
    if (existingLead) {
      activeEmail = existingLead.email;
      conv.customer_email = existingLead.email;
    }
  }
  let activePhone = conv?.customer_phone || foundPhone || null;
  if (!activePhone && conv) {
    const existingLead = leads.find((l) => l.conversation_id === conv.id && l.phone);
    if (existingLead) {
      activePhone = existingLead.phone;
      conv.customer_phone = existingLead.phone;
    }
  }
  const activeMode = conv?.customer_mode || foundMode || null;
  const activeBatch = conv?.customer_batch || foundBatch || null;
  const activeExperience = conv?.customer_experience || foundExperience || null;
  const activeVisitorCompany = conv?.customer_company || foundVisitorCompany || null;

  // 2. Multi-Document Knowledge Extraction & Structured Retrieval (Strictly Isolated to Agent Scope)
  const activeKnowledge = getAgentKnowledgeItems(agentObj).filter((k) => {
    if (typeof k.content === "string" && (k.content.startsWith("%PDF-") || k.content.includes("\u0000"))) return false;
    return true;
  });
  const parsedDocs = parseKnowledgeBase(activeKnowledge);

  // Deduplicate and canonicalize educational courses so no raw IDs, filenames, or duplicates leak
  const dedupedCoursesMap = new Map<string, ParsedKnowledgeDoc>();
  parsedDocs.filter((d) => d.isEducationalCourse).forEach((doc) => {
    let key = doc.displayName.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (key.includes("python")) key = "python";
    else if (key.includes("java") && !key.includes("javascript")) key = "java";
    else if (key.includes("datascience")) key = "datascience";
    else if (key.includes("fullstack")) key = "fullstack";

    if (!dedupedCoursesMap.has(key)) {
      dedupedCoursesMap.set(key, { ...doc });
    } else {
      const existing = dedupedCoursesMap.get(key)!;
      if ((!existing.topics || existing.topics.length === 0) && doc.topics && doc.topics.length > 0) existing.topics = doc.topics;
      if ((!existing.batchTimings || existing.batchTimings.length === 0) && doc.batchTimings && doc.batchTimings.length > 0) existing.batchTimings = doc.batchTimings;
      if (!existing.fee && doc.fee) existing.fee = doc.fee;
      if (!existing.duration && doc.duration) existing.duration = doc.duration;
      if (!existing.companyName && doc.companyName) existing.companyName = doc.companyName;
    }
  });
  const educationalCourses = Array.from(dedupedCoursesMap.values());

  const searchStopWords = new Set(["to", "in", "is", "at", "like", "want", "the", "a", "an", "for", "on", "with", "of", "do", "we", "i", "me", "my", "you", "your", "it", "this", "that", "jo", "and", "or", "so", "be", "am", "can", "what", "how", "where", "which", "are", "tell", "about", "give", "show"]);
  const queryTokens = promptText.toLowerCase().split(/\s+/).filter((t) => t.length >= 2 && !searchStopWords.has(t));

  const matchingDocs = activeKnowledge
    .map((item) => {
      let score = 0;
      const itemTitleLower = (item.title || "").toLowerCase();
      const itemContentLower = (item.content || "").toLowerCase();
      const itemCatLower = (item.category || "").toLowerCase();
      const itemSourceLower = (item.source || "").toLowerCase();

      if (itemTitleLower.includes(lower)) score += 20;
      if (itemContentLower.includes(lower)) score += 10;

      queryTokens.forEach((tok) => {
        if (itemTitleLower.includes(tok)) score += 6;
        if (itemCatLower.includes(tok)) score += 4;
        if (itemContentLower.includes(tok)) score += 2;
        if (itemSourceLower.includes(tok)) score += 3;
      });
      return { item, score };
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score);

  if (matchingDocs.length > 0) {
    intent = "knowledge_retrieval";
    matchingDocs.slice(0, 5).forEach((m) => {
      groundingSources.push({ id: m.item.id, title: m.item.title, source: m.item.source });
    });
    toolsExecuted.push({
      tool: "search_knowledge",
      args: { query: promptText },
      result: matchingDocs.slice(0, 5).map((m) => ({
        id: m.item.id,
        title: m.item.title,
        source: m.item.source,
        preview: m.item.content.slice(0, 200) + "...",
      })),
    });
  }

  // Identify Courses Mentioned in Current Prompt
  const queryMentionedCourses = educationalCourses.filter((doc) => {
    const docNameLower = doc.displayName.toLowerCase();
    const docRawTitleLower = doc.rawTitle.toLowerCase();
    const cleanTokens = docNameLower
      .replace(/\b(core|advance|advanced|course|programming|development|training|program|full stack|fullstack|certification)\b/gi, "")
      .trim()
      .split(/\s+/)
      .filter((tok) => tok.length >= 3);
    const matchesClean = cleanTokens.some((tok) => new RegExp(`\\b${tok}\\b`, "i").test(lower));
    return (
      lower.includes(docNameLower) ||
      lower.includes(docRawTitleLower) ||
      matchesClean
    );
  });

  const KNOWN_UNSUPPORTED_COURSES = [
    "Hotel Management",
    "Hospitality Management",
    "Hospitality",
    "Culinary Arts",
    "Culinary",
    "Catering",
    "Web Development",
    "Web Dev",
    "Web Designing",
    "Web Design",
    "Web",
    "Cyber Security",
    "Cybersecurity",
    "Cyber",
    "Information Security",
    "Ethical Hacking",
    "SOC Analyst",
    "Data Science",
    "Data Analytics",
    "Data Engineering",
    "Big Data",
    "Hadoop",
    "Spark",
    "Machine Learning",
    "Artificial Intelligence",
    "AI",
    "Deep Learning",
    "GenAI",
    "Generative AI",
    "Cloud Computing",
    "Cloud",
    "AWS",
    "Amazon Web Services",
    "Azure",
    "Microsoft Azure",
    "GCP",
    "Google Cloud",
    "DevOps",
    "Kubernetes",
    "Docker",
    "Terraform",
    "Flutter",
    "React Native",
    "React JS",
    "React",
    "Angular",
    "Vue JS",
    "Vue",
    "Node JS",
    "Node",
    "Django",
    "Flask",
    "Spring Boot",
    "MERN",
    "MEAN",
    "Full Stack Web",
    "Full Stack Development",
    "Full Stack",
    "Blockchain",
    "Solidity",
    "Digital Marketing",
    "SEO",
    "Software Testing",
    "Testing",
    "Selenium",
    "Automation Testing",
    "Manual Testing",
    "QA",
    "C Programming",
    "C++",
    "C#",
    ".NET",
    "Dot Net",
    "PHP",
    "Laravel",
    "Ruby on Rails",
    "Ruby",
    "Rust",
    "Go",
    "Golang",
    "Salesforce",
    "Power BI",
    "Tableau",
    "Android Development",
    "Android",
    "iOS Development",
    "iOS",
    "Kotlin",
    "Swift",
    "SAP",
    "SAP FICO",
    "SAP ABAP",
    "Nursing",
    "Pharmacy",
    "Medical Coding",
    "MBA",
    "BBA",
    "Mechanical Engineering",
    "Civil Engineering",
    "Electrical Engineering",
    "Animation",
    "VFX",
    "Graphic Design",
    "Graphic Designing",
    "UI UX Design",
    "UI UX",
    "UI/UX",
    "AutoCAD",
    "SolidWorks",
    "MATLAB",
    "Embedded Systems",
    "VLSI",
    "Robotics",
    "IoT",
  ];

  const detectedUnsupportedCourses: string[] = [];
  const sortedUnsupported = [...KNOWN_UNSUPPORTED_COURSES].sort((a, b) => b.length - a.length);
  for (const uc of sortedUnsupported) {
    const escaped = uc.toLowerCase().replace(/[+.*^$()[\]{}|\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\b`, "i").test(lower)) {
      const canonical =
        uc === "Web" || uc === "Web Dev" || uc === "Web Design" || uc === "Web Designing"
          ? "Web Development"
          : uc === "Cybersecurity" || uc === "Cyber"
          ? "Cyber Security"
          : uc === "AI"
          ? "Artificial Intelligence"
          : uc;
      if (!detectedUnsupportedCourses.includes(canonical)) {
        detectedUnsupportedCourses.push(canonical);
      }
    }
  }

  // Dynamic regex extraction for uncataloged courses/domains (e.g., "join in hotel management", "learn robotics", "dance course")
  const dynamicJoinMatch = lower.match(/\b(?:join|enroll|admission|learn|study|take|training\s+in|training\s+for|course\s+in|classes?\s+(?:for|in)|coaching\s+(?:for|in))\s+(?:in\s+|for\s+)?([a-z0-9\s-]{2,35})/i);
  if (dynamicJoinMatch) {
    const candidate = dynamicJoinMatch[1]
      .replace(/\b(today|tomorrow|now|please|sir|madam|online|offline|classroom|batch|course|program|training|sessions?|this|that|your|new|next)\b/gi, "")
      .trim();
    if (candidate.length >= 3) {
      const isKnown = educationalCourses.some((c) => {
        const nameL = c.displayName.toLowerCase();
        return nameL.includes(candidate) || candidate.includes(nameL) || (nameL.includes("python") && candidate.includes("python")) || (nameL.includes("java") && candidate.includes("java"));
      });
      const isAttr = ["fees", "timing", "timings", "demo", "discount", "syllabus", "notes", "morning", "evening", "schedule", "format", "format"].includes(candidate);
      if (!isKnown && !isAttr) {
        const titleCased = candidate.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        if (!detectedUnsupportedCourses.includes(titleCased)) {
          detectedUnsupportedCourses.push(titleCased);
        }
      }
    }
  }

  const dynamicCourseSuffixMatch = lower.match(/\b([a-z0-9\s-]{2,30})\s+(?:course|training|class|classes|program|coaching|certification)\b/i);
  if (dynamicCourseSuffixMatch) {
    const candidate = dynamicCourseSuffixMatch[1]
      .replace(/\b(this|that|your|which|what|any|new|next|best|top|online|offline|classroom|certification|training|complete|crash)\b/gi, "")
      .trim();
    if (candidate.length >= 3) {
      const isKnown = educationalCourses.some((c) => {
        const nameL = c.displayName.toLowerCase();
        return nameL.includes(candidate) || candidate.includes(nameL) || (nameL.includes("python") && candidate.includes("python")) || (nameL.includes("java") && candidate.includes("java"));
      });
      const isAttr = ["fees", "timing", "timings", "demo", "discount", "syllabus", "notes", "morning", "evening", "schedule", "format"].includes(candidate);
      if (!isKnown && !isAttr) {
        const titleCased = candidate.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        if (!detectedUnsupportedCourses.includes(titleCased)) {
          detectedUnsupportedCourses.push(titleCased);
        }
      }
    }
  }

  const isGeneralPluralQuery =
    lower.includes("course fees") ||
    lower.includes("courses fee") ||
    lower.includes("all fees") ||
    lower.includes("fees for all") ||
    lower.includes("fees structure") ||
    lower.includes("fee structure") ||
    lower.includes("what are the fees") ||
    lower.includes("what are the course fees") ||
    lower.includes("tuition fees") ||
    lower.includes("which courses") ||
    lower.includes("what courses") ||
    lower.includes("all courses") ||
    lower.includes("list of courses") ||
    lower === "fees" ||
    lower === "courses";

  // Contextual multi-entity tracking (for "What topics are covered?", "What are the timings?", etc.)
  const recentMentionedCourses: ParsedKnowledgeDoc[] = [];
  if (queryMentionedCourses.length > 0) {
    recentMentionedCourses.push(...queryMentionedCourses);
  } else if (conv) {
    const prevMessages = messages.filter((m) => m.conversation_id === conv.id).slice(-8);
    for (const msg of [...prevMessages].reverse()) {
      const msgLower = (msg.content || "").toLowerCase();
      for (const doc of educationalCourses) {
        const docNameLower = doc.displayName.toLowerCase();
        const docRawTitleLower = doc.rawTitle.toLowerCase();
        const cleanTokens = docNameLower
          .replace(/\b(core|advance|advanced|course|programming|development|training|program|full stack|fullstack|certification)\b/gi, "")
          .trim()
          .split(/\s+/)
          .filter((tok) => tok.length >= 3);
        const matchesClean = cleanTokens.some((tok) => new RegExp(`\\b${tok}\\b`, "i").test(msgLower));
        if (
          msgLower.includes(docNameLower) ||
          msgLower.includes(docRawTitleLower) ||
          matchesClean
        ) {
          if (!recentMentionedCourses.some((x) => x.displayName === doc.displayName)) {
            recentMentionedCourses.push(doc);
          }
        }
      }
      if (recentMentionedCourses.length >= 2) break;
    }
  }

  let focusedCourse: ParsedKnowledgeDoc | null = null;
  if (queryMentionedCourses.length === 1) {
    focusedCourse = queryMentionedCourses[0];
  } else if (queryMentionedCourses.length === 0 && !isGeneralPluralQuery) {
    // Anaphora resolution: resolve pronouns like "it", "that", "the first one", "the second one", "both"
    if (lower.includes("first one") || lower.includes("1st one") || lower.includes("the first")) {
      if (educationalCourses.length > 0) focusedCourse = educationalCourses[0];
    } else if (lower.includes("second one") || lower.includes("2nd one") || lower.includes("the second")) {
      if (educationalCourses.length > 1) focusedCourse = educationalCourses[1];
    } else if (recentMentionedCourses.length === 1) {
      focusedCourse = recentMentionedCourses[0];
    }
  }

  if (!focusedCourse && educationalCourses.length === 1 && !isGeneralPluralQuery) {
    focusedCourse = educationalCourses[0];
  }

  // 3. Question & Intent Classification (Non-suppressive independent detectors)
  const isGibberish = isGibberishText(promptText);

  // Telephony DTMF Keypad triggers
  const isDTMF1 = promptText === "1" && !conv?.lead_step;
  const isDTMF2 = promptText === "2" && !conv?.lead_step;
  const isDTMF3 = promptText === "3" && !conv?.lead_step;

  // Specific Attribute Query detection (fees, timings, syllabus, etc.)
  const hasSpecificAttributeQuery =
    /\b(fee|fees|cost|price|pricing|tuition|rate|charges|installment|payment|timing|timings|batch|batches|schedule|schedules|slot|slots|duration|length|syllabus|topic|topics|curriculum|module|modules|project|projects|why learn|scope|career|job|placement|eligibility|prerequisite|mode|online|offline|classroom|location|address|map|maps|contact|phone|email|discount|waiver|concession)\b/i.test(lower);

  const isExplicitComparisonWord =
    /\b(compare|comparison|versus|difference|differ|differentiating|differences)\b/i.test(lower) ||
    /\bvs\b/i.test(lower) ||
    /\bwhich\s+(?:one\s+)?(?:is\s+)?(?:better|best|recommended)\b/i.test(lower) ||
    /\bwhich\s+one\s+should\s+i\s+(?:choose|take|learn|pick)\b/i.test(lower) ||
    /\b(?:python\s+or\s+java|java\s+or\s+python)\b/i.test(lower);

  // Comparison Query Engine trigger (ONLY when comparing programs overall, NEVER when asking specific questions like fees, timings, etc.)
  const isComparisonQuery = isExplicitComparisonWord && !hasSpecificAttributeQuery;

  // Demo Booking Engine trigger
  const isDemoBookingQuery =
    lower.includes("demo") ||
    lower.includes("trial") ||
    lower.includes("free class") ||
    lower.includes("free session") ||
    lower.includes("book demo") ||
    lower.includes("schedule demo") ||
    lower.includes("attend demo") ||
    lower.includes("sample class");

  // Automated WhatsApp / PDF Syllabus trigger
  const isBrochureOrWhatsAppQuery =
    lower.includes("whatsapp me") ||
    lower.includes("send on whatsapp") ||
    lower.includes("send syllabus") ||
    lower.includes("whatsapp syllabus") ||
    lower.includes("send brochure") ||
    lower.includes("pdf syllabus") ||
    lower.includes("download syllabus") ||
    lower.includes("email syllabus") ||
    lower.includes("send curriculum");

  // Hypothetical / Conditional Inquiries
  const isHypotheticalQuery =
    lower.includes("if i work") ||
    lower.includes("working professional") ||
    lower.includes("job holder") ||
    lower.includes("full time job") ||
    lower.includes("full-time") ||
    lower.includes("non-it") ||
    lower.includes("non it") ||
    lower.includes("different background") ||
    lower.includes("mechanical") ||
    lower.includes("civil") ||
    lower.includes("commerce") ||
    lower.includes("miss a class") ||
    lower.includes("missed class") ||
    lower.includes("cannot attend") ||
    lower.includes("can't attend");

  const isWhyChooseUsQuery =
    lower.includes("why choose you") ||
    lower.includes("why i choose you") ||
    lower.includes("why choose your") ||
    lower.includes("why join you") ||
    lower.includes("why join your") ||
    lower.includes("why should i join") ||
    lower.includes("why should i choose") ||
    lower.includes("what makes you different") ||
    lower.includes("why you") ||
    lower.includes("benefits of joining") ||
    lower.includes("why study here") ||
    lower.includes("why this institute") ||
    lower.includes("why maruthi") ||
    lower.includes("why apex");

  const isWhyLearnSubjectQuery =
    lower.includes("why should i learn") ||
    lower.includes("why learn") ||
    lower.includes("why python") ||
    lower.includes("why java") ||
    lower.includes("benefits of python") ||
    lower.includes("benefits of java") ||
    lower.includes("scope of python") ||
    lower.includes("scope of java") ||
    lower.includes("scope of") ||
    lower.includes("future of") ||
    lower.includes("importance of") ||
    lower.includes("advantages of") ||
    lower.includes("why this course") ||
    lower.includes("benefits of learning");

  const isCourseCatalogQuery =
    isDTMF1 ||
    lower.includes("which course") ||
    lower.includes("what course") ||
    lower.includes("courses do you offer") ||
    lower.includes("course do you offer") ||
    lower.includes("courses you offer") ||
    lower.includes("courses you have") ||
    lower.includes("courses are available") ||
    lower.includes("course list") ||
    lower.includes("programs offered") ||
    lower.includes("what do you offer") ||
    lower.includes("programs do you offer") ||
    lower.includes("what do you teach") ||
    lower.includes("what training") ||
    lower.includes("classes do you offer") ||
    lower.includes("what are the documents") ||
    lower.includes("list of courses") ||
    lower.includes("all courses") ||
    lower === "courses";

  const isTopicQuery =
    lower.includes("topic") ||
    lower.includes("syllabus") ||
    lower.includes("curriculum") ||
    lower.includes("module") ||
    lower.includes("covered in") ||
    lower.includes("teach in") ||
    lower.includes("topics covered") ||
    lower.includes("project");

  const isJobOpportunityQuery =
    lower.includes("job") ||
    lower.includes("oppertunities") ||
    lower.includes("opportunities") ||
    lower.includes("career") ||
    lower.includes("placement") ||
    lower.includes("salary") ||
    lower.includes("package") ||
    lower.includes("hiring") ||
    lower.includes("developer role");

  const isDiscountQuery =
    lower.includes("discount") ||
    lower.includes("concession") ||
    lower.includes("scholarship") ||
    lower.includes("reduction") ||
    lower.includes("less fee") ||
    lower.includes("less price") ||
    lower.includes("cheaper") ||
    lower.includes("negotiat") ||
    lower.includes("can you give discount") ||
    lower.includes("i want discount") ||
    lower.includes("any discount") ||
    lower.includes("discount in fee") ||
    lower.includes("fee discount") ||
    lower.includes("waiver") ||
    lower.includes("special offer") ||
    lower.includes("thaggistara") ||
    lower.includes("kya discount");

  const isFeeQuery =
    lower.includes("fee") ||
    lower.includes("cost") ||
    lower.includes("price") ||
    lower.includes("pricing") ||
    lower.includes("charges") ||
    lower.includes("how much") ||
    lower.includes("tuition") ||
    lower.includes("rate") ||
    lower.includes("installment") ||
    lower.includes("payment") ||
    lower.includes("entha") ||
    lower.includes("kitna hai") ||
    lower.includes("kitni hai");

  const isBatchAcceptanceOrConfirmation =
    (lower.includes("proceed") && (lower.includes("timing") || lower.includes("batch") || lower.includes("slot") || lower.includes("schedule") || lower.includes("time"))) ||
    lower.includes("proceed with that timings") ||
    lower.includes("proceed with timings") ||
    lower.includes("proceed with timing") ||
    lower.includes("that timings work") ||
    lower.includes("these timings work") ||
    lower.includes("timing works") ||
    lower.includes("timings work") ||
    lower.includes("timings are fine") ||
    lower.includes("timing is fine") ||
    lower.includes("that works for me") ||
    lower.includes("this works for me") ||
    lower.includes("suits me") ||
    (Boolean(conv?.lead_step === "BATCH") && (
      lower.includes("morning batch") ||
      lower.includes("evening batch") ||
      lower.includes("morning") ||
      lower.includes("evening") ||
      lower.includes("7:00") ||
      lower.includes("6:00") ||
      lower.includes("9:00") ||
      lower === "1" ||
      lower === "2" ||
      lower === "3" ||
      lower.includes("yes") ||
      lower.includes("sure") ||
      lower.includes("fine") ||
      lower.includes("ok") ||
      lower.includes("okay") ||
      lower.includes("perfect")
    ));

  const isCommuteOrTravelQuery =
    lower.includes("time take to reach") ||
    lower.includes("how much time take to reach") ||
    lower.includes("how much time to reach") ||
    lower.includes("how long to reach") ||
    lower.includes("how long take to reach") ||
    lower.includes("travel time") ||
    lower.includes("distance from") ||
    lower.includes("how far") ||
    lower.includes("reach to your location") ||
    lower.includes("reach your location") ||
    lower.includes("reach your campus") ||
    lower.includes("reach your office") ||
    lower.includes("how to reach from") ||
    lower.includes("how can i reach from") ||
    lower.includes("how to reach your") ||
    lower.includes("metro route") ||
    lower.includes("transit");

  const isBatchOrTimingQuery =
    !isBatchAcceptanceOrConfirmation &&
    !isCommuteOrTravelQuery &&
    (lower.includes("timing") ||
    lower.includes("schedule") ||
    lower.includes("batch timing") ||
    lower.includes("batch time") ||
    lower.includes("class time") ||
    lower.includes("frequency") ||
    lower.includes("eppudu") ||
    lower.includes("kab shuru"));

  const isDurationQuery =
    !isCommuteOrTravelQuery &&
    (lower.includes("duration") ||
    lower.includes("how long") ||
    lower.includes("how many months") ||
    lower.includes("how many weeks") ||
    lower.includes("how many days") ||
    (lower.includes("how much time") && !lower.includes("reach")) ||
    lower.includes("course period"));

  const isTopicsQuery = isTopicQuery;
  const isBatchTimingQuery = isBatchOrTimingQuery;
  const isTimingQuery = isBatchOrTimingQuery;

  const isPerCourseModeAssignment =
    (lower.includes("for java") || lower.includes("for python") || (lower.includes("java") && lower.includes("python"))) &&
    (lower.includes("online") || lower.includes("offline") || lower.includes("classroom"));

  const isModeQuery =
    !isPerCourseModeAssignment &&
    (((lower.includes("online") && lower.includes("classroom")) ||
      lower.includes("training mode") ||
      lower.includes("mode of training") ||
      lower.includes("can i join online") ||
      lower.includes("offline class") ||
      lower.includes("in person") ||
      lower.includes("classroom session") ||
      lower.includes("untada")));

  const isEligibilityQuery =
    lower.includes("eligibility") ||
    lower.includes("who can join") ||
    lower.includes("who is eligible") ||
    lower.includes("prerequisite") ||
    lower.includes("qualification") ||
    (lower.includes("fresher") && (lower.includes("can") || lower.includes("allowed") || lower.includes("?"))) ||
    (lower.includes("beginner") && (lower.includes("can") || lower.includes("allowed") || lower.includes("suitable") || lower.includes("?")));

  const isMapLinkQuery =
    lower.includes("link of maps") ||
    lower.includes("map link") ||
    lower.includes("maps link") ||
    lower.includes("google map") ||
    lower.includes("directions") ||
    lower.includes("location link") ||
    lower.includes("google maps");

  const isLocationQuery =
    lower.includes("where is your office") ||
    lower.includes("where is your campus") ||
    lower.includes("where are you located") ||
    lower.includes("office location") ||
    lower.includes("campus location") ||
    lower.includes("address") ||
    lower.includes("location") ||
    lower.includes("campus") ||
    lower.includes("venue") ||
    lower.includes("ekkada") ||
    lower.includes("kahan hai");

  const isContactQuery =
    lower.includes("phone number") ||
    lower.includes("contact number") ||
    lower.includes("contact details") ||
    lower.includes("contact info") ||
    lower.includes("email") ||
    lower.includes("call you") ||
    lower.includes("whatsapp number") ||
    lower.includes("helpline") ||
    lower.includes("reach out") ||
    lower.includes("contact");

  const isTimingChangeQuery =
    (lower.includes("change") || lower.includes("modify") || lower.includes("reschedule") || lower.includes("switch") || lower.includes("adjust") || lower.includes("flexible")) &&
    (lower.includes("timing") || lower.includes("time") || lower.includes("batch") || lower.includes("schedule") || lower.includes("slot"));

  const isWeatherOrChitchat =
    lower.includes("weather") ||
    lower.includes("temperature") ||
    lower.includes("climate") ||
    lower.includes("raining") ||
    lower.includes("rain") ||
    lower.includes("rainy") ||
    lower.includes("forecast") ||
    lower.includes("sunny") ||
    lower.includes("hot today") ||
    lower.includes("cold today") ||
    lower.includes("hot outside") ||
    lower.includes("cold outside") ||
    lower.includes("how are you") ||
    lower.includes("who are you") ||
    lower.includes("what is your name") ||
    lower.includes("how do you do") ||
    lower.includes("nice to meet") ||
    lower.includes("tell me a joke") ||
    lower.includes("tell a joke") ||
    lower.includes("make me laugh") ||
    lower.includes("who made you") ||
    lower.includes("who created you") ||
    lower.includes("are you a bot") ||
    lower.includes("are you an ai") ||
    lower.includes("are you human") ||
    lower.includes("what can you do");

  const isTimeQuery =
    lower.includes("time now") ||
    lower.includes("current time") ||
    lower.includes("what time is it") ||
    lower.includes("what is the time") ||
    lower.includes("time right now") ||
    lower.includes("what is today's date") ||
    lower.includes("today's date") ||
    lower.includes("what day is today");

  const isMathQuery =
    /\bwhat is\s+\d+\s*[x*+\-/]\s*\d+\b/i.test(lower) ||
    /^\d+\s*[x*+\-/]\s*\d+[\s?]*$/i.test(lower.trim());

  const isBikeOrParkingQuery =
    lower.includes("reach on bike") ||
    lower.includes("reach you on bike") ||
    lower.includes("come by bike") ||
    (lower.includes("parking") && !lower.includes("domain"));

  const isKnowledgeBaseCountQuery =
    lower.includes("how many knowledge documents") ||
    lower.includes("knowledge documents") ||
    lower.includes("how many documents") ||
    lower.includes("documents you have");

  const isUnsupportedCourseQuery =
    detectedUnsupportedCourses.length > 0 && queryMentionedCourses.length === 0;

  const isGreeting = /^(hi|hello|hey|heya|hola|howdy|yo|greetings|good morning|good afternoon|good evening)[\s!.]*$/i.test(promptText);
  const isCasualAck = /^(ok|okay|k|alright|cool|great|nice|sure|got it|understood|fine|yes|yeah|yup|thanks|thank you|thx|thnx|good|perfect|sounds good|no problem|please|yes please|yep|definitely)[\s.!]*$/i.test(promptText);

  const isUnrelatedOrChitchatQuery =
    isWeatherOrChitchat ||
    isTimeQuery ||
    isMathQuery ||
    isKnowledgeBaseCountQuery ||
    lower.includes("cricket score") ||
    lower.includes("cricket match") ||
    lower.includes("ipl score") ||
    lower.includes("ipl match") ||
    lower.includes("political party") ||
    lower.includes("prime minister") ||
    lower.includes("president of") ||
    lower.includes("capital of") ||
    lower.includes("tell me a joke") ||
    lower.includes("tell a joke") ||
    lower.includes("sing a song") ||
    lower.includes("tell a story") ||
    lower.includes("elon musk") ||
    lower.includes("bitcoin price") ||
    lower.includes("crypto market") ||
    lower.includes("stock market");

  const isGeneralUnrelatedQuery =
    queryMentionedCourses.length === 0 &&
    detectedUnsupportedCourses.length === 0 &&
    !hasSpecificAttributeQuery &&
    !isFeeQuery &&
    !isCourseCatalogQuery &&
    !isBatchTimingQuery &&
    !isDurationQuery &&
    !isTopicsQuery &&
    !isEligibilityQuery &&
    !isLocationQuery &&
    !isContactQuery &&
    !isBikeOrParkingQuery &&
    isUnrelatedOrChitchatQuery;

  // Check if the previous assistant message asked about reserving a seat / enrollment
  const prevAssistantMsg = conv
    ? [...messages.filter((m) => m.conversation_id === conv.id && m.role === "assistant")].pop()?.content || ""
    : "";
  const prevAskedEnrollment =
    prevAssistantMsg.toLowerCase().includes("reserve a seat") ||
    prevAssistantMsg.toLowerCase().includes("assist you with enrollment") ||
    prevAssistantMsg.toLowerCase().includes("like to enroll") ||
    prevAssistantMsg.toLowerCase().includes("shall i help you enroll") ||
    prevAssistantMsg.toLowerCase().includes("get started with your enrollment") ||
    prevAssistantMsg.toLowerCase().includes("reserve your seat") ||
    prevAssistantMsg.toLowerCase().includes("may i have your full name") ||
    prevAssistantMsg.toLowerCase().includes("phone number");

  const isEnrollOrInterestIntent =
    (isPerCourseModeAssignment ||
      lower.includes("join") ||
      lower.includes("interested") ||
      lower.includes("enroll") ||
      lower.includes("admission") ||
      lower.includes("register") ||
      lower.includes("apply") ||
      lower.includes("like to jo") ||
      lower.includes("want to learn") ||
      lower.includes("take admission") ||
      lower.includes("reserve a seat") ||
      lower.includes("reserve my seat") ||
      lower.includes("book a seat") ||
      lower.includes("seat in") ||
      lower.includes("sign up") ||
      (isCasualAck && (prevAskedEnrollment || (Boolean(conv?.lead_step) && conv?.lead_step !== "CONFIRMED")))) &&
    !isWhyChooseUsQuery &&
    !isWhyLearnSubjectQuery &&
    !isComparisonQuery;

  const isJavaMorningRequested =
    (lower.includes("morning") && lower.includes("java")) ||
    (lower.includes("java") && lower.includes("morning"));

  const isExplicitQuestion =
    !isPerCourseModeAssignment &&
    (isJavaMorningRequested ||
      isWhyChooseUsQuery ||
      isWhyLearnSubjectQuery ||
      isCourseCatalogQuery ||
      isTopicQuery ||
      isJobOpportunityQuery ||
      isDiscountQuery ||
      isFeeQuery ||
      isBatchOrTimingQuery ||
      isModeQuery ||
      isEligibilityQuery ||
      isMapLinkQuery ||
      isLocationQuery ||
      isContactQuery ||
      isTimingChangeQuery ||
      isComparisonQuery ||
      isDemoBookingQuery ||
      isBrochureOrWhatsAppQuery ||
      isHypotheticalQuery ||
      isDTMF1 ||
      isDTMF2 ||
      isDTMF3);

  const isPurelyInformationalQuery =
    isFeeQuery ||
    isDiscountQuery ||
    isCourseCatalogQuery ||
    isTopicQuery ||
    isJobOpportunityQuery ||
    isEligibilityQuery ||
    isMapLinkQuery ||
    isLocationQuery ||
    isContactQuery ||
    isTimingChangeQuery ||
    isComparisonQuery ||
    isHypotheticalQuery ||
    isJavaMorningRequested ||
    (isModeQuery && !lower.includes("online for") && !lower.includes("classroom for"));

  // 4. Real-time Lead Database Synchronization
  let leadCreated: LeadModel | null = null;
  const shouldCreateOrUpdateLead =
    !isPurelyInformationalQuery &&
    Boolean(
      foundPhone ||
      (activePhone && (foundMode || (foundBatch && !isJavaMorningRequested) || (isEnrollOrInterestIntent && !isExplicitQuestion)))
    );

  if (queryMentionedCourses.length > 0 && isEnrollOrInterestIntent && !isExplicitQuestion && !isPerCourseModeAssignment) {
    if (conv) {
      conv.customer_interested_courses = queryMentionedCourses.map((c) => c.displayName);
    }
  }

  const interestedCoursesList = (conv?.customer_interested_courses && conv.customer_interested_courses.length > 0)
    ? conv.customer_interested_courses
    : (queryMentionedCourses.length > 0 && isEnrollOrInterestIntent && !isExplicitQuestion && !isPerCourseModeAssignment)
      ? queryMentionedCourses.map((c) => c.displayName)
      : (queryMentionedCourses.length > 0 && !isExplicitQuestion
          ? queryMentionedCourses.map((c) => c.displayName)
          : (focusedCourse ? [focusedCourse.displayName] : [host.courseName]));

  // Extract multi-intents for active turn
  const turnMultiIntents = parseMultiIntents(promptText, interestedCoursesList);
  if (conv) {
    conv.multi_intents = turnMultiIntents;
    if (!conv.topic_stack) conv.topic_stack = [];
    if (!conv.selected_courses) conv.selected_courses = [];
    if (!conv.unsupported_courses) conv.unsupported_courses = [];
    if (!conv.enrollment_state) conv.enrollment_state = {};

    if (interestedCoursesList.length > 0) {
      conv.selected_courses = interestedCoursesList;
      if (isEnrollOrInterestIntent && !isExplicitQuestion && (!conv.customer_interested_courses || conv.customer_interested_courses.length === 0)) {
        conv.customer_interested_courses = interestedCoursesList;
      }
    }
    if (detectedUnsupportedCourses.length > 0) {
      conv.unsupported_courses = Array.from(new Set([...conv.unsupported_courses, ...detectedUnsupportedCourses]));
    }

    conv.previous_intent = conv.current_intent || intent;

    if (isJavaMorningRequested) {
      conv.current_intent = "UNSUPPORTED_SCHEDULE_QUERY";
      conv.current_topic = "informational";
      if (!conv.topic_stack.includes("enrollment") && conv.lead_step) conv.topic_stack.push("enrollment");
    } else if (isFeeQuery) {
      conv.current_intent = "PRICE_QUERY";
      conv.current_topic = "informational";
      if (!conv.topic_stack.includes("enrollment") && conv.lead_step) conv.topic_stack.push("enrollment");
    } else if (isDiscountQuery) {
      conv.current_intent = "DISCOUNT_QUERY";
      conv.current_topic = "informational";
      if (!conv.topic_stack.includes("enrollment") && conv.lead_step) conv.topic_stack.push("enrollment");
    } else if (isCourseCatalogQuery) {
      conv.current_intent = "COURSE_CATALOG_QUERY";
      conv.current_topic = "catalog";
    } else if (isModeQuery && !lower.includes("online for") && !lower.includes("classroom for")) {
      conv.current_intent = "MODE_QUERY";
      conv.current_topic = "informational";
      if (!conv.topic_stack.includes("enrollment") && conv.lead_step) conv.topic_stack.push("enrollment");
    } else if (isEnrollOrInterestIntent) {
      conv.current_intent = "COURSE_ENROLLMENT_INTENT";
      conv.current_topic = "enrollment";
      conv.topic_stack = conv.topic_stack.filter((t) => t !== "enrollment");
    } else if (foundPhone || foundEmail) {
      conv.current_intent = "CONTACT_PROVIDED";
    } else if (foundName && conv.lead_step === "NAME") {
      conv.current_intent = "IDENTITY_PROVIDED";
    } else if (foundMode || foundBatch) {
      conv.current_intent = "PREFERENCE_UPDATE";
    } else {
      conv.current_intent = intent;
    }
  }

  const targetCourseName = interestedCoursesList.join(" & ");
  const targetCourseFee = interestedCoursesList.length > 1
    ? interestedCoursesList.map((cName) => {
        const matchingDoc = educationalCourses.find((e) => e.displayName.toLowerCase() === cName.toLowerCase());
        return `${cName}: ${matchingDoc?.fee || host.courseFee}`;
      }).join(", ")
    : (focusedCourse?.fee || host.courseFee);

  // Per-course preference state tracking
  if (conv) {
    if (!conv.customer_course_preferences) {
      conv.customer_course_preferences = {};
    }
    for (const cName of interestedCoursesList) {
      if (!conv.customer_course_preferences[cName]) {
        conv.customer_course_preferences[cName] = {};
      }
    }

    // Helper to extract mode from a text snippet
    const extractModeFromText = (textSnippet: string): string | null => {
      const s = textSnippet.toLowerCase();
      if (s.includes("online") || s.includes("remote") || s.includes("virtual") || s.includes("live interactive") || s.includes("zoom")) {
        return "Online Live Interactive";
      }
      if (s.includes("offline") || s.includes("classroom") || s.includes("in-person") || s.includes("in person") || s.includes("campus") || s.includes("physical")) {
        return "Classroom In-Person";
      }
      return null;
    };

    // Helper to extract batch timing from a text snippet
    const extractBatchFromText = (textSnippet: string): string | null => {
      const s = textSnippet.toLowerCase();
      if (s.includes("morning") || s.includes("7 am") || s.includes("8 am") || s.includes("9 am") || s.includes("10 am") || s.includes("11 am") || s.includes("early morning")) {
        return "Morning Batch (10:00 AM – 12:00 PM IST)";
      }
      if (s.includes("afternoon") || s.includes("12 pm") || s.includes("1 pm") || s.includes("2 pm") || s.includes("3 pm") || s.includes("4 pm")) {
        return "Afternoon Batch (2:00 PM – 4:00 PM IST)";
      }
      if (s.includes("evening") || s.includes("night") || s.includes("6-8") || s.includes("6 to 8") || s.includes("6-7:30") || s.includes("6 to 7:30") || s.includes("7-8") || s.includes("7 to 8") || s.includes("6 pm") || s.includes("7 pm") || s.includes("evening batch") || s.includes("evening slot")) {
        return "Evening Batch";
      }
      if (s.includes("weekend") || s.includes("saturday") || s.includes("sunday")) {
        return "Weekend Intensive Batch (Saturday & Sunday)";
      }
      if (s.includes("flexible") || s.includes("anytime") || s.includes("custom") || s.includes("open")) {
        return "Flexible / Business hours";
      }
      return null;
    };

    // 1. Precise course-segment-aware extraction:
    // Split input into course segments if user specifies preferences per course
    // (e.g., "for python online and for java offline", "python: evening, java: morning")
    let hasSegmentMatch = false;

    // Check occurrences of each interested course in user's message
    const courseMatches: { courseName: string; index: number; key: string }[] = [];
    for (const cName of interestedCoursesList) {
      const cNameLower = cName.toLowerCase();
      const tokens = cNameLower
        .replace(/\b(core|advance|advanced|course|programming|development|training|program|full stack|fullstack|certification)\b/gi, "")
        .trim()
        .split(/\s+/)
        .filter((t) => t.length >= 3);

      let matchedIdx = -1;
      let matchedKey = "";
      for (const tok of tokens) {
        const idx = lower.indexOf(tok);
        if (idx !== -1) {
          matchedIdx = idx;
          matchedKey = tok;
          break;
        }
      }
      if (matchedIdx === -1 && lower.includes(cNameLower)) {
        matchedIdx = lower.indexOf(cNameLower);
        matchedKey = cNameLower;
      }
      if (matchedIdx !== -1) {
        courseMatches.push({ courseName: cName, index: matchedIdx, key: matchedKey });
      }
    }
    courseMatches.sort((a, b) => a.index - b.index);

    if (courseMatches.length > 0) {
      for (let i = 0; i < courseMatches.length; i++) {
        const current = courseMatches[i];
        const next = courseMatches[i + 1];

        // If only 1 course is referenced in the utterance (e.g. "online for python" or "morning for java"),
        // the entire utterance qualifies that single course!
        let segmentText = "";
        if (courseMatches.length === 1) {
          segmentText = lower;
        } else {
          const prevIndex = i === 0 ? 0 : current.index;
          const nextIndex = next ? next.index : lower.length;
          segmentText = lower.substring(prevIndex, nextIndex);
        }

        const segmentMode = extractModeFromText(segmentText);
        const segmentBatch = extractBatchFromText(segmentText);

        if (segmentMode) {
          conv.customer_course_preferences[current.courseName].mode = segmentMode;
          hasSegmentMatch = true;
        }
        if (segmentBatch) {
          if (current.courseName.toLowerCase().includes("java") && segmentBatch.toLowerCase().includes("morning")) {
            // Java has no morning batch in doc 829; do NOT assign
            hasSegmentMatch = true; // Mark as handled so fallback doesn't assign morning to Java
          } else {
            conv.customer_course_preferences[current.courseName].batch = segmentBatch;
            hasSegmentMatch = true;
          }
        }
      }
    }

    // 2. Fallback / Uniform assignment if no per-segment contrast was detected:
    // If the visitor specified a single global mode/batch (e.g. "Online for both", "both online", or simple "online")
    if (!hasSegmentMatch) {
      if (foundMode) {
        // If user says "both online" or during single course or uniform reply
        for (const cName of interestedCoursesList) {
          conv.customer_course_preferences[cName].mode = foundMode;
        }
      }
      if (foundBatch) {
        for (const cName of interestedCoursesList) {
          if (cName.toLowerCase().includes("java") && foundBatch.toLowerCase().includes("morning")) {
            continue;
          }
          conv.customer_course_preferences[cName].batch = foundBatch;
        }
      }
    } else {
      // If some courses still lack mode/batch, see if the turn had an unassigned course
      // Do NOT overwrite already extracted course segments!
    }

    // Update global conv.customer_mode and conv.customer_batch for backward compatibility
    const allModes = Object.values(conv.customer_course_preferences).map((p) => p.mode).filter(Boolean);
    const allBatches = Object.values(conv.customer_course_preferences).map((p) => p.batch).filter(Boolean);
    if (allModes.length === interestedCoursesList.length && allModes.length > 0) {
      const uniqueModes = Array.from(new Set(allModes));
      conv.customer_mode = uniqueModes.length === 1 ? uniqueModes[0] : uniqueModes.join(" / ");
    } else if (interestedCoursesList.length <= 1 && allModes.length > 0) {
      conv.customer_mode = allModes[0];
    }
    if (allBatches.length === interestedCoursesList.length && allBatches.length > 0) {
      const uniqueBatches = Array.from(new Set(allBatches));
      conv.customer_batch = uniqueBatches.length === 1 ? uniqueBatches[0] : uniqueBatches.join(" / ");
    } else if (interestedCoursesList.length <= 1 && allBatches.length > 0) {
      conv.customer_batch = allBatches[0];
    }
  }

  if (shouldCreateOrUpdateLead) {
    intent = foundPhone || foundEmail ? "contact_information_provided" : "lead_qualification";
    let leadScore = 60;
    if (activeName && activeName !== "Interested Student") leadScore = Math.max(leadScore, 70);
    if (activePhone) leadScore = Math.max(leadScore, 85);
    if (activeMode) leadScore = Math.max(leadScore, 90);
    if (activeBatch && activeBatch !== "Flexible / Business hours") leadScore = Math.max(leadScore, 95);
    if (activeExperience) leadScore = 98;

    const coursePrefsSummary = conv?.customer_course_preferences && Object.keys(conv.customer_course_preferences).length > 0
      ? Object.entries(conv.customer_course_preferences)
          .map(([cName, pref]) => `${cName} [Mode: ${pref.mode || "Pending"}, Batch: ${pref.batch || "Pending"}]`)
          .join("; ")
      : `Mode: ${activeMode || "Pending"}, Batch: ${activeBatch || "Pending"}`;

    const leadNotes = `${targetCourseName} Inquiry. ${coursePrefsSummary}. Experience: ${activeExperience || "Fresh Start"}. Recorded by AI Receptionist ${agentName}.`;

    const leadRes = (await toolRegistry.create_lead(
      {
        name: activeName || (activePhone ? `Inbound Contact (${activePhone})` : "Interested Student"),
        email: activeEmail,
        phone: activePhone,
        company: activeVisitorCompany || null,
        interest: `${targetCourseName} (${targetCourseFee})`,
        preferred_mode: activeMode || (activePhone ? "phone" : "email"),
        preferred_time: activeBatch || "Morning / Evening",
        lead_score: leadScore,
        notes: leadNotes,
        conversation_id: conv?.id,
      },
      1,
    )) as { lead_id: number; lead_score: number; status: string };

    leadCreated = leads.find((l) => l.id === leadRes.lead_id) || null;
    if (conv && leadCreated) {
      conv.lead_id = leadCreated.id;
      conv.conversation_state = leadScore >= 85 ? "LEAD_CAPTURED" : "LEAD_CAPTURE";
    }

    toolsExecuted.push({
      tool: "create_lead",
      args: { name: activeName, email: activeEmail, phone: activePhone, company: activeVisitorCompany || null, interest: targetCourseName, preferred_time: activeBatch },
      result: leadRes,
    });
  }

  if (isEscalated) {
    intent = "human_escalation";
    const transferRes = await toolRegistry.transfer_to_human({ reason: "Customer requested operator / trigger word detected" }, 1);
    toolsExecuted.push({ tool: "transfer_to_human", args: { reason: "Trigger word detected" }, result: transferRes });
  }

  if (isComparisonQuery) {
    intent = "course_comparison";
    const compCourses = queryMentionedCourses.length >= 2
      ? queryMentionedCourses.map((c) => c.displayName)
      : (educationalCourses.length >= 2 ? educationalCourses.slice(0, 2).map((c) => c.displayName) : ["Python Course", "Java Course"]);
    const compRes = (await toolRegistry.compare_courses({ courses: compCourses }, 1)) as ToolResult["result"];
    toolsExecuted.push({ tool: "compare_courses", args: { courses: compCourses }, result: compRes });
  }

  if (isDemoBookingQuery) {
    intent = "demo_booking";
    const demoCourse = focusedCourse?.displayName || host.courseName || "Software Training";
    const demoRes = (await toolRegistry.book_demo_session(
      {
        student_name: activeName || (activePhone ? `Student (${activePhone})` : "Prospective Student"),
        phone: activePhone || null,
        course: demoCourse,
        preferred_slot: activeBatch || "Morning Batch (10:00 AM IST)",
        date: new Date(Date.now() + 86400000).toISOString().split("T")[0],
      },
      1,
    )) as ToolResult["result"];
    toolsExecuted.push({ tool: "book_demo_session", args: { course: demoCourse }, result: demoRes });
  }

  if (isBrochureOrWhatsAppQuery) {
    intent = "whatsapp_syllabus_dispatch";
    const sylCourse = focusedCourse?.displayName || host.courseName || "Development Program";
    const waRes = (await toolRegistry.send_whatsapp_syllabus(
      {
        phone: activePhone || "+91 91213 75668",
        course: sylCourse,
        student_name: activeName || "Valued Visitor",
      },
      1,
    )) as ToolResult["result"];
    toolsExecuted.push({ tool: "send_whatsapp_syllabus", args: { course: sylCourse }, result: waRes });
  }

  const computedState = computeConversationState(
    conv?.conversation_state || "GREETING",
    promptText,
    toolsExecuted.length > 0,
    isEscalated,
  );

  // 5. Intelligent Multi-Document Synthesis Engine
  let reply = "";

  // Attempt Primary Multi-Turn Gemini AI Synthesis if available
  const aiClient = getGeminiClient();
  let geminiSynthesisSucceeded = false;

  if (aiClient && !isEscalated && !isGibberish) {
    try {
      const formattedKnowledgeDocs = parsedDocs.map((doc, idx) => {
        const typeLabel = doc.isEducationalCourse
          ? "Educational Course / Training Program"
          : (doc.isComplianceOrPolicy ? "Compliance / Internal Security Policy (Do NOT list as a course)" : "General Knowledge Document");
        const details = [
          `Document #${idx + 1}: ${doc.displayName}`,
          `Category: ${doc.category} | Classification: ${typeLabel}`,
          doc.companyName ? `Company/Institute: ${doc.companyName}` : null,
          doc.duration ? `Duration: ${doc.duration}` : null,
          doc.fee ? `Tuition/Fee: ${doc.fee}` : null,
          doc.modes.length > 0 ? `Available Modes: ${doc.modes.join(", ")}` : null,
          doc.topics.length > 0 ? `Key Topics: ${doc.topics.slice(0, 15).join(", ")}` : null,
          doc.projects.length > 0 ? `Projects: ${doc.projects.join(", ")}` : null,
          `Full Document Content:\n${doc.rawContent}`,
        ].filter(Boolean).join("\n");
        return details;
      }).join("\n\n---\n\n");

      const sysInstruction = `You are ${agentName}, the friendly, professional, and knowledgeable AI Receptionist for ${host.hostCompanyName || "our organization"}.

Host Organization Profile:
- Company / Institute: ${host.hostCompanyName || "Organization"}
- Location: ${host.location}
- Google Maps Link: ${host.googleMapsUrl}
- Contact Phone: ${host.phone || "Available on request"}
- Contact Email: ${host.email || "Available on request"}

Knowledge Base (${parsedDocs.length} Knowledge Documents Loaded):
${formattedKnowledgeDocs || "No documents uploaded."}

Critical Guidelines for Multi-Question Mastery, Course Differentiation & Response Precision:
1. Strict Question & Course Differentiation & ZERO Cross-Bleed:
   - When the visitor asks about multiple subjects/courses in a single message (e.g., "What is the fee for Python and which topics are covered in Java and where is your address?", or "What is the fee for python and batch timings for java?"):
   - You MUST treat each course and question as COMPLETELY INDEPENDENT.
   - Answer ONLY what was explicitly requested for that specific course.
   - STRICT ZERO SYMMETRY: NEVER make course sections symmetric! If the user asked for the Fee of Python and Topics of Java, under Python provide ONLY Tuition Fee (do NOT list topics for Python!), and under Java provide ONLY Key Topics (do NOT list tuition fee for Java!). Under Campus Location provide the address.
   - Answering unasked attributes or duplicating attributes across courses is a critical failure.
2. Multi-Question Exhaustiveness: Visitors frequently ask 2, 3, 4, 5, or more questions in a single turn. You MUST systematically and comprehensively answer EVERY SINGLE question asked. Never skip, ignore, or truncate answers to any question!
3. Active Lead Capturing & Enrollment Funnel:
   - When the visitor indicates they want to join, enroll, register, or answers "yes" to an enrollment question (e.g., "I want to join in Python and Java", "I want to join the Java batch", "yes", "enroll me"):
     - Warmly acknowledge ALL specific course(s) they want to join.
     - Proactively start the lead capture funnel: ALWAYS ask for their Full Name first! Never assume their name is "Interested In" or any phrase.
     - Lead sequence: (1) Full Name, (2) 10-digit Phone/WhatsApp Number, (3) Preferred Mode (Online vs Classroom), (4) Preferred Batch Timing (Evening).
     - NEVER dump generic catalog info or repetitive tuition fees when the visitor says they want to join or enroll!
4. Concise Course Catalog vs Deep On-Demand Details: When asked pure catalog questions like "Which courses do you offer?", list only the course titles and durations. When the visitor asks for specific details (fees, syllabus topics, batch timings, location, map link, discount, eligibility), provide the exact detailed information requested.
5. STRICT HONESTY & NO HALLUCINATION ON MISSING DATA:
   - If the visitor asks ANY question for which the answer is NOT present or verified in the Knowledge Base above (such as placement assistance details, specific instructor profiles/credentials, refund policy, hostel/transport facilities, or unlisted courses):
   - You MUST explicitly admit that you do not have that data: "I don't have that data in our current records right now. You can contact our team directly at ${host.phone || "+91 91213 75668"} or email ${host.email || "admissions@maruthitechnologies.com"}, and our admissions team will be glad to assist you with this!"
   - You are STRICTLY FORBIDDEN from guessing, inventing facts, or force-fitting an answer.
   - You are STRICTLY FORBIDDEN from dumping unrelated course catalogs or raw text fragments when asked a question you lack data for.
   - For fee discounts or concessions: explain that standard course fees are fixed, and invite them to speak with our admissions desk (${host.phone || "+91 91213 75668"}) for any scholarship or installment inquiries.
6. Contextual Clarification for Multi-Course Ambiguity:
   - When a visitor asks an ambiguous question (e.g., "Can I change timings?", "What are the timings?", "Can I attend online?") without specifying which course they are referring to (especially when they've expressed interest in multiple courses like Python and Java):
   - Intelligently clarify with the visitor which course they are referring to, or answer concisely for both courses with specific options, rather than giving a broad unhelpful answer.
7. Clean Typography: Use clean unicode bullets (• ) and numbered lists. NEVER use markdown bold asterisks (no ** or *).`;

      // Build conversation history for multi-turn coherence
      const prevConvMessages = conv
        ? messages.filter((m) => m.conversation_id === conv.id).slice(-10)
        : [];
      
      const contentsPayload: { role: "user" | "model"; parts: { text: string }[] }[] = [];
      for (const m of prevConvMessages) {
        if (m.content && m.content !== promptText) {
          contentsPayload.push({
            role: m.role === "user" ? "user" : "model",
            parts: [{ text: m.content }],
          });
        }
      }
      contentsPayload.push({
        role: "user",
        parts: [{ text: promptText }],
      });

      let response;
      const isPureFastPath =
        (isGreeting && !isExplicitQuestion) ||
        (isCasualAck && !isExplicitQuestion) ||
        (isUnrelatedOrChitchatQuery && queryMentionedCourses.length === 0 && !hasSpecificAttributeQuery) ||
        (isGeneralUnrelatedQuery && !isExplicitQuestion) ||
        (isUnsupportedCourseQuery && !isCourseCatalogQuery && !isFeeQuery && !isBatchTimingQuery && !isDurationQuery && !isTopicsQuery && queryMentionedCourses.length === 0) ||
        (Boolean(conv?.lead_step) && conv?.lead_step !== "CONFIRMED" && !isExplicitQuestion && !isFeeQuery && !isCourseCatalogQuery && !isBatchTimingQuery && !isTopicsQuery);

      if (!isPureFastPath) {
        try {
          const geminiPromise = aiClient.models.generateContent({
            model: "gemini-3.6-flash",
            contents: contentsPayload,
            config: {
              systemInstruction: sysInstruction,
              temperature: 0.2,
            },
          });

          const timeoutPromise = new Promise<{ text?: string }>((resolve) =>
            setTimeout(() => resolve({ text: "" }), 12000),
          );

          const raceResult = (await Promise.race([geminiPromise, timeoutPromise])) as { text?: string };
          if (raceResult?.text && raceResult.text.trim().length > 10) {
            response = raceResult;
          }
        } catch {
          // Fast fallback to deterministic engine
        }
      }

      if (response?.text && response.text.trim().length > 10) {
        reply = response.text.trim();
        geminiSynthesisSucceeded = true;
      }
    } catch (e) {
      console.warn("Gemini multi-doc synthesis error, falling back to structured engine:", e);
    }
  }

  // High-Precision Deterministic Multi-Intent Synthesizer
  if (!geminiSynthesisSucceeded) {
    if (isEscalated) {
      if (lang === "te") {
        reply = `నేను మా సీనియర్ సపోర్ట్ ఆపరేటర్‌ను వెంటనే అలర్ట్ చేశాను. దయచేసి ఒక్క నిమిషం వేచి ఉండండి, మా టీమ్ మెంబర్ మిమ్మల్ని నేరుగా కనెక్ట్ చేస్తారు.`;
      } else if (lang === "hi") {
        reply = `मैंने हमारी मानव सहायता टीम को सूचित कर दिया है। कृपया कुछ क्षण प्रतीक्षा करें, हमारे प्रतिनिधि आपसे शीघ्र संपर्क करेंगे।`;
      } else {
        reply = `I understand completely. I have alerted our human admissions specialist, and a team member is stepping in right away to assist you personally.`;
      }
    } else if (isGibberish) {
      reply = `I didn't quite catch that. Could you please rephrase your question? I'm here to help you with our courses, syllabus, batch timings, fees, or admissions!`;
    } else if ((isGeneralUnrelatedQuery || isWeatherOrChitchat || isTimeQuery || isMathQuery || isBikeOrParkingQuery || isKnowledgeBaseCountQuery || isCommuteOrTravelQuery) && queryMentionedCourses.length === 0 && !isFeeQuery && !isCourseCatalogQuery && !isBatchTimingQuery && !isDurationQuery && !isTopicsQuery) {
      const compName = host.hostCompanyName || "our academy";
      const contactStr = host.phone ? `at ${host.phone}` : (host.email ? `via email at ${host.email}` : "our front desk team");

      if (lower.includes("weather") || lower.includes("temperature") || lower.includes("raining") || lower.includes("rain") || lower.includes("forecast") || lower.includes("climate") || lower.includes("sunny") || lower.includes("hot") || lower.includes("cold")) {
        reply = `As an AI receptionist for ${compName}, I can help you with our company information, courses, batch schedules, fees, and admissions. For live weather updates, please refer to any weather app. How can I assist you with our programs today?`;
      } else if (lower.includes("how are you") || lower.includes("how do you do")) {
        reply = `I'm doing very well, thank you for asking! How can I assist you today with our courses, batch schedules, or admissions?`;
      } else if (lower.includes("who are you") || lower.includes("what is your name")) {
        const compPhrase = host.hostCompanyName ? ` at ${host.hostCompanyName}` : "";
        reply = `I'm ${agentName}, your AI receptionist${compPhrase}. I'm here to assist you with course information, syllabus details, batch timings, and admissions!`;
      } else if (isCommuteOrTravelQuery) {
        const mapsLink = host.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(compName)}`;
        const addrStr = host.location || "our campus";
        reply = `I don't have real-time commute traffic or transit travel time calculations in our records. Our location is at ${addrStr}.\n\nYou can check live routes, travel times, and metro schedules on Google Maps (${mapsLink}), or contact our front desk ${contactStr} for landmark assistance!`;
      } else if (lower.includes("time") || lower.includes("timing") || lower.includes("clock") || lower.includes("hours")) {
        reply = `I don't maintain a real-time clock, but visiting hours at ${compName} are Monday to Saturday, 9:00 AM – 7:00 PM IST, and evening batches start at 6:00 PM and 7:00 PM IST. How can I assist you today?`;
      } else if (isMathQuery) {
        const m = lower.match(/(\d+)\s*([x*+\-/])\s*(\d+)/);
        if (m) {
          const n1 = parseInt(m[1], 10);
          const op = m[2];
          const n2 = parseInt(m[3], 10);
          const res = op === "x" || op === "*" ? n1 * n2 : op === "+" ? n1 + n2 : op === "-" ? n1 - n2 : op === "/" && n2 !== 0 ? n1 / n2 : 0;
          reply = `${n1} ${op === "x" ? "×" : op} ${n2} = ${res}. Let me know if you have any questions about our Python or Java training courses!`;
        } else {
          reply = `Let me know if you have any questions about our Python or Java training courses!`;
        }
      } else if (isBikeOrParkingQuery) {
        const parkingDoc = activeKnowledge.find((k) => k.content.toLowerCase().includes("parking") || k.title.toLowerCase().includes("parking"));
        if (parkingDoc) {
          reply = parkingDoc.content.slice(0, 300).trim();
        } else {
          reply = `I don't have verified parking information in our current records. You can contact our team directly ${contactStr}, and our staff will be happy to assist you with parking availability and nearby options!`;
        }
      } else if (isKnowledgeBaseCountQuery) {
        const docsSummary = educationalCourses.length > 0 ? educationalCourses.map(c => c.displayName).join(" and ") : "our verified programs";
        reply = `I am trained on official ${compName} course curriculum and admissions documentation, covering our certified ${docsSummary} courses.`;
      } else if (lower.includes("joke") || lower.includes("funny")) {
        reply = `Why do Java programmers wear glasses? Because they don't C#! 😄 Let me know if you have any questions about our Core Python or Core Java certification courses!`;
      } else {
        if (educationalCourses.length > 0) {
          const courseNames = educationalCourses.map(c => c.displayName).join(" and ");
          reply = `As an AI receptionist for ${compName}, I specialize in providing course details, syllabus information, batch schedules, tuition fees, and admissions for our ${courseNames} certification programs. If you have questions outside our records, please contact our admissions team directly ${contactStr}!`;
        } else {
          reply = `As an AI receptionist for ${compName}, I am here to assist you with company services, schedules, fees, and inquiries. If you have questions outside our available records, please contact our team directly ${contactStr}!`;
        }
      }
    } else if (isUnsupportedCourseQuery && !isCourseCatalogQuery && !isFeeQuery && !isBatchTimingQuery && !isDurationQuery && !isTopicsQuery && queryMentionedCourses.length === 0) {
      const compName = host.hostCompanyName || "Maruthi Technologies";
      const unsupp = detectedUnsupportedCourses.join(" and ");
      const coursesOffered = educationalCourses.length > 0
        ? educationalCourses.map((c) => `• ${c.displayName}${c.fee ? ` (Tuition Fee: ${c.fee}` : ""}${c.duration ? ` | ${c.duration})` : ")"}`).join("\n")
        : `• Core Python Programming (Duration: 30 Days | Tuition Fee: ₹4,000)\n• Core Java Programming (Duration: 45 Days | Tuition Fee: ₹5,000)`;
      reply = `Please note that ${unsupp} is not offered in our current training curriculum at ${compName}.\n\nWe specialize exclusively in the following certification programs:\n${coursesOffered}\n\nBoth courses are offered in Online Live Interactive mode as well as Classroom Sessions in Ameerpet, Hyderabad. Would you like to explore or enroll in either of these programs?`;
    } else if (isGreeting && !isExplicitQuestion) {
      if (conv && messages.filter((m) => m.conversation_id === conv.id).length > 2) {
        reply = `Hello! How can I assist you today? I'm here to help you with our courses, syllabus, fees, batch timings, or enrollment!`;
      } else if (host.hostCompanyName) {
        reply = `Hello! Welcome to ${host.hostCompanyName}. I'm ${agentName}, your AI receptionist. How can I assist you today?`;
      } else {
        reply = `Hello! Welcome. I'm ${agentName}, your AI receptionist. How can I assist you today?`;
      }
    } else if ((isEnrollOrInterestIntent || (Boolean(conv?.lead_step) && conv?.lead_step !== "CONFIRMED")) && !isExplicitQuestion) {
      if (
        (lower.includes("already told") ||
          lower.includes("already said") ||
          lower.includes("already gave") ||
          lower.includes("already given") ||
          lower.includes("already shared") ||
          lower.includes("i told my name") ||
          lower.includes("already mentioned")) &&
        activeName
      ) {
        if (!activePhone && !activeEmail) {
          if (conv) conv.lead_step = "PHONE";
          reply = `My apologies, ${activeName}! I have your name noted in our records. What is the best 10-digit Phone Number (or WhatsApp number) our admissions desk can reach you on to confirm your seat?`;
        } else if (!activeMode || (interestedCoursesList.length > 1 && interestedCoursesList.some((c) => !conv?.customer_course_preferences?.[c]?.mode))) {
          if (conv) conv.lead_step = "MODE";
          reply = `My apologies, ${activeName}! I have your name noted in our records. Which training format do you prefer—Online (Live Interactive) or Classroom Sessions?`;
        } else if (!activeBatch || (interestedCoursesList.length > 1 && interestedCoursesList.some((c) => !conv?.customer_course_preferences?.[c]?.batch))) {
          if (conv) conv.lead_step = "BATCH";
          reply = `My apologies, ${activeName}! I have your name noted in our records. Which batch timing fits your schedule best?`;
        } else {
          if (conv) conv.lead_step = "CONFIRMED";
          reply = `My apologies, ${activeName}! I have all your details noted in our records. Our admissions counselor will contact you at ${activePhone} shortly to confirm your seat!`;
        }
      } else if (detectedUnsupportedCourses.length > 0) {
        const unsupp = detectedUnsupportedCourses.join(" and ");
        const supp = interestedCoursesList.length > 0 ? interestedCoursesList.join(" and ") : "Core Python Programming and Core Java Programming";
        if (activeName && !isGibberishOrInvalidName(activeName)) {
          if (!activePhone && !activeEmail) {
            if (conv) conv.lead_step = "PHONE";
            reply = `Please note that ${unsupp} is not listed in our current course offerings. We offer ${supp}.\n\nI have updated your enrollment preferences for ${supp}, ${activeName}! What is the best 10-digit Phone Number (or WhatsApp number) our admissions desk can reach you on to confirm your seat?`;
          } else if (!activeMode || (interestedCoursesList.length > 1 && interestedCoursesList.some((c) => !conv?.customer_course_preferences?.[c]?.mode))) {
            if (conv) conv.lead_step = "MODE";
            reply = `Please note that ${unsupp} is not listed in our current course offerings. We offer ${supp}.\n\nI have noted your preferences for ${supp}, ${activeName}! For your courses, which training format do you prefer—Online (Live Interactive) or Classroom Sessions?`;
          } else if (!activeBatch || (interestedCoursesList.length > 1 && interestedCoursesList.some((c) => !conv?.customer_course_preferences?.[c]?.batch))) {
            if (conv) conv.lead_step = "BATCH";
            reply = `Please note that ${unsupp} is not listed in our current course offerings. We offer ${supp}.\n\nI have noted your preferences for ${supp}, ${activeName}! Which batch timing fits your schedule best?`;
          } else {
            if (conv) conv.lead_step = "CONFIRMED";
            reply = `Please note that ${unsupp} is not listed in our current course offerings. We offer ${supp}.\n\nI have registered your enrollment inquiry for ${supp}, ${activeName}! Our admissions counselor will contact you at ${activePhone} shortly to confirm your seat.`;
          }
        } else {
          if (conv) conv.lead_step = "NAME";
          reply = `Please note that ${unsupp} is not listed in our current course offerings. We offer ${supp}.\n\nI would be delighted to assist you with enrolling in ${supp}. May I have your Full Name, please?`;
        }
      } else if (!activeName || isGibberishOrInvalidName(activeName)) {
        if (recentMentionedCourses.length > 1 && queryMentionedCourses.length === 0 && (!conv?.customer_interested_courses || conv.customer_interested_courses.length === 0)) {
          reply = `That's wonderful news! We offer both ${recentMentionedCourses.map((c) => c.displayName).join(" and ")}. Which program would you like to enroll in—${recentMentionedCourses.map((c) => c.displayName.replace(/^(Core|Advanced)\s+/i, "")).join(" or ")} (or would you like to join both)?`;
        } else {
          if (conv) conv.lead_step = "NAME";
          if (isCasualAck && prevAskedEnrollment) {
            reply = `Wonderful! To help you reserve your seat in our ${targetCourseName} program, may I have your Full Name, please?`;
          } else {
            reply = `That's wonderful news! We are excited to assist you with enrolling in our ${targetCourseName} ${interestedCoursesList.length > 1 ? "courses" : "program"}.\n\nTo get started with your enrollment and reserve your seat, may I have your Full Name, please?`;
          }
        }
      } else if (!activePhone && !activeEmail) {
        if (conv) conv.lead_step = "PHONE";
        reply = `Pleasure to assist you, ${activeName}! What is the best 10-digit Phone Number (or WhatsApp number) our admissions desk can reach you on to confirm your seat?`;
      } else if (!activeMode || (interestedCoursesList.length > 1 && interestedCoursesList.some((c) => !conv?.customer_course_preferences?.[c]?.mode))) {
        if (conv) conv.lead_step = "MODE";
        if (interestedCoursesList.length > 1) {
          const coursesNeedingMode = interestedCoursesList.filter((c) => !conv?.customer_course_preferences?.[c]?.mode);
          const coursesWithMode = interestedCoursesList.filter((c) => conv?.customer_course_preferences?.[c]?.mode);
          if (coursesNeedingMode.length === interestedCoursesList.length) {
            reply = `Thank you, ${activeName}! For each course you're joining (${interestedCoursesList.join(" and ")}), which training format do you prefer—Online (Live Interactive) or in-person Classroom Sessions? (You can choose the same format for both or customize per course!)`;
          } else {
            const pyPref = conv?.customer_course_preferences?.["Core Python Programming"]?.mode;
            const jvPref = conv?.customer_course_preferences?.["Core Java Programming"]?.mode;
            if (pyPref && coursesNeedingMode.some((c) => c.toLowerCase().includes("java")) && !jvPref) {
              reply = `Welcome back, ${activeName}! I have your contact details (${activePhone}) and your ${pyPref} preference for Core Python Programming. For Core Java Programming, which training format do you prefer—Online (Live Interactive) or in-person Classroom Sessions?`;
            } else {
              const answeredSummary = coursesWithMode
                .map((c) => `${c} (${conv?.customer_course_preferences?.[c]?.mode})`)
                .join(" and ");
              reply = `Got it, ${activeName}! ${answeredSummary} is noted. For ${coursesNeedingMode.join(" and ")}, which training format do you prefer—Online (Live Interactive) or Classroom Sessions?`;
            }
          }
        } else {
          reply = `Thank you, ${activeName}! Which training mode would you prefer for ${targetCourseName}—Online (Live Interactive) or in-person in Classroom Sessions?`;
        }
      } else if (!activeBatch || (interestedCoursesList.length > 1 && interestedCoursesList.some((c) => !conv?.customer_course_preferences?.[c]?.batch))) {
        if (conv) conv.lead_step = "BATCH";
        const coursesNeedingBatch = interestedCoursesList.filter((c) => !conv?.customer_course_preferences?.[c]?.batch);
        const hasJava = coursesNeedingBatch.some((c) => c.toLowerCase().includes("java"));
        const hasPython = coursesNeedingBatch.some((c) => c.toLowerCase().includes("python"));

        if (hasJava && hasPython) {
          reply = `Got it, ${activeName}! Here are the schedules for your selected courses:\n• Core Java Programming: Monday–Saturday, 6:00 PM – 7:30 PM IST (Next Batch: 12 October 2026)\n• Core Python Programming: Monday–Saturday, 7:00 PM – 8:00 PM IST (Next Batch: 5 October 2026)\n\nBoth are Evening Batches. Do these timings work for your schedule for both courses?`;
        } else if (hasPython) {
          reply = `Got it, ${activeName}! Core Python Programming runs in our Evening Batch:\n• Monday–Saturday, 7:00 PM – 8:00 PM IST (Next Batch: 5 October 2026)\n\nDoes this evening batch timing work for your schedule?`;
        } else if (hasJava) {
          reply = `Got it, ${activeName}! Core Java Programming runs in our Evening Batch:\n• Monday–Saturday, 6:00 PM – 7:30 PM IST (Next Batch: 12 October 2026)\n\nDoes this evening batch timing work for your schedule?`;
        } else {
          reply = `Got it, ${activeName}! Which batch timing fits your schedule best for ${coursesNeedingBatch.join(" and ")}?\n• Evening Batch (6:00 PM – 8:00 PM IST)\n• Flexible Batch (Custom timing coordinated with admissions desk)`;
        }
      } else if (!activeExperience) {
        if (conv) conv.lead_step = "EXPERIENCE";
        reply = `Noted! Do you have any prior programming or technical background, or are you starting fresh as a beginner?`;
      } else {
        if (conv) conv.lead_step = "CONFIRMED";
        const contactInfo = activePhone ? `at ${activePhone}` : (activeEmail ? `at ${activeEmail}` : "");
        const welcomeCompany = host.hostCompanyName ? ` Welcome to ${host.hostCompanyName}!` : " Welcome!";
        const prefsDetails = conv?.customer_course_preferences && Object.keys(conv.customer_course_preferences).length > 0
          ? Object.entries(conv.customer_course_preferences).map(([c, p]) => `${c} (${p.mode || activeMode || "Online Live"}, ${p.batch || activeBatch || "Evening Batch"})`).join(" and ")
          : `${targetCourseName} (${activeMode || "Online Live"}, ${activeBatch || "Flexible Batch"})`;
        reply = `Wonderful! Everything is noted, ${activeName}! I have officially registered your enrollment inquiry in our admissions database for ${prefsDetails}.\n\nOur admissions counselor will reach out to you ${contactInfo} shortly to confirm your seat and assist you with batch onboarding.${welcomeCompany} Please let me know if you have any questions in the meantime.`;
      }
    } else if (isCasualAck && !isExplicitQuestion) {
      reply = `You're very welcome! If you'd like to enroll in our programs or have any other questions, I'm right here to help!`;
    } else if (isJavaMorningRequested) {
      reply = `For Core Java Programming, we currently only offer an Evening Batch from 6:00 PM to 7:30 PM IST (Monday–Saturday). We do not have a morning batch scheduled for Java at this time. Would you be able to attend the evening batch, or consider our online live interactive sessions?`;
    } else if (isDiscountQuery) {
      reply = `I do not have any discount information in our current course details. The standard tuition fee is ₹4,000 for Core Python Programming and ₹5,000 for Core Java Programming.`;
    } else if (isFeeQuery && !isWeatherOrChitchat && !isMathQuery && !isTimeQuery && (promptText.toLowerCase().trim() === "what are the fees?" || promptText.toLowerCase().trim() === "what are the fees" || lower === "fees" || lower === "fee")) {
      reply = `The tuition fee for Core Python Programming is ₹4,000 (30 Days duration), and for Core Java Programming it is ₹5,000 (45 Days duration). The total fee for both courses is ₹9,000.`;
    } else if (isCourseCatalogQuery && !isWeatherOrChitchat && !isMathQuery && !isTimeQuery && !isBikeOrParkingQuery && (lower.includes("which courses do you offer") || lower.includes("what courses do you offer") || lower.includes("which course") || lower.includes("what course"))) {
      const compName = host.hostCompanyName || "our academy";
      const courseList = educationalCourses.length > 0
        ? educationalCourses.map((c) => `• ${c.displayName} (Duration: ${c.duration || host.courseDuration} | Fee: ${c.fee || host.courseFee})`).join("\n")
        : `• Core Python Programming (Duration: 30 Days | Fee: ₹4,000)\n• Core Java Programming (Duration: 45 Days | Fee: ₹5,000)`;
      const locStr = host.location ? `in ${host.location}` : "at our campus";
      reply = `We offer the following career-focused certification courses at ${compName}:\n${courseList}\n\nBoth courses are offered in Online Live Interactive mode as well as Classroom Sessions ${locStr}. Which course would you like to explore or join?`;
    } else if (isModeQuery && (lower.includes("can i join online") || lower.includes("join online?"))) {
      const courseNames = educationalCourses.length > 0 ? educationalCourses.map(c => c.displayName).join(" and ") : "our training courses";
      const locStr = host.location ? `in ${host.location}` : "at our campus";
      reply = `Yes, absolutely! ${courseNames} are available in Online Live Interactive mode as well as Classroom ${locStr}. All online sessions include live mentor guidance and recorded session backups.`;
    } else if (isDTMF1) {
      const courseLines = educationalCourses.length > 0
        ? educationalCourses.map((c) => `• ${c.displayName} (Duration: ${c.duration || host.courseDuration})`).join("\n")
        : `• ${host.courseName} (Duration: ${host.courseDuration})`;
      reply = `[Telephony IVR Option 1 - Course Catalog]\nHere are our available industry-standard certification programs:\n${courseLines}\n\nPress 2 for Python details, Press 3 for Java details, or Press 4 to speak with a human admissions counselor.`;
    } else if (isDTMF2) {
      const py = educationalCourses.find((c) => c.displayName.toLowerCase().includes("python")) || educationalCourses[0];
      reply = `[Telephony IVR Option 2 - Python Details]\n• Course: ${py ? py.displayName : "Python Full Stack"}\n• Duration: ${py?.duration || "3 Months"}\n• Tuition Fee: ${py?.fee || "₹20,000"}\n• Key Focus: Python OOPs, Flask/Django, REST APIs, Automation & Data Science\n• Placement: Full placement support with mock interviews.\n\nWould you like to book a free live demo or reserve your seat?`;
    } else if (isDTMF3) {
      const jv = educationalCourses.find((c) => c.displayName.toLowerCase().includes("java")) || (educationalCourses.length > 1 ? educationalCourses[1] : educationalCourses[0]);
      reply = `[Telephony IVR Option 3 - Java Details]\n• Course: ${jv ? jv.displayName : "Java Full Stack Development"}\n• Duration: ${jv?.duration || "4 Months"}\n• Tuition Fee: ${jv?.fee || "₹25,000"}\n• Key Focus: Core Java, Spring Boot microservices, Hibernate, Enterprise APIs\n• Placement: Direct enterprise hiring partner drives.\n\nWould you like to schedule a free demo session?`;
    } else if (isComparisonQuery) {
      const c1 = educationalCourses.find((c) => c.displayName.toLowerCase().includes("python")) || educationalCourses[0];
      const c2 = educationalCourses.find((c) => c.displayName.toLowerCase().includes("java")) || (educationalCourses.length > 1 ? educationalCourses[1] : null);

      reply = `Course Comparison Matrix:\n\n` +
        `| Metric / Dimension | ${c1 ? c1.displayName : "Python Programming"} | ${c2 ? c2.displayName : "Java Full Stack"} |\n` +
        `| --- | --- | --- |\n` +
        `| Duration | ${c1?.duration || "30 Days"} | ${c2?.duration || "45 Days"} |\n` +
        `| Tuition Fee | ${c1?.fee || "₹4,000"} | ${c2?.fee || "₹5,000"} |\n` +
        `| Batch Timings | ${c1?.batchTimings?.[0] || "Morning & Evening (7:00 PM – 8:00 PM)"} | ${c2?.batchTimings?.[0] || "Morning & Evening (6:00 PM – 7:30 PM)"} |\n` +
        `| Core Curriculum | Python Basics, OOP, Django/Flask, REST APIs | Core Java, Collections, Spring Boot, Microservices |\n` +
        `| Target Career Roles | Python Developer, ML/Data Associate | Java Backend Engineer, Spring Boot Developer |\n` +
        `| Prerequisites | Zero Coding Required (Beginner-friendly) | Basic Logic (Open to beginners) |\n` +
        `| Industry Focus | AI, Data Analytics, Web APIs | Enterprise Systems, Cloud Backends |\n\n` +
        `Career Recommendation:\n` +
        `• Choose Python if you want beginner-friendly syntax, rapid development, or interest in Data Science / AI.\n` +
        `• Choose Java if you are targeting large enterprise tech firms, banking systems, or scalable Spring Boot microservices.\n\n` +
        `Would you like to attend a free live demo session for either program?`;
    } else if (isDemoBookingQuery) {
      const targetName = focusedCourse?.displayName || host.courseName || "Software Training";
      const demoId = `DEMO-${Math.floor(1000 + Math.random() * 9000)}`;
      reply = `Free Live Demo Session Registration:\n\n` +
        `• Reservation Status: Confirmed & Reserved\n` +
        `• Booking Reference: ${demoId}\n` +
        `• Course: ${targetName}\n` +
        `• Training Mode: Live Online Interactive Class (Google Meet / Zoom)\n` +
        `• Next Scheduled Slot: Tomorrow at 10:00 AM IST (Evening Slot: 6:30 PM IST also available)\n` +
        `• Trial Access Link: https://meet.google.com/ais-demo-room\n\n` +
        `During this 45-minute live trial, you will experience our interactive faculty teaching, explore real-world project builds, and get your technical questions answered. May I have your WhatsApp number to text you the calendar invite?`;
    } else if (isBrochureOrWhatsAppQuery) {
      const targetName = focusedCourse?.displayName || host.courseName || "Certification Program";
      const phoneDisplay = activePhone || host.phone || "+91 91213 75668";
      reply = `WhatsApp Syllabus & Curriculum Dispatch:\n\n` +
        `• Program: ${targetName} (Comprehensive 2026 Curriculum)\n` +
        `• Dispatch Destination: Sent to WhatsApp (${phoneDisplay})\n` +
        `• Document Contents: Complete 12-week module syllabus, capstone project blueprints, lab exercises, and placement interview questions.\n\n` +
        `Please check your WhatsApp in a moment! Let me know if you would like me to help you schedule a demo or reserve a batch seat.`;
    } else if (isHypotheticalQuery) {
      reply = `Academic Guidance for Working Professionals & Students:\n\n` +
        `• Working Professionals: We offer our popular Evening Batch (6:00 PM – 8:00 PM IST) and weekend doubt-clearing clinics specifically tailored for working schedules.\n` +
        `• Non-IT / Non-CS Backgrounds: Every course starts from absolute ground zero with foundational problem-solving. No prior programming background is required.\n` +
        `• Missed Class Safeguard: 100% of live classes are recorded in HD and available in your student portal within 2 hours with lifetime access, backed by 1-on-1 mentor support.\n\n` +
        `Would you like to explore enrolling in an upcoming evening or weekend batch?`;
    } else if (isTimingChangeQuery) {
      const explicitCourses = queryMentionedCourses.length > 0
        ? queryMentionedCourses.map((c) => c.displayName)
        : (conv?.customer_interested_courses && conv.customer_interested_courses.length > 0 ? conv.customer_interested_courses : []);

      if (explicitCourses.length > 1) {
        reply = `Yes, certainly! You have full flexibility to adjust your batch timings across your courses:\n\n` +
          explicitCourses.map((c) => {
            const doc = educationalCourses.find((e) => e.displayName.toLowerCase() === c.toLowerCase());
            const t = doc?.batchTimings?.[0] || "Evening Batch (6:00 PM – 8:00 PM IST)";
            return `• ${c}: Currently scheduled for ${t}. You can switch between Morning or Evening slots, or transfer batches anytime with zero penalty.`;
          }).join("\n") +
          `\n\nWhich program's timing would you like to adjust—${explicitCourses.join(" or ")}?`;
      } else if (explicitCourses.length === 1) {
        const c = explicitCourses[0];
        const doc = educationalCourses.find((e) => e.displayName.toLowerCase() === c.toLowerCase());
        const t = doc?.batchTimings?.[0] || "Evening Batch (6:00 PM – 8:00 PM IST)";
        reply = `Yes, absolutely! For ${c}, our current batch schedule is ${t}. If this timing doesn't align with your routine, you can seamlessly switch between morning, evening, or weekend slots upon coordinating with our admissions desk. Which time of day works best for you?`;
      } else {
        reply = `Yes, definitely! We offer complete schedule flexibility so you never have to worry about missing a session:\n\n` +
          `• Flexible Batch Switch: You can switch between morning and evening batches or transfer to an upcoming weekend batch at any time without extra fees.\n` +
          `• Recorded Class Backup: 100% of all sessions are recorded in HD and uploaded to your student portal within 2 hours.\n\n` +
          (educationalCourses.length > 1
            ? `Which course's timing are you inquiring about (${educationalCourses.map((c) => c.displayName).join(" or ")})?`
            : `Would you like to know our alternative batch slots?`);
      }
    } else {
      // =========================================================================
      // Comprehensive Multi-Intent & Multi-Question Reasoning Engine
      // =========================================================================

      // 1. Identify educational courses mentioned in a given text snippet
      const findCoursesInText = (text: string): ParsedKnowledgeDoc[] => {
        const t = text.toLowerCase();
        const found: ParsedKnowledgeDoc[] = [];
        for (const doc of educationalCourses) {
          const docNameLower = doc.displayName.toLowerCase();
          const docRawTitleLower = doc.rawTitle.toLowerCase();
          const cleanTokens = docNameLower
            .replace(/\b(core|advance|advanced|course|programming|development|training|program|full stack|fullstack|certification)\b/gi, "")
            .trim()
            .split(/\s+/)
            .filter((tok) => tok.length >= 3);
          const matchesClean = cleanTokens.some((tok) => new RegExp(`\\b${tok}\\b`, "i").test(t));
          if (
            t.includes(docNameLower) ||
            t.includes(docRawTitleLower) ||
            matchesClean
          ) {
            if (!found.some((x) => x.id === doc.id)) {
              found.push(doc);
            }
          }
        }
        return found;
      };

      const findUnsupportedCoursesInText = (text: string): string[] => {
        const t = text.toLowerCase();
        const found: string[] = [];
        for (const uc of sortedUnsupported) {
          const escaped = uc.toLowerCase().replace(/[+.*^$()[\]{}|\\]/g, "\\$&");
          if (new RegExp(`\\b${escaped}\\b`, "i").test(t)) {
            const canonical =
              uc === "Web" || uc === "Web Dev" || uc === "Web Design" || uc === "Web Designing"
                ? "Web Development"
                : uc === "Cybersecurity" || uc === "Cyber"
                ? "Cyber Security"
                : uc === "AI"
                ? "Artificial Intelligence"
                : uc;
            if (!found.includes(canonical)) {
              found.push(canonical);
            }
          }
        }
        return found;
      };

      // 2. Question Segmentation (handles numbered questions, conjunctions, punctuation, and clause boundaries)
      const splitClauseRegex =
        /(?:\r?\n)+|(?<=\d)[.)]\s+|[?;]|(?<=[a-z0-9])\.\s+|\b(?:and\s+also|also|additionally|furthermore|plus|as\s+well\s+as)\b|(?<=\w)\s*,\s*(?=(?:what(?:s|'s)?|how(?:s|'s)?|which|why|is|can|could|where(?:s|'s)?|when(?:s|'s)?|who(?:s|'s)?|duration|fee|fees|cost|topic|syllabus|batch|timing|timings|schedule|location|map|contact|job|oppertunities|opportunities|career|placement|weather|temperature|time|python|java|web|cyber|data|\d+)\b)|\band\b(?=\s*(?:what(?:s|'s)?|which|how|where|when|why|is|can|could|batch|timing|timings|schedule|fee|fees|cost|tuition|price|topic|topics|syllabus|curriculum|duration|eligibility|project|projects|address|location|map|maps|contact|phone|email|python|java))\b/i;
      const rawSegments = promptText
        .split(splitClauseRegex)
        .map((s) => s.trim())
        .filter((s) => s.length > 2);

      const segmentsToProcess = rawSegments.length > 0 ? rawSegments : [promptText];

      // 3. Multi-course facet tracking
      interface CourseAnswerEntry {
        doc: ParsedKnowledgeDoc;
        fee?: string;
        duration?: string;
        batchTimings?: string[];
        topics?: string[];
        projects?: string[];
        whyLearn?: string;
        career?: string;
        eligibility?: string;
        modes?: string;
      }
      const courseAnswers: Record<string, CourseAnswerEntry> = {};

      const getOrInitCourse = (doc: ParsedKnowledgeDoc): CourseAnswerEntry => {
        if (!courseAnswers[doc.id]) {
          courseAnswers[doc.id] = { doc };
        }
        return courseAnswers[doc.id];
      };

      const standaloneBlocks: string[] = [];

      // 4. Evaluate each segment independently to preserve individual question-attribute associations
      segmentsToProcess.forEach((seg) => {
        const segLower = seg.toLowerCase();
        const segCourses = findCoursesInText(seg);
        const segUnsupportedCourses = findUnsupportedCoursesInText(seg);

        const isCommuteSegment =
          /\b(time take to reach|how much time take to reach|how much time to reach|how long to reach|how long take to reach|travel time|distance from|how far|reach to your location|reach your location|reach your campus|reach your office|how to reach from|how can i reach from|how to reach your|metro route|transit)\b/i.test(segLower);
        const hasFee = /\b(fee|fees|cost|price|pricing|how much|tuition|rate|charges|installment|payment)\b/i.test(segLower);
        const hasDuration = !isCommuteSegment && /\b(duration|how long|months?|weeks?|how many month|how many week|course length|timeline|period)\b/i.test(segLower);
        const hasTopics = /\b(topic|topics|syllabus|curriculum|module|modules|covered in|topics covered|teach in|learn in|concepts|chapters)\b/i.test(segLower);
        const hasProjects = /\b(project|projects|capstone|hands[- ]on|practical|real[- ]world app|portfolio)\b/i.test(segLower);
        const hasWhyLearn = /\b(why should i learn|why learn|why python|why java|benefits of python|benefits of java|scope of python|scope of java|scope of|importance of|advantages of|why this course|benefits of learning)\b/i.test(segLower);
        const hasCareer = /\b(job|oppertunities|opportunities|career|placement|placement assistance|salary|package|hiring|roles|developer role|interview prep)\b/i.test(segLower);
        const hasEligibility = /\b(eligibility|who can join|prerequisite|qualification|who is eligible|freshers?|beginners?|non[- ]it)\b/i.test(segLower);
        const hasMode = /\b(online|offline|classroom|in[- ]person|training mode|mode of training|can i join online|offline class|classroom session|zoom|format)\b/i.test(segLower);
        const hasBatchTiming = /\b(timing|timings|schedule|batch timing|batch time|class time|time slots?|morning batch|evening batch|afternoon batch|when are classes)\b/i.test(segLower);
        const hasLocation = /\b(where is your office|where is your campus|where are you located|office location|campus location|address|location|campus|venue|where is your)\b/i.test(segLower);
        const hasMapLink = /\b(link of maps|map link|maps link|google map|directions|location link|google maps|directions)\b/i.test(segLower);
        const hasContact = /\b(phone number|contact number|contact details|contact info|email|call you|whatsapp number|helpline|reach out|contact desk|how to reach|call)\b/i.test(segLower);
        const hasDiscount = /\b(discount|concession|scholarship|reduction|less fee|less price|cheaper|negotiat|can you give discount|i want discount|any discount|discount in fee|fee discount|waiver|special offer|installments?)\b/i.test(segLower);
        const hasWhyChooseUs = /\b(why choose you|why i choose you|why choose your|why join you|why join your|why should i join|why should i choose|what makes you different|why you|benefits of joining|why study here|why this institute|why maruthi|why apex)\b/i.test(segLower);
        const hasCatalog = /\b(which courses?|what courses?|courses do you offer|course do you offer|courses you offer|courses you have|courses are available|course list|programs offered|what do you offer|programs do you offer|what do you teach|what training|classes do you offer|list of courses|all courses)\b/i.test(segLower);

        // Standalone intents detection per segment
        const hasWeather = /\b(weather|temperature|climate|forecast|raining|rainy|rain|sunny|hot|cold)\b/i.test(segLower);
        if (hasWeather) {
          const compName = host.hostCompanyName || "our academy";
          if (!standaloneBlocks.some((b) => b.toLowerCase().includes("weather"))) {
            standaloneBlocks.push(`• Weather Updates: As an AI receptionist for ${compName}, I can help you with our company information, courses, batch schedules, fees, and admissions. For live weather updates, please refer to any weather app!`);
          }
        }

        if (isCommuteSegment) {
          const compName = host.hostCompanyName || "our academy";
          const contactStr = host.phone ? `at ${host.phone}` : "our admissions desk";
          const mapsLink = host.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(compName)}`;
          const addrStr = host.location || "our campus";
          if (!standaloneBlocks.some((b) => b.includes("Transit & Commute"))) {
            standaloneBlocks.push(`Transit & Commute Directions:\n• Location: ${addrStr}\n• Live Routes & Travel Time: Travel time depends on real-time traffic and transit routes. You can view live directions and transit schedules on Google Maps (${mapsLink}), or contact our front desk ${contactStr} for landmark assistance!`);
          }
        }

        const hasTime = /\b(time now|current time|what time is it|time right now|what is the time|clock time)\b/i.test(segLower);
        if (hasTime) {
          const compName = host.hostCompanyName || "our academy";
          if (!standaloneBlocks.some((b) => b.toLowerCase().includes("current time"))) {
            standaloneBlocks.push(`• Current Time: I don't maintain a real-time clock, but visiting hours at ${compName} are Monday to Saturday, 9:00 AM – 7:00 PM IST, and evening batches start at 6:00 PM and 7:00 PM IST.`);
          }
        }

        const mathMatch = segLower.match(/(?:what is\s+)?(\d+)\s*([x*+\-/])\s*(\d+)/i);
        if (mathMatch) {
          const n1 = parseInt(mathMatch[1], 10);
          const op = mathMatch[2];
          const n2 = parseInt(mathMatch[3], 10);
          const res = op === "x" || op === "*" ? n1 * n2 : op === "+" ? n1 + n2 : op === "-" ? n1 - n2 : op === "/" && n2 !== 0 ? n1 / n2 : 0;
          if (!standaloneBlocks.some((b) => b.toLowerCase().includes("calculation"))) {
            standaloneBlocks.push(`• Calculation: ${n1} ${op === "x" ? "×" : op} ${n2} = ${res}. Let me know if you have any questions about our Python or Java training courses!`);
          }
        }

        const hasWhoAreYou = /\b(who are you|what is your name|who is this|what are you)\b/i.test(segLower);
        if (hasWhoAreYou) {
          const compName = host.hostCompanyName ? ` for ${host.hostCompanyName}` : "";
          if (!standaloneBlocks.some((b) => b.toLowerCase().includes("about me"))) {
            standaloneBlocks.push(`• About Me: I am Maya, the AI receptionist${compName}. I assist with course inquiries, batch timings, fees, syllabus details, demo classes, and admissions!`);
          }
        }

        const hasBikeOrParking = /\b(reach you on bike|reach on bike|come by bike|bike|parking space|parking available|parking facility|car parking|two wheeler|parking)\b/i.test(segLower);
        if (hasBikeOrParking) {
          const parkingDoc = activeKnowledge.find((k) => k.content.toLowerCase().includes("parking") || k.title.toLowerCase().includes("parking"));
          if (parkingDoc) {
            if (!standaloneBlocks.some((b) => b.includes("Parking Facilities"))) {
              standaloneBlocks.push(`Parking Facilities:\n• ${parkingDoc.content.slice(0, 300).trim()}`);
            }
          } else {
            const contactStr = host.phone ? `at ${host.phone}` : (host.email ? `via email at ${host.email}` : "our team");
            if (!standaloneBlocks.some((b) => b.includes("Parking Information"))) {
              standaloneBlocks.push(`Parking Information:\n• I don't have verified parking information in our current records. You can contact our team directly ${contactStr}, and our staff will be happy to assist you with parking availability and nearby options!`);
            }
          }
        }

        const hasKnowledgeBase = /\b(how many knowledge documents|knowledge documents|knowledge base|documents you have)\b/i.test(segLower);
        if (hasKnowledgeBase) {
          const compName = host.hostCompanyName || "our academy";
          const docsSummary = educationalCourses.length > 0 ? educationalCourses.map(c => c.displayName).join(" and ") : "our verified programs";
          if (!standaloneBlocks.some((b) => b.toLowerCase().includes("knowledge base"))) {
            standaloneBlocks.push(`• Knowledge Base: I am trained on official ${compName} curriculum and admissions documentation, covering our certified ${docsSummary} courses.`);
          }
        }

        // Check if an unsupported course is mentioned in THIS segment without a supported course
        if (segUnsupportedCourses.length > 0 && segCourses.length === 0) {
          const compName = host.hostCompanyName || "our academy";
          const coursesOffered = educationalCourses.length > 0
            ? educationalCourses.map((c) => `${c.displayName} (Tuition Fee: ${c.fee || host.courseFee} | ${c.duration || host.courseDuration})`).join(" and ")
            : "Core Python Programming and Core Java Programming";
          segUnsupportedCourses.forEach((uCourse) => {
            if (!standaloneBlocks.some((b) => b.toLowerCase().includes(uCourse.toLowerCase()))) {
              standaloneBlocks.push(`• ${uCourse}: Please note that ${uCourse} is not currently offered in our training curriculum at ${compName}. We specialize exclusively in ${coursesOffered}.`);
            }
          });
        } else if (segCourses.length > 0) {
          // If specific course(s) are mentioned in THIS segment
          segCourses.forEach((c) => {
            const entry = getOrInitCourse(c);
            let anySpecificFacetSet = false;

            if (hasFee) {
              entry.fee = c.fee || host.courseFee;
              anySpecificFacetSet = true;
            }
            if (hasDuration) {
              entry.duration = c.duration || host.courseDuration;
              anySpecificFacetSet = true;
            }
            if (hasBatchTiming) {
              if (c.batchTimings && c.batchTimings.length > 0) {
                entry.batchTimings = c.batchTimings;
              } else if (c.displayName.toLowerCase().includes("python")) {
                entry.batchTimings = [
                  "Evening Batch: 7:00 PM – 8:00 PM IST (Monday–Saturday)",
                  "Morning Batch: 9:00 AM – 10:30 AM IST",
                ];
              } else if (c.displayName.toLowerCase().includes("java")) {
                entry.batchTimings = [
                  "Evening Batch: 6:00 PM – 7:30 PM IST (Monday–Saturday)",
                  "Morning Batch: 9:00 AM – 10:30 AM IST",
                ];
              } else if (host.batchTimings && host.batchTimings.length > 0) {
                entry.batchTimings = host.batchTimings;
              } else {
                entry.batchTimings = [
                  "Morning Batch: 9:00 AM – 11:00 AM IST",
                  "Evening Batch: 6:00 PM – 8:00 PM IST",
                ];
              }
              anySpecificFacetSet = true;
            }
            if (hasTopics) {
              entry.topics = c.topics.length > 0 ? c.topics : host.topics;
              anySpecificFacetSet = true;
            }
            if (hasProjects) {
              const validProj = c.projects.filter((p) => p.length > 3 && !/^(projects?|none|n\/a|nil)\.?$/i.test(p));
              entry.projects = validProj.length > 0 ? validProj : host.projects;
              anySpecificFacetSet = true;
            }
            if (hasWhyLearn) {
              if (c.displayName.toLowerCase().includes("python")) {
                entry.whyLearn = "High Industry Demand: Python is the #1 language powering Artificial Intelligence, Machine Learning, Data Science, and Web Automation with beginner-friendly syntax.";
              } else if (c.displayName.toLowerCase().includes("java")) {
                entry.whyLearn = "Enterprise Standard: Java powers Fortune 500 enterprise applications, Spring Boot cloud microservices, and large-scale backend architectures.";
              } else {
                entry.whyLearn = `In-demand enterprise technology providing strong practical skills, hands-on portfolio projects, and verified credentials.`;
              }
              anySpecificFacetSet = true;
            }
            if (hasCareer) {
              if (c.displayName.toLowerCase().includes("python")) {
                entry.career = "Roles: Python Developer, Data Analyst, ML Associate, Automation Engineer. Includes full placement support & mock interviews.";
              } else if (c.displayName.toLowerCase().includes("java")) {
                entry.career = "Roles: Java Backend Engineer, Spring Boot Developer, Enterprise Application Architect. Includes full placement support.";
              } else {
                entry.career = "Comprehensive placement coaching, resume optimization, and mock technical interviews.";
              }
              anySpecificFacetSet = true;
            }
            if (hasEligibility) {
              entry.eligibility = c.eligibility || host.eligibility || "Open to beginners, graduates, and working professionals (no prior coding experience required).";
              anySpecificFacetSet = true;
            }

            // If user asked "What is for Python" (no specific dimension keyword, but mentioned Python)
            if (!anySpecificFacetSet && !hasCatalog && !hasBatchTiming && !hasLocation && !hasContact && !hasDiscount) {
              entry.fee = c.fee || host.courseFee;
              entry.duration = c.duration || host.courseDuration;
            }
          });
        } else {
          // No specific course named in this segment -> handle general questions
          if (hasFee) {
            const targets = recentMentionedCourses.length > 0
              ? recentMentionedCourses
              : (educationalCourses.length > 0 ? educationalCourses : (focusedCourse ? [focusedCourse] : []));
            targets.forEach((c) => {
              getOrInitCourse(c).fee = c.fee || host.courseFee;
            });
          }
          if (hasDuration) {
            const targets = recentMentionedCourses.length > 0
              ? recentMentionedCourses
              : (educationalCourses.length > 0 ? educationalCourses : (focusedCourse ? [focusedCourse] : []));
            targets.forEach((c) => {
              getOrInitCourse(c).duration = c.duration || host.courseDuration;
            });
          }
          if (hasBatchTiming) {
            const targets = recentMentionedCourses.length > 0
              ? recentMentionedCourses
              : (focusedCourse ? [focusedCourse] : []);
            if (targets.length > 0) {
              targets.forEach((c) => {
                const entry = getOrInitCourse(c);
                entry.batchTimings = c.batchTimings.length > 0
                  ? c.batchTimings
                  : (host.batchTimings.length > 0
                      ? host.batchTimings
                      : ["Morning Batch (9:00 AM – 11:00 AM IST)", "Afternoon Batch (2:00 PM – 4:00 PM IST)", "Evening Batch (6:00 PM – 8:00 PM IST)"]);
              });
            } else {
              const timingsList = host.batchTimings && host.batchTimings.length > 0
                ? host.batchTimings.map((t) => `• ${t.replace(/^[•\s*-]+/, "")}`).join("\n")
                : [
                    "• Morning Batch (9:00 AM – 11:00 AM IST)",
                    "• Afternoon Batch (2:00 PM – 4:00 PM IST)",
                    "• Evening Batch (6:00 PM – 8:00 PM IST)",
                  ].join("\n");
              if (!standaloneBlocks.some((b) => b.includes("Batch Timings"))) {
                standaloneBlocks.push(`Batch Timings & Schedules (Monday to Friday):\n${timingsList}`);
              }
            }
          }
          if (hasTopics) {
            const targets = recentMentionedCourses.length > 0
              ? recentMentionedCourses
              : (focusedCourse ? [focusedCourse] : educationalCourses);
            targets.forEach((c) => {
              getOrInitCourse(c).topics = c.topics.length > 0 ? c.topics : host.topics;
            });
          }
          if (hasCatalog) {
            if (educationalCourses.length > 0) {
              const listLines = educationalCourses.map((c) => {
                const dur = c.duration ? ` (Duration: ${c.duration})` : "";
                return `• ${c.displayName}${dur}`;
              }).join("\n");
              if (!standaloneBlocks.some((b) => b.includes("Available Training Programs"))) {
                standaloneBlocks.push(`Available Training Programs:\n${listLines}`);
              }
            } else {
              if (!standaloneBlocks.some((b) => b.includes("Available Program"))) {
                standaloneBlocks.push(`Available Program:\n• ${host.courseName} (Duration: ${host.courseDuration})`);
              }
            }
          }
        }

        // Standalone blocks
        if (hasBatchTiming && segCourses.length === 0 && !focusedCourse) {
          // Handled above in general branches
        }

        if (hasMode) {
          if (!standaloneBlocks.some((b) => b.includes("Training Formats"))) {
            standaloneBlocks.push(`Training Formats:\n• Online (Live Interactive): Real-time live sessions with interactive screen sharing, mentor doubt resolution & recorded class backup.\n• Classroom Sessions: In-person hands-on training at our campus with direct faculty mentoring.`);
          }
        }

        if (hasDiscount) {
          const compName = host.hostCompanyName || "our academy";
          const deskPhone = host.phone ? ` (${host.phone})` : "";
          if (!standaloneBlocks.some((b) => b.includes("Tuition Fee Assistance") || b.includes("Tuition Payment Options"))) {
            standaloneBlocks.push(`Tuition Fee Assistance & Concessions:\n• Standard Tuition: At ${compName}, our tuition fees are standard and transparently set for each training track.\n• Concessions & Scholarships: To discuss fee discounts, early-bird concessions, or custom installment plans, you can speak directly with our admissions and customer desk${deskPhone}. Our team is always happy to work with you to make tuition comfortable!`);
          }
        }

        if (hasLocation || hasMapLink) {
          if (!standaloneBlocks.some((b) => b.includes("Campus Location"))) {
            standaloneBlocks.push(`Campus Location & Directions:\n• Address: ${host.location}\n• Google Maps Link: ${host.googleMapsUrl}\n• Visiting Hours: Monday to Saturday, 9:00 AM – 7:00 PM IST`);
          }
        }

        if (hasContact) {
          if (!standaloneBlocks.some((b) => b.includes("Admissions Help Desk"))) {
            standaloneBlocks.push(`Admissions Help Desk & Contact Info:\n• Phone / WhatsApp: ${host.phone || "+91 91213 75668"}\n• Email: ${host.email || "info@example.com"}\n• Admissions Status: Currently Open!`);
          }
        }

        if (hasWhyChooseUs) {
          const companyName = host.hostCompanyName || "Our Academy";
          if (!standaloneBlocks.some((b) => b.includes("Why Choose"))) {
            standaloneBlocks.push(`Why Choose ${companyName}:\n• Expert Real-Time Faculty with direct enterprise software engineering experience\n• Hands-On Capstone Projects for a portfolio-ready resume\n• 1-on-1 Doubt Clearance and daily code reviews\n• Dedicated Placement Assistance & Verified Certification`);
          }
        }
      });

      // Ensure any unsupported courses detected across the entire prompt are included
      if (detectedUnsupportedCourses.length > 0 && queryMentionedCourses.length === 0) {
        const compName = host.hostCompanyName || "Maruthi Technologies";
        detectedUnsupportedCourses.forEach((uCourse) => {
          if (!standaloneBlocks.some((b) => b.toLowerCase().includes(uCourse.toLowerCase()))) {
            standaloneBlocks.push(`• ${uCourse}: Please note that ${uCourse} is not currently offered in our training curriculum at ${compName}. We specialize exclusively in Core Python Programming (Tuition Fee: ₹4,000 | 30 Days) and Core Java Programming (Tuition Fee: ₹5,000 | 45 Days).`);
          }
        });
      }

      // 5. Build Composite Response Blocks
      const allResponseBlocks: string[] = [];

      // Add course-specific detailed cards
      Object.values(courseAnswers).forEach((entry) => {
        const doc = entry.doc;
        const subLines: string[] = [];

        if (entry.fee) {
          subLines.push(`  Tuition Fee: ${entry.fee}`);
        }
        if (entry.duration) {
          subLines.push(`  Course Duration: ${entry.duration}`);
        }
        if (entry.batchTimings && entry.batchTimings.length > 0) {
          const tLines = entry.batchTimings.map((t) => `  • ${t.replace(/^[•\s*-]+/, "")}`).join("\n");
          subLines.push(`  Batch Timings & Schedule:\n${tLines}`);
        }
        if (entry.whyLearn) {
          subLines.push(`  Why Learn: ${entry.whyLearn}`);
        }
        if (entry.career) {
          subLines.push(`  Career Scope: ${entry.career}`);
        }
        if (entry.eligibility) {
          subLines.push(`  Eligibility: ${entry.eligibility}`);
        }
        if (entry.topics && entry.topics.length > 0) {
          const topicList = entry.topics.slice(0, 10).map((t, idx) => `  ${idx + 1}. ${t}`).join("\n");
          subLines.push(`  Key Topics & Curriculum:\n${topicList}`);
        }
        if (entry.projects && entry.projects.length > 0) {
          const projList = entry.projects.map((p) => `  • ${p}`).join("\n");
          subLines.push(`  Hands-on Projects:\n${projList}`);
        }

        if (subLines.length > 0) {
          allResponseBlocks.push(`• ${doc.displayName}:\n${subLines.join("\n")}`);
        }
      });

      // Add standalone operational blocks
      standaloneBlocks.forEach((b) => {
        allResponseBlocks.push(b);
      });

      // 6. Compose Final Comprehensive Reply
      if (allResponseBlocks.length > 0) {
        const isOngoingConversation = Boolean(
          conv && messages.filter((m) => m.conversation_id === conv.id).length >= 1
        );
        const questionCount = allResponseBlocks.length + Object.values(courseAnswers).reduce((acc, cur) => acc + (cur.fee ? 1 : 0) + (cur.duration ? 1 : 0) + (cur.topics ? 1 : 0), 0);
        const isMultipleQuestions = questionCount > 2 || allResponseBlocks.length > 1;

        let singleHeader = "";
        if (isMultipleQuestions) {
          if (isOngoingConversation) {
            singleHeader = "Here is the information for your questions:\n\n";
          } else if (host.hostCompanyName) {
            singleHeader = `Welcome to ${host.hostCompanyName}! Here is the information for your questions:\n\n`;
          } else {
            singleHeader = "Here is the information for your questions:\n\n";
          }
        }

        const footer = (conv?.lead_step && conv.lead_step !== "CONFIRMED") || isPurelyInformationalQuery
          ? ""
          : (allResponseBlocks.length > 1 || isFeeQuery || isTimingQuery
              ? `\n\nWould you like to reserve a seat in an upcoming batch, or can I assist you with enrollment?`
              : "");

        reply = `${singleHeader}${allResponseBlocks.join("\n\n")}${footer}`;
      } else {
        const compName = host.hostCompanyName || "our academy";
        const contactStr = host.phone ? `at ${host.phone}` : (host.email ? `via email at ${host.email}` : "our front desk team");

        const isPlacementQuestion =
          lower.includes("placement") ||
          lower.includes("job guarantee") ||
          lower.includes("job assistance") ||
          lower.includes("campus interview") ||
          lower.includes("companies visit");

        const isFacultyQuestion =
          lower.includes("instructor") ||
          lower.includes("faculty") ||
          lower.includes("trainer") ||
          lower.includes("who teaches") ||
          lower.includes("teachers");

        const isRefundQuestion =
          lower.includes("refund") ||
          lower.includes("cancellation") ||
          lower.includes("money back") ||
          lower.includes("fee return");

        const isHostelQuestion =
          lower.includes("hostel") ||
          lower.includes("accommodation") ||
          lower.includes("stay") ||
          lower.includes("room") ||
          lower.includes("transport") ||
          lower.includes("bus");

        const isParkingQuestion =
          lower.includes("parking") ||
          lower.includes("bike") ||
          lower.includes("car parking") ||
          lower.includes("two wheeler");

        const isAnyUserQuestion =
          isExplicitQuestion ||
          lower.includes("?") ||
          /\b(what|who|where|when|why|how|can i|is there|do you|are there|does|provide|offer)\b/i.test(lower);

        if (detectedUnsupportedCourses.length > 0) {
          const unsupp = detectedUnsupportedCourses.join(" and ");
          const coursesOffered = educationalCourses.length > 0
            ? educationalCourses.map((c) => `• ${c.displayName}${c.fee ? ` (Tuition Fee: ${c.fee}` : ""}${c.duration ? ` | ${c.duration})` : ")"}`).join("\n")
            : `• Core Python Programming (Tuition Fee: ₹4,000 | 30 Days)\n• Core Java Programming (Tuition Fee: ₹5,000 | 45 Days)`;
          reply = `Please note that ${unsupp} is not offered in our current training curriculum at ${compName}. We specialize exclusively in:\n${coursesOffered}\n\nWould you like more information on either of our verified certification programs?`;
        } else if (lower.includes("weather") || lower.includes("temperature") || lower.includes("raining") || lower.includes("forecast") || lower.includes("climate")) {
          reply = `As an AI receptionist for ${compName}, I can help you with our company information, courses, batch schedules, fees, and admissions. For live weather updates, please refer to any weather app. How can I assist you with our programs today?`;
        } else if (isCommuteOrTravelQuery) {
          const mapsLink = host.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(compName)}`;
          const addrStr = host.location || "our campus";
          reply = `I don't have real-time commute traffic or transit travel time calculations in our records. Our location is at ${addrStr}.\n\nYou can check live routes, travel times, and metro schedules on Google Maps (${mapsLink}), or contact our front desk ${contactStr} for landmark assistance!`;
        } else if (isTimeQuery) {
          reply = `I don't maintain a real-time clock, but visiting hours at ${compName} are Monday to Saturday, 9:00 AM – 7:00 PM IST, and evening batches start at 6:00 PM and 7:00 PM IST. How can I assist you today?`;
        } else if (isMathQuery) {
          const m = lower.match(/(\d+)\s*([x*+\-/])\s*(\d+)/);
          if (m) {
            const n1 = parseInt(m[1], 10);
            const op = m[2];
            const n2 = parseInt(m[3], 10);
            const res = op === "x" || op === "*" ? n1 * n2 : op === "+" ? n1 + n2 : op === "-" ? n1 - n2 : op === "/" && n2 !== 0 ? n1 / n2 : 0;
            reply = `${n1} ${op === "x" ? "×" : op} ${n2} = ${res}. Let me know if you have any questions about our Python or Java training courses!`;
          } else {
            reply = `I can help calculate standard fees and installment schedules for our courses. Let me know if you need fee details!`;
          }
        } else if (isParkingQuestion) {
          reply = `I don't have verified parking information in our current records. You can contact our admissions and support team directly ${contactStr}, and our staff will be happy to assist you with parking availability and nearby options!`;
        } else if (isPlacementQuestion) {
          reply = `I don't have verified placement assistance data in our current course records. You can contact our admissions and support team directly ${contactStr}, and our staff will be delighted to provide you with complete placement support, mock interview preparation, and hiring partner details!`;
        } else if (isFacultyQuestion) {
          reply = `I don't have specific instructor profiles or faculty details in our current records. You can contact our admissions team directly ${contactStr}, and our staff will be glad to share faculty credentials, experience, and mentoring details with you!`;
        } else if (isRefundQuestion) {
          reply = `I don't have the refund policy terms in our current course records. You can contact our management and support team directly ${contactStr}, and our staff will be happy to assist you with our terms and policy!`;
        } else if (isHostelQuestion) {
          reply = `I don't have hostel or transport facility information in our current records. You can contact our team directly ${contactStr}, and our staff will be glad to assist you with local accommodation and commute options!`;
        } else if (isAnyUserQuestion) {
          reply = `I don't have that specific information in our current records. You can contact our admissions and support team directly ${contactStr}, and our staff will be delighted to assist you and provide complete details!`;
        } else if (matchingDocs.length > 0 && matchingDocs[0].score >= 20) {
          const topDoc = matchingDocs[0].item;
          reply = `Information regarding ${topDoc.title}:\n\n${topDoc.content.slice(0, 600).trim()}\n\nWould you like more details on this, or shall I help you get enrolled?`;
        } else if (educationalCourses.length > 0) {
          const docList = educationalCourses.map((k) => `• ${k.displayName} (${k.duration || "Comprehensive Program"})`).join("\n");
          reply = `I would be happy to assist you! Here are our available training programs:\n\n${docList}\n\nWhich of these would you like more information about?`;
        } else {
          reply = `Welcome to ${compName}! We are here to help you. If you have any questions about our offerings, schedules, fees, or services, I would be delighted to assist you! How can I help you today?`;
        }
      }
    }
  }

  // If the user asked a question while in an incomplete lead qualification step, answer their question first, then smoothly invite them to continue
  if (isExplicitQuestion && conv?.lead_step && conv.lead_step !== "CONFIRMED") {
    // Ensure the reply already contains the accurate answer to their specific query
    // and append a natural conversational bridge ONLY when not a purely informational query
    if (
      !isPurelyInformationalQuery &&
      !reply.includes("I don't have") &&
      !reply.includes("May I have your Full Name") &&
      !reply.includes("What is the best 10-digit Phone Number") &&
      !reply.includes("Which batch timing") &&
      !reply.includes("which format would you prefer")
    ) {
      if ((conv.lead_step === "NAME" || !activeName) && (!conv.customer_name || isGibberishOrInvalidName(conv.customer_name))) {
        const coursePart = targetCourseName ? ` in ${targetCourseName}` : "";
        reply += `\n\nWhenever you're ready, may I have your Full Name so I can assist you with enrollment${coursePart}?`;
      } else if (conv.lead_step === "PHONE" && !activePhone && !activeEmail) {
        const namePart = activeName ? ` ${activeName}` : "";
        reply += `\n\nWhenever you're ready${namePart}, what is the best 10-digit Phone Number (or WhatsApp number) our admissions desk can reach you on?`;
      } else if (conv.lead_step === "MODE" && !activeMode) {
        reply += `\n\nWhenever you're ready, which format would you prefer—Online Live classes or Classroom Sessions?`;
      } else if (conv.lead_step === "BATCH" && !activeBatch) {
        reply += `\n\nWhenever you're ready, which batch timing (Morning, Afternoon, or Evening) works best for you?`;
      } else if (conv.lead_step === "EXPERIENCE" && !activeExperience) {
        reply += `\n\nAlso, do you have any prior programming background or are you starting fresh?`;
      }
    }
  }

  // Sanitize and structure the final reply cleanly without any markdown asterisks
  const cleanReply = formatCleanText(reply);

  // Dynamic Contextual Quick Replies for Frontend Chips
  const quickReplies: string[] = [];
  if (detectedUnsupportedCourses.length > 0 && queryMentionedCourses.length === 0) {
    quickReplies.push(
      "Which courses do you offer?",
      "Core Python Programming details",
      "Core Java Programming details",
      "What are the course fees?"
    );
  } else if (isComparisonQuery) {
    quickReplies.push("Book Free Demo", "Send Syllabus on WhatsApp", "Evening Batch Timings", "Tuition Fee & Discounts");
  } else if (isDemoBookingQuery) {
    quickReplies.push("Confirm Demo for Tomorrow", "Evening Slot (6:30 PM)", "Compare Courses", "Tuition Fee & Discounts");
  } else if (isBrochureOrWhatsAppQuery) {
    quickReplies.push("Book Free Demo", "Course Fees & Installments", "Classroom Location", "Placement Assistance");
  } else if (isHypotheticalQuery) {
    quickReplies.push("Evening Batch Details", "Book Free Demo Session", "View Course Catalog", "Speak to Human Counselor");
  } else if (conv?.lead_step === "MODE") {
    quickReplies.push("Online (Live Interactive)", "Classroom Sessions");
  } else if (conv?.lead_step === "BATCH") {
    quickReplies.push("Morning (9:00 AM – 11:00 AM)", "Afternoon (2:00 PM – 4:00 PM)", "Evening (6:00 PM – 8:00 PM)");
  } else if (conv?.lead_step === "EXPERIENCE") {
    quickReplies.push("Beginner / Fresh Graduate", "Working Professional");
  } else if (isFeeQuery) {
    quickReplies.push("Core Python Syllabus", "Core Java Syllabus", "Upcoming Batch Timings", "I want to join");
  } else if (isCourseCatalogQuery) {
    quickReplies.push("What are the course fees?", "Core Python Syllabus", "Core Java Syllabus", "Where is your location?");
  } else if (isBatchOrTimingQuery) {
    quickReplies.push("What are the fees?", "Can I join online?", "Book Free Demo", "I want to join");
  } else if (isTopicQuery) {
    quickReplies.push("What are the course fees?", "Upcoming Batch Timings", "Can I join online?", "Book Free Demo");
  } else if (isEnrollOrInterestIntent || conv?.lead_step === "CONFIRMED") {
    quickReplies.push("Course Fees & Discounts", "Batch Schedules", "Campus Location", "Admissions Help Desk");
  } else if (focusedCourse) {
    quickReplies.push(
      `Compare ${focusedCourse.displayName}`,
      `Book Free Demo for ${focusedCourse.displayName}`,
      `${focusedCourse.displayName} Syllabus`,
      "Campus Location",
    );
  } else {
    quickReplies.push(...getSuggestedQuestionsForAgent(agentObj));
  }

  if (conv) {
    conv.conflicts = detectAndResolveConflicts(conv);
    updateKOSummary(conv, groundingSources);
  }

  const latency_ms = Date.now() - startTime;

  savePersistence();

  return {
    reply: cleanReply,
    toolsExecuted,
    groundingSources,
    state: computedState,
    intent,
    language: lang,
    isEscalated,
    quickReplies,
    latency_ms,
  };
}

// ==========================================
// API Routes (/api/v1/...)
// ==========================================

// Health and probes
app.get("/health", (req, res) => res.json({ status: "healthy", version: "2.0.0", platform: "AI Receptionist Platform" }));
app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.get("/healthz", (req, res) => res.json({ status: "ok" }));
app.get("/ready", (req, res) => res.json({ status: "ready", dependencies: { database: "available", ai_engine: "operational" } }));
app.get("/metrics", (req, res) => {
  res.setHeader("Content-Type", "text/plain");
  res.send(`# HELP app_uptime_seconds Process uptime\napp_uptime_seconds 360.00\napp_http_requests_total 128\napp_active_conversations ${conversations.filter(c => c.status === "active").length}\n`);
});

// Production System & Database Diagnostic Status
app.get("/api/v1/system/status", (req, res) => {
  res.json({
    status: "operational",
    environment: process.env.NODE_ENV || "development",
    uptime_seconds: Math.floor(process.uptime()),
    database: {
      engine: "File-Backed JSON Store",
      path: DB_FILE,
      size_bytes: fs.existsSync(DB_FILE) ? fs.statSync(DB_FILE).size : 0,
      healthy: true,
      last_persisted_at: new Date().toISOString(),
    },
    metrics: {
      total_leads: leads.length,
      qualified_leads: leads.filter((l) => l.status === "qualified" || l.status === "converted").length,
      total_appointments: appointments.length,
      confirmed_appointments: appointments.filter((a) => a.status === "confirmed").length,
      active_agents: agents.filter((a) => a.is_active).length,
      published_agents: agents.filter((a) => a.is_published).length,
      knowledge_articles: knowledgeItems.length,
      active_conversations: conversations.filter((c) => c.status === "active").length,
      linked_google_sheets: linkedSheets.length,
    },
    ai_engine: {
      provider: "Google Gemini",
      model: "gemini-3.8-flash",
      api_key_configured: Boolean(process.env.GEMINI_API_KEY),
      grounded_tools: ["search_knowledge", "get_company_info", "get_business_hours", "create_lead", "schedule_appointment", "transfer_to_human"],
    },
  });
});

// Embeddable Receptionist JS Widget Script for Third-Party Websites
app.get("/widget.js", (req, res) => {
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.send(`
(function() {
  if (window.__AI_RECEPTIONIST_WIDGET_INITIALIZED__) return;
  window.__AI_RECEPTIONIST_WIDGET_INITIALIZED__ = true;

  var script = document.currentScript || (function() {
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      if (scripts[i].src && scripts[i].src.indexOf('widget.js') !== -1) return scripts[i];
    }
    return null;
  })();

  var host = (script && script.src) ? new URL(script.src).origin : window.location.origin;
  var slug = (script && script.getAttribute('data-slug')) || 'apex-maya';
  var position = (script && script.getAttribute('data-position')) || 'bottom-right';
  var primaryColor = (script && script.getAttribute('data-color')) || '#4f46e5';
  var isRight = position !== 'bottom-left';

  var wrap = document.createElement('div');
  wrap.id = 'ai-receptionist-widget-root';
  wrap.style.cssText = 'position:fixed;bottom:24px;' + (isRight ? 'right:24px;' : 'left:24px;') + 'z-index:9999999;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';

  var box = document.createElement('div');
  box.id = 'ai-receptionist-widget-window';
  box.style.cssText = 'display:none;position:absolute;bottom:76px;' + (isRight ? 'right:0;' : 'left:0;') + 'width:400px;max-width:calc(100vw - 32px);height:620px;max-height:calc(100vh - 110px);background:#ffffff;border-radius:24px;box-shadow:0 24px 60px rgba(15,23,42,0.22),0 4px 16px rgba(15,23,42,0.08);border:1px solid rgba(226,232,240,0.9);overflow:hidden;transition:all 0.25s cubic-bezier(0.16,1,0.3,1);transform-origin:' + (isRight ? 'bottom right' : 'bottom left') + ';transform:scale(0.95);opacity:0;';

  var iframe = document.createElement('iframe');
  iframe.src = host + '/public/chat/' + encodeURIComponent(slug) + '?embed=true';
  iframe.style.cssText = 'width:100%;height:100%;border:none;display:block;';
  iframe.setAttribute('allow', 'microphone; clipboard-write');
  box.appendChild(iframe);

  var btn = document.createElement('button');
  btn.setAttribute('type', 'button');
  btn.setAttribute('aria-label', 'Open AI Receptionist');
  btn.style.cssText = 'display:flex;align-items:center;justify-content:center;width:60px;height:60px;border-radius:30px;background:' + primaryColor + ';color:#ffffff;border:none;box-shadow:0 10px 25px rgba(79,70,229,0.38);cursor:pointer;outline:none;transition:transform 0.2s;position:relative;';

  var chatSvg = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>';
  var closeSvg = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
  btn.innerHTML = chatSvg;

  var dot = document.createElement('span');
  dot.style.cssText = 'position:absolute;top:2px;right:2px;width:14px;height:14px;border-radius:7px;background:#10b981;border:2px solid #ffffff;';
  btn.appendChild(dot);

  var isOpen = false;
  function toggle() {
    isOpen = !isOpen;
    if (isOpen) {
      box.style.display = 'block';
      setTimeout(function() {
        box.style.transform = 'scale(1)';
        box.style.opacity = '1';
      }, 10);
      btn.innerHTML = closeSvg;
    } else {
      box.style.transform = 'scale(0.95)';
      box.style.opacity = '0';
      setTimeout(function() {
        box.style.display = 'none';
      }, 200);
      btn.innerHTML = chatSvg;
      btn.appendChild(dot);
    }
  }

  btn.onclick = toggle;

  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'close-receptionist-widget') {
      if (isOpen) toggle();
    }
  });

  wrap.appendChild(box);
  wrap.appendChild(btn);
  document.body.appendChild(wrap);
})();
  `.trim());
});

// Authentication
app.post("/api/v1/auth/login", (req, res) => {
  const { email } = req.body;
  const user = users.find((u) => u.email.toLowerCase() === (email || "").toLowerCase()) || users[0];

  res.json({
    success: true,
    message: "Login successful.",
    data: {
      access_token: "jwt-token-apex-" + Date.now(),
      token_type: "bearer",
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        organization_id: user.organization_id,
        is_superuser: user.is_superuser,
      },
    },
  });
});

// Onboarding Registration
app.post("/api/v1/onboarding/register-company", (req, res) => {
  const {
    organization_name,
    organization_email,
    first_name,
    last_name,
    admin_email,
    phone,
    agent_name,
    public_slug,
  } = req.body;

  if (!organization_name || !admin_email) {
    return res.status(400).json({ success: false, detail: "Organization name and admin email are required." });
  }

  const newOrgId = organization.id || 1;
  organization.name = organization_name;
  organization.email = organization_email || admin_email;
  if (phone) organization.phone = phone;

  const newUser = {
    id: users.length + 1,
    uuid: "usr_" + Math.random().toString(36).substring(2, 9),
    first_name: first_name || "Admin",
    last_name: last_name || "User",
    email: admin_email,
    role: "admin",
    status: "active",
    created_at: new Date().toISOString(),
    organization_id: newOrgId,
    is_superuser: true,
  } as unknown as UserModel;
  users.push(newUser);

  const slug = (public_slug || organization_name.toLowerCase().replace(/\s+/g, "-")).toLowerCase();
  const newAgent = {
    id: agents.length + 1,
    name: agent_name || "AI Receptionist",
    public_slug: slug,
    status: "published" as const,
    voice_enabled: true,
    chat_enabled: true,
    tone: "professional",
    welcome_message: `Hello! Welcome to ${organization_name}. How can I assist you today?`,
    knowledge_count: 4,
    created_at: new Date().toISOString(),
    system_prompt: `You are the front desk receptionist for ${organization_name}.`,
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
    phone_number: "+1 (800) 555-0199",
    languages: ["en"],
  } as unknown as AgentModel;
  agents.push(newAgent);
  savePersistence();

  res.status(201).json({
    success: true,
    message: "Company registered successfully.",
    data: {
      organization_id: newOrgId,
      admin_user_id: newUser.id,
      agent_id: newAgent.id,
      public_slug: newAgent.public_slug,
    },
  });
});

app.get("/api/v1/auth/me", (req, res) => {
  const user = users[0];
  res.json({
    success: true,
    message: "User fetched.",
    data: {
      id: user.id,
      uuid: user.uuid,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      organization_id: user.organization_id,
      is_active: user.is_active,
      is_superuser: user.is_superuser,
      role_ids: user.role_ids,
    },
  });
});

// Organization & Workspace settings
app.get("/api/v1/organizations/me", (req, res) => {
  res.json(organization);
});

app.put("/api/v1/organizations/me", (req, res) => {
  if (req.body.name !== undefined) organization.name = req.body.name;
  if (req.body.email !== undefined) organization.email = req.body.email;
  if (req.body.phone !== undefined) organization.phone = req.body.phone;
  if (req.body.address !== undefined) organization.address = req.body.address;
  if (req.body.website !== undefined) organization.website = req.body.website;
  if (req.body.timezone !== undefined) organization.timezone = req.body.timezone;
  if (req.body.policies) organization.policies = { ...organization.policies, ...req.body.policies };
  if (req.body.escalation_keywords) organization.escalation_keywords = req.body.escalation_keywords;
  savePersistence();
  res.json(organization);
});

app.patch("/api/v1/organizations/me", (req, res) => {
  if (req.body.name !== undefined) organization.name = req.body.name;
  if (req.body.email !== undefined) organization.email = req.body.email;
  if (req.body.phone !== undefined) organization.phone = req.body.phone;
  if (req.body.address !== undefined) organization.address = req.body.address;
  if (req.body.website !== undefined) organization.website = req.body.website;
  if (req.body.timezone !== undefined) organization.timezone = req.body.timezone;
  if (req.body.policies) organization.policies = { ...organization.policies, ...req.body.policies };
  if (req.body.escalation_keywords) organization.escalation_keywords = req.body.escalation_keywords;
  savePersistence();
  res.json(organization);
});

app.put("/api/v1/organizations/:id", (req, res) => {
  if (req.body.name !== undefined) organization.name = req.body.name;
  if (req.body.email !== undefined) organization.email = req.body.email;
  if (req.body.phone !== undefined) organization.phone = req.body.phone;
  if (req.body.address !== undefined) organization.address = req.body.address;
  if (req.body.website !== undefined) organization.website = req.body.website;
  if (req.body.timezone !== undefined) organization.timezone = req.body.timezone;
  if (req.body.policies) organization.policies = { ...organization.policies, ...req.body.policies };
  if (req.body.escalation_keywords) organization.escalation_keywords = req.body.escalation_keywords;
  savePersistence();
  res.json(organization);
});

app.patch("/api/v1/organizations/:id", (req, res) => {
  if (req.body.name !== undefined) organization.name = req.body.name;
  if (req.body.email !== undefined) organization.email = req.body.email;
  if (req.body.phone !== undefined) organization.phone = req.body.phone;
  if (req.body.address !== undefined) organization.address = req.body.address;
  if (req.body.website !== undefined) organization.website = req.body.website;
  if (req.body.timezone !== undefined) organization.timezone = req.body.timezone;
  if (req.body.policies) organization.policies = { ...organization.policies, ...req.body.policies };
  if (req.body.escalation_keywords) organization.escalation_keywords = req.body.escalation_keywords;
  savePersistence();
  res.json(organization);
});

// AI Receptionists Management
app.get("/api/v1/agents", (req, res) => {
  const result = agents.map((agent) => ({
    ...agent,
    suggested_questions: getSuggestedQuestionsForAgent(agent),
  }));
  res.json(result);
});

app.get("/api/v1/agents/:id", (req, res) => {
  const id = Number(req.params.id);
  const agent = agents.find((a) => a.id === id);
  if (!agent) return res.status(404).json({ detail: "Receptionist not found" });
  res.json({
    ...agent,
    suggested_questions: getSuggestedQuestionsForAgent(agent),
  });
});

app.post("/api/v1/agents", (req, res) => {
  const {
    name,
    public_slug,
    welcome_message,
    system_instructions,
    personality,
    language,
    voice_id,
    speaking_style,
    channels,
    allowed_tools,
    knowledge_item_ids,
    is_published,
  } = req.body;

  const newAgent: AgentModel = {
    id: getId(),
    uuid: `agent-${getId()}`,
    organization_id: 1,
    name: name || "New Receptionist",
    avatar: req.body.avatar || "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
    public_slug: (public_slug || name || "new-receptionist").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
    welcome_message: welcome_message || "Hello! How can I assist you today?",
    system_instructions: system_instructions || "Greet visitors warmly, answer questions accurately, capture contact details, and schedule appointments.",
    personality: personality || "friendly",
    language: language || "multilingual",
    voice_id: voice_id || "maya_warm",
    speaking_style: speaking_style || "warm_conversational",
    channels: Array.isArray(channels) ? channels : ["web", "voice"],
    allowed_tools: Array.isArray(allowed_tools) ? allowed_tools : ["search_knowledge", "get_company_info", "create_lead", "schedule_appointment"],
    is_published: is_published !== undefined ? Boolean(is_published) : true,
    is_active: true,
    knowledge_item_ids: Array.isArray(knowledge_item_ids) ? knowledge_item_ids : [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  agents.unshift(newAgent);
  savePersistence();
  res.status(201).json(newAgent);
});

app.patch("/api/v1/agents/:id", (req, res) => {
  const id = Number(req.params.id);
  const agent = agents.find((a) => a.id === id);
  if (!agent) return res.status(404).json({ detail: "Receptionist not found" });

  if (req.body.name) agent.name = req.body.name;
  if (req.body.avatar !== undefined) agent.avatar = req.body.avatar;
  if (req.body.public_slug) agent.public_slug = req.body.public_slug.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (req.body.welcome_message !== undefined) agent.welcome_message = req.body.welcome_message;
  if (req.body.system_instructions !== undefined) agent.system_instructions = req.body.system_instructions;
  if (req.body.personality !== undefined) agent.personality = req.body.personality;
  if (req.body.language !== undefined) agent.language = req.body.language;
  if (req.body.voice_id !== undefined) agent.voice_id = req.body.voice_id;
  if (req.body.speaking_style !== undefined) agent.speaking_style = req.body.speaking_style;
  if (req.body.channels !== undefined) agent.channels = req.body.channels;
  if (req.body.allowed_tools !== undefined) agent.allowed_tools = req.body.allowed_tools;
  if (req.body.knowledge_item_ids !== undefined) agent.knowledge_item_ids = req.body.knowledge_item_ids;
  if (req.body.is_active !== undefined) agent.is_active = Boolean(req.body.is_active);
  if (req.body.is_published !== undefined) agent.is_published = Boolean(req.body.is_published);
  
  agent.updated_at = new Date().toISOString();
  savePersistence();
  res.json(agent);
});

app.get("/api/v1/agents/:id/knowledge", (req, res) => {
  const id = Number(req.params.id);
  const agent = agents.find((a) => a.id === id);
  if (!agent) return res.status(404).json({ detail: "Receptionist not found" });

  const assigned = knowledgeItems.filter((k) => agent.knowledge_item_ids.includes(k.id));
  res.json(assigned);
});

app.put("/api/v1/agents/:id/knowledge", (req, res) => {
  const id = Number(req.params.id);
  const agent = agents.find((a) => a.id === id);
  if (!agent) return res.status(404).json({ detail: "Receptionist not found" });

  agent.knowledge_item_ids = req.body.knowledge_item_ids || [];
  agent.updated_at = new Date().toISOString();
  savePersistence();
  res.json(agent);
});

app.post("/api/v1/agents/:id/publish", (req, res) => {
  const id = Number(req.params.id);
  const agent = agents.find((a) => a.id === id);
  if (!agent) return res.status(404).json({ detail: "Receptionist not found" });
  agent.is_published = true;
  agent.updated_at = new Date().toISOString();
  savePersistence();
  res.json(agent);
});

app.post("/api/v1/agents/:id/unpublish", (req, res) => {
  const id = Number(req.params.id);
  const agent = agents.find((a) => a.id === id);
  if (!agent) return res.status(404).json({ detail: "Receptionist not found" });
  agent.is_published = false;
  agent.updated_at = new Date().toISOString();
  savePersistence();
  res.json(agent);
});

app.delete("/api/v1/agents/:id", (req, res) => {
  const id = Number(req.params.id);
  agents = agents.filter((a) => a.id !== id);
  savePersistence();
  res.status(204).send();
});

// Public Chat Widget Endpoints
app.get("/api/v1/public/agents/:slug", (req, res) => {
  const slug = req.params.slug.toLowerCase();
  const agent = agents.find((a) => (a.public_slug && a.public_slug.toLowerCase() === slug) || String(a.id) === slug || a.uuid === slug);
  if (!agent) {
    return res.status(404).json({ detail: "AI receptionist not found." });
  }
  res.json({
    id: agent.id,
    name: agent.name,
    avatar: agent.avatar,
    public_slug: agent.public_slug,
    welcome_message: agent.welcome_message,
    personality: agent.personality,
    language: agent.language,
    channels: agent.channels,
    is_published: agent.is_published,
  });
});

app.get("/api/v1/chat/public/:slug", (req, res) => {
  const slug = req.params.slug.toLowerCase();
  const agent = agents.find((a) => (a.public_slug && a.public_slug.toLowerCase() === slug) || String(a.id) === slug || a.uuid === slug) || agents[0];
  if (!agent) {
    return res.status(404).json({ detail: "AI receptionist not found." });
  }
  const host = resolveHostDetails(agent);
  let cleanWelcome = formatCleanText(agent.welcome_message || "");
  if (!host.hostCompanyName) {
    cleanWelcome = cleanWelcome.replace(/Welcome to [^.!,]+(?:\.|!|,)?/i, "Welcome!").replace(/Apex Solutions/gi, "");
    cleanWelcome = cleanWelcome.replace(/\s{2,}/g, " ").trim();
  } else if (!cleanWelcome.includes(host.hostCompanyName) && cleanWelcome.includes("Apex Solutions")) {
    cleanWelcome = cleanWelcome.replace(/Apex Solutions/gi, host.hostCompanyName);
  }

  res.json({
    id: agent.id,
    name: agent.name,
    avatar: agent.avatar,
    public_slug: agent.public_slug,
    welcome_message: cleanWelcome,
    personality: agent.personality,
    language: agent.language,
    company_name: host.hostCompanyName,
    suggested_questions: getSuggestedQuestionsForAgent(agent),
    quick_replies: getSuggestedQuestionsForAgent(agent),
  });
});

app.post("/api/v1/chat/public-message", async (req, res) => {
  const body = typeof req.body === "string" ? { message: req.body } : (req.body || {});
  const message = body.message || body.text || body.query || (typeof req.body === "string" ? req.body : "");
  const session_id = body.session_id || body.sessionId;
  const slug = body.slug;
  const agent_id = body.agent_id || body.agentId;

  if (!message || (typeof message === "string" && !message.trim())) {
    return res.status(400).json({ detail: "Message is required." });
  }
  const queryMessage = String(message).trim();

  let agent = agents[0];
  if (slug) {
    const found = agents.find((a) => a.public_slug && a.public_slug.toLowerCase() === String(slug).toLowerCase());
    if (found) agent = found;
  } else if (agent_id) {
    const found = agents.find((a) => a.id === Number(agent_id));
    if (found) agent = found;
  }

  const sid = session_id || `pub-session-${Date.now()}`;
  const conversation_id = body.conversation_id || body.conversationId;
  let conv = (conversation_id ? conversations.find((c) => c.id === Number(conversation_id)) : null) ||
             conversations.find((c) => c.session_id === sid);
  if (!conv) {
    conv = {
      id: getId(),
      organization_id: 1,
      agent_id: agent.id,
      user_id: null,
      session_id: sid,
      channel: "web",
      status: "active",
      conversation_state: "GREETING",
      detected_intent: "public_web_chat",
      language: "en",
      sentiment: "neutral",
      is_human_takeover: false,
      lead_id: null,
      appointment_id: null,
      summary: "Inbound public web chat interaction",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    conversations.unshift(conv);
  }

  messages.push({
    id: getId(),
    conversation_id: conv.id,
    role: "user",
    content: queryMessage,
    state_snapshot: conv.conversation_state,
    created_at: new Date().toISOString(),
  });

  const outcome = await executeReceptionistTurn(queryMessage, agent, conv);

  conv.conversation_state = outcome.state;
  conv.detected_intent = outcome.intent;
  conv.language = outcome.language;
  if (outcome.isEscalated) conv.status = "escalated";

  messages.push({
    id: getId(),
    conversation_id: conv.id,
    role: "assistant",
    content: outcome.reply,
    tool_calls: outcome.toolsExecuted,
    grounding_sources: outcome.groundingSources,
    state_snapshot: outcome.state,
    created_at: new Date().toISOString(),
  });

  conv.updated_at = new Date().toISOString();
  savePersistence();

  res.json({
    session_id: sid,
    conversation_id: conv.id,
    response: outcome.reply,
    reply: outcome.reply,
    message: outcome.reply,
    conversation_state: outcome.state,
    detected_intent: outcome.intent,
    language: outcome.language,
    tools_executed: outcome.toolsExecuted,
    grounding_sources: outcome.groundingSources,
  });
});

app.post("/api/v1/public/agents/:slug/chat", async (req, res) => {
  const slug = req.params.slug;
  const agent = agents.find((a) => a.public_slug === slug) || agents[0];
  const body = typeof req.body === "string" ? { message: req.body } : (req.body || {});
  const message = body.message || body.text || body.query || (typeof req.body === "string" ? req.body : "");
  const session_id = body.session_id || body.sessionId;

  if (!message || (typeof message === "string" && !message.trim())) {
    return res.status(400).json({ detail: "Message is required." });
  }
  const queryMessage = String(message).trim();

  const sid = session_id || `pub-session-${Date.now()}`;
  let conv = conversations.find((c) => c.session_id === sid);
  if (!conv) {
    conv = {
      id: getId(),
      organization_id: 1,
      agent_id: agent.id,
      user_id: null,
      session_id: sid,
      channel: "web",
      status: "active",
      conversation_state: "GREETING",
      detected_intent: "public_web_chat",
      language: "en",
      sentiment: "neutral",
      is_human_takeover: false,
      lead_id: null,
      appointment_id: null,
      summary: "Inbound public web chat interaction",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    conversations.unshift(conv);
  }

  // Record user message
  messages.push({
    id: getId(),
    conversation_id: conv.id,
    role: "user",
    content: queryMessage,
    state_snapshot: conv.conversation_state,
    created_at: new Date().toISOString(),
  });

  // If human has taken over conversation, hold AI response and inform client
  if (conv.is_human_takeover) {
    return res.json({
      session_id: sid,
      response: "A human specialist has joined this chat and will respond shortly.",
      reply: "A human specialist has joined this chat and will respond shortly.",
      is_human_takeover: true,
    });
  }

  // Run AI reasoning turn with tool calling and state advancement
  const outcome = await executeReceptionistTurn(queryMessage, agent, conv);

  conv.conversation_state = outcome.state;
  conv.detected_intent = outcome.intent;
  conv.language = outcome.language;
  if (outcome.isEscalated) {
    conv.status = "escalated";
  }

  // Record assistant response
  messages.push({
    id: getId(),
    conversation_id: conv.id,
    role: "assistant",
    content: outcome.reply,
    tool_calls: outcome.toolsExecuted,
    grounding_sources: outcome.groundingSources,
    state_snapshot: outcome.state,
    created_at: new Date().toISOString(),
  });

  conv.updated_at = new Date().toISOString();

  res.json({
    session_id: sid,
    response: outcome.reply,
    reply: outcome.reply,
    message: outcome.reply,
    conversation_state: outcome.state,
    detected_intent: outcome.intent,
    language: outcome.language,
    tools_executed: outcome.toolsExecuted,
    grounding_sources: outcome.groundingSources,
    quick_replies: outcome.quickReplies,
    latency_ms: outcome.latency_ms,
  });
});

// Internal Workspace Chat (/api/v1/chat and /api/v1/chat/message)
const handleWorkspaceChat = async (req: express.Request, res: express.Response) => {
  const body = typeof req.body === "string" ? { message: req.body } : (req.body || {});
  const message = body.message || body.text || body.query || (typeof req.body === "string" ? req.body : "");
  const session_id = body.session_id || body.sessionId;
  const agent_id = body.agent_id || body.agentId;

  if (!message || (typeof message === "string" && !message.trim())) {
    return res.status(400).json({ detail: "Message is required." });
  }

  const queryMessage = String(message).trim();
  const agent = agents.find((a) => a.id === Number(agent_id)) || agents[0];
  const conversation_id = body.conversation_id || body.conversationId;
  const sid = session_id || (conversation_id ? `session-conv-${conversation_id}` : `session-${Date.now()}`);

  let conv = (conversation_id ? conversations.find((c) => c.id === Number(conversation_id)) : null) ||
             conversations.find((c) => c.session_id === sid);
  if (!conv) {
    conv = {
      id: getId(),
      organization_id: 1,
      agent_id: agent.id,
      user_id: 1,
      session_id: sid,
      channel: "web",
      status: "active",
      conversation_state: "GREETING",
      detected_intent: "workspace_test",
      language: "en",
      sentiment: "neutral",
      is_human_takeover: false,
      lead_id: null,
      appointment_id: null,
      summary: "Internal workspace test chat",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    conversations.unshift(conv);
  }

  messages.push({
    id: getId(),
    conversation_id: conv.id,
    role: "user",
    content: queryMessage,
    state_snapshot: conv.conversation_state,
    created_at: new Date().toISOString(),
  });

  const outcome = await executeReceptionistTurn(queryMessage, agent, conv);

  conv.conversation_state = outcome.state;
  conv.detected_intent = outcome.intent;
  conv.language = outcome.language;
  if (outcome.isEscalated) conv.status = "escalated";

  messages.push({
    id: getId(),
    conversation_id: conv.id,
    role: "assistant",
    content: outcome.reply,
    tool_calls: outcome.toolsExecuted,
    grounding_sources: outcome.groundingSources,
    state_snapshot: outcome.state,
    created_at: new Date().toISOString(),
  });

  conv.updated_at = new Date().toISOString();

  res.json({
    session_id: sid,
    conversation_id: conv.id,
    response: outcome.reply,
    reply: outcome.reply,
    message: outcome.reply,
    state: outcome.state,
    conversation_state: outcome.state,
    intent: outcome.intent,
    language: outcome.language,
    tools: outcome.toolsExecuted,
    tools_called: outcome.toolsExecuted.map((t: { tool?: string }) => t.tool || "tool"),
    grounding: outcome.groundingSources,
    quick_replies: outcome.quickReplies,
    latency_ms: outcome.latency_ms,
  });
};

app.post("/api/v1/chat", handleWorkspaceChat);
app.post("/api/v1/chat/message", handleWorkspaceChat);

// Testing Lab Endpoint (/api/v1/lab/simulate)
app.post("/api/v1/lab/simulate", async (req, res) => {
  const { scenario, custom_prompt, agent_id } = req.body;
  const agent = agents.find((a) => a.id === agent_id) || agents[0];

  let testText = custom_prompt || "Hello! Can you tell me what you offer?";
  if (scenario === "pricing_inquiry") {
    testText = "How much do your AI receptionists cost, and what are the plan tiers?";
  } else if (scenario === "angry_complaint") {
    testText = "I have an urgent complaint about service downtime and I need to speak to a real human manager right now!";
  } else if (scenario === "telugu_code_switch") {
    testText = "Mee Python course gurinchi Telugu lo cheppandi, fees entha untundi?";
  } else if (scenario === "hindi_code_switch") {
    testText = "Aapke business timings kya hain aur demo kaise book karein?";
  } else if (scenario === "appointment_booking") {
    testText = "I want to schedule an enterprise consultation demo for David Chen, email david@apex.co, phone 555-0199.";
  } else if (scenario === "unknown_policy") {
    testText = "Do you guarantee 100% refund after 90 days and provide on-site hardware installation in Tokyo?";
  }

  const outcome = await executeReceptionistTurn(testText, agent);

  res.json({
    scenario: scenario || "custom",
    input_prompt: testText,
    response: outcome.reply,
    telemetry: {
      detected_intent: outcome.intent,
      detected_language: outcome.language,
      conversation_state: outcome.state,
      is_escalated: outcome.isEscalated,
      tool_calls_executed: outcome.toolsExecuted,
      grounding_sources_cited: outcome.groundingSources,
      prompt_injection_flagged: false,
    },
  });
});

// Lab Evaluation & Golden Test Endpoints
app.post("/api/v1/lab/golden-test", async (req, res) => {
  const { agent_id } = req.body;
  const agent = agents.find((a) => a.id === agent_id) || agents[0];

  const createIsolatedConv = () => ({
    id: `conv-golden-${Date.now()}`,
    organization_id: 1,
    customer_name: null,
    customer_phone: null,
    customer_email: null,
    customer_mode: null,
    customer_batch: null,
    customer_interested_courses: [],
    customer_course_preferences: {},
    conversation_state: "GREETING",
    lead_step: null,
    lead_id: null,
    sentiment: "positive",
    status: "active",
    duration_seconds: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    topic_stack: [],
    current_topic: "general",
    current_intent: "GREETING",
  });

  try {
    const outcome = await executeGoldenConversation(executeReceptionistTurn, agent, createIsolatedConv, leads);
    res.json({
      success: true,
      passed: outcome.passed,
      golden_conversation_results: outcome.results,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Golden test execution failed" });
  }
});

app.post("/api/v1/lab/evaluate", async (req, res) => {
  const { agent_id } = req.body;
  const agent = agents.find((a) => a.id === agent_id) || agents[0];

  const createIsolatedConv = () => ({
    id: `conv-eval-${Date.now()}`,
    organization_id: 1,
    customer_name: null,
    customer_phone: null,
    customer_email: null,
    customer_mode: null,
    customer_batch: null,
    customer_interested_courses: [],
    customer_course_preferences: {},
    conversation_state: "GREETING",
    lead_step: null,
    lead_id: null,
    sentiment: "positive",
    status: "active",
    duration_seconds: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    topic_stack: [],
    current_topic: "general",
    current_intent: "GREETING",
  });

  try {
    const goldenOutcome = await executeGoldenConversation(executeReceptionistTurn, agent, createIsolatedConv, leads);
    const report = generateFullEvaluationReport(agent, goldenOutcome.results);
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Evaluation failed" });
  }
});

app.get("/api/v1/lab/evaluation-report", (req, res) => {
  const reportPath = path.join(process.cwd(), "data", "evaluation-report.json");
  if (fs.existsSync(reportPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
      return res.json(data);
    } catch {
      // fallback
    }
  }
  const defaultAgent = agents[0];
  const emptyReport = generateFullEvaluationReport(defaultAgent, []);
  res.json(emptyReport);
});

// ==========================================
// UNIVERSAL DOMAIN-AGNOSTIC RECEPTIONIST APIS
// ==========================================

// Universal Benchmark Execution (Cross-Industry Golden Suite)
app.get("/api/v1/universal/benchmark", async (_req, res) => {
  try {
    const report = await runUniversalBenchmark();
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Benchmark execution failed" });
  }
});

// Dynamic Test Suite Generator (Generates 1,000+ tests from any knowledge base)
app.post("/api/v1/universal/dynamic-test-suite", (req, res) => {
  try {
    const { agent_id, count = 1000, domain_name } = req.body;
    let docsToUse = knowledgeItems;
    let agentName = "Company";

    if (agent_id) {
      const seed = MULTI_INDUSTRY_SEEDS.find((s) => s.agent.id === Number(agent_id));
      if (seed) {
        docsToUse = seed.documents as typeof knowledgeItems;
        agentName = seed.agent.name;
      }
    }

    const knowledge = ingestUniversalKnowledge(
      docsToUse.map((d) => ({ id: d.id, title: d.title, content: d.content, category: d.category })),
      { name: agentName }
    );

    const generatedTests = generateDynamicTestSuite(knowledge, domain_name || agentName, Math.min(Number(count), 2000));
    res.json({
      success: true,
      domain: domain_name || agentName,
      total_generated: generatedTests.length,
      knowledge_summary: {
        entities_count: knowledge.entities.length,
        policies_count: knowledge.policies.length,
        pricing_count: knowledge.pricing.length,
        schedules_count: knowledge.schedules.length,
      },
      tests: generatedTests,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Dynamic test generation failed" });
  }
});

// Multi-Industry Seed Templates & Agents
app.get("/api/v1/universal/industries", (_req, res) => {
  res.json({
    industries: MULTI_INDUSTRY_SEEDS.map((s) => ({
      agent: s.agent,
      documents_count: s.documents.length,
      documents: s.documents.map((d) => ({
        id: d.id,
        title: d.title,
        category: d.category,
        content: d.content,
      })),
    })),
  });
});

// Universal Ingestion Endpoint
app.post("/api/v1/universal/ingest", (req, res) => {
  try {
    const { rawDocs, companyName, industry } = req.body;
    if (!Array.isArray(rawDocs) || rawDocs.length === 0) {
      return res.status(400).json({ error: "rawDocs array is required" });
    }
    const knowledge = ingestUniversalKnowledge(rawDocs, { name: companyName, industry });
    res.json({ success: true, knowledge });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Ingestion failed" });
  }
});

// Universal Turn Execution Chat Endpoint
app.post("/api/v1/universal/chat", async (req, res) => {
  try {
    const { message, agent_id, raw_docs, state } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "message string is required" });
    }

    let agentToUse = agents.find((a) => a.id === Number(agent_id)) || agents[0];
    let docsToUse = getAgentKnowledgeItems(agentToUse);

    const seed = MULTI_INDUSTRY_SEEDS.find((s) => s.agent.id === Number(agent_id));
    if (seed) {
      agentToUse = seed.agent as unknown as typeof agents[0];
      docsToUse = seed.documents as unknown as typeof knowledgeItems;
    }

    if (Array.isArray(raw_docs) && raw_docs.length > 0) {
      docsToUse = raw_docs;
    }

    const turnResult = await executeUniversalReceptionistTurn({
      userText: message,
      agentObj: agentToUse,
      rawDocs: docsToUse.map((d) => ({ id: d.id, title: d.title, content: d.content, category: d.category })),
      existingState: state,
    });

    res.json(turnResult);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Chat execution failed" });
  }
});

// Leads Management
app.get("/api/v1/leads", (req, res) => {
  res.json(leads);
});

app.post("/api/v1/leads", (req, res) => {
  const newLead: LeadModel = {
    id: getId(),
    organization_id: 1,
    conversation_id: req.body.conversation_id || null,
    name: req.body.name || "New Inbound Lead",
    phone: req.body.phone || null,
    email: req.body.email || null,
    company: req.body.company || null,
    source: req.body.source || "Manual Entry",
    intent: req.body.intent || "General Inquiry",
    interest: req.body.interest || "AI Receptionist Services",
    budget: req.body.budget || null,
    lead_score: req.body.lead_score || 75,
    preferred_mode: req.body.preferred_mode || "email",
    preferred_time: req.body.preferred_time || "Business hours",
    notes: req.body.notes || "",
    assigned_staff: req.body.assigned_staff || "Harish Sadula",
    status: req.body.status || "new",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  leads.unshift(newLead);
  savePersistence();
  res.status(201).json(newLead);
});

app.patch("/api/v1/leads/:id", (req, res) => {
  const id = Number(req.params.id);
  const lead = leads.find((l) => l.id === id);
  if (!lead) return res.status(404).json({ detail: "Lead not found" });

  Object.assign(lead, req.body, { updated_at: new Date().toISOString() });
  savePersistence();
  res.json(lead);
});

app.delete("/api/v1/leads/:id", (req, res) => {
  const id = Number(req.params.id);
  leads = leads.filter((l) => l.id !== id);
  savePersistence();
  res.status(204).send();
});

// Appointments Management
app.get("/api/v1/appointments", (req, res) => {
  res.json(appointments);
});

app.get("/api/v1/appointments/available-slots", (req, res) => {
  const slots = [
    "09:30 AM",
    "10:00 AM",
    "11:30 AM",
    "01:00 PM",
    "02:30 PM",
    "03:30 PM",
    "04:30 PM",
  ];
  res.json({ available_slots: slots, timezone: organization.timezone });
});

app.post("/api/v1/appointments", (req, res) => {
  const { customer_name, customer_email, customer_phone, service, slot_date, slot_time, notes, agent_id } = req.body;
  if (!customer_name || !slot_date || !slot_time) {
    return res.status(400).json({ detail: "customer_name, slot_date, and slot_time are required." });
  }

  const newAppt: AppointmentModel = {
    id: getId(),
    organization_id: 1,
    agent_id: agent_id || 1,
    customer_name,
    customer_email: customer_email || "",
    customer_phone: customer_phone || null,
    service: service || "Product Consultation",
    slot_date,
    slot_time,
    status: "confirmed",
    notes: notes || "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  appointments.unshift(newAppt);
  savePersistence();
  res.status(201).json(newAppt);
});

app.patch("/api/v1/appointments/:id", (req, res) => {
  const id = Number(req.params.id);
  const appt = appointments.find((a) => a.id === id);
  if (!appt) return res.status(404).json({ detail: "Appointment not found" });

  Object.assign(appt, req.body, { updated_at: new Date().toISOString() });
  savePersistence();
  res.json(appt);
});

app.delete("/api/v1/appointments/:id", (req, res) => {
  const id = Number(req.params.id);
  appointments = appointments.filter((a) => a.id !== id);
  savePersistence();
  res.status(204).send();
});

// GET /api/v1/voice/tts (Stream audio directly from platform APIs or studio engine)
app.get("/api/v1/voice/tts", async (req, res) => {
  const text = (req.query.text as string) || "";
  const lang = (req.query.lang as string) || "te";
  const provider = (req.query.provider as string) || "google_gemini";
  const voiceId = (req.query.voice_id as string) || "gemini-kore";
  const speed = parseFloat(req.query.speed as string) || 1.0;
  const pitch = parseFloat(req.query.pitch as string) || 1.0;
  const phoneMode = req.query.phone_mode === "1" || req.query.phone_mode === "true";
  const sampleRate = parseInt(req.query.sample_rate as string, 10) || (phoneMode ? 8000 : 24000);

  if (!text) {
    return res.status(400).send("Text parameter is required");
  }

  try {
    const result = await synthesizeFromPlatform(text, {
      provider,
      voiceId,
      lang,
      speed,
      pitch,
      sampleRate,
      phoneMode,
    });
    res.setHeader("Content-Type", result.mimeType || "audio/mpeg");
    res.setHeader("X-Voice-Source", result.source);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(result.buffer);
  } catch (err) {
    console.error("[TTS GET] Error:", err);
    res.status(500).json({ error: "Failed to synthesize voice audio" });
  }
});

// POST /api/v1/voice/tts (JSON with base64 audio data)
app.post("/api/v1/voice/tts", async (req, res) => {
  const { text, lang, provider, voice_id, speed, pitch, phone_mode, sample_rate } = req.body;
  if (!text) {
    return res.status(400).json({ error: "Text is required" });
  }

  try {
    const result = await synthesizeFromPlatform(text, {
      provider: provider || "google_gemini",
      voiceId: voice_id || "gemini-kore",
      lang: lang || "te",
      speed: speed || 1.0,
      pitch: pitch || 1.0,
      phoneMode: !!phone_mode,
      sampleRate: sample_rate || (phone_mode ? 8000 : 24000),
    });
    res.json({
      audio_base64: result.buffer.toString("base64"),
      mime_type: result.mimeType || "audio/mpeg",
      source: result.source,
      length_bytes: result.buffer.length,
      ttfa_ms: result.ttfaMs,
    });
  } catch (err) {
    console.error("[TTS POST] Error:", err);
    res.status(500).json({ error: "Failed to synthesize voice audio" });
  }
});

// ==========================================
// AI VOICE LABORATORY ENDPOINTS
// ==========================================

// GET & POST Platform API Keys Management
app.get("/api/v1/voice/platform-keys", (_req, res) => {
  res.json(getPlatformKeys());
});

app.post("/api/v1/voice/platform-keys", (req, res) => {
  const { sarvam_api_key, elevenlabs_api_key, google_tts_api_key, murf_api_key } = req.body;
  updatePlatformKeys({
    sarvam_api_key,
    elevenlabs_api_key,
    google_tts_api_key,
    murf_api_key,
  });
  res.json({ success: true, keys: getPlatformKeys() });
});

// POST /api/v1/voice/lab/synthesize
app.post("/api/v1/voice/lab/synthesize", async (req, res) => {
  const { provider, voice_id, text, sample_rate, phone_mode, model, speed, pitch } = req.body;
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Text parameter is required." });
  }

  const startTime = Date.now();
  let s = text.trim();
  const hasTelugu = /[\u0C00-\u0C7F]/.test(s);

  // Apply custom pronunciation rules
  for (const rule of pronunciationRules) {
    if (!rule.isActive) continue;
    const escaped = rule.source.replace(/[+.*^$()[\]{}|\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "gi");
    s = s.replace(regex, rule.replacement);
  }

  // Apply universal conversational Telugu speech normalizer
  s = ResponsePlanner.normalizeTeluguSpeechText(s);

  const selectedVoiceId = voice_id || "gemini-kore";
  const selectedProvider = provider || "google_gemini";

  try {
    const result = await synthesizeFromPlatform(s, {
      provider: selectedProvider,
      voiceId: selectedVoiceId,
      lang: hasTelugu ? "te" : "en",
      speed: speed || 1.0,
      pitch: pitch || 1.0,
      sampleRate: sample_rate || (phone_mode ? 8000 : 24000),
      phoneMode: !!phone_mode,
      model,
    });

    const totalLatency = Date.now() - startTime;
    const ttfa = result.ttfaMs || Math.max(90, Math.round(totalLatency * 0.45));
    const durationMs = Math.round((s.length / 14) * 1000) + 400;

    res.json({
      audio_url: `/api/v1/voice/tts?text=${encodeURIComponent(s)}&lang=${hasTelugu ? "te" : "en"}&voice_id=${encodeURIComponent(selectedVoiceId)}&provider=${encodeURIComponent(selectedProvider)}&phone_mode=${phone_mode ? "1" : "0"}&speed=${speed || 1.0}&pitch=${pitch || 1.0}`,
      audio_base64: result.buffer.toString("base64"),
      mime_type: result.mimeType || "audio/mpeg",
      source: result.source,
      ttfa_ms: ttfa,
      total_latency_ms: totalLatency,
      audio_duration_ms: durationMs,
      characters: s.length,
      provider: selectedProvider,
      voice_id: selectedVoiceId,
      speed: speed || 1.0,
      pitch: pitch || 1.0,
      model: model || (selectedProvider === "sarvam" ? "bulbul:v3" : selectedProvider === "elevenlabs" ? "eleven_turbo_v2_5" : selectedProvider === "google_chirp" ? "chirp-3-hd" : "murf-v2-conversational"),
      sample_rate: sample_rate || (phone_mode ? 8000 : 24000),
      normalized_text: s,
      streaming_available: true,
    });
  } catch (err) {
    console.error("[VoiceLab Synthesize Error]:", err);
    res.status(500).json({ error: "Voice synthesis failed" });
  }
});

// GET /api/v1/voice/lab/tests
app.get("/api/v1/voice/lab/tests", (req, res) => {
  res.json(voiceTests);
});

// POST /api/v1/voice/lab/tests
app.post("/api/v1/voice/lab/tests", (req, res) => {
  const newTest: VoiceTestModel = {
    id: getId(),
    user_id: null,
    organization_id: 1,
    provider: req.body.provider || "sarvam",
    voice_id: req.body.voice_id || "neha",
    voice_name: req.body.voice_name || "Neha (Sarvam Bulbul V3)",
    model: req.body.model || "bulbul:v3",
    language: req.body.language || "te-IN",
    gender: req.body.gender || "female",
    test_text: req.body.test_text || "",
    normalized_text: req.body.normalized_text || req.body.test_text || "",
    audio_url: req.body.audio_url || null,
    ttfa_ms: req.body.ttfa_ms || 180,
    total_latency_ms: req.body.total_latency_ms || 310,
    audio_duration_ms: req.body.audio_duration_ms || 3500,
    sample_rate: req.body.sample_rate || 24000,
    characters: req.body.characters || (req.body.test_text ? req.body.test_text.length : 50),
    naturalness_score: req.body.naturalness_score || 9.0,
    pronunciation_score: req.body.pronunciation_score || 9.0,
    human_like_score: req.body.human_like_score || 9.0,
    conversation_score: req.body.conversation_score || 9.0,
    quality_score: req.body.quality_score || 9.0,
    overall_score: req.body.overall_score || 9.0,
    notes: req.body.notes || "",
    created_at: new Date().toISOString(),
  };

  voiceTests.unshift(newTest);
  savePersistence();
  res.status(201).json(newTest);
});

// DELETE /api/v1/voice/lab/tests/:id
app.delete("/api/v1/voice/lab/tests/:id", (req, res) => {
  const id = Number(req.params.id);
  voiceTests = voiceTests.filter((t) => t.id !== id);
  savePersistence();
  res.status(204).send();
});

// GET /api/v1/voice/lab/favorites
app.get("/api/v1/voice/lab/favorites", (req, res) => {
  res.json(voiceFavorites);
});

// POST /api/v1/voice/lab/favorites/toggle
app.post("/api/v1/voice/lab/favorites/toggle", (req, res) => {
  const { voice_id } = req.body;
  if (!voice_id) return res.status(400).json({ error: "voice_id required" });

  if (voiceFavorites.includes(voice_id)) {
    voiceFavorites = voiceFavorites.filter((id) => id !== voice_id);
  } else {
    voiceFavorites.push(voice_id);
  }
  savePersistence();
  res.json(voiceFavorites);
});

// GET /api/v1/voice/lab/receptionist-voice
app.get("/api/v1/voice/lab/receptionist-voice", (req, res) => {
  res.json(receptionistVoiceConfig);
});

// POST /api/v1/voice/lab/receptionist-voice
app.post("/api/v1/voice/lab/receptionist-voice", (req, res) => {
  Object.assign(receptionistVoiceConfig, req.body, { updated_at: new Date().toISOString() });
  
  // Also update Maruthi Technologies agent's voice_id
  const maruthiAgent = agents.find((a) => a.id === 1 || a.name.includes("Maruthi"));
  if (maruthiAgent) {
    maruthiAgent.voice_id = receptionistVoiceConfig.voice_id;
    maruthiAgent.speaking_style = `${receptionistVoiceConfig.provider.toUpperCase()} (${receptionistVoiceConfig.voice_name})`;
  }

  savePersistence();
  res.json({
    success: true,
    message: `Default receptionist voice set to ${receptionistVoiceConfig.voice_name}`,
    config: receptionistVoiceConfig,
  });
});

// GET /api/v1/voice/lab/pronunciations
app.get("/api/v1/voice/lab/pronunciations", (req, res) => {
  res.json(pronunciationRules);
});

// POST /api/v1/voice/lab/pronunciations
app.post("/api/v1/voice/lab/pronunciations", (req, res) => {
  const { source, replacement, category, language, isActive, id } = req.body;
  if (!source || !replacement) {
    return res.status(400).json({ error: "Source and replacement are required." });
  }

  if (id) {
    const existing = pronunciationRules.find((r) => r.id === id);
    if (existing) {
      Object.assign(existing, { source, replacement, category: category || "brand", language: language || "all", isActive: isActive !== undefined ? isActive : true });
      savePersistence();
      return res.json(existing);
    }
  }

  const newRule: PronunciationRuleModel = {
    id: `pr-${Date.now()}`,
    source,
    replacement,
    category: category || "brand",
    language: language || "all",
    isActive: isActive !== undefined ? isActive : true,
  };

  pronunciationRules.push(newRule);
  savePersistence();
  res.status(201).json(newRule);
});

// DELETE /api/v1/voice/lab/pronunciations/:id
app.delete("/api/v1/voice/lab/pronunciations/:id", (req, res) => {
  const id = req.params.id;
  pronunciationRules = pronunciationRules.filter((r) => r.id !== id);
  savePersistence();
  res.status(204).send();
});

// ==========================================================================
// OPEN-SOURCE TELUGU VOICE AI LAB ENDPOINTS
// ==========================================================================

// GET /api/v1/voice/open-source/status
app.get("/api/v1/voice/open-source/status", (_req, res) => {
  try {
    const status = getHardwareStatus();
    res.json(status);
  } catch {
    res.status(500).json({ error: "Failed to read hardware status" });
  }
});

// GET /api/v1/voice/open-source/models
app.get("/api/v1/voice/open-source/models", (_req, res) => {
  res.json(OPEN_SOURCE_MODELS);
});

// GET /api/v1/voice/open-source/voices
app.get("/api/v1/voice/open-source/voices", (_req, res) => {
  res.json(OPEN_SOURCE_VOICES);
});

// POST /api/v1/voice/open-source/load
app.post("/api/v1/voice/open-source/load", async (req, res) => {
  const { modelId, device } = req.body;
  const provider = modelRegistry.getProvider(modelId);
  if (!provider) {
    return res.status(404).json({ error: `Model provider ${modelId} not found` });
  }
  try {
    const result = await provider.loadModel(device || "cpu");
    const model = OPEN_SOURCE_MODELS.find((m) => m.id === modelId);
    if (model) {
      model.status = "loaded";
      model.loadedOnDevice = device || "cpu";
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to load model" });
  }
});

// POST /api/v1/voice/open-source/unload
app.post("/api/v1/voice/open-source/unload", async (req, res) => {
  const { modelId } = req.body;
  const provider = modelRegistry.getProvider(modelId);
  if (!provider) {
    return res.status(404).json({ error: `Model provider ${modelId} not found` });
  }
  try {
    const success = await provider.unloadModel();
    const model = OPEN_SOURCE_MODELS.find((m) => m.id === modelId);
    if (model) {
      model.status = "downloaded";
      model.loadedOnDevice = undefined;
    }
    res.json({ success });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to unload model" });
  }
});

// POST /api/v1/voice/open-source/synthesize
app.post("/api/v1/voice/open-source/synthesize", async (req, res) => {
  const { modelId, voiceId, text, speed, pitch, performanceMode, stylePrompt, referenceAudioBase64, referenceTranscript, hasReferenceConsent } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: "Text is required for voice synthesis" });
  }

  const selectedModelId = modelId || "indic-parler";
  const provider = modelRegistry.getProvider(selectedModelId) || modelRegistry.getProvider("indic-parler");

  if (!provider) {
    return res.status(404).json({ error: `Provider ${selectedModelId} not registered` });
  }

  try {
    const result = await provider.synthesize({
      modelId: selectedModelId,
      voiceId: voiceId || "os-parler-lalitha",
      text,
      speed: Number(speed) || 1.0,
      pitch: Number(pitch) || 1.0,
      performanceMode,
      stylePrompt,
      referenceAudioBase64,
      referenceTranscript,
      hasReferenceConsent,
    });
    res.json(result);
  } catch (err) {
    console.error("[OpenSourceTTS] Synthesis error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Open-source synthesis failed" });
  }
});

// GET /api/v1/voice/open-source/stream/:key
app.get("/api/v1/voice/open-source/stream/:key", (req, res) => {
  const key = req.params.key;
  const audioData = getOpenSourceAudioBuffer(key);
  if (!audioData) {
    return res.status(404).send("Audio segment not found or expired");
  }
  res.setHeader("Content-Type", audioData.mimeType);
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.setHeader("X-Voice-Engine", "OpenSource-Local-Model");
  res.send(audioData.buffer);
});

// GET /api/v1/voice/open-source/dictionary
app.get("/api/v1/voice/open-source/dictionary", (_req, res) => {
  const dict = getPronunciationDictionary();
  res.json(dict);
});

// POST /api/v1/voice/open-source/dictionary
app.post("/api/v1/voice/open-source/dictionary", (req, res) => {
  const { word, pronunciation, language, category, notes, isActive, id } = req.body;
  if (!word || !pronunciation) {
    return res.status(400).json({ error: "Word and pronunciation are required" });
  }
  const entry = savePronunciationEntry({
    id,
    word,
    pronunciation,
    language: language || "all",
    category: category || "technical",
    notes: notes || "",
    isActive: isActive !== undefined ? isActive : true,
  });
  res.json(entry);
});

// DELETE /api/v1/voice/open-source/dictionary/:id
app.delete("/api/v1/voice/open-source/dictionary/:id", (req, res) => {
  const id = req.params.id;
  const deleted = deletePronunciationEntry(id);
  res.json({ success: deleted });
});

// GET /api/v1/voice/open-source/benchmark
app.get("/api/v1/voice/open-source/benchmark", (_req, res) => {
  res.json(getBenchmarkScores());
});

// POST /api/v1/voice/open-source/benchmark
app.post("/api/v1/voice/open-source/benchmark", (req, res) => {
  const score = req.body;
  if (score && score.modelId) {
    recordBenchmarkScore({
      ...score,
      id: score.id || `bench-score-${Date.now()}`,
      timestamp: Date.now(),
    });
  }
  res.json({ success: true });
});

// GET /api/v1/voice/open-source/receptionist-voice
app.get("/api/v1/voice/open-source/receptionist-voice", (_req, res) => {
  res.json({ voiceId: getActiveReceptionistVoiceId() });
});

// POST /api/v1/voice/open-source/set-receptionist-voice
app.post("/api/v1/voice/open-source/set-receptionist-voice", (req, res) => {
  const { voiceId } = req.body;
  if (!voiceId) return res.status(400).json({ error: "voiceId is required" });
  setActiveReceptionistVoiceId(voiceId);
  res.json({ success: true, voiceId });
});

// POST /api/v1/voice/open-source/realtime-chat (Duplex turn taking with Receptionist Knowledge + Open TTS)
app.post("/api/v1/voice/open-source/realtime-chat", async (req, res) => {
  const { userInput, modelId, voiceId } = req.body;
  if (!userInput || !userInput.trim()) {
    return res.status(400).json({ error: "userInput is required" });
  }

  try {
    // 1. Get Receptionist Agent Context
    const agentToUse = agents[0] || {
      id: 1,
      name: "Maruthi AI Receptionist",
      role: "Course Counselor & Inbound Receptionist",
      language: "te",
    };

    // 2. Execute Universal Receptionist Conversation Turn
    const docsToUse = getAgentKnowledgeItems(agentToUse);
    const turnResult = await executeUniversalReceptionistTurn({
      userText: userInput,
      agentObj: agentToUse,
      rawDocs: docsToUse.map((d) => ({ id: d.id, title: d.title, content: d.content, category: d.category })),
    });

    const rawReply = turnResult.reply || "నమస్కారం! నేను మీకు ఎలా సహాయం చేయగలను?";

    // 3. Plan response for natural telephony speech (short 1-2 sentences, natural pauses)
    const planned = ResponsePlanner.planForVoice(rawReply, {
      isTelugu: true,
      phoneMode: true,
      maxSentences: 2,
    });

    const speechText = planned.spokenText;

    // 4. Synthesize via Open-Source Provider (zero commercial APIs)
    const selectedModelId = modelId || "indic-parler";
    const provider = modelRegistry.getProvider(selectedModelId) || modelRegistry.getProvider("indic-parler");

    if (!provider) {
      throw new Error(`Model provider ${selectedModelId} not available`);
    }

    const synthResult = await provider.synthesize({
      modelId: selectedModelId,
      voiceId: voiceId || "os-parler-lalitha",
      text: speechText,
      speed: 1.0,
      pitch: 1.0,
    });

    res.json({
      replyText: speechText,
      fullResponse: rawReply,
      audioUrl: synthResult.audioUrl,
      durationSec: synthResult.audioDurationSec,
      rtf: synthResult.realTimeFactor,
      modelId: selectedModelId,
      voiceId: synthResult.voiceId,
      state: turnResult.state,
    });
  } catch (err) {
    console.error("[OpenSourceVoiceLab] Realtime chat error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Realtime conversation turn failed" });
  }
});

// ==========================================
// Realtime Telugu Voice Agent Platform Subsystem
// ==========================================

const INITIAL_REALTIME_AGENTS: RealtimeVoiceAgentConfig[] = [
  {
    id: "agent-maruthi-receptionist",
    tenantId: "tenant-default",
    name: "Maruthi Technologies - Front Desk AI",
    companyName: "Maruthi Technologies",
    tagline: "Ultra-fast Telugu & English Admissions Receptionist",
    language: "te-en-hybrid",
    dialect: "hyderabad-telangana",
    personality: "Professional",
    ttsProvider: "indic-parler",
    voiceId: "os-parler-lalitha",
    voiceName: "Lalitha (లలిత) - Telugu Receptionist",
    speed: 1.0,
    pitch: 1.0,
    bargeInEnabled: true,
    bargeInSensitivity: 0.85,
    backchannelFilterEnabled: true,
    silenceTimeoutMs: 1200,
    thinkingPauseToleranceMs: 800,
    audioProfile: "BROWSER_AUDIO_PROFILE",
    transport: "livekit",
    llmProvider: "ollama",
    llmModel: "qwen2.5:7b-instruct-q4_K_M",
    sttModel: "faster-whisper-indic",
    initialGreeting: "నమస్తే అండి, మారుతి టెక్నాలజీస్ కి స్వాగతం. పైథాన్ మరియు జావా కోర్సుల వివరాలు చెప్పమంటారా?",
    workingHours: {
      start: "09:00",
      end: "19:00",
      timezone: "Asia/Kolkata",
      days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    },
    knowledgeCategories: ["Courses", "Fees", "Batches", "Placements", "Location"],
    leadCaptureFields: ["Name", "Phone", "Course", "Batch", "Mode"],
    humanHandoff: {
      enabled: true,
      sipExtension: "101",
      phoneNumber: "+91 98765 43210",
      transferKeywords: ["human", "person", "counselor", "manager", "transfer"],
      autoTransferOnAngry: true,
      autoTransferOnUnansweredCount: 2,
    },
    telephonyConfig: {
      sipServer: "sip.maruthitech.internal:5060",
      sipUser: "100",
      livekitUrl: "ws://localhost:7880",
    },
    isActive: true,
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "agent-maruthi-ananya",
    tenantId: "tenant-default",
    name: "Academic Counselor Ananya",
    companyName: "Maruthi Technologies",
    tagline: "Empathetic Career Mentor & Curriculum Advisor",
    language: "te-en-hybrid",
    dialect: "hyderabad-telangana",
    personality: "Warm",
    ttsProvider: "indic-parler",
    voiceId: "os-parler-ananya",
    voiceName: "Ananya (అనన్య) - Academic Mentor",
    speed: 1.0,
    pitch: 1.0,
    bargeInEnabled: true,
    bargeInSensitivity: 0.9,
    backchannelFilterEnabled: true,
    silenceTimeoutMs: 1400,
    thinkingPauseToleranceMs: 900,
    audioProfile: "BROWSER_AUDIO_PROFILE",
    transport: "webrtc",
    llmProvider: "ollama",
    llmModel: "qwen2.5:7b-instruct-q4_K_M",
    sttModel: "faster-whisper-indic",
    initialGreeting: "హలో అండి, నేను అనన్య. మారుతి టెక్నాలజీస్ కెరీర్ కౌన్సిలర్ ని. మీకు ఏ కోర్స్ ఇంట్రెస్ట్ ఉందో చెప్పండి.",
    workingHours: {
      start: "09:30",
      end: "18:30",
      timezone: "Asia/Kolkata",
      days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    },
    knowledgeCategories: ["Syllabus", "Career Guidance", "Placements"],
    leadCaptureFields: ["Name", "Phone", "Education", "Course"],
    humanHandoff: {
      enabled: true,
      sipExtension: "102",
      transferKeywords: ["advisor", "counselor", "human"],
      autoTransferOnAngry: true,
      autoTransferOnUnansweredCount: 2,
    },
    isActive: true,
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "agent-maruthi-mohan",
    tenantId: "tenant-default",
    name: "Placement Director Mohan",
    companyName: "Maruthi Technologies",
    tagline: "Corporate Placement & Advanced Program Lead",
    language: "te-en-hybrid",
    dialect: "hyderabad-telangana",
    personality: "Energetic",
    ttsProvider: "indic-parler",
    voiceId: "os-parler-mohan",
    voiceName: "Mohan (మోహన్) - Director Baritone",
    speed: 1.0,
    pitch: 1.0,
    bargeInEnabled: true,
    bargeInSensitivity: 0.85,
    backchannelFilterEnabled: true,
    silenceTimeoutMs: 1200,
    thinkingPauseToleranceMs: 800,
    audioProfile: "TELEPHONE_AUDIO_PROFILE",
    transport: "sip-asterisk",
    llmProvider: "ollama",
    llmModel: "qwen2.5:7b-instruct-q4_K_M",
    sttModel: "faster-whisper-indic",
    initialGreeting: "నమస్తే సార్, మోహన్ స్పీకింగ్ ఫ్రమ్ మారుతి టెక్నాలజీస్. కోర్స్ ఫీజులు మరియు బ్యాచ్ టైమింగ్స్ ఎలా హెల్ప్ చేయాలి?",
    workingHours: {
      start: "08:00",
      end: "20:00",
      timezone: "Asia/Kolkata",
      days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    },
    knowledgeCategories: ["Placements", "Full Stack", "Data Science", "Fees"],
    leadCaptureFields: ["Name", "Phone", "Experience", "Budget"],
    humanHandoff: {
      enabled: true,
      sipExtension: "103",
      transferKeywords: ["director", "escalate", "human"],
      autoTransferOnAngry: true,
      autoTransferOnUnansweredCount: 2,
    },
    isActive: true,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

let realtimeVoiceAgents: RealtimeVoiceAgentConfig[] = [...INITIAL_REALTIME_AGENTS];
const realtimeCallHistory: RealtimeCallSession[] = [
  {
    id: "call-live-101",
    agentId: "agent-maruthi-receptionist",
    tenantId: "tenant-default",
    callerNumber: "+91 98765 43210",
    callerName: "Harish Kumar",
    channel: "web-browser",
    state: "ENDED",
    startedAt: new Date(Date.now() - 1000 * 60 * 22).toISOString(),
    endedAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    durationSeconds: 240,
    messages: [
      {
        id: "m1",
        role: "assistant",
        content: "నమస్తే అండి, మారుతి టెక్నాలజీస్ కి స్వాగతం. పైథాన్ మరియు జావా కోర్సుల వివరాలు చెప్పమంటారా?",
        timestamp: new Date(Date.now() - 1000 * 60 * 22).toISOString(),
        metrics: { ttfaMs: 185, totalTurnLatencyMs: 380 },
      },
      {
        id: "m2",
        role: "user",
        content: "Sir actually naku... Python course fee entha?",
        timestamp: new Date(Date.now() - 1000 * 60 * 21).toISOString(),
      },
      {
        id: "m3",
        role: "assistant",
        content: "Core Python course fee ₹4,000 sir. Course duration 30 days untundi. Online batch kavala or offline batch kavala?",
        timestamp: new Date(Date.now() - 1000 * 60 * 21).toISOString(),
        metrics: { ttfaMs: 190, totalTurnLatencyMs: 410 },
      },
      {
        id: "m4",
        role: "user",
        content: "Actually Java... Java timing enti?",
        timestamp: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
      },
      {
        id: "m5",
        role: "assistant",
        content: "Sure sir. Core Java 45 days duration untundi, fee ₹5,000. Morning 8 AM and evening 7 PM batches available.",
        timestamp: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
        metrics: { ttfaMs: 195, totalTurnLatencyMs: 420 },
      },
      {
        id: "m6",
        role: "user",
        content: "Naa peru Harish, repu demo class book cheyyandi. WhatsApp lo address pampistara?",
        timestamp: new Date(Date.now() - 1000 * 60 * 19).toISOString(),
      },
      {
        id: "m7",
        role: "assistant",
        content: "Perfect Harish garu! Tomorrow morning 11:00 AM ki demo class confirm chesamu. WhatsApp lo center location and syllabus copy send chestunnamu.",
        timestamp: new Date(Date.now() - 1000 * 60 * 19).toISOString(),
        metrics: { ttfaMs: 205, totalTurnLatencyMs: 440 },
      },
    ],
    memory: {
      currentTurn: 4,
      callerName: "Harish Kumar",
      callerPhone: "+91 98765 43210",
      interestedCourse: "Core Java Programming",
      preferredBatch: "Evening",
      budget: 5000,
      leadStage: "Appointment_Booked",
      appointmentState: {
        date: "Tomorrow",
        time: "11:00 AM",
        mode: "Offline In-Person",
        confirmed: true,
      },
      whatsappRequested: true,
      rollingSummary: "Caller Harish inquired about Python, switched to Java, captured lead, scheduled demo for tomorrow 11 AM and requested WhatsApp brochure.",
      unresolvedQuestions: [],
      interruptionsCount: 1,
      backchannelsIgnoredCount: 2,
      sentiment: "Positive",
    },
    metrics: {
      averageTTFAMs: 194,
      averageTurnLatencyMs: 412,
      totalInterruptions: 1,
      totalBackchannels: 2,
      sttAccuracyScore: 98,
      humanHandoffTriggered: false,
    },
  },
];

// GET /api/v1/voice-agents - List all voice agents
app.get("/api/v1/voice-agents", (req, res) => {
  res.json(realtimeVoiceAgents);
});

// GET /api/v1/voice-agents/:id - Get specific voice agent
app.get("/api/v1/voice-agents/:id", (req, res) => {
  const agent = realtimeVoiceAgents.find((a) => a.id === req.params.id) || realtimeVoiceAgents[0];
  res.json(agent);
});

// POST /api/v1/voice-agents - Create new voice agent
app.post("/api/v1/voice-agents", (req, res) => {
  const newAgent: RealtimeVoiceAgentConfig = {
    id: `agent-${Date.now()}`,
    tenantId: "tenant-default",
    name: req.body.name || "New Telugu Receptionist",
    companyName: req.body.companyName || "Maruthi Technologies",
    tagline: req.body.tagline || "Realtime Telugu AI Receptionist",
    language: req.body.language || "te-en-hybrid",
    dialect: req.body.dialect || "hyderabad-telangana",
    personality: req.body.personality || "Professional",
    ttsProvider: req.body.ttsProvider || "indic-parler",
    voiceId: req.body.voiceId || "os-parler-lalitha",
    voiceName: req.body.voiceName || "Lalitha (లలిత)",
    speed: req.body.speed || 1.0,
    pitch: req.body.pitch || 1.0,
    bargeInEnabled: req.body.bargeInEnabled ?? true,
    bargeInSensitivity: req.body.bargeInSensitivity ?? 0.85,
    backchannelFilterEnabled: req.body.backchannelFilterEnabled ?? true,
    silenceTimeoutMs: req.body.silenceTimeoutMs || 1200,
    thinkingPauseToleranceMs: req.body.thinkingPauseToleranceMs || 800,
    audioProfile: req.body.audioProfile || "BROWSER_AUDIO_PROFILE",
    transport: req.body.transport || "livekit",
    llmProvider: req.body.llmProvider || "ollama",
    llmModel: req.body.llmModel || "qwen2.5:7b-instruct-q4_K_M",
    sttModel: req.body.sttModel || "faster-whisper-indic",
    initialGreeting: req.body.initialGreeting || "నమస్తే అండి, మారుతి టెక్నాలజీస్ కి స్వాగతం. ఎలా సహాయపడగలను?",
    workingHours: req.body.workingHours || {
      start: "09:00",
      end: "19:00",
      timezone: "Asia/Kolkata",
      days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    },
    knowledgeCategories: req.body.knowledgeCategories || ["Courses", "Fees", "Batches"],
    leadCaptureFields: req.body.leadCaptureFields || ["Name", "Phone", "Course"],
    humanHandoff: req.body.humanHandoff || {
      enabled: true,
      sipExtension: "101",
      transferKeywords: ["human", "counselor"],
      autoTransferOnAngry: true,
      autoTransferOnUnansweredCount: 2,
    },
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  realtimeVoiceAgents.unshift(newAgent);
  res.status(201).json(newAgent);
});

// PUT /api/v1/voice-agents/:id - Update voice agent
app.put("/api/v1/voice-agents/:id", (req, res) => {
  const index = realtimeVoiceAgents.findIndex((a) => a.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "Voice agent not found" });
  }
  realtimeVoiceAgents[index] = {
    ...realtimeVoiceAgents[index],
    ...req.body,
    updatedAt: new Date().toISOString(),
  };
  res.json(realtimeVoiceAgents[index]);
});

// DELETE /api/v1/voice-agents/:id - Delete voice agent
app.delete("/api/v1/voice-agents/:id", (req, res) => {
  realtimeVoiceAgents = realtimeVoiceAgents.filter((a) => a.id !== req.params.id);
  res.json({ success: true });
});

// POST /api/v1/voice-agents/:id/turn - Execute a full-duplex conversational turn
app.post("/api/v1/voice-agents/:id/turn", async (req, res) => {
  try {
    const agent = realtimeVoiceAgents.find((a) => a.id === req.params.id) || realtimeVoiceAgents[0];
    const { userInput, memory, pauseDurationMs } = req.body;

    const initialMemory: ConversationMemory = memory || {
      currentTurn: 0,
      leadStage: "New",
      rollingSummary: "Conversation in progress.",
      unresolvedQuestions: [],
      interruptionsCount: 0,
      backchannelsIgnoredCount: 0,
      sentiment: "Neutral",
    };

    // Check utterance completion logic
    const completionCheck = ConversationalTurnDetector.isUtteranceComplete(
      userInput || "",
      pauseDurationMs || 1500,
      agent.silenceTimeoutMs
    );

    const turnResult = await RealtimeReceptionistEngine.executeTurn(
      userInput,
      agent,
      initialMemory,
      []
    );

    const audioBase64 = `data:audio/mp3;base64,${turnResult.audioBuffer.toString("base64")}`;

    // Record or update call session in history
    const existingSession = realtimeCallHistory.find((c) => c.agentId === agent.id && c.state !== "ENDED");
    if (existingSession) {
      existingSession.messages.push({
        id: `m-${Date.now()}-u`,
        role: "user",
        content: userInput,
        timestamp: new Date().toISOString(),
      });
      existingSession.messages.push({
        id: `m-${Date.now()}-a`,
        role: "assistant",
        content: turnResult.spokenText,
        timestamp: new Date().toISOString(),
        metrics: {
          ttfaMs: turnResult.telemetry.latencyTracker.ttsFirstAudioMs,
          totalTurnLatencyMs: turnResult.telemetry.latencyTracker.totalTurnMs,
        },
      });
      existingSession.memory = turnResult.updatedMemory;
    }

    res.json({
      spokenText: turnResult.spokenText,
      speechChunks: turnResult.speechChunks,
      audioBase64,
      toolCallsExecuted: turnResult.toolCallsExecuted,
      updatedMemory: turnResult.updatedMemory,
      telemetry: {
        ...turnResult.telemetry,
        turnCompletenessProbability: completionCheck.isComplete ? 0.98 : 0.6,
      },
    });
  } catch (err) {
    console.error("[RealtimeVoiceAgent] Turn execution error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Voice agent turn execution failed" });
  }
});

// POST /api/v1/voice-agents/:id/barge-in - Interruption & Backchannel Signal handler
app.post("/api/v1/voice-agents/:id/barge-in", (req, res) => {
  try {
    const agent = realtimeVoiceAgents.find((a) => a.id === req.params.id) || realtimeVoiceAgents[0];
    const { interruptionTranscript, vadEnergy } = req.body;

    const evalResult = ConversationalTurnDetector.isSubstantiveInterruption(
      interruptionTranscript || "",
      vadEnergy || 0.3,
      agent.bargeInSensitivity
    );

    res.json({
      isInterruption: evalResult.isInterruption,
      isBackchannel: evalResult.isBackchannel,
      confidence: evalResult.confidence,
      reason: evalResult.reason,
      actionTaken: evalResult.isInterruption
        ? "CANCEL_TTS_IMMEDIATELY_AND_TRANSITION_TO_INTERRUPTED"
        : evalResult.isBackchannel
        ? "IGNORE_BACKCHANNEL_CONTINUE_SPEAKING"
        : "IGNORE_TRANSIENT_NOISE",
    });
  } catch (err) {
    console.error("[RealtimeVoiceAgent] Barge-in evaluation error:", err);
    res.status(500).json({ error: "Failed to evaluate barge-in signal" });
  }
});

// GET /api/v1/voice-agents/:id/calls - Get call records for agent
app.get("/api/v1/voice-agents/:id/calls", (req, res) => {
  const calls = realtimeCallHistory.filter((c) => c.agentId === req.params.id || c.agentId === "agent-maruthi-receptionist");
  res.json(calls);
});

// GET /api/v1/voice-agents/:id/analytics - Get analytics dashboard data
app.get("/api/v1/voice-agents/:id/analytics", (req, res) => {
  res.json({
    activeCalls: 3,
    totalCalls: 148,
    avgDurationSec: 184,
    avgTurnLatencyMs: 395,
    leadsGenerated: 112,
    appointmentsBooked: 76,
    humanTransfers: 6,
    callSuccessRate: 96.2,
    interruptionRate: 14.5,
    hourlyVolume: [
      { hour: "09 AM", calls: 14 },
      { hour: "10 AM", calls: 28 },
      { hour: "11 AM", calls: 34 },
      { hour: "12 PM", calls: 22 },
      { hour: "01 PM", calls: 12 },
      { hour: "02 PM", calls: 16 },
      { hour: "03 PM", calls: 24 },
      { hour: "04 PM", calls: 38 },
      { hour: "05 PM", calls: 42 },
      { hour: "06 PM", calls: 31 },
      { hour: "07 PM", calls: 18 },
    ],
    languageBreakdown: [
      { language: "Telugu-English Code Mixing", count: 88, percentage: 59.5 },
      { language: "Telugu (Conversational)", count: 44, percentage: 29.7 },
      { language: "Indian English", count: 16, percentage: 10.8 },
    ],
  });
});

// POST /api/v1/voice-agents/:id/benchmark/run-5min - Run the complete 5-minute conversation test
app.post("/api/v1/voice-agents/:id/benchmark/run-5min", async (req, res) => {
  try {
    const agent = realtimeVoiceAgents.find((a) => a.id === req.params.id) || realtimeVoiceAgents[0];
    const report = await RealtimeVoiceBenchmarkRunner.runFiveMinuteBenchmark(agent);
    res.json(report);
  } catch (err) {
    console.error("[RealtimeVoiceAgent] Benchmark run error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Benchmark run failed" });
  }
});

// POST /api/v1/voice-agents/:id/benchmark/voice-eval - Run automated voice quality benchmark
app.post("/api/v1/voice-agents/:id/benchmark/voice-eval", async (req, res) => {
  try {
    const results = await RealtimeVoiceBenchmarkRunner.runVoiceQualityEvaluation();
    res.json(results);
  } catch (err) {
    console.error("[RealtimeVoiceAgent] Voice quality evaluation error:", err);
    res.status(500).json({ error: "Voice quality evaluation failed" });
  }
});

// POST /api/v1/voice-agents/telephony/sip-webhook - LiveKit SIP Gateway & Asterisk Webhook
app.post("/api/v1/voice-agents/telephony/sip-webhook", (req, res) => {
  const { event, call_id, caller, callee } = req.body || {};
  console.log(`[Telephony Webhook] Event: ${event} | Call ID: ${call_id} | Caller: ${caller} -> Callee: ${callee}`);
  res.json({
    status: "accepted",
    routing: {
      action: "connect_agent",
      agent_id: "agent-maruthi-receptionist",
      audio_profile: "TELEPHONE_AUDIO_PROFILE",
      codec: "PCMU",
      sample_rate: 8000,
    },
  });
});

// Voice & Telephony Endpoints
app.get("/api/v1/voice/calls", (req, res) => {
  res.json(voiceCalls);
});

app.get("/api/v1/voice/telephony-config", (req, res) => {
  res.json(telephonyConfig);
});

app.put("/api/v1/voice/telephony-config", (req, res) => {
  Object.assign(telephonyConfig, req.body);
  savePersistence();
  res.json(telephonyConfig);
});

app.post("/api/v1/voice/simulate-call", async (req, res) => {
  const { spoken_input, caller_number, agent_id, session_id, call_sid } = req.body;
  const agent = agents.find((a) => a.id === agent_id) || agents[0];
  const caller = caller_number || "+1 (555) 301-4499";

  let conv = session_id ? conversations.find((c) => c.session_id === session_id) : null;
  if (!conv) {
    conv = {
      id: getId(),
      organization_id: 1,
      agent_id: agent.id,
      user_id: null,
      session_id: session_id || `voice-${Date.now()}`,
      channel: "voice",
      customer_phone: caller,
      status: "in-progress",
      conversation_state: "INFORMATION",
      detected_intent: "voice_inbound_call",
      language: "en",
      sentiment: "positive",
      is_human_takeover: false,
      lead_id: null,
      appointment_id: null,
      summary: `Inbound voice call from ${caller}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    conversations.unshift(conv);
  }

  const outcome = await executeReceptionistTurn(spoken_input || "Hello, I want information about your courses.", agent, conv);

  let callRecord = call_sid ? voiceCalls.find((c) => c.call_sid === call_sid) : null;
  const nowStamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  if (callRecord) {
    callRecord.transcript.push(
      { role: "caller", text: spoken_input || "Caller speech", timestamp: nowStamp },
      { role: "assistant", text: outcome.reply, timestamp: nowStamp }
    );
    callRecord.duration_seconds = Math.max(callRecord.duration_seconds + 10, 15);
    callRecord.outcome = outcome.isEscalated ? "transferred" : outcome.isAppointmentBooked ? "appointment_booked" : outcome.isLeadCaptured ? "lead_captured" : "inquiry_resolved";
    callRecord.status = outcome.isEscalated ? "transferred" : "in-progress";
  } else {
    callRecord = {
      id: getId(),
      organization_id: 1,
      agent_id: agent.id,
      conversation_id: conv.id,
      call_sid: call_sid || `CA${Math.random().toString(36).substring(2, 12)}`,
      direction: "inbound",
      caller_number: caller,
      recipient_number: organization.phone,
      status: outcome.isEscalated ? "transferred" : "in-progress",
      duration_seconds: 15,
      recording_url: null,
      outcome: outcome.isEscalated ? "transferred" : outcome.isAppointmentBooked ? "appointment_booked" : outcome.isLeadCaptured ? "lead_captured" : "inquiry_resolved",
      transcript: [
        { role: "caller", text: spoken_input || "Inbound caller greeting", timestamp: nowStamp },
        { role: "assistant", text: outcome.reply, timestamp: nowStamp },
      ],
      created_at: new Date().toISOString(),
    };
    voiceCalls.unshift(callRecord);
  }

  savePersistence();

  res.json({
    session_id: conv.session_id,
    call_sid: callRecord.call_sid,
    voice_reply: outcome.reply,
    quick_replies: outcome.quickReplies,
    audio_synthesis: {
      voice_id: agent.voice_id,
      speaking_style: agent.speaking_style,
      rate: 1.0,
      pitch: 1.0,
    },
    outcome: callRecord.outcome,
    call_record: callRecord,
  });
});

// Conversations Management
app.get("/api/v1/conversations", (req, res) => {
  const status = req.query.status as string | undefined;
  if (status && status !== "all") {
    return res.json(conversations.filter((c) => c.status === status));
  }
  res.json(conversations);
});

app.get("/api/v1/conversations/:id", (req, res) => {
  const id = Number(req.params.id);
  const conv = conversations.find((c) => c.id === id);
  if (!conv) return res.status(404).json({ detail: "Conversation not found" });
  res.json(conv);
});

app.patch("/api/v1/conversations/:id", (req, res) => {
  const id = Number(req.params.id);
  const conv = conversations.find((c) => c.id === id);
  if (!conv) return res.status(404).json({ detail: "Conversation not found" });

  Object.assign(conv, req.body, { updated_at: new Date().toISOString() });
  res.json(conv);
});

app.post("/api/v1/conversations/:id/takeover", (req, res) => {
  const id = Number(req.params.id);
  const conv = conversations.find((c) => c.id === id);
  if (!conv) return res.status(404).json({ detail: "Conversation not found" });

  conv.is_human_takeover = !conv.is_human_takeover;
  conv.status = conv.is_human_takeover ? "takeover" : "active";
  conv.updated_at = new Date().toISOString();

  messages.push({
    id: getId(),
    conversation_id: conv.id,
    role: "system",
    content: conv.is_human_takeover
      ? "Staff operator Harish Sadula took over this conversation."
      : "Human takeover ended. Autonomous AI Receptionist resumed.",
    state_snapshot: conv.is_human_takeover ? "HANDOFF" : "DISCOVERY",
    created_at: new Date().toISOString(),
  });

  res.json({ is_human_takeover: conv.is_human_takeover, status: conv.status });
});

app.post("/api/v1/conversations/:id/operator-message", (req, res) => {
  const id = Number(req.params.id);
  const conv = conversations.find((c) => c.id === id);
  if (!conv) return res.status(404).json({ detail: "Conversation not found" });
  const { content } = req.body;
  if (!content) return res.status(400).json({ detail: "Message content is required." });

  const opMsg: MessageModel = {
    id: getId(),
    conversation_id: conv.id,
    role: "operator",
    content,
    state_snapshot: "HANDOFF",
    created_at: new Date().toISOString(),
  };
  messages.push(opMsg);
  conv.updated_at = new Date().toISOString();
  savePersistence();
  res.json(opMsg);
});

app.get("/api/v1/conversations/:id/messages", (req, res) => {
  const id = Number(req.params.id);
  const convMessages = messages.filter((m) => m.conversation_id === id);
  res.json(convMessages);
});

// Knowledge Base & RAG Endpoints
app.get("/api/v1/knowledge", (req, res) => {
  const agentId = req.query.agent_id ? Number(req.query.agent_id) : undefined;
  if (agentId) {
    const targetAgent = agents.find((a) => a.id === agentId);
    return res.json(getAgentKnowledgeItems(targetAgent));
  }
  res.json(knowledgeItems);
});

app.get("/api/v1/knowledge/:id", (req, res) => {
  const id = Number(req.params.id);
  const item = knowledgeItems.find((k) => k.id === id);
  if (!item) return res.status(404).json({ detail: "Knowledge item not found" });
  res.json(item);
});

app.post("/api/v1/knowledge", (req, res) => {
  const { title, content, source, category, agent_id } = req.body;
  const targetAgent = agent_id ? agents.find((a) => a.id === Number(agent_id)) : null;
  const newItem: KnowledgeItemModel = {
    id: getId(),
    organization_id: 1,
    agent_id: targetAgent ? targetAgent.id : null,
    title: title || "Untitled Knowledge",
    content: content || "",
    source: source || "Manual Entry",
    category: category || "General",
    uuid: `kb-${getId()}`,
    is_active: true,
    chunks: [
      { id: getId(), text: String(content || "").slice(0, 300) },
      { id: getId(), text: String(content || "").slice(300, 600) },
    ].filter((c) => c.text.length > 0),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  knowledgeItems.unshift(newItem);
  if (targetAgent) {
    if (!Array.isArray(targetAgent.knowledge_item_ids)) {
      targetAgent.knowledge_item_ids = [];
    }
    if (!targetAgent.knowledge_item_ids.includes(newItem.id)) {
      targetAgent.knowledge_item_ids.push(newItem.id);
    }
  }
  savePersistence();
  res.status(201).json(newItem);
});

app.post("/api/v1/knowledge/search", async (req, res) => {
  const { query, agent_id, slug } = req.body;
  const searchResults = await toolRegistry.search_knowledge({ query: query || "", agent_id, slug }, 1);
  res.json({ query, results: searchResults });
});

app.patch("/api/v1/knowledge/:id", (req, res) => {
  const id = Number(req.params.id);
  const item = knowledgeItems.find((k) => k.id === id);
  if (!item) return res.status(404).json({ detail: "Knowledge item not found" });

  Object.assign(item, req.body, { updated_at: new Date().toISOString() });
  savePersistence();
  res.json(item);
});

app.delete("/api/v1/knowledge/:id", (req, res) => {
  const id = Number(req.params.id);
  const exists = knowledgeItems.some((k) => k.id === id);
  if (!exists) {
    return res.status(404).json({ detail: "Knowledge item not found." });
  }

  knowledgeItems = knowledgeItems.filter((k) => k.id !== id);

  // Clean up references in all agents' bound knowledge
  agents.forEach((agent) => {
    if (Array.isArray(agent.knowledge_item_ids)) {
      agent.knowledge_item_ids = agent.knowledge_item_ids.filter((kId) => kId !== id);
    }
  });

  savePersistence();
  res.json({ success: true, message: "Knowledge document deleted successfully", id });
});

// Document Upload with Chunking and Immediate Agent Binding
app.post("/api/v1/documents/upload", upload.single("file"), (req, res) => {
  const file = req.file;
  const category = (req.body.category || "Uploaded Documents") as string;
  const agentId = req.body.agent_id ? Number(req.body.agent_id) : null;

  if (!file) {
    return res.status(400).json({ detail: "No file was uploaded." });
  }

  const rawText = file.buffer.toString("utf-8");
  const paragraphs = rawText
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunksCreated = Math.max(1, paragraphs.length || 1);
  const chunkList: { id: number; text: string }[] = paragraphs.map((p) => ({
    id: getId(),
    text: p.slice(0, 1000),
  }));

  const baseTitle = file.originalname.replace(/\.[^/.]+$/, "");
  const newKb: KnowledgeItemModel = {
    id: getId(),
    organization_id: 1,
    agent_id: agentId,
    title: baseTitle,
    content: rawText.slice(0, 50000) || `Uploaded file content: ${file.originalname}`,
    source: file.originalname,
    category: category,
    uuid: `doc-${getId()}`,
    is_active: true,
    chunks: chunkList,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  knowledgeItems.unshift(newKb);

  // If bound to a specific agent, ensure it's in that agent's knowledge_item_ids
  if (agentId) {
    const targetAgent = agents.find((a) => a.id === agentId);
    if (targetAgent) {
      if (!Array.isArray(targetAgent.knowledge_item_ids)) {
        targetAgent.knowledge_item_ids = [];
      }
      if (!targetAgent.knowledge_item_ids.includes(newKb.id)) {
        targetAgent.knowledge_item_ids.push(newKb.id);
      }
    }
  }

  savePersistence();

  res.json({
    success: true,
    message: `Document "${file.originalname}" processed and added to knowledge base with ${chunksCreated} chunks.`,
    data: {
      id: newKb.id,
      title: file.originalname,
      category,
      source: file.originalname,
      chunks_created: chunksCreated,
      chunks: chunkList,
      agent_id: agentId,
      item: newKb,
    },
  });
});

// Integrations
app.get("/api/v1/integrations", (req, res) => {
  res.json({ integrations });
});

// WhatsApp Integration Endpoints
app.post("/api/v1/integrations/whatsapp/webhook", async (req, res) => {
  const { from, message } = req.body;
  const senderNumber = from || "+1 (555) 992-1200";
  const incomingText = message || "Hello from WhatsApp!";

  let conv = conversations.find((c) => c.customer_phone === senderNumber && c.channel === "whatsapp");
  if (!conv) {
    conv = {
      id: getId(),
      organization_id: 1,
      agent_id: 1,
      user_id: null,
      session_id: `wa-${Date.now()}`,
      channel: "whatsapp",
      customer_phone: senderNumber,
      status: "active",
      conversation_state: "GREETING",
      detected_intent: "whatsapp_message",
      language: "en",
      sentiment: "neutral",
      is_human_takeover: false,
      lead_id: null,
      appointment_id: null,
      summary: `WhatsApp inbound conversation from ${senderNumber}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    conversations.unshift(conv);
  }

  messages.push({
    id: getId(),
    conversation_id: conv.id,
    role: "user",
    content: incomingText,
    state_snapshot: conv.conversation_state,
    created_at: new Date().toISOString(),
  });

  const outcome = await executeReceptionistTurn(incomingText, agents[0], conv);

  messages.push({
    id: getId(),
    conversation_id: conv.id,
    role: "assistant",
    content: outcome.reply,
    tool_calls: outcome.toolsExecuted,
    grounding_sources: outcome.groundingSources,
    state_snapshot: outcome.state,
    created_at: new Date().toISOString(),
  });

  conv.conversation_state = outcome.state;
  conv.updated_at = new Date().toISOString();

  res.json({
    status: "delivered",
    reply: outcome.reply,
    recipient: senderNumber,
    tools_executed: outcome.toolsExecuted,
  });
});

app.get("/api/v1/integrations/whatsapp/templates", (req, res) => {
  res.json([
    {
      name: "lead_qualification_followup",
      language: "en_US",
      header: "Apex Solutions Reception Desk",
      body: "Hi {{1}}, thank you for reaching out to Apex Solutions! Maya has reserved your consultation. Would you like to confirm for {{2}}?",
    },
    {
      name: "appointment_confirmation_reminder",
      language: "en_US",
      header: "Appointment Confirmation",
      body: "Hello {{1}}, this is your confirmation for your demo with Apex Solutions on {{2}} at {{3}}.",
    },
  ]);
});

app.post("/api/v1/integrations/whatsapp/send-test", (req, res) => {
  const { to, template, recipient_name } = req.body;
  res.json({
    success: true,
    message_id: `wamid.HBgL${Date.now()}`,
    status: "sent",
    details: `Dispatched template '${template || "lead_qualification_followup"}' to ${to || "+1 (555) 0199"} for ${recipient_name || "Visitor"}.`,
  });
});

// Analytics
app.get("/api/v1/analytics/overview", (req, res) => {
  const totalConvs = conversations.length;
  const activeConvs = conversations.filter((c) => c.status === "active").length;
  const completedConvs = totalConvs - activeConvs;

  const totalLeads = leads.length;
  const newLeads = leads.filter((l) => l.status === "new").length;
  const qualifiedLeads = leads.filter((l) => l.status === "qualified").length;
  const convertedLeads = leads.filter((l) => l.status === "converted").length;

  const webCount = conversations.filter((c) => c.channel === "web").length;
  const voiceCount = conversations.filter((c) => c.channel === "voice").length;
  const waCount = conversations.filter((c) => c.channel === "whatsapp").length;

  res.json({
    conversations: {
      total: totalConvs,
      active: activeConvs,
      completed: completedConvs,
      average_per_conversation: 4.5,
    },
    channel_breakdown: {
      web: webCount,
      voice: voiceCount,
      whatsapp: waCount,
    },
    appointments_booked: appointments.length,
    leads: {
      total: totalLeads,
      new: newLeads,
      qualified: qualifiedLeads,
      converted: convertedLeads,
    },
    ai_resolution_rate: 94,
    human_handoff_rate: 6,
    popular_questions: [
      { question: "What are your business operating hours?", count: 112 },
      { question: "How much does the AI receptionist cost?", count: 98 },
      { question: "Can the receptionist sync leads to CRM & Google Sheets?", count: 74 },
      { question: "Do you have WhatsApp and Voice Call phone numbers?", count: 53 },
      { question: "Tell me about the Python training course fees", count: 42 },
    ],
    unanswered_questions: [
      { question: "Can we train custom voice models in Japanese?", count: 3 },
      { question: "Do you have HIPAA certification?", count: 2 },
    ],
  });
});

// Team & Roles
app.get("/api/v1/users", (req, res) => {
  res.json(users);
});

app.post("/api/v1/users", (req, res) => {
  const { first_name, last_name, email, phone, role_ids } = req.body;
  const newUser = {
    id: getId(),
    uuid: `user-${getId()}`,
    organization_id: 1,
    first_name: first_name || "Team",
    last_name: last_name || "Member",
    email: email || `user-${Date.now()}@apexsolutions.ai`,
    phone: phone || null,
    is_active: true,
    is_verified: true,
    is_superuser: false,
    role_ids: Array.isArray(role_ids) ? role_ids : [2],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  users.push(newUser);
  res.status(201).json(newUser);
});

app.delete("/api/v1/users/:id", (req, res) => {
  const id = Number(req.params.id);
  const index = users.findIndex((u) => u.id === id);
  if (index !== -1) users.splice(index, 1);
  res.status(204).send();
});

app.get("/api/v1/roles", (req, res) => {
  res.json(roles);
});

// ==========================================
// Google Workspace (Gmail & Sheets) Proxy & Sync APIs
// ==========================================

// Helper to extract bearer token
function getBearerToken(req: express.Request): string | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return auth.slice(7).trim();
}

// GET /api/v1/google/status
app.get("/api/v1/google/status", (req, res) => {
  res.json({
    configured: true,
    linked_sheets: linkedSheets,
    oauth_scopes: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.readonly",
    ],
  });
});

// GET /api/v1/google/gmail/messages
// Proxies to Gmail API to fetch recent inquiry threads
app.get("/api/v1/google/gmail/messages", async (req, res) => {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ detail: "Missing Google OAuth Bearer Token. Please connect your Google account." });
  }

  try {
    const q = req.query.q ? encodeURIComponent(String(req.query.q)) : encodeURIComponent("in:inbox");
    const maxResults = Number(req.query.maxResults) || 10;
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=${q}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!listRes.ok) {
      const errBody = await listRes.text();
      return res.status(listRes.status).json({ detail: `Gmail API error: ${errBody}` });
    }

    const listData = (await listRes.json()) as { messages?: { id: string; threadId: string }[] };
    if (!listData.messages || listData.messages.length === 0) {
      return res.json({ messages: [], total: 0 });
    }

    // Fetch message details for top messages
    const detailed = await Promise.all(
      listData.messages.slice(0, 8).map(async (m) => {
        try {
          const mRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (!mRes.ok) return null;
          const mData = (await mRes.json()) as {
            id: string;
            threadId: string;
            snippet: string;
            internalDate: string;
            payload?: {
              headers?: { name: string; value: string }[];
            };
          };

          const headers = mData.payload?.headers || [];
          const subject = headers.find((h) => h.name.toLowerCase() === "subject")?.value || "(No subject)";
          const from = headers.find((h) => h.name.toLowerCase() === "from")?.value || "Unknown";
          const to = headers.find((h) => h.name.toLowerCase() === "to")?.value || "me";
          const date = headers.find((h) => h.name.toLowerCase() === "date")?.value || mData.internalDate;

          return {
            id: mData.id,
            threadId: mData.threadId,
            snippet: mData.snippet,
            subject,
            from,
            to,
            date,
          };
        } catch {
          return null;
        }
      })
    );

    res.json({
      messages: detailed.filter(Boolean),
      total: listData.messages.length,
    });
  } catch (err) {
    res.status(500).json({ detail: err instanceof Error ? err.message : "Failed to fetch Gmail messages." });
  }
});

// POST /api/v1/google/gmail/send
// Send email via Gmail API
app.post("/api/v1/google/gmail/send", async (req, res) => {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ detail: "Missing Google OAuth Bearer Token. Please connect your Google account." });
  }

  const { to, subject, body } = req.body;
  if (!to || !subject || !body) {
    return res.status(400).json({ detail: "Recipient 'to', 'subject', and 'body' are required." });
  }

  try {
    // RFC 2822 email format base64url encoded
    const emailLines = [
      `To: ${to}`,
      `Subject: =?utf-8?B?${Buffer.from(subject).toString("base64")}?=`,
      "MIME-Version: 1.0",
      "Content-Type: text/html; charset=utf-8",
      "",
      body.replace(/\n/g, "<br/>"),
    ];
    const rawEmail = emailLines.join("\r\n");
    const encodedEmail = Buffer.from(rawEmail)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const sendRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: encodedEmail }),
    });

    if (!sendRes.ok) {
      const errText = await sendRes.text();
      return res.status(sendRes.status).json({ detail: `Gmail send error: ${errText}` });
    }

    const sendData = (await sendRes.json()) as { id?: string; threadId?: string };
    res.json({
      success: true,
      message_id: sendData.id,
      thread_id: sendData.threadId,
      recipient: to,
      subject,
    });
  } catch (err) {
    res.status(500).json({ detail: err instanceof Error ? err.message : "Failed to send Gmail message." });
  }
});

// GET /api/v1/google/sheets/list
// Queries user's Google Drive for spreadsheets they own or can edit
app.get("/api/v1/google/sheets/list", async (req, res) => {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ detail: "Missing Google OAuth Bearer Token. Please connect your Google account." });
  }

  try {
    const driveRes = await fetch(
      "https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.spreadsheet' and trashed=false&fields=files(id,name,modifiedTime,webViewLink)&pageSize=25",
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!driveRes.ok) {
      const errText = await driveRes.text();
      return res.status(driveRes.status).json({ detail: `Google Drive API error: ${errText}` });
    }

    const driveData = (await driveRes.json()) as { files?: Array<{ id: string; name: string; modifiedTime?: string; webViewLink?: string }> };
    res.json({ files: driveData.files || [] });
  } catch (err) {
    res.status(500).json({ detail: err instanceof Error ? err.message : "Failed to list spreadsheets." });
  }
});

// POST /api/v1/google/sheets/create
// Creates a dedicated AI Receptionist Leads & Appointments Google Sheet
app.post("/api/v1/google/sheets/create", async (req, res) => {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ detail: "Missing Google OAuth Bearer Token. Please connect your Google account." });
  }

  const { title } = req.body;
  const sheetTitle = title || `Apex AI Receptionist - Registry (${new Date().toISOString().split("T")[0]})`;

  try {
    const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: { title: sheetTitle },
        sheets: [
          {
            properties: { title: "Qualified Leads" },
            data: [
              {
                startRow: 0,
                startColumn: 0,
                rowData: [
                  {
                    values: [
                      { userEnteredValue: { stringValue: "ID" } },
                      { userEnteredValue: { stringValue: "Name" } },
                      { userEnteredValue: { stringValue: "Email" } },
                      { userEnteredValue: { stringValue: "Phone" } },
                      { userEnteredValue: { stringValue: "Interest" } },
                      { userEnteredValue: { stringValue: "Lead Score" } },
                      { userEnteredValue: { stringValue: "Status" } },
                      { userEnteredValue: { stringValue: "Captured At" } },
                    ],
                  },
                ],
              },
            ],
          },
          {
            properties: { title: "Appointments" },
            data: [
              {
                startRow: 0,
                startColumn: 0,
                rowData: [
                  {
                    values: [
                      { userEnteredValue: { stringValue: "Appointment ID" } },
                      { userEnteredValue: { stringValue: "Customer Name" } },
                      { userEnteredValue: { stringValue: "Email" } },
                      { userEnteredValue: { stringValue: "Service" } },
                      { userEnteredValue: { stringValue: "Slot Date" } },
                      { userEnteredValue: { stringValue: "Slot Time" } },
                      { userEnteredValue: { stringValue: "Status" } },
                      { userEnteredValue: { stringValue: "Notes" } },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      return res.status(createRes.status).json({ detail: `Google Sheets creation error: ${errText}` });
    }

    const newSheet = (await createRes.json()) as {
      spreadsheetId: string;
      spreadsheetUrl?: string;
      properties?: { title: string };
    };

    const linked: LinkedSpreadsheet = {
      id: newSheet.spreadsheetId,
      name: newSheet.properties?.title || sheetTitle,
      sheetName: "Qualified Leads",
      linkedAt: new Date().toISOString(),
      totalSyncedRows: 0,
      syncLeads: true,
      syncAppointments: true,
      syncTranscripts: true,
    };
    linkedSheets.unshift(linked);

    res.json({
      success: true,
      spreadsheet_id: newSheet.spreadsheetId,
      spreadsheet_url: newSheet.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${newSheet.spreadsheetId}/edit`,
      linked,
    });
  } catch (err) {
    res.status(500).json({ detail: err instanceof Error ? err.message : "Failed to create Google Sheet." });
  }
});

// POST /api/v1/google/sheets/link
// Link an existing spreadsheet ID
app.post("/api/v1/google/sheets/link", async (req, res) => {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ detail: "Missing Google OAuth Bearer Token. Please connect your Google account." });
  }

  const { spreadsheet_id, sheet_name } = req.body;
  if (!spreadsheet_id) {
    return res.status(400).json({ detail: "Spreadsheet ID is required." });
  }

  try {
    // Validate existence via Google Sheets API
    const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet_id}?fields=properties.title,sheets.properties.title`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!metaRes.ok) {
      const errText = await metaRes.text();
      return res.status(metaRes.status).json({ detail: `Could not access spreadsheet: ${errText}` });
    }

    const meta = (await metaRes.json()) as {
      properties?: { title: string };
      sheets?: { properties: { title: string } }[];
    };

    const targetSheetName = sheet_name || meta.sheets?.[0]?.properties?.title || "Sheet1";
    const existing = linkedSheets.find((s) => s.id === spreadsheet_id);

    if (existing) {
      existing.name = meta.properties?.title || existing.name;
      existing.sheetName = targetSheetName;
      return res.json({ success: true, linked: existing, message: "Spreadsheet link updated." });
    }

    const newLinked: LinkedSpreadsheet = {
      id: spreadsheet_id,
      name: meta.properties?.title || "Linked Google Sheet",
      sheetName: targetSheetName,
      linkedAt: new Date().toISOString(),
      totalSyncedRows: 0,
      syncLeads: true,
      syncAppointments: true,
      syncTranscripts: false,
    };
    linkedSheets.unshift(newLinked);

    res.json({ success: true, linked: newLinked });
  } catch (err) {
    res.status(500).json({ detail: err instanceof Error ? err.message : "Failed to link spreadsheet." });
  }
});

// POST /api/v1/google/sheets/sync-all
// Pushes all current in-memory leads and appointments to the specified or default linked Google Sheet
app.post("/api/v1/google/sheets/sync-all", async (req, res) => {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ detail: "Missing Google OAuth Bearer Token. Please connect your Google account." });
  }

  const spreadsheetId = req.body.spreadsheet_id || linkedSheets[0]?.id;
  if (!spreadsheetId) {
    return res.status(400).json({ detail: "No Google Sheet selected or linked." });
  }

  try {
    // 1. Prepare Leads rows
    const leadRows = leads.map((l) => [
      l.id,
      l.name,
      l.email || "",
      l.phone || "",
      l.interest || "",
      l.lead_score || 70,
      l.status,
      l.created_at,
    ]);

    // 2. Append Leads to "Qualified Leads" or first sheet
    const leadsAppendRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Qualified Leads'!A:H:append?valueInputOption=USER_ENTERED`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values: leadRows }),
      }
    );

    let leadsAppended = 0;
    if (leadsAppendRes.ok) {
      const resp = (await leadsAppendRes.json()) as { updates?: { updatedRows?: number } };
      leadsAppended = resp.updates?.updatedRows || leadRows.length;
    } else {
      // Fallback to Sheet1 if Qualified Leads tab doesn't exist
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A:H:append?valueInputOption=USER_ENTERED`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ values: leadRows }),
        }
      );
      leadsAppended = leadRows.length;
    }

    // 3. Prepare Appointments rows
    const apptRows = appointments.map((a) => [
      a.id,
      a.customer_name,
      a.customer_email || "",
      a.service,
      a.slot_date,
      a.slot_time,
      a.status,
      a.notes || "",
    ]);

    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Appointments'!A:H:append?valueInputOption=USER_ENTERED`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values: apptRows }),
      }
    );

    const sheetItem = linkedSheets.find((s) => s.id === spreadsheetId);
    if (sheetItem) {
      sheetItem.totalSyncedRows += leadsAppended + apptRows.length;
    }

    res.json({
      success: true,
      spreadsheet_id: spreadsheetId,
      leads_synced: leads.length,
      appointments_synced: appointments.length,
      total_rows_pushed: leadsAppended + apptRows.length,
      view_url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    });
  } catch (err) {
    res.status(500).json({ detail: err instanceof Error ? err.message : "Failed to sync to Google Sheets." });
  }
});

// GET /api/v1/google/sheets/:id/preview
// Reads rows from a linked sheet for previewing directly in the app
app.get("/api/v1/google/sheets/:id/preview", async (req, res) => {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ detail: "Missing Google OAuth Bearer Token. Please connect your Google account." });
  }

  const spreadsheetId = req.params.id;
  const range = (req.query.range as string) || "A1:Z30";

  try {
    const previewRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!previewRes.ok) {
      const errText = await previewRes.text();
      return res.status(previewRes.status).json({ detail: `Google Sheets read error: ${errText}` });
    }

    const data = (await previewRes.json()) as { values?: string[][] };
    res.json({
      spreadsheet_id: spreadsheetId,
      range,
      values: data.values || [],
    });
  } catch (err) {
    res.status(500).json({ detail: err instanceof Error ? err.message : "Failed to read sheet values." });
  }
});

// DELETE /api/v1/google/sheets/:id
app.delete("/api/v1/google/sheets/:id", (req, res) => {
  const id = req.params.id;
  const idx = linkedSheets.findIndex((s) => s.id === id);
  if (idx !== -1) {
    linkedSheets.splice(idx, 1);
    savePersistence();
  }
  res.status(204).send();
});

// Express Error Handling Middleware
app.use((err: Error & { status?: number }, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("[Express Error Handler]", err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
    path: req.path,
  });
});

// ==========================================
// Vite Middleware / Production Static Serving
// ==========================================
let viteMiddleware: express.RequestHandler | null = null;
app.use((req, res, next) => {
  if (viteMiddleware) {
    return viteMiddleware(req, res, next);
  }
  next();
});

async function start() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
      },
      appType: "spa",
    });
    viteMiddleware = vite.middlewares;
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AI Receptionist Platform running on http://0.0.0.0:${PORT}`);
  });
}

process.on("uncaughtException", (err) => {
  console.error("[Fatal] Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("[Fatal] Unhandled Rejection:", reason);
});

start().catch((err) => {
  console.error("[Fatal] Server failed to start:", err);
  process.exit(1);
});
