import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  CheckCircle2,
  XCircle,
  Trash2,
  Filter,
  FileSpreadsheet,
  RefreshCw,
} from "lucide-react";
import PageHeader from "../components/common/PageHeader";
import {
  getAppointments,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  getAvailableSlots,
  type Appointment,
} from "../api/appointments";
import { getAgents, type Agent } from "../api/agents";
import { getStoredGoogleSession } from "../lib/gsi";
import { syncAllToGoogleSheets } from "../api/googleWorkspace";

export default function Appointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);

  // Form state
  const [form, setForm] = useState({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    service: "Product Consultation",
    slot_date: "2026-09-20",
    slot_time: "10:00 AM",
    notes: "",
    agent_id: 1,
  });
  const [submitting, setSubmitting] = useState(false);
  const [sheetsSyncing, setSheetsSyncing] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState("");
  const navigate = useNavigate();

  async function handleSyncToGoogleSheets() {
    const session = getStoredGoogleSession();
    if (!session?.accessToken) {
      navigate("/integrations");
      return;
    }
    setSheetsSyncing(true);
    setSyncSuccessMsg("");
    setError(null);
    try {
      const res = await syncAllToGoogleSheets(session.accessToken);
      setSyncSuccessMsg(`Synced ${res.appointments_synced} appointments and ${res.leads_synced} leads to Google Sheets!`);
      setTimeout(() => setSyncSuccessMsg(""), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync to Google Sheets.");
    } finally {
      setSheetsSyncing(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    Promise.all([getAppointments(), getAgents(), getAvailableSlots()])
      .then(([appts, agentsData, slotsData]) => {
        if (!mounted) return;
        setAppointments(appts);
        setAgents(agentsData);
        setAvailableSlots(slotsData.available_slots);
        if (agentsData.length > 0) {
          setForm((prev) => ({ ...prev, agent_id: agentsData[0].id }));
        }
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : "Failed to load appointments.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const filteredAppointments = appointments.filter((appt) => {
    if (statusFilter === "all") return true;
    return appt.status === statusFilter;
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customer_name || !form.customer_email || submitting) return;
    setSubmitting(true);
    try {
      const created = await createAppointment(form);
      setAppointments((prev) => [created, ...prev]);
      setShowCreateModal(false);
      setForm({
        customer_name: "",
        customer_email: "",
        customer_phone: "",
        service: "Product Consultation",
        slot_date: "2026-09-20",
        slot_time: "10:00 AM",
        notes: "",
        agent_id: agents[0]?.id || 1,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create appointment.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(id: number, newStatus: Appointment["status"]) {
    try {
      const updated = await updateAppointment(id, { status: newStatus });
      setAppointments((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update appointment status.");
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to cancel and remove this appointment?")) return;
    try {
      await deleteAppointment(id);
      setAppointments((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete appointment.");
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Appointments & Scheduling"
        description="Manage customer demo bookings, consultations, and meetings scheduled directly by your AI Receptionist."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncToGoogleSheets}
              disabled={sheetsSyncing}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-500 shadow-sm transition active:scale-95 disabled:opacity-50"
              title="Sync appointments to your connected Google Sheet"
            >
              {sheetsSyncing ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-3.5 w-3.5" />
              )}
              {sheetsSyncing ? "Syncing..." : "Sync to Google Sheets"}
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 shadow-md shadow-indigo-600/20 transition active:scale-95"
            >
              <Plus className="h-4 w-4" />
              Book New Appointment
            </button>
          </div>
        }
      />

      {syncSuccessMsg && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 flex items-center justify-between">
          <span>{syncSuccessMsg}</span>
          <button
            onClick={() => navigate("/integrations")}
            className="text-xs font-bold text-emerald-900 underline hover:no-underline"
          >
            Manage Sheets
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500">Total Scheduled</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{appointments.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500">Confirmed</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">
            {appointments.filter((a) => a.status === "confirmed").length}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500">Completed</p>
          <p className="mt-1 text-2xl font-bold text-indigo-600">
            {appointments.filter((a) => a.status === "completed").length}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500">Available Daily Slots</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{availableSlots.length}</p>
        </div>
      </div>

      {/* Filters & Table */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Filter by Status:</span>
            {["all", "confirmed", "rescheduled", "completed", "cancelled"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`rounded-lg px-3 py-1 text-xs font-semibold capitalize transition ${
                  statusFilter === st
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Date & Slot</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Loading appointments...
                  </td>
                </tr>
              ) : filteredAppointments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No appointments match this filter.
                  </td>
                </tr>
              ) : (
                filteredAppointments.map((appt) => (
                  <tr key={appt.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-4 py-3.5">
                      <p className="font-bold text-slate-900">{appt.customer_name}</p>
                      {appt.notes && <p className="text-[11px] text-slate-500 truncate max-w-xs">{appt.notes}</p>}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-medium text-slate-800">{appt.service}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 font-medium text-slate-700">
                        <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
                        {appt.slot_date}
                        <span className="text-slate-400">•</span>
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        {appt.slot_time}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-slate-600">{appt.customer_email}</p>
                      {appt.customer_phone && <p className="text-[11px] text-slate-400">{appt.customer_phone}</p>}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold capitalize ${
                          appt.status === "confirmed"
                            ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                            : appt.status === "completed"
                            ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                            : appt.status === "rescheduled"
                            ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                            : "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
                        }`}
                      >
                        {appt.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right space-x-1.5">
                      {appt.status !== "completed" && (
                        <button
                          onClick={() => handleStatusChange(appt.id, "completed")}
                          title="Mark as completed"
                          className="rounded-lg border border-slate-200 p-1 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 transition"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                      )}
                      {appt.status !== "cancelled" && (
                        <button
                          onClick={() => handleStatusChange(appt.id, "cancelled")}
                          title="Cancel appointment"
                          className="rounded-lg border border-slate-200 p-1 text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(appt.id)}
                        title="Delete record"
                        className="rounded-lg border border-slate-200 p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Book New Appointment Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Book New Appointment</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-xl p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Customer Name</label>
                <input
                  required
                  type="text"
                  value={form.customer_name}
                  onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                  placeholder="e.g. Michael Scott"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    required
                    type="email"
                    value={form.customer_email}
                    onChange={(e) => setForm({ ...form, customer_email: e.target.value })}
                    placeholder="customer@company.com"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={form.customer_phone}
                    onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                    placeholder="+1 (555) 000-0000"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Service / Consultation</label>
                <select
                  value={form.service}
                  onChange={(e) => setForm({ ...form, service: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="Enterprise AI Receptionist Consultation">Enterprise AI Receptionist Consultation</option>
                  <option value="Voice Receptionist Live Architecture Demo">Voice Receptionist Live Architecture Demo</option>
                  <option value="Python & AI Engineering Course Guidance">Python & AI Engineering Course Guidance</option>
                  <option value="Front Desk Triage Setup">Front Desk Triage Setup</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={form.slot_date}
                    onChange={(e) => setForm({ ...form, slot_date: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Time Slot</label>
                  <select
                    value={form.slot_time}
                    onChange={(e) => setForm({ ...form, slot_time: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  >
                    {availableSlots.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes / Instructions</label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Special visitor requests or topics..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-indigo-600 px-5 py-2 font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {submitting ? "Booking..." : "Confirm Booking"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
