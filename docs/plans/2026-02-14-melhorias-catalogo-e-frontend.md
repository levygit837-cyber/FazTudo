# Melhorias do Catalogo e Frontend - Plano de Implementacao

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Corrigir o erro "Network Error" no catalogo do profissional, melhorar o formulario de criacao de servicos, renomear "Catalogo" para "Meus Servicos", e aplicar melhorias visuais gerais no frontend.

**Architecture:** O projeto e um monorepo com frontend React + Vite + TailwindCSS e backend Express + Prisma + SQLite. O catalogo do profissional reutiliza o componente `ServiceSearch.tsx` com a prop `showProfessionalCatalog`. Os servicos sao listados via `GET /api/services` (endpoint publico). As categorias vem de `GET /api/categories/main`.

**Tech Stack:** React 18.2, TypeScript, Vite 5, TailwindCSS 3.3, Axios 1.6, Express 5.2, Prisma 7.3, SQLite

---

## Task 1: Corrigir Network Error no Catalogo - Backend

**Diagnostico completo da causa raiz:**

O erro "Network Error" tem 3 causas potenciais identificadas:

1. **PRINCIPAL - SQLite nao suporta `mode: "insensitive"`:** No `listingController.ts` (linha 103), o Prisma usa `{ contains: search, mode: "insensitive" }` que **nao funciona com SQLite**. Qualquer busca causa um erro 500 no backend. Comprovado via `curl -s "http://localhost:3001/api/services?search=teste" => 500`.

2. **Helmet `crossOriginEmbedderPolicy: require-corp`** pode bloquear recursos cross-origin em certos navegadores, causando "Network Error" no Axios.

3. **JWT com secret aleatorio por restart:** O `env.ts` gera um `generateDevSecret()` a cada restart do backend, invalidando todos os tokens existentes. Quando o profissional tem um token invalido e o frontend tenta acessar endpoints autenticados, recebe 401 e redireciona para login.

**Files:**
- Modify: `backend/src/controllers/service/listingController.ts:99-107`
- Modify: `backend/src/controllers/serviceController.ts:186-194` (mesmo fix duplicado)
- Modify: `backend/src/index.ts:37-38` (Helmet COEP)

**Step 1: Corrigir `mode: "insensitive"` no listingController.ts**

No arquivo `backend/src/controllers/service/listingController.ts`, substituir as linhas 99-107:

```typescript
// ANTES (quebra com SQLite):
if (search) {
  whereClause = {
    ...filters,
    OR: [
      { title: { contains: search as string, mode: "insensitive" } },
      { description: { contains: search as string, mode: "insensitive" } },
    ],
  };
}

// DEPOIS (compativel com SQLite):
if (search) {
  whereClause = {
    ...filters,
    OR: [
      { title: { contains: search as string } },
      { description: { contains: search as string } },
    ],
  };
}
```

**Step 2: Aplicar o mesmo fix no serviceController.ts**

No arquivo `backend/src/controllers/serviceController.ts`, substituir as linhas 186-194 com o mesmo padrao (remover `mode: "insensitive"`).

**Step 3: Relaxar Helmet COEP no backend**

No arquivo `backend/src/index.ts`, alterar a configuracao do Helmet:

```typescript
// ANTES:
crossOriginEmbedderPolicy: true,

// DEPOIS:
crossOriginEmbedderPolicy: false,
```

**Step 4: Testar o fix**

Run: `curl -s "http://localhost:3001/api/services?search=eletrica" | python3 -m json.tool | head -5`
Expected: `200 OK` com resultado de servicos contendo "eletrica"

Run: `curl -s "http://localhost:3001/api/services?professionalId=2&availableOnly=all" | python3 -m json.tool | head -5`
Expected: `200 OK` com servicos do profissional 2

**Step 5: Commit**

```bash
git add backend/src/controllers/service/listingController.ts backend/src/controllers/serviceController.ts backend/src/index.ts
git commit -m "fix: resolve Network Error in catalog - SQLite insensitive mode + Helmet COEP"
```

---

