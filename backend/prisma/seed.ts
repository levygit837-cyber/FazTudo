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
  // ==================== SERVICOS DOMESTICOS ====================
  {
    name: "Manutencao Geral",
    description: "Servicos de manutencao e reparos gerais para sua casa",
    icon: "wrench",
    type: "HOME_SERVICES",
    subcategories: [
      {
        name: "Eletricista",
        description: "Instalacoes e reparos eletricos residenciais",
        icon: "zap",
      },
      {
        name: "Encanador",
        description:
          "Servicos de encanamento, vazamentos e instalacoes hidraulicas",
        icon: "droplet",
      },
      {
        name: "Pintor",
        description: "Pintura interna e externa, textura e acabamentos",
        icon: "paintbrush",
      },
      {
        name: "Pedreiro",
        description: "Construcao, reformas e reparos em alvenaria",
        icon: "brick-wall",
      },
      {
        name: "Marceneiro",
        description: "Moveis sob medida, reparos e instalacao de moveis",
        icon: "hammer",
      },
      {
        name: "Serralheiro",
        description: "Grades, portoes, estruturas metalicas e reparos",
        icon: "fence",
      },
      {
        name: "Gesseiro",
        description: "Forros, divisorias, sancas e acabamentos em gesso",
        icon: "square",
      },
    ],
  },
  {
    name: "Jardinagem",
    description: "Cuidados com jardim, plantas e areas externas",
    icon: "leaf",
    type: "HOME_SERVICES",
    subcategories: [
      {
        name: "Corte de Grama",
        description: "Corte e manutencao de gramados",
        icon: "scissors",
      },
      {
        name: "Poda de Arvores",
        description: "Poda, remocao e tratamento de arvores",
        icon: "tree-pine",
      },
      {
        name: "Paisagismo",
        description: "Projeto e execucao de paisagismo",
        icon: "flower",
      },
      {
        name: "Manutencao de Jardim",
        description: "Cuidados gerais, adubacao e irrigacao",
        icon: "sprout",
      },
      {
        name: "Limpeza de Terreno",
        description: "Limpeza e preparacao de terrenos",
        icon: "shovel",
      },
    ],
  },
  {
    name: "Limpeza",
    description: "Servicos de limpeza residencial e comercial",
    icon: "sparkles",
    type: "BOTH",
    subcategories: [
      {
        name: "Limpeza Residencial",
        description: "Limpeza geral de casas e apartamentos",
        icon: "home",
      },
      {
        name: "Limpeza Pos-Obra",
        description: "Limpeza especializada apos reformas e construcoes",
        icon: "hard-hat",
      },
      {
        name: "Lavagem de Estofados",
        description: "Limpeza de sofas, colchoes, tapetes e cortinas",
        icon: "sofa",
      },
      {
        name: "Limpeza de Vidros",
        description: "Limpeza de janelas, fachadas e vidros em geral",
        icon: "square",
      },
      {
        name: "Limpeza de Piscina",
        description: "Manutencao e limpeza de piscinas",
        icon: "waves",
      },
      {
        name: "Dedetizacao",
        description: "Controle de pragas e insetos",
        icon: "bug",
      },
    ],
  },
  {
    name: "Consertos",
    description: "Reparos em eletrodomesticos, moveis e equipamentos",
    icon: "settings",
    type: "HOME_SERVICES",
    subcategories: [
      {
        name: "Eletrodomesticos",
        description: "Reparo de geladeiras, maquinas de lavar, fogoes, etc.",
        icon: "refrigerator",
      },
      {
        name: "Moveis",
        description: "Reparo e restauracao de moveis",
        icon: "armchair",
      },
      {
        name: "Eletronicos",
        description: "Reparo de TVs, computadores, celulares, etc.",
        icon: "monitor",
      },
      {
        name: "Pequenos Eletrodomesticos",
        description: "Reparo de liquidificadores, ventiladores, ferros, etc.",
        icon: "plug",
      },
    ],
  },
  {
    name: "Instalacoes",
    description: "Instalacao de equipamentos e sistemas",
    icon: "plug-zap",
    type: "BOTH",
    subcategories: [
      {
        name: "Ar Condicionado",
        description: "Instalacao, manutencao e limpeza de ar condicionado",
        icon: "air-vent",
      },
      {
        name: "Antenas e TV",
        description: "Instalacao de antenas, TV a cabo e satelite",
        icon: "tv",
      },
      {
        name: "Redes e Internet",
        description: "Instalacao de redes, cabeamento e configuracao",
        icon: "wifi",
      },
      {
        name: "Fechaduras e Seguranca",
        description: "Instalacao de fechaduras, cameras e alarmes",
        icon: "lock",
      },
      {
        name: "Aquecedores",
        description: "Instalacao de aquecedores a gas, eletricos e solares",
        icon: "flame",
      },
      {
        name: "Chuveiros e Torneiras",
        description: "Instalacao e reparo de chuveiros, torneiras e duchas",
        icon: "shower-head",
      },
    ],
  },
  {
    name: "Mudancas e Fretes",
    description: "Transporte de moveis, mudancas e carretos",
    icon: "truck",
    type: "BOTH",
    subcategories: [
      {
        name: "Mudanca Residencial",
        description: "Mudanca completa de casas e apartamentos",
        icon: "package",
      },
      {
        name: "Carreto",
        description: "Transporte de itens e pequenas cargas",
        icon: "box",
      },
      {
        name: "Montagem de Moveis",
        description: "Montagem e desmontagem de moveis",
        icon: "puzzle",
      },
    ],
  },

  // ==================== SERVICOS EMPRESARIAIS ====================
  {
    name: "Manutencao de Escritorio",
    description: "Servicos de manutencao para ambientes corporativos",
    icon: "building",
    type: "BUSINESS_SERVICES",
    subcategories: [
      {
        name: "Manutencao Predial",
        description: "Manutencao geral de edificios comerciais",
        icon: "building-2",
      },
      {
        name: "Manutencao de Elevadores",
        description: "Manutencao preventiva e corretiva de elevadores",
        icon: "move-vertical",
      },
      {
        name: "Sistemas de Seguranca",
        description: "Instalacao e manutencao de sistemas de seguranca",
        icon: "shield",
      },
    ],
  },
  {
    name: "Limpeza Comercial",
    description: "Servicos de limpeza para empresas e comercios",
    icon: "building",
    type: "BUSINESS_SERVICES",
    subcategories: [
      {
        name: "Limpeza de Escritorios",
        description: "Limpeza diaria ou periodica de escritorios",
        icon: "briefcase",
      },
      {
        name: "Limpeza de Lojas",
        description: "Limpeza de estabelecimentos comerciais",
        icon: "store",
      },
      {
        name: "Limpeza de Fachadas",
        description: "Limpeza de fachadas e areas externas",
        icon: "building-2",
      },
    ],
  },
  {
    name: "Servicos de TI",
    description: "Suporte tecnico e servicos de tecnologia",
    icon: "laptop",
    type: "BUSINESS_SERVICES",
    subcategories: [
      {
        name: "Suporte Tecnico",
        description: "Suporte a computadores, impressoras e redes",
        icon: "headphones",
      },
      {
        name: "Infraestrutura de Rede",
        description: "Instalacao e configuracao de redes corporativas",
        icon: "network",
      },
      {
        name: "Backup e Recuperacao",
        description: "Servicos de backup e recuperacao de dados",
        icon: "database",
      },
    ],
  },
  {
    name: "Manutencao de Equipamentos",
    description: "Reparo e manutencao de equipamentos comerciais",
    icon: "cog",
    type: "BUSINESS_SERVICES",
    subcategories: [
      {
        name: "Equipamentos de Cozinha Industrial",
        description: "Manutencao de fogoes, fornos, refrigeradores industriais",
        icon: "chef-hat",
      },
      {
        name: "Maquinas de Cafe",
        description: "Manutencao de maquinas de cafe e bebidas",
        icon: "coffee",
      },
      {
        name: "Impressoras e Copiadoras",
        description: "Manutencao de impressoras, copiadoras e scanners",
        icon: "printer",
      },
    ],
  },

  // ==================== SERVICOS ESPECIALIZADOS ====================
  {
    name: "Servicos Domesticos",
    description: "Profissionais para tarefas domesticas",
    icon: "home",
    type: "HOME_SERVICES",
    subcategories: [
      {
        name: "Diarista",
        description: "Servicos de limpeza e organizacao por diaria",
        icon: "sparkles",
      },
      {
        name: "Passadeira",
        description: "Servicos de passar roupas",
        icon: "shirt",
      },
      {
        name: "Cozinheira",
        description: "Preparo de refeicoes e eventos",
        icon: "utensils",
      },
      {
        name: "Babá",
        description: "Cuidados com criancas",
        icon: "baby",
      },
      {
        name: "Cuidador de Idosos",
        description: "Acompanhamento e cuidados com idosos",
        icon: "heart",
      },
    ],
  },
  {
    name: "Servicos para Pets",
    description: "Cuidados e servicos para animais de estimacao",
    icon: "paw-print",
    type: "HOME_SERVICES",
    subcategories: [
      {
        name: "Dog Walker",
        description: "Passeios com caes",
        icon: "dog",
      },
      {
        name: "Pet Sitter",
        description: "Cuidados com pets enquanto voce viaja",
        icon: "cat",
      },
      {
        name: "Banho e Tosa",
        description: "Higiene e estetica animal",
        icon: "scissors",
      },
    ],
  },
  {
    name: "Eventos",
    description: "Servicos para festas e eventos",
    icon: "party-popper",
    type: "BOTH",
    subcategories: [
      {
        name: "Buffet",
        description: "Servicos de alimentacao para eventos",
        icon: "utensils-crossed",
      },
      {
        name: "Decoracao",
        description: "Decoracao de festas e eventos",
        icon: "sparkles",
      },
      {
        name: "DJ",
        description: "Servicos de DJ e sonorizacao",
        icon: "music",
      },
      {
        name: "Fotografia",
        description: "Cobertura fotografica de eventos",
        icon: "camera",
      },
      {
        name: "Garcom",
        description: "Servicos de garcom e atendimento",
        icon: "user",
      },
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

  // Criar endereco para o cliente
  const existingAddress = await prisma.address.findFirst({
    where: { userId: client.id },
  });
  if (!existingAddress) {
    await prisma.address.create({
      data: {
        street: "Rua das Flores",
        number: "123",
        complement: "Apto 45",
        neighborhood: "Jardim Paulista",
        city: "Sao Paulo",
        state: "SP",
        zipCode: "01401-000",
        country: "Brasil",
        userId: client.id,
      },
    });
  }

  console.log("  - Endereco do cliente criado!");

  // ============================================
  // SEED DE PEDIDOS (ServiceOrders)
  // ============================================
  console.log("\n  Criando pedidos de teste...");

  const prof1Listings = await prisma.serviceListing.findMany({
    where: { professionalId: professional.id },
    take: 5,
  });

  const orders: any[] = [];

  // 4 pedidos PENDING para profissional1
  for (let i = 0; i < Math.min(4, prof1Listings.length); i++) {
    const listing = prof1Listings[i];
    if (!listing) continue;
    const existingOrder = await prisma.serviceOrder.findFirst({
      where: {
        serviceListingId: listing.id,
        clientId: client.id,
        status: "PENDING",
      },
    });

    if (!existingOrder) {
      const order = await prisma.serviceOrder.create({
        data: {
          title: `Pedido: ${listing.title}`,
          serviceListingId: listing.id,
          clientId: client.id,
          professionalId: professional.id,
          status: "PENDING",
          price: listing.price,
          description: `Pedido de teste para: ${listing.title}`,
          scheduledDate: new Date(Date.now() + (i + 1) * 7 * 24 * 60 * 60 * 1000),
        },
      });
      orders.push(order);
    }
  }

  // 1 pedido COMPLETED (para reviews e transacoes)
  const completedListing = prof1Listings[0];
  let completedOrder: any = null;
  if (completedListing) {
    const existingCompleted = await prisma.serviceOrder.findFirst({
      where: {
        serviceListingId: completedListing.id,
        clientId: client.id,
        status: "COMPLETED",
      },
    });

    if (!existingCompleted) {
      completedOrder = await prisma.serviceOrder.create({
        data: {
          title: `Pedido concluido: ${completedListing.title}`,
          serviceListingId: completedListing.id,
          clientId: client.id,
          professionalId: professional.id,
          status: "COMPLETED",
          price: completedListing.price,
          description: "Pedido concluido de teste",
          scheduledDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          clientConfirmedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
          professionalConfirmedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      });
      orders.push(completedOrder);
    } else {
      completedOrder = existingCompleted;
    }
  }

  // 1 pedido IN_PROGRESS
  if (prof1Listings[1]) {
    const existingInProgress = await prisma.serviceOrder.findFirst({
      where: {
        serviceListingId: prof1Listings[1].id,
        clientId: client.id,
        status: "IN_PROGRESS",
      },
    });

    if (!existingInProgress) {
      const inProgressOrder = await prisma.serviceOrder.create({
        data: {
          title: `Pedido em andamento: ${prof1Listings[1].title}`,
          serviceListingId: prof1Listings[1].id,
          clientId: client.id,
          professionalId: professional.id,
          status: "IN_PROGRESS",
          price: prof1Listings[1].price,
          description: "Pedido em andamento de teste",
          scheduledDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          startedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        },
      });
      orders.push(inProgressOrder);
    }
  }

  console.log(`  - ${orders.length} pedidos de teste criados!`);

  // ============================================
  // SEED DE PAGAMENTOS E TRANSACOES
  // ============================================
  console.log("  Criando pagamentos e transacoes de teste...");

  const completedOrders = await prisma.serviceOrder.findMany({
    where: { status: "COMPLETED", professionalId: professional.id },
    include: { serviceListing: true },
  });

  for (const order of completedOrders) {
    const existingPayment = await prisma.payment.findFirst({
      where: { serviceOrderId: order.id },
    });

    if (!existingPayment) {
      const payment = await prisma.payment.create({
        data: {
          amount: order.price,
          status: "RELEASED",
          paymentMethod: "pix",
          transactionId: `test_txn_${order.id}_${Date.now()}`,
          serviceOrderId: order.id,
          clientId: order.clientId,
          professionalId: order.professionalId,
          paidAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
          releasedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        },
      });

      // Transacao de pagamento para o profissional (90%)
      const professionalAmount = order.price * 0.9;
      const platformFee = order.price * 0.1;

      await prisma.transaction.create({
        data: {
          type: "PAYMENT",
          amount: professionalAmount,
          description: `Pagamento por: ${order.description || order.title}`,
          balanceBefore: 0,
          balanceAfter: professionalAmount,
          userId: professional.id,
          paymentId: payment.id,
        },
      });

      // Transacao de taxa da plataforma
      await prisma.transaction.create({
        data: {
          type: "FEE",
          amount: platformFee,
          description: `Taxa plataforma (10%) - Pedido #${order.id}`,
          balanceBefore: professionalAmount,
          balanceAfter: professionalAmount - platformFee,
          userId: professional.id,
          paymentId: payment.id,
        },
      });

      // Transacao de gasto do cliente
      await prisma.transaction.create({
        data: {
          type: "PAYMENT",
          amount: order.price,
          description: `Pagamento por: ${order.description || order.title}`,
          balanceBefore: 0,
          balanceAfter: -order.price,
          userId: client.id,
          paymentId: payment.id,
        },
      });
    }
  }

  // Atualizar saldo do profissional
  const profPaymentTxns = await prisma.transaction.findMany({
    where: { userId: professional.id, type: "PAYMENT" },
  });
  const profFeeTxns = await prisma.transaction.findMany({
    where: { userId: professional.id, type: "FEE" },
  });
  const totalPayments = profPaymentTxns.reduce((sum: number, t: any) => sum + t.amount, 0);
  const totalFees = profFeeTxns.reduce((sum: number, t: any) => sum + t.amount, 0);
  const newBalance = totalPayments - totalFees;

  await prisma.user.update({
    where: { id: professional.id },
    data: { balance: newBalance },
  });

  console.log("  - Pagamentos e transacoes criados!");

  // ============================================
  // SEED DE REVIEWS
  // ============================================
  console.log("  Criando reviews de teste...");

  for (const order of completedOrders) {
    const existingReview = await prisma.review.findFirst({
      where: { serviceOrderId: order.id },
    });

    if (!existingReview) {
      await prisma.review.create({
        data: {
          rating: 5,
          comment: "Excelente servico! Profissional muito competente e pontual. Recomendo!",
          isProfessional: true,
          serviceOrderId: order.id,
          authorId: client.id,
          targetId: professional.id,
        },
      });
    }
  }

  console.log("  - Reviews de teste criados!");

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

  const existingNotification = await prisma.notification.findFirst({
    where: { userId: professional.id },
  });

  if (!existingNotification) {
    await prisma.notification.create({
      data: {
        type: "ORDER_CREATED",
        title: "Novo pedido recebido",
        message: "Voce recebeu um novo pedido de servico eletrico.",
        userId: professional.id,
        status: "UNREAD",
      },
    });

    await prisma.notification.create({
      data: {
        type: "ORDER_CREATED",
        title: "Novo pedido recebido",
        message: "Voce recebeu um novo pedido de conserto.",
        userId: professional.id,
        status: "UNREAD",
      },
    });

    await prisma.notification.create({
      data: {
        type: "PAYMENT_RECEIVED",
        title: "Pagamento recebido",
        message: "Pagamento de R$ 150,00 foi liberado para sua carteira.",
        userId: professional.id,
        status: "READ",
      },
    });

    // Notificacao para o cliente
    await prisma.notification.create({
      data: {
        type: "ORDER_ACCEPTED",
        title: "Pedido aceito",
        message: "Seu pedido foi aceito pelo profissional Joao Santos.",
        userId: client.id,
        status: "UNREAD",
      },
    });
  }

  console.log("  - Notificacoes de teste criadas!");

  console.log("Usuarios de teste criados com sucesso!");
  console.log("  (Consulte o seed.ts para credenciais de teste)");
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
