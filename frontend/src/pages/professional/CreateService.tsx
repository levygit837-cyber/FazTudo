import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, PlusCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { CategoryWithCounts, getMainCategories } from "../../services/categoryService";
import {
  CreateServiceListingData,
  createService,
} from "../../services/serviceService";

const CreateService: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [categories, setCategories] = useState<CategoryWithCounts[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<CreateServiceListingData>({
    title: "",
    description: "",
    price: 0,
    estimatedHours: undefined,
    categoryId: 0,
    images: [],
    tags: [],
  });

  const [imagesInput, setImagesInput] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  useEffect(() => {
    const loadCategories = async () => {
      try {
        setLoadingCategories(true);
        const response = await getMainCategories(undefined, 50);
        setCategories(response.categories);
      } catch (err) {
        setError("Nao foi possivel carregar categorias.");
      } finally {
        setLoadingCategories(false);
      }
    };

    loadCategories();
  }, []);

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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!form.title.trim() || !form.description.trim() || !form.categoryId) {
      setError("Preencha titulo, descricao e categoria.");
      return;
    }

    if (!form.price || form.price <= 0) {
      setError("Informe um preco valido.");
      return;
    }

    const parsedImages = imagesInput
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    const parsedTags = tagsInput
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    try {
      setSubmitting(true);
      await createService({
        ...form,
        images: parsedImages,
        tags: parsedTags,
      });
      navigate("/professional/catalog");
    } catch (err: any) {
      setError(
        err?.response?.data?.message || "Nao foi possivel criar o servico.",
      );
    } finally {
      setSubmitting(false);
    }
  };

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
            <PlusCircle className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Criar Novo Servico
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Perfil atual: {user?.name}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" data-tour="tour-create-service-form">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="label">Titulo do servico</label>
              <input
                className="input"
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="Ex: Instalacao de ar-condicionado split"
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

            <div className="md:col-span-2">
              <label className="label">Descricao detalhada</label>
              <textarea
                className="input min-h-32"
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Explique o que esta incluso, prazos e requisitos."
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

            <div className="md:col-span-2">
              <label className="label">
                Imagens (uma URL por linha, opcional)
              </label>
              <textarea
                className="input min-h-28"
                value={imagesInput}
                onChange={(event) => setImagesInput(event.target.value)}
                placeholder={"https://.../imagem-1.jpg\nhttps://.../imagem-2.jpg"}
              />
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
              disabled={submitting}
            >
              {submitting ? "Salvando..." : "Criar servico"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateService;
