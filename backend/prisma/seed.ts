import "dotenv/config";
import { PrismaClient, ServiceCategoryType } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import bcrypt from "bcrypt";

// Cria adapter libSQL apontando para o arquivo SQLite local
const adapter = new PrismaLibSql({
  url: "file:./dev.db",
});

const prisma = new PrismaClient({ adapter });

interface CategorySeed {
  name: string;
  description: string;
  icon: string;
  type: ServiceCategoryType;
  subcategories?: Omit<CategorySeed, "subcategories" | "type">[];
}

const categories: CategorySeed[] = [
  // ==================== 1. MANUTENCAO E REPAROS ====================
  {
    name: "Manutencao e Reparos",
    description: "Servicos de manutencao e reparos gerais para sua casa ou empresa",
    icon: "wrench",
    type: "BOTH",
    subcategories: [
      { name: "Eletricista", description: "Instalacoes e reparos eletricos", icon: "zap" },
      { name: "Encanador", description: "Encanamento, vazamentos e instalacoes hidraulicas", icon: "droplet" },
      { name: "Pintor", description: "Pintura interna e externa, textura e acabamentos", icon: "paintbrush" },
      { name: "Pedreiro", description: "Construcao, reformas e reparos em alvenaria", icon: "brick-wall" },
      { name: "Marceneiro", description: "Moveis sob medida, reparos e instalacao", icon: "hammer" },
      { name: "Serralheiro", description: "Grades, portoes, estruturas metalicas e reparos", icon: "fence" },
      { name: "Gesseiro", description: "Forros, divisorias, sancas e acabamentos em gesso", icon: "square" },
      { name: "Vidraceiro", description: "Instalacao e reparo de vidros e espelhos", icon: "panel-top" },
      { name: "Telhadista", description: "Reparos, manutencao e instalacao de telhados", icon: "home" },
    ],
  },

  // ==================== 2. LIMPEZA ====================
  {
    name: "Limpeza",
    description: "Servicos de limpeza residencial e comercial",
    icon: "sparkles",
    type: "BOTH",
    subcategories: [
      { name: "Limpeza Residencial", description: "Limpeza geral de casas e apartamentos", icon: "home" },
      { name: "Limpeza Comercial", description: "Limpeza de escritorios e estabelecimentos", icon: "building" },
      { name: "Limpeza Pos-Obra", description: "Limpeza especializada apos reformas", icon: "hard-hat" },
      { name: "Lavagem de Estofados", description: "Limpeza de sofas, colchoes e tapetes", icon: "sofa" },
      { name: "Limpeza de Piscina", description: "Manutencao e limpeza de piscinas", icon: "waves" },
      { name: "Dedetizacao", description: "Controle de pragas e insetos", icon: "bug" },
      { name: "Higienizacao de Ar-Condicionado", description: "Limpeza e higienizacao de splits e centrais", icon: "air-vent" },
    ],
  },

  // ==================== 3. INSTALACOES ====================
  {
    name: "Instalacoes",
    description: "Instalacao de equipamentos e sistemas",
    icon: "plug-zap",
    type: "BOTH",
    subcategories: [
      { name: "Ar Condicionado", description: "Instalacao, manutencao e limpeza de ar condicionado", icon: "air-vent" },
      { name: "Antenas e TV", description: "Instalacao de antenas, TV a cabo e satelite", icon: "tv" },
      { name: "Redes e Internet", description: "Instalacao de redes, cabeamento e configuracao", icon: "wifi" },
      { name: "Cameras de Seguranca", description: "Instalacao de cameras e sistemas de monitoramento", icon: "camera" },
      { name: "Fechaduras", description: "Instalacao e troca de fechaduras e trancas", icon: "lock" },
      { name: "Chuveiros e Torneiras", description: "Instalacao e reparo de chuveiros e torneiras", icon: "shower-head" },
      { name: "Aquecedores", description: "Instalacao de aquecedores a gas, eletricos e solares", icon: "flame" },
      { name: "Energia Solar", description: "Instalacao de paineis solares e sistemas fotovoltaicos", icon: "sun" },
    ],
  },

  // ==================== 4. CONSTRUCAO E REFORMA ====================
  {
    name: "Construcao e Reforma",
    description: "Servicos de construcao, reforma e acabamento",
    icon: "hard-hat",
    type: "BOTH",
    subcategories: [
      { name: "Reforma Residencial", description: "Reforma completa de casas e apartamentos", icon: "home" },
      { name: "Reforma Comercial", description: "Reforma de lojas, escritorios e comercios", icon: "building" },
      { name: "Alvenaria", description: "Construcao de paredes, muros e estruturas", icon: "brick-wall" },
      { name: "Acabamento", description: "Acabamentos finos, rodapes e detalhes", icon: "paintbrush" },
      { name: "Piso e Revestimento", description: "Instalacao de pisos, azulejos e porcelanatos", icon: "grid-3x3" },
      { name: "Impermeabilizacao", description: "Impermeabilizacao de lajes, paredes e piscinas", icon: "shield" },
      { name: "Projeto Arquitetonico", description: "Projetos arquitetonicos e plantas", icon: "ruler" },
    ],
  },

  // ==================== 5. BELEZA E ESTETICA ====================
  {
    name: "Beleza e Estetica",
    description: "Servicos de beleza, estetica e cuidados pessoais",
    icon: "scissors",
    type: "HOME_SERVICES",
    subcategories: [
      { name: "Cabeleireiro", description: "Corte, coloracao, tratamentos e penteados", icon: "scissors" },
      { name: "Manicure e Pedicure", description: "Cuidados com unhas das maos e pes", icon: "hand" },
      { name: "Maquiagem", description: "Maquiagem profissional para eventos e dia a dia", icon: "palette" },
      { name: "Design de Sobrancelhas", description: "Modelagem e design de sobrancelhas", icon: "eye" },
      { name: "Depilacao", description: "Depilacao com cera, laser e outros metodos", icon: "sparkles" },
      { name: "Barbearia", description: "Corte, barba e cuidados masculinos", icon: "scissors" },
      { name: "Estetica Facial", description: "Limpeza de pele, peeling e tratamentos faciais", icon: "smile" },
      { name: "Massagem", description: "Massagem relaxante, terapeutica e desportiva", icon: "heart" },
    ],
  },

  // ==================== 6. SAUDE E BEM-ESTAR ====================
  {
    name: "Saude e Bem-Estar",
    description: "Profissionais de saude e bem-estar",
    icon: "heart-pulse",
    type: "HOME_SERVICES",
    subcategories: [
      { name: "Fisioterapia", description: "Fisioterapia domiciliar e reabilitacao", icon: "activity" },
      { name: "Nutricionista", description: "Consultoria nutricional e dietas personalizadas", icon: "apple" },
      { name: "Psicologo", description: "Atendimento psicologico presencial e online", icon: "brain" },
      { name: "Enfermagem Domiciliar", description: "Servicos de enfermagem em domicilio", icon: "stethoscope" },
      { name: "Personal Trainer", description: "Treinamento fisico personalizado", icon: "dumbbell" },
      { name: "Cuidador de Idosos", description: "Acompanhamento e cuidados com idosos", icon: "heart" },
      { name: "Fonoaudiologo", description: "Tratamento de fala, audicao e linguagem", icon: "mic" },
    ],
  },

  // ==================== 7. AULAS E EDUCACAO ====================
  {
    name: "Aulas e Educacao",
    description: "Aulas particulares e cursos",
    icon: "book-open",
    type: "HOME_SERVICES",
    subcategories: [
      { name: "Reforco Escolar", description: "Aulas de reforco em todas as materias", icon: "book" },
      { name: "Aulas de Idiomas", description: "Ingles, espanhol e outros idiomas", icon: "languages" },
      { name: "Aulas de Musica", description: "Aulas de violao, piano, bateria e outros", icon: "music" },
      { name: "Aulas de Informatica", description: "Aulas de computacao e tecnologia", icon: "laptop" },
      { name: "Preparatorio Concursos", description: "Preparacao para concursos publicos", icon: "file-text" },
      { name: "Preparatorio Vestibular", description: "Preparacao para vestibular e ENEM", icon: "graduation-cap" },
      { name: "Educacao Especial", description: "Atendimento educacional especializado", icon: "heart" },
    ],
  },

  // ==================== 8. EVENTOS E FESTAS ====================
  {
    name: "Eventos e Festas",
    description: "Servicos para festas e eventos",
    icon: "party-popper",
    type: "BOTH",
    subcategories: [
      { name: "Buffet", description: "Servicos de alimentacao para eventos", icon: "utensils-crossed" },
      { name: "Decoracao de Eventos", description: "Decoracao de festas, casamentos e eventos", icon: "sparkles" },
      { name: "DJ e Sonorizacao", description: "DJ, som e iluminacao para eventos", icon: "music" },
      { name: "Fotografia de Eventos", description: "Cobertura fotografica de eventos", icon: "camera" },
      { name: "Filmagem", description: "Filmagem profissional de eventos", icon: "video" },
      { name: "Garcom", description: "Servicos de garcom e atendimento", icon: "user" },
      { name: "Cerimonialista", description: "Organizacao e cerimonial de eventos", icon: "clipboard" },
      { name: "Aluguel de Equipamentos", description: "Aluguel de mesas, cadeiras, tendas e equipamentos", icon: "package" },
    ],
  },

  // ==================== 9. SERVICOS DOMESTICOS ====================
  {
    name: "Servicos Domesticos",
    description: "Profissionais para tarefas domesticas",
    icon: "home",
    type: "HOME_SERVICES",
    subcategories: [
      { name: "Diarista", description: "Servicos de limpeza e organizacao por diaria", icon: "sparkles" },
      { name: "Passadeira", description: "Servicos de passar roupas", icon: "shirt" },
      { name: "Cozinheira", description: "Preparo de refeicoes e eventos", icon: "utensils" },
      { name: "Baba", description: "Cuidados com criancas", icon: "baby" },
      { name: "Cuidador de Idosos Domiciliar", description: "Acompanhamento domiciliar de idosos", icon: "heart" },
      { name: "Lavanderia", description: "Servicos de lavagem e passagem de roupas", icon: "shirt" },
      { name: "Organizacao de Ambientes", description: "Organizacao profissional de espacos", icon: "layout" },
    ],
  },

  // ==================== 10. PETS E ANIMAIS ====================
  {
    name: "Pets e Animais",
    description: "Cuidados e servicos para animais de estimacao",
    icon: "paw-print",
    type: "HOME_SERVICES",
    subcategories: [
      { name: "Banho e Tosa", description: "Higiene e estetica animal", icon: "scissors" },
      { name: "Pet Sitter", description: "Cuidados com pets enquanto voce viaja", icon: "cat" },
      { name: "Dog Walker", description: "Passeios com caes", icon: "dog" },
      { name: "Veterinario Domiciliar", description: "Atendimento veterinario em domicilio", icon: "stethoscope" },
      { name: "Adestramento", description: "Treinamento e adestramento de animais", icon: "award" },
    ],
  },

  // ==================== 11. JARDINAGEM E PAISAGISMO ====================
  {
    name: "Jardinagem e Paisagismo",
    description: "Cuidados com jardim, plantas e areas externas",
    icon: "leaf",
    type: "HOME_SERVICES",
    subcategories: [
      { name: "Corte de Grama", description: "Corte e manutencao de gramados", icon: "scissors" },
      { name: "Poda de Arvores", description: "Poda, remocao e tratamento de arvores", icon: "tree-pine" },
      { name: "Paisagismo", description: "Projeto e execucao de paisagismo", icon: "flower" },
      { name: "Limpeza de Terreno", description: "Limpeza e preparacao de terrenos", icon: "shovel" },
      { name: "Irrigacao", description: "Instalacao e manutencao de sistemas de irrigacao", icon: "droplet" },
      { name: "Manutencao de Jardim", description: "Cuidados gerais, adubacao e tratamento", icon: "sprout" },
    ],
  },

  // ==================== 12. MUDANCAS E FRETES ====================
  {
    name: "Mudancas e Fretes",
    description: "Transporte de moveis, mudancas e carretos",
    icon: "truck",
    type: "BOTH",
    subcategories: [
      { name: "Mudanca Residencial", description: "Mudanca completa de casas e apartamentos", icon: "package" },
      { name: "Mudanca Comercial", description: "Mudanca de escritorios e empresas", icon: "building" },
      { name: "Carreto", description: "Transporte de itens e pequenas cargas", icon: "box" },
      { name: "Montagem de Moveis", description: "Montagem e desmontagem de moveis", icon: "puzzle" },
      { name: "Embalagem", description: "Servico de embalagem para mudanca", icon: "package" },
    ],
  },

  // ==================== 13. AUTOMOTIVO ====================
  {
    name: "Automotivo",
    description: "Servicos automotivos e veiculares",
    icon: "car",
    type: "BOTH",
    subcategories: [
      { name: "Mecanica", description: "Manutencao e reparo mecanico de veiculos", icon: "wrench" },
      { name: "Auto Eletrica", description: "Servicos de eletrica automotiva", icon: "zap" },
      { name: "Funilaria e Pintura", description: "Reparo de lataria e pintura automotiva", icon: "paintbrush" },
      { name: "Vidracaria Automotiva", description: "Troca e reparo de vidros automotivos", icon: "panel-top" },
      { name: "Estetica Automotiva", description: "Polimento, lavagem detalhada e higienizacao", icon: "sparkles" },
      { name: "Borracharia", description: "Troca e reparo de pneus", icon: "circle" },
      { name: "Guincho", description: "Servico de guincho e reboque", icon: "truck" },
    ],
  },

  // ==================== 14. TECNOLOGIA E INFORMATICA ====================
  {
    name: "Tecnologia e Informatica",
    description: "Servicos de tecnologia, suporte e manutencao",
    icon: "laptop",
    type: "BOTH",
    subcategories: [
      { name: "Conserto de Celular", description: "Reparo de smartphones e tablets", icon: "smartphone" },
      { name: "Conserto de Computador", description: "Reparo de desktops e notebooks", icon: "monitor" },
      { name: "Suporte Tecnico", description: "Suporte tecnico em TI para empresas e residencias", icon: "headphones" },
      { name: "Formatacao", description: "Formatacao, backup e reinstalacao de sistemas", icon: "hard-drive" },
      { name: "Redes", description: "Instalacao e configuracao de redes locais", icon: "network" },
      { name: "Desenvolvimento Web", description: "Criacao de sites, sistemas e aplicativos", icon: "code" },
      { name: "Marketing Digital", description: "Gestao de midias sociais e marketing online", icon: "megaphone" },
    ],
  },

  // ==================== 15. CONSERTOS E ASSISTENCIA TECNICA ====================
  {
    name: "Consertos e Assistencia Tecnica",
    description: "Reparos em eletrodomesticos e eletronicos",
    icon: "settings",
    type: "BOTH",
    subcategories: [
      { name: "Eletrodomesticos", description: "Reparo de geladeiras, maquinas de lavar, fogoes", icon: "refrigerator" },
      { name: "Eletronicos", description: "Reparo de TVs, caixas de som e equipamentos", icon: "monitor" },
      { name: "Maquinas de Costura", description: "Reparo e manutencao de maquinas de costura", icon: "scissors" },
      { name: "Celulares", description: "Assistencia tecnica especializada em celulares", icon: "smartphone" },
      { name: "Notebooks", description: "Assistencia tecnica em notebooks e ultrabooks", icon: "laptop" },
      { name: "Impressoras", description: "Reparo e manutencao de impressoras e scanners", icon: "printer" },
    ],
  },

  // ==================== 16. MODA E COSTURA ====================
  {
    name: "Moda e Costura",
    description: "Servicos de costura, ajustes e confeccao",
    icon: "scissors",
    type: "HOME_SERVICES",
    subcategories: [
      { name: "Costureira", description: "Confeccao e ajuste de roupas", icon: "scissors" },
      { name: "Alfaiate", description: "Confeccao e ajuste de roupas masculinas", icon: "shirt" },
      { name: "Customizacao", description: "Customizacao e personalizacao de pecas", icon: "palette" },
      { name: "Bordado", description: "Bordados manuais e industriais", icon: "pen-tool" },
      { name: "Conserto de Roupas", description: "Reparos em roupas e tecidos", icon: "scissors" },
    ],
  },

  // ==================== 17. SERVICOS RURAIS E AGRICOLAS ====================
  {
    name: "Servicos Rurais e Agricolas",
    description: "Servicos para zona rural e agricultura",
    icon: "tractor",
    type: "BOTH",
    subcategories: [
      { name: "Perfuracao de Poco", description: "Perfuracao de pocos artesianos e semi-artesianos", icon: "droplet" },
      { name: "Cerca e Alambrado", description: "Instalacao de cercas, alambrados e porteiras", icon: "fence" },
      { name: "Trator e Terraplanagem", description: "Servicos de trator, terraplanagem e nivelamento", icon: "tractor" },
      { name: "Consultoria Agricola", description: "Consultoria tecnica para agricultura", icon: "sprout" },
      { name: "Irrigacao Rural", description: "Sistemas de irrigacao para propriedades rurais", icon: "droplet" },
    ],
  },

  // ==================== 18. DESIGN E COMUNICACAO ====================
  {
    name: "Design e Comunicacao",
    description: "Servicos de design, comunicacao visual e midia",
    icon: "palette",
    type: "BOTH",
    subcategories: [
      { name: "Design Grafico", description: "Logotipos, cartoes, banners e material grafico", icon: "palette" },
      { name: "Social Media", description: "Gestao de redes sociais e criacao de conteudo", icon: "share-2" },
      { name: "Fotografia Profissional", description: "Fotografia de produtos, retratos e ensaios", icon: "camera" },
      { name: "Filmagem Profissional", description: "Producao de videos institucionais e comerciais", icon: "video" },
      { name: "Impressao e Grafica", description: "Servicos de impressao, plotagem e acabamento grafico", icon: "printer" },
    ],
  },

  // ==================== 19. CONSULTORIA E SERVICOS PROFISSIONAIS ====================
  {
    name: "Consultoria e Servicos Profissionais",
    description: "Servicos profissionais especializados",
    icon: "briefcase",
    type: "BUSINESS_SERVICES",
    subcategories: [
      { name: "Contabilidade", description: "Servicos contabeis e fiscais", icon: "calculator" },
      { name: "Advocacia", description: "Consultoria e assessoria juridica", icon: "scale" },
      { name: "Despachante", description: "Servicos de despachante e documentacao", icon: "file-text" },
      { name: "Corretor de Imoveis", description: "Intermediacao de compra, venda e aluguel", icon: "home" },
      { name: "Consultoria Financeira", description: "Planejamento e consultoria financeira", icon: "trending-up" },
      { name: "RH", description: "Recrutamento, selecao e gestao de pessoas", icon: "users" },
    ],
  },

  // ==================== 20. SEGURANCA ====================
  {
    name: "Seguranca",
    description: "Servicos de seguranca patrimonial e pessoal",
    icon: "shield",
    type: "BOTH",
    subcategories: [
      { name: "Porteiro", description: "Servicos de portaria e controle de acesso", icon: "door-open" },
      { name: "Vigilante", description: "Vigilancia patrimonial e seguranca armada", icon: "shield" },
      { name: "Instalacao de Alarmes", description: "Instalacao de sistemas de alarme", icon: "bell" },
      { name: "Monitoramento", description: "Monitoramento eletronico 24h", icon: "eye" },
      { name: "Escolta", description: "Servicos de escolta e seguranca pessoal", icon: "shield-check" },
    ],
  },
];

