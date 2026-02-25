import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import {
  Store,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Camera,
  MapPin,
  Truck,
  ArrowLeftRight,
  Monitor,
  Check,
  Sparkles,
  Clock,
  Users,
  Tag,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import {
  getMainCategories,
  CategoryWithCounts,
} from "../../services/categoryService";
import {
  getMyStorefront,
  createStorefront,
  createCategory,
  createService,
  publishStorefront,
} from "../../services/storefrontService";
import { CurrencyInput } from "../../components/common/CurrencyInput";
import { CreateStorefrontInput } from "../../types";

// ==================== TYPES ====================

interface WizardData {
  // Step 2 - Basic info
  name: string;
  description: string;
  workingHours: string;
  logoFile: File | null;
  logoPreview: string | null;

  // Step 3 - Category & delivery
  mainCategoryId: number | undefined;
  customCategoryName: string;
  serviceLocation: "HOME" | "CLIENT" | "BOTH" | "ONLINE";
  teamSize: number;
  averageServiceTime: string;

  // Step 4 - First service
  serviceName: string;
  servicePrice: number;
  serviceDescription: string;
  serviceLocationOverride: boolean;
  serviceLocation2: "HOME" | "CLIENT" | "BOTH" | "ONLINE";
}

const LOCATION_OPTIONS = [
  { value: "HOME" as const, label: "Em meu local", icon: MapPin, desc: "Clientes vem ate voce" },
  { value: "CLIENT" as const, label: "Vou ate o cliente", icon: Truck, desc: "Voce vai ate o cliente" },
  { value: "BOTH" as const, label: "Ambos", icon: ArrowLeftRight, desc: "Flexivel" },
  { value: "ONLINE" as const, label: "Online/Remoto", icon: Monitor, desc: "Servico remoto" },
];

const TIME_OPTIONS = [
  { value: "30min", label: "30 minutos" },
  { value: "1h", label: "1 hora" },
  { value: "2h", label: "2 horas" },
  { value: "meio-dia", label: "Meio dia" },
  { value: "dia-inteiro", label: "Dia inteiro" },
  { value: "variavel", label: "Variavel" },
];

const TOTAL_STEPS = 5;

// ==================== STEP COMPONENTS ====================

function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center text-center py-8">
      {/* Floating card */}
      <div
        className="relative mb-8"
        style={{ animation: "wizard-float 3s ease-in-out infinite" }}
      >
        <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-xl shadow-primary-500/25">
          <Store className="w-14 h-14 text-white" />
        </div>
        <div
          className="absolute -top-2 -right-2 w-10 h-10 rounded-full bg-amber-400 flex items-center justify-center shadow-lg"
          style={{ animation: "wizard-float 2.5s ease-in-out infinite 0.5s" }}
        >
          <Sparkles className="w-5 h-5 text-amber-900" />
        </div>
      </div>

      <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3">
        Crie sua vitrine profissional!
      </h2>
      <p className="text-lg text-slate-600 dark:text-slate-400 mb-2 max-w-md">
        Sua vitrine e o cardapio dos seus servicos. Clientes navegam,
        escolhem e fazem pedidos diretamente.
      </p>
      <p className="text-sm text-slate-500 dark:text-slate-500 mb-8 max-w-sm">
        Em poucos passos voce configura tudo. Leva menos de 2 minutos!
      </p>

      <button
        onClick={onNext}
        className="btn btn-primary px-8 py-3 text-lg flex items-center gap-2 shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40 transition-all"
      >
        Comecar
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  );
}

