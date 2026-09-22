// Google Workspace (Gmail & Sheets) API Client

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

export interface GoogleStatusResponse {
  configured: boolean;
  linked_sheets: LinkedSpreadsheet[];
  oauth_scopes: string[];
}

export interface GmailMessagePreview {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  from: string;
  to: string;
  date: string;
}

export interface DriveSpreadsheetFile {
  id: string;
  name: string;
  modifiedTime: string;
  webViewLink: string;
}

function getAuthHeaders(googleToken?: string): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (googleToken) {
    headers["Authorization"] = `Bearer ${googleToken}`;
  }
  return headers;
}

export async function getGoogleStatus(): Promise<GoogleStatusResponse> {
  const res = await fetch("/api/v1/google/status");
  if (!res.ok) throw new Error("Failed to fetch Google status");
  return res.json();
}

export async function getGmailMessages(googleToken: string, q = "in:inbox", maxResults = 10): Promise<{ messages: GmailMessagePreview[]; total: number }> {
  const res = await fetch(`/api/v1/google/gmail/messages?q=${encodeURIComponent(q)}&maxResults=${maxResults}`, {
    headers: getAuthHeaders(googleToken),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to fetch Gmail" }));
    throw new Error(err.detail || "Failed to fetch Gmail messages");
  }
  return res.json();
}

export async function sendGmailMessage(
  googleToken: string,
  data: { to: string; subject: string; body: string }
): Promise<{ success: boolean; message_id: string; recipient: string; subject: string }> {
  const res = await fetch("/api/v1/google/gmail/send", {
    method: "POST",
    headers: getAuthHeaders(googleToken),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to send Gmail message" }));
    throw new Error(err.detail || "Failed to send Gmail message");
  }
  return res.json();
}

export async function listUserSpreadsheets(googleToken: string): Promise<{ files: DriveSpreadsheetFile[] }> {
  const res = await fetch("/api/v1/google/sheets/list", {
    headers: getAuthHeaders(googleToken),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to list Google Sheets" }));
    throw new Error(err.detail || "Failed to list Google Sheets");
  }
  return res.json();
}

export async function createReceptionistSpreadsheet(
  googleToken: string,
  title?: string
): Promise<{ success: boolean; spreadsheet_id: string; spreadsheet_url: string; linked: LinkedSpreadsheet }> {
  const res = await fetch("/api/v1/google/sheets/create", {
    method: "POST",
    headers: getAuthHeaders(googleToken),
    body: JSON.stringify({ title }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to create Google Sheet" }));
    throw new Error(err.detail || "Failed to create Google Sheet");
  }
  return res.json();
}

export async function linkExistingSpreadsheet(
  googleToken: string,
  spreadsheetId: string,
  sheetName?: string
): Promise<{ success: boolean; linked: LinkedSpreadsheet; message?: string }> {
  const res = await fetch("/api/v1/google/sheets/link", {
    method: "POST",
    headers: getAuthHeaders(googleToken),
    body: JSON.stringify({ spreadsheet_id: spreadsheetId, sheet_name: sheetName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to link Google Sheet" }));
    throw new Error(err.detail || "Failed to link Google Sheet");
  }
  return res.json();
}

export async function syncAllToGoogleSheets(
  googleToken: string,
  spreadsheetId?: string
): Promise<{
  success: boolean;
  spreadsheet_id: string;
  leads_synced: number;
  appointments_synced: number;
  total_rows_pushed: number;
  view_url: string;
}> {
  const res = await fetch("/api/v1/google/sheets/sync-all", {
    method: "POST",
    headers: getAuthHeaders(googleToken),
    body: JSON.stringify({ spreadsheet_id: spreadsheetId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to sync to Google Sheet" }));
    throw new Error(err.detail || "Failed to sync to Google Sheet");
  }
  return res.json();
}

export async function previewSpreadsheetRows(
  googleToken: string,
  spreadsheetId: string,
  range = "A1:H15"
): Promise<{ spreadsheet_id: string; range: string; values: string[][] }> {
  const res = await fetch(`/api/v1/google/sheets/${spreadsheetId}/preview?range=${encodeURIComponent(range)}`, {
    headers: getAuthHeaders(googleToken),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to preview rows" }));
    throw new Error(err.detail || "Failed to preview rows");
  }
  return res.json();
}

export async function unlinkSpreadsheet(spreadsheetId: string): Promise<void> {
  await fetch(`/api/v1/google/sheets/${spreadsheetId}`, { method: "DELETE" });
}