async function seedCategories() {
  console.log("Iniciando seed de categorias...\n");

  for (const category of categories) {
    console.log(`Criando categoria: ${category.name}`);

    // Criar categoria pai
    const parentCategory = await prisma.serviceCategory.upsert({
      where: { name: category.name },
      update: {
        description: category.description,
        icon: category.icon,
        type: category.type,
      },
      create: {
        name: category.name,
        description: category.description,
        icon: category.icon,
        type: category.type,
      },
    });

    // Criar subcategorias
    if (category.subcategories) {
      for (const subcategory of category.subcategories) {
        console.log(`  - Criando subcategoria: ${subcategory.name}`);

        await prisma.serviceCategory.upsert({
          where: { name: subcategory.name },
          update: {
            description: subcategory.description,
            icon: subcategory.icon,
            parentCategoryId: parentCategory.id,
            type: category.type,
          },
          create: {
            name: subcategory.name,
            description: subcategory.description,
            icon: subcategory.icon,
            parentCategoryId: parentCategory.id,
            type: category.type,
          },
        });
      }
    }
  }

  console.log("\nSeed de categorias concluido!");
}

async function seedEscrowConfig() {
  console.log("\nCriando configuracao de escrow...");

  await prisma.escrowConfig.upsert({
    where: { name: "default" },
    update: {},
    create: {
      name: "default",
      description: "Configuracao padrao de escrow para a plataforma",
      defaultHoldDays: 7,
      autoReleaseDays: 2,
      disputePeriodDays: 3,
      platformFeePercentage: 10.0,
      minServiceValue: 20.0,
      maxServiceValue: 50000.0,
    },
  });

  console.log("Configuracao de escrow criada!");
}

