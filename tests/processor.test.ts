import { test } from "node:test";
import assert from "node:assert/strict";
import { processEdges } from "../lib/processor";

test("PDF example — produces expected hierarchies, invalids, duplicates, summary", () => {
  const input = [
    "A->B",
    "A->C",
    "B->D",
    "C->E",
    "E->F",
    "X->Y",
    "Y->Z",
    "Z->X",
    "P->Q",
    "Q->R",
    "G->H",
    "G->H",
    "G->I",
    "hello",
    "1->2",
    "A->",
  ];
  const out = processEdges(input);

  assert.deepEqual(out.invalid_entries, ["hello", "1->2", "A->"]);
  assert.deepEqual(out.duplicate_edges, ["G->H"]);
  assert.equal(out.hierarchies.length, 4);

  assert.deepEqual(out.hierarchies[0], {
    root: "A",
    tree: { A: { B: { D: {} }, C: { E: { F: {} } } } },
    depth: 4,
  });
  assert.deepEqual(out.hierarchies[1], {
    root: "X",
    tree: {},
    has_cycle: true,
  });
  assert.deepEqual(out.hierarchies[2], {
    root: "P",
    tree: { P: { Q: { R: {} } } },
    depth: 3,
  });
  assert.deepEqual(out.hierarchies[3], {
    root: "G",
    tree: { G: { H: {}, I: {} } },
    depth: 2,
  });

  assert.deepEqual(out.summary, {
    total_trees: 3,
    total_cycles: 1,
    largest_tree_root: "A",
  });
});

test("self-loops are invalid", () => {
  const out = processEdges(["A->A", "B->C"]);
  assert.deepEqual(out.invalid_entries, ["A->A"]);
  assert.equal(out.hierarchies.length, 1);
  assert.equal(out.hierarchies[0].root, "B");
});

test("all specified invalid formats are flagged", () => {
  const out = processEdges([
    "hello",
    "1->2",
    "AB->C",
    "A-B",
    "A->",
    "A->A",
    "",
    "->B",
    "a->b",
  ]);
  assert.deepEqual(out.invalid_entries, [
    "hello",
    "1->2",
    "AB->C",
    "A-B",
    "A->",
    "A->A",
    "",
    "->B",
    "a->b",
  ]);
  assert.equal(out.hierarchies.length, 0);
});

test("trims whitespace before validating", () => {
  const out = processEdges(["  A->B  ", " C->D\t"]);
  assert.deepEqual(out.invalid_entries, []);
  assert.equal(out.hierarchies.length, 2);
});

test("duplicate appears only once regardless of occurrences", () => {
  const out = processEdges(["A->B", "A->B", "A->B", "A->B"]);
  assert.deepEqual(out.duplicate_edges, ["A->B"]);
  assert.equal(out.hierarchies.length, 1);
  assert.deepEqual(out.hierarchies[0].tree, { A: { B: {} } });
});

test("diamond / multi-parent — first parent wins, subsequent silently discarded", () => {
  const out = processEdges(["A->B", "A->C", "B->D", "C->D"]);
  // C->D should be silently discarded (D already has parent B)
  assert.deepEqual(out.invalid_entries, []);
  assert.deepEqual(out.duplicate_edges, []);
  assert.equal(out.hierarchies.length, 1);
  assert.deepEqual(out.hierarchies[0], {
    root: "A",
    tree: { A: { B: { D: {} }, C: {} } },
    depth: 3,
  });
});

test("pure cycle uses lexicographically smallest node as root", () => {
  const out = processEdges(["C->A", "A->B", "B->C"]);
  assert.equal(out.hierarchies.length, 1);
  assert.deepEqual(out.hierarchies[0], {
    root: "A",
    tree: {},
    has_cycle: true,
  });
});

test("largest_tree_root ties broken by lexicographically smaller root", () => {
  // Two trees of depth 2: M->N and A->B
  const out = processEdges(["M->N", "A->B"]);
  assert.equal(out.summary.total_trees, 2);
  assert.equal(out.summary.largest_tree_root, "A");
});

test("empty input yields empty result", () => {
  const out = processEdges([]);
  assert.deepEqual(out.invalid_entries, []);
  assert.deepEqual(out.duplicate_edges, []);
  assert.deepEqual(out.hierarchies, []);
  assert.deepEqual(out.summary, {
    total_trees: 0,
    total_cycles: 0,
    largest_tree_root: "",
  });
});

test("non-cyclic trees omit has_cycle entirely", () => {
  const out = processEdges(["A->B"]);
  const h = out.hierarchies[0];
  assert.equal("has_cycle" in h, false);
  assert.equal(h.depth, 2);
});

test("cyclic groups omit depth", () => {
  const out = processEdges(["A->B", "B->A"]);
  const h = out.hierarchies[0];
  assert.equal("depth" in h, false);
  assert.equal(h.has_cycle, true);
});

test("single edge depth is 2", () => {
  const out = processEdges(["A->B"]);
  assert.equal(out.hierarchies[0].depth, 2);
});

test("straight chain depth counts nodes", () => {
  const out = processEdges(["A->B", "B->C", "C->D"]);
  assert.equal(out.hierarchies[0].depth, 4);
});

test("handles 50+ nodes quickly and correctly", () => {
  const edges: string[] = [];
  for (let i = 0; i < 25; i++) {
    const p = String.fromCharCode(65 + i); // A..Y
    const c = String.fromCharCode(65 + i + 1); // B..Z
    edges.push(`${p}->${c}`);
  }
  const start = Date.now();
  const out = processEdges(edges);
  const elapsed = Date.now() - start;
  assert.ok(elapsed < 1000, `processing took ${elapsed}ms`);
  assert.equal(out.hierarchies.length, 1);
  assert.equal(out.hierarchies[0].root, "A");
  assert.equal(out.hierarchies[0].depth, 26);
});

test("child order in tree reflects edge insertion order", () => {
  const out = processEdges(["A->C", "A->B"]);
  const tree = out.hierarchies[0].tree as Record<string, unknown>;
  const aChildren = Object.keys(tree.A as object);
  assert.deepEqual(aChildren, ["C", "B"]);
});

test("hierarchies ordered by first appearance in input", () => {
  const out = processEdges(["Z->Y", "A->B"]);
  assert.equal(out.hierarchies[0].root, "Z");
  assert.equal(out.hierarchies[1].root, "A");
});

test("non-string entries are treated as invalid", () => {
  const out = processEdges([null as unknown as string, 42 as unknown as string, "A->B"]);
  assert.equal(out.invalid_entries.length, 2);
  assert.equal(out.hierarchies.length, 1);
});
