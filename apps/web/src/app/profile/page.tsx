"use client";

import { useState } from "react";
import Link from "next/link";
import { api, extractApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Spinner, Card, EmptyState, Input, Button, Badge } from "@/components/ui";
import type { User } from "@/lib/types";

export default function ProfilePage() {
  const { user, isLoading: isAuthLoading, logout, refresh } = useAuth();

  if (isAuthLoading) {
    return (
      <div className="py-8 flex items-center justify-center gap-2 text-zinc-500">
        <Spinner className="h-5 w-5" /> Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <EmptyState
          title="Please log in"
          description="You need an account to view your profile."
          action={
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-md bg-zinc-900 dark:bg-zinc-50 text-zinc-50 dark:text-zinc-900 px-4 py-2 text-sm"
            >
              Log in
            </Link>
          }
        />
      </div>
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
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold mb-6">Your profile</h1>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-zinc-500">Logged in as</p>
            <p className="font-medium">{user.name}</p>
            <p className="text-sm text-zinc-500">{user.email}</p>
          </div>
          <Badge variant={user.role === "ADMIN" ? "info" : "default"}>
            {user.role}
          </Badge>
        </div>
        <button
          onClick={logout}
          className="text-sm text-red-600 hover:underline"
        >
          Log out
        </button>
      </Card>

      <Card className="mt-4">
        <h2 className="font-semibold mb-4">Update profile</h2>
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
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
