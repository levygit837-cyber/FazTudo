import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router";
import {
  ArrowLeft,
  Store,
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  ExternalLink,
  ToggleLeft,
  ToggleRight,
  Package,
  Settings,
  Layers,
  GripVertical,
} from "lucide-react";
import { useToast } from "../../context/ToastContext";
import {
  getMyStorefront,
  updateStorefront,
  publishStorefront,
  listMyCategories,
  createCategory,
  updateCategory,
  reorderCategories,
  deleteCategory,
  createService as apiCreateService,
  updateService as apiUpdateService,
  deleteService as apiDeleteService,
  createOption as apiCreateOption,
  updateOption as apiUpdateOption,
  deleteOption as apiDeleteOption,
} from "../../services/storefrontService";
import {
  getMainCategories,
  CategoryWithCounts,
} from "../../services/categoryService";
import {
  Storefront,
  StorefrontCategory,
  StorefrontService,
  StorefrontServiceOption,
} from "../../types";
import { formatCurrency } from "../../utils/formatters";

// ==================== MODAL COMPONENT ====================

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ open, title, onClose, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            ✕
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
};

// ==================== OPTION ITEM ====================

interface OptionItemProps {
  option: StorefrontServiceOption;
  onEdit: (option: StorefrontServiceOption) => void;
  onDelete: (optionId: number) => void;
}

const OptionItem: React.FC<OptionItemProps> = ({ option, onEdit, onDelete }) => (
  <div className="flex items-center justify-between py-1.5 px-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-sm">
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-slate-700 dark:text-slate-300 truncate">
        {option.name}
      </span>
      {option.price != null && (
        <span className="text-xs text-primary-600 dark:text-primary-400 font-medium shrink-0">
          +{formatCurrency(option.price)}
        </span>
      )}
      {option.isDefault && (
        <span className="text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-1.5 py-0.5 rounded shrink-0">
          Padrao
        </span>
      )}
    </div>
    <div className="flex items-center gap-1 shrink-0 ml-2">
      <button
        onClick={() => onEdit(option)}
        className="p-1 text-slate-400 hover:text-primary-500"
        title="Editar"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => onDelete(option.id)}
        className="p-1 text-slate-400 hover:text-red-500"
        title="Remover"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
);

// ==================== SERVICE CARD ====================

interface ServiceCardProps {
  service: StorefrontService;
  onEdit: (service: StorefrontService) => void;
  onDelete: (serviceId: number) => void;
  onToggleAvailable: (service: StorefrontService) => void;
  onAddOption: (serviceId: number) => void;
  onEditOption: (option: StorefrontServiceOption) => void;
  onDeleteOption: (optionId: number) => void;
}

const ServiceCard: React.FC<ServiceCardProps> = ({
  service,
  onEdit,
  onDelete,
  onToggleAvailable,
  onAddOption,
  onEditOption,
  onDeleteOption,
}) => {
  const [expanded, setExpanded] = useState(false);
  const options = service.options || [];

  return (
    <div
      className={`border rounded-lg p-3 ${
        service.isAvailable
          ? "border-slate-200 dark:border-slate-700"
          : "border-dashed border-slate-300 dark:border-slate-600 opacity-60"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-slate-900 dark:text-slate-100 truncate">
              {service.title}
            </h4>
            {!service.isAvailable && (
              <span className="text-xs bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded shrink-0">
                Indisponivel
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm font-semibold text-primary-600 dark:text-primary-400">
              {formatCurrency(service.price)}
            </span>
            {options.length > 0 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-0.5"
              >
                {options.length} opciona{options.length === 1 ? "l" : "is"}
                <ChevronRight
                  className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`}
                />
              </button>
            )}
          </div>
          {service.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
              {service.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onToggleAvailable(service)}
            className={`p-1.5 rounded-lg ${
              service.isAvailable
                ? "text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20"
                : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
            }`}
            title={service.isAvailable ? "Desativar" : "Ativar"}
          >
            {service.isAvailable ? (
              <ToggleRight className="w-4 h-4" />
            ) : (
              <ToggleLeft className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => onEdit(service)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20"
            title="Editar"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(service.id)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
            title="Remover"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Options */}
      {expanded && options.length > 0 && (
        <div className="mt-2 space-y-1">
          {options.map((opt) => (
            <OptionItem
              key={opt.id}
              option={opt}
              onEdit={onEditOption}
              onDelete={onDeleteOption}
            />
          ))}
        </div>
      )}

      {/* Add option button */}
      <div className="mt-2">
        <button
          onClick={() => onAddOption(service.id)}
          className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> Adicionar opcional
        </button>
      </div>
    </div>
  );
};

