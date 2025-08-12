"use client"
import { Todo } from '@prisma/client';
import { useState, useEffect, useMemo } from 'react';

type TodoWithDue = Todo & {
  dueDate: string | null;
  imageUrl: string | null;
};

export default function Home() {
  const [newTodo, setNewTodo] = useState("");
  const [todos, setTodos] = useState<TodoWithDue[]>([]);
  const [dueDate, setDueDate] = useState<string>("");
  const [imgLoading, setImgLoading] = useState<Record<number, boolean>>({});

  useEffect(() => {
    fetchTodos();
  }, []);

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

  const handleAddTodo = async () => {
    if (!newTodo.trim()) return;
    try {
      await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTodo,
          dueDate: dueDate ? new Date(dueDate + "T00:00:00").toISOString() : null,
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
      });
      fetchTodos();
    } catch (error) {
      console.error('Failed to delete todo:', error);
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-500 to-red-500 flex flex-col items-center p-4">
      <div className="w-full max-w-md">
        <h1 className="text-4xl font-bold text-center text-white mb-8">Things To Do App</h1>
        
        <div className="flex mb-6">
          <input
            type="text"
            className="flex-grow p-3 rounded-full focus:outline-none text-gray-700"
            placeholder="Add a new todo"
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
          
          />
          <input type="date" 
            className="p-3 rounded-full text-gray-700"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            aria-label="Due date"/>
          <button
            onClick={handleAddTodo}
            className="bg-white text-indigo-600 p-3 rounded-full hover:bg-gray-100 transition duration-300"
          >
            Add
          </button>
        </div>
         <ul>
          {todos.map((todo) => {
            const overdue = isOverdue(todo.dueDate);
            return (
              <li
                key={todo.id}
                className="flex flex-col gap-3 bg-white bg-opacity-90 p-4 mb-4 rounded-lg shadow-lg"
              >
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <span className="text-gray-800 font-medium">{todo.title}</span>
                    <span
                      className={`text-sm ${
                        overdue ? "text-red-600 font-semibold" : "text-gray-500"
                      }`}
                    >
                      {todo.dueDate
                        ? `Due: ${fmt.format(new Date(todo.dueDate))}`
                        : "No due date"}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteTodo(todo.id as any)}
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
                      {/* Loading overlay */}
                      {imgLoading[todo.id] && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 animate-pulse">
                          <span className="text-gray-500 text-sm">Loading image…</span>
                        </div>
                      )}
                      <img
                        src={todo.imageUrl}
                        alt={todo.title}
                        className={`w-full h-48 object-cover transition-opacity duration-300 ${
                          imgLoading[todo.id] ? "opacity-0" : "opacity-100"
                        }`}
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
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}