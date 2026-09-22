import { useEffect, useMemo, useState } from "react";
import {
  MessageSquare,
  Search,
  Globe,
  Phone,
  Send,
  UserCheck,
  Bot,
  User,
  AlertCircle,
  PhoneCall,
  Sparkles,
} from "lucide-react";
import PageHeader from "../components/common/PageHeader";
import { KOSummaryView } from "../components/common/KOSummaryView";
import {
  getConversations,
  getMessages,
  takeoverConversation,
  sendOperatorMessage,
  updateConversationStatus,
  type Conversation,
  type Message,
} from "../api/conversations";

export default function Conversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState("all");
  const [operatorInput, setOperatorInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isTakingOver, setIsTakingOver] = useState(false);
  const [activeViewTab, setActiveViewTab] = useState<"transcript" | "ko_summary">("transcript");

  useEffect(() => {
    let mounted = true;
    getConversations()
      .then((data) => {
        if (!mounted) return;
        setConversations(data);
        if (data.length > 0) setSelectedId(data[0].id);
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : "Failed to load conversations.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoadingMessages(true);
    getMessages(selectedId)
      .then(setMessages)
      .catch((err) => console.error("Error loading messages:", err))
      .finally(() => setLoadingMessages(false));
  }, [selectedId]);

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedId),
    [conversations, selectedId],
  );

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conversations.filter((c) => {
      if (channelFilter !== "all" && c.channel !== channelFilter) return false;
      if (!q) return true;
      return (
        (c.customer_name && c.customer_name.toLowerCase().includes(q)) ||
        (c.customer_phone && c.customer_phone.includes(q)) ||
        (c.summary && c.summary.toLowerCase().includes(q)) ||
        (c.detected_intent && c.detected_intent.toLowerCase().includes(q))
      );
    });
  }, [conversations, search, channelFilter]);

  async function handleToggleTakeover() {
    if (!selectedId || isTakingOver) return;
    setIsTakingOver(true);
    try {
      const resp = await takeoverConversation(selectedId);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedId
            ? { ...c, is_human_takeover: resp.is_human_takeover, status: resp.status }
            : c,
        ),
      );
      // Reload messages to show system announcement
      const updatedMessages = await getMessages(selectedId);
      setMessages(updatedMessages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle human takeover.");
    } finally {
      setIsTakingOver(false);
    }
  }

  async function handleSendOperatorMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || !operatorInput.trim()) return;
    const text = operatorInput.trim();
    setOperatorInput("");

    try {
      const newMsg = await sendOperatorMessage(selectedId, text);
      setMessages((prev) => [...prev, newMsg]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send operator message.");
    }
  }

  async function handleCloseConversation() {
    if (!selectedId) return;
    try {
      const updated = await updateConversationStatus(selectedId, "completed");
      setConversations((prev) => prev.map((c) => (c.id === selectedId ? updated : c)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to close conversation.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live Conversations"
        description="Monitor multi-channel conversations across web chat, phone calls, and WhatsApp with live human takeover capability."
      />

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Main Container: Split Column (Inbox List & Chat Panel) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 h-[calc(100vh-220px)] min-h-[600px]">
        {/* Left: Conversation Threads List */}
        <div className="lg:col-span-4 flex flex-col rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          {/* Filter Bar */}
          <div className="space-y-3 pb-3 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search visitor, phone, intent..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-400 focus:border-indigo-500 focus:bg-slate-900 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1">
              {["all", "web", "voice", "whatsapp"].map((ch) => (
                <button
                  key={ch}
                  onClick={() => setChannelFilter(ch)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase transition ${
                    channelFilter === ch
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>

          {/* List of items */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 mt-2">
            {loading ? (
              <p className="p-4 text-center text-xs text-slate-400">Loading conversations...</p>
            ) : filteredConversations.length === 0 ? (
              <p className="p-4 text-center text-xs text-slate-400">No conversations match your filter.</p>
            ) : (
              filteredConversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full p-3 text-left transition rounded-2xl ${
                    selectedId === c.id
                      ? "bg-indigo-50/60 border border-indigo-200"
                      : "hover:bg-slate-50 border border-transparent"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-slate-900">
                        {c.customer_name || c.customer_phone || `Session #${c.id}`}
                      </span>
                      {c.channel === "voice" ? (
                        <Phone className="h-3 w-3 text-emerald-600" />
                      ) : c.channel === "whatsapp" ? (
                        <MessageSquare className="h-3 w-3 text-green-600" />
                      ) : (
                        <Globe className="h-3 w-3 text-indigo-600" />
                      )}
                    </div>
                    <span
                      className={`text-[10px] font-bold rounded-full px-2 py-0.5 uppercase ${
                        c.is_human_takeover
                          ? "bg-amber-100 text-amber-800 font-black"
                          : c.status === "active"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {c.is_human_takeover ? "Human Live" : c.status}
                    </span>
                  </div>

                  <p className="mt-1 text-[11px] text-slate-500 line-clamp-2">
                    {c.summary || "Incoming customer inquiry conversation"}
                  </p>

                  <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                    <span className="font-mono">{c.conversation_state || "DISCOVERY"}</span>
                    <span>{new Date(c.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: Active Chat Session Panel */}
        <div className="lg:col-span-8 flex flex-col rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {selectedConversation ? (
            <>
              {/* Header with Human Takeover action */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
                    {selectedConversation.channel === "voice" ? (
                      <PhoneCall className="h-5 w-5" />
                    ) : (
                      <MessageSquare className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">
                      {selectedConversation.customer_name || selectedConversation.customer_phone || `Visitor #${selectedConversation.id}`}
                    </h3>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span>Channel: {(selectedConversation.channel || "WEB").toUpperCase()}</span>
                      <span>•</span>
                      <span>State: {selectedConversation.conversation_state}</span>
                      {selectedConversation.sentiment && (
                        <>
                          <span>•</span>
                          <span className="capitalize">Sentiment: {selectedConversation.sentiment}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* View mode toggle */}
                  <div className="flex items-center rounded-xl bg-slate-100 p-1">
                    <button
                      onClick={() => setActiveViewTab("transcript")}
                      className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        activeViewTab === "transcript"
                          ? "bg-white text-indigo-600 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      Transcript
                    </button>
                    <button
                      onClick={() => setActiveViewTab("ko_summary")}
                      className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        activeViewTab === "ko_summary"
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      KO Summary
                    </button>
                  </div>

                  <button
                    onClick={handleToggleTakeover}
                    disabled={isTakingOver}
                    className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition shadow-sm ${
                      selectedConversation.is_human_takeover
                        ? "bg-amber-600 text-white hover:bg-amber-500"
                        : "bg-indigo-600 text-white hover:bg-indigo-500"
                    }`}
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                    {selectedConversation.is_human_takeover ? "End Takeover" : "Take Over"}
                  </button>

                  {selectedConversation.status !== "completed" && (
                    <button
                      onClick={handleCloseConversation}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              </div>

              {/* Takeover Active Banner */}
              {selectedConversation.is_human_takeover && (
                <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800 border-b border-amber-200">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  Human Takeover is ACTIVE. Autonomous AI responses are paused. Send responses below as staff operator.
                </div>
              )}

              {/* View Panel Content */}
              {activeViewTab === "ko_summary" ? (
                <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
                  <KOSummaryView
                    visitorName={selectedConversation.customer_name}
                    visitorPhone={selectedConversation.customer_phone}
                    visitorEmail={selectedConversation.customer_email}
                    visitorExperience={selectedConversation.customer_experience}
                    entryContext={selectedConversation.entry_context}
                    multiIntents={selectedConversation.multi_intents}
                    conflicts={selectedConversation.conflicts}
                    summaryData={selectedConversation.ko_summary}
                  />
                </div>
              ) : (
                /* Message Transcript View */
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30">
                  {loadingMessages ? (
                    <p className="p-8 text-center text-xs text-slate-400">Loading conversation transcript...</p>
                  ) : (
                    messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex gap-3 text-xs ${
                        m.role === "assistant" || m.role === "operator" || m.role === "system"
                          ? "items-start"
                          : "items-start flex-row-reverse"
                      }`}
                    >
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${
                          m.role === "operator"
                            ? "bg-amber-600 text-white"
                            : m.role === "assistant"
                            ? "bg-indigo-600 text-white"
                            : m.role === "system"
                            ? "bg-slate-300 text-slate-700"
                            : "bg-slate-900 text-white"
                        }`}
                      >
                        {m.role === "operator" ? (
                          <UserCheck className="h-4 w-4" />
                        ) : m.role === "assistant" ? (
                          <Bot className="h-4 w-4" />
                        ) : (
                          <User className="h-4 w-4" />
                        )}
                      </div>

                      <div
                        className={`max-w-[75%] rounded-2xl p-3.5 shadow-sm ${
                          m.role === "operator"
                            ? "bg-amber-50 border border-amber-200 text-slate-900"
                            : m.role === "assistant"
                            ? "bg-white border border-slate-200 text-slate-800"
                            : m.role === "system"
                            ? "bg-slate-100 text-slate-600 text-center mx-auto italic"
                            : "bg-slate-900 text-white"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4 mb-1 text-[10px] opacity-75">
                          <span className="font-bold">
                            {m.role === "operator"
                              ? "Staff Operator (You)"
                              : m.role === "assistant"
                              ? "AI Receptionist (Maya)"
                              : m.role === "system"
                              ? "System Notification"
                              : "Visitor"}
                          </span>
                          <span>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <p className="leading-relaxed">{m.content}</p>

                        {/* Tool execution badge if present */}
                        {m.tool_calls && m.tool_calls.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-indigo-600 font-mono">
                            Executed: {m.tool_calls.map((t) => t.tool).join(", ")}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
              )}

              {/* Operator Message Input */}
              <div className="border-t border-slate-200 p-4 bg-white">
                <form onSubmit={handleSendOperatorMessage} className="flex gap-2">
                  <input
                    type="text"
                    value={operatorInput}
                    onChange={(e) => setOperatorInput(e.target.value)}
                    placeholder={
                      selectedConversation.is_human_takeover
                        ? "Type response as human operator..."
                        : "Take over as human first to reply directly..."
                    }
                    className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs text-white placeholder-slate-400 focus:border-indigo-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!operatorInput.trim()}
                    className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 transition"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Send
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-center text-xs text-slate-400">
              Select a conversation from the left to view messages and manage customer interaction.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
