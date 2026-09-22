import { API_BASE_URL } from "./client";

export interface Lead {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  interest?: string | null;
  preferred_mode?: string | null;
  preferred_time?: string | null;
  notes?: string | null;
  status: "new" | "contacted" | "qualified" | "converted" | "lost";
  lead_score?: number;
  conversation_id?: number | null;
  created_at: string;
  updated_at?: string;
}

export async function getLeads(): Promise<Lead[]> {
  const token = localStorage.getItem("access_token");
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}/leads`, { headers });
  if (!res.ok) throw new Error("Failed to fetch leads");
  const data = await res.json();
  return Array.isArray(data) ? data : data.leads || [];
}

export async function updateLead(id: number, updates: Partial<Lead>): Promise<Lead> {
  const token = localStorage.getItem("access_token");
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}/leads/${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error("Failed to update lead");
  return res.json();
}

export async function deleteLead(id: number): Promise<void> {
  const token = localStorage.getItem("access_token");
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}/leads/${id}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) throw new Error("Failed to delete lead");
}
