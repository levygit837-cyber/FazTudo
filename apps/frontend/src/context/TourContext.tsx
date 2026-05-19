// frontend/src/context/TourContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router";
import { useAuth } from "./AuthContext";

// ─── Types ───────────────────────────────────────────────────────────────────

export type TourId = "client" | "professional";

export interface TourStep {
  id: string; // data-tour value (e.g. "tour-client-welcome")
  route: string | null; // navigate to this route before showing (null = stay)
  icon: string; // lucide icon name (string, TourSpotlight resolves it)
  title: string;
  description: string;
  simulationMode?: boolean; // true = no target element, center on screen
  requiresUnverified?: boolean; // se true, step só aparece para usuários não verificados
  simulationVariant?: "order" | "map" | "confirm" | "payment"; // visual variant for simulation steps
}

interface TourState {
  isActive: boolean;
  tourId: TourId | null;
  currentStep: number;
  steps: TourStep[];
}

interface TourContextValue extends TourState {
  startTour: (id: TourId) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  completeTour: () => void;
  resetTour: (id: TourId) => void; // limpa localStorage e permite rever
  onTourTargetReady: () => void; // chamado pelas páginas quando o data-tour está montado
  readyNonce: number; // incrementa quando uma página sinaliza que seu data-tour está pronto
}

// ─── Steps definitions ───────────────────────────────────────────────────────

export const CLIENT_STEPS: TourStep[] = [
  {
    id: "tour-client-welcome",
    route: "/client/dashboard",
    icon: "Sparkles",
    title: "Bem-vindo ao FazTudo!",
    description:
      "Este é seu painel. Aqui você acompanha pedidos, mensagens e encontra novos profissionais.",
  },
  {
    id: "tour-search-services",
    route: "/client/dashboard",
    icon: "Search",
    title: "Busque profissionais",
    description:
      "Clique aqui para encontrar profissionais por categoria, localização ou nome do serviço.",
  },
  {
    id: "tour-service-card-first",
    route: "/services",
    icon: "Star",
    title: "Compare avaliações e preços",
    description:
      "Veja avaliações reais, portfólio e o preço de cada profissional antes de contratar.",
  },
  {
    id: "tour-service-chat-btn",
    route: null, // já está em /services
    icon: "MessageCircle",
    title: "Tire dúvidas antes de contratar",
    description:
      "Use o chat para conversar com o profissional antes de criar o pedido. Sem compromisso.",
  },
  {
    id: "tour-request-service-btn",
    route: null,
    icon: "ShoppingBag",
    title: "Solicite o serviço",
    description:
      "Quando estiver pronto, clique aqui para criar seu pedido. O pagamento fica em escrow até você aprovar.",
  },
  {
    id: "tour-new-order-btn",
    route: "/client/dashboard",
    icon: "Plus",
    title: 'Ou use "Novo Serviço"',
    description:
      'Não achou o que precisa? Clique em "Novo Serviço" e descreva o que você quer — profissionais enviarão propostas.',
  },
];

export const PROFESSIONAL_STEPS: TourStep[] = [
  {
    id: "tour-pro-welcome",
    route: "/professional/dashboard",
    icon: "Sparkles",
    title: "Bem-vindo, profissional!",
    description:
      "Este é seu painel. Para ter acesso completo — incluindo receber pagamentos — você precisa verificar sua identidade.",
  },
  {
    id: "tour-kyc-cta",
    route: "/professional/dashboard",
    icon: "BadgeCheck",
    title: "Complete a verificação (KYC)",
    description:
      "Clique aqui para enviar seus documentos. É rápido e garante mais confiança para os seus clientes.",
    requiresUnverified: true, // step só aparece para usuários não verificados
  },
  {
    id: "tour-verify-form",
    route: "/verify-account", // corrigido: era "/verify-email", o data-tour fica em /verify-account
    icon: "FileText",
    title: "Envie seus documentos",
    description:
      "Preencha seus dados e envie uma foto do documento. Você será notificado por email quando aprovado.",
    requiresUnverified: true, // step só aparece para usuários não verificados
  },
  {
    id: "tour-create-service-btn",
    route: "/professional/dashboard",
    icon: "Briefcase",
    title: "Crie seu primeiro serviço",
    description:
      "Enquanto aguarda a verificação, você já pode criar seus serviços. Clique aqui para começar.",
  },
  {
    id: "tour-create-service-form",
    route: "/professional/vitrine",
    icon: "Edit",
    title: "Descreva seu serviço",
    description:
      "Adicione título, descrição, preço e fotos. Serviços com descrição detalhada recebem até 3× mais pedidos.",
  },
  {
    id: "sim-order-received",
    route: "/professional/dashboard",
    icon: "Clock",
    title: "Simulação: pedido recebido!",
    description:
      "João Silva acabou de solicitar sua Instalação Elétrica. Após o dia agendado, você terá 15 minutos para chegar ao local combinado.",
    simulationMode: true,
    simulationVariant: "order",
  },
  {
    id: "sim-navigate-map",
    route: "/professional/dashboard",
    icon: "MapPin",
    title: "Navegue até o cliente",
    description:
      "O mapa integrado mostra a rota até o endereço do cliente. Clique em 'Ver rota' para abrir a navegação passo a passo.",
    simulationMode: true,
    simulationVariant: "map",
  },
  {
    id: "sim-confirm-completion",
    route: "/professional/dashboard",
    icon: "CheckCircle",
    title: "Confirme a conclusão",
    description:
      "Ao terminar o serviço, confirme a conclusão. O cliente também confirma. O pagamento fica em escrow até os dois confirmarem.",
    simulationMode: true,
    simulationVariant: "confirm",
  },
  {
    id: "sim-payment-released",
    route: "/professional/dashboard",
    icon: "Wallet",
    title: "Pagamento liberado!",
    description:
      "Na simulação paramos aqui. Na realidade, 90% do valor vai direto para sua carteira FazTudo. Agora você está pronto para atender!",
    simulationMode: true,
    simulationVariant: "payment",
  },
];

