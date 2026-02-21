import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft,
  Loader,
  Save,
  Plus,
  Trash2,
  Info,
  Layout,
} from "lucide-react";
import { companyStorefrontService } from "../../services/companyStorefrontService";
import type {
  CompanyStorefrontSection,
  CompanyStorefrontBlock,
  StorefrontBlockType,
} from "../../types";

// ─── Local Types ──────────────────────────────────────────────────────────────

type BlockState = {
  type: StorefrontBlockType;
  isActive: boolean;
  // HERO + ABOUT
  headline: string;
  // HERO-specific
  subText: string;
  heroImageUrl: string;
  bgColor: string;
  // ABOUT-specific
  body: string;
};

const BLOCK_LABELS: Record<StorefrontBlockType, string> = {
  HERO: "Destaque (Hero)",
  ABOUT: "Sobre a Empresa",
  TESTIMONIALS: "Depoimentos",
};

const BLOCK_TYPES: StorefrontBlockType[] = ["HERO", "ABOUT", "TESTIMONIALS"];

// ─── Block Card ───────────────────────────────────────────────────────────────

const BlockCard: React.FC<{
  state: BlockState;
  saving: boolean;
  error: string | null;
  onChange: (patch: Partial<BlockState>) => void;
  onSave: () => void;
}> = ({ state, saving, error, onChange, onSave }) => (
  <div className="card p-4 flex flex-col gap-3">
    <div className="flex items-center justify-between">
      <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
        {BLOCK_LABELS[state.type]}
      </h3>
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <span className="text-xs text-slate-500 dark:text-slate-400">Ativo</span>
        <input
          type="checkbox"
          checked={state.isActive}
          onChange={(e) => onChange({ isActive: e.target.checked })}
          className="w-4 h-4 accent-blue-600"
        />
      </label>
    </div>

    {/* Título principal — todos os tipos */}
    <div>
      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
        Título principal
      </label>
      <input
        type="text"
        value={state.headline}
        onChange={(e) => onChange({ headline: e.target.value })}
        placeholder={`Ex: ${state.type === "HERO" ? "Soluções que transformam" : state.type === "ABOUT" ? "Quem somos" : "O que dizem sobre nós"}`}
        className="input w-full text-sm"
      />
    </div>

    {/* HERO: subtítulo, imagem, cor de fundo */}
    {state.type === "HERO" && (
      <>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Subtítulo
          </label>
          <input
            type="text"
            value={state.subText}
            onChange={(e) => onChange({ subText: e.target.value })}
            placeholder="Ex: Sua empresa de confiança há 10 anos"
            className="input w-full text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            URL da imagem de destaque
          </label>
          <input
            type="url"
            value={state.heroImageUrl}
            onChange={(e) => onChange({ heroImageUrl: e.target.value })}
            placeholder="https://exemplo.com/banner.jpg"
            className="input w-full text-sm"
          />
          {state.heroImageUrl && (
            <img
              src={state.heroImageUrl}
              alt="Preview hero"
              className="mt-2 w-full h-24 object-cover rounded-lg border border-slate-200 dark:border-slate-700"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Cor de fundo (hex)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={state.bgColor || "#ffffff"}
              onChange={(e) => onChange({ bgColor: e.target.value })}
              className="w-9 h-9 rounded border border-slate-300 cursor-pointer p-0.5"
            />
            <input
              type="text"
              value={state.bgColor}
              onChange={(e) => onChange({ bgColor: e.target.value })}
              placeholder="#ffffff"
              className="input flex-1 text-sm font-mono"
              maxLength={7}
            />
          </div>
        </div>
      </>
    )}

    {/* ABOUT: corpo de texto */}
    {state.type === "ABOUT" && (
      <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
          Texto sobre a empresa
        </label>
        <textarea
          value={state.body}
          onChange={(e) => onChange({ body: e.target.value })}
          placeholder="Conte a história da sua empresa, valores, missão e diferenciais..."
          className="input w-full text-sm min-h-28 resize-y"
          maxLength={2000}
        />
        <p className="text-xs text-slate-400 text-right mt-0.5">
          {state.body.length}/2000
        </p>
      </div>
    )}

    {error && (
      <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
    )}

    <button
      onClick={onSave}
      disabled={saving}
      className="btn btn-primary btn-sm flex items-center gap-1.5 self-end"
    >
      {saving ? (
        <Loader className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Save className="h-3.5 w-3.5" />
      )}
      Salvar
    </button>
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

const StorefrontEditor: React.FC = () => {
  const navigate = useNavigate();

  // Loading / error
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Blocks
  const [blocks, setBlocks] = useState<BlockState[]>(
    BLOCK_TYPES.map((type) => ({
      type,
      isActive: false,
      headline: "",
      subText: "",
      heroImageUrl: "",
      bgColor: "",
      body: "",
    })),
  );
  const [blockSaving, setBlockSaving] = useState<
    Record<StorefrontBlockType, boolean>
  >({ HERO: false, ABOUT: false, TESTIMONIALS: false });
  const [blockErrors, setBlockErrors] = useState<
    Record<StorefrontBlockType, string | null>
  >({ HERO: null, ABOUT: null, TESTIMONIALS: null });

  // Sections
  const [sections, setSections] = useState<CompanyStorefrontSection[]>([]);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [addingSection, setAddingSection] = useState(false);
  const [addSectionError, setAddSectionError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    companyStorefrontService
      .getEditor()
      .then((res) => {
        const profile = res.data as any; // eslint-disable-line @typescript-eslint/no-explicit-any

        // Hydrate blocks from backend data
        const serverBlocks: CompanyStorefrontBlock[] =
          profile?.storefrontBlocks ?? [];

        setBlocks(
          BLOCK_TYPES.map((type) => {
            const found = serverBlocks.find((b) => b.type === type);
            const content = found?.content as Record<string, unknown> | undefined;
            return {
              type,
              isActive: found?.isActive ?? false,
              headline: (content?.headline as string) ?? "",
              subText: (content?.subText as string) ?? "",
              heroImageUrl: (content?.heroImageUrl as string) ?? "",
              bgColor: (content?.bgColor as string) ?? "",
              body: (content?.body as string) ?? "",
            };
          }),
        );

        // Hydrate sections
        setSections(profile?.storefrontSections ?? []);
      })
      .catch((err) => {
        setLoadError(
          err?.response?.data?.message ?? "Erro ao carregar dados da vitrine.",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  // ── Block handlers ────────────────────────────────────────────────────────

  const handleBlockChange = (
    type: StorefrontBlockType,
    patch: Partial<BlockState>,
  ) => {
    setBlocks((prev) =>
      prev.map((b) => (b.type === type ? { ...b, ...patch } : b)),
    );
  };

  const handleBlockSave = async (type: StorefrontBlockType) => {
    const block = blocks.find((b) => b.type === type);
    if (!block) return;

    setBlockSaving((s) => ({ ...s, [type]: true }));
    setBlockErrors((e) => ({ ...e, [type]: null }));

    try {
      await companyStorefrontService.upsertBlock({
        type,
        order: BLOCK_TYPES.indexOf(type),
        isActive: block.isActive,
        content: {
          headline: block.headline,
          ...(type === "HERO" && {
            subText: block.subText,
            heroImageUrl: block.heroImageUrl,
            bgColor: block.bgColor,
          }),
          ...(type === "ABOUT" && {
            body: block.body,
          }),
        },
      });
    } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      setBlockErrors((e) => ({
        ...e,
        [type]: err?.response?.data?.message ?? "Erro ao salvar bloco.",
      }));
    } finally {
      setBlockSaving((s) => ({ ...s, [type]: false }));
    }
  };

  // ── Section handlers ──────────────────────────────────────────────────────

  const handleAddSection = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newSectionTitle.trim();
    if (!title) return;

    setAddingSection(true);
    setAddSectionError(null);

    try {
      const res = await companyStorefrontService.createSection({
        title,
        order: sections.length,
      });
      setSections((prev) => [...prev, res.data]);
      setNewSectionTitle("");
    } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      setAddSectionError(
        err?.response?.data?.message ?? "Erro ao criar seção.",
      );
    } finally {
      setAddingSection(false);
    }
  };

  const handleDeleteSection = async (sectionId: number) => {
    if (!window.confirm("Excluir esta seção? Esta ação não pode ser desfeita."))
      return;

    setDeletingId(sectionId);
    try {
      await companyStorefrontService.deleteSection(sectionId);
      setSections((prev) => prev.filter((s) => s.id !== sectionId));
    } catch {
      // silently keep section on error
    } finally {
      setDeletingId(null);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="alert alert-error">
          <span>{loadError}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => navigate(-1)}
          className="btn btn-ghost btn-sm flex items-center gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>
        <div className="flex items-center gap-2">
          <Layout className="h-6 w-6 text-blue-600" />
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Editor de Vitrine
          </h1>
        </div>
      </div>

      {/* ── Blocks Panel ─────────────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-4">
          Blocos de Conteúdo
        </h2>
        <div className="grid grid-cols-1 gap-4">
          {blocks.map((block) => (
            <BlockCard
              key={block.type}
              state={block}
              saving={blockSaving[block.type]}
              error={blockErrors[block.type]}
              onChange={(patch) => handleBlockChange(block.type, patch)}
              onSave={() => handleBlockSave(block.type)}
            />
          ))}
        </div>

        {/* Testimonials note */}
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-4 py-3">
          <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 dark:text-blue-300">
            <strong>Depoimentos fixados:</strong> Para escolher quais avaliações
            aparecem na vitrine, acesse a página de cada avaliação e use a opção
            "Fixar no storefront".
          </p>
        </div>
      </section>

      {/* ── Sections Panel ───────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">
            Seções de Serviços
          </h2>
          <span className="badge badge-secondary text-xs">
            {sections.length} seção(ões)
          </span>
        </div>

        {/* Section list */}
        {sections.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Nenhuma seção criada ainda. Adicione uma abaixo.
          </p>
        ) : (
          <ul className="space-y-2 mb-4">
            {sections.map((section) => (
              <li
                key={section.id}
                className="card px-4 py-3 flex items-center justify-between"
              >
                <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                  {section.title}
                </span>
                <button
                  onClick={() => handleDeleteSection(section.id)}
                  disabled={deletingId === section.id}
                  className="btn btn-ghost btn-sm text-red-500 hover:text-red-700 flex items-center gap-1"
                  aria-label={`Excluir seção ${section.title}`}
                >
                  {deletingId === section.id ? (
                    <Loader className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Excluir
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Add section form */}
        <form
          onSubmit={handleAddSection}
          className="card p-4 flex flex-col gap-3"
        >
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Adicionar nova seção
          </h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={newSectionTitle}
              onChange={(e) => setNewSectionTitle(e.target.value)}
              placeholder="Ex: Limpeza Residencial"
              className="input flex-1 text-sm"
              maxLength={80}
            />
            <button
              type="submit"
              disabled={addingSection || !newSectionTitle.trim()}
              className="btn btn-primary btn-sm flex items-center gap-1.5"
            >
              {addingSection ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Adicionar
            </button>
          </div>
          {addSectionError && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {addSectionError}
            </p>
          )}
        </form>
      </section>
    </div>
  );
};

export default StorefrontEditor;
