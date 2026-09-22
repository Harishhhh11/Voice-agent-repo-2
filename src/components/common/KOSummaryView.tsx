import React from "react";
import {
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  BookOpen,
  Compass,
  Zap,
  HelpCircle,
  Layers,
} from "lucide-react";

export interface CoursePreference {
  course: string;
  mode?: string | null;
  batch?: string | null;
  status: "confirmed" | "pending_mode" | "pending_batch" | "inquired";
}

export interface EntryContext {
  source?: string | null;
  campaign?: string | null;
  medium?: string | null;
  target_course?: string | null;
  referrer?: string | null;
  landing_page?: string | null;
}

export interface MultiIntent {
  type: string;
  subject?: string | null;
  attributes?: string[] | null;
  resolved?: boolean;
}

export interface ConflictItem {
  id: string;
  type: "TIMING_OVERLAP" | "MODE_INCOMPATIBLE" | "PREFERENCE_OVERRIDE" | "SCHEDULE_COLLISION";
  description: string;
  courses: string[];
  status: "active" | "resolved";
  resolution_advice?: string;
  detected_at?: string;
}

export interface KOSummaryData {
  readiness_score?: number;
  completed_steps?: string[];
  pending_steps?: string[];
  course_breakdown?: CoursePreference[];
  active_conflicts_count?: number;
  resolved_intents_count?: number;
  knowledge_touchpoints?: string[];
  next_best_action?: string;
}

interface KOSummaryViewProps {
  visitorName?: string | null;
  visitorPhone?: string | null;
  visitorEmail?: string | null;
  visitorExperience?: string | null;
  entryContext?: EntryContext | null;
  multiIntents?: MultiIntent[] | null;
  conflicts?: ConflictItem[] | null;
  summaryData?: KOSummaryData | null;
  className?: string;
  compact?: boolean;
}

