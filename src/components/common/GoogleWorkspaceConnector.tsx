import { useState, useEffect } from "react";
import {
  Mail,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Table,
  Inbox,
  LogOut,
  Sparkles,
} from "lucide-react";
import {
  GOOGLE_SCOPES,
  getStoredGoogleSession,
  saveGoogleSession,
  clearGoogleSession,
  fetchGoogleUserProfile,
  type GoogleUserSession,
} from "../../lib/gsi";
import {
  getGoogleStatus,
  getGmailMessages,
  sendGmailMessage,
  listUserSpreadsheets,
  createReceptionistSpreadsheet,
  linkExistingSpreadsheet,
  syncAllToGoogleSheets,
  previewSpreadsheetRows,
  unlinkSpreadsheet,
  type LinkedSpreadsheet,
  type GmailMessagePreview,
  type DriveSpreadsheetFile,
} from "../../api/googleWorkspace";

// AI Studio configured Client ID for project gen-lang-client-0399466665
const GOOGLE_CLIENT_ID = "767344607519-cgh0h0j028jhk09o7mcv381j0j9o8fep.apps.googleusercontent.com";

export default function GoogleWorkspaceConnector() {
  const [session, setSession] = useState<GoogleUserSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // Active Tab: "sheets" | "gmail"
  const [activeTab, setActiveTab] = useState<"sheets" | "gmail">("sheets");

  // Linked Sheets & Drive state
  const [linkedSheets, setLinkedSheets] = useState<LinkedSpreadsheet[]>([]);
  const [driveFiles, setDriveFiles] = useState<DriveSpreadsheetFile[]>([]);
  const [customSheetId, setCustomSheetId] = useState("");
  const [customSheetName, setCustomSheetName] = useState("Qualified Leads");
  const [previewData, setPreviewData] = useState<{ sheetId: string; rows: string[][] } | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Gmail state
  const [gmailMessages, setGmailMessages] = useState<GmailMessagePreview[]>([]);
  const [loadingGmail, setLoadingGmail] = useState(false);
  const [gmailFilter, setGmailFilter] = useState("in:inbox");
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendForm, setSendForm] = useState({
    to: "harishsadula333@gmail.com",
    subject: "Appointment Confirmation - Apex Solutions Reception Desk",
    body: "Hi,\n\nThis is a confirmation from the AI Receptionist at Apex Solutions. Your upcoming product consultation has been reserved.\n\nBest regards,\nMaya (AI Receptionist)",
  });
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    const existing = getStoredGoogleSession();
    if (existing) {
      setSession(existing);
    }
    // Load existing linked sheets config
    getGoogleStatus()
      .then((res) => {
        setLinkedSheets(res.linked_sheets || []);
      })
      .catch(() => {});
  }, []);

  // When session is present, refresh Drive spreadsheets and Gmail
  useEffect(() => {
    if (session?.accessToken) {
      loadDriveFiles(session.accessToken);
      if (activeTab === "gmail") {
        loadGmailMessages(session.accessToken, gmailFilter);
      }
    }
  }, [session, activeTab, gmailFilter]);

  function handleConnectGoogle() {
    setStatusMsg(null);
    if (!window.google?.accounts?.oauth2) {
      setStatusMsg({
        type: "error",
        text: "Google Identity Services SDK is initializing. Please wait a few seconds and try again.",
      });
      return;
    }

    try {
      setLoading(true);
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_SCOPES.join(" "),
        callback: async (response: { access_token?: string; expires_in?: number; error?: string }) => {
          setLoading(false);
          if (response.error || !response.access_token) {
            setStatusMsg({
              type: "error",
              text: `Google OAuth Authorization declined or failed: ${response.error || "No token returned"}`,
            });
            return;
          }

          const profile = await fetchGoogleUserProfile(response.access_token);
          saveGoogleSession(response.access_token, response.expires_in || 3600, profile);
          const newSession = getStoredGoogleSession();
          setSession(newSession);
          setStatusMsg({
            type: "success",
            text: `Successfully connected Google Account (${profile.email || "harishsadula333@gmail.com"}). Gmail & Sheets are now authorized.`,
          });
          loadDriveFiles(response.access_token);
        },
      });

      client.requestAccessToken({ prompt: "consent" });
    } catch (err) {
      setLoading(false);
      setStatusMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to trigger Google authentication popup.",
      });
    }
  }

  function handleDisconnect() {
    clearGoogleSession();
    setSession(null);
    setDriveFiles([]);
    setGmailMessages([]);
    setPreviewData(null);
    setStatusMsg({ type: "info", text: "Disconnected Google Account. Local token cleared." });
  }

  async function loadDriveFiles(token: string) {
    try {
      const res = await listUserSpreadsheets(token);
      setDriveFiles(res.files || []);
    } catch (err) {
      console.warn("Could not list drive spreadsheets:", err);
    }
  }

  async function loadGmailMessages(token: string, query: string) {
    setLoadingGmail(true);
    try {
      const res = await getGmailMessages(token, query);
      setGmailMessages(res.messages || []);
    } catch (err) {
      setStatusMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to load Gmail messages.",
      });
    } finally {
      setLoadingGmail(false);
    }
  }

  async function handleCreateNewSheet() {
    if (!session?.accessToken) return;
    setLoading(true);
    setStatusMsg(null);
    try {
      const res = await createReceptionistSpreadsheet(session.accessToken);
      setLinkedSheets((prev) => [res.linked, ...prev]);
      setStatusMsg({
        type: "success",
        text: `Created new Google Sheet "${res.linked.name}" with pre-formatted 'Qualified Leads' and 'Appointments' tabs.`,
      });
      loadDriveFiles(session.accessToken);
    } catch (err) {
      setStatusMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to create Google Sheet.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleLinkExisting(sheetIdToLink: string, title?: string) {
    if (!session?.accessToken || !sheetIdToLink) return;
    setLoading(true);
    setStatusMsg(null);
    try {
      const res = await linkExistingSpreadsheet(session.accessToken, sheetIdToLink, customSheetName);
      setLinkedSheets((prev) => {
        const filtered = prev.filter((s) => s.id !== sheetIdToLink);
        return [res.linked, ...filtered];
      });
      setCustomSheetId("");
      setStatusMsg({
        type: "success",
        text: `Linked Google Sheet "${title || res.linked.name}" successfully to AI Receptionist.`,
      });
    } catch (err) {
      setStatusMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to link Google Sheet.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSyncAll(sheetId?: string) {
    if (!session?.accessToken) {
      setStatusMsg({ type: "error", text: "Please connect your Google Account first to sync to Google Sheets." });
      return;
    }
    setSyncing(true);
    setStatusMsg(null);
    try {
      const res = await syncAllToGoogleSheets(session.accessToken, sheetId);
      setStatusMsg({
        type: "success",
        text: `Successfully synced ${res.leads_synced} leads and ${res.appointments_synced} appointments to Google Sheets (${res.total_rows_pushed} total rows added).`,
      });
      // Update local count
      const targetId = res.spreadsheet_id;
      setLinkedSheets((prev) =>
        prev.map((s) => (s.id === targetId ? { ...s, totalSyncedRows: s.totalSyncedRows + res.total_rows_pushed } : s))
      );
      if (previewData?.sheetId === targetId) {
        handlePreviewSheet(targetId);
      }
    } catch (err) {
      setStatusMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Sync to Google Sheets failed.",
      });
    } finally {
      setSyncing(false);
    }
  }

  async function handlePreviewSheet(sheetId: string) {
    if (!session?.accessToken) return;
    try {
      const res = await previewSpreadsheetRows(session.accessToken, sheetId);
      setPreviewData({ sheetId, rows: res.values });
    } catch (err) {
      setStatusMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to read sheet contents.",
      });
    }
  }

  async function handleUnlink(sheetId: string) {
    await unlinkSpreadsheet(sheetId);
    setLinkedSheets((prev) => prev.filter((s) => s.id !== sheetId));
    if (previewData?.sheetId === sheetId) setPreviewData(null);
  }

  async function handleSendEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.accessToken) return;
    setSendingEmail(true);
    try {
      await sendGmailMessage(session.accessToken, sendForm);
      setStatusMsg({
        type: "success",
        text: `Email dispatched via Gmail to ${sendForm.to}! Check your Sent folder or recipient inbox.`,
      });
      setShowSendModal(false);
      loadGmailMessages(session.accessToken, gmailFilter);
    } catch (err) {
      setStatusMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to send Gmail message.",
      });
    } finally {
      setSendingEmail(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Account Connection Header Card */}
      <div className="rounded-3xl border border-indigo-200/80 bg-gradient-to-br from-indigo-500/10 via-white to-sky-500/10 p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-sky-600 text-white shadow-md shadow-indigo-500/25">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">Google Workspace Connect (Gmail & Sheets)</h2>
                {session ? (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    Connected
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                    Not Connected
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-slate-600">
                {session
                  ? `Authenticated as ${session.email || "harishsadula333@gmail.com"} with Gmail & Sheets scopes`
                  : "Connect your official Google account to read incoming emails, send confirmations, and sync leads directly to Google Sheets."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!session ? (
              <button
                type="button"
                onClick={handleConnectGoogle}
                disabled={loading}
                className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-500 transition active:scale-95 disabled:opacity-50"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                {loading ? "Connecting..." : "Connect Google Account"}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSyncAll()}
                  disabled={syncing}
                  className="flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 transition"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                  {syncing ? "Syncing..." : "Push All to Sheets"}
                </button>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
                  title="Disconnect account"
                >
                  <LogOut className="h-3.5 w-3.5 text-slate-400" />
                  Disconnect
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Status Feedback Banner */}
        {statusMsg && (
          <div
            className={`mt-4 flex items-start gap-2 rounded-2xl p-3 text-xs ${
              statusMsg.type === "success"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                : statusMsg.type === "error"
                ? "border border-rose-200 bg-rose-50 text-rose-800"
                : "border border-sky-200 bg-sky-50 text-sky-800"
            }`}
          >
            {statusMsg.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            )}
            <p className="flex-1">{statusMsg.text}</p>
          </div>
        )}
      </div>

      {/* Tabs Switcher: Google Sheets vs. Gmail */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("sheets")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
            activeTab === "sheets"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <FileSpreadsheet className="h-4 w-4" />
          Google Sheets Synchronization
          <span className="rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-mono">
            {linkedSheets.length} linked
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("gmail")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
            activeTab === "gmail"
              ? "bg-rose-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Mail className="h-4 w-4" />
          Gmail Inquiry Triage & Dispatch
        </button>
      </div>

      {/* TAB 1: GOOGLE SHEETS */}
      {activeTab === "sheets" && (
        <div className="space-y-6">
          {/* Action Row */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Action 1: Create Receptionist Template Sheet */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Plus className="h-4 w-4 text-emerald-600" />
                <span>Create Pre-Configured Registry Sheet</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Generates a new spreadsheet in your Google Drive with formatted tabs for <strong>Qualified Leads</strong> and <strong>Appointments</strong>.
              </p>
              <button
                type="button"
                onClick={handleCreateNewSheet}
                disabled={!session || loading}
                className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                Create & Link New Sheet
              </button>
            </div>

            {/* Action 2: Link Existing Sheet ID */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                <span>Link Existing Google Sheet by ID</span>
              </div>
              <p className="text-xs text-slate-600">
                Paste the Spreadsheet ID from any Google Sheets URL (e.g., docs.google.com/spreadsheets/d/<strong>ID</strong>/edit).
              </p>
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  placeholder="Paste Spreadsheet ID..."
                  value={customSheetId}
                  onChange={(e) => setCustomSheetId(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Tab name (e.g. Qualified Leads)"
                    value={customSheetName}
                    onChange={(e) => setCustomSheetName(e.target.value)}
                    className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleLinkExisting(customSheetId.trim())}
                    disabled={!session || !customSheetId.trim() || loading}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition"
                  >
                    Link
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Drive Spreadsheets Quick Picker (If logged in) */}
          {session && driveFiles.length > 0 && (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 space-y-2">
              <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
                Your Recent Google Drive Spreadsheets (Quick Link)
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {driveFiles.map((file) => {
                  const isLinked = linkedSheets.some((s) => s.id === file.id);
                  return (
                    <div
                      key={file.id}
                      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 shadow-2xs"
                    >
                      <span className="max-w-[180px] truncate font-medium">{file.name}</span>
                      {isLinked ? (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                          Linked
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleLinkExisting(file.id, file.name)}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                        >
                          + Link
                        </button>
                      )}
                      <a
                        href={file.webViewLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-400 hover:text-slate-600"
                        title="Open in Google Drive"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Linked Sheets Table */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Active Linked Spreadsheets</h3>
                <p className="text-xs text-slate-500">
                  Customer leads & appointment bookings will sync to these destination sheets.
                </p>
              </div>
              {session && (
                <button
                  type="button"
                  onClick={() => handleSyncAll()}
                  disabled={syncing}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                  Sync All Records Now
                </button>
              )}
            </div>

            {linkedSheets.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No Google Sheets linked yet. Connect your Google account and click &quot;Create & Link New Sheet&quot; above.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {linkedSheets.map((sheet) => (
                  <div
                    key={sheet.id}
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50/60 transition"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span className="text-xs font-bold text-slate-900">{sheet.name}</span>
                        <a
                          href={`https://docs.google.com/spreadsheets/d/${sheet.id}/edit`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-400 hover:text-emerald-600 transition"
                          title="Open Google Sheet in new tab"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                        <span>Sheet ID: <code className="font-mono text-slate-700">{sheet.id.slice(0, 16)}...</code></span>
                        <span>• Target Tab: <strong className="text-slate-700">{sheet.sheetName}</strong></span>
                        <span>• Total Synced: <strong className="text-emerald-700">{sheet.totalSyncedRows} rows</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handlePreviewSheet(sheet.id)}
                        disabled={!session}
                        className="flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
                      >
                        <Table className="h-3.5 w-3.5 text-slate-500" />
                        Preview Rows
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSyncAll(sheet.id)}
                        disabled={!session || syncing}
                        className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 transition"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                        Sync This
                      </button>

                      <button
                        type="button"
                        onClick={() => handleUnlink(sheet.id)}
                        className="rounded-xl p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                        title="Unlink sheet"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Live Sheet Preview Modal / Drawer */}
          {previewData && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Table className="h-4 w-4 text-emerald-600" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Live Sheet Rows Preview ({previewData.rows.length} rows loaded)
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewData(null)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Close Preview
                </button>
              </div>

              {previewData.rows.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-3">This spreadsheet currently has no rows in range A1:H15.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-bold">
                        {previewData.rows[0]?.map((header, i) => (
                          <th key={i} className="px-3 py-2">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600">
                      {previewData.rows.slice(1).map((row, rowIdx) => (
                        <tr key={rowIdx} className="hover:bg-slate-50">
                          {row.map((cell, colIdx) => (
                            <td key={colIdx} className="px-3 py-1.5 whitespace-nowrap">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: GMAIL INQUIRY TRIAGE & DISPATCH */}
      {activeTab === "gmail" && (
        <div className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Gmail Inbox Inquiries</h3>
              <p className="text-xs text-slate-500">
                View incoming messages from customers and send automated receptionist email confirmations.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => session?.accessToken && loadGmailMessages(session.accessToken, gmailFilter)}
                disabled={!session || loadingGmail}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingGmail ? "animate-spin" : ""}`} />
                Refresh
              </button>

              <button
                type="button"
                onClick={() => setShowSendModal(true)}
                disabled={!session}
                className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-rose-500 transition"
              >
                <Send className="h-3.5 w-3.5" />
                Compose Confirmation Email
              </button>
            </div>
          </div>

          {/* Quick Filter Bar */}
          <div className="flex items-center gap-2">
            {["in:inbox", "is:unread", "subject:demo", "subject:appointment"].map((query) => (
              <button
                key={query}
                type="button"
                onClick={() => {
                  setGmailFilter(query);
                  if (session?.accessToken) loadGmailMessages(session.accessToken, query);
                }}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                  gmailFilter === query
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {query}
              </button>
            ))}
          </div>

          {/* Messages List */}
          {!session ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
              Connect your Google Account above to view your Gmail messages and enable AI Receptionist email dispatches.
            </div>
          ) : loadingGmail ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
              Fetching recent messages from Gmail API...
            </div>
          ) : gmailMessages.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
              <Inbox className="mx-auto h-8 w-8 text-slate-300 mb-2" />
              No emails matching query &quot;{gmailFilter}&quot;.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              {gmailMessages.map((msg) => (
                <div key={msg.id} className="p-4 hover:bg-slate-50/80 transition space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 truncate">{msg.from}</span>
                        <span className="text-[10px] font-mono text-slate-400">to {msg.to}</span>
                      </div>
                      <h5 className="text-xs font-semibold text-slate-800 mt-0.5 truncate">{msg.subject}</h5>
                    </div>
                    <span className="shrink-0 text-[11px] text-slate-400">{msg.date}</span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{msg.snippet}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Compose Email Modal */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-rose-600" />
                <h3 className="text-sm font-bold text-slate-900">Send Email via Gmail</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSendModal(false)}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendEmail} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Recipient (To:)</label>
                <input
                  type="email"
                  required
                  value={sendForm.to}
                  onChange={(e) => setSendForm({ ...sendForm, to: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Subject</label>
                <input
                  type="text"
                  required
                  value={sendForm.subject}
                  onChange={(e) => setSendForm({ ...sendForm, subject: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Body (HTML/Text)</label>
                <textarea
                  rows={6}
                  required
                  value={sendForm.body}
                  onChange={(e) => setSendForm({ ...sendForm, body: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white focus:border-rose-500 focus:outline-none font-sans"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSendModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingEmail}
                  className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-50 transition"
                >
                  <Send className="h-3.5 w-3.5" />
                  {sendingEmail ? "Dispatching via Gmail..." : "Send Email"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
