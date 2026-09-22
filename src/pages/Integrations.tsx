import { useEffect, useState } from "react";
import {
  MessageSquare,
  Send,
  Bot,
} from "lucide-react";
import PageHeader from "../components/common/PageHeader";
import GoogleWorkspaceConnector from "../components/common/GoogleWorkspaceConnector";
import {
  getIntegrations,
  getWhatsAppTemplates,
  simulateWhatsAppWebhook,
  sendWhatsAppTest,
  type IntegrationSummary,
  type WhatsAppTemplate,
} from "../api/integrations";

export default function Integrations() {
  const [items, setItems] = useState<IntegrationSummary[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [error, setError] = useState("");

  // WhatsApp Webhook Simulator State
  const [waFrom, setWaFrom] = useState("+1 (555) 992-1200");
  const [waMessage, setWaMessage] = useState("Hi! Can I book an enterprise demo for tomorrow?");
  const [waSimulating, setWaSimulating] = useState(false);
  const [waReply, setWaReply] = useState<string | null>(null);

  // WhatsApp Template Dispatch State
  const [waRecipient, setWaRecipient] = useState("+1 (555) 441-2300");
  const [waRecipientName, setWaRecipientName] = useState("David Chen");
  const [selectedTemplate, setSelectedTemplate] = useState("lead_qualification_followup");
  const [dispatchStatus, setDispatchStatus] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getIntegrations(), getWhatsAppTemplates()])
      .then(([intRes, tmplRes]) => {
        setItems(intRes.integrations);
        setTemplates(tmplRes);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load integrations."));
  }, []);

  async function handleSimulateWhatsApp(e: React.FormEvent) {
    e.preventDefault();
    if (!waMessage.trim() || waSimulating) return;
    setWaSimulating(true);
    setWaReply(null);
    try {
      const res = await simulateWhatsAppWebhook(waFrom, waMessage.trim());
      setWaReply(res.reply);
    } catch (err) {
      setError(err instanceof Error ? err.message : "WhatsApp simulation failed.");
    } finally {
      setWaSimulating(false);
    }
  }

  async function handleSendTemplate(e: React.FormEvent) {
    e.preventDefault();
    setDispatchStatus("Sending WhatsApp template...");
    try {
      const res = await sendWhatsAppTest({
        to: waRecipient,
        template: selectedTemplate,
        recipient_name: waRecipientName,
      });
      setDispatchStatus(res.details);
      setTimeout(() => setDispatchStatus(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to dispatch template.");
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Connected Integrations"
        description="Connect your AI receptionist to external channels (WhatsApp, Twilio Telephony, CRM Webhooks, Google Sheets, Slack)."
      />

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Google Workspace & Google Sheets Integration Studio */}
      <GoogleWorkspaceConnector />

      {/* WhatsApp Interactive Simulator & Dispatch Studio */}
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50/30 p-6 shadow-sm">
        <div className="flex items-center gap-3 border-b border-emerald-100 pb-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
            <MessageSquare className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">WhatsApp Business Cloud Gateway</h2>
            <p className="text-xs text-slate-600">Simulate incoming customer messages and test template dispatches</p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Inbound Webhook Simulator */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Inbound Webhook Simulator
            </h3>
            <p className="text-xs text-slate-600">
              Simulates a customer sending a WhatsApp message to your business phone number. The receptionist will process the query and respond.
            </p>

            <form onSubmit={handleSimulateWhatsApp} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Sender WhatsApp Number</label>
                <input
                  type="text"
                  value={waFrom}
                  onChange={(e) => setWaFrom(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Incoming Message</label>
                <input
                  type="text"
                  value={waMessage}
                  onChange={(e) => setWaMessage(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={waSimulating}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition"
              >
                <Send className="h-3.5 w-3.5" />
                {waSimulating ? "Simulating Receptionist..." : "Simulate Inbound WhatsApp"}
              </button>
            </form>

            {/* Simulated WhatsApp Reply Bubble */}
            {waReply && (
              <div className="mt-4 rounded-2xl bg-emerald-50 p-4 border border-emerald-200 space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800">
                  <Bot className="h-4 w-4" />
                  <span>WhatsApp AI Receptionist Auto-Reply:</span>
                </div>
                <p className="text-xs text-slate-800 leading-relaxed font-sans">{waReply}</p>
              </div>
            )}
          </div>

          {/* Pre-Approved WhatsApp Templates Dispatcher */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Template Message Dispatcher
            </h3>
            <p className="text-xs text-slate-600">
              Send verified WhatsApp notification templates for demo confirmations, reminders, and follow-ups.
            </p>

            <form onSubmit={handleSendTemplate} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Template</label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-emerald-500 focus:outline-none"
                >
                  {templates.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name} ({t.language})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Recipient Name</label>
                  <input
                    type="text"
                    value={waRecipientName}
                    onChange={(e) => setWaRecipientName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={waRecipient}
                    onChange={(e) => setWaRecipient(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition"
              >
                <Send className="h-3.5 w-3.5" />
                Dispatch WhatsApp Template
              </button>

              {dispatchStatus && (
                <div className="rounded-xl bg-slate-100 p-2.5 text-[11px] text-slate-700">
                  {dispatchStatus}
                </div>
              )}
            </form>
          </div>
        </div>
      </div>

      {/* Integrations Catalog */}
      <div>
        <h2 className="text-base font-bold text-slate-900 mb-4">Enterprise Connectors</h2>
        <div className="grid gap-5 lg:grid-cols-2">
          {items.map((item) => (
            <article
              key={item.key}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                    {item.category}
                  </p>
                  <h3 className="mt-1 text-base font-bold text-slate-900">{item.name}</h3>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    item.status === "configured"
                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {item.status === "configured" ? "Active" : "Available"}
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">{item.description}</p>

              <div className="flex flex-wrap gap-2">
                {item.capabilities.map((cap) => (
                  <span
                    key={cap}
                    className="rounded-lg bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700"
                  >
                    {cap}
                  </span>
                ))}
              </div>

              <div className="border-t border-slate-100 pt-3 text-[11px] text-slate-500 font-mono">
                {item.setup_hint}
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