export const KOSummaryView: React.FC<KOSummaryViewProps> = ({
  visitorName,
  visitorPhone,
  visitorEmail,
  visitorExperience,
  entryContext,
  multiIntents = [],
  conflicts = [],
  summaryData,
  className = "",
  compact = false,
}) => {
  const readiness = summaryData?.readiness_score ?? (visitorPhone ? 85 : visitorName ? 60 : 35);
  const courses = summaryData?.course_breakdown ?? [];
  const activeConflicts = conflicts?.filter((c) => c.status === "active") ?? [];
  const resolvedConflicts = conflicts?.filter((c) => c.status === "resolved") ?? [];

  return (
    <div className={`space-y-4 rounded-3xl border border-slate-200 bg-white ${compact ? "p-3 space-y-3 text-xs" : "p-5 space-y-4"} shadow-sm ${className}`}>
      {/* Header & Readiness Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">KO Summary View</h3>
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-100">
                Key Objectives Overview
              </span>
            </div>
            <p className="text-xs text-slate-500">Live AI intent extraction, multi-course state & conflict resolution</p>
          </div>
        </div>

        {/* Readiness Score Badge */}
        <div className="flex items-center gap-3 bg-slate-50 px-3.5 py-2 rounded-2xl border border-slate-100">
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Enrollment Readiness</p>
            <p className="text-xs font-black text-slate-900">{readiness}% Ready</p>
          </div>
          <div className="relative h-10 w-10 shrink-0">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-slate-200"
                strokeWidth="4"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className={readiness >= 80 ? "text-emerald-500" : readiness >= 50 ? "text-amber-500" : "text-indigo-500"}
                strokeDasharray={`${readiness}, 100`}
                strokeWidth="4"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-slate-800">
              {readiness}%
            </span>
          </div>
        </div>
      </div>

      {/* Entry Context Badge */}
      {entryContext && (entryContext.source || entryContext.campaign || entryContext.target_course) && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-slate-900 p-3 text-xs text-white">
          <Compass className="h-4 w-4 text-amber-400 shrink-0" />
          <span className="font-semibold text-slate-300">Entry Context:</span>
          {entryContext.source && (
            <span className="rounded-lg bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-amber-300 border border-slate-700">
              Source: {entryContext.source}
            </span>
          )}
          {entryContext.campaign && (
            <span className="rounded-lg bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-emerald-300 border border-slate-700">
              Campaign: {entryContext.campaign}
            </span>
          )}
          {entryContext.target_course && (
            <span className="rounded-lg bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-indigo-300 border border-slate-700">
              Target Course: {entryContext.target_course}
            </span>
          )}
          {entryContext.referrer && (
            <span className="rounded-lg bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-300 border border-slate-700 truncate max-w-[200px]">
              Ref: {entryContext.referrer}
            </span>
          )}
        </div>
      )}

      {/* Recommended Next Best Action Callout */}
      {summaryData?.next_best_action && (
        <div className="flex items-start gap-3 rounded-2xl bg-indigo-50/80 p-3.5 border border-indigo-100 text-xs">
          <Zap className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-indigo-950 uppercase text-[10px] tracking-wider">Next Best Action</p>
            <p className="text-indigo-900 font-medium mt-0.5">{summaryData.next_best_action}</p>
          </div>
        </div>
      )}

      {/* Conflict Resolution Section */}
      {conflicts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              Conflict Engine ({activeConflicts.length} Active, {resolvedConflicts.length} Resolved)
            </p>
          </div>

          <div className="space-y-2">
            {conflicts.map((conf) => (
              <div
                key={conf.id}
                className={`rounded-2xl p-3.5 border text-xs ${
                  conf.status === "active"
                    ? "bg-amber-50/80 border-amber-200 text-amber-900"
                    : "bg-emerald-50/80 border-emerald-200 text-emerald-900"
                }`}
              >
                <div className="flex items-center justify-between font-bold mb-1">
                  <span className="flex items-center gap-1.5">
                    {conf.status === "active" ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    )}
                    {conf.type.replace(/_/g, " ")}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      conf.status === "active"
                        ? "bg-amber-200/80 text-amber-900"
                        : "bg-emerald-200/80 text-emerald-900"
                    }`}
                  >
                    {conf.status}
                  </span>
                </div>
                <p className="leading-relaxed opacity-90">{conf.description}</p>
                {conf.resolution_advice && (
                  <div className="mt-2 pt-2 border-t border-amber-200/60 text-[11px] font-medium text-amber-800">
                    💡 <strong>Resolution Advice:</strong> {conf.resolution_advice}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Grid: Per-Course Preferences & Multi-Intent Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Course Preferences Breakdown */}
        <div className="space-y-2 rounded-2xl bg-slate-50 p-3.5 border border-slate-100">
          <p className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5 text-indigo-600" />
            Selected Courses ({courses.length})
          </p>

          {courses.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-2">No specific courses selected yet.</p>
          ) : (
            <div className="space-y-2">
              {courses.map((item, idx) => (
                <div key={idx} className="rounded-xl bg-white p-3 border border-slate-200 text-xs space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between font-bold text-slate-900">
                    <span>{item.course}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        item.status === "confirmed"
                          ? "bg-emerald-100 text-emerald-800"
                          : item.status === "pending_batch"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {item.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-600 pt-1 border-t border-slate-100">
                    <div>
                      <span className="text-slate-400">Mode: </span>
                      <span className="font-semibold text-slate-800">{item.mode || "Not specified"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Batch: </span>
                      <span className="font-semibold text-slate-800">{item.batch || "Not specified"}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Multi-Intent Parser Breakdown */}
        <div className="space-y-2 rounded-2xl bg-slate-50 p-3.5 border border-slate-100">
          <p className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-indigo-600" />
            Detected Multi-Intents ({multiIntents?.length || 0})
          </p>

          {(!multiIntents || multiIntents.length === 0) ? (
            <p className="text-xs text-slate-400 italic py-2">No multi-intents detected yet.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {multiIntents.map((mi, idx) => (
                <div
                  key={idx}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white px-2.5 py-1.5 border border-slate-200 text-xs text-slate-800 shadow-2xs"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                  <span className="font-semibold">{mi.type.replace(/_/g, " ")}</span>
                  {mi.subject && <span className="text-[10px] text-slate-400">({mi.subject})</span>}
                  {mi.resolved ? (
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <HelpCircle className="h-3 w-3 text-amber-500" />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Visitor Credentials */}
          <div className="mt-3 pt-3 border-t border-slate-200/80 space-y-1 text-xs">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Visitor Profile</p>
            <div className="grid grid-cols-2 gap-2 text-slate-700">
              <div className="truncate">
                <span className="text-slate-400">Name: </span>
                <span className="font-medium">{visitorName || "Guest"}</span>
              </div>
              <div className="truncate">
                <span className="text-slate-400">Phone: </span>
                <span className="font-medium">{visitorPhone || "Not captured"}</span>
              </div>
              {visitorEmail && (
                <div className="col-span-2 truncate">
                  <span className="text-slate-400">Email: </span>
                  <span className="font-medium">{visitorEmail}</span>
                </div>
              )}
              {visitorExperience && (
                <div className="col-span-2 truncate">
                  <span className="text-slate-400">Experience: </span>
                  <span className="font-medium">{visitorExperience}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Knowledge Touchpoints */}
      {summaryData?.knowledge_touchpoints && summaryData.knowledge_touchpoints.length > 0 && (
        <div className="pt-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            Referenced Knowledge Documents ({summaryData.knowledge_touchpoints.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {summaryData.knowledge_touchpoints.map((kp, idx) => (
              <span
                key={idx}
                className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 border border-slate-200"
              >
                📄 {kp}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default KOSummaryView;
