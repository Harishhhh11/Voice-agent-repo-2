import { useState } from "react";
import { Users, UserPlus, Mail, CheckCircle2 } from "lucide-react";
import PageHeader from "../components/common/PageHeader";

interface TeamMember {
  id: number;
  name: string;
  email: string;
  role: "admin" | "manager" | "agent";
  status: "active" | "invited";
}

const INITIAL_TEAM: TeamMember[] = [
  { id: 1, name: "Admin Operator", email: "admin@example.com", role: "admin", status: "active" },
  { id: 2, name: "Admissions Desk", email: "admissions@apexsolutions.com", role: "manager", status: "active" },
  { id: 3, name: "Lead Counselor", email: "counselor@apexsolutions.com", role: "agent", status: "active" },
];

export default function Team() {
  const [team, setTeam] = useState<TeamMember[]>(INITIAL_TEAM);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "manager" | "agent">("agent");
  const [successMsg, setSuccessMsg] = useState("");

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    const newMember: TeamMember = {
      id: Date.now(),
      name: inviteName || inviteEmail.split("@")[0],
      email: inviteEmail,
      role: inviteRole,
      status: "invited",
    };
    setTeam([...team, newMember]);
    setInviteEmail("");
    setInviteName("");
    setSuccessMsg(`Invitation sent to ${newMember.email}`);
    setTimeout(() => setSuccessMsg(""), 4000);
  };

  return (
    <div className="flex-1 min-h-screen bg-slate-900 pb-12">
      <PageHeader
        title="Team & Access Management"
        description="Manage human staff members, desk operators, and role-based permissions."
      />

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Invite Box */}
        <form onSubmit={handleInvite} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-400" />
            Invite Staff Member
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
              <input
                type="text"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Staff name"
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@apexsolutions.com"
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "admin" | "manager" | "agent")}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="agent">Counselor / Staff</option>
                <option value="manager">Manager</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
          </div>

          {successMsg && (
            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-500/20 p-3 rounded-xl">
              <CheckCircle2 className="w-4 h-4" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition"
            >
              Send Invitation
            </button>
          </div>
        </form>

        {/* Team list */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
          <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            Active Members ({team.length})
          </h2>

          <div className="divide-y divide-slate-800">
            {team.map((m) => (
              <div key={m.id} className="py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center font-bold text-sm text-indigo-400">
                    {m.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{m.name}</p>
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {m.email}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 capitalize">
                    {m.role}
                  </span>
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full capitalize ${
                      m.status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                    }`}
                  >
                    {m.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