// ==================== CATEGORY SECTION ====================

interface CategorySectionProps {
  category: StorefrontCategory;
  index: number;
  total: number;
  onEditCategory: (cat: StorefrontCategory) => void;
  onDeleteCategory: (catId: number) => void;
  onMoveCategory: (catId: number, direction: "up" | "down") => void;
  onAddService: (categoryId: number) => void;
  onEditService: (service: StorefrontService) => void;
  onDeleteService: (serviceId: number) => void;
  onToggleServiceAvailable: (service: StorefrontService) => void;
  onAddOption: (serviceId: number) => void;
  onEditOption: (option: StorefrontServiceOption) => void;
  onDeleteOption: (optionId: number) => void;
}

const CategorySection: React.FC<CategorySectionProps> = ({
  category,
  index,
  total,
  onEditCategory,
  onDeleteCategory,
  onMoveCategory,
  onAddService,
  onEditService,
  onDeleteService,
  onToggleServiceAvailable,
  onAddOption,
  onEditOption,
  onDeleteOption,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const services = category.services || [];

  return (
    <div className="card overflow-hidden">
      {/* Category header */}
      <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform ${collapsed ? "-rotate-90" : ""}`}
            />
          </button>
          <GripVertical className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
              {category.name}
            </h3>
            <span className="text-xs text-slate-500">
              {services.length} servico{services.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onMoveCategory(category.id, "up")}
            disabled={index === 0}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-30"
            title="Mover para cima"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            onClick={() => onMoveCategory(category.id, "down")}
            disabled={index === total - 1}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-30"
            title="Mover para baixo"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <button
            onClick={() => onEditCategory(category)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20"
            title="Editar"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDeleteCategory(category.id)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
            title="Remover"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Services list */}
      {!collapsed && (
        <div className="p-4 space-y-3">
          {services.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">
              Nenhum servico nesta categoria
            </p>
          ) : (
            services.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                onEdit={onEditService}
                onDelete={onDeleteService}
                onToggleAvailable={onToggleServiceAvailable}
                onAddOption={onAddOption}
                onEditOption={onEditOption}
                onDeleteOption={onDeleteOption}
              />
            ))
          )}

          <button
            onClick={() => onAddService(category.id)}
            className="w-full py-2 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-500 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400 flex items-center justify-center gap-1 transition-colors"
          >
            <Plus className="w-4 h-4" /> Adicionar servico
          </button>
        </div>
      )}
    </div>
  );
};

// ==================== MAIN PAGE ====================

const StorefrontManager: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();

  // State
  const [storefront, setStorefront] = useState<Storefront | null>(null);
  const [categories, setCategories] = useState<StorefrontCategory[]>([]);
  const [mainCategories, setMainCategories] = useState<CategoryWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modal states
  const [categoryModal, setCategoryModal] = useState<{
    open: boolean;
    editing?: StorefrontCategory;
  }>({ open: false });
  const [serviceModal, setServiceModal] = useState<{
    open: boolean;
    categoryId?: number;
    editing?: StorefrontService;
  }>({ open: false });
  const [optionModal, setOptionModal] = useState<{
    open: boolean;
    serviceId?: number;
    editing?: StorefrontServiceOption;
  }>({ open: false });
  const [settingsModal, setSettingsModal] = useState(false);

  // Form states
  const [catForm, setCatForm] = useState({ name: "" });
  const [serviceForm, setServiceForm] = useState({
    title: "",
    description: "",
    price: "",
    categoryId: 0,
  });
  const [optionForm, setOptionForm] = useState({
    name: "",
    price: "",
    isDefault: false,
    serviceId: 0,
  });
  const [settingsForm, setSettingsForm] = useState({
    name: "",
    description: "",
    mainCategoryId: "",
  });

  // ========== LOAD DATA ==========

  const loadStorefront = useCallback(async () => {
    try {
      setLoading(true);
      const sf = await getMyStorefront();
      if (!sf) {
        navigate("/professional/vitrine/setup", { replace: true });
        return;
      }
      setStorefront(sf);
      setSettingsForm({
        name: sf.name,
        description: sf.description || "",
        mainCategoryId: sf.mainCategoryId?.toString() || "",
      });
    } catch {
      toast.error("Erro ao carregar vitrine");
    } finally {
      setLoading(false);
    }
  }, [navigate, toast]);

  const loadCategories = useCallback(async () => {
    try {
      const cats = await listMyCategories();
      setCategories(cats);
    } catch {
      // silently fail — storefront load handles error display
    }
  }, []);

  useEffect(() => {
    loadStorefront();
    loadCategories();
  }, [loadStorefront, loadCategories]);

  useEffect(() => {
    const loadMain = async () => {
      try {
        const result = await getMainCategories(undefined, 50);
        setMainCategories(result.categories);
      } catch {
        // ok
      }
    };
    loadMain();
  }, []);

  // ========== CATEGORY CRUD ==========

  const openCategoryModal = (editing?: StorefrontCategory) => {
    setCatForm({ name: editing?.name || "" });
    setCategoryModal({ open: true, editing });
  };

  const handleSaveCategory = async () => {
    if (!catForm.name.trim()) {
      toast.warning("Informe o nome da categoria");
      return;
    }
    setSaving(true);
    try {
      if (categoryModal.editing) {
        await updateCategory(categoryModal.editing.id, { name: catForm.name });
        toast.success("Categoria atualizada");
      } else {
        await createCategory({ name: catForm.name });
        toast.success("Categoria criada");
      }
      setCategoryModal({ open: false });
      await loadCategories();
    } catch {
      toast.error("Erro ao salvar categoria");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (catId: number) => {
    const cat = categories.find((c) => c.id === catId);
    const serviceCount = cat?.services?.length || 0;
    const msg =
      serviceCount > 0
        ? `Remover "${cat?.name}" e seus ${serviceCount} servico(s)?`
        : `Remover "${cat?.name}"?`;
    if (!window.confirm(msg)) return;

    try {
      await deleteCategory(catId);
      toast.success("Categoria removida");
      await loadCategories();
    } catch {
      toast.error("Erro ao remover categoria");
    }
  };

  const handleMoveCategory = async (catId: number, direction: "up" | "down") => {
    const idx = categories.findIndex((c) => c.id === catId);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= categories.length) return;

    const newOrder = [...categories];
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx]!, newOrder[idx]!];

    // Optimistic update
    setCategories(newOrder);

    try {
      await reorderCategories({
        categoryIds: newOrder.map((c) => c.id),
      });
    } catch {
      toast.error("Erro ao reordenar");
      await loadCategories();
    }
  };

  // ========== SERVICE CRUD ==========

  const openServiceModal = (categoryId: number, editing?: StorefrontService) => {
    setServiceForm({
      title: editing?.title || "",
      description: editing?.description || "",
      price: editing?.price?.toString() || "",
      categoryId: editing?.categoryId || categoryId,
    });
    setServiceModal({ open: true, categoryId, editing });
  };

  const handleSaveService = async () => {
    if (!serviceForm.title.trim()) {
      toast.warning("Informe o titulo do servico");
      return;
    }
    const price = parseFloat(serviceForm.price);
    if (isNaN(price) || price < 0) {
      toast.warning("Informe um preco valido");
      return;
    }

    setSaving(true);
    try {
      if (serviceModal.editing) {
        await apiUpdateService(serviceModal.editing.id, {
          title: serviceForm.title,
          description: serviceForm.description || undefined,
          price,
          categoryId: serviceForm.categoryId,
        });
        toast.success("Servico atualizado");
      } else {
        await apiCreateService({
          categoryId: serviceForm.categoryId,
          title: serviceForm.title,
          description: serviceForm.description || undefined,
          price,
        });
        toast.success("Servico criado");
      }
      setServiceModal({ open: false });
      await loadCategories();
    } catch {
      toast.error("Erro ao salvar servico");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteService = async (serviceId: number) => {
    if (!window.confirm("Remover este servico?")) return;
    try {
      await apiDeleteService(serviceId);
      toast.success("Servico removido");
      await loadCategories();
    } catch {
      toast.error("Erro ao remover servico");
    }
  };

  const handleToggleServiceAvailable = async (service: StorefrontService) => {
    try {
      await apiUpdateService(service.id, { isAvailable: !service.isAvailable });
      toast.success(
        service.isAvailable ? "Servico desativado" : "Servico ativado",
      );
      await loadCategories();
    } catch {
      toast.error("Erro ao atualizar servico");
    }
  };

  // ========== OPTION CRUD ==========

  const openOptionModal = (serviceId: number, editing?: StorefrontServiceOption) => {
    setOptionForm({
      name: editing?.name || "",
      price: editing?.price?.toString() || "",
      isDefault: editing?.isDefault || false,
      serviceId: editing?.serviceId || serviceId,
    });
    setOptionModal({ open: true, serviceId, editing });
  };

  const handleSaveOption = async () => {
    if (!optionForm.name.trim()) {
      toast.warning("Informe o nome do opcional");
      return;
    }

    const price = optionForm.price ? parseFloat(optionForm.price) : undefined;
    if (optionForm.price && (isNaN(price!) || price! < 0)) {
      toast.warning("Informe um preco valido");
      return;
    }

    setSaving(true);
    try {
      if (optionModal.editing) {
        await apiUpdateOption(optionModal.editing.id, {
          name: optionForm.name,
          price: price ?? undefined,
          isDefault: optionForm.isDefault,
        });
        toast.success("Opcional atualizado");
      } else {
        await apiCreateOption({
          serviceId: optionForm.serviceId,
          name: optionForm.name,
          price: price ?? undefined,
          isDefault: optionForm.isDefault,
        });
        toast.success("Opcional criado");
      }
      setOptionModal({ open: false });
      await loadCategories();
    } catch {
      toast.error("Erro ao salvar opcional");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOption = async (optionId: number) => {
    if (!window.confirm("Remover este opcional?")) return;
    try {
      await apiDeleteOption(optionId);
      toast.success("Opcional removido");
      await loadCategories();
    } catch {
      toast.error("Erro ao remover opcional");
    }
  };

  // ========== STOREFRONT SETTINGS ==========

  const handleSaveSettings = async () => {
    if (!settingsForm.name.trim()) {
      toast.warning("Informe o nome da vitrine");
      return;
    }
    setSaving(true);
    try {
      await updateStorefront({
        name: settingsForm.name,
        description: settingsForm.description || undefined,
        mainCategoryId: settingsForm.mainCategoryId
          ? parseInt(settingsForm.mainCategoryId, 10)
          : undefined,
      });
      toast.success("Vitrine atualizada");
      setSettingsModal(false);
      await loadStorefront();
    } catch {
      toast.error("Erro ao atualizar vitrine");
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async () => {
    if (!storefront) return;
    const newPublished = !storefront.isPublished;

    setSaving(true);
    try {
      await publishStorefront(newPublished);
      toast.success(
        newPublished ? "Vitrine publicada!" : "Vitrine despublicada",
      );
      await loadStorefront();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || "Erro ao alterar publicacao";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // ========== RENDER ==========

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (!storefront) return null;

  const totalServices = categories.reduce(
    (sum, cat) => sum + (cat.services?.length || 0),
    0,
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-800">
      <div className="container mx-auto px-4 py-6 max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/professional/dashboard")}
              className="w-9 h-9 rounded-lg border border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                Minha Vitrine
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {storefront.name}
              </p>
            </div>
          </div>
          <button
            onClick={() => setSettingsModal(true)}
            className="w-9 h-9 rounded-lg border border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
            title="Configuracoes"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* Status bar */}
        <div className="card p-4 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div
                  className={`w-3 h-3 rounded-full ${
                    storefront.isPublished
                      ? "bg-green-500"
                      : "bg-slate-300 dark:bg-slate-600"
                  }`}
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  {storefront.isPublished ? "Publicada" : "Rascunho"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-slate-500">
                <Layers className="w-4 h-4" />
                {categories.length} categoria{categories.length !== 1 ? "s" : ""}
              </div>
              <div className="flex items-center gap-1.5 text-sm text-slate-500">
                <Package className="w-4 h-4" />
                {totalServices} servico{totalServices !== 1 ? "s" : ""}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {storefront.isPublished && storefront.slug && (
                <Link
                  to={`/explorar/${storefront.slug}`}
                  target="_blank"
                  className="btn btn-sm flex items-center gap-1 text-xs border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Ver vitrine
                </Link>
              )}
              <button
                onClick={handleTogglePublish}
                disabled={saving}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  storefront.isPublished
                    ? "bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-500"
                    : "bg-green-500 text-white hover:bg-green-600"
                }`}
              >
                {storefront.isPublished ? (
                  <>
                    <EyeOff className="w-4 h-4" /> Despublicar
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" /> Publicar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Categories + Services */}
        <div className="space-y-4 mb-6">
          {categories.length === 0 ? (
            <div className="card p-8 text-center">
              <Store className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-1">
                Nenhuma categoria ainda
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                Crie categorias para organizar seus servicos
              </p>
              <button
                onClick={() => openCategoryModal()}
                className="btn btn-primary inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Criar primeira categoria
              </button>
            </div>
          ) : (
            categories.map((cat, idx) => (
              <CategorySection
                key={cat.id}
                category={cat}
                index={idx}
                total={categories.length}
                onEditCategory={openCategoryModal}
                onDeleteCategory={handleDeleteCategory}
                onMoveCategory={handleMoveCategory}
                onAddService={(catId) => openServiceModal(catId)}
                onEditService={(svc) => openServiceModal(svc.categoryId, svc)}
                onDeleteService={handleDeleteService}
                onToggleServiceAvailable={handleToggleServiceAvailable}
                onAddOption={(svcId) => openOptionModal(svcId)}
                onEditOption={(opt) => openOptionModal(opt.serviceId, opt)}
                onDeleteOption={handleDeleteOption}
              />
            ))
          )}
        </div>

        {/* Add category button */}
        {categories.length > 0 && (
          <button
            onClick={() => openCategoryModal()}
            className="w-full py-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-slate-500 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400 flex items-center justify-center gap-2 transition-colors"
          >
            <Plus className="w-5 h-5" /> Adicionar categoria
          </button>
        )}
      </div>

      {/* ==================== MODALS ==================== */}

      {/* Category Modal */}
      <Modal
        open={categoryModal.open}
        title={categoryModal.editing ? "Editar categoria" : "Nova categoria"}
        onClose={() => setCategoryModal({ open: false })}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Nome da categoria *
            </label>
            <input
              type="text"
              value={catForm.name}
              onChange={(e) => setCatForm({ name: e.target.value })}
              maxLength={100}
              placeholder="Ex: Instalacoes Eletricas"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setCategoryModal({ open: false })}
              className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveCategory}
              disabled={saving}
              className="btn btn-primary flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {categoryModal.editing ? "Salvar" : "Criar"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Service Modal */}
      <Modal
        open={serviceModal.open}
        title={serviceModal.editing ? "Editar servico" : "Novo servico"}
        onClose={() => setServiceModal({ open: false })}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Titulo *
            </label>
            <input
              type="text"
              value={serviceForm.title}
              onChange={(e) =>
                setServiceForm((p) => ({ ...p, title: e.target.value }))
              }
              maxLength={200}
              placeholder="Ex: Troca de disjuntor"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Descricao
            </label>
            <textarea
              value={serviceForm.description}
              onChange={(e) =>
                setServiceForm((p) => ({ ...p, description: e.target.value }))
              }
              rows={3}
              maxLength={1000}
              placeholder="Descreva o servico..."
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Preco (R$) *
            </label>
            <input
              type="number"
              value={serviceForm.price}
              onChange={(e) =>
                setServiceForm((p) => ({ ...p, price: e.target.value }))
              }
              min="0"
              step="0.01"
              placeholder="0.00"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          {/* Category selector (for editing, allow changing category) */}
          {serviceModal.editing && categories.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Categoria
              </label>
              <select
                value={serviceForm.categoryId}
                onChange={(e) =>
                  setServiceForm((p) => ({
                    ...p,
                    categoryId: parseInt(e.target.value, 10),
                  }))
                }
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setServiceModal({ open: false })}
              className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveService}
              disabled={saving}
              className="btn btn-primary flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {serviceModal.editing ? "Salvar" : "Criar"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Option Modal */}
      <Modal
        open={optionModal.open}
        title={optionModal.editing ? "Editar opcional" : "Novo opcional"}
        onClose={() => setOptionModal({ open: false })}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Nome do opcional *
            </label>
            <input
              type="text"
              value={optionForm.name}
              onChange={(e) =>
                setOptionForm((p) => ({ ...p, name: e.target.value }))
              }
              maxLength={200}
              placeholder="Ex: Casa inteira"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Preco adicional (R$)
            </label>
            <input
              type="number"
              value={optionForm.price}
              onChange={(e) =>
                setOptionForm((p) => ({ ...p, price: e.target.value }))
              }
              min="0"
              step="0.01"
              placeholder="Deixe vazio se sem custo extra"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="text-xs text-slate-400 mt-1">
              Valor adicional ao preco do servico
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isDefault"
              checked={optionForm.isDefault}
              onChange={(e) =>
                setOptionForm((p) => ({ ...p, isDefault: e.target.checked }))
              }
              className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
            />
            <label
              htmlFor="isDefault"
              className="text-sm text-slate-700 dark:text-slate-300"
            >
              Pre-selecionado por padrao
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setOptionModal({ open: false })}
              className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveOption}
              disabled={saving}
              className="btn btn-primary flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {optionModal.editing ? "Salvar" : "Criar"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Settings Modal */}
      <Modal
        open={settingsModal}
        title="Configuracoes da vitrine"
        onClose={() => setSettingsModal(false)}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Nome da vitrine *
            </label>
            <input
              type="text"
              value={settingsForm.name}
              onChange={(e) =>
                setSettingsForm((p) => ({ ...p, name: e.target.value }))
              }
              maxLength={100}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Descricao
            </label>
            <textarea
              value={settingsForm.description}
              onChange={(e) =>
                setSettingsForm((p) => ({ ...p, description: e.target.value }))
              }
              rows={3}
              maxLength={500}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
            />
            <p className="text-xs text-slate-400 mt-1">
              {settingsForm.description.length}/500
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Categoria principal
            </label>
            <select
              value={settingsForm.mainCategoryId}
              onChange={(e) =>
                setSettingsForm((p) => ({
                  ...p,
                  mainCategoryId: e.target.value,
                }))
              }
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Selecione...</option>
              {mainCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setSettingsModal(false)}
              className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="btn btn-primary flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Salvar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default StorefrontManager;
