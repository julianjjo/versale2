"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { extractApiError } from "@/lib/api";
import { Input, Button, Card, PageContainer } from "@/components/ui";

export default function SignupPage() {
  const router = useRouter();
  const { signup } = useAuth();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await signup(email, name, password);
      router.push("/products");
      router.refresh();
    } catch (err) {
      setError(extractApiError(err, "Signup failed"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageContainer size="narrow">
      <Card>
        <h1 className="heading-section text-text-primary">Create an account</h1>
        <p className="mt-1 text-sm text-text-muted">
          Join Versale to buy and sell pre-owned fashion.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Input
            label="Name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
            hint="At least 6 characters."
          />
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={isLoading} fullWidth size="lg">
            {isLoading ? "Creating account…" : "Sign up"}
          </Button>
        </form>
        <p className="mt-4 text-sm text-text-muted">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-text-primary underline-offset-4 hover:underline"
          >
            Log in
          </Link>
        </p>
      </Card>
    </PageContainer>
  );
}
