import { useState, useEffect } from "react";
import { Save, Building2, CheckCircle2 } from "lucide-react";
import PageHeader from "../components/common/PageHeader";
import { API_BASE_URL } from "../api/client";

export default function Settings() {
  const [orgName, setOrgName] = useState("");
  const [supportPhone, setSupportPhone] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadOrg() {
      try {
        const res = await fetch(`${API_BASE_URL}/organizations/me`);
        if (res.ok) {
          const data = await res.json();
          setOrgName(data.name || "");
          setSupportPhone(data.phone || "");
          setSupportEmail(data.email || "");
          setWebsite(data.website || "");
          setAddress(data.address || "");
        }
      } catch (err) {
        console.error("Failed to load organization settings:", err);
      }
    }
    loadOrg();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/organizations/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: orgName.trim() || null,
          phone: supportPhone.trim() || null,
          email: supportEmail.trim() || null,
          website: website.trim() || null,
          address: address.trim() || null,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (err) {
      console.error("Failed to save organization settings:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 min-h-screen bg-slate-900 pb-12">
      <PageHeader
        title="Organization Settings"
        description="Configure your enterprise profile, official contact channels, and system preferences."
      />

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        <form onSubmit={handleSave} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6 sm:p-8 space-y-6">
          <h2 className="text-base font-bold text-white flex items-center gap-2 pb-3 border-b border-slate-800">
            <Building2 className="w-5 h-5 text-indigo-400" />
            Company Identity & Receptionist Profile
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Company Name</label>
              <input
                type="text"
                placeholder="Leave blank if not applicable (null)"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Official Website</label>
              <input
                type="text"
                placeholder="e.g. https://example.com"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Admissions Phone</label>
              <input
                type="text"
                placeholder="e.g. +91 98765 43210"
                value={supportPhone}
                onChange={(e) => setSupportPhone(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Admissions / Support Email</label>
              <input
                type="email"
                placeholder="e.g. admissions@example.com"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">Office Location / Address</label>
              <textarea
                rows={2}
                placeholder="e.g. Hyderabad, Telangana, India"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {saved && (
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Settings updated successfully! AI receptionists will reference updated company details.
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-slate-800">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-500 transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {loading ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
