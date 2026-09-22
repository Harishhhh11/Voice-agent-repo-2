import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, Bot, MessageSquare, ArrowUpRight, Sparkles, Clock } from "lucide-react";
import PageHeader from "../components/common/PageHeader";
import { getLeads, type Lead } from "../api/leads";
import { getAgents, type Agent } from "../api/agents";
import { getConversations, type Conversation } from "../api/conversations";

export default function Dashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [lData, aData, cData] = await Promise.all([
          getLeads().catch(() => []),
          getAgents().catch(() => []),
          getConversations().catch(() => []),
        ]);
        setLeads(lData);
        setAgents(aData);
        setConversations(cData);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const totalLeads = leads.length;
  const activeAgents = agents.filter((a) => a.is_active).length;
  const totalConversations = conversations.length;
  const highIntentLeads = leads.filter((l) => (l.lead_score || 0) >= 80).length;

  return (
    <div className="flex-1 min-h-screen bg-slate-900 pb-12">
      <PageHeader
        title="Reception Operations Dashboard"
        description="Live monitoring of AI receptionists, inbound inquiries, qualified leads, and system activity."
      >
        <div className="flex items-center gap-3">
          <Link
            to="/chat"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition"
          >
            <Bot className="w-4 h-4" />
            Launch Live Receptionist
          </Link>
          <Link
            to="/lab"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-700 transition"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            Interactive Test Lab
          </Link>
        </div>
      </PageHeader>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Leads</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <p className="mt-4 text-3xl font-black text-white">{totalLeads}</p>
            <p className="mt-1 text-xs text-slate-400 flex items-center gap-1">
              <span className="text-emerald-400 font-medium">{highIntentLeads} high-intent</span> qualified
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Receptionists</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
                <Bot className="w-5 h-5" />
              </div>
            </div>
            <p className="mt-4 text-3xl font-black text-white">{activeAgents}</p>
            <p className="mt-1 text-xs text-slate-400">24/7 Web, Voice & WhatsApp active</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Inbound Turns</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400">
                <MessageSquare className="w-5 h-5" />
              </div>
            </div>
            <p className="mt-4 text-3xl font-black text-white">{totalConversations}</p>
            <p className="mt-1 text-xs text-slate-400">Handled with contextual AI</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">AI Response Uptime</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <p className="mt-4 text-3xl font-black text-white">99.9%</p>
            <p className="mt-1 text-xs text-emerald-400 font-medium">Ultra-low latency inference</p>
          </div>
        </div>

        {/* Receptionists & Recent Inquiries Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Active Receptionists Column */}
          <div className="lg:col-span-1 rounded-2xl border border-slate-800 bg-slate-950/60 p-6 flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-indigo-400" />
                <h2 className="text-base font-bold text-white">AI Staff Team</h2>
              </div>
              <Link to="/agents" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium">
                Manage
              </Link>
            </div>

            <div className="mt-4 space-y-3 flex-1">
              {loading ? (
                <div className="text-sm text-slate-400 py-6 text-center">Loading AI receptionists...</div>
              ) : agents.length === 0 ? (
                <div className="text-sm text-slate-400 py-6 text-center">No receptionists configured yet.</div>
              ) : (
                agents.map((agent) => (
                  <div
                    key={agent.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-800/80 bg-slate-900/60 hover:border-slate-700 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={agent.avatar || "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80"}
                        alt={agent.name}
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-xl object-cover border border-slate-700"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{agent.name}</p>
                        <p className="text-xs text-slate-400 capitalize">{agent.personality || "Professional"} Receptionist</p>
                      </div>
                    </div>
                    <Link
                      to={`/chat/agent/${agent.id}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 px-2.5 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 transition"
                    >
                      Chat
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Leads Column */}
          <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                <h2 className="text-base font-bold text-white">Recent Qualified Inbound Leads</h2>
              </div>
              <Link to="/leads" className="text-xs text-blue-400 hover:text-blue-300 font-medium">
                View All ({leads.length})
              </Link>
            </div>

            <div className="mt-4 overflow-x-auto">
              {loading ? (
                <div className="text-sm text-slate-400 py-8 text-center">Loading inbound leads...</div>
              ) : leads.length === 0 ? (
                <div className="text-sm text-slate-400 py-8 text-center">
                  No leads recorded yet. Chat with the AI Receptionist to qualify your first student or customer!
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      <th className="pb-3">Contact</th>
                      <th className="pb-3">Interest / Course</th>
                      <th className="pb-3">Preferred Mode & Time</th>
                      <th className="pb-3">Score</th>
                      <th className="pb-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {leads.slice(0, 6).map((lead) => (
                      <tr key={lead.id} className="hover:bg-slate-900/40 transition">
                        <td className="py-3.5 font-medium text-white">
                          <div className="flex flex-col">
                            <span>{lead.name}</span>
                            {lead.phone && <span className="text-xs text-slate-400">{lead.phone}</span>}
                            {lead.email && <span className="text-xs text-slate-400">{lead.email}</span>}
                          </div>
                        </td>
                        <td className="py-3.5 text-xs text-slate-300 truncate max-w-[200px]">
                          {lead.interest || "General Inquiry"}
                        </td>
                        <td className="py-3.5 text-xs text-slate-400">
                          <div>{lead.preferred_mode || "Flexible"}</div>
                          <div className="text-[11px] text-slate-500">{lead.preferred_time || "Anytime"}</div>
                        </td>
                        <td className="py-3.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                              (lead.lead_score || 0) >= 80
                                ? "bg-emerald-500/20 text-emerald-300"
                                : (lead.lead_score || 0) >= 60
                                ? "bg-blue-500/20 text-blue-300"
                                : "bg-slate-700 text-slate-300"
                            }`}
                          >
                            {lead.lead_score || 70}/100
                          </span>
                        </td>
                        <td className="py-3.5">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-300 capitalize">
                            {lead.status || "new"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Quick Launch & Testing Banner */}
        <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/60 via-slate-950 to-slate-900 p-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center md:text-left">
            <h3 className="text-lg font-bold text-white flex items-center justify-center md:justify-start gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              Test Your AI Receptionist Live
            </h3>
            <p className="text-sm text-slate-300 max-w-2xl">
              Experience the enhanced step-by-step lead qualification, automated database synchronization, and human-like reception conversations in real-time.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/chat"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/25 hover:bg-indigo-500 transition"
            >
              Open Web Receptionist
            </Link>
            <Link
              to="/voice"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-700 transition"
            >
              Voice Simulator
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
