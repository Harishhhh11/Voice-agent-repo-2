import { API_BASE_URL } from "./client";

export interface SendMessagePayload {
  agent_id?: number;
  message: string;
  session_id?: string | null;
  channel?: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
}

export interface SendMessageResponse {
  session_id: string;
  conversation_id: number;
  reply: string;
  response: string;
  message?: string;
  suggested_actions?: string[];
  tools_called?: string[];
  lead_created?: boolean;
  lead_score?: number;
  appointment_created?: boolean;
  transfer_initiated?: boolean;
}

export async function sendMessage(
  payloadOrMessage: SendMessagePayload | string,
  sessionId?: string | null,
  agentId?: number | null
): Promise<SendMessageResponse> {
  const token = localStorage.getItem("access_token");
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let payload: SendMessagePayload;
  if (typeof payloadOrMessage === "string") {
    payload = {
      message: payloadOrMessage,
      session_id: sessionId ?? null,
      agent_id: agentId || 1,
    };
  } else {
    payload = payloadOrMessage;
  }

  const res = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Chat request failed with status ${res.status}`);
  }

  const data = await res.json();
  const text = data.reply || data.response || data.message || "";
  return {
    ...data,
    reply: text,
    response: text,
    message: text,
  };
}