const STEPS_MAP: Record<TourId, TourStep[]> = {
  client: CLIENT_STEPS,
  professional: PROFESSIONAL_STEPS,
};

const STORAGE_KEYS: Record<TourId, string> = {
  client: "faztudo_client_tour_done",
  professional: "faztudo_pro_tour_done",
};

// ─── Context ──────────────────────────────────────────────────────────────────

const TourContext = createContext<TourContextValue | null>(null);

export const TourProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [state, setState] = useState<TourState>({
    isActive: false,
    tourId: null,
    currentStep: 0,
    steps: [],
  });
  // Incremented when a page signals its data-tour target is ready in the DOM
  const [readyNonce, setReadyNonce] = useState(0);

  // ref to avoid stale closure in navigate
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const navigateToStep = useCallback(
    (step: TourStep) => {
      if (step.route && typeof window !== "undefined") {
        navigate(step.route);
      }
    },
    [navigate]
  );

  const startTour = useCallback(
    (id: TourId) => {
      // Filtrar steps que requerem usuário não verificado quando já é verificado
      const allSteps = STEPS_MAP[id];
      const steps = allSteps.filter((step) => {
        if (step.requiresUnverified && user?.isVerified) return false;
        return true;
      });
      setState({
        isActive: true,
        tourId: id,
        currentStep: 0,
        steps,
      });
      navigateToStep(steps[0]);
    },
    [navigateToStep, user?.isVerified]
  );

  const nextStep = useCallback(() => {
    setState((prev) => {
      const next = prev.currentStep + 1;
      if (next >= prev.steps.length) return prev; // completeTour handles this
      const nextStepData = prev.steps[next];
      if (nextStepData.route) navigate(nextStepData.route);
      return { ...prev, currentStep: next };
    });
  }, [navigate]);

  const prevStep = useCallback(() => {
    setState((prev) => {
      const p = prev.currentStep - 1;
      if (p < 0) return prev;
      const prevStepData = prev.steps[p];
      if (prevStepData.route) navigate(prevStepData.route);
      return { ...prev, currentStep: p };
    });
  }, [navigate]);

  const closeTour = useCallback((id: TourId | null) => {
    if (id) localStorage.setItem(STORAGE_KEYS[id], "1");
    setState({ isActive: false, tourId: null, currentStep: 0, steps: [] });
  }, []);

  const skipTour = useCallback(() => {
    closeTour(stateRef.current.tourId);
  }, [closeTour]);

  const completeTour = useCallback(() => {
    closeTour(stateRef.current.tourId);
  }, [closeTour]);

  const resetTour = useCallback(
    (id: TourId) => {
      localStorage.removeItem(STORAGE_KEYS[id]);
      startTour(id);
    },
    [startTour]
  );

  // Called by pages when their data-tour target finishes mounting,
  // triggering TourSpotlight to re-attempt positioning.
  const notifyTargetReady = useCallback(() => {
    setReadyNonce((n) => n + 1);
  }, []);

  return (
    <TourContext.Provider
      value={{
        ...state,
        readyNonce,
        startTour,
        nextStep,
        prevStep,
        skipTour,
        completeTour,
        resetTour,
        onTourTargetReady: notifyTargetReady,
      }}
    >
      {children}
    </TourContext.Provider>
  );
};

export const useTour = (): TourContextValue => {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used inside TourProvider");
  return ctx;
};

export default TourContext;
