"use client";

import { useMutation } from "@tanstack/react-query";
import { createApi } from "@/lib/api";
import { tokenStore } from "@/lib/token";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const api = createApi(API_URL);

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  const signup = useMutation({
    mutationFn: async () => {
      const response = await api.post("/auth/signup", { email, name, password });
      return response.data;
    },
    onSuccess: (data) => {
      tokenStore.set(data.access_token);
      router.push("/products");
      router.refresh();
    },
  });

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold mb-6">Create an account</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          signup.mutate();
        }}
        className="space-y-4"
      >
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2"
          />
        </div>
        <button
          type="submit"
          disabled={signup.isPending}
          className="w-full rounded-md bg-zinc-900 dark:bg-zinc-50 text-zinc-50 dark:text-zinc-900 px-3 py-2 hover:opacity-90 disabled:opacity-50"
        >
          {signup.isPending ? "Creating account…" : "Sign up"}
        </button>
        {signup.error && (
          <p className="text-sm text-red-500">
            {(signup.error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
              "Signup failed"}
          </p>
        )}
      </form>
      <p className="mt-4 text-sm text-zinc-500">
        Already have an account?{" "}
        <Link href="/login" className="underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
