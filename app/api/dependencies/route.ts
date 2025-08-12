import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { wouldCreateCycle } from "@/lib/scheduling";

export async function POST(req: Request) {
  const { fromId, toId } = await req.json();

  if (fromId === toId) {
    return NextResponse.json({ error: "A task cannot depend on itself." }, { status: 400 });
  }

  // Prepare current graph
  const todos = await prisma.todo.findMany({
    include: { predecessors: true },
  });

  type TodoWithPredecessors = {
    id: number;
    title: string;
    durationDays?: number | null;
    predecessors: { fromId: number; toId: number }[];
  };

  const nodes = todos.map((t: TodoWithPredecessors) => ({ id: t.id, title: t.title, duration: Math.max(0, t.durationDays ?? 0) }));
  const edges = todos.flatMap((t: TodoWithPredecessors) => t.predecessors.map(d => ({ from: d.fromId, to: d.toId })));

  if (wouldCreateCycle(nodes, edges, { from: fromId, to: toId })) {
    return NextResponse.json({ error: "This dependency would create a cycle." }, { status: 400 });
  }

  try {
    await prisma.dependency.create({ data: { fromId, toId } });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e: any) {
    // unique constraint = duplicate edge
    return NextResponse.json({ error: "Dependency already exists or invalid IDs." }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const { fromId, toId } = await req.json();
  try {
    await prisma.dependency.delete({ where: { fromId_toId: { fromId, toId } } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Dependency not found." }, { status: 404 });
  }
}
