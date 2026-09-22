import React from "react";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export default function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const getBadgeStyle = (s: string) => {
    switch (s.toLowerCase()) {
      case "active":
      case "published":
      case "converted":
      case "confirmed":
      case "qualified":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "pending":
      case "contacted":
      case "in_progress":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "new":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "inactive":
      case "draft":
      case "lost":
      case "cancelled":
        return "bg-slate-500/10 text-slate-400 border-slate-500/20";
      default:
        return "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
    }
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getBadgeStyle(
        status
      )} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-80" />
      <span className="capitalize">{status.replace(/_/g, " ")}</span>
    </span>
  );
}
