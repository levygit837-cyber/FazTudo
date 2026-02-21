import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Save } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { CategoryWithCounts, getMainCategories } from "../../services/categoryService";
import {
  getServiceById,
  updateService,
  UpdateServiceListingData,
  uploadListingImages,
} from "../../services/serviceService";
import { Skeleton, SkeletonText } from "../../components/common/Skeleton";

const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const EditService: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const [categories, setCategories] = useState<CategoryWithCounts[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingService, setLoadingService] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Upload state
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);

  const [form, setForm] = useState<UpdateServiceListingData>({
    title: "",
    description: "",
    price: 0,
    estimatedHours: undefined,
    categoryId: 0,
    images: [],
    tags: [],
    isAvailable: true,
  });

  const [imagesInput, setImagesInput] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoadingCategories(true);
        const response = await getMainCategories(undefined, 50);
        setCategories(response.categories);
      } catch {
        setError("Nao foi possivel carregar categorias.");
      } finally {
        setLoadingCategories(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const loadService = async () => {
      if (!id) return;
      try {
        setLoadingService(true);
        const service = await getServiceById(parseInt(id, 10));
        const allImages: string[] = (service.images as string[]) || [];
        const tags = (service.tags as string[]) || [];

        // Separar imagens locais (upload) de URLs externas
        const localImgs = allImages.filter((u) => u.startsWith("/uploads/listings/"));
        const externalImgs = allImages.filter((u) => !u.startsWith("/uploads/listings/"));

        setForm({
          title: service.title,
          description: service.description,
          price: service.price,
          estimatedHours: service.estimatedHours || undefined,
          categoryId: service.category?.id || 0,
          images: allImages,
          tags,
          isAvailable: service.isAvailable,
        });
        setUploadedImages(localImgs);
        setImagesInput(externalImgs.join("\n"));
        setTagsInput(tags.join(", "));
      } catch {
        setError("Nao foi possivel carregar o servico.");
      } finally {
        setLoadingService(false);
      }
    };
    loadService();
  }, [id]);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target;

    if (name === "price") {
      setForm((prev) => ({ ...prev, price: Number(value) }));
      return;
    }
    if (name === "estimatedHours") {
      setForm((prev) => ({
        ...prev,
        estimatedHours: value ? Number(value) : undefined,
      }));
      return;
    }
    if (name === "categoryId") {
      setForm((prev) => ({ ...prev, categoryId: Number(value) }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (fileArray.length === 0) {
      toastError("Selecione apenas arquivos de imagem (JPEG, PNG, WebP, GIF)");
      return;
    }
    if (uploadedImages.length + fileArray.length > 8) {
      toastError("Máximo de 8 imagens por serviço");
      return;
    }

    setUploadingImages(true);
    try {
      const urls = await uploadListingImages(fileArray);
      setUploadedImages((prev) => [...prev, ...urls]);
      toastSuccess(`${urls.length} imagem(ns) enviada(s) com sucesso`);
    } catch {
      toastError("Erro ao enviar imagens. Tente novamente.");
    } finally {
      setUploadingImages(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    if (!form.title?.trim() || !form.description?.trim() || !form.categoryId) {
      setError("Preencha titulo, descricao e categoria.");
      return;
    }

    if (!form.price || form.price <= 0) {
      setError("Informe um preco valido.");
      return;
    }

    const urlImages = imagesInput
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    const parsedImages = [...uploadedImages, ...urlImages];

    const parsedTags = tagsInput
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    try {
      setSubmitting(true);
      await updateService(parseInt(id!, 10), {
        ...form,
        images: parsedImages,
        tags: parsedTags,
      });
      setSuccess(true);
      setTimeout(() => navigate("/professional/catalog"), 1500);
    } catch (err: any) {
      setError(
        err?.response?.data?.message || "Nao foi possivel atualizar o servico.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingService) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-8 space-y-6">
        <Skeleton className="h-4 w-24" />
        <div className="card border border-slate-200 dark:border-slate-700 p-6 space-y-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-3 w-64" />
            </div>
          </div>
          <SkeletonText lines={1} className="max-w-sm" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <SkeletonText lines={4} />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
          </div>
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <button
        onClick={() => navigate(-1)}
        className="mb-6 inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-primary-600"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </button>

      <div className="card border border-slate-200 dark:border-slate-700 p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
            <Save className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Editar Servico
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Perfil: {user?.name}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/30 px-4 py-3 text-sm text-green-700 dark:text-green-400">
            Servico atualizado com sucesso! Redirecionando...
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="label">Titulo do servico</label>
              <input
                className="input"
                name="title"
                value={form.title || ""}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label className="label">Categoria</label>
              <select
                className="input"
                name="categoryId"
                value={form.categoryId || ""}
                onChange={handleChange}
                required
                disabled={loadingCategories}
              >
                <option value="">Selecione</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Preco (R$)</label>
              <input
                className="input"
                type="number"
                name="price"
                value={form.price || ""}
                onChange={handleChange}
                min="1"
                step="0.01"
                required
              />
            </div>

            <div>
              <label className="label">Tempo estimado (horas)</label>
              <input
                className="input"
                type="number"
                name="estimatedHours"
                value={form.estimatedHours || ""}
                onChange={handleChange}
                min="1"
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="label mb-0">Disponivel</label>
              <button
                type="button"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    isAvailable: !prev.isAvailable,
                  }))
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  form.isAvailable ? "bg-green-500" : "bg-slate-300 dark:bg-slate-600"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    form.isAvailable ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {form.isAvailable ? "Ativo" : "Pausado"}
              </span>
            </div>

            <div className="md:col-span-2">
              <label className="label">Descricao detalhada</label>
              <textarea
                className="input min-h-32"
                name="description"
                value={form.description || ""}
                onChange={handleChange}
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="label">Tags (separadas por virgula)</label>
              <input
                className="input"
                value={tagsInput}
                onChange={(event) => setTagsInput(event.target.value)}
                placeholder="eletrica, residencial, manutencao"
              />
            </div>

            {/* ─── Upload de Imagens ─────────────────────────────────────── */}
            <div className="md:col-span-2">
              <label className="label">Imagens do Serviço (máx. 8)</label>

              {/* Área de drop */}
              <div
                className={[
                  "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
                  uploadingImages
                    ? "border-primary/40 bg-primary/5 cursor-wait"
                    : "border-slate-300 dark:border-slate-600 hover:border-primary/60 hover:bg-primary/5 cursor-pointer",
                ].join(" ")}
                onClick={() =>
                  !uploadingImages &&
                  document.getElementById("edit-listing-image-input")?.click()
                }
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleImageFiles(e.dataTransfer.files);
                }}
              >
                <input
                  id="edit-listing-image-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  className="hidden"
                  onChange={(e) => handleImageFiles(e.target.files)}
                  disabled={uploadingImages}
                />
                {uploadingImages ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Enviando imagens...
                  </p>
                ) : (
                  <>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Clique ou arraste imagens aqui
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      JPEG, PNG, WebP, GIF — máx. 5 MB cada
                    </p>
                  </>
                )}
              </div>

              {/* Preview das imagens enviadas */}
              {uploadedImages.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {uploadedImages.map((url, idx) => (
                    <div key={idx} className="relative group">
                      <img
                        src={`${BACKEND_URL}${url}`}
                        alt={`Imagem ${idx + 1}`}
                        className="w-20 h-20 object-cover rounded-md border border-slate-200 dark:border-slate-700"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setUploadedImages((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5
                                   flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* URLs externas (opcional) */}
              <details className="mt-3">
                <summary className="text-xs text-slate-500 dark:text-slate-400 cursor-pointer select-none">
                  Ou adicionar URLs externas (opcional)
                </summary>
                <textarea
                  className="input min-h-20 mt-2 text-sm"
                  value={imagesInput}
                  onChange={(event) => setImagesInput(event.target.value)}
                  placeholder="https://exemplo.com/imagem.jpg"
                />
              </details>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => navigate("/professional/catalog")}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || uploadingImages}
            >
              {submitting ? "Salvando..." : "Salvar alteracoes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditService;