async function seedSystemConfig() {
  console.log("\nCriando configuracoes do sistema...");

  const configs = [
    {
      key: "platform_name",
      value: JSON.stringify("FazTudo"),
      description: "Nome da plataforma",
    },
    {
      key: "support_email",
      value: JSON.stringify("suporte@faztudo.com.br"),
      description: "Email de suporte",
    },
    {
      key: "support_phone",
      value: JSON.stringify("(11) 99999-9999"),
      description: "Telefone de suporte",
    },
    {
      key: "min_order_value",
      value: JSON.stringify(20),
      description: "Valor minimo de um pedido em reais",
    },
    {
      key: "max_order_value",
      value: JSON.stringify(50000),
      description: "Valor maximo de um pedido em reais",
    },
    {
      key: "deadline_warning_days",
      value: JSON.stringify(1),
      description: "Dias antes do prazo para enviar aviso",
    },
    {
      key: "max_deadline_extension_days",
      value: JSON.stringify(7),
      description: "Maximo de dias para extensao de prazo",
    },
    {
      key: "review_deadline_days",
      value: JSON.stringify(7),
      description: "Dias para deixar avaliacao apos conclusao",
    },
  ];

  for (const config of configs) {
    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: { value: config.value },
      create: config,
    });
  }

  console.log("Configuracoes do sistema criadas!");
}

