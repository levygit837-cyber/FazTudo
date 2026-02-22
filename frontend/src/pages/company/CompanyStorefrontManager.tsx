import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft,
  Store,
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  Loader2,
  Eye,
  EyeOff,
  GripVertical,
  Layers,
  Package,
  Users,
  X,
} from "lucide-react";
import { useToast } from "../../context/ToastContext";
import { companyStorefrontService } from "../../services/companyStorefrontService";
import api from "../../services/api";
import { formatCurrency } from "../../utils/formatters";
import type {
  CompanyStorefrontSection,
  CompanyStorefrontItem,
  CompanyMember,
} from "../../types";

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
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
};

// ==================== ITEM CARD ====================

interface ItemCardProps {
  item: CompanyStorefrontItem;
  onRemove: (itemId: number) => void;
}

const ItemCard: React.FC<ItemCardProps> = ({ item, onRemove }) => {
  const listing = item.listing;
  if (!listing) return null;

  return (
    <div className="flex items-center justify-between py-2 px-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate">
            {listing.title}
          </h4>
          {item.isFeatured && (
            <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded shrink-0">
              Destaque
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs font-semibold text-primary-600 dark:text-primary-400">
            {formatCurrency(listing.price)}
          </span>
          {listing.category && (
            <span className="text-xs text-slate-500">
              {listing.category.name}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={() => onRemove(item.id)}
        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0 ml-2"
        title="Remover"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

// ==================== SECTION CARD ====================

interface SectionCardProps {
  section: CompanyStorefrontSection;
  index: number;
  total: number;
  members: CompanyMember[];
  onEditSection: (section: CompanyStorefrontSection) => void;
  onDeleteSection: (sectionId: number) => void;
  onMoveSection: (sectionId: number, direction: "up" | "down") => void;
  onAddItem: (sectionId: number) => void;
  onRemoveItem: (sectionId: number, itemId: number) => void;
  onToggleActive: (section: CompanyStorefrontSection) => void;
  onManageTeam: (sectionId: number) => void;
}

const SectionCard: React.FC<SectionCardProps> = ({
  section,
  index,
  total,
  onEditSection,
  onDeleteSection,
  onMoveSection,
  onAddItem,
  onRemoveItem,
  onToggleActive,
  onManageTeam,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const items = section.items || [];

  return (
    <div
      className={`card overflow-hidden ${
        !section.isActive ? "opacity-60" : ""
      }`}
    >
      {/* Section header */}
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
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                {section.title}
              </h3>
              {!section.isActive && (
                <span className="text-xs bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded shrink-0">
                  Inativa
                </span>
              )}
            </div>
            <span className="text-xs text-slate-500">
              {items.length} servico{items.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onToggleActive(section)}
            className={`p-1.5 rounded-lg ${
              section.isActive
                ? "text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20"
                : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
            }`}
            title={section.isActive ? "Desativar" : "Ativar"}
          >
            {section.isActive ? (
              <Eye className="w-4 h-4" />
            ) : (
              <EyeOff className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => onManageTeam(section.id)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20"
            title="Equipe da seção"
          >
            <Users className="w-4 h-4" />
          </button>
          <button
            onClick={() => onMoveSection(section.id, "up")}
            disabled={index === 0}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-30"
            title="Mover para cima"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            onClick={() => onMoveSection(section.id, "down")}
            disabled={index === total - 1}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-30"
            title="Mover para baixo"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <button
            onClick={() => onEditSection(section)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20"
            title="Editar"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDeleteSection(section.id)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
            title="Remover"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Items list */}
      {!collapsed && (
        <div className="p-4 space-y-2">
          {section.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
              {section.description}
            </p>
          )}

          {items.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">
              Nenhum servico nesta seção
            </p>
          ) : (
            items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onRemove={(itemId) => onRemoveItem(section.id, itemId)}
              />
            ))
          )}

          <button
            onClick={() => onAddItem(section.id)}
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

interface CompanyListing {
  id: number;
  title: string;
  description: string;
  price: number;
  images: string[];
  category?: { name: string };
}

const CompanyStorefrontManager: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();

  // State
  const [sections, setSections] = useState<CompanyStorefrontSection[]>([]);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [companyListings, setCompanyListings] = useState<CompanyListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modal states
  const [sectionModal, setSectionModal] = useState<{
    open: boolean;
    editing?: CompanyStorefrontSection;
  }>({ open: false });
  const [addItemModal, setAddItemModal] = useState<{
    open: boolean;
    sectionId?: number;
  }>({ open: false });
  const [teamModal, setTeamModal] = useState<{
    open: boolean;
    sectionId?: number;
  }>({ open: false });

  // Form states
  const [sectionForm, setSectionForm] = useState({
    title: "",
    description: "",
  });
  const [selectedListingId, setSelectedListingId] = useState("");

  // Team state
  const [teamMemberIds, setTeamMemberIds] = useState<number[]>([]);

  // ========== LOAD DATA ==========

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [editorRes, membersRes] = await Promise.all([
        companyStorefrontService.getEditor(),
        api.get("/company/members"),
      ]);

      const profile = editorRes.data as any; // eslint-disable-line @typescript-eslint/no-explicit-any
      setSections(profile?.storefrontSections ?? []);
      setMembers(membersRes.data.data ?? []);

      // Load company service listings for the add-item modal
      try {
        const listingsRes = await api.get("/company/storefront/listings");
        setCompanyListings(listingsRes.data.data ?? []);
      } catch {
        // Listings endpoint might not exist yet — fallback to empty
        setCompanyListings([]);
      }
    } catch {
      toast.error("Erro ao carregar dados da vitrine");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ========== SECTION CRUD ==========

  const openSectionModal = (editing?: CompanyStorefrontSection) => {
    setSectionForm({
      title: editing?.title || "",
      description: editing?.description || "",
    });
    setSectionModal({ open: true, editing });
  };

  const handleSaveSection = async () => {
    if (!sectionForm.title.trim()) {
      toast.warning("Informe o titulo da seção");
      return;
    }
    setSaving(true);
    try {
      if (sectionModal.editing) {
        await companyStorefrontService.updateSection(sectionModal.editing.id, {
          title: sectionForm.title,
          description: sectionForm.description || undefined,
        });
        toast.success("Seção atualizada");
      } else {
        await companyStorefrontService.createSection({
          title: sectionForm.title,
          description: sectionForm.description || undefined,
          order: sections.length,
        });
        toast.success("Seção criada");
      }
      setSectionModal({ open: false });
      await loadData();
    } catch {
      toast.error("Erro ao salvar seção");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSection = async (sectionId: number) => {
    const section = sections.find((s) => s.id === sectionId);
    const itemCount = section?.items?.length || 0;
    const msg =
      itemCount > 0
        ? `Remover "${section?.title}" e seus ${itemCount} servico(s)?`
        : `Remover "${section?.title}"?`;
    if (!window.confirm(msg)) return;

    try {
      await companyStorefrontService.deleteSection(sectionId);
      toast.success("Seção removida");
      setSections((prev) => prev.filter((s) => s.id !== sectionId));
    } catch {
      toast.error("Erro ao remover seção");
    }
  };

  const handleMoveSection = async (
    sectionId: number,
    direction: "up" | "down",
  ) => {
    const idx = sections.findIndex((s) => s.id === sectionId);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sections.length) return;

    const newOrder = [...sections];
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx]!, newOrder[idx]!];

    // Optimistic update
    setSections(newOrder);

    try {
      // Update each section's order
      await Promise.all(
        newOrder.map((s, i) =>
          companyStorefrontService.updateSection(s.id, { order: i }),
        ),
      );
    } catch {
      toast.error("Erro ao reordenar");
      await loadData();
    }
  };

  const handleToggleSectionActive = async (
    section: CompanyStorefrontSection,
  ) => {
    try {
      await companyStorefrontService.updateSection(section.id, {
        isActive: !section.isActive,
      });
      toast.success(
        section.isActive ? "Seção desativada" : "Seção ativada",
      );
      setSections((prev) =>
        prev.map((s) =>
          s.id === section.id ? { ...s, isActive: !s.isActive } : s,
        ),
      );
    } catch {
      toast.error("Erro ao atualizar seção");
    }
  };

  // ========== ITEM CRUD ==========

  const openAddItemModal = (sectionId: number) => {
    setSelectedListingId("");
    setAddItemModal({ open: true, sectionId });
  };

  const handleAddItem = async () => {
    if (!selectedListingId || !addItemModal.sectionId) {
      toast.warning("Selecione um servico");
      return;
    }

    setSaving(true);
    try {
      const section = sections.find((s) => s.id === addItemModal.sectionId);
      const itemCount = section?.items?.length || 0;
      await companyStorefrontService.addItemToSection(
        addItemModal.sectionId,
        {
          listingId: Number(selectedListingId),
          order: itemCount,
        },
      );
      toast.success("Servico adicionado");
      setAddItemModal({ open: false });
      await loadData();
    } catch {
      toast.error("Erro ao adicionar servico");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveItem = async (sectionId: number, itemId: number) => {
    if (!window.confirm("Remover este servico da seção?")) return;
    try {
      await companyStorefrontService.removeItemFromSection(sectionId, itemId);
      toast.success("Servico removido");
      setSections((prev) =>
        prev.map((s) =>
          s.id === sectionId
            ? { ...s, items: s.items.filter((i) => i.id !== itemId) }
            : s,
        ),
      );
    } catch {
      toast.error("Erro ao remover servico");
    }
  };

  // ========== TEAM MANAGEMENT ==========

  const openTeamModal = (sectionId: number) => {
    setTeamMemberIds([]);
    setTeamModal({ open: true, sectionId });
  };

  const toggleTeamMember = (memberId: number) => {
    setTeamMemberIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId],
    );
  };

  const handleSaveTeam = async () => {
    if (!teamModal.sectionId) return;
    if (teamMemberIds.length === 0) {
      toast.warning("Selecione pelo menos um membro");
      return;
    }

    setSaving(true);
    try {
      await api.post("/company/teams", {
        sectionId: teamModal.sectionId,
        memberIds: teamMemberIds,
      });
      toast.success("Equipe atualizada");
      setTeamModal({ open: false });
    } catch {
      toast.error("Erro ao salvar equipe");
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

  const totalItems = sections.reduce(
    (sum, sec) => sum + (sec.items?.length || 0),
    0,
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-800">
      <div className="container mx-auto px-4 py-6 max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/company/dashboard")}
              className="w-9 h-9 rounded-lg border border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                Vitrine da Empresa
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Gerencie seções e servicos da vitrine
              </p>
            </div>
          </div>
        </div>

        {/* Status bar */}
        <div className="card p-4 mb-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5 text-sm text-slate-500">
              <Layers className="w-4 h-4" />
              {sections.length} seção{sections.length !== 1 ? "ões" : ""}
            </div>
            <div className="flex items-center gap-1.5 text-sm text-slate-500">
              <Package className="w-4 h-4" />
              {totalItems} servico{totalItems !== 1 ? "s" : ""}
            </div>
            <div className="flex items-center gap-1.5 text-sm text-slate-500">
              <Users className="w-4 h-4" />
              {members.filter((m) => m.isActive).length} membro
              {members.filter((m) => m.isActive).length !== 1 ? "s" : ""} ativo
              {members.filter((m) => m.isActive).length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-4 mb-6">
          {sections.length === 0 ? (
            <div className="card p-8 text-center">
              <Store className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-1">
                Nenhuma seção ainda
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                Crie seções para organizar os servicos da empresa
              </p>
              <button
                onClick={() => openSectionModal()}
                className="btn btn-primary inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Criar primeira seção
              </button>
            </div>
          ) : (
            sections.map((section, idx) => (
              <SectionCard
                key={section.id}
                section={section}
                index={idx}
                total={sections.length}
                members={members}
                onEditSection={openSectionModal}
                onDeleteSection={handleDeleteSection}
                onMoveSection={handleMoveSection}
                onAddItem={openAddItemModal}
                onRemoveItem={handleRemoveItem}
                onToggleActive={handleToggleSectionActive}
                onManageTeam={openTeamModal}
              />
            ))
          )}
        </div>

        {/* Add section button */}
        {sections.length > 0 && (
          <button
            onClick={() => openSectionModal()}
            className="w-full py-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-slate-500 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400 flex items-center justify-center gap-2 transition-colors"
          >
            <Plus className="w-5 h-5" /> Adicionar seção
          </button>
        )}
      </div>

      {/* ==================== MODALS ==================== */}

      {/* Section Modal */}
      <Modal
        open={sectionModal.open}
        title={sectionModal.editing ? "Editar seção" : "Nova seção"}
        onClose={() => setSectionModal({ open: false })}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Titulo da seção *
            </label>
            <input
              type="text"
              value={sectionForm.title}
              onChange={(e) =>
                setSectionForm((p) => ({ ...p, title: e.target.value }))
              }
              maxLength={100}
              placeholder="Ex: Limpeza Residencial"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Descrição (opcional)
            </label>
            <textarea
              value={sectionForm.description}
              onChange={(e) =>
                setSectionForm((p) => ({ ...p, description: e.target.value }))
              }
              rows={3}
              maxLength={500}
              placeholder="Descreva esta seção de servicos..."
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setSectionModal({ open: false })}
              className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveSection}
              disabled={saving}
              className="btn btn-primary flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {sectionModal.editing ? "Salvar" : "Criar"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Add Item Modal */}
      <Modal
        open={addItemModal.open}
        title="Adicionar servico à seção"
        onClose={() => setAddItemModal({ open: false })}
      >
        <div className="space-y-4">
          {companyListings.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">
              Nenhum servico disponivel. Crie listings de servicos primeiro.
            </p>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Selecione o servico
                </label>
                <select
                  value={selectedListingId}
                  onChange={(e) => setSelectedListingId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">Selecione...</option>
                  {companyListings.map((listing) => (
                    <option key={listing.id} value={listing.id}>
                      {listing.title} - {formatCurrency(listing.price)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setAddItemModal({ open: false })}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddItem}
                  disabled={saving || !selectedListingId}
                  className="btn btn-primary flex items-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Adicionar
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Team Modal */}
      <Modal
        open={teamModal.open}
        title="Equipe da Seção"
        onClose={() => setTeamModal({ open: false })}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Selecione os membros que atuam nesta categoria de servicos.
          </p>
          {members.filter((m) => m.isActive).length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">
              Nenhum membro ativo encontrado.
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {members
                .filter((m) => m.isActive)
                .map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700"
                  >
                    <input
                      type="checkbox"
                      id={`team-member-${member.id}`}
                      checked={teamMemberIds.includes(member.id)}
                      onChange={() => toggleTeamMember(member.id)}
                      className="h-4 w-4 text-blue-600 rounded"
                    />
                    <label
                      htmlFor={`team-member-${member.id}`}
                      className="flex-1 cursor-pointer"
                    >
                      <p className="font-medium text-slate-900 dark:text-slate-100 text-sm">
                        {member.user.name}
                      </p>
                      {member.role && (
                        <p className="text-xs text-slate-500">
                          {member.role.name}
                        </p>
                      )}
                    </label>
                  </div>
                ))}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setTeamModal({ open: false })}
              className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveTeam}
              disabled={saving || teamMemberIds.length === 0}
              className="btn btn-primary flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Salvar Equipe
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CompanyStorefrontManager;
