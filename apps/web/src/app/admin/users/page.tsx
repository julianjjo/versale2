"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, extractApiError } from "@/lib/api";
import {
  Spinner,
  Card,
  EmptyState,
  Badge,
  Button,
  Input,
  Select,
} from "@/components/ui";
import { useAuth } from "@/lib/auth";
import type { User } from "@/lib/types";
import { useEffect, useState } from "react";

type RoleFilter = "" | "USER" | "ADMIN";

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<RoleFilter>("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", search, role, page],
    queryFn: async () => {
      const res = await api.get<{
        data: User[];
        meta: { total: number; page: number; pages: number };
      }>(
        `/users?search=${encodeURIComponent(search)}&role=${role}&page=${page}&limit=20`,
      );
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
    onError: (err) =>
      setError(extractApiError(err, "No pudimos eliminar al usuario")),
  });

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-text-muted">
        <Spinner className="h-5 w-5" /> Cargando…
      </div>
    );
  }

  const users = data?.data ?? [];
  const meta = data?.meta;
  const adminCount = users.filter((u) => u.role === "ADMIN").length;

  return (
    <div>
      <h2 className="heading-section mb-4 text-text-primary">Todos los usuarios</h2>

      <div className="mb-4 flex flex-wrap gap-3">
        <Input
          type="search"
          placeholder="Buscar por nombre o correo"
          aria-label="Buscar usuarios"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="max-w-md"
          wrapperClassName="flex-1"
        />
        <Select
          value={role}
          onChange={(e) => {
            setRole(e.target.value as RoleFilter);
            setPage(1);
          }}
          aria-label="Filtrar por rol"
          className="w-44"
        >
          <option value="">Todos los roles</option>
          <option value="USER">Usuario</option>
          <option value="ADMIN">Administrador</option>
        </Select>
      </div>

      {error && (
        <p className="mb-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {users.length === 0 ? (
        <EmptyState
          title={
            search || role
              ? "Ningún usuario coincide con la búsqueda"
              : "No hay usuarios"
          }
        />
      ) : (
        <div className="space-y-3">
          {users.map((u) => {
            const isSelf = u.id === currentUser?.id;
            const isLastAdmin = u.role === "ADMIN" && adminCount <= 1;
            const blockedReason = isSelf
              ? "No puedes eliminar tu propia cuenta."
              : isLastAdmin
                ? "No puedes eliminar al último administrador."
                : undefined;

            return (
              <Card key={u.id}>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-text-primary">
                      {u.name}
                    </p>
                    <p className="text-xs text-text-muted">{u.email}</p>
                  </div>
                  <Badge variant={u.role === "ADMIN" ? "info" : "default"}>
                    {u.role === "ADMIN" ? "Administrador" : "Usuario"}
                  </Badge>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      if (confirm(`¿Eliminar al usuario ${u.name}?`)) {
                        remove.mutate(u.id);
                      }
                    }}
                    disabled={remove.isPending || Boolean(blockedReason)}
                    title={blockedReason}
                  >
                    Eliminar
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {meta && meta.pages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button
            variant="secondary"
            disabled={meta.page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ‹ Anterior
          </Button>
          <span className="text-sm text-text-muted">
            Página {meta.page} de {meta.pages}
          </span>
          <Button
            variant="secondary"
            disabled={meta.page >= meta.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente ›
          </Button>
        </div>
      )}
    </div>
  );
}
