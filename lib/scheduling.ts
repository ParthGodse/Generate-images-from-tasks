export type Node = {
  id: number;
  title: string;
  duration: number; // in days
};

export type Edge = { from: number; to: number };

// Kahn topological sort, throws if cycle
export function topoSort(nodes: Node[], edges: Edge[]) {
  const indeg = new Map<number, number>();
  const out = new Map<number, number[]>();
  nodes.forEach(n => {
    indeg.set(n.id, 0);
    out.set(n.id, []);
  });
  edges.forEach(e => {
    out.get(e.from)!.push(e.to);
    indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
  });

  const q: number[] = [];
  indeg.forEach((d, id) => { if (d === 0) q.push(id); });

  const order: number[] = [];
  while (q.length) {
    const u = q.shift()!;
    order.push(u);
    for (const v of out.get(u)!) {
      indeg.set(v, indeg.get(v)! - 1);
      if (indeg.get(v)! === 0) q.push(v);
    }
  }

  if (order.length !== nodes.length) {
    throw new Error("Cycle detected");
  }
  return { order, successors: out };
}

// CPM: earliest & latest times in days from project start
export function cpm(nodes: Node[], edges: Edge[]) {
  const id2node = new Map(nodes.map(n => [n.id, n]));
  const { order, successors } = topoSort(nodes, edges);

  const preds = new Map<number, number[]>();
  nodes.forEach(n => preds.set(n.id, []));
  edges.forEach(e => preds.get(e.to)!.push(e.from));

  const ES = new Map<number, number>(); // earliest start
  const EF = new Map<number, number>(); // earliest finish
  for (const id of order) {
    const p = preds.get(id)!;
    const es = p.length ? Math.max(...p.map(pp => EF.get(pp)!)) : 0;
    ES.set(id, es);
    EF.set(id, es + (id2node.get(id)!.duration));
  }
  const projectDuration = Math.max(...Array.from(EF.values()));

  // Backward pass
  const LS = new Map<number, number>();
  const LF = new Map<number, number>();
  const succ = successors;
  const reverse = [...order].reverse();
  for (const id of reverse) {
    const s = succ.get(id)!;
    const lf = s.length ? Math.min(...s.map(ss => LS.get(ss)!)) : projectDuration;
    LF.set(id, lf);
    LS.set(id, lf - id2node.get(id)!.duration);
  }

  const result = nodes.map(n => {
    const es = ES.get(n.id)!;
    const ef = EF.get(n.id)!;
    const ls = LS.get(n.id)!;
    const lf = LF.get(n.id)!;
    const slack = ls - es;
    return { id: n.id, title: n.title, duration: n.duration, es, ef, ls, lf, slack, isCritical: slack === 0 };
  });

  // Critical path as the set of zero‑slack nodes; to get an actual path,
  // follow any chain of critical nodes from sources to sinks.
  return { tasks: result, projectDuration };
}

export function wouldCreateCycle(nodes: Node[], edges: Edge[], candidate: Edge) {
  try {
    topoSort(nodes, [...edges, candidate]);
    return false;
  } catch {
    return true;
  }
}
