"use client";

import { useMemo, useState } from "react";
import { TreeView } from "@/components/TreeView";
import type { HierarchyNode } from "@/lib/processor";

type Hierarchy = {
  root: string;
  tree: HierarchyNode;
  depth?: number;
  has_cycle?: true;
};

type ApiResponse = {
  user_id: string;
  email_id: string;
  college_roll_number: string;
  hierarchies: Hierarchy[];
  invalid_entries: string[];
  duplicate_edges: string[];
  summary: {
    total_trees: number;
    total_cycles: number;
    largest_tree_root: string;
  };
};

const DEFAULT_INPUT = `A->B, A->C, B->D, C->E, E->F,
X->Y, Y->Z, Z->X,
P->Q, Q->R,
G->H, G->H, G->I,
hello, 1->2, A->`;

function parseInput(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export default function Home() {
  const [input, setInput] = useState(DEFAULT_INPUT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResponse | null>(null);

  const edges = useMemo(() => parseInput(input), [input]);

  async function submit() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/bfhl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: edges }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.error ?? `Request failed with ${res.status}`);
      }
      setResult(body as ApiResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 md:py-16">
      <header className="mb-10 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-accent-500 to-violet-500 text-ink-950 font-black">
            B
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              BFHL Hierarchy Inspector
            </h1>
            <p className="text-sm text-slate-400">
              POST <code className="rounded bg-ink-800 px-1.5 py-0.5 text-accent-400">/bfhl</code>{" "}
              — submit edges, inspect the trees, cycles, and validation results.
            </p>
          </div>
        </div>
      </header>

      <section className="grid gap-6 md:grid-cols-5">
        <div className="md:col-span-2">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-400">
            Edges
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            className="scrollbar h-72 w-full resize-y rounded-xl border border-ink-700 bg-ink-900 p-4 font-mono text-sm leading-relaxed text-slate-100 shadow-inner outline-none placeholder:text-slate-600 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/30"
            placeholder={`A->B, A->C, B->D\nX->Y, Y->Z, Z->X`}
          />
          <p className="mt-2 text-xs text-slate-500">
            Separate entries with commas or newlines. {edges.length} entr
            {edges.length === 1 ? "y" : "ies"} detected.
          </p>

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={submit}
              disabled={loading || edges.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-ink-950 shadow-glow transition hover:bg-accent-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? (
                <>
                  <Spinner /> Processing…
                </>
              ) : (
                <>Run /bfhl</>
              )}
            </button>
            <button
              onClick={() => {
                setInput(DEFAULT_INPUT);
                setResult(null);
                setError(null);
              }}
              className="rounded-lg border border-ink-700 bg-ink-800/60 px-4 py-2 text-sm text-slate-300 transition hover:border-ink-600 hover:bg-ink-700"
            >
              Reset example
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              <strong className="font-semibold">Request failed.</strong> {error}
            </div>
          )}
        </div>

        <div className="md:col-span-3">
          {!result && !error && !loading && (
            <div className="flex h-full min-h-72 items-center justify-center rounded-xl border border-dashed border-ink-700 bg-ink-900/40 text-center text-sm text-slate-500">
              <div>
                <p>Enter edges and hit <span className="text-accent-400">Run /bfhl</span>.</p>
                <p className="mt-1 text-xs text-slate-600">
                  Response appears here with tree diagrams and a live summary.
                </p>
              </div>
            </div>
          )}

          {result && <ResultView data={result} />}
        </div>
      </section>

      <footer className="mt-16 border-t border-ink-800 pt-6 text-xs text-slate-500">
        SRM Full Stack Round 1 · Next.js · API at <code>/bfhl</code>
      </footer>
    </main>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeOpacity="0.25"
      />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ResultView({ data }: { data: ApiResponse }) {
  return (
    <div className="space-y-5 animate-fade-in-up">
      <IdentityCard data={data} />
      <SummaryCards summary={data.summary} />
      <HierarchiesPanel hierarchies={data.hierarchies} />
      <IssuesPanel
        invalid={data.invalid_entries}
        duplicates={data.duplicate_edges}
      />
    </div>
  );
}

