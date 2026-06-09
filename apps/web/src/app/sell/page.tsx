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
const CONDITIONS: Array<{ value: string; label: string }> = [
  { value: "New", label: "Nuevo" },
  { value: "Like New", label: "Como nuevo" },
  { value: "Good", label: "Buen estado" },
  { value: "Fair", label: "Aceptable" },
];

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
          description="Necesitas una cuenta para publicar productos."
          action={<Link href="/login">Iniciar sesión</Link>}
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
      setError(extractApiError(err, "No pudimos crear la publicación"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageContainer size="narrow">
      <SectionHeader
        title="Publicar un producto"
        description="Comparte una prenda de tu armario con la comunidad."
      />

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Título"
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder="Ej. Chaqueta de jean vintage Levi's"
            required
          />
          <Textarea
            label="Descripción"
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            rows={4}
            placeholder="Describe la prenda, el talle, detalles del estado, etc."
            required
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Categoría"
              value={form.category}
              onChange={(e) => update("category", e.target.value)}
              placeholder="Ej. Chaquetas, Camisetas, Pantalones"
              required
            />
            <Input
              label="Marca (opcional)"
              value={form.brand}
              onChange={(e) => update("brand", e.target.value)}
              placeholder="Ej. Levi's"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              label="Talla"
              value={form.size}
              onChange={(e) => update("size", e.target.value)}
              required
            >
              <option value="">Selecciona una talla</option>
              {SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            <Select
              label="Condición"
              value={form.condition}
              onChange={(e) => update("condition", e.target.value)}
              required
            >
              {CONDITIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
          <Input
            label="Precio (COP)"
            type="number"
            min="1000"
            step="1"
            value={form.price}
            onChange={(e) => update("price", e.target.value)}
            placeholder="0"
            required
            hint="Precio en pesos colombianos, sin decimales."
          />
          <Textarea
            label="URLs de imágenes (opcional)"
            value={form.images}
            onChange={(e) => update("images", e.target.value)}
            rows={2}
            placeholder="Una URL por línea o separadas por comas"
            hint="Pega enlaces directos a las imágenes, una por línea."
          />
          <p className="text-xs text-text-muted">
            Un administrador revisará tu publicación antes de que aparezca en
            el marketplace.
          </p>
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Enviando…" : "Publicar producto"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.back()}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </Card>
    </PageContainer>
  );
}
