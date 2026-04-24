"use client";

import type { HierarchyNode } from "@/lib/processor";

type Props = {
  tree: HierarchyNode;
};

export function TreeView({ tree }: Props) {
  const entries = Object.entries(tree);
  if (entries.length === 0) {
    return (
      <div className="rounded-md bg-ink-900/70 p-3 font-mono text-xs text-slate-500">
        {"{}"}
      </div>
    );
  }
  return (
    <ul className="space-y-1 font-mono text-sm">
      {entries.map(([label, sub]) => (
        <Node key={label} label={label} sub={sub} depth={0} />
      ))}
    </ul>
  );
}

function Node({
  label,
  sub,
  depth,
}: {
  label: string;
  sub: HierarchyNode;
  depth: number;
}) {
  const childEntries = Object.entries(sub);
  const hasChildren = childEntries.length > 0;
  return (
    <li className="relative">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-accent-500/15 text-xs font-semibold text-accent-400 ring-1 ring-accent-500/30">
          {label}
        </span>
        {!hasChildren && (
          <span className="text-[10px] uppercase tracking-wider text-slate-600">
            leaf
          </span>
        )}
      </div>
      {hasChildren && (
        <ul className="ml-3 mt-1 space-y-1 border-l border-ink-700 pl-4">
          {childEntries.map(([l, s]) => (
            <Node key={l} label={l} sub={s} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}
