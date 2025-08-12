import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const PEXELS_URL = 'https://api.pexels.com/v1/search';

export async function GET() {
  try {
    const todos = await prisma.todo.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
    return NextResponse.json(todos);
  } catch (error) {
    return NextResponse.json({ error: 'Error fetching todos' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { title, dueDate, durationDays} = await request.json();
    if (!title || title.trim() === '') {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    let imageUrl: string | null = null;
    try {
      const q = encodeURIComponent(title);
      const res = await fetch(`${PEXELS_URL}?query=${q}&per_page=1`, {
        headers: { Authorization: process.env.PEXELS_API_KEY ?? '' },
        // Optional: a small timeout pattern can be added if desired
      });
      if (res.ok) {
        const data = await res.json();
        const photo = data?.photos?.[0];
        // choose a reasonably sized URL
        imageUrl = photo?.src?.medium || photo?.src?.large || photo?.src?.original || null;
      }
    } catch {
      // ignore image errors—still create the todo
    }

    const todo = await prisma.todo.create({
      data: {
        title,
        dueDate: dueDate ? new Date(dueDate) : null,
        imageUrl,
        durationDays: Math.max(1, Number(durationDays ?? 1))
      },
    });
    return NextResponse.json(todo, { status: 201 });
  } catch (error) {
    console.error('Error creating todo:', error);
    return NextResponse.json({ error: 'Error creating todo' }, { status: 500 });
  }
}