async function seedTestUsers() {
  console.log("\nCriando usuarios de teste...");

  const hashedPassword = await bcrypt.hash("Teste@123", 10);

  // Admin de teste (para painel admin)
  const admin = await prisma.user.upsert({
    where: { email: "admin@faztudo.com" },
    update: {},
    create: {
      email: "admin@faztudo.com",
      name: "Admin FazTudo",
      phone: "(11) 90000-0000",
      password: hashedPassword,
      role: "ADMIN",
      status: "ACTIVE",
      isVerified: true,
      emailVerified: true,
      bio: "Administrador da plataforma FazTudo",
    },
  });

  console.log(`  - Admin: ${admin.email} (id: ${admin.id}) — Senha: Teste@123`);

  // Cliente de teste
  const client = await prisma.user.upsert({
    where: { email: "cliente@teste.com" },
    update: {},
    create: {
      email: "cliente@teste.com",
      name: "Maria Silva",
      phone: "(11) 98888-1234",
      password: hashedPassword,
      role: "CLIENT",
      status: "ACTIVE",
      document: "123.456.789-00",
      isVerified: true,
      bio: "Cliente de teste da plataforma FazTudo",
    },
  });

  // Profissional de teste
  const professional = await prisma.user.upsert({
    where: { email: "profissional@teste.com" },
    update: {},
    create: {
      email: "profissional@teste.com",
      name: "Joao Santos",
      phone: "(11) 97777-5678",
      password: hashedPassword,
      role: "PROFESSIONAL",
      status: "ACTIVE",
      document: "987.654.321-00",
      isVerified: true,
      bio: "Profissional experiente em manutencao residencial e eletrica. Mais de 10 anos de experiencia.",
      ratingAverage: 4.8,
      totalReviews: 25,
    },
  });

  // Segundo profissional
  const professional2 = await prisma.user.upsert({
    where: { email: "profissional2@teste.com" },
    update: {},
    create: {
      email: "profissional2@teste.com",
      name: "Ana Oliveira",
      phone: "(11) 96666-9012",
      password: hashedPassword,
      role: "PROFESSIONAL",
      status: "ACTIVE",
      document: "456.789.123-00",
      isVerified: true,
      bio: "Especialista em limpeza residencial e pos-obra. Atendimento com qualidade e pontualidade.",
      ratingAverage: 4.9,
      totalReviews: 42,
    },
  });

  console.log(`  - Cliente: ${client.email} (id: ${client.id})`);
  console.log(
    `  - Profissional 1: ${professional.email} (id: ${professional.id})`,
  );
  console.log(
    `  - Profissional 2: ${professional2.email} (id: ${professional2.id})`,
  );

  const ensureApprovedVerification = async (userId: number) => {
    const hasDocumentApproval = await prisma.verificationSubmission.findFirst({
      where: {
        userId,
        type: "DOCUMENT",
        status: "APPROVED",
      },
    });

    if (!hasDocumentApproval) {
      await prisma.verificationSubmission.create({
        data: {
          userId,
          type: "DOCUMENT",
          status: "APPROVED",
          reviewedAt: new Date(),
          metadata: {
            source: "seed",
            note: "Conta de teste verificada para desenvolvimento",
          },
        },
      });
    }

    const hasFacialApproval = await prisma.verificationSubmission.findFirst({
      where: {
        userId,
        type: "FACIAL",
        status: "APPROVED",
      },
    });

    if (!hasFacialApproval) {
      await prisma.verificationSubmission.create({
        data: {
          userId,
          type: "FACIAL",
          status: "APPROVED",
          reviewedAt: new Date(),
          metadata: {
            source: "seed",
            note: "Conta de teste verificada para desenvolvimento",
          },
        },
      });
    }
  };

  await Promise.all([
    ensureApprovedVerification(client.id),
    ensureApprovedVerification(professional.id),
    ensureApprovedVerification(professional2.id),
  ]);
  console.log("  - Verificacoes de documento e facial simuladas para testes!");

  // Vincular profissionais a categorias
  const eletricista = await prisma.serviceCategory.findFirst({
    where: { name: "Eletricista" },
  });
  const encanador = await prisma.serviceCategory.findFirst({
    where: { name: "Encanador" },
  });
  const pintor = await prisma.serviceCategory.findFirst({
    where: { name: "Pintor" },
  });
  const limpezaResidencial = await prisma.serviceCategory.findFirst({
    where: { name: "Limpeza Residencial" },
  });
  const limpezaPosObra = await prisma.serviceCategory.findFirst({
    where: { name: "Limpeza Pos-Obra" },
  });
  const arCondicionado = await prisma.serviceCategory.findFirst({
    where: { name: "Ar Condicionado" },
  });
  const montagem = await prisma.serviceCategory.findFirst({
    where: { name: "Montagem de Moveis" },
  });

  if (eletricista) {
    await prisma.professionalCategory.upsert({
      where: {
        userId_categoryId: {
          userId: professional.id,
          categoryId: eletricista.id,
        },
      },
      update: {},
      create: {
        userId: professional.id,
        categoryId: eletricista.id,
        experienceYears: 10,
        hourlyRate: 80,
        isPrimary: true,
      },
    });
  }
  if (encanador) {
    await prisma.professionalCategory.upsert({
      where: {
        userId_categoryId: {
          userId: professional.id,
          categoryId: encanador.id,
        },
      },
      update: {},
      create: {
        userId: professional.id,
        categoryId: encanador.id,
        experienceYears: 8,
        hourlyRate: 70,
        isPrimary: false,
      },
    });
  }
  if (limpezaResidencial) {
    await prisma.professionalCategory.upsert({
      where: {
        userId_categoryId: {
          userId: professional2.id,
          categoryId: limpezaResidencial.id,
        },
      },
      update: {},
      create: {
        userId: professional2.id,
        categoryId: limpezaResidencial.id,
        experienceYears: 6,
        hourlyRate: 50,
        isPrimary: true,
      },
    });
  }
  if (limpezaPosObra) {
    await prisma.professionalCategory.upsert({
      where: {
        userId_categoryId: {
          userId: professional2.id,
          categoryId: limpezaPosObra.id,
        },
      },
      update: {},
      create: {
        userId: professional2.id,
        categoryId: limpezaPosObra.id,
        experienceYears: 4,
        hourlyRate: 65,
        isPrimary: false,
      },
    });
  }

  console.log("  - Categorias profissionais vinculadas!");

  // Criar service listings de exemplo
  const listings = [
    {
      title: "Instalacao e reparo eletrico residencial",
      description:
        "Servico completo de instalacao e reparo eletrico. Inclui troca de tomadas, interruptores, disjuntores, fiacao e instalacao de lustres. Profissional certificado com NR10.",
      price: 150,
      estimatedHours: 3,
      professionalId: professional.id,
      categoryId: eletricista?.id || 1,
      images: JSON.stringify([]),
      tags: JSON.stringify(["eletrica", "instalacao", "reparo", "residencial"]),
    },
    {
      title: "Conserto de vazamentos e encanamento",
      description:
        "Identificacao e conserto de vazamentos, desentupimento de pias e ralos, troca de torneiras e sifoes. Atendimento rapido e eficiente.",
      price: 120,
      estimatedHours: 2,
      professionalId: professional.id,
      categoryId: encanador?.id || 1,
      images: JSON.stringify([]),
      tags: JSON.stringify(["encanamento", "vazamento", "desentupimento"]),
    },
    {
      title: "Instalacao completa de ponto eletrico",
      description:
        "Instalacao de novo ponto eletrico incluindo passagem de fiacao, instalacao de caixa e acabamento. Ideal para novas tomadas ou pontos de iluminacao.",
      price: 250,
      estimatedHours: 4,
      professionalId: professional.id,
      categoryId: eletricista?.id || 1,
      images: JSON.stringify([]),
      tags: JSON.stringify(["eletrica", "ponto eletrico", "instalacao"]),
    },
    {
      title: "Limpeza residencial completa",
      description:
        "Limpeza completa de casas e apartamentos. Inclui limpeza de todos os comodos, banheiros, cozinha, vidros e organizacao. Produtos de limpeza inclusos.",
      price: 200,
      estimatedHours: 6,
      professionalId: professional2.id,
      categoryId: limpezaResidencial?.id || 1,
      images: JSON.stringify([]),
      tags: JSON.stringify([
        "limpeza",
        "residencial",
        "completa",
        "organizacao",
      ]),
    },
    {
      title: "Limpeza pos-obra",
      description:
        "Limpeza especializada apos reformas e construcoes. Remocao de residuos de obra, limpeza pesada de pisos, azulejos, vidros e esquadrias.",
      price: 350,
      estimatedHours: 8,
      professionalId: professional2.id,
      categoryId: limpezaPosObra?.id || 1,
      images: JSON.stringify([]),
      tags: JSON.stringify(["limpeza", "pos-obra", "reforma", "construcao"]),
    },
    {
      title: "Limpeza de apartamento ate 80m2",
      description:
        "Limpeza completa para apartamentos de ate 80m2. Ideal para manutencao semanal ou quinzenal. Inclui aspiracao, lavagem de pisos e limpeza de banheiros.",
      price: 150,
      estimatedHours: 4,
      professionalId: professional2.id,
      categoryId: limpezaResidencial?.id || 1,
      images: JSON.stringify([]),
      tags: JSON.stringify(["limpeza", "apartamento", "manutencao"]),
    },
    {
      title: "Troca de quadro de disjuntores",
      description:
        "Substituicao completa do quadro de disjuntores. Inclui avaliacao da carga eletrica, dimensionamento correto dos disjuntores e teste final.",
      price: 450,
      estimatedHours: 5,
      professionalId: professional.id,
      categoryId: eletricista?.id || 1,
      images: JSON.stringify([]),
      tags: JSON.stringify(["eletrica", "disjuntor", "quadro eletrico"]),
    },
    {
      title: "Instalacao de chuveiro eletrico",
      description:
        "Instalacao ou troca de chuveiro eletrico com fiacao adequada. Inclui teste de funcionamento e orientacao de uso.",
      price: 100,
      estimatedHours: 1,
      professionalId: professional.id,
      categoryId: eletricista?.id || 1,
      images: JSON.stringify([]),
      tags: JSON.stringify(["chuveiro", "eletrica", "instalacao"]),
    },
  ];

  for (const listing of listings) {
    const existing = await prisma.serviceListing.findFirst({
      where: { title: listing.title, professionalId: listing.professionalId },
    });
    if (!existing) {
      await prisma.serviceListing.create({
        data: {
          ...listing,
          isAvailable: true,
        },
      });
    }
  }

  console.log(`  - ${listings.length} service listings criados!`);

  // Criar endereco para o cliente (Vila Centenario, Iguatu-CE)
  const existingAddress = await prisma.address.findFirst({
    where: { userId: client.id },
  });
  if (!existingAddress) {
    await prisma.address.create({
      data: {
        street: "Rua Jose de Alencar",
        number: "245",
        complement: "",
        neighborhood: "Vila Centenario",
        city: "Iguatu",
        state: "CE",
        zipCode: "63502-000",
        country: "Brasil",
        latitude: -6.3780,
        longitude: -39.3260,
        userId: client.id,
      },
    });
  }

  console.log("  - Endereco do cliente criado!");

  // Criar endereco para o profissional (Cajazeiras, Iguatu-CE — ~5km do cliente)
  const existingProAddress = await prisma.address.findFirst({
    where: { userId: professional.id },
  });
  if (!existingProAddress) {
    await prisma.address.create({
      data: {
        street: "Rua Floriano Peixoto",
        number: "320",
        complement: "Casa",
        neighborhood: "Cajazeiras",
        city: "Iguatu",
        state: "CE",
        zipCode: "63500-065",
        country: "Brasil",
        latitude: -6.3480,
        longitude: -39.2910,
        userId: professional.id,
      },
    });
  }

  console.log("  - Endereco do profissional criado!");

  // ============================================
  // SEED DE PEDIDOS (ServiceOrders)
  // ============================================
  console.log("\n  Limpando pedidos antigos...");

  // Limpar todos os pedidos existentes e dados relacionados
  await prisma.review.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.serviceOrder.deleteMany({});

  console.log("  - Pedidos antigos removidos!");
  console.log("  Criando 10 pedidos PENDING de teste...");

  const prof1Listings = await prisma.serviceListing.findMany({
    where: { professionalId: professional.id },
  });
  const prof2Listings = await prisma.serviceListing.findMany({
    where: { professionalId: professional2.id },
  });

  const allListings = [...prof1Listings, ...prof2Listings];
  const orders: any[] = [];

  // 10 pedidos PENDING — todos podem ser aceitos ou recusados
  const pendingOrderDescriptions = [
    { title: "Trocar tomada da sala", desc: "Preciso trocar 3 tomadas que estao com mal contato na sala de estar." },
    { title: "Consertar vazamento na cozinha", desc: "A torneira da cozinha esta pingando e o sifao parece solto." },
    { title: "Instalar ventilador de teto", desc: "Quero instalar um ventilador de teto no quarto. Ja tenho o ventilador." },
    { title: "Trocar disjuntor do chuveiro", desc: "O disjuntor do chuveiro esta desarmando toda hora. Preciso trocar." },
    { title: "Limpeza geral do apartamento", desc: "Apartamento de 70m2, 2 quartos. Limpeza completa incluindo banheiros e cozinha." },
    { title: "Limpeza pos-reforma do banheiro", desc: "Reformei o banheiro e preciso de limpeza pesada para remover residuos de obra." },
    { title: "Instalar ponto eletrico na varanda", desc: "Preciso de um ponto eletrico novo na varanda para ligar uma churrasqueira eletrica." },
    { title: "Desentupir ralo do banheiro", desc: "O ralo do banheiro esta entupido e a agua demora a escoar." },
    { title: "Limpeza de apartamento para mudanca", desc: "Estou me mudando e preciso entregar o apartamento limpo. 80m2, 3 quartos." },
    { title: "Trocar fiacao antiga do quarto", desc: "A fiacao do quarto e antiga e preciso trocar por seguranca. Quarto de 15m2." },
  ];

  for (let i = 0; i < 10; i++) {
    const listing = allListings[i % allListings.length];
    if (!listing) continue;

    const profId = listing.professionalId;
    const orderInfo = pendingOrderDescriptions[i]!;

    const order = await prisma.serviceOrder.create({
      data: {
        title: orderInfo.title,
        serviceListingId: listing.id,
        clientId: client.id,
        professionalId: profId,
        status: "PENDING",
        price: listing.price + (i * 15), // Precos variados
        description: orderInfo.desc,
        scheduledDate: new Date(Date.now() + (i + 1) * 2 * 24 * 60 * 60 * 1000), // A cada 2 dias
      },
    });
    orders.push(order);
  }

  console.log(`  - ${orders.length} pedidos PENDING criados!`);

  // (Sem pagamentos/transacoes — todos pedidos sao PENDING)
  // Zerar saldo dos profissionais
  await prisma.user.update({
    where: { id: professional.id },
    data: { balance: 0 },
  });
  await prisma.user.update({
    where: { id: professional2.id },
    data: { balance: 0 },
  });

  console.log("  - Saldos zerados (sem pedidos concluidos)!");

  // (Sem reviews — todos pedidos sao PENDING)
  console.log("  - Sem reviews (nenhum pedido concluido)!");

  // ============================================
  // SEED DE AGENDA PROFISSIONAL
  // ============================================
  console.log("  Criando agenda profissional de teste...");

  const existingSchedule = await prisma.professionalSchedule.findFirst({
    where: { professionalId: professional.id },
  });

  if (!existingSchedule) {
    const scheduleData = [
      { dayOfWeek: 1, startTime: "08:00", endTime: "18:00" }, // Segunda
      { dayOfWeek: 2, startTime: "08:00", endTime: "18:00" }, // Terca
      { dayOfWeek: 3, startTime: "08:00", endTime: "18:00" }, // Quarta
      { dayOfWeek: 4, startTime: "08:00", endTime: "18:00" }, // Quinta
      { dayOfWeek: 5, startTime: "08:00", endTime: "17:00" }, // Sexta
      { dayOfWeek: 6, startTime: "09:00", endTime: "13:00" }, // Sabado
    ];

    for (const schedule of scheduleData) {
      await prisma.professionalSchedule.create({
        data: {
          professionalId: professional.id,
          ...schedule,
          isAvailable: true,
        },
      });
    }
  }

  console.log("  - Agenda profissional criada!");

  // ============================================
  // SEED DE NOTIFICACOES
  // ============================================
  console.log("  Criando notificacoes de teste...");

  // Notificacoes para o profissional sobre novos pedidos
  for (let i = 0; i < Math.min(5, orders.length); i++) {
    const order = orders[i];
    await prisma.notification.create({
      data: {
        type: "ORDER_CREATED",
        title: "Novo pedido recebido",
        message: `Voce recebeu um novo pedido: "${order.title}".`,
        userId: order.professionalId,
        status: "UNREAD",
      },
    });
  }

  // Notificacao para o cliente
  await prisma.notification.create({
    data: {
      type: "ORDER_CREATED",
      title: "Pedido enviado",
      message: "Seus pedidos foram enviados com sucesso. Aguarde a resposta dos profissionais.",
      userId: client.id,
      status: "UNREAD",
    },
  });

  console.log("  - Notificacoes de teste criadas!");

  // Empresa de teste
  const empresaUser = await prisma.user.upsert({
    where: { email: "empresa@teste.com" },
    update: {},
    create: {
      email: "empresa@teste.com",
      name: "Empresa FazTudo Demo",
      password: await bcrypt.hash("Teste@123", 10),
      role: "COMPANY",
      status: "ACTIVE",
      isVerified: true,
      emailVerified: true,
    },
  });

  await prisma.companyProfile.upsert({
    where: { userId: empresaUser.id },
    update: {},
    create: {
      userId: empresaUser.id,
      companyName: "FazTudo Serviços Ltda",
      cnpj: "12345678000196",
      description: "Empresa de demonstração para serviços domésticos e empresariais.",
      isVerified: true,
      industry: "Serviços",
    },
  });

  console.log(`  - Empresa: ${empresaUser.email} (id: ${empresaUser.id})`);

  // Add default role and channel for the test company
  const empresaProfile = await prisma.companyProfile.findUnique({
    where: { cnpj: "12345678000196" },
  });

  if (empresaProfile) {
    const existingRole = await prisma.companyRole.findFirst({
      where: { companyId: empresaProfile.id, name: "Operacional" },
    });
    if (!existingRole) {
      await prisma.companyRole.create({
        data: {
          companyId: empresaProfile.id,
          name: "Operacional",
          level: 3,
          permissions: {
            metrics: { view: false, viewTeam: false },
            chat: { view: true, respond: true, manage: false },
            orders: { view: true, assign: false, manage: false },
            finance: { view: false, transfer: false, salary: false },
            team: { view: false, invite: false, manage: false },
            catalog: { edit: true },
            company: { settings: false, roles: false },
          },
        },
      });
    }

    const existingChannel = await prisma.companyChannel.findFirst({
      where: { companyId: empresaProfile.id, name: "Atendimento Geral" },
    });
    if (!existingChannel) {
      await prisma.companyChannel.create({
        data: {
          companyId: empresaProfile.id,
          name: "Atendimento Geral",
          description: "Canal principal de atendimento ao cliente",
        },
      });
    }
  }


  console.log("Usuarios de teste criados com sucesso!");
  console.log("  (Consulte o seed.ts para credenciais de teste)");
  console.log("  admin@faztudo.com / Teste@123 (ADMIN)");
  console.log("  empresa@teste.com / Teste@123 (COMPANY)");
}

