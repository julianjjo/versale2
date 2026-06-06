"use client";

import { useQuery } from "@tanstack/react-query";
import { createApi } from "@/lib/api";
import { tokenStore } from "@/lib/token";
import Link from "next/link";
import type { Order } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const api = createApi(API_URL);

export default function OrdersPage() {
  const isAuthed = typeof window !== "undefined" && tokenStore.get() !== null;

  const { data, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const response = await api.get<Order[]>("/orders");
      return response.data;
    },
    enabled: isAuthed,
  });

  if (!isAuthed) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <p>Please <Link href="/login" className="underline">log in</Link> to view your orders.</p>
      </div>
    );
  }

  if (isLoading) return <p className="p-8 text-zinc-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold mb-6">Order history</h1>
      {data && data.length === 0 && (
        <p className="text-zinc-500">No orders yet.</p>
      )}
      <div className="space-y-4">
        {data?.map((order) => (
          <div key={order.id} className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-zinc-500">Order #{order.id.slice(0, 8)}</span>
              <span className="text-sm font-medium">{order.status}</span>
            </div>
            <p className="text-sm text-zinc-500">
              {order.items.length} item{order.items.length === 1 ? "" : "s"} · ${order.totalAmount.toFixed(2)}
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              {new Date(order.createdAt).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