## Task 2: Corrigir parsing de JSON fields (images/tags)

**Problema:** SQLite + Prisma `Json` fields retornam strings serializadas (`"[]"`, `"[\"tag1\"]"`) em vez de arrays parsed. O frontend faz `service.images as string[]` que resulta em string ao inves de array, quebrando a renderizacao de imagens.

**Files:**
- Modify: `backend/src/controllers/service/listingController.ts:151-155`
- Modify: `backend/src/controllers/serviceController.ts:238-242`

**Step 1: Adicionar helper de parse JSON no listingController**

No topo do arquivo `backend/src/controllers/service/listingController.ts`, apos os imports, adicionar:

```typescript
// Helper para parsear campos JSON do SQLite
const parseJsonField = (value: any): any => {
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return value; }
  }
  return value;
};
```

**Step 2: Aplicar parse nos servicos retornados no listingController**

No `listServices` do `listingController.ts`, alterar o map dos servicos (linhas 151-155):

```typescript
// ANTES:
const servicesWithStats = services.map((service: any) => ({
  ...service,
  completedOrders: service.serviceOrders?.length || 0,
  serviceOrders: undefined,
}));

// DEPOIS:
const servicesWithStats = services.map((service: any) => ({
  ...service,
  images: parseJsonField(service.images),
  tags: parseJsonField(service.tags),
  completedOrders: service.serviceOrders?.length || 0,
  serviceOrders: undefined,
}));
```

**Step 3: Aplicar o mesmo fix no serviceController.ts**

No `serviceController.ts`, fazer o mesmo para `listServices` (linhas 238-242) e `getService` (adicionar parse no retorno).

**Step 4: Testar**

Run: `curl -s "http://localhost:3001/api/services" | python3 -c "import sys,json; d=json.load(sys.stdin); print(type(d['data']['services'][0]['images']), d['data']['services'][0]['images'])"`
Expected: `<class 'list'> []`

**Step 5: Commit**

```bash
git add backend/src/controllers/service/listingController.ts backend/src/controllers/serviceController.ts
git commit -m "fix: parse JSON fields (images/tags) from SQLite for proper array return"
```

---

## Task 3: Renomear "Catalogo" para "Meus Servicos" na Navegacao

**Files:**
- Modify: `frontend/src/components/Layout.tsx:181`
- Modify: `frontend/src/pages/services/ServiceSearch.tsx:269`

**Step 1: Alterar label na navegacao**

No arquivo `frontend/src/components/Layout.tsx`, linha 181:

```typescript
// ANTES:
label: "Catalogo",

// DEPOIS:
label: "Meus Servicos",
```

NOTA: "Meus Servicos" ja existe na linha 176 para orders. Precisamos diferenciar:
- Linha 176: `label: "Pedidos"` (para orders recebidos)
- Linha 181: `label: "Meus Servicos"` (para catalogo de servicos oferecidos)

Entao na realidade, o plano e:
- Linha 176: mudar de `"Meus Servicos"` para `"Pedidos Recebidos"` (pois sao service orders)
- Linha 181: mudar de `"Catalogo"` para `"Meus Servicos"` (catalogo do profissional)

**Step 2: Alterar titulo no header da pagina**

No arquivo `frontend/src/pages/services/ServiceSearch.tsx`, linha 269:

```typescript
// ANTES:
Meu Catalogo de Servicos

// DEPOIS:
Meus Servicos
```

E a descricao na linha 272:

```typescript
// ANTES:
Crie e gerencie os servicos do seu perfil profissional.

// DEPOIS:
Gerencie os servicos que voce oferece na plataforma.
```

**Step 3: Commit**

```bash
git add frontend/src/components/Layout.tsx frontend/src/pages/services/ServiceSearch.tsx
git commit -m "refactor: rename Catalogo to Meus Servicos and improve nav labels"
```

---

## Task 4: Melhorar formulario "Novo Servico" (CreateService.tsx)