async function main() {
  console.log("=".repeat(50));
  console.log("SEED DO BANCO DE DADOS - FAZTUDO");
  console.log("=".repeat(50));
  console.log("");

  // Guard: only allow seed in development/test environments
  const nodeEnv = process.env.NODE_ENV || 'development';
  if (nodeEnv === 'production') {
    console.error("FATAL: Seed cannot be run in production environment!");
    process.exit(1);
  }
  console.log(`Environment: ${nodeEnv}`);

  try {
    await seedCategories();
    await seedEscrowConfig();
    await seedSystemConfig();
    await seedTestUsers();

    // Estatisticas finais
    const categoryCount = await prisma.serviceCategory.count();
    const parentCount = await prisma.serviceCategory.count({
      where: { parentCategoryId: null },
    });
    const subcategoryCount = await prisma.serviceCategory.count({
      where: { NOT: { parentCategoryId: null } },
    });

    console.log("\n" + "=".repeat(50));
    console.log("SEED CONCLUIDO COM SUCESSO!");
    console.log("=".repeat(50));
    console.log(`Total de categorias: ${categoryCount}`);
    console.log(`  - Categorias principais: ${parentCount}`);
    console.log(`  - Subcategorias: ${subcategoryCount}`);
    console.log("=".repeat(50));
  } catch (error) {
    console.error("Erro durante o seed:", error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
