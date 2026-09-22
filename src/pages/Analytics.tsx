import { BarChart3, TrendingUp, Sparkles } from "lucide-react";
import PageHeader from "../components/common/PageHeader";

export default function Analytics() {
  const metrics = [
    { label: "Total Handled Inquiries", value: "1,429", change: "+18.4%", positive: true },
    { label: "Lead Qualification Rate", value: "76.8%", change: "+5.2%", positive: true },
    { label: "Avg Resolution Time", value: "1.2s", change: "-0.3s", positive: true },
    { label: "Human Escalations", value: "3.1%", change: "-1.1%", positive: true },
  ];

  const topCourses = [
    { name: "Java Full Stack & Backend", inquiries: 642, percentage: 45 },
    { name: "Python Data Science & AI", inquiries: 388, percentage: 27 },
    { name: "Cloud & DevOps Engineering", inquiries: 245, percentage: 17 },
    { name: "Cybersecurity & Networking", inquiries: 154, percentage: 11 },
  ];

  return (
    <div className="flex-1 min-h-screen bg-slate-900 pb-12">
      <PageHeader
        title="Reception & Inbound Analytics"
        description="Real-time metrics on visitor queries, course interest distribution, lead conversions, and receptionist efficiency."
      />

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Metric cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {metrics.map((m) => (
            <div key={m.label} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{m.label}</span>
              <p className="mt-3 text-3xl font-black text-white">{m.value}</p>
              <p className="mt-1 text-xs text-emerald-400 font-medium">{m.change} vs last month</p>
            </div>
          ))}
        </div>

        {/* Charts & Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Top Courses Queried */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
            <h2 className="text-base font-bold text-white mb-6 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-400" />
              Course Inquiries Distribution
            </h2>
            <div className="space-y-5">
              {topCourses.map((c) => (
                <div key={c.name} className="space-y-2">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-200">{c.name}</span>
                    <span className="text-slate-400">{c.inquiries} inquiries ({c.percentage}%)</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-indigo-500"
                      style={{ width: `${c.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Lead Funnel Insights */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6 flex flex-col justify-between">
            <div>
              <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                Qualification Funnel Breakdown
              </h2>
              <div className="space-y-4 text-sm text-slate-300">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-xs text-slate-400">Step 1: Course / Service Interest</span>
                  <span className="font-bold text-white">98% conversion</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-xs text-slate-400">Step 2: Candidate Name Captured</span>
                  <span className="font-bold text-white">88% conversion</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-xs text-slate-400">Step 3: Phone / Contact Captured</span>
                  <span className="font-bold text-white">82% conversion</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-xs text-slate-400">Step 4: Batch & Mode Confirmed</span>
                  <span className="font-bold text-emerald-400">76% completed leads</span>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 rounded-xl border border-indigo-500/20 bg-indigo-950/30 flex items-center gap-3 text-xs text-indigo-300">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Step-by-step questioning improved lead capture completion by 34% compared to batch questions.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
