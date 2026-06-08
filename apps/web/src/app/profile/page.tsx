"use client";

import { useState } from "react";
import Link from "next/link";
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
  type BadgeVariant,
} from "@/components/ui";
import type { User } from "@/lib/types";

export default function ProfilePage() {
  const { user, isLoading: isAuthLoading, logout, refresh } = useAuth();

  if (isAuthLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center gap-2 py-12 text-text-muted">
          <Spinner className="h-5 w-5" /> Loading…
        </div>
      </PageContainer>
    );
  }

  if (!user) {
    return (
      <PageContainer size="narrow">
        <EmptyState
          title="Please log in"
          description="You need an account to view your profile."
          action={<Link href="/login">Log in</Link>}
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
        setSuccess("Nothing to update");
        setIsSaving(false);
        return;
      }
      await api.patch<User>("/users/me", body);
      await refresh();
      setPassword("");
      setSuccess("Profile updated");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(extractApiError(err, "Update failed"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageContainer size="narrow">
      <SectionHeader title="Your profile" description="Manage your account information." />

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-eyebrow">Logged in as</p>
            <p className="mt-1 font-medium text-text-primary">{user.name}</p>
            <p className="text-sm text-text-muted">{user.email}</p>
          </div>
          <Badge variant={user.role === "ADMIN" ? "info" : "default"}>
            {user.role}
          </Badge>
        </div>
        <button
          onClick={logout}
          className="mt-3 text-sm font-medium text-danger transition-colors hover:text-danger/80"
        >
          Log out
        </button>
      </Card>

      <Card className="mt-4">
        <h2 className="heading-card mb-4">Update profile</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="New password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave blank to keep current password"
            minLength={6}
            hint="At least 6 characters."
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
            {isSaving ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </Card>
    </PageContainer>
  );
}
