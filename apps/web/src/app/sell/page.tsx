"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
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
  OptionalTag,
} from "@/components/ui";
import { CONDITION_OPTIONS } from "@/lib/product-condition";
import { PRODUCT_CATEGORIES, DEFAULT_PRODUCT_CATEGORY } from "@/lib/categories";
import { readJson, writeJson, removeKey } from "@/lib/storage";

const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ACCEPTED_EXTENSIONS = ".jpg,.jpeg,.png,.webp";
const MAX_FILE_SIZE_MB = 5;
// Item 4 closed decision: max exactly 6 images per listing. The uploads
// endpoint only accepts 5 per request, so the picker uploads in batches.
const MAX_FILES = 6;
const UPLOAD_BATCH_SIZE = 5;

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
  /** Item 4: required before the listing can be published. */
  alt: string;
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
// Size and category are both whitelisted against their fixed option lists:
// a stale or hand-typed value outside them would otherwise leave React
// holding a value the <select> can't render (blank field until submit).
// Category falls back to "Otros" — the same closed-list default the API's
// backfill uses — instead of blanking the field.
function readPrefill(searchParams: ReturnType<typeof useSearchParams>) {
  const rawSize = searchParams.get("size") ?? "";
  const rawCategory = searchParams.get("category") ?? "".trim();
  return {
    title: (searchParams.get("title") ?? "").trim(),
    category: (PRODUCT_CATEGORIES as readonly string[]).includes(rawCategory)
      ? rawCategory
      : DEFAULT_PRODUCT_CATEGORY,
    size: (SIZES as string[]).includes(rawSize) ? rawSize : "",
  };
}

const DRAFT_STORAGE_KEY = "versale:sell-draft:v1";
const DRAFT_EVENT = "versale:sell-draft-change";
// ponytail: deleted BroadcastChannel dup; storage+CustomEvent cover cross/same-tab; restore BC if need instant cross-tab without storage round-trip
function emitDraftChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DRAFT_EVENT));
}
type SellDraft = Partial<Record<string, string>>;
function readDraft(): SellDraft {
  const parsed = readJson<unknown>(DRAFT_STORAGE_KEY, {});
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
  return parsed as SellDraft;
}
function writeDraft(form: Record<string, string>) {
  writeJson(DRAFT_STORAGE_KEY, form);
  emitDraftChange();
}
function clearDraft() {
  removeKey(DRAFT_STORAGE_KEY);
  emitDraftChange();
}

const FORM_FIELDS = [
  "title",
  "description",
  "category",
  "brand",
  "size",
  "condition",
  "price",
  "measurements",
  "defects",
] as const;

function SellForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: isAuthLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  // State initializer = the one-time prefill application point.
  const prefill = readPrefill(searchParams);
  // Item 10: el prefill explícito ("Publicar otro igual") gana sobre el
  // borrador guardado; sin él, el borrador restaura lo que el vendedor ya
  // escribió antes de un refresh. Se mira el query string crudo — readPrefill
  // normaliza category a "Otros", así que su salida no sirve para detectar.
  const hasPrefill =
    (searchParams.get("title") ?? "").trim() !== "" ||
    (searchParams.get("category") ?? "").trim() !== "" ||
    (searchParams.get("size") ?? "").trim() !== "";
  const draft = hasPrefill ? {} : readDraft();
  const [form, setForm] = useState({
    title: prefill.title || draft.title || "",
    description: draft.description || "",
    category: prefill.category || draft.category || DEFAULT_PRODUCT_CATEGORY,
    brand: draft.brand || "",
    size:
      prefill.size ||
      ((SIZES as string[]).includes(draft.size ?? "") ? draft.size : "") ||
      "",
    condition: draft.condition || "Good",
    price: draft.price || "",
    // Item 4: seller-curated transparency fields, both optional.
    measurements: draft.measurements || "",
    defects: draft.defects || "",
  });
  const [images, setImages] = useState<LocalImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Item 10 follow-up: the draft lives in one shared localStorage key with no
  // per-tab coordination, so two tabs open on /sell silently overwrite each
  // other's draft — the `storage` event is the only signal a tab gets that
  // this happened, since it only ever fires in tabs OTHER than the one that
  // wrote the change. This can't safely auto-merge (whose text wins?), so it
  // just surfaces the fact instead of guessing.
  const [draftChangedElsewhere, setDraftChangedElsewhere] = useState(false);

  const { data: suggested } = useQuery({
    queryKey: ["suggested-price", form.category, form.condition],
    queryFn: () =>
      api
        .get<{ suggestedPrice: number | null; sampleSize?: number }>(
          "/products/suggested-price",
          { params: { category: form.category, condition: form.condition } },
        )
        .then((r) => r.data),
    enabled: !!form.category && !!form.condition,
    staleTime: 60_000,
    retry: false,
  });

  useEffect(() => {
    function onChange() {
      setDraftChangedElsewhere(true);
    }
    function onStorage(event: StorageEvent) {
      if (event.key === DRAFT_STORAGE_KEY) onChange();
    }
    const customHandler = () => onChange();
    window.addEventListener("storage", onStorage);
    window.addEventListener(DRAFT_EVENT, customHandler);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(DRAFT_EVENT, customHandler);
    };
  }, []);

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
    setForm((f) => {
      const next = { ...f, [key]: value };
      // Persistencia inmediata: el refresh puede llegar en cualquier tecla.
      writeDraft(next);
      return next;
    });
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
      // FormData: the client sends it raw and lets fetch set the
      // multipart boundary; a manual content-type would break the upload.
      const res = await api.post<{ images: { url: string; key: string }[] }>(
        "/uploads/images",
        data,
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
      alt: "",
    }));
    setImages((prev) => [...prev, ...placeholders]);

    // Clear the picker so choosing the same file again still fires `change`
    // — otherwise a seller can't re-pick a photo that failed.
    if (fileInputRef.current) fileInputRef.current.value = "";

    // The endpoint caps each request at UPLOAD_BATCH_SIZE files
    // (FilesInterceptor('files', 5)), so >5 selections go up in batches.
    for (let i = 0; i < placeholders.length; i += UPLOAD_BATCH_SIZE) {
      const batch = placeholders.slice(i, i + UPLOAD_BATCH_SIZE);
      await Promise.all(batch.map((p) => uploadOne(p.id, p.file)));
    }
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
    // Item 4: every photo needs its alt text — it's what screen readers (and
    // the marketplace grid) describe the photo with, and the API rejects the
    // listing without it anyway. The error names the photo by the same number
    // the field is labeled with: the fields sit above the submit button, so
    // "una foto" alone left the seller hunting for which one.
    const missingAltPositions = uploadedImages
      .map((img, index) => (img.alt.trim() ? null : index + 1))
      .filter((position): position is number => position !== null);
    if (missingAltPositions.length > 0) {
      setError(
        missingAltPositions.length === 1
          ? `Falta la descripción de la foto ${missingAltPositions[0]}.`
          : // ponytail: manual "y" for es conjunction; Intl.ListFormat if locale rules grow
            `Faltan las descripciones de las fotos ${missingAltPositions.join(", ").replace(/, ([^,]*)$/, " y $1")}.`,
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
            ? uploadedImages.map((img) => ({ url: img.url as string, alt: img.alt.trim() }))
            : undefined,
        measurements: form.measurements.trim() || undefined,
        defects: form.defects.trim() || undefined,
      });
      // Publicación exitosa: el borrador cumplió su ciclo, no debe
      // resucitar en el siguiente /sell.
      clearDraft();
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

      {draftChangedElsewhere && (
        <div
          role="status"
          className="mb-4 rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-text-primary"
        >
          Editaste este borrador en otra pestaña. Actualiza esta página para
          ver los cambios más recientes; si sigues escribiendo aquí,
          sobrescribirás lo que guardaste allá.
        </div>
      )}

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* The form marks its exceptions, not its rule — six of the nine
              fields are required, so tagging those would mark two thirds of
              the page. Stating the convention once is what was missing: until
              now a seller only learned a field was required by submitting. */}
          <p className="text-xs text-text-muted">
            Todos los campos son obligatorios, salvo los marcados como
            opcionales.
          </p>
          <Input
            label="Título"
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder="Ej. Chaqueta de jean vintage Levi's"
            required
            maxLength={120}
          />
          <Textarea
            label="Descripción"
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            rows={4}
            placeholder="Describe la prenda, el talle, detalles del estado, etc."
            required
            maxLength={2000}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              label="Categoría"
              value={form.category}
              onChange={(e) => update("category", e.target.value)}
              required
            >
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Input
              label="Marca"
              optional
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
            max={100_000_000}
            step="1"
            value={form.price}
            onChange={(e) => update("price", e.target.value)}
            placeholder="0"
            required
            hint="Precio en pesos colombianos, sin decimales."
          />
          {suggested?.suggestedPrice != null && (
            <p className="text-xs text-text-muted">
              Precio sugerido: ${suggested.suggestedPrice.toLocaleString("es-CO")} (basado en{" "}
              {suggested.sampleSize} publicaciones)
            </p>
          )}

          <div className="space-y-2">
            <label
              htmlFor="sell-images"
              className="flex items-baseline gap-1.5 text-sm font-medium text-text-primary"
            >
              <span>Imágenes</span>
              <OptionalTag />
            </label>
            <input
              id="sell-images"
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              className="block w-full text-sm text-text-primary file:mr-3 file:rounded-md file:border file:border-control file:bg-surface file:px-3 file:py-2 file:text-sm file:font-medium file:text-text-primary hover:file:bg-surface-muted"
            />
            <p className="text-xs text-text-muted">
              Sin fotos, tu prenda se muestra en el catálogo con un recuadro
              que dice «Sin imagen». Hasta {MAX_FILES} imágenes, máximo{" "}
              {MAX_FILE_SIZE_MB}MB cada una. Formatos: JPG, PNG o WEBP.
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
                          className="inline-flex min-h-11 items-center justify-center rounded-full bg-paper px-3 py-1 text-xs font-medium text-ink transition-colors hover:bg-paper-2"
                        >
                          Reintentar
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeImage(img.id)}
                      className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full bg-ink/70 text-sm text-paper hover:bg-ink"
                      aria-label={`Quitar ${img.name}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {uploadedImages.length > 0 && (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-text-primary">
                  Describe cada foto
                </legend>
                <p className="text-xs text-text-muted">
                  Es el texto que leen los lectores de pantalla y el que
                  describe la foto si no carga.
                </p>
                {uploadedImages.map((img, index) => (
                  <div key={img.id} className="flex items-center gap-2">
                    <span aria-hidden="true" className="text-xs text-text-muted">
                      {index + 1}.
                    </span>
                    <input
                      type="text"
                      value={img.alt}
                      maxLength={150}
                      aria-required="true"
                      onChange={(e) =>
                        patchImage(img.id, { alt: e.target.value })
                      }
                      aria-label={`Descripción de la foto ${index + 1}`}
                      placeholder={`Ej: vista frontal de la prenda`}
                      className="w-full rounded-md border border-control bg-surface px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary"
                    />
                  </div>
                ))}
              </fieldset>
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

          <div className="space-y-2">
            <Textarea
              label="Medidas"
              optional
              value={form.measurements}
              onChange={(e) => update("measurements", e.target.value)}
              placeholder="Ej: pecho 52 cm, largo 65 cm, manga 60 cm"
              hint="Medidas tomadas con la prenda extendida."
              maxLength={1000}
            />
            <Textarea
              label="Defectos"
              optional
              value={form.defects}
              onChange={(e) => update("defects", e.target.value)}
              placeholder="Ej: pequeño desgaste en el puño derecho"
              hint="Declara con honestidad: reduce devoluciones y reclamos."
              maxLength={1000}
            />
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
