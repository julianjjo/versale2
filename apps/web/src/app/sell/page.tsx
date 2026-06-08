"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, extractApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  Button,
  Input,
  Textarea,
  Select,
  Card,
  Spinner,
  EmptyState,
  PageContainer,
  SectionHeader,
} from "@/components/ui";

const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const CONDITIONS = ["New", "Like New", "Good", "Fair"];

export default function SellPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    brand: "",
    size: "",
    condition: "Good",
    price: "",
    images: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
          description="You need an account to list items for sale."
          action={<Link href="/login">Log in</Link>}
        />
      </PageContainer>
    );
  }

  const update = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const images = form.images
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);
      await api.post("/products", {
        title: form.title,
        description: form.description,
        category: form.category,
        brand: form.brand || undefined,
        size: form.size,
        condition: form.condition,
        price: Number(form.price),
        images: images.length > 0 ? images : undefined,
      });
      router.push("/products");
    } catch (err) {
      setError(extractApiError(err, "Failed to create listing"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageContainer size="narrow">
      <SectionHeader
        title="List an item for sale"
        description="Share a piece from your wardrobe with the community."
      />

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Title"
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder="e.g. Vintage Levi's denim jacket"
            required
          />
          <Textarea
            label="Description"
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            rows={4}
            placeholder="Describe the item, fit, condition details, etc."
            required
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Category"
              value={form.category}
              onChange={(e) => update("category", e.target.value)}
              placeholder="e.g. Jackets, Tops, Pants"
              required
            />
            <Input
              label="Brand (optional)"
              value={form.brand}
              onChange={(e) => update("brand", e.target.value)}
              placeholder="e.g. Levi's"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              label="Size"
              value={form.size}
              onChange={(e) => update("size", e.target.value)}
              required
            >
              <option value="">Select a size</option>
              {SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            <Select
              label="Condition"
              value={form.condition}
              onChange={(e) => update("condition", e.target.value)}
              required
            >
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <Input
            label="Price (USD)"
            type="number"
            min="0.01"
            step="0.01"
            value={form.price}
            onChange={(e) => update("price", e.target.value)}
            placeholder="0.00"
            required
          />
          <Textarea
            label="Image URLs (optional)"
            value={form.images}
            onChange={(e) => update("images", e.target.value)}
            rows={2}
            placeholder="One image URL per line or comma-separated"
            hint="Paste direct image links, one per line."
          />
          <p className="text-xs text-text-muted">
            Your listing will be reviewed by an admin before appearing on the
            marketplace.
          </p>
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting…" : "Submit listing"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </PageContainer>
  );
}