function StepBasicInfo({
  data,
  onChange,
}: {
  data: WizardData;
  onChange: (updates: Partial<WizardData>) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith("image/")) {
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      return; // 5MB max
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      onChange({ logoFile: file, logoPreview: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-5">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Informacoes basicas
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Como sua vitrine vai aparecer para os clientes
        </p>
      </div>

      {/* Logo upload */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="group relative w-24 h-24 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-primary-400 dark:hover:border-primary-500 flex items-center justify-center overflow-hidden transition-colors"
        >
          {data.logoPreview ? (
            <img
              src={data.logoPreview}
              alt="Logo"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center text-slate-400 group-hover:text-primary-500 transition-colors">
              <Camera className="w-6 h-6" />
              <span className="text-[10px] mt-0.5">Logo</span>
            </div>
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
            <Camera className="w-5 h-5 text-white" />
          </div>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
      <p className="text-xs text-center text-slate-400 dark:text-slate-500 -mt-2">
        Opcional — pode adicionar depois
      </p>

      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Nome da vitrine <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={data.name}
          onChange={(e) => onChange({ name: e.target.value })}
          maxLength={100}
          placeholder="Ex: Joao Eletricista"
          className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
          {data.name.length}/100 — Nome que os clientes verao
        </p>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Descricao curta
        </label>
        <textarea
          value={data.description}
          onChange={(e) => onChange({ description: e.target.value })}
          maxLength={200}
          rows={3}
          placeholder="Eletricista com 10 anos de experiencia, atendo residencias e comercios..."
          className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
        />
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
          {data.description.length}/200 caracteres
        </p>
      </div>

      {/* Working hours */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          <Clock className="w-4 h-4 inline mr-1 -mt-0.5" />
          Horario de funcionamento
        </label>
        <input
          type="text"
          value={data.workingHours}
          onChange={(e) => onChange({ workingHours: e.target.value })}
          placeholder="Ex: Seg-Sex 8h-18h"
          className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
      </div>
    </div>
  );
}

function StepCategoryDelivery({
  data,
  onChange,
  categories,
  loadingCategories,
}: {
  data: WizardData;
  onChange: (updates: Partial<WizardData>) => void;
  categories: CategoryWithCounts[];
  loadingCategories: boolean;
}) {
  const isCustomCategory = data.mainCategoryId === -1;

  return (
    <div className="space-y-5">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Categoria e prestacao
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Ajuda clientes a encontrar voce
        </p>
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          <Tag className="w-4 h-4 inline mr-1 -mt-0.5" />
          Categoria principal
        </label>
        <select
          value={data.mainCategoryId ?? ""}
          onChange={(e) => {
            const val = e.target.value;
            onChange({
              mainCategoryId: val === "-1" ? -1 : val ? parseInt(val, 10) : undefined,
              customCategoryName: val === "-1" ? data.customCategoryName : "",
            });
          }}
          disabled={loadingCategories}
          className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="">Selecione uma categoria</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
          <option value="-1">Outro...</option>
        </select>
        {isCustomCategory && (
          <input
            type="text"
            value={data.customCategoryName}
            onChange={(e) => onChange({ customCategoryName: e.target.value })}
            placeholder="Nome da sua categoria"
            className="w-full mt-2 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        )}
      </div>

      {/* Service location */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Local de prestacao (padrao)
        </label>
        <div className="grid grid-cols-2 gap-3">
          {LOCATION_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const selected = data.serviceLocation === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ serviceLocation: opt.value })}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  selected
                    ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-sm"
                    : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                }`}
              >
                <Icon
                  className={`w-5 h-5 mb-1.5 ${
                    selected
                      ? "text-primary-600 dark:text-primary-400"
                      : "text-slate-400 dark:text-slate-500"
                  }`}
                />
                <div
                  className={`text-sm font-medium ${
                    selected
                      ? "text-primary-900 dark:text-primary-100"
                      : "text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {opt.label}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-500">
                  {opt.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Team size */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          <Users className="w-4 h-4 inline mr-1 -mt-0.5" />
          Tamanho da equipe
        </label>
        <input
          type="number"
          min={1}
          max={20}
          value={data.teamSize}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v) && v >= 1 && v <= 20) onChange({ teamSize: v });
          }}
          className="w-24 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
        <span className="text-sm text-slate-500 dark:text-slate-400 ml-2">
          {data.teamSize === 1 ? "pessoa" : "pessoas"}
        </span>
      </div>

      {/* Average service time */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          <Clock className="w-4 h-4 inline mr-1 -mt-0.5" />
          Tempo medio por servico
        </label>
        <select
          value={data.averageServiceTime}
          onChange={(e) => onChange({ averageServiceTime: e.target.value })}
          className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="">Selecione...</option>
          {TIME_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function StepFirstService({
  data,
  onChange,
}: {
  data: WizardData;
  onChange: (updates: Partial<WizardData>) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Seu primeiro servico
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Adicione pelo menos um servico para comecar
        </p>
      </div>

      {/* Service name */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Nome do servico <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={data.serviceName}
          onChange={(e) => onChange({ serviceName: e.target.value })}
          maxLength={100}
          placeholder="Ex: Instalacao de tomadas"
          className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
      </div>

      {/* Service price */}
      <CurrencyInput
        label="Preco"
        value={data.servicePrice}
        onChange={(v) => onChange({ servicePrice: v })}
        required
        helperText="Preco base do servico"
      />

      {/* Service description */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Descricao do servico
        </label>
        <textarea
          value={data.serviceDescription}
          onChange={(e) => onChange({ serviceDescription: e.target.value })}
          maxLength={500}
          rows={3}
          placeholder="Descreva o que esta incluso neste servico..."
          className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
        />
      </div>

      {/* Location override */}
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={data.serviceLocationOverride}
            onChange={(e) =>
              onChange({
                serviceLocationOverride: e.target.checked,
                serviceLocation2: e.target.checked
                  ? data.serviceLocation2
                  : data.serviceLocation,
              })
            }
            className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm text-slate-700 dark:text-slate-300">
            Diferente do local padrao ({LOCATION_OPTIONS.find((o) => o.value === data.serviceLocation)?.label})
          </span>
        </label>
        {data.serviceLocationOverride && (
          <div className="grid grid-cols-2 gap-2 mt-3">
            {LOCATION_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const selected = data.serviceLocation2 === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChange({ serviceLocation2: opt.value })}
                  className={`p-2.5 rounded-lg border-2 text-left text-sm transition-all ${
                    selected
                      ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                  }`}
                >
                  <Icon className={`w-4 h-4 inline mr-1.5 -mt-0.5 ${selected ? "text-primary-600" : "text-slate-400"}`} />
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StepDone({
  data,
  categories,
  submitting,
  onPublish,
  onCustomize,
}: {
  data: WizardData;
  categories: CategoryWithCounts[];
  submitting: boolean;
  onPublish: () => void;
  onCustomize: () => void;
}) {
  const categoryName =
    data.mainCategoryId === -1
      ? data.customCategoryName
      : categories.find((c) => c.id === data.mainCategoryId)?.name || "";

  const locationLabel =
    LOCATION_OPTIONS.find((o) => o.value === data.serviceLocation)?.label || "";

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);

  return (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <div
          className="inline-flex w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 items-center justify-center mb-3"
          style={{ animation: "wizard-float 3s ease-in-out infinite" }}
        >
          <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Tudo pronto!
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Confira como ficou antes de publicar
        </p>
      </div>

      {/* Preview card */}
      <div className="card p-5 border-2 border-slate-200 dark:border-slate-700">
        <div className="flex items-start gap-3 mb-4">
          {data.logoPreview ? (
            <img
              src={data.logoPreview}
              alt="Logo"
              className="w-12 h-12 rounded-full object-cover border border-slate-200 dark:border-slate-700"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <Store className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
              {data.name || "Minha Vitrine"}
            </h3>
            {data.description && (
              <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                {data.description}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-slate-500 dark:text-slate-500">
              {categoryName && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
                  <Tag className="w-3 h-3" />
                  {categoryName}
                </span>
              )}
              {locationLabel && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
                  <MapPin className="w-3 h-3" />
                  {locationLabel}
                </span>
              )}
              {data.workingHours && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
                  <Clock className="w-3 h-3" />
                  {data.workingHours}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* First service preview */}
        {data.serviceName && (
          <div className="border-t border-slate-200 dark:border-slate-700 pt-3 mt-3">
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
              Primeiro servico
            </p>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  {data.serviceName}
                </p>
                {data.serviceDescription && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                    {data.serviceDescription}
                  </p>
                )}
              </div>
              <span className="font-semibold text-primary-600 dark:text-primary-400 whitespace-nowrap ml-3">
                {formatPrice(data.servicePrice)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="space-y-3">
        <button
          onClick={onPublish}
          disabled={submitting}
          className="btn btn-primary w-full py-3 flex items-center justify-center gap-2 text-base shadow-lg shadow-primary-500/25"
        >
          {submitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Publicando...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Publicar agora
            </>
          )}
        </button>
        <button
          onClick={onCustomize}
          disabled={submitting}
          className="btn w-full py-3 flex items-center justify-center gap-2 text-base border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          {submitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              Personalizar mais
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ==================== PROGRESS BAR ====================

function ProgressBar({ currentStep }: { currentStep: number }) {
  const steps = [
    { num: 1, label: "Inicio" },
    { num: 2, label: "Info" },
    { num: 3, label: "Categoria" },
    { num: 4, label: "Servico" },
    { num: 5, label: "Pronto" },
  ];

  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((step, idx) => {
        const isCompleted = currentStep > step.num;
        const isCurrent = currentStep === step.num;
        return (
          <React.Fragment key={step.num}>
            {idx > 0 && (
              <div
                className={`h-0.5 w-8 sm:w-12 transition-colors duration-300 ${
                  currentStep > step.num
                    ? "bg-primary-500"
                    : "bg-slate-200 dark:bg-slate-700"
                }`}
              />
            )}
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  isCompleted
                    ? "bg-primary-500 text-white"
                    : isCurrent
                      ? "bg-primary-500 text-white ring-4 ring-primary-500/20"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500"
                }`}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : step.num}
              </div>
              <span
                className={`text-[10px] mt-1 transition-colors duration-300 ${
                  isCurrent
                    ? "text-primary-600 dark:text-primary-400 font-medium"
                    : "text-slate-400 dark:text-slate-500"
                }`}
              >
                {step.label}
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ==================== MAIN WIZARD ====================

const StorefrontWizard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<CategoryWithCounts[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");

  const [data, setData] = useState<WizardData>({
    name: user?.name || "",
    description: "",
    workingHours: "",
    logoFile: null,
    logoPreview: null,
    mainCategoryId: undefined,
    customCategoryName: "",
    serviceLocation: "BOTH",
    teamSize: 1,
    averageServiceTime: "",
    serviceName: "",
    servicePrice: 0,
    serviceDescription: "",
    serviceLocationOverride: false,
    serviceLocation2: "BOTH",
  });

  // Check if user already has a storefront
  useEffect(() => {
    const check = async () => {
      try {
        const existing = await getMyStorefront();
        if (existing) {
          navigate("/professional/vitrine", { replace: true });
          return;
        }
      } catch {
        // No storefront — continue
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateData = (updates: Partial<WizardData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  };

  const goNext = () => {
    setDirection("forward");
    setCurrentStep((s) => Math.min(s + 1, TOTAL_STEPS));
  };

  const goPrev = () => {
    setDirection("backward");
    setCurrentStep((s) => Math.max(s - 1, 1));
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 2:
        if (!data.name.trim()) {
          toast.warning("Preencha o nome da vitrine");
          return false;
        }
        return true;
      case 3:
        // Category is optional but if "Outro" selected, need a name
        if (data.mainCategoryId === -1 && !data.customCategoryName.trim()) {
          toast.warning("Preencha o nome da categoria");
          return false;
        }
        return true;
      case 4:
        if (!data.serviceName.trim()) {
          toast.warning("Preencha o nome do servico");
          return false;
        }
        if (data.servicePrice <= 0) {
          toast.warning("Preencha o preco do servico");
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      goNext();
    }
  };

  const handleSubmit = async (publish: boolean) => {
    setSubmitting(true);
    try {
      // 1. Create storefront
      const storefrontInput: CreateStorefrontInput = {
        name: data.name.trim(),
        description: data.description.trim() || undefined,
        serviceLocation: data.serviceLocation,
        teamSize: data.teamSize,
        workingHours: data.workingHours.trim() || undefined,
        averageServiceTime: data.averageServiceTime || undefined,
      };

      // Set mainCategoryId only for real categories (not custom)
      if (data.mainCategoryId && data.mainCategoryId !== -1) {
        storefrontInput.mainCategoryId = data.mainCategoryId;
      }

      const storefront = await createStorefront(storefrontInput);

      // 2. Create a category for the first service
      const categoryName =
        data.mainCategoryId === -1
          ? data.customCategoryName.trim()
          : categories.find((c) => c.id === data.mainCategoryId)?.name || "Geral";

      const category = await createCategory({
        name: categoryName,
        order: 0,
      });

      // 3. Create the first service
      await createService({
        categoryId: category.id,
        title: data.serviceName.trim(),
        price: data.servicePrice,
        description: data.serviceDescription.trim() || undefined,
      });

      // 4. Publish if requested
      if (publish) {
        await publishStorefront(true);
      }

      toast.success(
        "Vitrine criada!",
        publish
          ? `"${storefront.name}" esta publicada e pronta para receber pedidos`
          : `"${storefront.name}" foi salva como rascunho`,
      );

      navigate("/professional/vitrine", { replace: true });
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      const msg = error?.response?.data?.message || "Erro ao criar vitrine";
      toast.error("Erro", msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (checkingExisting) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-800">
      {/* Float animation keyframes */}
      <style>{`
        @keyframes wizard-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
      `}</style>

      <div className="container mx-auto px-4 py-6 max-w-xl">
        {/* Back button */}
        {currentStep > 1 && (
          <button
            onClick={goPrev}
            disabled={submitting}
            className="mb-4 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
        )}

        {/* Progress bar (hidden on step 1) */}
        {currentStep > 1 && <ProgressBar currentStep={currentStep} />}

        {/* Step content with transition */}
        <div
          key={currentStep}
          className="animate-fade-in"
          style={{
            animation: `wizard-step-${direction} 0.3s ease-out`,
          }}
        >
          <style>{`
            @keyframes wizard-step-forward {
              from { opacity: 0; transform: translateX(20px); }
              to { opacity: 1; transform: translateX(0); }
            }
            @keyframes wizard-step-backward {
              from { opacity: 0; transform: translateX(-20px); }
              to { opacity: 1; transform: translateX(0); }
            }
          `}</style>

          <div className="card p-6">
            {currentStep === 1 && <StepWelcome onNext={goNext} />}
            {currentStep === 2 && (
              <StepBasicInfo data={data} onChange={updateData} />
            )}
            {currentStep === 3 && (
              <StepCategoryDelivery
                data={data}
                onChange={updateData}
                categories={categories}
                loadingCategories={loadingCategories}
              />
            )}
            {currentStep === 4 && (
              <StepFirstService data={data} onChange={updateData} />
            )}
            {currentStep === 5 && (
              <StepDone
                data={data}
                categories={categories}
                submitting={submitting}
                onPublish={() => handleSubmit(true)}
                onCustomize={() => handleSubmit(false)}
              />
            )}
          </div>
        </div>

        {/* Navigation buttons (for steps 2-4) */}
        {currentStep >= 2 && currentStep <= 4 && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleNext}
              className="btn btn-primary px-6 py-2.5 flex items-center gap-2"
            >
              Proximo
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 1 footer */}
        {currentStep === 1 && (
          <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-6">
            Voce podera personalizar tudo depois
          </p>
        )}
      </div>
    </div>
  );
};

export default StorefrontWizard;
