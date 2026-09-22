/** Document upload API. */

export interface DocumentChunk {
  id: number;
  title: string;
  uuid: string;
}

export interface DocumentUploadResponse {
  success: boolean;
  message: string;
  data: {
    id?: number;
    title: string;
    category: string;
    source: string;
    chunks_created: number;
    chunks: DocumentChunk[];
    agent_id?: number | null;
    item?: { id: number; title: string; category: string; source: string };
  };
}

import { API_BASE_URL } from "./client";

export async function uploadDocument(
  file: File,
  category: string = "General Knowledge",
  agentId?: number | null,
): Promise<DocumentUploadResponse> {
  const token = localStorage.getItem("access_token");
  const formData = new FormData();
  formData.append("file", file);
  formData.append("category", category || "General Knowledge");
  if (agentId != null) formData.append("agent_id", String(agentId));

  const headers: HeadersInit = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}/documents/upload`, {
    method: "POST",
    headers,
    body: formData,
  });

  const body: unknown = await response.json().catch(() => null);
  if (response.status === 401) {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    window.location.href = "/login";
    throw new Error("Authentication required.");
  }
  if (!response.ok) {
    const detail = body && typeof body === "object" && "detail" in body ? (body as { detail?: unknown }).detail : null;
    throw new Error(typeof detail === "string" ? detail : `Document upload failed with status ${response.status}.`);
  }
  if (!body || typeof body !== "object") throw new Error("The document service returned an invalid response.");
  return body as DocumentUploadResponse;
}

export async function uploadMultipleDocuments(
  files: File[],
  category: string = "General Knowledge",
  agentId?: number | null,
): Promise<DocumentUploadResponse[]> {
  const results: DocumentUploadResponse[] = [];
  for (const file of files) {
    const res = await uploadDocument(file, category, agentId);
    results.push(res);
  }
  return results;
}

