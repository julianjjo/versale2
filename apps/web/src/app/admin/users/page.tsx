"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
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
import { Pager } from "@/components/admin/pager";
import { useAuth } from "@/lib/auth";
import { useDebouncedSearch } from "@/lib/use-debounced-search";
import type { User } from "@/lib/types";
import { useState } from "react";

type RoleFilter = "" | "USER" | "ADMIN";

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<RoleFilter>("");
  const [page, setPage] = useState(1);
  const { searchInput, setSearchInput, search } = useDebouncedSearch(() =>
    setPage(1),
  );

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin-users", search, role, page],
    queryFn: async ({ signal }) => {
      const res = await api.get<{
        data: User[];
        meta: { total: number; page: number; pages: number };
      }>(`/users?search=${encodeURIComponent(search)}&role=${role}&page=${page}&limit=20`, { signal });
      return res.data;
    },
    // Cada término de búsqueda es una queryKey nueva: sin esto la página se
    // quedaría sin datos y el buscador se desmontaría (perdiendo el foco y el
    // cursor) en cada pulsación.
    placeholderData: keepPreviousData,
  });

  // Cuántos administradores hay EN TOTAL, no cuántos se ven en esta página.
  // Contarlos sobre la página filtrada bloqueaba el borrado en cuanto una
  // búsqueda devolvía un solo admin, aunque hubiera diez más.
  const { data: totalAdmins } = useQuery({
    queryKey: ["admin-users-admin-count"],
    queryFn: async ({ signal }) => {
      const res = await api.get<{ meta: { total: number } }>("/users?role=ADMIN&page=1&limit=1", { signal });
      return res.data.meta.total;
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({
        queryKey: ["admin-users-admin-count"],
      });
    },
    onError: (err) =>
      setError(extractApiError(err, "No pudimos eliminar al usuario")),
  });

  const users = data?.data ?? [];
  const meta = data?.meta;
  const adminCount = totalAdmins;

  return (
    <div>
      <h1 className="heading-section mb-4 text-text-primary">Todos los usuarios</h1>

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
        {isFetching && !isLoading && (
          <span className="inline-flex flex-shrink-0 items-center gap-1.5 self-center text-xs text-text-muted">
            <Spinner className="h-3.5 w-3.5" /> Actualizando…
          </span>
        )}
      </div>

      {error && (
        <p className="mb-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-text-muted">
          <Spinner className="h-5 w-5" /> Cargando…
        </div>
      ) : users.length === 0 ? (
        <EmptyState
          title={
            search || role
              ? "Ningún usuario coincide con la búsqueda"
              : "No hay usuarios"
          }
        />
      ) : (
        <div className="space-y-3" aria-busy={isFetching}>
          {users.map((u) => {
            const isSelf = u.id === currentUser?.id;
            // Mientras el conteo no haya llegado no bloqueamos nada: el API
            // rechaza igual el borrado del último administrador.
            const isLastAdmin =
              u.role === "ADMIN" && adminCount !== undefined && adminCount <= 1;
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

      <Pager
        page={page}
        pages={meta?.pages ?? 0}
        isFetching={isFetching}
        onPageChange={setPage}
      />
    </div>
  );
}
