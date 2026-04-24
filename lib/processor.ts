export type HierarchyNode = { [key: string]: HierarchyNode };

export type Hierarchy = {
  root: string;
  tree: HierarchyNode;
  depth?: number;
  has_cycle?: true;
};

export type ProcessResult = {
  hierarchies: Hierarchy[];
  invalid_entries: string[];
  duplicate_edges: string[];
  summary: {
    total_trees: number;
    total_cycles: number;
    largest_tree_root: string;
  };
};

const EDGE_RE = /^[A-Z]->[A-Z]$/;

export function processEdges(raw: unknown[]): ProcessResult {
  const invalid_entries: string[] = [];
  const duplicate_edges: string[] = [];
  const seenDup = new Set<string>();
  const seenEdge = new Set<string>();

  type KeptEdge = { parent: string; child: string; originalIdx: number };
  const edges: KeptEdge[] = [];

  raw.forEach((entry, i) => {
    const asStr = typeof entry === "string" ? entry : "";
    const trimmed = asStr.trim();

    if (!EDGE_RE.test(trimmed)) {
      invalid_entries.push(typeof entry === "string" ? entry : String(entry ?? ""));
      return;
    }
    const [parent, child] = trimmed.split("->");
    if (parent === child) {
      invalid_entries.push(typeof entry === "string" ? entry : String(entry ?? ""));
      return;
    }
    if (seenEdge.has(trimmed)) {
      if (!seenDup.has(trimmed)) {
        seenDup.add(trimmed);
        duplicate_edges.push(trimmed);
      }
      return;
    }
    seenEdge.add(trimmed);
    edges.push({ parent, child, originalIdx: i });
  });

  // First-parent-wins: if child already has a parent, silently discard.
  const parentOf = new Map<string, string>();
  const childrenOf = new Map<string, string[]>();
  const allNodes = new Set<string>();
  const nodeFirstSeen = new Map<string, number>();

  const touchNode = (n: string, idx: number) => {
    if (!allNodes.has(n)) {
      allNodes.add(n);
      nodeFirstSeen.set(n, idx);
    }
  };

  for (const { parent, child, originalIdx } of edges) {
    if (parentOf.has(child)) continue; // silently discard subsequent parents for this child
    parentOf.set(child, parent);
    if (!childrenOf.has(parent)) childrenOf.set(parent, []);
    childrenOf.get(parent)!.push(child);
    touchNode(parent, originalIdx);
    touchNode(child, originalIdx);
  }

  // Group nodes into connected components via kept edges (undirected).
  const adj = new Map<string, Set<string>>();
  for (const n of allNodes) adj.set(n, new Set());
  for (const [child, parent] of parentOf) {
    adj.get(child)!.add(parent);
    adj.get(parent)!.add(child);
  }

  const sortedNodes = [...allNodes].sort(
    (a, b) => nodeFirstSeen.get(a)! - nodeFirstSeen.get(b)!,
  );

  const visited = new Set<string>();
  const groups: string[][] = [];
  for (const seed of sortedNodes) {
    if (visited.has(seed)) continue;
    const queue: string[] = [seed];
    visited.add(seed);
    const group: string[] = [];
    while (queue.length) {
      const cur = queue.shift()!;
      group.push(cur);
      for (const nb of adj.get(cur)!) {
        if (!visited.has(nb)) {
          visited.add(nb);
          queue.push(nb);
        }
      }
    }
    groups.push(group);
  }

  const hierarchies: Hierarchy[] = [];
  for (const group of groups) {
    const roots = group.filter((n) => !parentOf.has(n));
    if (roots.length === 0) {
      // Pure cycle — lex smallest node becomes the root label.
      const root = [...group].sort()[0];
      hierarchies.push({ root, tree: {}, has_cycle: true });
      continue;
    }

    // Given first-parent-wins, a component with any root has exactly one root.
    const root = roots[0];
    const seen = new Set<string>();
    let cycleDetected = false;

    const build = (node: string): HierarchyNode => {
      if (seen.has(node)) {
        cycleDetected = true;
        return {};
      }
      seen.add(node);
      const obj: HierarchyNode = {};
      for (const c of childrenOf.get(node) ?? []) {
        obj[c] = build(c);
        if (cycleDetected) return {};
      }
      return obj;
    };

    const subtree = build(root);
    if (cycleDetected) {
      hierarchies.push({ root, tree: {}, has_cycle: true });
    } else {
      const depth = computeDepth(root, childrenOf);
      hierarchies.push({ root, tree: { [root]: subtree }, depth });
    }
  }

  const trees = hierarchies.filter((h) => !h.has_cycle);
  const cycles = hierarchies.filter((h) => h.has_cycle);

  let largest_tree_root = "";
  if (trees.length > 0) {
    const best = [...trees].sort((a, b) => {
      if ((b.depth ?? 0) !== (a.depth ?? 0)) return (b.depth ?? 0) - (a.depth ?? 0);
      return a.root.localeCompare(b.root);
    })[0];
    largest_tree_root = best.root;
  }

  return {
    hierarchies,
    invalid_entries,
    duplicate_edges,
    summary: {
      total_trees: trees.length,
      total_cycles: cycles.length,
      largest_tree_root,
    },
  };
}

function computeDepth(node: string, childrenOf: Map<string, string[]>): number {
  const children = childrenOf.get(node) ?? [];
  if (children.length === 0) return 1;
  let best = 0;
  for (const c of children) {
    const d = computeDepth(c, childrenOf);
    if (d > best) best = d;
  }
  return 1 + best;
}
