# BFHL — SRM Full Stack Engineering Challenge

A full-stack submission built with **Next.js 15 (App Router)** and **TypeScript**. A single deployment serves both the API (`POST /bfhl`) and the interactive frontend.

## Features

- `POST /bfhl` — parses edge strings, detects cycles, builds hierarchies, reports invalid entries and duplicate edges.
- CORS enabled (`*`), preflight `OPTIONS /bfhl` returns 204.
- Frontend with a textarea input, submit button, live tree/summary rendering, and error states.
- Zero hardcoded responses — fully derived from the input payload.
- 17 automated tests covering the PDF example plus edge cases (self-loops, diamonds, pure cycles, tie-breaking, large inputs, non-string entries).

## Project Layout

```
app/
  bfhl/route.ts     # POST /bfhl, OPTIONS, GET
  page.tsx          # Frontend UI
  layout.tsx
  globals.css
components/
  TreeView.tsx      # Recursive tree renderer
lib/
  processor.ts      # Core logic (validation, dedupe, tree build, cycle detection, summary)
  identity.ts       # user_id / email / roll — env-driven
tests/
  processor.test.ts # node:test suite
```

## Local Development

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # runs tsx --test on the processor
npm run build      # production build
```

## Identity Fields

The response fields `user_id`, `email_id`, and `college_roll_number` are read from environment variables with defaults in `lib/identity.ts`. Set them via `.env.local` during local dev and as environment variables on your host:

```
BFHL_USER_ID=yourname_ddmmyyyy
BFHL_EMAIL=you@college.edu
BFHL_ROLL=21CS1001
```

## Deployment (Vercel — recommended)

1. Push this repo to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new), import the repo.
3. Framework preset: **Next.js** (autodetected).
4. Add the three env vars above in **Project Settings → Environment Variables**.
5. Deploy. Your API will be live at `https://<project>.vercel.app/bfhl`.

The evaluator's submission form takes the base URL (no `/bfhl` suffix); they will append `/bfhl` themselves.

## Endpoint

**POST** `/bfhl`

Request:

```json
{ "data": ["A->B", "A->C", "B->D"] }
```

Response:

```json
{
  "user_id": "...",
  "email_id": "...",
  "college_roll_number": "...",
  "hierarchies": [ ... ],
  "invalid_entries": [],
  "duplicate_edges": [],
  "summary": { "total_trees": 1, "total_cycles": 0, "largest_tree_root": "A" }
}
```

## Rules Implemented

- Entries are `^[A-Z]->[A-Z]$` after trimming; self-loops are invalid.
- Duplicate edges are pushed to `duplicate_edges` once, regardless of repeat count; the first occurrence builds the tree.
- Multi-parent case: first-encountered parent wins; subsequent parent edges for the same child are silently discarded (not counted as duplicates or invalid).
- Each connected component becomes one hierarchy. Pure cycles use the lexicographically smallest node as the root with `tree: {}` and `has_cycle: true`.
- Non-cyclic trees omit `has_cycle` entirely; cyclic groups omit `depth`.
- `depth` = number of nodes on the longest root-to-leaf path.
- `largest_tree_root` tie-break uses the lexicographically smaller root. Only non-cyclic trees are counted in `total_trees`.
- Hierarchies are ordered by the first appearance of any of their nodes in the input.
- Children within a tree are ordered by edge insertion order.

## Evaluator Notes

- API responds well under 3s for 50-node inputs (tested at 26-node chain in a few ms).
- CORS `Access-Control-Allow-Origin: *`.
- The route runs in the Node.js runtime (not Edge) for simpler debugging.
- Malformed bodies return `400` with a JSON error and full CORS headers.
