"use client";

import { useRef, useState } from "react";
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

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ACCEPTED_EXTENSIONS = ".jpg,.jpeg,.png,.webp";
const MAX_FILE_SIZE_MB = 5;
const MAX_FILES = 5;

type LocalImage = {
  id: string;
  name: string;
  url: string;
  uploading: boolean;
  error?: string;
};

export default function SellPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    brand: "",
    size: "",
    condition: "Good",
    price: "",
  });
  const [images, setImages] = useState<LocalImage[]>([]);
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

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const incoming = Array.from(fileList);

    setError(null);
    const slots = MAX_FILES - images.length;
    if (slots <= 0) {
      setError(`Máximo ${MAX_FILES} imágenes por publicación.`);
      return;
    }
    const accepted = incoming.slice(0, slots);
    const rejected = incoming.slice(slots);
    if (rejected.length > 0) {
      setError(`Solo se suben las primeras ${slots} imágenes (máx ${MAX_FILES}).`);
    }

    const placeholders: LocalImage[] = accepted.map((f) => ({
      id: `${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(36).slice(2)}`,
      name: f.name,
      url: URL.createObjectURL(f),
      uploading: true,
    }));
    setImages((prev) => [...prev, ...placeholders]);

    await Promise.all(
      accepted.map(async (file, idx) => {
        const placeholder = placeholders[idx];
        if (!ACCEPTED_TYPES.includes(file.type)) {
          setImages((prev) =>
            prev.map((img) =>
              img.id === placeholder.id
                ? {
                    ...img,
                    uploading: false,
                    error: "Formato no permitido (JPG, PNG o WEBP).",
                  }
                : img,
            ),
          );
          return;
        }
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
          setImages((prev) =>
            prev.map((img) =>
              img.id === placeholder.id
                ? {
                    ...img,
                    uploading: false,
                    error: `Supera ${MAX_FILE_SIZE_MB}MB.`,
                  }
                : img,
            ),
          );
          return;
        }

        const data = new FormData();
        data.append("files", file);
        try {
          const res = await api.post<{ images: { url: string; key: string }[] }>(
            "/uploads/images",
            data,
            { headers: { "Content-Type": "multipart/form-data" } },
          );
          const uploaded = res.data.images[0];
          setImages((prev) =>
            prev.map((img) =>
              img.id === placeholder.id
                ? {
                    ...img,
                    url: uploaded?.url ?? img.url,
                    uploading: false,
                    error: undefined,
                  }
                : img,
            ),
          );
        } catch (err) {
          setImages((prev) =>
            prev.map((img) =>
              img.id === placeholder.id
                ? {
                    ...img,
                    uploading: false,
                    error: extractApiError(err, "No pudimos subir la imagen"),
                  }
                : img,
            ),
          );
        }
      }),
    );
  };

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const readyImages = images
      .filter((img) => !img.uploading && !img.error)
      .map((img) => img.url);
    if (images.some((img) => img.uploading)) {
      setError("Espera a que terminen de subirse las imágenes.");
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post("/products", {
        title: form.title,
        description: form.description,
        category: form.category,
        brand: form.brand || undefined,
        size: form.size,
        condition: form.condition,
        price: Number(form.price),
        images: readyImages.length > 0 ? readyImages : undefined,
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
            min="1"
            step="1"
            value={form.price}
            onChange={(e) => update("price", e.target.value)}
            placeholder="0"
            required
            hint="Precio en pesos colombianos, sin decimales."
          />

          <div className="space-y-2">
            <label className="block text-sm font-medium text-text">
              Imágenes (opcional)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              className="block w-full text-sm text-text file:mr-3 file:rounded-md file:border file:border-border file:bg-surface file:px-3 file:py-2 file:text-sm file:font-medium file:text-text hover:file:bg-surface-muted"
            />
            <p className="text-xs text-text-muted">
              Hasta {MAX_FILES} imágenes, máximo {MAX_FILE_SIZE_MB}MB cada una.
              Formatos: JPG, PNG o WEBP.
            </p>
            {images.length > 0 && (
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {images.map((img) => (
                  <li
                    key={img.id}
                    className="relative overflow-hidden rounded-md border border-border"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt={img.name}
                      className="aspect-square w-full object-cover"
                    />
                    {img.uploading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs text-white">
                        Subiendo…
                      </div>
                    )}
                    {img.error && (
                      <div className="absolute inset-0 flex items-center justify-center bg-red-900/70 px-2 text-center text-xs text-white">
                        {img.error}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeImage(img.id)}
                      className="absolute right-1 top-1 rounded-full bg-black/70 px-2 py-0.5 text-xs text-white hover:bg-black"
                      aria-label={`Quitar ${img.name}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

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