**Objetivo:** Transformar o formulario basico em um formulario completo com:
- Selecao de categoria com subcategorias (hierarquica)
- Informacoes detalhadas sobre o servico
- Estimativa de duracao com unidade (horas/dias)
- Valor por servico com formatacao
- Upload de imagens com preview (URL por enquanto, mas com UI melhorada)
- Tags com chips interativos

**Files:**
- Modify: `frontend/src/pages/professional/CreateService.tsx` (rewrite completo)
- Modify: `frontend/src/services/serviceService.ts:48-56` (expandir tipos se necessario)

**Step 1: Reescrever o CreateService.tsx**

Substituir o conteudo inteiro de `frontend/src/pages/professional/CreateService.tsx` com um formulario melhorado:

```tsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  PlusCircle,
  X,
  Image as ImageIcon,
  Clock,
  DollarSign,
  Tag,
  FileText,
  ChevronRight,
  Check,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import {
  CategoryWithCounts,
  getMainCategories,
} from "../../services/categoryService";
import {
  CreateServiceListingData,
  createService,
} from "../../services/serviceService";

const CreateService: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  // Categories
  const [categories, setCategories] = useState<CategoryWithCounts[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [selectedParentCategory, setSelectedParentCategory] =
    useState<CategoryWithCounts | null>(null);

  // Form state
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [currentStep, setCurrentStep] = useState(1);

  const [form, setForm] = useState<CreateServiceListingData>({
    title: "",
    description: "",
    price: 0,
    estimatedHours: undefined,
    categoryId: 0,
    images: [],
    tags: [],
  });

  // Tags input
  const [tagInput, setTagInput] = useState("");
  const tagInputRef = useRef<HTMLInputElement>(null);

  // Images input
  const [imageUrlInput, setImageUrlInput] = useState("");

  useEffect(() => {
    const loadCategories = async () => {
      try {
        setLoadingCategories(true);
        const response = await getMainCategories(undefined, 50);
        setCategories(response.categories);
      } catch (err) {
        toast.error("Erro", "Nao foi possivel carregar categorias.");
      } finally {
        setLoadingCategories(false);
      }
    };
    loadCategories();
  }, []);

  // Validation
  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step >= 1) {
      if (!form.categoryId) {
        newErrors.categoryId = "Selecione uma categoria";
      }
    }

    if (step >= 2) {
      if (!form.title.trim()) {
        newErrors.title = "Titulo e obrigatorio";
      } else if (form.title.trim().length < 5) {
        newErrors.title = "Titulo deve ter pelo menos 5 caracteres";
      }
      if (!form.description.trim()) {
        newErrors.description = "Descricao e obrigatoria";
      } else if (form.description.trim().length < 20) {
        newErrors.description = "Descricao deve ter pelo menos 20 caracteres";
      }
    }

    if (step >= 3) {
      if (!form.price || form.price <= 0) {
        newErrors.price = "Informe um valor valido";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 4));
    }
  };

  const handlePrevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  // Category selection
  const handleCategorySelect = (category: CategoryWithCounts) => {
    if (category.subcategories && category.subcategories.length > 0) {
      setSelectedParentCategory(category);
    } else {
      setForm((prev) => ({ ...prev, categoryId: category.id }));
      setSelectedParentCategory(null);
    }
  };

  const handleSubcategorySelect = (subcategory: CategoryWithCounts) => {
    setForm((prev) => ({ ...prev, categoryId: subcategory.id }));
  };

  // Tags
  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !(form.tags || []).includes(tag)) {
      setForm((prev) => ({
        ...prev,
        tags: [...(prev.tags || []), tag],
      }));
      setTagInput("");
      tagInputRef.current?.focus();
    }
  };

  const removeTag = (tagToRemove: string) => {
    setForm((prev) => ({
      ...prev,
      tags: (prev.tags || []).filter((t) => t !== tagToRemove),
    }));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    }
  };

  // Images
  const addImageUrl = () => {
    const url = imageUrlInput.trim();
    if (url && !(form.images || []).includes(url)) {
      try {
        new URL(url);
        setForm((prev) => ({
          ...prev,
          images: [...(prev.images || []), url],
        }));
        setImageUrlInput("");
      } catch {
        setErrors((prev) => ({
          ...prev,
          imageUrl: "URL invalida",
        }));
      }
    }
  };

  const removeImage = (urlToRemove: string) => {
    setForm((prev) => ({
      ...prev,
      images: (prev.images || []).filter((u) => u !== urlToRemove),
    }));
  };

  // Submit
  const handleSubmit = async () => {
    if (!validateStep(3)) return;

    try {
      setSubmitting(true);
      await createService(form);
      toast.success("Servico criado com sucesso!");
      navigate("/professional/catalog");
    } catch (err: any) {
      toast.error(
        "Erro ao criar servico",
        err?.response?.data?.message || "Tente novamente."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Get selected category name for display
  const getSelectedCategoryName = (): string => {
    if (!form.categoryId) return "";
    for (const cat of categories) {
      if (cat.id === form.categoryId) return cat.name;
      if (cat.subcategories) {
        const sub = cat.subcategories.find((s) => s.id === form.categoryId);
        if (sub) return `${cat.name} > ${sub.name}`;
      }
    }
    return "";
  };

  const steps = [
    { num: 1, label: "Categoria" },
    { num: 2, label: "Detalhes" },
    { num: 3, label: "Valor" },
    { num: 4, label: "Midia" },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      {/* Header */}
      <button
        onClick={() => navigate(-1)}
        className="mb-6 inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-primary-600 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </button>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
            <PlusCircle className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Novo Servico
          </h1>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 ml-[52px]">
          Cadastre um novo servico para exibir no seu perfil profissional.
        </p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center justify-between mb-8 px-2">
        {steps.map((step, index) => (
          <React.Fragment key={step.num}>
            <button
              onClick={() => {
                if (step.num < currentStep) setCurrentStep(step.num);
              }}
              className={`flex flex-col items-center gap-1.5 ${
                step.num < currentStep ? "cursor-pointer" : "cursor-default"
              }`}
            >
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                  step.num < currentStep
                    ? "bg-primary-600 text-white"
                    : step.num === currentStep
                    ? "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 ring-2 ring-primary-500"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
                }`}
              >
                {step.num < currentStep ? (
                  <Check className="w-4 h-4" />
                ) : (
                  step.num
                )}
              </div>
              <span
                className={`text-xs font-medium ${
                  step.num <= currentStep
                    ? "text-slate-900 dark:text-slate-100"
                    : "text-slate-400 dark:text-slate-500"
                }`}
              >
                {step.label}
              </span>
            </button>
            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 mt-[-16px] ${
                  step.num < currentStep
                    ? "bg-primary-500"
                    : "bg-slate-200 dark:bg-slate-700"
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: Category */}
      {currentStep === 1 && (
        <div className="card border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
            Selecione a Categoria
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Escolha a categoria que melhor descreve o seu servico.
          </p>

          {errors.categoryId && (
            <div className="mb-4 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4" />
              {errors.categoryId}
            </div>
          )}

          {loadingCategories ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <div
                  key={i}
                  className="h-20 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse"
                />
              ))}
            </div>
          ) : selectedParentCategory ? (
            <div>
              <button
                onClick={() => setSelectedParentCategory(null)}
                className="mb-4 inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Voltar para categorias
              </button>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                Subcategorias de{" "}
                <span className="text-primary-600">
                  {selectedParentCategory.name}
                </span>
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {selectedParentCategory.subcategories?.map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => handleSubcategorySelect(sub)}
                    className={`p-4 rounded-xl border-2 text-left transition-all hover:shadow-md ${
                      form.categoryId === sub.id
                        ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                        : "border-slate-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-600"
                    }`}
                  >
                    <p className="font-medium text-sm text-slate-900 dark:text-slate-100">
                      {sub.name}
                    </p>
                    {sub.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        {sub.description}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleCategorySelect(cat)}
                  className={`p-4 rounded-xl border-2 text-left transition-all hover:shadow-md ${
                    form.categoryId === cat.id
                      ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                      : "border-slate-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-600"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm text-slate-900 dark:text-slate-100">
                      {cat.name}
                    </p>
                    {cat.subcategories && cat.subcategories.length > 0 && (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                  {cat._count?.serviceListings ? (
                    <p className="text-xs text-slate-400 mt-1">
                      {cat._count.serviceListings} servicos
                    </p>
                  ) : null}
                </button>
              ))}
            </div>
          )}

          {form.categoryId > 0 && (
            <div className="mt-4 p-3 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800">
              <p className="text-sm text-primary-700 dark:text-primary-300">
                <span className="font-medium">Selecionado:</span>{" "}
                {getSelectedCategoryName()}
              </p>
            </div>
          )}

          <div className="flex justify-end mt-6">
            <button
              onClick={handleNextStep}
              className="btn btn-primary"
              disabled={!form.categoryId}
            >
              Proximo
              <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Details */}
      {currentStep === 2 && (
        <div className="card border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
            Detalhes do Servico
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Descreva o que esta incluso no seu servico.
          </p>

          <div className="space-y-5">
            {/* Title */}
            <div>
              <label className="label flex items-center gap-1.5">
                <FileText className="w-4 h-4" />
                Titulo do servico
              </label>
              <input
                className={`input ${errors.title ? "border-red-400 dark:border-red-600" : ""}`}
                value={form.title}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="Ex: Instalacao de ar-condicionado split"
                maxLength={100}
              />
              {errors.title && (
                <p className="text-xs text-red-500 mt-1">{errors.title}</p>
              )}
              <p className="text-xs text-slate-400 mt-1">
                {form.title.length}/100 caracteres
              </p>
            </div>

            {/* Description */}
            <div>
              <label className="label flex items-center gap-1.5">
                <FileText className="w-4 h-4" />
                Descricao detalhada
              </label>
              <textarea
                className={`input min-h-32 ${errors.description ? "border-red-400 dark:border-red-600" : ""}`}
                value={form.description}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Descreva o que esta incluso, materiais utilizados, garantias, prazos e requisitos do servico."
                maxLength={1000}
              />
              {errors.description && (
                <p className="text-xs text-red-500 mt-1">
                  {errors.description}
                </p>
              )}
              <p className="text-xs text-slate-400 mt-1">
                {form.description.length}/1000 caracteres
              </p>
            </div>

            {/* Tags */}
            <div>
              <label className="label flex items-center gap-1.5">
                <Tag className="w-4 h-4" />
                Tags de busca
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {(form.tags || []).map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
                  >
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
                      className="hover:text-red-500 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  ref={tagInputRef}
                  className="input flex-1"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  placeholder="Digite uma tag e pressione Enter"
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="btn btn-outline btn-sm"
                  disabled={!tagInput.trim()}
                >
                  Adicionar
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Pressione Enter ou virgula para adicionar
              </p>
            </div>
          </div>

          <div className="flex justify-between mt-6">
            <button onClick={handlePrevStep} className="btn btn-outline">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Anterior
            </button>
            <button onClick={handleNextStep} className="btn btn-primary">
              Proximo
              <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Pricing */}
      {currentStep === 3 && (
        <div className="card border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
            Valor e Duracao
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Defina o preco e tempo estimado do seu servico.
          </p>

          <div className="space-y-5">
            {/* Price */}
            <div>
              <label className="label flex items-center gap-1.5">
                <DollarSign className="w-4 h-4" />
                Valor do servico (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">
                  R$
                </span>
                <input
                  className={`input pl-10 ${errors.price ? "border-red-400 dark:border-red-600" : ""}`}
                  type="number"
                  value={form.price || ""}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      price: Number(e.target.value),
                    }))
                  }
                  min="1"
                  step="0.01"
                  placeholder="0,00"
                />
              </div>
              {errors.price && (
                <p className="text-xs text-red-500 mt-1">{errors.price}</p>
              )}
              <p className="text-xs text-slate-400 mt-1">
                Valor base cobrado pelo servico
              </p>
            </div>

            {/* Duration */}
            <div>
              <label className="label flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                Duracao estimada (horas)
              </label>
              <input
                className="input"
                type="number"
                value={form.estimatedHours || ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    estimatedHours: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  }))
                }
                min="1"
                placeholder="Ex: 3"
              />
              <p className="text-xs text-slate-400 mt-1">
                Tempo medio para conclusao do servico (opcional)
              </p>
            </div>
          </div>

          <div className="flex justify-between mt-6">
            <button onClick={handlePrevStep} className="btn btn-outline">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Anterior
            </button>
            <button onClick={handleNextStep} className="btn btn-primary">
              Proximo
              <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Media & Submit */}
      {currentStep === 4 && (
        <div className="card border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
            Imagens (opcional)
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Adicione imagens para ilustrar o seu servico.
          </p>

          <div className="space-y-4">
            {/* Image URLs */}
            <div>
              <label className="label flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4" />
                URL da imagem
              </label>
              <div className="flex gap-2">
                <input
                  className={`input flex-1 ${errors.imageUrl ? "border-red-400 dark:border-red-600" : ""}`}
                  value={imageUrlInput}
                  onChange={(e) => {
                    setImageUrlInput(e.target.value);
                    setErrors((prev) => ({ ...prev, imageUrl: "" }));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addImageUrl();
                    }
                  }}
                  placeholder="https://exemplo.com/imagem.jpg"
                />
                <button
                  type="button"
                  onClick={addImageUrl}
                  className="btn btn-outline btn-sm"
                  disabled={!imageUrlInput.trim()}
                >
                  Adicionar
                </button>
              </div>
              {errors.imageUrl && (
                <p className="text-xs text-red-500 mt-1">{errors.imageUrl}</p>
              )}
            </div>

            {/* Image previews */}
            {(form.images || []).length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {(form.images || []).map((url, index) => (
                  <div
                    key={index}
                    className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700"
                  >
                    <img
                      src={url}
                      alt={`Imagem ${index + 1}`}
                      className="w-full h-32 object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "/placeholder-service.jpg";
                      }}
                    />
                    <button
                      onClick={() => removeImage(url)}
                      className="absolute top-2 right-2 p-1 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 p-2">
                      <p className="text-[10px] text-white truncate">{url}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Summary */}
            <div className="mt-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
                Resumo do Servico
              </h3>
              <div className="space-y-2 text-sm">
                <p className="text-slate-600 dark:text-slate-400">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Categoria:
                  </span>{" "}
                  {getSelectedCategoryName()}
                </p>
                <p className="text-slate-600 dark:text-slate-400">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Titulo:
                  </span>{" "}
                  {form.title}
                </p>
                <p className="text-slate-600 dark:text-slate-400">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Valor:
                  </span>{" "}
                  R$ {form.price?.toFixed(2)}
                </p>
                {form.estimatedHours && (
                  <p className="text-slate-600 dark:text-slate-400">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      Duracao:
                    </span>{" "}
                    ~{form.estimatedHours}h
                  </p>
                )}
                {(form.tags || []).length > 0 && (
                  <p className="text-slate-600 dark:text-slate-400">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      Tags:
                    </span>{" "}
                    {(form.tags || []).join(", ")}
                  </p>
                )}
                <p className="text-slate-600 dark:text-slate-400">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Imagens:
                  </span>{" "}
                  {(form.images || []).length} adicionada(s)
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-between mt-6">
            <button onClick={handlePrevStep} className="btn btn-outline">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Anterior
            </button>
            <button
              onClick={handleSubmit}
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? "Criando..." : "Criar Servico"}
              {!submitting && <Check className="w-4 h-4 ml-1" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateService;
```

**Step 2: Testar a compilacao**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: Sem erros no arquivo CreateService.tsx

**Step 3: Commit**

```bash
git add frontend/src/pages/professional/CreateService.tsx
git commit -m "feat: redesign CreateService with step-by-step wizard, categories hierarchy, tags chips"
```

---

## Task 5: Melhorias visuais no Layout/Navegacao

**Analise das melhorias necessarias:**

1. **Navegacao confusa para profissionais:** "Meus Servicos" (orders) e "Catalogo" (catalogo) tem nomes ambiguos. Ja corrigido na Task 3.

2. **Icones inconsistentes:** "Catalogo" usa o icone `Award` (trofeu) que nao representa servicos. Melhor usar `Package` ou `LayoutGrid`.

3. **Mobile navigation sem destaque visual:** O menu mobile nao tem separadores claros entre secoes.

4. **Footer muito extenso:** Muitos links no footer que nao existem (404). Simplificar.

**Files:**
- Modify: `frontend/src/components/Layout.tsx`

**Step 1: Atualizar icones na navegacao**

No `Layout.tsx`, alterar os icones do profissional:

```typescript
// Importar novos icones:
import { ..., LayoutGrid } from "lucide-react";

// Alterar o icone de "Meus Servicos" (antigo "Catalogo"):
{
  path: "/professional/catalog",
  label: "Meus Servicos",
  icon: <LayoutGrid size={20} />,
},
```

**Step 2: Melhorar a separacao visual do menu mobile**

Adicionar divisor visual entre secoes no menu mobile. No `Layout.tsx`, entre as secoes de navegacao do profissional, adicionar um `<div className="border-t border-slate-200 dark:border-slate-700 my-1" />`.

**Step 3: Simplificar footer**

Remover links do footer que levam a paginas 404 (como `/blog`, `/careers`, `/press`, `/about`, `/cookies`, `/terms`, `/privacy`, `/help`, `/contact`, `/faq`, `/disputes`). Manter apenas links funcionais.

**Step 4: Commit**

```bash
git add frontend/src/components/Layout.tsx
git commit -m "ui: improve navigation icons, mobile menu separators, simplify footer"
```

---

## Task 6: Melhorias visuais no ServiceCard

**Melhorias identificadas:**

1. **Imagem placeholder quebrada:** Quando nao ha imagem, tenta carregar `/placeholder-service.jpg` que pode nao existir. Melhor usar um placeholder inline com icone.

2. **Informacoes de preco sem destaque suficiente:** O "a partir de" e muito pequeno.

3. **Responsividade do card em grid:** Melhorar o layout em telas menores.

**Files:**
- Modify: `frontend/src/components/services/ServiceCard.tsx`

**Step 1: Melhorar placeholder de imagem**

Quando nao ha imagem, mostrar um placeholder visual com gradiente e icone em vez de tentar carregar uma imagem inexistente.

No `ServiceCard.tsx`, alterar o bloco de imagem:

```tsx
{/* Imagem */}
<div className="relative h-48 overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700">
  {imageUrl !== "/placeholder-service.jpg" ? (
    <img
      src={imageUrl}
      alt={title}
      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = 'none';
        (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
      }}
    />
  ) : null}
  <div className={`${imageUrl !== "/placeholder-service.jpg" ? "hidden" : ""} w-full h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500`}>
    <Briefcase className="w-10 h-10 mb-2" />
    <span className="text-xs">Sem imagem</span>
  </div>
  ...
```

**Step 2: Commit**

```bash
git add frontend/src/components/services/ServiceCard.tsx
git commit -m "ui: improve ServiceCard image placeholder and visual polish"
```

---

## Task 7: Melhorias visuais na pagina de Catalogo (ServiceSearch)

**Melhorias identificadas:**

1. **Titulo generico demais:** "Meu Catalogo de Servicos" -> ja corrigido na Task 3.

2. **Botao "Criar novo servico" pouco destacado:** Melhorar com icone e gradiente.

3. **Stats de contagem pouco visivel:** Mostrar contagem de servicos ativos/pausados.

4. **Empty state generico:** Quando nao tem servicos, mostrar call-to-action mais engajante.

**Files:**
- Modify: `frontend/src/pages/services/ServiceSearch.tsx`

**Step 1: Melhorar o header do catalogo profissional**

No `ServiceSearch.tsx`, alterar o bloco `showProfessionalCatalog` (linhas 265-279):

```tsx
{showProfessionalCatalog && (
  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
        Meus Servicos
      </h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        {totalItems > 0
          ? `${totalItems} servico${totalItems > 1 ? "s" : ""} cadastrado${totalItems > 1 ? "s" : ""}`
          : "Nenhum servico cadastrado ainda"}
      </p>
    </div>
    <Link
      to="/professional/catalog/new"
      className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-lg font-medium text-sm shadow-sm hover:shadow-md transition-all no-underline"
    >
      <PlusCircle className="w-4 h-4" />
      Novo Servico
    </Link>
  </div>
)}
```

Adicionar `PlusCircle` aos imports do lucide-react.

**Step 2: Melhorar empty state para profissionais**

Quando o profissional nao tem servicos, mostrar um card engajante:

```tsx
// No bloco de "Nenhum servico encontrado" (linhas 527-535), adicionar condicao:
) : services.length === 0 ? (
  showProfessionalCatalog ? (
    <div className="text-center py-16">
      <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
        <PlusCircle className="w-10 h-10 text-primary-600 dark:text-primary-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
        Comece a oferecer seus servicos
      </h3>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
        Cadastre seu primeiro servico para que clientes possam encontrar e contratar voce.
      </p>
      <Link
        to="/professional/catalog/new"
        className="inline-flex items-center gap-2 btn btn-primary"
      >
        <PlusCircle className="w-4 h-4" />
        Criar primeiro servico
      </Link>
    </div>
  ) : (
    <EmptyState ... />
  )
```

**Step 3: Commit**

```bash
git add frontend/src/pages/services/ServiceSearch.tsx
git commit -m "ui: improve catalog header, CTA button, and professional empty state"
```

---

## Task 8: Verificacao final e teste integrado

**Step 1: Reiniciar o backend**

O backend precisa ser reiniciado para carregar as mudancas nos controllers.

Run: `cd /home/levybonito/faztudo-main/backend && npm run dev`
(ou o script que estiver usando para desenvolvimento)

**Step 2: Testar endpoint de listagem**

Run: `curl -s "http://localhost:3001/api/services" | python3 -c "import sys,json; d=json.load(sys.stdin); s=d['data']['services'][0]; print('images type:', type(s['images']), 'tags type:', type(s['tags']))"`
Expected: `images type: <class 'list'> tags type: <class 'list'>`

**Step 3: Testar endpoint com busca**

Run: `curl -s "http://localhost:3001/api/services?search=eletrica" | python3 -c "import sys,json; d=json.load(sys.stdin); print('success:', d['success'], 'total:', d['data']['pagination']['total'])"`
Expected: `success: True total: [numero > 0]`

**Step 4: Testar frontend**

Abrir `http://localhost:5173` no navegador, fazer login como profissional, clicar em "Meus Servicos" na navegacao e verificar:
- Pagina carrega sem "Network Error"
- Servicos sao exibidos corretamente
- Nome na nav e "Meus Servicos"
- Botao "Novo Servico" funciona e abre o formulario step-by-step

**Step 5: Commit final**

```bash
git add -A
git commit -m "chore: final integration verification for catalog improvements"
```

---

## Resumo das Mudancas

| # | Descricao | Arquivos | Tipo |
|---|-----------|----------|------|
| 1 | Fix Network Error (SQLite + Helmet) | `listingController.ts`, `serviceController.ts`, `index.ts` | Bug fix |
| 2 | Fix JSON parsing (images/tags) | `listingController.ts`, `serviceController.ts` | Bug fix |
| 3 | Renomear "Catalogo" -> "Meus Servicos" | `Layout.tsx`, `ServiceSearch.tsx` | Refactor |
| 4 | Formulario step-by-step "Novo Servico" | `CreateService.tsx` | Feature |
| 5 | Melhorias visuais no Layout | `Layout.tsx` | UI |
| 6 | Melhorias no ServiceCard | `ServiceCard.tsx` | UI |
| 7 | Melhorias no catalogo profissional | `ServiceSearch.tsx` | UI |
| 8 | Verificacao e testes | - | QA |