function IdentityCard({ data }: { data: ApiResponse }) {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900/60 p-4">
      <div className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
        Identity
      </div>
      <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
        <Field label="user_id" value={data.user_id} />
        <Field label="email_id" value={data.email_id} />
        <Field label="roll_number" value={data.college_roll_number} />
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="truncate font-mono text-sm text-slate-200">{value}</div>
    </div>
  );
}

function SummaryCards({
  summary,
}: {
  summary: ApiResponse["summary"];
}) {
  const cards = [
    {
      label: "Total trees",
      value: summary.total_trees,
      tint: "from-emerald-400/20 to-emerald-500/5 text-emerald-300",
    },
    {
      label: "Total cycles",
      value: summary.total_cycles,
      tint: "from-rose-400/20 to-rose-500/5 text-rose-300",
    },
    {
      label: "Largest tree root",
      value: summary.largest_tree_root || "—",
      tint: "from-accent-400/20 to-accent-500/5 text-accent-400",
    },
  ];
  return (
    <div className="grid grid-cols-3 gap-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`rounded-xl border border-ink-700 bg-gradient-to-br ${c.tint} p-4`}
        >
          <div className="text-[10px] uppercase tracking-wider text-slate-400">
            {c.label}
          </div>
          <div className="mt-1 font-mono text-2xl font-semibold">{c.value}</div>
        </div>
      ))}
    </div>
  );
}

function HierarchiesPanel({ hierarchies }: { hierarchies: Hierarchy[] }) {
  if (hierarchies.length === 0) {
    return (
      <div className="rounded-xl border border-ink-700 bg-ink-900/60 p-4 text-sm text-slate-400">
        No hierarchies produced.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
          Hierarchies ({hierarchies.length})
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {hierarchies.map((h, i) => (
          <HierarchyCard key={`${h.root}-${i}`} h={h} />
        ))}
      </div>
    </div>
  );
}

function HierarchyCard({ h }: { h: Hierarchy }) {
  const cyclic = h.has_cycle === true;
  return (
    <div
      className={`rounded-lg border p-3 ${
        cyclic
          ? "border-rose-500/40 bg-rose-500/5"
          : "border-ink-700 bg-ink-800/50"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex h-6 w-6 items-center justify-center rounded-md font-mono text-xs ${
              cyclic
                ? "bg-rose-500/20 text-rose-300"
                : "bg-accent-500/20 text-accent-400"
            }`}
          >
            {h.root}
          </span>
          <span className="font-mono text-sm text-slate-200">
            root: {h.root}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {cyclic ? (
            <span className="rounded bg-rose-500/20 px-2 py-0.5 font-medium text-rose-300">
              cycle
            </span>
          ) : (
            <span className="rounded bg-ink-700 px-2 py-0.5 font-medium text-slate-300">
              depth {h.depth}
            </span>
          )}
        </div>
      </div>
      <div className="mt-3">
        {cyclic ? (
          <div className="rounded-md bg-ink-900/70 p-3 text-xs text-rose-200">
            Cycle detected — tree omitted per spec.
          </div>
        ) : (
          <TreeView tree={h.tree} />
        )}
      </div>
    </div>
  );
}

function IssuesPanel({
  invalid,
  duplicates,
}: {
  invalid: string[];
  duplicates: string[];
}) {
  if (invalid.length === 0 && duplicates.length === 0) return null;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <ChipList
        label={`Invalid entries (${invalid.length})`}
        items={invalid}
        tone="warn"
      />
      <ChipList
        label={`Duplicate edges (${duplicates.length})`}
        items={duplicates}
        tone="info"
      />
    </div>
  );
}

function ChipList({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: "warn" | "info";
}) {
  const tones: Record<string, string> = {
    warn: "bg-amber-500/10 text-amber-200 border-amber-500/30",
    info: "bg-sky-500/10 text-sky-200 border-sky-500/30",
  };
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900/60 p-4">
      <div className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
        {label}
      </div>
      {items.length === 0 ? (
        <div className="text-sm text-slate-500">None.</div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((it, i) => (
            <span
              key={`${it}-${i}`}
              className={`rounded-md border px-2 py-1 font-mono text-xs ${tones[tone]}`}
            >
              {it === "" ? "∅ (empty)" : it}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
