"use client";

import { Suspense, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { CONDITION_OPTIONS } from "@/lib/product-condition";

const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ACCEPTED_EXTENSIONS = ".jpg,.jpeg,.png,.webp";
const MAX_FILE_SIZE_MB = 5;
const MAX_FILES = 5;

type LocalImage = {
  id: string;
  name: string;
  /** Kept so a failed upload can be retried without re-picking the file. */
  file: File;
  previewUrl: string;
  /** Remote URL, only set once the upload actually succeeded. */
  url?: string;
  uploading: boolean;
  error?: string;
};

// The uploads endpoint answers in English (and 500s outright when R2 isn't
// configured), so its message must never reach this Spanish UI. We map the
// status ourselves instead of going through `extractApiError`, which would
// surface `response.data.message` verbatim.
function uploadErrorMessage(err: unknown): string {
  const status =
    typeof err === "object" && err !== null && "response" in err
      ? (err as { response?: { status?: number } }).response?.status
      : undefined;
  if (status === 401 || status === 403) {
    return "Tu sesión expiró. Inicia sesión de nuevo.";
  }
  if (status === 413) return `La imagen supera ${MAX_FILE_SIZE_MB}MB.`;
  if (status === 415) return "El servidor no acepta este formato.";
  if (status !== undefined && status >= 500) {
    return "El servicio de imágenes no está disponible.";
  }
  return "No pudimos subir la imagen.";
}

// "Publicar otro igual" (/mis-productos) lands here with
// ?title=&category=&size=. Read ONCE via the state initializer below — a mount
// happens exactly once per visit, so edits are never overwritten by params.
// Size is whitelisted against the fixed option list: a stale or hand-typed
// value outside it would otherwise leave React holding a value the <select>
// can't render (blank field until submit). Title/category are free-text inputs,
// so they only get trimmed.
function readPrefill(searchParams: ReturnType<typeof useSearchParams>) {
  const rawSize = searchParams.get("size") ?? "";
  return {
    title: (searchParams.get("title") ?? "").trim(),
    category: (searchParams.get("category") ?? "").trim(),
    size: (SIZES as string[]).includes(rawSize) ? rawSize : "",
  };
}

function SellForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: isAuthLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  // State initializer = the one-time prefill application point.
  const prefill = readPrefill(searchParams);
  const [form, setForm] = useState({
    title: prefill.title,
    description: "",
    category: prefill.category,
    brand: "",
    size: prefill.size,
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
          action={<Button onClick={() => router.push("/login")}>Iniciar sesión</Button>}
        />
      </PageContainer>
    );
  }

  const update = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const patchImage = (id: string, patch: Partial<LocalImage>) => {
    setImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, ...patch } : img)),
    );
  };

  const uploadOne = async (id: string, file: File) => {
    patchImage(id, { uploading: true, error: undefined });

    if (!ACCEPTED_TYPES.includes(file.type)) {
      patchImage(id, {
        uploading: false,
        error: "Formato no permitido (JPG, PNG o WEBP).",
      });
      return;
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      patchImage(id, {
        uploading: false,
        error: `Supera ${MAX_FILE_SIZE_MB}MB.`,
      });
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
      const uploaded = res.data.images?.[0];
      if (!uploaded?.url) {
        patchImage(id, {
          uploading: false,
          error: "El servidor no devolvió la imagen.",
        });
        return;
      }
      patchImage(id, {
        url: uploaded.url,
        uploading: false,
        error: undefined,
      });
    } catch (err) {
      patchImage(id, { uploading: false, error: uploadErrorMessage(err) });
    }
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
    if (incoming.length > accepted.length) {
      setError(`Solo se suben las primeras ${slots} imágenes (máx ${MAX_FILES}).`);
    }

    const placeholders: LocalImage[] = accepted.map((f) => ({
      id: `${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(36).slice(2)}`,
      name: f.name,
      file: f,
      previewUrl: URL.createObjectURL(f),
      uploading: true,
    }));
    setImages((prev) => [...prev, ...placeholders]);

    // Clear the picker so choosing the same file again still fires `change`
    // — otherwise a seller can't re-pick a photo that failed.
    if (fileInputRef.current) fileInputRef.current.value = "";

    await Promise.all(placeholders.map((p) => uploadOne(p.id, p.file)));
  };

  const removeImage = (id: string) => {
    const target = images.find((img) => img.id === id);
    if (target) URL.revokeObjectURL(target.previewUrl);
    setImages((prev) => prev.filter((img) => img.id !== id));
    setError(null);
  };

  const isUploading = images.some((img) => img.uploading);
  const failedImages = images.filter((img) => img.error);
  const uploadedImages = images.filter(
    (img) => !img.uploading && !img.error && img.url,
  );
  const isBlockedByImages = isUploading || failedImages.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (isUploading) {
      setError("Espera a que terminen de subirse las fotos.");
      return;
    }
    // A failed upload used to be silently dropped: the listing went out with
    // no photos and the seller got a success banner and a redirect.
    if (failedImages.length > 0) {
      setError(
        failedImages.length === 1
          ? "Una foto no se subió. Reinténtala o quítala antes de publicar."
          : `${failedImages.length} fotos no se subieron. Reinténtalas o quítalas antes de publicar.`,
      );
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
        images:
          uploadedImages.length > 0
            ? uploadedImages.map((img) => img.url as string)
            : undefined,
      });
      router.push("/products?published=1");
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
              {CONDITION_OPTIONS.map((c) => (
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
            <label
              htmlFor="sell-images"
              className="block text-sm font-medium text-text-primary"
            >
              Imágenes (opcional)
            </label>
            <input
              id="sell-images"
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              className="block w-full text-sm text-text-primary file:mr-3 file:rounded-md file:border file:border-border file:bg-surface file:px-3 file:py-2 file:text-sm file:font-medium file:text-text-primary hover:file:bg-surface-muted"
            />
            <p className="text-xs text-text-muted">
              Hasta {MAX_FILES} imágenes, máximo {MAX_FILE_SIZE_MB}MB cada una.
              Formatos: JPG, PNG o WEBP.
            </p>
            {images.length > 0 && (
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {images.map((img, index) => (
                  <li
                    key={img.id}
                    className="relative overflow-hidden rounded-md border border-border"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url ?? img.previewUrl}
                      alt={`Vista previa de la imagen ${index + 1}`}
                      className="aspect-square w-full object-cover"
                    />
                    {img.uploading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-ink/50 text-xs text-paper">
                        Subiendo…
                      </div>
                    )}
                    {img.error && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-danger/90 px-2 text-center text-xs text-paper">
                        <span>{img.error}</span>
                        <button
                          type="button"
                          onClick={() => uploadOne(img.id, img.file)}
                          aria-label={`Reintentar la subida de ${img.name}`}
                          className="rounded-full bg-paper px-3 py-1 text-xs font-medium text-ink transition-colors hover:bg-paper-2"
                        >
                          Reintentar
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeImage(img.id)}
                      className="absolute right-1 top-1 rounded-full bg-ink/70 px-2 py-0.5 text-xs text-paper hover:bg-ink"
                      aria-label={`Quitar ${img.name}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {failedImages.length > 0 && (
              <div
                role="alert"
                className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm"
              >
                <p className="font-medium text-danger">
                  {failedImages.length === 1
                    ? "Una foto no se subió."
                    : `${failedImages.length} fotos no se subieron.`}
                </p>
                <p className="mt-1 text-text-primary">
                  No puedes publicar hasta resolverlas. Reintenta la subida o
                  quítalas para continuar; el resto del formulario se conserva
                  tal como lo escribiste.
                </p>
              </div>
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
            <Button
              type="submit"
              variant="accent"
              disabled={isSubmitting || isBlockedByImages}
            >
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

// useSearchParams() requires a Suspense boundary on prerendered client pages
// (Next build fails otherwise) — the form lives in SellForm above.
export default function SellPage() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <div className="flex items-center justify-center gap-2 py-12 text-text-muted">
            <Spinner className="h-5 w-5" /> Cargando…
          </div>
        </PageContainer>
      }
    >
      <SellForm />
    </Suspense>
  );
}
