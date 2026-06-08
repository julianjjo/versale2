"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, extractApiError } from "@/lib/api";
import {
  Spinner,
  Card,
  EmptyState,
  Badge,
  Button,
} from "@/components/ui";
import type { User } from "@/lib/types";
import { useState } from "react";

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery<User[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await api.get<User[]>("/users");
      return res.data;
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (err) => setError(extractApiError(err, "Failed to delete user")),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-text-muted">
        <Spinner className="h-5 w-5" /> Loading…
      </div>
    );
  }

  const users = data ?? [];

  return (
    <div>
      <h2 className="heading-section mb-4 text-text-primary">All users</h2>
      {error && (
        <p className="mb-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      {users.length === 0 ? (
        <EmptyState title="No users" />
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <Card key={u.id}>
              <div className="flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-text-primary">
                    {u.name}
                  </p>
                  <p className="text-xs text-text-muted">{u.email}</p>
                </div>
                <Badge variant={u.role === "ADMIN" ? "info" : "default"}>
                  {u.role}
                </Badge>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    if (confirm(`Delete user ${u.name}?`)) {
                      remove.mutate(u.id);
                    }
                  }}
                  disabled={remove.isPending}
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
