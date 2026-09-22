import { get, patch, post } from "./client";

export interface Conversation {
  id: number;
  organization_id: number;
  agent_id?: number;
  user_id: number | null;
  session_id: string;
  channel?: "web" | "voice" | "whatsapp";
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  customer_experience?: string | null;
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
  customer_course_preferences?: Record<string, { mode?: string | null; batch?: string | null }> | null;
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
    resolved?: boolean;
  }> | null;
  conflicts?: Array<{
    id: string;
    type: "TIMING_OVERLAP" | "MODE_INCOMPATIBLE" | "PREFERENCE_OVERRIDE" | "SCHEDULE_COLLISION";
    description: string;
    courses: string[];
    status: "active" | "resolved";
    resolution_advice?: string;
    detected_at?: string;
  }> | null;
  ko_summary?: {
    readiness_score?: number;
    completed_steps?: string[];
    pending_steps?: string[];
    course_breakdown?: Array<{
      course: string;
      mode?: string | null;
      batch?: string | null;
      status: "confirmed" | "pending_mode" | "pending_batch" | "inquired";
    }>;
    active_conflicts_count?: number;
    resolved_intents_count?: number;
    knowledge_touchpoints?: string[];
    next_best_action?: string;
  } | null;
  status: string;
  conversation_state?: string;
  detected_intent?: string;
  language?: "en" | "te" | "hi";
  sentiment?: "positive" | "neutral" | "frustrated";
  is_human_takeover?: boolean;
  lead_id?: number | null;
  appointment_id?: number | null;
  summary?: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: number;
  conversation_id: number;
  role: string;
  content: string;
  tool_calls?: { tool: string; args: Record<string, unknown>; result: unknown }[];
  grounding_sources?: { id: number; title: string; source: string }[];
  state_snapshot?: string;
  created_at: string;
}

export interface ConversationStatusUpdate {
  status: string;
}

export async function getConversations(status?: string): Promise<Conversation[]> {
  const endpoint = status ? `/conversations?status=${encodeURIComponent(status)}` : "/conversations";
  const response = await get<Conversation[] | { data: Conversation[] }>(endpoint);
  return Array.isArray(response) ? response : response.data;
}

export async function getConversation(conversationId: number): Promise<Conversation> {
  const response = await get<Conversation | { data: Conversation }>(`/conversations/${conversationId}`);
  if (typeof response === "object" && response !== null && "data" in response) {
    return response.data;
  }
  return response;
}

export async function getMessages(conversationId: number): Promise<Message[]> {
  const response = await get<Message[] | { data: Message[] }>(`/conversations/${conversationId}/messages`);
  return Array.isArray(response) ? response : response.data;
}

export async function updateConversationStatus(conversationId: number, status: string): Promise<Conversation> {
  const response = await patch<Conversation | { data: Conversation }, ConversationStatusUpdate>(
    `/conversations/${conversationId}`,
    { status },
  );
  if (typeof response === "object" && response !== null && "data" in response) {
    return response.data;
  }
  return response;
}

export async function takeoverConversation(conversationId: number): Promise<{ is_human_takeover: boolean; status: string }> {
  return post<{ is_human_takeover: boolean; status: string }, Record<string, never>>(
    `/conversations/${conversationId}/takeover`,
    {},
  );
}

export async function sendOperatorMessage(conversationId: number, content: string): Promise<Message> {
  return post<Message, { content: string }>(`/conversations/${conversationId}/operator-message`, { content });
}

export const getConversationMessages = getMessages;
