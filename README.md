# BFHL — SRM Full Stack Engineering Challenge (Round 1)

A full-stack submission that parses a list of directed edges (e.g. `A->B`), validates them, deduplicates, detects cycles, builds hierarchical trees, and exposes everything via a single `POST /bfhl` endpoint together with an interactive frontend.

Built with **Next.js 15 (App Router) + TypeScript + Tailwind CSS**. One codebase, one deployment — the API route and the UI ship together.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project Structure](#project-structure)
3. [Local Setup](#local-setup)
4. [API Reference](#api-reference)
5. [Processing Rules (Full Specification)](#processing-rules-full-specification)
6. [Algorithm Walkthrough](#algorithm-walkthrough)
7. [Frontend](#frontend)
8. [Testing](#testing)
9. [Environment Variables](#environment-variables)
10. [Deployment](#deployment)
11. [Performance & Evaluation Notes](#performance--evaluation-notes)
12. [Troubleshooting](#troubleshooting)

---

## Tech Stack

| Layer      | Choice                     | Why                                                                 |
| ---------- | -------------------------- | ------------------------------------------------------------------- |
| Framework  | Next.js 15.5 (App Router)  | Single deployment for API + UI; `app/bfhl/route.ts` maps to `/bfhl` |
| Language   | TypeScript 5.5             | Strong types on the processor and API contracts                     |
| Styling    | Tailwind CSS 3.4           | Fast, consistent dark UI with zero runtime cost                     |
| Runtime    | Node.js (not Edge)         | Simpler debugging, same 3s-budget                                   |
| Tests      | `node:test` via `tsx`      | No extra test framework — fast, zero-config                         |
| Hosting    | Vercel (recommended)       | Zero-config Next.js deploys, free tier is enough                    |

---

## Project Structure

```
bajaj-finserv/
├── app/
│   ├── bfhl/
│   │   └── route.ts        # POST /bfhl, OPTIONS (CORS preflight), GET (health)
│   ├── globals.css         # Tailwind + custom animations/gradients
│   ├── layout.tsx          # Root HTML shell
│   └── page.tsx            # Frontend — input, submit, response renderer
├── components/
│   └── TreeView.tsx        # Recursive tree renderer used in result cards
├── lib/
│   ├── identity.ts         # user_id / email_id / college_roll_number (env-driven)
│   └── processor.ts        # Pure function: input edges → structured response
├── tests/
│   └── processor.test.ts   # 17 tests covering PDF example + edge cases
├── .env.local.example      # Template for identity env vars
├── .gitignore
├── next.config.mjs
├── next-env.d.ts
├── package.json
├── postcss.config.mjs
├── README.md
├── tailwind.config.ts
└── tsconfig.json
```

Key files to inspect when reviewing:

- **[lib/processor.ts](lib/processor.ts)** — the entire evaluator-visible logic lives here as a single pure function.
- **[app/bfhl/route.ts](app/bfhl/route.ts)** — thin HTTP wrapper (parses JSON, enforces shape, adds CORS, merges identity).
- **[tests/processor.test.ts](tests/processor.test.ts)** — proves the logic matches the PDF byte-for-byte.

---

## Local Setup

Prerequisites: **Node.js 18.18+** (20.x recommended) and **npm**.

```bash
# 1. Install dependencies
npm install

# 2. (Optional) override identity fields locally
cp .env.local.example .env.local
# edit .env.local if you want different values than the hard-coded defaults

# 3. Start the dev server with hot reload
npm run dev
# → http://localhost:3000 for UI
# → http://localhost:3000/bfhl for the API

# 4. Run the test suite
npm test

# 5. Production build + start (same runtime Vercel uses)
npm run build
npm start
```

---

## API Reference

### `POST /bfhl`

**Content-Type:** `application/json`

**Request body:**

```json
{ "data": ["A->B", "A->C", "B->D"] }
```

**Response body (success, HTTP 200):**

```jsonc
{
  "user_id": "noumanshafique_06102003",
  "email_id": "ns1358@srmist.edu.in",
  "college_roll_number": "RA2311042010047",
  "hierarchies": [
    {
      "root": "A",
      "tree": { "A": { "B": { "D": {} }, "C": {} } },
      "depth": 3
    }
  ],
  "invalid_entries": [],
  "duplicate_edges": [],
  "summary": {
    "total_trees": 1,
    "total_cycles": 0,
    "largest_tree_root": "A"
  }
}
```

### `OPTIONS /bfhl`

CORS preflight. Returns `204 No Content` with:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 86400
```

### `GET /bfhl`

Health-check. Returns the identity fields plus a short usage hint — useful when pasting the URL in a browser to confirm the route is live.

### Error Responses

| Case                              | HTTP | Body                                                          |
| --------------------------------- | ---- | ------------------------------------------------------------- |
| Malformed JSON                    | 400  | `{ "error": "Invalid JSON body" }`                            |
| Body is not `{ data: string[] }`  | 400  | `{ "error": "Request body must be { \"data\": string[] }" }`  |

All error responses still carry the full CORS headers.

---

## Processing Rules (Full Specification)

Implemented exactly as written in the brief. Cross-reference with [lib/processor.ts](lib/processor.ts).

### 1. Identity Fields

- `user_id` format: `fullname_ddmmyyyy` (lowercase, no spaces).
- `email_id` and `college_roll_number` are the submitter's real credentials.
- Configured once in `lib/identity.ts`; overridable via env vars without code changes.

### 2. Node Format Validation

An entry is **valid** iff, after trimming whitespace, it matches `^[A-Z]->[A-Z]$` **and** the parent ≠ the child.

| Input        | Verdict  | Reason                                   |
| ------------ | -------- | ---------------------------------------- |
| `"A->B"`     | valid    | matches pattern                          |
| `" A->B "`   | valid    | trimmed first                            |
| `"A->A"`     | invalid  | self-loop                                |
| `"a->b"`     | invalid  | not uppercase                            |
| `"AB->C"`    | invalid  | multi-char parent                        |
| `"1->2"`     | invalid  | not letters                              |
| `"A-B"`      | invalid  | wrong separator                          |
| `"A->"`      | invalid  | missing child                            |
| `""`         | invalid  | empty                                    |
| `"hello"`    | invalid  | not a node format                        |
| non-string   | invalid  | coerced to empty string, then fails      |

Invalid entries are pushed to `invalid_entries` in the order they appeared in the input.

### 3. Duplicate Detection

- Same `Parent->Child` string more than once → first occurrence is used for tree construction.
- Every subsequent occurrence is pushed to `duplicate_edges` **once** (set-deduplicated), regardless of how many times it repeats.
- Example: `["A->B", "A->B", "A->B"]` → `duplicate_edges: ["A->B"]`.

### 4. Multi-Parent ("Diamond") Case

If a node has more than one parent across valid edges:

- The **first-encountered** parent edge wins.
- Subsequent parent edges for that child are **silently discarded** — they are neither invalid nor duplicate; they simply vanish from tree construction.

Example: `["A->D", "B->D"]`
- `A->D` wins; `B` has no kept edges and therefore does not appear anywhere.

### 5. Connected Components → Hierarchies

After applying rules 2–4, each connected component of the kept edges (treated as an undirected graph) becomes exactly one hierarchy object in the `hierarchies` array.

- **Ordering of hierarchies:** by the earliest input index at which any node in the group was first seen among kept edges.

### 6. Root Selection per Component

- A node that never appears as a child is a **root**.
- Given first-parent-wins, a component either has exactly one root (→ a tree) or zero roots (→ a pure cycle).
- For pure cycles, the root label is the **lexicographically smallest** node in the group.

### 7. Cycle Handling

If a cycle is detected inside a component:

- `tree` is `{}` (empty object).
- `has_cycle: true` is added.
- `depth` is **omitted entirely**.

For non-cyclic trees: `has_cycle` is omitted entirely (never returned as `false`).

### 8. Depth

`depth` = number of **nodes** on the longest root-to-leaf path (not edges).
- Single node: `1`
- `A->B`: `2`
- `A->B->C->D`: `4`

### 9. Children Ordering Within a Tree

Children of any node are written in the order their edges first appeared in the input.

Example: input `["A->C", "A->B"]` produces `{ "A": { "C": {}, "B": {} } }`.

### 10. Summary Object

- `total_trees` — count of non-cyclic hierarchies only.
- `total_cycles` — count of cyclic hierarchies.
- `largest_tree_root` — root of the non-cyclic tree with the greatest `depth`. Ties broken by lexicographically smaller root. Returns `""` when there are zero trees.

---

## Algorithm Walkthrough

The full pipeline on the PDF example input:

```
[
  "A->B","A->C","B->D","C->E","E->F",
  "X->Y","Y->Z","Z->X",
  "P->Q","Q->R",
  "G->H","G->H","G->I",
  "hello","1->2","A->"
]
```

**Pass 1 — Validate & deduplicate.**
- `"hello"`, `"1->2"`, `"A->"` fail the regex → `invalid_entries`.
- Second `"G->H"` is a repeat → `duplicate_edges: ["G->H"]`.
- Remaining 12 strings become `{parent, child}` pairs tagged with their original index.

**Pass 2 — First-parent-wins.**
- No multi-parent conflicts in this input; all 12 edges are kept.
- Populate `parentOf: Map<child, parent>` and `childrenOf: Map<parent, child[]>`.

**Pass 3 — Find connected components (BFS on undirected adjacency).**
- Components: `{A,B,C,D,E,F}`, `{X,Y,Z}`, `{P,Q,R}`, `{G,H,I}`.
- Ordered by first-appearance of any of their nodes in the kept edges.

**Pass 4 — Per-component build.**
- `{A…}` → root `A` (no parent); DFS builds nested object; depth = 4 (A→C→E→F).
- `{X,Y,Z}` → every node has a parent → pure cycle; root = `X` (smallest); `tree: {}`, `has_cycle: true`.
- `{P,Q,R}` → root `P`, depth 3.
- `{G,H,I}` → root `G`, depth 2.

**Pass 5 — Summary.**
- Trees: A (depth 4), P (depth 3), G (depth 2). Max depth = 4 → `largest_tree_root: "A"`.
- `total_trees: 3`, `total_cycles: 1`.

Time complexity: **O(n)** in the number of edges. A 50-node input runs in well under a millisecond.

---

## Frontend

The UI at `/` is a single-page app:

- **Textarea** accepts edges separated by commas or newlines; pre-populated with the PDF example for instant demo.
- **Entry counter** and **Run /bfhl** button (disabled while request is in flight or input is empty).
- **Identity card** shows which `user_id`/`email`/`roll_number` the API returned.
- **Summary cards** for `total_trees`, `total_cycles`, `largest_tree_root`.
- **Hierarchy cards** render each tree with a recursive, indented tree view; cyclic groups get a red "cycle" badge.
- **Invalid & duplicate chips** show the two side-channel arrays.
- **Error state** surfaces any network/API failure with the server's message.

All state is local React state — no external stores, no hydration errors.

---

## Testing

17 tests live in [tests/processor.test.ts](tests/processor.test.ts), run via Node's built-in test runner through `tsx`:

```bash
npm test
```

Coverage:

- The exact PDF example — full deep-equal check on every field.
- Self-loops classified as invalid.
- All specified invalid formats.
- Whitespace trimming.
- Repeat count independence of `duplicate_edges`.
- Diamond / multi-parent discard.
- Pure cycle → lex-smallest root.
- `largest_tree_root` tie-breaker.
- Empty input.
- `has_cycle` omitted for trees; `depth` omitted for cycles.
- Depth of single edge (2) and chains (node count).
- 26-node chain under 1 second (headroom for 50).
- Child order reflects edge insertion order.
- Hierarchy order reflects first-appearance.
- Non-string entries treated as invalid.

Expected output:

```
# tests 17
# pass 17
# fail 0
```

---

## Environment Variables

All three are optional — the hard-coded defaults in `lib/identity.ts` are already the submitter's real credentials.

| Variable         | Default                         | Purpose                                  |
| ---------------- | ------------------------------- | ---------------------------------------- |
| `BFHL_USER_ID`   | `noumanshafique_06102003`       | Returned as `user_id` in every response  |
| `BFHL_EMAIL`     | `ns1358@srmist.edu.in`          | Returned as `email_id`                   |
| `BFHL_ROLL`      | `RA2311042010047`               | Returned as `college_roll_number`        |

Set them in `.env.local` for local dev, or in your host's dashboard for production.

---

## Deployment

### Recommended: Vercel

1. Push this repo to a **public** GitHub repository.
2. Go to **https://vercel.com/new** and **Import** the repo.
3. Framework: **Next.js** (auto-detected). Root directory: leave as `/`. Build command: default. Output directory: default.
4. (Optional) add `BFHL_USER_ID` / `BFHL_EMAIL` / `BFHL_ROLL` under **Project Settings → Environment Variables** if you want to override without a redeploy.
5. Click **Deploy**. You'll get a URL like `https://bfhl-<hash>.vercel.app` within ~60 seconds.

Your live endpoints:

- `https://<your-project>.vercel.app/` — frontend
- `https://<your-project>.vercel.app/bfhl` — API

### Alternative: Render

1. New → **Web Service** → connect GitHub repo.
2. Build command: `npm install && npm run build`
3. Start command: `npm start`
4. Environment: Node 20.
5. Add the identity env vars (optional).

### Alternative: Netlify

Netlify supports Next.js via its `@netlify/plugin-nextjs` adapter (auto-installed on import). Otherwise identical to Vercel flow.

### Alternative: Self-hosted

```bash
npm ci
npm run build
PORT=3000 npm start
```

Put it behind nginx/Caddy with TLS. Make sure the upstream keeps the raw body for POST requests (no weird buffering).

---

## Performance & Evaluation Notes

- **Response time:** the entire processor is O(n) and allocation-light. Local measurements show < 1 ms for 26-node chains; the 3-second evaluator budget is ~1000× headroom.
- **CORS:** `Access-Control-Allow-Origin: *` on every `/bfhl` response, including the 400 error responses. `OPTIONS` preflight returns `204`.
- **No hardcoded responses:** the output is a deterministic function of the input payload plus the three identity constants. Swap the input → swap the output.
- **Security patch level:** Next.js 15.5.15 (no open advisories at time of build).
- **Deterministic ordering:** hierarchies and children use insertion order from the input, so identical inputs always produce byte-identical outputs.

---

## Troubleshooting

**`npm install` warns about deprecated Next.js.**
You're on an older `package.json`. This repo pins `next@15.5.15`. Run `npm install next@15.5.15` to fix.

**`npm test` says `Cannot find module tsx`.**
Run `npm install` first. `tsx` is in `devDependencies`.

**Evaluator reports CORS errors.**
Confirm by running `curl -i -X OPTIONS https://<host>/bfhl -H "Origin: https://any" -H "Access-Control-Request-Method: POST"`. You should see `access-control-allow-origin: *`. If missing, verify the deploy is actually on the expected commit.

**`/bfhl` returns the GET health message when the evaluator POSTs.**
Check that the evaluator is sending `Content-Type: application/json`. Some hosts (especially behind CDNs) reject POSTs missing the header; the Next.js route then treats it as an OPTIONS probe.

**Identity fields show placeholder values.**
The hard-coded values live in `lib/identity.ts`. If you see `yourname_ddmmyyyy`, the code on the server is stale — redeploy.

---

## License

Submission for SRM Full Stack Engineering Challenge — Round 1. Not intended for redistribution.
