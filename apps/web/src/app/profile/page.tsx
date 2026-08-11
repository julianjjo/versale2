"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, extractApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  Spinner,
  Card,
  EmptyState,
  Input,
  Button,
  Badge,
  PageContainer,
  SectionHeader,
} from "@/components/ui";
import type { User } from "@/lib/types";

export default function ProfilePage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading, logout, refresh } = useAuth();

  if (isAuthLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center gap-2 py-12 text-text-muted">
          <Spinner className="h-5 w-5" /> Cargando…
        </div>
      </PageContainer>
    );
  }

  if (!user) {
    return (
      <PageContainer size="narrow">
        <EmptyState
          title="Inicia sesión"
          description="Necesitas una cuenta para ver tu perfil."
          action={<Button onClick={() => router.push("/login")}>Iniciar sesión</Button>}
        />
      </PageContainer>
    );
  }

  return <ProfileForm user={user} logout={logout} refresh={refresh} />;
}

function ProfileForm({
  user,
  logout,
  refresh,
}: {
  user: User;
  logout: () => void;
  refresh: () => Promise<void>;
}) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSaving(true);
    try {
      const body: Record<string, string> = {};
      if (name && name !== user.name) body.name = name;
      if (email && email !== user.email) body.email = email;
      if (password) body.password = password;
      if (Object.keys(body).length === 0) {
        setSuccess("Nada que actualizar");
        setIsSaving(false);
        return;
      }
      await api.patch<User>("/users/me", body);
      await refresh();
      setPassword("");
      setSuccess("Perfil actualizado");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(extractApiError(err, "No pudimos actualizar tu perfil"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageContainer size="narrow">
      <SectionHeader
        title="Tu perfil"
        description="Administra la información de tu cuenta."
      />

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-eyebrow">Conectado como</p>
            <p className="mt-1 font-medium text-text-primary">{user.name}</p>
            <p className="text-sm text-text-muted">{user.email}</p>
          </div>
          <Badge variant={user.role === "ADMIN" ? "info" : "default"}>
            {user.role === "ADMIN" ? "Administrador" : "Usuario"}
          </Badge>
        </div>
        <button
          onClick={logout}
          className="mt-3 text-sm font-medium text-danger transition-colors hover:text-danger/80"
        >
          Cerrar sesión
        </button>
      </Card>

      <Card className="mt-4">
        <h2 className="heading-card mb-4">Actualizar perfil</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            label="Correo electrónico"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Nueva contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Déjala en blanco para conservar la actual"
            minLength={6}
            hint="Mínimo 6 caracteres."
          />
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          {success && (
            <p className="text-sm text-success" role="status">
              {success}
            </p>
          )}
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Guardando…" : "Guardar cambios"}
          </Button>
        </form>
      </Card>
    </PageContainer>
  );
}
