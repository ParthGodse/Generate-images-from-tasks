import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cpm } from "@/lib/scheduling";

export async function GET() {
  // projectStart: choose earliest createdAt (floor to day)
  const todos = await prisma.todo.findMany({
    include: {
      predecessors: { select: { fromId: true, toId: true } }, // edges into this node
      successors:   { select: { fromId: true, toId: true } }, // edges out of this node (not strictly needed)
    },
    orderBy: { id: "asc" },
  });

  const nodes = todos.map((t: typeof todos[number]) => ({
    id: t.id,
    title: t.title,
    duration: Math.max(0, t.durationDays ?? 0),
  }));

  const edges = todos.flatMap((t: typeof todos[number]) =>
    t.predecessors.map((d: { fromId: number; toId: number }) => ({ from: d.fromId, to: d.toId }))
  );

  // CPM in day-units
  const plan = cpm(nodes, edges);

  // Convert ES (days) to dates using min(createdAt) as start
  const minCreated = todos.length
    ? new Date(Math.min(...todos.map((t: typeof todos[number]) => new Date(t.createdAt).getTime())))
    : new Date();

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const base = startOfDay(minCreated);

  const addDays = (d: Date, days: number) => {
    const nd = new Date(d);
    nd.setDate(nd.getDate() + days);
    return nd.toISOString();
  };

  const tasks = plan.tasks.map(t => ({
    id: t.id,
    title: t.title,
    durationDays: t.duration,
    earliestStartDate: addDays(base, t.es),
    earliestFinishDate: addDays(base, t.ef),
    latestStartDate: addDays(base, t.ls),
    latestFinishDate: addDays(base, t.lf),
    slackDays: t.slack,
    isCritical: t.isCritical,
  }));

  return NextResponse.json({
    tasks,
    edges,
    projectDurationDays: plan.projectDuration,
    projectStartDate: base.toISOString(),
    projectFinishDate: addDays(base, plan.projectDuration),
  });
}
