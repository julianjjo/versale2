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
import { Modal } from "@/components/ui/modal";
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
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [currentPasswordError, setCurrentPasswordError] = useState<
    string | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Changing either credential that owns the account has to be proven with the
  // password in force right now; the API rejects the request without it.
  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const requiresCurrentPassword =
    Boolean(password) || (Boolean(trimmedEmail) && trimmedEmail !== user.email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setCurrentPasswordError(null);

    const body: Record<string, string> = {};
    if (trimmedName && trimmedName !== user.name) body.name = trimmedName;
    const changingEmail = Boolean(trimmedEmail) && trimmedEmail !== user.email;
    if (changingEmail) body.email = trimmedEmail;
    const changingPassword = Boolean(password);
    if (changingPassword) body.password = password;
    if (Object.keys(body).length === 0) {
      setSuccess("Nada que actualizar");
      return;
    }
    if (requiresCurrentPassword) {
      if (!currentPassword) {
        setCurrentPasswordError(
          "Ingresa tu contraseña actual para cambiar tu correo o tu contraseña.",
        );
        return;
      }
      body.currentPassword = currentPassword;
    }

    setIsSaving(true);
    try {
      await api.patch<User>("/users/me", body);
      setPassword("");
      setCurrentPassword("");
      if (changingPassword) {
        // The API just invalidated every token issued before this change
        // (tokenVersion bump) — including the one this tab is still holding.
        // Calling refresh() here would 401 through the generic "session
        // expired" handler, hiding the fact that the change itself
        // succeeded. Log out on purpose instead, with a message that says
        // what actually happened.
        logout();
        router.push("/login?reason=password_changed");
        return;
      }
      await refresh();
      setSuccess(
        changingEmail
          ? "Perfil actualizado. Como cambiaste tu correo, tendrás que verificarlo de nuevo."
          : "Perfil actualizado",
      );
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
        <div className="mt-2">
          <Badge variant={user.isVerified ? "success" : "warning"}>
            {user.isVerified ? "Correo verificado" : "Correo sin verificar"}
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
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Déjala en blanco para conservar la actual"
            minLength={8}
            hint="Mínimo 8 caracteres."
          />
          {/* Not marked `required`: the browser's own validation bubble is
              localised to the browser, not the app, so the check runs in JS
              and reports in Spanish. */}
          <Input
            label="Contraseña actual"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => {
              setCurrentPassword(e.target.value);
              setCurrentPasswordError(null);
            }}
            error={currentPasswordError ?? undefined}
            hint="Solo es necesaria si cambias tu correo o tu contraseña."
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
          <Button type="submit" variant="accent" disabled={isSaving}>
            {isSaving ? "Guardando…" : "Guardar cambios"}
          </Button>
        </form>
      </Card>

      <DangerZone />
    </PageContainer>
  );
}

function DangerZone() {
  const router = useRouter();
  const { logout } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const canSubmit = password.length > 0 && !isDeleting;

  const handleDelete = async () => {
    setError(null);
    setIsDeleting(true);
    try {
      await api.delete("/users/me", { currentPassword: password });
      // La cuenta ya no existe y el token quedó invalidado (tokenVersion):
      // cerrar sesión en limpio y llevar el aviso de éxito a /login.
      logout();
      router.push("/login?reason=account_deleted");
    } catch (err) {
      setIsConfirmOpen(false);
      setError(extractApiError(err, "No pudimos eliminar tu cuenta"));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className="mt-4 border-danger/30">
      <h2 className="heading-card mb-2 text-danger">Zona de peligro</h2>
      <p className="text-sm text-text-muted">
        Eliminar tu cuenta es definitivo. Tu perfil pasará a aparecer como
        «Usuario eliminado», tus publicaciones activas se retirarán del
        catálogo y borraremos tus datos personales. Tus pedidos se conservan
        como registro de compra y las reseñas que escribiste seguirán visibles
        a nombre de «Usuario eliminado».
      </p>
      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) setIsConfirmOpen(true);
        }}
      >
        {/* useId → htmlFor: patrón de design.md para asociar la etiqueta
            cuando el componente Input no recibe un id explícito. */}
        <Input
          label="Confirma tu contraseña"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
          }}
          required
          hint="La pedimos solo para verificar que eres tú."
        />
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" variant="danger" disabled={!canSubmit}>
          Eliminar mi cuenta
        </Button>
      </form>

      <Modal
        open={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        title="¿Seguro que quieres eliminar tu cuenta?"
      >
        <div aria-live="polite">
          <p className="text-sm text-text-muted">
            Esta acción no se puede deshacer. Perderás el acceso a tu cuenta,
            tus publicaciones se retirarán y tu sesión se cerrará en todos los
            dispositivos.
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <Button onClick={() => setIsConfirmOpen(false)} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Eliminando…" : "Sí, eliminar definitivamente"}
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
