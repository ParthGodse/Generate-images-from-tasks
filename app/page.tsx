"use client"
// import { Todo } from '@prisma/client'; // Removed because '@prisma/client' has no exported member 'Todo'
import { useState, useEffect, useMemo } from 'react';

type Todo = {
  id: number;
  title: string;
  dueDate: string | null;
  imageUrl: string | null;
  durationDays: number;
  createdAt: string;
  updatedAt: string;
};

type PlanTask = {
  id: number;
  title: string;
  durationDays: number;
  earliestStartDate: string;
  earliestFinishDate: string;
  latestStartDate: string;
  latestFinishDate: string;
  slackDays: number;
  isCritical: boolean;
};

type TodoWithDue = Todo & {
  dueDate: string | null;
  imageUrl: string | null;
};

type Edge = { from: number; to: number };

export default function Home() {
  const [newTodo, setNewTodo] = useState("");
  const [todos, setTodos] = useState<TodoWithDue[]>([]);
  const [dueDate, setDueDate] = useState<string>("");
  const [imgLoading, setImgLoading] = useState<Record<number, boolean>>({});
  const [plan, setPlan] = useState<{ tasks: PlanTask[]; edges: Edge[]; projectDurationDays: number; projectStartDate: string; projectFinishDate: string } | null>(null);
  const [durationDays, setDurationDays] = useState<number>(1);

  useEffect(() => {
    fetchTodos();
  }, []);

  useEffect(() => {
    refreshAll();
  },[]);

  const refreshAll = async () => {
    await fetchTodos();
    await fetchPlan();
  };

  const fetchTodos = async () => {
    try {
      const res = await fetch('/api/todos');
      const data: TodoWithDue[] = await res.json();
      setTodos(data);

      setImgLoading((prev) => {
      const next = { ...prev };
      for (const t of data) {
        // if the todo has an image and we don't have an entry yet (or the URL changed), mark as loading
        if (t.imageUrl) {
          const key = t.id as unknown as number; // or keep as string if your id is string
          if (!(key in prev)) next[key] = true;
        }
      }
      return next;
    });
    } catch (error) {
      console.error('Failed to fetch todos:', error);
    }
  };

  const fetchPlan = async () => {
    try {
      const res = await fetch("/api/plan");
      const data = await res.json();
      setPlan(data);
    } catch (e) {
      console.error("Failed to fetch plan:", e);
    }
  };

  const handleAddTodo = async () => {
    if (!newTodo.trim()) return;
    try {
      await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTodo,
          dueDate: dueDate ? new Date(dueDate + "T00:00:00").toISOString() : null,
          durationDays
         }),
      });
      setNewTodo('');
      setDueDate('');
      await fetchTodos();
    } catch (error) {
      console.error('Failed to add todo:', error);
    }
  };

  const handleDeleteTodo = async (id:any) => {
    try {
      await fetch(`/api/todos/${id}`, {
        method: 'DELETE',
      })
      await refreshAll();
      fetchTodos();
    } catch (error) {
      console.error('Failed to delete todo:', error);
    }
  };

  const addDependency = async (fromId: number, toId: number) => {
    if (!fromId || !toId) return;
    try {
      const res = await fetch("/api/dependencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromId, toId }),
      });
      const j = await res.json();
      if (!res.ok) {
        alert(j.error ?? "Failed to add dependency");
      }
      await fetchPlan();
    } catch (e) {
      console.error(e);
    }
  };

  const removeDependency = async (fromId: number, toId: number) => {
    try {
      const res = await fetch("/api/dependencies", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromId, toId }),
      });
      if (!res.ok) {
        const j = await res.json();
        alert(j.error ?? "Failed to delete dependency");
      }
      await fetchPlan();
    } catch (e) {
      console.error(e);
    }
  };

  const fmt = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
      }),
    []
  );

  const isOverdue = (iso: string | null | undefined) => {
    if (!iso) return false;
    // Compare by end of day to be friendlier, but you can use start of day if you prefer
    const due = new Date(iso);
    const now = new Date();
    // treat missing time as end-of-day local
    return due.getTime() < now.getTime();
  };

  const handleImageLoaded = (id: number) =>
    setImgLoading((s) => ({ ...s, [id]: false }));

  // --- Simple DAG layout for visualization (no deps) ---
  // Layers by in-degree level (from plan.edges)

  // --- Legend (normal vs critical) ---
const GraphLegend = () => (
  <div className="text-xs flex items-center gap-6">
    <span className="inline-flex items-center gap-2">
      <svg width="40" height="10" aria-hidden>
        <line x1="0" y1="5" x2="28" y2="5" stroke="black" strokeWidth="2" />
        <polygon points="36,5 28,1 28,9" fill="black" />
      </svg>
      <span className="text-black">normal</span>
    </span>
    <span className="inline-flex items-center gap-2">
      <svg width="40" height="10" aria-hidden>
        <line x1="0" y1="5" x2="28" y2="5" stroke="red" strokeWidth="3" />
        <polygon points="36,5 28,1 28,9" fill="red" />
      </svg>
      <span className="text-red-600">critical</span>
    </span>
  </div>
);


