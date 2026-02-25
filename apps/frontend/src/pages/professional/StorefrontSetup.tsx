import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Store, Loader2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import {
  getMainCategories,
  CategoryWithCounts,
} from "../../services/categoryService";
import {
  getMyStorefront,
  createStorefront,
} from "../../services/storefrontService";
import { CreateStorefrontInput } from "../../types";

const StorefrontSetup: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const [categories, setCategories] = useState<CategoryWithCounts[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState<CreateStorefrontInput>({
    name: user?.name || "",
    description: "",
    mainCategoryId: undefined,
  });

  // Check if user already has a storefront
  useEffect(() => {
    const check = async () => {
      try {
        const existing = await getMyStorefront();
        if (existing) {
          // Already has storefront — redirect to manager
          navigate("/professional/vitrine", { replace: true });
          return;
        }
      } catch {
        // No storefront — continue with setup
      } finally {
        setCheckingExisting(false);
      }
    };
    check();
  }, [navigate]);

  // Load categories
  useEffect(() => {
    const load = async () => {
      try {
        setLoadingCategories(true);
        const result = await getMainCategories(undefined, 50);
        setCategories(result.categories);
      } catch {
        toast.error("Erro ao carregar categorias");
      } finally {
        setLoadingCategories(false);
      }
    };
    load();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]:
        name === "mainCategoryId"
          ? value
            ? parseInt(value, 10)
            : undefined
          : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim()) {
      toast.warning("Preencha o nome da vitrine");
      return;
    }

    setSubmitting(true);
    try {
      const storefront = await createStorefront(form);
      toast.success("Vitrine criada!", `"${storefront.name}" esta pronta para configuracao`);
      navigate("/professional/vitrine", { replace: true });
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || "Erro ao criar vitrine";
      toast.error("Erro", msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state while checking
  if (checkingExisting) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-800">
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-lg border border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Criar Vitrine
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Configure sua vitrine para exibir seus servicos
            </p>
          </div>
        </div>

        {/* Intro card */}
        <div className="card p-5 mb-6 bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center shrink-0">
              <Store className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h3 className="font-medium text-primary-900 dark:text-primary-100">
                Sua vitrine e seu cardapio de servicos
              </h3>
              <p className="text-sm text-primary-700 dark:text-primary-300 mt-1">
                Crie categorias, adicione servicos com precos e opcionais.
                Clientes poderao navegar, montar seu carrinho e fazer pedidos
                diretamente.
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="card p-5 space-y-5">
          {/* Name */}
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              Nome da vitrine *
            </label>
            <input
              id="name"
              name="name"
              type="text"
              value={form.name}
              onChange={handleChange}
              required
              maxLength={100}
              placeholder="Ex: Joao Eletricista"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Este nome aparecera para os clientes
            </p>
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              Descricao
            </label>
            <textarea
              id="description"
              name="description"
              value={form.description || ""}
              onChange={handleChange}
              rows={3}
              maxLength={500}
              placeholder="Descreva sua vitrine, seus servicos principais, experiencia..."
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
            />
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {(form.description || "").length}/500 caracteres
            </p>
          </div>

          {/* Main Category */}
          <div>
            <label
              htmlFor="mainCategoryId"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              Categoria principal
            </label>
            <select
              id="mainCategoryId"
              name="mainCategoryId"
              value={form.mainCategoryId || ""}
              onChange={handleChange}
              disabled={loadingCategories}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Selecione uma categoria</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Ajuda clientes a encontrar sua vitrine
            </p>
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting || !form.name.trim()}
              className="btn btn-primary w-full flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <Store className="w-4 h-4" />
                  Criar minha vitrine
                </>
              )}
            </button>
          </div>
        </form>

        {/* Help text */}
        <p className="text-center text-sm text-slate-400 dark:text-slate-500 mt-4">
          Apos criar, voce podera adicionar categorias, servicos e personalizar
          sua vitrine
        </p>
      </div>
    </div>
  );
};

export default StorefrontSetup;
