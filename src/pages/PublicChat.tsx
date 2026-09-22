import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Send, Bot, Sparkles, Check, Copy } from "lucide-react";
import { API_BASE_URL } from "../api/client";

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
}

export default function PublicChat() {
  const { slug } = useParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [agentName, setAgentName] = useState("AI Receptionist");
  const [agentAvatar, setAgentAvatar] = useState("");
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [quickReplies, setQuickReplies] = useState<string[]>([
    "Which courses do you offer?",
    "What are the course fees?",
    "What are the batch timings?",
    "Where is your campus located?",
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadPublicAgent() {
      try {
        const res = await fetch(`${API_BASE_URL}/chat/public/${slug || "apex-maya"}`);
        if (res.ok) {
          const data = await res.json();
          setAgentName(data.name || "Maya — Receptionist");
          setAgentAvatar(data.avatar || "");
          setCompanyName(data.company_name || null);
          if (data.welcome_message) {
            setMessages([{ id: 1, role: "assistant", content: data.welcome_message }]);
          }
          if (data.quick_replies || data.suggested_questions) {
            const replies = data.quick_replies || data.suggested_questions;
            if (Array.isArray(replies) && replies.length > 0) {
              setQuickReplies(replies);
            }
          }
        }
      } catch {
        setMessages([
          {
            id: 1,
            role: "assistant",
            content: "Hello! I'm Maya, your AI receptionist. How can I assist you today?",
          },
        ]);
      }
    }
    loadPublicAgent();
  }, [slug]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim() || loading) return;

    const userMsg: Message = { id: Date.now(), role: "user", content: query.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/chat/public-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: slug || "apex-maya",
          message: query.trim(),
          session_id: sessionId,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to get response");
      }

      const data = await res.json();
      if (data.session_id) setSessionId(data.session_id);
      if (data.quick_replies && Array.isArray(data.quick_replies) && data.quick_replies.length > 0) {
        setQuickReplies(data.quick_replies);
      }

      const replyText = data.reply || data.response || data.message || data.text;
      const aiMsg: Message = {
        id: Date.now() + 1,
        role: "assistant",
        content: replyText || "I'm here to assist you with our courses, admissions, and batch schedules. How can I help you today?",
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: "I apologize, but I am currently having trouble connecting. Please try again or reach our admissions team.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (id: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex h-screen w-full flex-col bg-slate-950 text-slate-100">
      {/* Top Header */}
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={agentAvatar || "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80"}
              alt={agentName}
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-full object-cover border-2 border-indigo-500"
            />
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-900" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white flex items-center gap-2">
              {agentName}
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Official AI Receptionist
              </span>
            </h1>
            <p className="text-xs text-slate-400">{companyName ? `${companyName} • ` : ""}Online & ready to assist</p>
          </div>
        </div>
      </header>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6 max-w-4xl mx-auto w-full">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 shadow-sm relative group ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white rounded-br-none"
                  : "bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none"
              }`}
            >
              {msg.role === "assistant" && (
                <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-800/80 text-[11px] font-semibold text-slate-400">
                  <span className="flex items-center gap-1.5 text-indigo-400">
                    <Bot className="w-3.5 h-3.5" />
                    {agentName}
                  </span>
                  <button
                    onClick={() => copyToClipboard(msg.id, msg.content)}
                    className="opacity-0 group-hover:opacity-100 transition text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedId === msg.id ? "Copied" : "Copy"}</span>
                  </button>
                </div>
              )}
              <div className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-bl-none p-4 flex items-center gap-2 text-slate-400 text-xs">
              <Sparkles className="w-4 h-4 text-indigo-400 animate-spin" />
              <span>{agentName} is responding instantly...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Dynamic Suggested questions */}
      {quickReplies.length > 0 && (
        <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 pb-2">
          <div className="flex items-center gap-2 overflow-x-auto py-1 no-scrollbar text-xs">
            {quickReplies.map((sug) => (
              <button
                key={sug}
                onClick={() => handleSend(sug)}
                disabled={loading}
                className="whitespace-nowrap px-3 py-1.5 rounded-full border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:border-indigo-500/50 hover:text-indigo-200 transition disabled:opacity-50"
              >
                {sug}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input bar */}
      <footer className="border-t border-slate-800 bg-slate-900/90 p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="max-w-4xl mx-auto flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your question or reply here..."
            className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </footer>
    </div>
  );
}