// --- Simple DAG layout with visible arrowheads ---
// --- Simple DAG layout with rotated arrowheads & proper edge clipping ---
const Graph = () => {
  if (!plan) return null;

  const nodes = plan.tasks.map(t => ({
    id: t.id,
    label: t.title,
    critical: t.isCritical,
  }));
  const edges = plan.edges;

  // Build adjacency + indegrees
  const indeg = new Map<number, number>();
  const adj = new Map<number, number[]>();
  nodes.forEach(n => { indeg.set(n.id, 0); adj.set(n.id, []); });
  edges.forEach(e => {
    adj.get(e.from)!.push(e.to);
    indeg.set(e.to, (indeg.get(e.to)! + 1));
  });

  // Layering by BFS (columns left->right)
  const layers: number[][] = [];
  let frontier = nodes.filter(n => indeg.get(n.id) === 0).map(n => n.id);
  const seen = new Set<number>(frontier);
  while (frontier.length) {
    layers.push(frontier);
    const next: number[] = [];
    frontier.forEach(u => {
      for (const v of adj.get(u)!) {
        if (!seen.has(v)) next.push(v), seen.add(v);
      }
    });
    frontier = next;
  }

  const W = 900, H = Math.max(260, layers.length * 160);
  const colW = W / Math.max(1, layers.length);
  const pos = new Map<number, { x: number; y: number }>();
  layers.forEach((layer, i) => {
    const rowH = H / (layer.length + 1);
    layer.forEach((id, j) => pos.set(id, { x: 120 + i * colW, y: (j + 1) * rowH }));
  });

  // --- Node geometry (must match the rect below) ---
  const NODE_WIDTH = 160;
  const NODE_HEIGHT = 48;
  const NODE_X = -60;                 // rect x relative to group
  const NODE_Y = -NODE_HEIGHT / 2;    // rect y relative to group
  const CENTER_OFFSET_X = 20;         // group local center is at x=+20
  const EDGE_CLIP_PAD = 12;           // how far from the box edge to stop the line
  const ARROW_LEN = 12;
  const ARROW_W = 8;

  const getCenter = (id: number) => {
    const p = pos.get(id)!;
    return { x: p.x + CENTER_OFFSET_X, y: p.y };
  };

  return (
    <svg className="w-full" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Task dependency graph">
      {/* Edges */}
      {edges.map((e, i) => {
        const s = getCenter(e.from);
        const t = getCenter(e.to);

        // Direction from source -> target
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;

        // Clip line to stop outside both node boxes
        const halfW = NODE_WIDTH / 2;
        const startClip = halfW - 1;
        const endClip   = halfW + 3;

        const x1 = s.x + ux * startClip;
        const y1 = s.y + uy * startClip;
        const tipX = t.x - ux * endClip;   // arrow tip point
        const tipY = t.y - uy * endClip;

        const isCritical =
          plan.tasks.find(tk => tk.id === e.from)?.isCritical &&
          plan.tasks.find(tk => tk.id === e.to)?.isCritical;

        const strokeColor = isCritical ? "red" : "#555";
        const strokeW = isCritical ? 3 : 1.5;

        // Arrowhead rotated to match edge angle
        const angle = Math.atan2(uy, ux);
        const tri = [
          [0, 0],                          // tip
          [-ARROW_LEN, -ARROW_W / 2],      // wing 1
          [-ARROW_LEN,  ARROW_W / 2],      // wing 2
        ]
          .map(([px, py]) => {
            const rx = px * Math.cos(angle) - py * Math.sin(angle) + tipX;
            const ry = px * Math.sin(angle) + py * Math.cos(angle) + tipY;
            return `${rx},${ry}`;
          })
          .join(" ");

        return (
          <g key={i}>
            <line
              x1={x1} y1={y1}
              x2={tipX} y2={tipY}
              stroke={strokeColor}
              strokeWidth={strokeW}
              strokeOpacity="0.95"
            />
            <polygon points={tri} fill={strokeColor} />
          </g>
        );
      })}

      {/* Nodes */}
      {nodes.map(n => {
        const p = pos.get(n.id)!;
        return (
          <g key={n.id} transform={`translate(${p.x},${p.y})`}>
            <rect
              x={NODE_X}
              y={NODE_Y}
              width={NODE_WIDTH}
              height={NODE_HEIGHT}
              rx={12}
              ry={12}
              stroke={n.critical ? "red" : "#555"}
              strokeWidth={n.critical ? 3 : 1.5}
              fill={n.critical ? "#ffe5e5" : "white"}
            />
            <text
              x={CENTER_OFFSET_X}
              y={0}
              dominantBaseline="middle"
              textAnchor="middle"
              fontSize="12"
              fill="#000"
            >
              {n.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};


  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-500 to-red-500 flex flex-col items-center p-4">
      <div className="w-full max-w-3xl">
        <h1 className="text-4xl font-bold text-center text-white mb-4">Things To Do App</h1>

        {/* Project stats */}
        {plan && (
          <div className="mb-6 bg-white/90 rounded-lg p-4 shadow text-gray-800">
            <div className="flex flex-wrap gap-4 text-sm">
              <span><b>Project Start:</b> {fmt.format(new Date(plan.projectStartDate))}</span>
              <span><b>Finish (earliest):</b> {fmt.format(new Date(plan.projectFinishDate))}</span>
              <span><b>Duration:</b> {plan.projectDurationDays} day(s)</span>
            </div>
          </div>
        )}

        <div className="flex gap-2 mb-6">
          <input
            type="text"
            className="flex-grow p-3 rounded-full focus:outline-none text-gray-700"
            placeholder="Add a new todo"
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
          />
          <input
            type="date"
            className="p-3 rounded-full text-gray-700"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            aria-label="Due date"
          />
          <input
            type="number"
            min={1}
            className="p-3 rounded-full text-gray-700 w-28"
            value={durationDays}
            onChange={(e) => setDurationDays(parseInt(e.target.value || "1", 10))}
            aria-label="Duration (days)"
            placeholder="days"
          />
          <button
            onClick={handleAddTodo}
            className="bg-white text-indigo-600 p-3 rounded-full hover:bg-gray-100 transition duration-300"
          >
            Add
          </button>
        </div>

        {/* Graph */}
        <div className="mb-6 bg-white/90 rounded-lg p-4 shadow">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-gray-800">Dependency Graph</h2>
            <GraphLegend />
          </div>
          <Graph />
        </div>

        <ul>
          {todos.map((todo) => {
            const p = plan?.tasks.find(t => t.id === todo.id);
            const overdue = isOverdue(todo.dueDate);
            const es = p ? fmt.format(new Date(p.earliestStartDate)) : "-";
            const ef = p ? fmt.format(new Date(p.earliestFinishDate)) : "-";
            return (
              <li key={todo.id} className="flex flex-col gap-3 bg-white/90 p-4 mb-4 rounded-lg shadow-lg">
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <span className="text-gray-800 font-medium">
                      {todo.title}
                      {p?.isCritical && <span className="ml-2 text-red-600 text-xs font-semibold">CRITICAL</span>}
                    </span>
                    <span className={`text-sm ${overdue ? "text-red-600 font-semibold" : "text-gray-500"}`}>
                      {todo.dueDate ? `Due: ${fmt.format(new Date(todo.dueDate))}` : "No due date"}
                    </span>
                    {p && (
                      <span className="text-xs text-gray-600">
                        ES {es} · EF {ef} · Slack {p.slackDays}d
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteTodo(todo.id)}
                    className="text-red-500 hover:text-red-700 transition duration-300"
                    aria-label="Delete Task"
                    title="Delete Task"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Image area */}
                <div className="w-full overflow-hidden rounded-md border border-gray-200">
                  {todo.imageUrl ? (
                    <div className="relative">
                      {imgLoading[todo.id] && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 animate-pulse">
                          <span className="text-gray-500 text-sm">Loading image…</span>
                        </div>
                      )}
                      <img
                        src={todo.imageUrl}
                        alt={todo.title}
                        className={`w-full h-48 object-cover transition-opacity duration-300 ${imgLoading[todo.id] ? "opacity-0" : "opacity-100"}`}
                        onLoad={() => handleImageLoaded(todo.id)}
                        onError={() => handleImageLoaded(todo.id)}
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-32 flex items-center justify-center text-gray-400 text-sm bg-gray-50">
                      No image found
                    </div>
                  )}
                </div>

                {/* Add dependency: pick predecessor for this task */}
                {todos.length > 1 && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600">Add dependency (must finish before this starts):</label>
                    <select
                      className="text-sm border rounded px-2 py-1 text-gray-800 bg-white"
                      defaultValue=""
                      onChange={(e) => {
                        const fromId = parseInt(e.target.value);
                        if (fromId) addDependency(fromId, todo.id);
                        e.currentTarget.value = "";
                      }}
                    >
                      <option value="">Select predecessor…</option>
                      {todos
                        .filter(t => t.id !== todo.id)
                        .map(t => <option key={t.id} value={t.id}>{t.title}</option>)
                      }
                    </select>
                  </div>
                )}

                {/* Existing predecessors with remove buttons (from plan) */}
                {plan && (
                  <div className="text-xs text-gray-600">
                    <b>Depends on:</b>{" "}
                    {plan.edges
                      .filter(e => e.to === todo.id)
                      .map(e => {
                        const pred = todos.find(t => t.id === e.from);
                        return (
                          <span key={`${e.from}-${e.to}`} className="inline-flex items-center gap-1 mr-2">
                            {pred?.title ?? e.from}
                            <button
                              className="text-red-500 hover:text-red-700"
                              title="Remove dependency"
                              onClick={() => removeDependency(e.from, e.to)}
                            >
                              ×
                            </button>
                          </span>
                        );
                      })}
                    {plan.edges.every(e => e.to !== todo.id) && <span>None</span>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}