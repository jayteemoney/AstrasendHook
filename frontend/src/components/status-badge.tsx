"use client";

import { getStatusLabel, getStatusColor } from "@/lib/utils";

export function StatusBadge({ status }: { status: number }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(status)}`}
    >
      {getStatusLabel(status)}
    </span>
  );
}
