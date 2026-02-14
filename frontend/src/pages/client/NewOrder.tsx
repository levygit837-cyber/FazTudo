import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  MapPin,
  Clock,
  DollarSign,
  Camera,
  AlertCircle,
  Zap,
  Loader2,
} from "lucide-react";
import { useToast } from "../../context/ToastContext";
import { getMainCategories, CategoryWithCounts } from "../../services/categoryService";
import { getBriefTemplate, createOrderWithBrief } from "../../services/serviceService";

const STEPS = [
  { label: "Categoria", icon: <FileText className="w-4 h-4" /> },
  { label: "Detalhes", icon: <FileText className="w-4 h-4" /> },
  { label: "Local & Prazo", icon: <MapPin className="w-4 h-4" /> },
  { label: "Revisão", icon: <Check className="w-4 h-4" /> },
];

const URGENCY_LEVELS = [
  { value: "LOW", label: "Baixa", description: "Sem pressa, pode agendar", color: "text-slate-600 dark:text-slate-400", bg: "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700", icon: <Clock className="w-4 h-4" /> },
  { value: "NORMAL", label: "Normal", description: "Dentro de 7 dias", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800", icon: <Clock className="w-4 h-4" /> },
  { value: "HIGH", label: "Alta", description: "Dentro de 3 dias", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800", icon: <AlertCircle className="w-4 h-4" /> },
  { value: "URGENT", label: "Urgente", description: "Preciso para amanhã", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800", icon: <Zap className="w-4 h-4" /> },
];

interface BriefField {
  name: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
}

const NewOrder: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Category
  const [categories, setCategories] = useState<CategoryWithCounts[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CategoryWithCounts | null>(null);

  // Step 2: Brief details
  const [briefFields, setBriefFields] = useState<BriefField[]>([]);
  const [title, setTitle] = useState("");
  const [briefData, setBriefData] = useState<Record<string, any>>({});
  const [notes, setNotes] = useState("");

  // Step 3: Location & urgency
  const [urgencyLevel, setUrgencyLevel] = useState("NORMAL");
  const [priceRangeMin, setPriceRangeMin] = useState<number | undefined>();
  const [priceRangeMax, setPriceRangeMax] = useState<number | undefined>();
  const [scheduledDate, setScheduledDate] = useState("");
  const [addressNotes, setAddressNotes] = useState("");

  // Load categories
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await getMainCategories(undefined, 20);
        setCategories(data.categories || []);
      } catch {
        toast.error("Erro", "Não foi possível carregar as categorias");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Load brief template when category changes
  useEffect(() => {
    if (!selectedCategory) return;
    const load = async () => {
      try {
        const slug = selectedCategory.name.toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, "-");
        const data = await getBriefTemplate(slug);
        setBriefFields(data.template?.fields || []);
      } catch {
        setBriefFields([{ name: "details", label: "Descreva o serviço desejado", type: "textarea", required: true }]);
      }
    };
    load();
  }, [selectedCategory]);

  const handleBriefFieldChange = (fieldName: string, value: any) => {
    setBriefData((prev) => ({ ...prev, [fieldName]: value }));
  };

  const canProceed = (): boolean => {
    switch (step) {
      case 0: return !!selectedCategory;
      case 1: return !!title.trim() && briefFields.filter((f) => f.required).every((f) => briefData[f.name]);
      case 2: return true;
      case 3: return true;
      default: return false;
    }
  };

  const handleSubmit = async () => {
    if (!selectedCategory || !title.trim()) return;
    try {
      setSubmitting(true);
      const result = await createOrderWithBrief({
        title: title.trim(),
        description: notes || undefined,
        categoryId: selectedCategory.id,
        urgencyLevel,
        priceRangeMin,
        priceRangeMax,
        briefData,
        notes: notes || undefined,
        addressNotes: addressNotes || undefined,
        scheduledDate: scheduledDate || undefined,
      });
      toast.success("Pedido criado com sucesso!");
      navigate(`/client/orders/${result.serviceOrder?.id || result.id}`);
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Erro ao criar pedido";
      toast.error("Erro", msg);
    } finally {
      setSubmitting(false);
    }
  };

  const renderCategoryIcon = (cat: CategoryWithCounts) => {
    const iconMap: Record<string, string> = {
      "Elétrica": "⚡", "Limpeza": "🧹", "Pintura": "🎨", "Encanamento": "🔧",
      "Design": "🎯", "Jardinagem": "🌱", "Mudança": "📦", "Reformas": "🏗️",
      "Tecnologia": "💻", "Consultoria": "📊",
    };
    return iconMap[cat.name] || cat.icon || "🔨";
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => step > 0 ? setStep(step - 1) : navigate(-1)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-700 dark:text-slate-300" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Novo Pedido</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Descreva o que você precisa e receba propostas</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => (
          <React.Fragment key={i}>
            <button
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                i === step
                  ? "bg-primary-600 text-white shadow-sm"
                  : i < step
                    ? "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 cursor-pointer hover:bg-primary-100 dark:hover:bg-primary-900/30"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed"
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                i < step ? "bg-primary-600 text-white" : ""
              }`}>
                {i < step ? <Check className="w-3 h-3" /> : i + 1}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 max-w-8 ${i < step ? "bg-primary-400" : "bg-slate-200 dark:bg-slate-700"}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step 0: Category selection */}
      {step === 0 && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Que tipo de serviço você precisa?</h2>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => { setSelectedCategory(cat); setBriefData({}); }}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center hover:shadow-md ${
                    selectedCategory?.id === cat.id
                      ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-sm"
                      : "border-slate-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-600"
                  }`}
                >
                  <span className="text-2xl">{renderCategoryIcon(cat)}</span>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{cat.name}</span>
                  {cat._count?.serviceListings !== undefined && (
                    <span className="text-xs text-slate-400">{cat._count.serviceListings} profissionais</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 1: Brief details */}
      {step === 1 && (
        <div className="card p-6 space-y-5">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Detalhes do serviço — {selectedCategory?.name}
          </h2>

          <div>
            <label className="label">Título do pedido *</label>
            <input
              type="text"
              className="input"
              placeholder={`Ex: ${selectedCategory?.name || "Serviço"} no meu apartamento`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {briefFields.map((field) => (
            <div key={field.name}>
              <label className="label">{field.label} {field.required && "*"}</label>
              {field.type === "textarea" ? (
                <textarea
                  className="input min-h-24"
                  placeholder={field.label}
                  value={briefData[field.name] || ""}
                  onChange={(e) => handleBriefFieldChange(field.name, e.target.value)}
                  required={field.required}
                />
              ) : field.type === "select" && field.options ? (
                <select
                  className="input"
                  value={briefData[field.name] || ""}
                  onChange={(e) => handleBriefFieldChange(field.name, e.target.value)}
                  required={field.required}
                >
                  <option value="">Selecione...</option>
                  {field.options.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : field.type === "boolean" ? (
                <div className="flex gap-3">
                  {["Sim", "Não"].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => handleBriefFieldChange(field.name, opt === "Sim")}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        briefData[field.name] === (opt === "Sim")
                          ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400"
                          : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  type={field.type === "number" ? "number" : "text"}
                  className="input"
                  placeholder={field.label}
                  value={briefData[field.name] || ""}
                  onChange={(e) => handleBriefFieldChange(field.name, field.type === "number" ? parseFloat(e.target.value) || "" : e.target.value)}
                  required={field.required}
                />
              )}
            </div>
          ))}

          <div>
            <label className="label">Observações adicionais</label>
            <textarea
              className="input min-h-20"
              placeholder="Algo mais que o profissional deva saber?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Media upload placeholder */}
          <div>
            <label className="label">Fotos (opcional)</label>
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-6 text-center hover:border-primary-400 dark:hover:border-primary-500 transition-colors cursor-pointer">
              <Camera className="w-8 h-8 mx-auto text-slate-400 dark:text-slate-500 mb-2" />
              <p className="text-sm text-slate-500 dark:text-slate-400">Clique ou arraste fotos aqui</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">JPG, PNG até 10MB</p>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Location & scheduling */}
      {step === 2 && (
        <div className="card p-6 space-y-5">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Local e prazo</h2>

          {/* Urgency */}
          <div>
            <label className="label">Urgência</label>
            <div className="grid grid-cols-2 gap-3">
              {URGENCY_LEVELS.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  onClick={() => setUrgencyLevel(level.value)}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                    urgencyLevel === level.value
                      ? `${level.bg} border-current ${level.color}`
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                  }`}
                >
                  <span className={urgencyLevel === level.value ? level.color : "text-slate-400"}>{level.icon}</span>
                  <div>
                    <p className={`text-sm font-medium ${urgencyLevel === level.value ? level.color : "text-slate-700 dark:text-slate-300"}`}>{level.label}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{level.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Price range */}
          <div>
            <label className="label">
              <DollarSign className="w-4 h-4 inline mr-1" />
              Faixa de preço (opcional)
            </label>
            <div className="flex gap-3">
              <div className="flex-1">
                <input
                  type="number"
                  className="input"
                  placeholder="Mínimo R$"
                  min={0}
                  value={priceRangeMin || ""}
                  onChange={(e) => setPriceRangeMin(parseFloat(e.target.value) || undefined)}
                />
              </div>
              <span className="self-center text-slate-400">—</span>
              <div className="flex-1">
                <input
                  type="number"
                  className="input"
                  placeholder="Máximo R$"
                  min={0}
                  value={priceRangeMax || ""}
                  onChange={(e) => setPriceRangeMax(parseFloat(e.target.value) || undefined)}
                />
              </div>
            </div>
          </div>

          {/* Scheduled date */}
          <div>
            <label className="label">Data preferida (opcional)</label>
            <input
              type="date"
              className="input"
              min={new Date().toISOString().split("T")[0]}
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
            />
          </div>

          {/* Address notes */}
          <div>
            <label className="label">
              <MapPin className="w-4 h-4 inline mr-1" />
              Endereço / referência
            </label>
            <textarea
              className="input min-h-20"
              placeholder="Ex: Rua das Flores, 123 - Apt 45 - Centro"
              value={addressNotes}
              onChange={(e) => setAddressNotes(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Revise seu pedido</h2>

            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <span className="text-2xl">{selectedCategory && renderCategoryIcon(selectedCategory)}</span>
                <div className="flex-1">
                  <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Categoria</p>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{selectedCategory?.name}</p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Título</p>
                <p className="font-semibold text-lg text-slate-900 dark:text-slate-100">{title}</p>
              </div>

              {Object.entries(briefData).filter(([, v]) => v !== "" && v !== undefined).length > 0 && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                  <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Detalhes</p>
                  <div className="space-y-2">
                    {Object.entries(briefData)
                      .filter(([, v]) => v !== "" && v !== undefined)
                      .map(([key, value]) => {
                        const field = briefFields.find((f) => f.name === key);
                        return (
                          <div key={key} className="flex justify-between text-sm">
                            <span className="text-slate-500 dark:text-slate-400">{field?.label || key}</span>
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                              {typeof value === "boolean" ? (value ? "Sim" : "Não") : String(value)}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {notes && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                  <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Observações</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{notes}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                  <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Urgência</p>
                  <p className={`font-medium ${URGENCY_LEVELS.find((u) => u.value === urgencyLevel)?.color || ""}`}>
                    {URGENCY_LEVELS.find((u) => u.value === urgencyLevel)?.label}
                  </p>
                </div>
                {(priceRangeMin || priceRangeMax) && (
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Faixa de preço</p>
                    <p className="font-medium text-slate-700 dark:text-slate-300">
                      {priceRangeMin ? `R$ ${priceRangeMin}` : "—"} a {priceRangeMax ? `R$ ${priceRangeMax}` : "—"}
                    </p>
                  </div>
                )}
                {scheduledDate && (
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Data preferida</p>
                    <p className="font-medium text-slate-700 dark:text-slate-300">{new Date(scheduledDate + "T12:00:00").toLocaleDateString("pt-BR")}</p>
                  </div>
                )}
                {addressNotes && (
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl col-span-2">
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Endereço</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{addressNotes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex justify-between gap-3">
        <button
          onClick={() => step > 0 ? setStep(step - 1) : navigate(-1)}
          className="btn btn-outline"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {step === 0 ? "Cancelar" : "Voltar"}
        </button>

        {step < 3 ? (
          <button
            onClick={() => setStep(step + 1)}
            disabled={!canProceed()}
            className="btn btn-primary"
          >
            Próximo
            <ArrowRight className="w-4 h-4 ml-2" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="btn btn-primary"
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Criando...</>
            ) : (
              <><Check className="w-4 h-4 mr-2" /> Criar Pedido</>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default NewOrder;
