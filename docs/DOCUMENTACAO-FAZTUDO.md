# DOCUMENTACAO COMPLETA - FazTudo Marketplace

> **Versao do Documento**: 1.0
> **Data**: 22 de Fevereiro de 2026
> **Projeto**: FazTudo - Marketplace de Servicos Residenciais e Profissionais
> **Stack Tecnologica**: Express 5 + React 19 + TypeScript 5.9 + Prisma 7.4 + PostgreSQL + Redis/BullMQ
> **Repositorio**: git@github.com:levygamer200-ux/faztudo.git

---

```
 ███████╗ █████╗ ███████╗████████╗██╗   ██╗██████╗  ██████╗
 ██╔════╝██╔══██╗╚══███╔╝╚══██╔══╝██║   ██║██╔══██╗██╔═══██╗
 █████╗  ███████║  ███╔╝    ██║   ██║   ██║██║  ██║██║   ██║
 ██╔══╝  ██╔══██║ ███╔╝     ██║   ██║   ██║██║  ██║██║   ██║
 ██║     ██║  ██║███████╗   ██║   ╚██████╔╝██████╔╝╚██████╔╝
 ╚═╝     ╚═╝  ╚═╝╚══════╝   ╚═╝    ╚═════╝ ╚═════╝  ╚═════╝
          M A R K E T P L A C E   D E   S E R V I C O S
```

---

## Indice

1. [O Que e o FazTudo](#1-o-que-e-o-faztudo)
2. [Glossario de Termos](#2-glossario-de-termos)
3. [Fluxo Completo do Cliente](#3-fluxo-completo-do-cliente)
4. [Fluxo Completo do Profissional](#4-fluxo-completo-do-profissional)
5. [Fluxo de Pagamentos](#5-fluxo-de-pagamentos)

---

# 1. O Que e o FazTudo

## Visao Geral Para Investidores e Stakeholders

O **FazTudo** e uma plataforma marketplace que conecta **clientes** que precisam de servicos
residenciais e profissionais com **prestadores de servico verificados** e **empresas**. Pense
no FazTudo como o **"Uber dos servicos domesticos"** -- uma ponte digital entre quem precisa
de um encanador, eletricista, faxineiro, esteticista, ou qualquer outro profissional, e quem
oferece esses servicos com qualidade garantida.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                        ECOSSISTEMA FAZTUDO                              │
│                                                                         │
│   ┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐   │
│   │              │     │                  │     │                  │   │
│   │   CLIENTES   │────>│    PLATAFORMA    │<────│  PROFISSIONAIS   │   │
│   │              │     │     FAZTUDO      │     │   & EMPRESAS     │   │
│   │  - Buscam    │     │                  │     │                  │   │
│   │    servicos  │     │  - Conecta       │     │  - Oferecem      │   │
│   │  - Pagam     │     │  - Protege       │     │    servicos      │   │
│   │    com       │     │  - Garante       │     │  - Recebem       │   │
│   │    seguranca │     │    qualidade     │     │    com garantia  │   │
│   │              │     │  - Resolve       │     │  - Criam         │   │
│   │              │     │    disputas      │     │    vitrines      │   │
│   │              │     │                  │     │                  │   │
│   └──────────────┘     └──────────────────┘     └──────────────────┘   │
│                               │                                         │
│                               │                                         │
│                        ┌──────┴──────┐                                  │
│                        │             │                                  │
│                        │    ADMIN    │                                  │
│                        │   PANEL     │                                  │
│                        │             │                                  │
│                        │ - Gerencia  │                                  │
│                        │   usuarios  │                                  │
│                        │ - Aprova    │                                  │
│                        │   KYC       │                                  │
│                        │ - Analytics │                                  │
│                        │ - Disputas  │                                  │
│                        │             │                                  │
│                        └─────────────┘                                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Proposta de Valor

| Diferencial | Descricao |
|-------------|-----------|
| **20 Categorias de Servicos** | Mais de 108 subcategorias cobrindo desde reparos domesticos ate servicos de beleza e bem-estar |
| **Pagamento Seguro (Escrow)** | O dinheiro fica retido em custodia ate ambas as partes confirmarem a conclusao do servico. Protege tanto o cliente quanto o profissional |
| **Integracao MercadoPago** | Aceita cartao de credito, PIX e boleto bancario -- os metodos mais populares no Brasil |
| **Verificacao KYC** | Profissionais passam por verificacao de identidade (documento + foto facial) antes de poderem atender clientes |
| **Rastreamento GPS em Tempo Real** | Quando o profissional esta a caminho, o cliente pode acompanhar a localizacao em tempo real, similar ao Waze |
| **Contas Empresariais** | Empresas podem criar contas com gestao de equipe, divisao de funcoes e automacao de salarios |
| **Vitrine Virtual (Storefront)** | Profissionais e empresas criam suas proprias "lojas virtuais" com portfolio, precos e horarios |
| **Chat Integrado** | Sistema de mensagens com envio de arquivos, fotos e documentos entre cliente e profissional |
| **Painel Administrativo** | Dashboard completo com analytics, gestao de usuarios, verificacoes e resolucao de disputas |

### Modelo de Receita

```
┌─────────────────────────────────────────────────────────────┐
│                    MODELO DE RECEITA                         │
│                                                              │
│    Cliente paga R$ 100,00 por um servico                     │
│                                                              │
│    ┌──────────────────────────────────────────────────┐      │
│    │          VALOR TOTAL: R$ 100,00                  │      │
│    │                                                  │      │
│    │    ┌─────────────────────────┐ ┌──────────────┐  │      │
│    │    │                         │ │              │  │      │
│    │    │    PROFISSIONAL         │ │  PLATAFORMA  │  │      │
│    │    │       90%               │ │     10%      │  │      │
│    │    │    R$ 90,00             │ │   R$ 10,00   │  │      │
│    │    │                         │ │              │  │      │
│    │    └─────────────────────────┘ └──────────────┘  │      │
│    │                                                  │      │
│    └──────────────────────────────────────────────────┘      │
│                                                              │
│    * O pagamento so e liberado apos confirmacao               │
│      de ambas as partes (escrow/custodia)                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Numeros da Plataforma

| Metrica | Valor |
|---------|-------|
| Linhas de codigo (backend) | ~14.250 |
| Linhas de codigo (frontend) | ~25.040 |
| Total de linhas | ~39.290 |
| Modelos no banco de dados | 24 |
| Endpoints da API | 80+ |
| Testes automatizados | 337 |
| Arquivos de teste | 40 |
| Categorias de servico | 20 |
| Subcategorias | 108+ |

---

# 2. Glossario de Termos

## 2.1 Termos Nao-Tecnicos (Para Investidores e Gestores)

Estes termos aparecem frequentemente na documentacao e no produto. Esta secao traduz
conceitos tecnicos para linguagem de negocios.

| Termo Tecnico | Traducao Simples | Explicacao |
|---------------|------------------|------------|
| **ServiceListing** | Catalogo de Servico | O anuncio que o profissional cria oferecendo um servico (ex: "Instalacao de Chuveiro - R$ 150") |
| **ServiceOrder** | Pedido de Servico | Quando o cliente solicita um servico, cria-se um pedido que acompanha todo o ciclo de vida da prestacao |
| **Escrow** | Custodia / Garantia | Sistema de protecao financeira: o dinheiro do cliente fica "guardado" pela plataforma ate que o servico seja confirmado como concluido. Protege ambas as partes |
| **MFA** | Autenticacao em 2 Fatores | Camada extra de seguranca no login: alem da senha, o usuario precisa digitar um codigo temporario gerado no celular |
| **KYC** | Verificacao de Identidade | Processo "Conheca Seu Cliente" -- o profissional envia documentos e foto facial para comprovar sua identidade antes de poder atender |
| **Vitrine / Storefront** | Loja Virtual do Profissional | Pagina personalizada do profissional ou empresa onde ele exibe seus servicos, portfolio, precos e horarios de atendimento |
| **Circuit Breaker** | Disjuntor de Seguranca | Mecanismo automatico que "desliga" temporariamente a comunicacao com o gateway de pagamento (MercadoPago) quando detecta muitas falhas seguidas. Evita sobrecarregar um sistema ja com problemas, e tenta novamente automaticamente apos 60 segundos |
| **Rate Limiting** | Limitacao de Requisicoes | Protecao contra ataques: limita quantas vezes alguem pode acessar o sistema por minuto. Impede abusos e tentativas de invasao |
| **Webhook** | Notificacao Automatica | Mensagem automatica que o MercadoPago envia para o FazTudo quando algo acontece (ex: "pagamento aprovado"). O sistema recebe e processa sem intervencao humana |
| **JWT** | Token de Autenticacao | Uma "chave digital temporaria" que identifica o usuario logado. Expira apos um tempo para garantir seguranca |
| **Worker** | Processo em Segundo Plano | Tarefa que roda "por tras dos panos" sem o usuario perceber (ex: enviar email, processar pagamento, verificar fraude) |
| **Queue / Fila** | Fila de Tarefas | Lista organizada de tarefas a serem executadas pelos workers. Garante que nada se perca, mesmo em picos de uso |
| **CRUD** | Criar / Ler / Atualizar / Deletar | As quatro operacoes basicas de qualquer sistema com dados. Todo cadastro (usuarios, servicos, pedidos) segue esse padrao |
| **Dashboard** | Painel de Controle | Tela com graficos, metricas e resumos que permite visualizar o desempenho do negocio de forma rapida |
| **API** | Interface de Programacao | O "contrato" entre o frontend (o que o usuario ve) e o backend (onde os dados e regras ficam). Define como eles se comunicam |
| **Wallet** | Carteira Digital | Saldo do profissional dentro da plataforma. Recebe os pagamentos dos servicos e permite saques |

## 2.2 Termos Tecnicos (Para Desenvolvedores)

Stack completa e ferramentas utilizadas no projeto.

### Backend

| Tecnologia | Versao | Funcao |
|------------|--------|--------|
| **Express** | 5.x | Framework web para Node.js. Gerencia rotas, middlewares e respostas HTTP da API REST |
| **TypeScript** | 5.9.3 | Superset do JavaScript com tipagem estatica. Previne erros em tempo de compilacao |
| **Prisma** | 7.4.0 | ORM (Object-Relational Mapping) para interacao com o banco de dados. Gera tipos automaticamente a partir do schema |
| **PostgreSQL** | 16+ | Banco de dados relacional principal. Armazena todos os dados da aplicacao |
| **Redis** | 7+ | Banco de dados em memoria usado para filas (BullMQ), cache de idempotencia e estado do circuit breaker |
| **BullMQ** | 5.x | Biblioteca de filas baseada em Redis. Gerencia workers para notificacoes, emails, pagamentos, reconciliacao e anti-fraude |
| **Zod** | 4.3.6 | Biblioteca de validacao de schemas. Valida e tipifica dados de entrada em todas as rotas |
| **Pino** | 10.3.1 | Logger estruturado de alta performance. Formato JSON em producao, colorido em desenvolvimento |
| **prom-client** | 15.x | Cliente Prometheus para metricas. Expoe metricas de HTTP, filas, pagamentos e circuit breaker via `/metrics` |
| **Opossum** | 9.x | Implementacao de circuit breaker. Envolve chamadas ao MercadoPago para proteger contra falhas em cascata |
| **IORedis** | 5.x | Cliente Redis otimizado para Node.js. Usado pelo BullMQ e para operacoes de idempotencia |
| **otplib** | 13.x | Biblioteca TOTP para MFA. Gera e verifica codigos de autenticacao de dois fatores |
| **bcrypt** | - | Hashing de senhas. Usa salt rounds configuraveis para proteger credenciais |
| **jsonwebtoken** | - | Geracao e verificacao de tokens JWT para autenticacao |
| **Helmet** | - | Headers de seguranca HTTP. Protege contra XSS, clickjacking, sniffing e outros ataques |
| **CORS** | - | Cross-Origin Resource Sharing. Controla quais origens podem acessar a API |
| **Nodemailer** | - | Envio de emails transacionais (verificacao, reset de senha, notificacoes) via Brevo SMTP |
| **Vitest** | 4.0.18 | Framework de testes unitarios e de integracao. 337 testes em 40 arquivos |

### Frontend

| Tecnologia | Versao | Funcao |
|------------|--------|--------|
| **React** | 19.2.4 | Biblioteca de UI baseada em componentes. Gerencia toda a interface do usuario |
| **React Router** | 7.13.0 | Roteamento SPA (Single Page Application). Navegacao entre paginas sem reload |
| **Vite** | 7.3.1 | Build tool e dev server ultrarapido. Hot Module Replacement em desenvolvimento |
| **TailwindCSS** | 4.1.18 | Framework CSS utility-first. Configuracao CSS-first (sem `tailwind.config.js`) |
| **TypeScript** | 5.9.3 | Tipagem estatica no frontend. Tipos divididos por dominio em `src/types/` |
| **Axios** | 1.13.5 | Cliente HTTP para chamadas a API. Instancia configurada com interceptors em `services/api.ts` |
| **Lucide React** | 0.574.0 | Biblioteca de icones SVG. Icones consistentes em toda a interface |
| **Socket.io Client** | - | WebSocket para comunicacao em tempo real (chat, notificacoes, GPS) |

### Infraestrutura

| Tecnologia | Funcao |
|------------|--------|
| **Docker / Docker Compose** | Containerizacao do ambiente de desenvolvimento (backend, frontend, PostgreSQL, Redis) |
| **GitHub Actions** | Pipeline de CI/CD (lint, type check, testes automatizados) |
| **MercadoPago SDK** | Gateway de pagamento (cartao de credito, PIX, boleto bancario) |
| **AES-256-GCM** | Criptografia de segredos MFA (TOTP secrets) armazenados no banco |
| **Prometheus** | Coleta de metricas para monitoramento em producao |

---

# 3. Fluxo Completo do Cliente

## Visao Geral

O cliente e o usuario que busca e contrata servicos na plataforma. Desde o cadastro ate
a avaliacao final, o fluxo foi desenhado para ser simples, seguro e transparente.

```
╔══════════════════════════════════════════════════════════════════════════════════╗
║                       FLUXO COMPLETO DO CLIENTE                                 ║
╚══════════════════════════════════════════════════════════════════════════════════╝

  ┌─────────────────┐
  │   1. CADASTRO   │
  │                 │
  │  Nome, Email,   │
  │  Senha, CPF,    │
  │  Telefone       │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐       ┌──────────────────────────────────────────┐
  │  2. VERIFICACAO │       │  Email de verificacao enviado            │
  │     DE EMAIL    │──────>│  automaticamente via Brevo SMTP.         │
  │                 │       │  Usuario clica no link para ativar conta │
  └────────┬────────┘       └──────────────────────────────────────────┘
           │
           ▼
  ┌─────────────────┐       ┌──────────────────────────────────────────┐
  │  3. LOGIN       │       │  JWT gerado com validade configuravel.   │
  │                 │──────>│  Refresh token armazenado em cookie      │
  │  Email + Senha  │       │  HttpOnly (sameSite: lax em dev,         │
  └────────┬────────┘       │  strict em producao)                     │
           │                └──────────────────────────────────────────┘
           ▼
  ┌─────────────────┐
  │  4. NAVEGACAO   │
  │                 │
  │  O cliente pode │
  │  navegar por:   │
  │                 │
  └────────┬────────┘
           │
     ┌─────┴──────────────────────────────────┐
     │                                        │
     ▼                                        ▼
┌─────────────────────┐          ┌─────────────────────────┐
│  4a. BUSCA POR      │          │  4b. VITRINES           │
│      CATEGORIA      │          │      (STOREFRONTS)      │
│                     │          │                         │
│  - 20 categorias    │          │  - Loja virtual do      │
│  - 108+ sub-        │          │    profissional/empresa  │
│    categorias       │          │  - Portfolio, precos,   │
│  - Filtros por      │          │    horarios, avaliacoes │
│    preco, nota,     │          │  - Adicionar ao         │
│    localizacao      │          │    "carrinho"           │
│                     │          │                         │
└────────┬────────────┘          └───────────┬─────────────┘
         │                                   │
         └──────────────┬────────────────────┘
                        │
                        ▼
           ┌─────────────────────┐
           │  5. SELECAO DO      │
           │     SERVICO         │
           │                     │
           │  Cliente visualiza  │
           │  detalhes, preco,   │
           │  avaliacoes e       │
           │  disponibilidade    │
           │                     │
           └────────┬────────────┘
                    │
                    ▼
           ┌─────────────────────┐
           │  6. CRIACAO DO      │
           │     PEDIDO          │
           │                     │      ┌─────────────────────────┐
           │  Status: PENDING    │─────>│  Notificacao enviada    │
           │                     │      │  ao profissional via    │
           │  - Descricao do     │      │  email + in-app         │
           │    servico          │      └─────────────────────────┘
           │  - Endereco         │
           │  - Fotos (opcional) │
           │                     │
           └────────┬────────────┘
                    │
                    ▼
           ┌─────────────────────┐
           │  7. AGUARDA         │
           │     ACEITACAO       │
           │                     │
           │  Profissional       │
           │  aceita o pedido    │
           │                     │
           │  Status: ACCEPTED   │
           │                     │
           └────────┬────────────┘
                    │
                    ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │  8. CHECKOUT (PAGAMENTO)                                        │
  │                                                                 │
  │  ┌──────────────────┐                                           │
  │  │  8a. AGENDA      │  Cliente seleciona data/hora              │
  │  │      HORARIO     │  dentro da disponibilidade                │
  │  └───────┬──────────┘  do profissional                          │
  │          │                                                      │
  │          ▼                                                      │
  │  ┌──────────────────┐                                           │
  │  │  8b. METODO DE   │                                           │
  │  │      PAGAMENTO   │                                           │
  │  │                  │                                           │
  │  │  ┌────────────┐  │  ┌────────────┐  ┌────────────┐          │
  │  │  │  CARTAO    │  │  │    PIX     │  │  BOLETO    │          │
  │  │  │  DE        │  │  │            │  │  BANCARIO  │          │
  │  │  │  CREDITO   │  │  │ Aprovacao  │  │            │          │
  │  │  │            │  │  │ instantanea│  │ Ate 3 dias │          │
  │  │  │ Parcela em │  │  │            │  │ uteis      │          │
  │  │  │ ate 12x    │  │  │            │  │            │          │
  │  │  └────────────┘  │  └────────────┘  └────────────┘          │
  │  │                  │                                           │
  │  └───────┬──────────┘                                           │
  │          │                                                      │
  │          ▼                                                      │
  │  ┌──────────────────┐                                           │
  │  │  8c. PAGAMENTO   │  Processado via MercadoPago               │
  │  │      PROCESSADO  │  Dinheiro fica em ESCROW                  │
  │  │                  │  (custodia da plataforma)                  │
  │  │  Status do       │                                           │
  │  │  Pagamento: HELD │                                           │
  │  └──────────────────┘                                           │
  │                                                                 │
  └──────────────────────────────┬───────────────────────────────────┘
                                 │
                                 ▼
           ┌─────────────────────────────────┐
           │  9. SERVICO EM ANDAMENTO        │
           │                                 │
           │  Status: IN_PROGRESS            │
           │                                 │
           │  ┌───────────────────────────┐   │
           │  │  RASTREAMENTO GPS         │   │
           │  │                           │   │
           │  │  Profissional marca       │   │
           │  │  "a caminho" ──>          │   │
           │  │  Cliente acompanha        │   │
           │  │  localizacao em           │   │
           │  │  tempo real (mapa)        │   │
           │  │                           │   │
           │  │   [A]────────>[B]         │   │
           │  │   Pro         Cliente     │   │
           │  │                           │   │
           │  └───────────────────────────┘   │
           │                                 │
           │  Chat disponivel para           │
           │  comunicacao durante             │
           │  todo o processo                │
           │                                 │
           └────────────────┬────────────────┘
                            │
                            ▼
           ┌─────────────────────────────────┐
           │  10. PROFISSIONAL SUBMETE       │
           │      CONCLUSAO                  │
           │                                 │
           │  Status:                        │
           │  AWAITING_CLIENT_CONFIRMATION   │
           │                                 │
           │  Profissional envia fotos       │
           │  do servico concluido           │
           │                                 │
           └────────────────┬────────────────┘
                            │
                            ▼
           ┌─────────────────────────────────┐
           │  11. CLIENTE CONFIRMA           │
           │                                 │
           │  Status:                        │
           │  AWAITING_PROFESSIONAL_         │
           │  CONFIRMATION                   │
           │                                 │
           │  "Sim, o servico foi            │
           │   realizado corretamente"       │
           │                                 │
           │   ┌─────────┐  ┌────────────┐   │
           │   │ APROVAR  │  │ DISPUTAR   │   │
           │   │    ✓     │  │    ✗       │   │
           │   └────┬─────┘  └─────┬──────┘   │
           │        │              │          │
           └────────┼──────────────┼──────────┘
                    │              │
                    │              ▼
                    │    ┌─────────────────────┐
                    │    │  DISPUTA ABERTA     │
                    │    │                     │
                    │    │  Admin analisa e    │
                    │    │  resolve o caso     │
                    │    │                     │
                    │    └─────────────────────┘
                    │
                    ▼
           ┌─────────────────────────────────┐
           │  12. PROFISSIONAL CONFIRMA      │
           │                                 │
           │  Status: COMPLETED              │
           │                                 │
           └────────────────┬────────────────┘
                            │
                            ▼
           ┌─────────────────────────────────┐
           │  13. PAGAMENTO LIBERADO         │
           │                                 │
           │  Escrow libera o valor:         │
           │                                 │
           │  ┌───────────┐ ┌─────────────┐  │
           │  │ 90%       │ │ 10%         │  │
           │  │ Pro       │ │ Plataforma  │  │
           │  │ Wallet    │ │ Taxa        │  │
           │  └───────────┘ └─────────────┘  │
           │                                 │
           │  Status Pagamento: RELEASED     │
           │                                 │
           └────────────────┬────────────────┘
                            │
                            ▼
           ┌─────────────────────────────────┐
           │  14. AVALIACAO                  │
           │                                 │
           │  Cliente avalia o servico:      │
           │  - Nota (1-5 estrelas)          │
           │  - Comentario                   │
           │  - Fotos (opcional)             │
           │                                 │
           │  A avaliacao fica visivel       │
           │  no perfil do profissional      │
           │                                 │
           └─────────────────────────────────┘
```

### Diagrama de Status do Pedido (Visao do Cliente)

```
┌───────────────────────────────────────────────────────────────────┐
│              TRANSICOES DE STATUS DO PEDIDO                       │
│                                                                   │
│   PENDING ──────> ACCEPTED ──────> IN_PROGRESS                    │
│     │                                   │                         │
│     │                                   ▼                         │
│     │                     AWAITING_CLIENT_CONFIRMATION             │
│     │                                   │                         │
│     │              ┌────────────────────┤                         │
│     │              │                    │                         │
│     │              ▼                    ▼                         │
│     │         DISPUTED        AWAITING_PROFESSIONAL_              │
│     │              │          CONFIRMATION                        │
│     │              │                    │                         │
│     │              ▼                    ▼                         │
│     │          RESOLVED            COMPLETED                      │
│     │                                                             │
│     └──────> CANCELLED (cliente pode cancelar                     │
│               apenas antes do pagamento)                          │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

# 4. Fluxo Completo do Profissional

## Visao Geral

O profissional e o prestador de servico que oferece suas habilidades na plataforma.
O fluxo inclui desde o cadastro com verificacao de identidade ate o recebimento de
pagamentos e gestao do negocio.

```
╔══════════════════════════════════════════════════════════════════════════════════╗
║                     FLUXO COMPLETO DO PROFISSIONAL                              ║
╚══════════════════════════════════════════════════════════════════════════════════╝

  ┌─────────────────────────┐
  │  1. CADASTRO            │
  │                         │
  │  Nome, Email, Senha,    │
  │  CPF/CNPJ, Telefone,   │
  │  Tipo: PROFISSIONAL     │
  │  ou EMPRESA             │
  │                         │
  └───────────┬─────────────┘
              │
              ▼
  ┌─────────────────────────┐     ┌─────────────────────────────────────┐
  │  2. VERIFICACAO KYC     │     │  Documentos necessarios:            │
  │     (Know Your          │     │                                     │
  │      Customer)          │────>│  a) Documento de identidade         │
  │                         │     │     (RG, CNH ou passaporte)         │
  │  Status: PENDING_       │     │                                     │
  │  VERIFICATION           │     │  b) Foto facial (selfie) para      │
  │                         │     │     comparacao biometrica           │
  └───────────┬─────────────┘     │                                     │
              │                   │  c) Comprovante de residencia       │
              │                   │     (opcional)                      │
              │                   │                                     │
              │                   │  d) CNPJ (se empresa)               │
              │                   │                                     │
              │                   └─────────────────────────────────────┘
              ▼
  ┌─────────────────────────┐
  │  3. ADMIN APROVA        │
  │     VERIFICACAO         │
  │                         │
  │  ┌───────────────────┐  │
  │  │ Painel Admin:     │  │
  │  │                   │  │
  │  │ - Analisa docs    │  │
  │  │ - Compara foto    │  │
  │  │ - Aprova/Rejeita  │  │
  │  │                   │  │
  │  └───────┬───────────┘  │
  │          │              │
  │     ┌────┴────┐         │
  │     │         │         │
  │     ▼         ▼         │
  │  APROVADO  REJEITADO    │
  │     │         │         │
  │     │         └──> Pode │
  │     │          reenviar │
  │     │                   │
  └─────┼───────────────────┘
        │
        ▼
  ┌─────────────────────────┐
  │  4. CONFIGURACAO DA     │
  │     AGENDA              │
  │                         │
  │  ┌───────────────────┐  │
  │  │ Seg: 08:00-18:00  │  │
  │  │ Ter: 08:00-18:00  │  │
  │  │ Qua: 08:00-18:00  │  │
  │  │ Qui: 08:00-18:00  │  │
  │  │ Sex: 08:00-18:00  │  │
  │  │ Sab: 08:00-12:00  │  │
  │  │ Dom: ── FOLGA ──  │  │
  │  └───────────────────┘  │
  │                         │
  │  + Bloqueios pontuais   │
  │    (ferias, feriados)   │
  │                         │
  └───────────┬─────────────┘
              │
              ▼
  ┌─────────────────────────────────────────────────────────┐
  │  5. CRIACAO DE SERVICOS                                 │
  │                                                         │
  │  O profissional tem duas opcoes:                        │
  │                                                         │
  │  ┌────────────────────┐     ┌────────────────────────┐  │
  │  │  5a. VITRINE       │     │  5b. LISTINGS          │  │
  │  │      (STOREFRONT)  │     │      INDIVIDUAIS       │  │
  │  │                    │     │                        │  │
  │  │  Loja virtual      │     │  Anuncios avulsos      │  │
  │  │  completa com:     │     │  de servicos:          │  │
  │  │                    │     │                        │  │
  │  │  - Banner e logo   │     │  - Titulo              │  │
  │  │  - Descricao       │     │  - Descricao           │  │
  │  │  - Portfolio       │     │  - Preco               │  │
  │  │  - Todos os        │     │  - Categoria           │  │
  │  │    servicos        │     │  - Fotos               │  │
  │  │  - Avaliacoes      │     │                        │  │
  │  │  - Link direto     │     │  Aparecem na busca     │  │
  │  │                    │     │  por categoria          │  │
  │  └────────────────────┘     └────────────────────────┘  │
  │                                                         │
  └────────────────────────┬────────────────────────────────┘
                           │
                           ▼
  ┌─────────────────────────┐
  │  6. RECEBE NOTIFICACAO  │
  │     DE NOVO PEDIDO      │
  │                         │
  │  ┌────────────────────┐ │
  │  │ ╔════════════════╗ │ │
  │  │ ║  NOVO PEDIDO!  ║ │ │
  │  │ ║                ║ │ │
  │  │ ║  Servico: ...  ║ │ │
  │  │ ║  Cliente: ...  ║ │ │
  │  │ ║  Valor: R$ ... ║ │ │
  │  │ ║                ║ │ │
  │  │ ║ [ACEITAR]      ║ │ │
  │  │ ║ [RECUSAR]      ║ │ │
  │  │ ╚════════════════╝ │ │
  │  └────────────────────┘ │
  │                         │
  │  Via: email + in-app    │
  │                         │
  └───────────┬─────────────┘
              │
              ▼
  ┌─────────────────────────┐
  │  7. ACEITA O PEDIDO     │
  │                         │
  │  Status: ACCEPTED       │
  │                         │
  │  Aguarda pagamento      │
  │  do cliente              │
  │                         │
  └───────────┬─────────────┘
              │
              ▼
  ┌─────────────────────────┐
  │  8. CLIENTE PAGA        │
  │                         │
  │  Dinheiro fica em       │
  │  ESCROW (custodia)      │
  │                         │
  │  Profissional recebe    │
  │  confirmacao de que     │
  │  o pagamento foi        │
  │  realizado              │
  │                         │
  └───────────┬─────────────┘
              │
              ▼
  ┌─────────────────────────┐
  │  9. INICIA SERVICO      │
  │                         │
  │  Status: IN_PROGRESS    │
  │                         │
  │  ┌───────────────────┐  │
  │  │  MARCA "A CAMINHO"│  │
  │  │                   │  │
  │  │  GPS ativado      │  │
  │  │  Cliente ve a     │  │
  │  │  localizacao em   │  │
  │  │  tempo real       │  │
  │  │                   │  │
  │  │  ┌─Pro─┐          │  │
  │  │  │  *  │ ═══════> │  │
  │  │  └─────┘  rota    │  │
  │  │       ┌─Cliente─┐ │  │
  │  │       │    o    │ │  │
  │  │       └─────────┘ │  │
  │  └───────────────────┘  │
  │                         │
  └───────────┬─────────────┘
              │
              ▼
  ┌─────────────────────────┐
  │  10. REALIZA O SERVICO  │
  │                         │
  │  - Executa o trabalho   │
  │  - Tira fotos do        │
  │    resultado             │
  │  - Pode conversar via   │
  │    chat durante          │
  │                         │
  └───────────┬─────────────┘
              │
              ▼
  ┌─────────────────────────┐
  │  11. SUBMETE CONCLUSAO  │
  │                         │
  │  Status:                │
  │  AWAITING_CLIENT_       │
  │  CONFIRMATION           │
  │                         │
  │  Envia fotos do         │
  │  servico concluido      │
  │                         │
  └───────────┬─────────────┘
              │
              ▼
  ┌─────────────────────────┐
  │  12. CONFIRMACAO MUTUA  │
  │                         │
  │  Cliente confirma ──>   │
  │  Status:                │
  │  AWAITING_PROFESSIONAL_ │
  │  CONFIRMATION           │
  │                         │
  │  Profissional confirma  │
  │  ──> Status: COMPLETED  │
  │                         │
  └───────────┬─────────────┘
              │
              ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  13. PAGAMENTO LIBERADO                                     │
  │                                                             │
  │  ┌───────────────────────────────────────────────────────┐  │
  │  │                                                       │  │
  │  │  Valor do Servico: R$ 200,00                          │  │
  │  │                                                       │  │
  │  │  ┌─────────────────────┐  ┌────────────────────────┐  │  │
  │  │  │  PROFISSIONAL       │  │  PLATAFORMA            │  │  │
  │  │  │  90% = R$ 180,00    │  │  10% = R$ 20,00        │  │  │
  │  │  │                     │  │                        │  │  │
  │  │  │  Creditado na       │  │  Taxa de servico       │  │  │
  │  │  │  Wallet do app      │  │                        │  │  │
  │  │  └─────────────────────┘  └────────────────────────┘  │  │
  │  │                                                       │  │
  │  └───────────────────────────────────────────────────────┘  │
  │                                                             │
  └──────────────────────────┬──────────────────────────────────┘
                             │
                             ▼
  ┌─────────────────────────────────────────────────────────┐
  │  14. GESTAO FINANCEIRA                                  │
  │                                                         │
  │  ┌───────────────────────────────────────────────────┐  │
  │  │  WALLET (CARTEIRA DIGITAL)                        │  │
  │  │                                                   │  │
  │  │  Saldo: R$ 1.540,00                               │  │
  │  │                                                   │  │
  │  │  ┌─────────────┐  ┌──────────────┐               │  │
  │  │  │ HISTORICO   │  │  SOLICITAR   │               │  │
  │  │  │ DE          │  │  SAQUE       │               │  │
  │  │  │ TRANSACOES  │  │              │               │  │
  │  │  │             │  │  Via PIX ou  │               │  │
  │  │  │ + R$ 180    │  │  transferen- │               │  │
  │  │  │ + R$ 270    │  │  cia         │               │  │
  │  │  │ + R$  90    │  │  bancaria    │               │  │
  │  │  │ - R$ 500    │  │              │               │  │
  │  │  │   (saque)   │  │              │               │  │
  │  │  └─────────────┘  └──────────────┘               │  │
  │  │                                                   │  │
  │  └───────────────────────────────────────────────────┘  │
  │                                                         │
  │  ┌───────────────────────────────────────────────────┐  │
  │  │  DASHBOARD DO PROFISSIONAL                        │  │
  │  │                                                   │  │
  │  │  - CRM (gestao de clientes)                       │  │
  │  │  - Calendario de agendamentos                     │  │
  │  │  - Reputacao e avaliacoes                         │  │
  │  │  - Metricas de desempenho                         │  │
  │  │  - Financeiro (receita, taxas, saques)             │  │
  │  │                                                   │  │
  │  └───────────────────────────────────────────────────┘  │
  │                                                         │
  └─────────────────────────────────────────────────────────┘
```

### Fluxo Especifico de Empresas

```
┌───────────────────────────────────────────────────────────────────────┐
│                   FLUXO ADICIONAL - EMPRESAS                          │
│                                                                       │
│   Empresas tem funcionalidades extras alem do fluxo de profissional:  │
│                                                                       │
│   ┌─────────────────┐                                                 │
│   │  CONTA EMPRESA  │                                                 │
│   └────────┬────────┘                                                 │
│            │                                                          │
│    ┌───────┼────────────────┬──────────────────┐                      │
│    │       │                │                  │                      │
│    ▼       ▼                ▼                  ▼                      │
│  ┌──────┐ ┌──────────┐  ┌─────────────┐  ┌──────────────┐            │
│  │EQUIPE│ │FUNCOES   │  │ SALARIO     │  │ VITRINE      │            │
│  │      │ │(ROLES)   │  │ AUTOMATICO  │  │ EMPRESARIAL  │            │
│  │Convite│ │          │  │             │  │              │            │
│  │de    │ │- Admin   │  │ Pagamento   │  │ Perfil da    │            │
│  │funcio│ │- Gerente │  │ automatico  │  │ empresa com  │            │
│  │narios│ │- Tecnico │  │ de          │  │ todos os     │            │
│  │      │ │- Atend.  │  │ funcionarios│  │ servicos e   │            │
│  │      │ │          │  │             │  │ funcionarios │            │
│  └──────┘ └──────────┘  └─────────────┘  └──────────────┘            │
│                                                                       │
│   Analytics por funcionario, canal de atendimento, metricas de equipe │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

---

# 5. Fluxo de Pagamentos

## Visao Geral

O sistema de pagamentos do FazTudo foi projetado com foco em **seguranca**, **confiabilidade**
e **protecao contra fraudes**. Utiliza o MercadoPago como gateway, com escrow (custodia),
verificacao de idempotencia em duas camadas, circuit breaker e workers de anti-fraude.

```
╔══════════════════════════════════════════════════════════════════════════════════╗
║                         FLUXO DE PAGAMENTOS                                     ║
╚══════════════════════════════════════════════════════════════════════════════════╝


  ┌──────────────────────────────────────────────────────────────┐
  │                        FRONTEND                              │
  │                                                              │
  │  ┌────────────────────────────────────────────────────────┐  │
  │  │  1. CLIENTE INICIA PAGAMENTO                           │  │
  │  │                                                        │  │
  │  │  Seleciona metodo:                                     │  │
  │  │  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │  │
  │  │  │ CARTAO   │  │   PIX    │  │  BOLETO BANCARIO     │  │  │
  │  │  │          │  │          │  │                      │  │  │
  │  │  │ Dados do │  │ QR Code  │  │ Codigo de barras     │  │  │
  │  │  │ cartao   │  │ gerado   │  │ gerado               │  │  │
  │  │  └────┬─────┘  └────┬─────┘  └──────────┬───────────┘  │  │
  │  │       │             │                    │              │  │
  │  └───────┼─────────────┼────────────────────┼──────────────┘  │
  │          │             │                    │                 │
  │          ▼             │                    │                 │
  │  ┌────────────────┐    │                    │                 │
  │  │ 2. TOKENIZACAO │    │                    │                 │
  │  │    (Cartao)    │    │                    │                 │
  │  │                │    │                    │                 │
  │  │ MercadoPago SDK│    │                    │                 │
  │  │ gera card_token│    │                    │                 │
  │  │ no browser     │    │                    │                 │
  │  │ (dados do      │    │                    │                 │
  │  │ cartao NUNCA   │    │                    │                 │
  │  │ chegam ao      │    │                    │                 │
  │  │ nosso backend) │    │                    │                 │
  │  └───────┬────────┘    │                    │                 │
  │          │             │                    │                 │
  └──────────┼─────────────┼────────────────────┼─────────────────┘
             │             │                    │
             └─────────────┼────────────────────┘
                           │
                           ▼
  ┌──────────────────────────────────────────────────────────────┐
  │                        BACKEND                               │
  │                                                              │
  │  ┌────────────────────────────────────────────────────────┐  │
  │  │  3. RECEBE REQUISICAO DE PAGAMENTO                     │  │
  │  │                                                        │  │
  │  │  POST /api/services/payments                           │  │
  │  │  Body: { orderId, paymentMethod, token, amount, ... }  │  │
  │  │                                                        │  │
  │  └──────────────────────┬─────────────────────────────────┘  │
  │                         │                                    │
  │                         ▼                                    │
  │  ┌────────────────────────────────────────────────────────┐  │
  │  │  4. VERIFICACAO DE IDEMPOTENCIA (CAMADA 1 - REDIS)     │  │
  │  │                                                        │  │
  │  │  ┌──────────────────────────────────────────────────┐  │  │
  │  │  │  Redis NX SET com TTL de 5 minutos               │  │  │
  │  │  │                                                  │  │  │
  │  │  │  Chave: "payment:idempotency:{idempotencyKey}"   │  │  │
  │  │  │                                                  │  │  │
  │  │  │  ┌──────────────┐    ┌────────────────────────┐  │  │  │
  │  │  │  │ CHAVE NOVA   │    │ CHAVE JA EXISTE        │  │  │  │
  │  │  │  │ (primeira    │    │ (pagamento duplicado!) │  │  │  │
  │  │  │  │  tentativa)  │    │                        │  │  │  │
  │  │  │  │              │    │  ──> Retorna resposta  │  │  │  │
  │  │  │  │ Prossegue    │    │      anterior sem      │  │  │  │
  │  │  │  │ ──>          │    │      processar         │  │  │  │
  │  │  │  └──────┬───────┘    └────────────────────────┘  │  │  │
  │  │  │         │                                        │  │  │
  │  │  └─────────┼────────────────────────────────────────┘  │  │
  │  │            │                                           │  │
  │  └────────────┼───────────────────────────────────────────┘  │
  │               │                                              │
  │               ▼                                              │
  │  ┌────────────────────────────────────────────────────────┐  │
  │  │  5. CIRCUIT BREAKER (OPOSSUM)                          │  │
  │  │                                                        │  │
  │  │  Verifica saude do gateway MercadoPago:                │  │
  │  │                                                        │  │
  │  │  ┌─────────────────────────────────────────────────┐   │  │
  │  │  │                                                 │   │  │
  │  │  │  FECHADO (normal)  ──> Permite chamada          │   │  │
  │  │  │       │                                         │   │  │
  │  │  │       │ (>50% falhas)                           │   │  │
  │  │  │       ▼                                         │   │  │
  │  │  │  ABERTO (protecao) ──> Bloqueia chamadas        │   │  │
  │  │  │       │                por 60 segundos           │   │  │
  │  │  │       │ (apos 60s)                              │   │  │
  │  │  │       ▼                                         │   │  │
  │  │  │  SEMI-ABERTO ──> Permite 1 chamada de teste     │   │  │
  │  │  │       │                                         │   │  │
  │  │  │   ┌───┴───┐                                    │   │  │
  │  │  │   │       │                                    │   │  │
  │  │  │  OK?    Falha?                                 │   │  │
  │  │  │   │       │                                    │   │  │
  │  │  │   ▼       ▼                                    │   │  │
  │  │  │ FECHADO  ABERTO                                │   │  │
  │  │  │                                                 │   │  │
  │  │  └─────────────────────────────────────────────────┘   │  │
  │  │                                                        │  │
  │  └──────────────────────┬─────────────────────────────────┘  │
  │                         │                                    │
  │                         ▼                                    │
  │  ┌────────────────────────────────────────────────────────┐  │
  │  │  6. CHAMADA AO MERCADOPAGO                             │  │
  │  │                                                        │  │
  │  │  ┌──────────────────────────────────────────────────┐  │  │
  │  │  │  POST https://api.mercadopago.com/v1/payments    │  │  │
  │  │  │                                                  │  │  │
  │  │  │  {                                               │  │  │
  │  │  │    transaction_amount: 200.00,                   │  │  │
  │  │  │    token: "card_token_xxx",                      │  │  │
  │  │  │    payment_method_id: "master",                  │  │  │
  │  │  │    payer: { email: "cliente@email.com" },        │  │  │
  │  │  │    notification_url: ".../webhook"               │  │  │
  │  │  │  }                                               │  │  │
  │  │  └──────────────────────────────────────────────────┘  │  │
  │  │                                                        │  │
  │  └──────────────────────┬─────────────────────────────────┘  │
  │                         │                                    │
  │                         ▼                                    │
  │  ┌────────────────────────────────────────────────────────┐  │
  │  │  7. PAYMENT STATE MACHINE                              │  │
  │  │                                                        │  │
  │  │  Transicoes de status controladas e validadas:         │  │
  │  │                                                        │  │
  │  │  ┌─────────┐    ┌─────────┐    ┌──────────┐           │  │
  │  │  │ PENDING │───>│  HELD   │───>│ RELEASED │           │  │
  │  │  │         │    │(escrow) │    │(liberado)│           │  │
  │  │  └────┬────┘    └────┬────┘    └──────────┘           │  │
  │  │       │              │                                 │  │
  │  │       ▼              ▼                                 │  │
  │  │  ┌─────────┐    ┌──────────┐                           │  │
  │  │  │ FAILED  │    │ REFUNDED │                           │  │
  │  │  │(falhou) │    │(estorno) │                           │  │
  │  │  └─────────┘    └──────────┘                           │  │
  │  │                                                        │  │
  │  │  Transicoes invalidas sao REJEITADAS automaticamente   │  │
  │  │  Ex: PENDING ──> RELEASED (proibido, deve passar       │  │
  │  │      por HELD primeiro)                                │  │
  │  │                                                        │  │
  │  └──────────────────────┬─────────────────────────────────┘  │
  │                         │                                    │
  │                         ▼                                    │
  │  ┌────────────────────────────────────────────────────────┐  │
  │  │  8. REGISTRO DO EVENTO + IDEMPOTENCIA (CAMADA 2 - DB) │  │
  │  │                                                        │  │
  │  │  ┌──────────────────────────────────────────────────┐  │  │
  │  │  │  PaymentEvent criado no banco com:               │  │  │
  │  │  │                                                  │  │  │
  │  │  │  - paymentId                                     │  │  │
  │  │  │  - idempotencyKey (UNIQUE constraint)            │  │  │
  │  │  │  - status                                        │  │  │
  │  │  │  - amount                                        │  │  │
  │  │  │  - metadata (resposta do gateway)                │  │  │
  │  │  │                                                  │  │  │
  │  │  │  Se Redis estiver fora do ar, a UNIQUE           │  │  │
  │  │  │  constraint do DB garante idempotencia sozinha    │  │  │
  │  │  └──────────────────────────────────────────────────┘  │  │
  │  │                                                        │  │
  │  └────────────────────────────────────────────────────────┘  │
  │                                                              │
  └──────────────────────────────────────────────────────────────┘


  ┌──────────────────────────────────────────────────────────────┐
  │                   PROCESSAMENTO ASSINCRONO                    │
  │                       (WORKERS BullMQ)                        │
  │                                                              │
  │  ┌────────────────────────────────────────────────────────┐  │
  │  │  9. WEBHOOK DO MERCADOPAGO                             │  │
  │  │                                                        │  │
  │  │  MercadoPago envia notificacao para:                   │  │
  │  │  POST /api/services/payments/webhook                   │  │
  │  │                                                        │  │
  │  │  ┌────────────────────────────────────────────────┐    │  │
  │  │  │  Verificacao de assinatura (MP_WEBHOOK_SECRET) │    │  │
  │  │  │  para garantir que a notificacao e autentica   │    │  │
  │  │  └────────────────────────────────────────────────┘    │  │
  │  │                                                        │  │
  │  │  Eventos: payment.created, payment.updated,            │  │
  │  │           payment.refunded                             │  │
  │  │                                                        │  │
  │  └──────────────────────┬─────────────────────────────────┘  │
  │                         │                                    │
  │              ┌──────────┼──────────┐                         │
  │              │          │          │                         │
  │              ▼          ▼          ▼                         │
  │  ┌────────────────┐ ┌────────┐ ┌────────────────────┐       │
  │  │ 10. ANTI-FRAUD │ │PAYMENT │ │ 11. NOTIFICATION   │       │
  │  │     WORKER     │ │ WORKER │ │     WORKER         │       │
  │  │                │ │        │ │                    │       │
  │  │ Verifica:      │ │Processa│ │ Envia:             │       │
  │  │ - Valor        │ │estado  │ │ - Email            │       │
  │  │   suspeito     │ │do paga-│ │ - Push in-app      │       │
  │  │ - Frequencia   │ │mento   │ │                    │       │
  │  │   anormal      │ │        │ │ Para cliente e     │       │
  │  │ - Geolocali-   │ │Atualiza│ │ profissional       │       │
  │  │   zacao        │ │banco   │ │                    │       │
  │  │ - Padroes de   │ │        │ │                    │       │
  │  │   fraude       │ │        │ │                    │       │
  │  │                │ │        │ │                    │       │
  │  └────────────────┘ └────────┘ └────────────────────┘       │
  │                                                              │
  │  ┌────────────────────────────────────────────────────────┐  │
  │  │  12. RECONCILIATION WORKER (PERIODICO)                 │  │
  │  │                                                        │  │
  │  │  Job recorrente que verifica consistencia:              │  │
  │  │                                                        │  │
  │  │  - Compara status local vs status no MercadoPago       │  │
  │  │  - Detecta pagamentos "perdidos" (webhook falhou)      │  │
  │  │  - Corrige divergencias automaticamente                │  │
  │  │  - Gera alertas para divergencias criticas             │  │
  │  │                                                        │  │
  │  └────────────────────────────────────────────────────────┘  │
  │                                                              │
  └──────────────────────────────────────────────────────────────┘


  ┌──────────────────────────────────────────────────────────────┐
  │                    LIBERACAO DO ESCROW                        │
  │                                                              │
  │  ┌────────────────────────────────────────────────────────┐  │
  │  │  13. ESCROW - PERIODO DE CUSTODIA                      │  │
  │  │                                                        │  │
  │  │  Dinheiro fica retido ate:                             │  │
  │  │                                                        │  │
  │  │  ┌──────────────────────────────────────────────────┐  │  │
  │  │  │                                                  │  │  │
  │  │  │    CONDICAO 1: Ambas as partes confirmam          │  │  │
  │  │  │                conclusao do servico               │  │  │
  │  │  │                                                  │  │  │
  │  │  │              ──── OU ────                         │  │  │
  │  │  │                                                  │  │  │
  │  │  │    CONDICAO 2: Periodo de custodia expira         │  │  │
  │  │  │                (configuravel, padrao: 7 dias)     │  │  │
  │  │  │                sem disputa aberta                 │  │  │
  │  │  │                                                  │  │  │
  │  │  └──────────────────────────────────────────────────┘  │  │
  │  │                                                        │  │
  │  └──────────────────────┬─────────────────────────────────┘  │
  │                         │                                    │
  │                         ▼                                    │
  │  ┌────────────────────────────────────────────────────────┐  │
  │  │  14. DISTRIBUICAO DO VALOR                             │  │
  │  │                                                        │  │
  │  │  ┌──────────────────────────────────────────────────┐  │  │
  │  │  │                                                  │  │  │
  │  │  │   VALOR TOTAL DO SERVICO: R$ 200,00               │  │  │
  │  │  │                                                  │  │  │
  │  │  │   ┌─────────────────────────────────────────┐    │  │  │
  │  │  │   │                                         │    │  │  │
  │  │  │   │   ┌──────────────────┐                  │    │  │  │
  │  │  │   │   │ PROFISSIONAL     │                  │    │  │  │
  │  │  │   │   │ 90% = R$ 180,00  │                  │    │  │  │
  │  │  │   │   │                  │                  │    │  │  │
  │  │  │   │   │ Creditado na     │                  │    │  │  │
  │  │  │   │   │ Wallet do app    │                  │    │  │  │
  │  │  │   │   │                  │                  │    │  │  │
  │  │  │   │   │ Pode sacar via:  │                  │    │  │  │
  │  │  │   │   │ - PIX            │                  │    │  │  │
  │  │  │   │   │ - Transferencia  │                  │    │  │  │
  │  │  │   │   │   bancaria       │                  │    │  │  │
  │  │  │   │   └──────────────────┘                  │    │  │  │
  │  │  │   │                                         │    │  │  │
  │  │  │   │   ┌──────────────────┐                  │    │  │  │
  │  │  │   │   │ PLATAFORMA       │                  │    │  │  │
  │  │  │   │   │ 10% = R$ 20,00   │                  │    │  │  │
  │  │  │   │   │                  │                  │    │  │  │
  │  │  │   │   │ Taxa de servico  │                  │    │  │  │
  │  │  │   │   │ (receita da      │                  │    │  │  │
  │  │  │   │   │  plataforma)     │                  │    │  │  │
  │  │  │   │   └──────────────────┘                  │    │  │  │
  │  │  │   │                                         │    │  │  │
  │  │  │   └─────────────────────────────────────────┘    │  │  │
  │  │  │                                                  │  │  │
  │  │  └──────────────────────────────────────────────────┘  │  │
  │  │                                                        │  │
  │  └────────────────────────────────────────────────────────┘  │
  │                                                              │
  └──────────────────────────────────────────────────────────────┘
```

### Diagrama de Seguranca do Pagamento

```
┌───────────────────────────────────────────────────────────────────────┐
│             CAMADAS DE SEGURANCA NO PAGAMENTO                         │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  CAMADA 1: TOKENIZACAO (Frontend)                               │  │
│  │  Dados do cartao nunca chegam ao nosso servidor.                │  │
│  │  MercadoPago SDK gera um token no browser do cliente.           │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  CAMADA 2: IDEMPOTENCIA DUPLA (Redis + PostgreSQL)              │  │
│  │  Garante que um pagamento nunca seja processado duas vezes.     │  │
│  │  Redis NX SET (5min TTL) + UNIQUE constraint no banco.          │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  CAMADA 3: CIRCUIT BREAKER (Opossum)                            │  │
│  │  Protege contra falhas em cascata do MercadoPago.               │  │
│  │  Abre automaticamente se >50% das chamadas falharem.            │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  CAMADA 4: PAYMENT STATE MACHINE                                │  │
│  │  Transicoes de status sao validadas. Transicoes invalidas       │  │
│  │  sao rejeitadas automaticamente (ex: PENDING -> RELEASED).      │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  CAMADA 5: WEBHOOK SIGNATURE VERIFICATION                      │  │
│  │  Webhooks do MercadoPago sao verificados via assinatura         │  │
│  │  (MP_WEBHOOK_SECRET) para prevenir webhooks falsificados.       │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  CAMADA 6: ANTI-FRAUD WORKER (BullMQ)                           │  │
│  │  Worker assincrono analisa padroes suspeitos:                   │  │
│  │  valores atipicos, frequencia anormal, geolocalizacao.          │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  CAMADA 7: RECONCILIATION WORKER (BullMQ)                      │  │
│  │  Job periodico compara status local vs MercadoPago.             │  │
│  │  Detecta e corrige divergencias automaticamente.                │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  CAMADA 8: ESCROW (CUSTODIA)                                    │  │
│  │  Dinheiro retido ate confirmacao mutua ou expiracao do           │  │
│  │  periodo de custodia. Protege ambas as partes.                  │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### Metodos de Pagamento Suportados

```
┌───────────────────────────────────────────────────────────────────┐
│                  METODOS DE PAGAMENTO                              │
│                                                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐  │
│  │  CARTAO DE       │  │       PIX        │  │    BOLETO      │  │
│  │  CREDITO         │  │                  │  │    BANCARIO    │  │
│  │                  │  │                  │  │                │  │
│  │  - Visa          │  │  - Aprovacao     │  │  - Vencimento  │  │
│  │  - Mastercard    │  │    instantanea   │  │    em 3 dias   │  │
│  │  - Elo           │  │  - QR Code       │  │    uteis       │  │
│  │  - American      │  │  - Copia e cola  │  │  - Codigo de   │  │
│  │    Express       │  │  - Disponivel    │  │    barras      │  │
│  │                  │  │    24/7          │  │  - Pode pagar  │  │
│  │  - Parcelamento  │  │  - Sem taxas     │  │    em loteria  │  │
│  │    em ate 12x    │  │    para o        │  │    ou banco    │  │
│  │  - Tokenizacao   │  │    cliente       │  │                │  │
│  │    segura (SDK)  │  │                  │  │                │  │
│  │                  │  │                  │  │                │  │
│  └──────────────────┘  └──────────────────┘  └────────────────┘  │
│                                                                   │
│  Todos processados via MercadoPago (Sandbox em desenvolvimento,   │
│  Producao quando for para ar)                                     │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

## 6. ARQUITETURA DO SISTEMA

### 6.1 Visão Geral da Stack

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FAZTUDO — STACK COMPLETA                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐   ┌──────────────────┐   ┌────────────────┐   │
│  │   FRONTEND       │   │   ADMIN PANEL     │   │  APP MOBILE    │   │
│  │   React 19       │   │   React 19        │   │  (Futuro)      │   │
│  │   Vite 7.3       │   │   Vite 7.3        │   │                │   │
│  │   TailwindCSS 4  │   │   Recharts 3.7    │   │                │   │
│  │   TypeScript 5.9  │   │   TypeScript 5.9   │   │                │   │
│  │   :5173           │   │   :5174            │   │                │   │
│  └────────┬─────────┘   └────────┬──────────┘   └────────────────┘   │
│           │                      │                                    │
│           │    HTTPS / REST API  │                                    │
│           ▼                      ▼                                    │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │                    BACKEND — Express 5                        │    │
│  │                    TypeScript 5.9                             │    │
│  │                    Node.js 20                                │    │
│  │                    Porta :3001                                │    │
│  ├──────────────────────────────────────────────────────────────┤    │
│  │  Middlewares (12 camadas)  │  Controllers (24+)              │    │
│  │  Routes (27 arquivos)      │  Services (9 serviços)          │    │
│  │  BullMQ Queues (6 filas)   │  Workers (6 workers)            │    │
│  └─────────┬──────────────────┬──────────────────┬──────────────┘    │
│            │                  │                  │                    │
│            ▼                  ▼                  ▼                    │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐        │
│  │  PostgreSQL   │   │    Redis      │   │   MercadoPago    │        │
│  │  40+ modelos  │   │  BullMQ       │   │   API Externa    │        │
│  │  Prisma 7.4   │   │  Idempotencia │   │   Circuit Breaker│        │
│  │  :5432        │   │  :6379        │   │   Opossum 9.x    │        │
│  └──────────────┘   └──────────────┘   └──────────────────┘        │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                 INFRAESTRUTURA                                │   │
│  │  Docker Compose (5 containers)  │  GitHub Actions CI/CD      │   │
│  │  Pino (logging estruturado)     │  TruffleHog (secrets scan) │   │
│  │  Prometheus (metricas)          │  CodeQL (SAST analysis)    │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 Pipeline de Middlewares (Como uma Requisição é Processada)

Toda requisição HTTP passa por **12 camadas** de middleware antes de chegar ao controller:

```
Requisição HTTP
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│  CAMADA 1: Helmet                                        │
│  → Configura headers HTTP de segurança                   │
│  → Content-Security-Policy, X-Frame-Options, etc.        │
├──────────────────────────────────────────────────────────┤
│  CAMADA 2: CORS                                          │
│  → Permite requisições do frontend (:5173)               │
│  → Bloqueia origens não autorizadas                      │
├──────────────────────────────────────────────────────────┤
│  CAMADA 3: Rate Limiter                                  │
│  → 100 req/15min por IP (geral)                          │
│  → 5 req/15min para login (anti-brute-force)             │
│  → 3 req/1h para registro (anti-spam)                    │
├──────────────────────────────────────────────────────────┤
│  CAMADA 4: Body Parser                                   │
│  → Limite de 10MB para JSON                              │
│  → Parsing de cookies                                    │
├──────────────────────────────────────────────────────────┤
│  CAMADA 5: Sanitize (XSS Prevention)                     │
│  → Escapa caracteres HTML perigosos                      │
│  → Remove scripts maliciosos do input                    │
├──────────────────────────────────────────────────────────┤
│  CAMADA 6: Request Logger (Pino)                         │
│  → Loga method, path, userId, statusCode, duração        │
│  → JSON em produção, colorido em dev                     │
├──────────────────────────────────────────────────────────┤
│  CAMADA 7: Auth Logger                                   │
│  → Log específico de rotas autenticadas vs públicas      │
├──────────────────────────────────────────────────────────┤
│  CAMADA 8: verifyToken (JWT)                             │
│  → Verifica cookie httpOnly ou header Authorization      │
│  → Decodifica JWT e popula req.user                      │
│  → Verifica tokenVersion (invalidado em troca de senha)  │
├──────────────────────────────────────────────────────────┤
│  CAMADA 9: requireRole / requireVerified                 │
│  → Verifica se o usuário tem a role necessária           │
│  → Verifica se o email foi confirmado                    │
├──────────────────────────────────────────────────────────┤
│  CAMADA 10: Zod Validation                               │
│  → Valida body, query, params com schemas Zod v4         │
│  → 35+ schemas de validação definidos                    │
├──────────────────────────────────────────────────────────┤
│  CAMADA 11: requireMFA (Rotas Críticas)                  │
│  → Obrigatório para admins                               │
│  → Header x-mfa-code com TOTP de 6 dígitos              │
│  → Segredos criptografados AES-256-GCM                  │
├──────────────────────────────────────────────────────────┤
│  CAMADA 12: Audit Log                                    │
│  → Registra ação no banco (quem, o quê, quando, IP)      │
│  → Automático para todas as rotas importantes            │
└──────────────────────────────────────────────────────────┘
       │
       ▼
   Controller → Service → Database → Response
```

### 6.3 Estrutura de Pastas

```
faztudo-main/
│
├── backend/                          ← API REST
│   ├── src/
│   │   ├── index.ts                  ← Entry point (28 routers registrados)
│   │   ├── config/
│   │   │   ├── env.ts                ← 35+ variáveis validadas
│   │   │   ├── mercadopago.ts        ← Config do gateway de pagamento
│   │   │   └── secrets.ts            ← Multi-cloud secret provider
│   │   ├── controllers/              ← 24+ controllers
│   │   │   ├── authController.ts     ← Login, registro, JWT
│   │   │   ├── adminController.ts    ← Painel administrativo
│   │   │   ├── dashboardController.ts
│   │   │   ├── walletController.ts
│   │   │   ├── mfaController.ts      ← Autenticação 2 fatores
│   │   │   ├── sessionController.ts  ← Tracking de sessões
│   │   │   ├── company*Controller.ts ← 7 controllers de empresa
│   │   │   └── service/              ← 15 sub-controllers
│   │   │       ├── orderController.ts
│   │   │       ├── paymentController.ts
│   │   │       ├── chatController.ts
│   │   │       ├── reviewController.ts
│   │   │       └── ...
│   │   ├── routes/                   ← 27 arquivos de rotas
│   │   ├── services/                 ← 9 serviços de negócio
│   │   │   ├── mercadopagoService.ts ← Integração pagamentos
│   │   │   ├── escrowService.ts      ← Custódia de pagamentos
│   │   │   ├── notificationService.ts
│   │   │   ├── emailService.ts       ← Brevo SMTP
│   │   │   ├── geocodingService.ts   ← Geolocalização
│   │   │   └── recommendationService.ts
│   │   ├── middleware/               ← 14 middlewares
│   │   ├── queues/                   ← BullMQ (produtores + filas)
│   │   ├── workers/                  ← 6 workers assíncronos
│   │   ├── scheduler/                ← Jobs recorrentes (cron)
│   │   └── lib/                      ← Utilitários compartilhados
│   │       ├── prisma.ts             ← Client do banco
│   │       ├── logger.ts             ← Pino estruturado
│   │       ├── socket.ts             ← Socket.io real-time
│   │       ├── metrics.ts            ← Prometheus
│   │       ├── circuitBreaker.ts     ← Opossum
│   │       └── paymentStateMachine.ts
│   ├── prisma/
│   │   ├── schema.prisma             ← 40+ modelos, 14 enums
│   │   └── seed.ts                   ← Dados de teste (1220 linhas)
│   └── tests/                        ← 40 arquivos, 337 testes
│
├── frontend/                         ← SPA React
│   ├── src/
│   │   ├── App.tsx                   ← Router (53 rotas)
│   │   ├── pages/                    ← 53 páginas
│   │   │   ├── client/               ← Dashboard, pedidos, favoritos
│   │   │   ├── professional/         ← Dashboard, CRM, calendário
│   │   │   ├── company/              ← Dashboard, membros, salário
│   │   │   ├── services/             ← Busca, detalhes, chat
│   │   │   ├── checkout/             ← Pagamento, confirmação
│   │   │   ├── orders/               ← Detalhes de pedido
│   │   │   └── admin/                ← Painel admin
│   │   ├── components/               ← 60 componentes
│   │   ├── services/                 ← 13 API clients (Axios)
│   │   ├── context/                  ← 5 providers (Auth, Theme, Toast, Tour, Socket)
│   │   ├── hooks/                    ← 9 hooks customizados
│   │   └── types/                    ← 14 módulos de tipos
│   └── public/                       ← Assets estáticos
│
├── admin/                            ← Painel administrativo separado
├── docker-compose.yml                ← 5 containers
├── .github/workflows/ci.yml          ← CI/CD pipeline
└── docs/                             ← Documentação e planos
```

---

## 7. BANCO DE DADOS

### 7.1 Visão Geral

- **ORM**: Prisma 7.4 com PostgreSQL (driver nativo via `@prisma/adapter-pg`)
- **Modelos**: 40+ modelos organizados por domínio
- **Enums**: 14 enums para status, roles e tipos
- **Redis**: IORedis 5.x para filas (BullMQ), idempotência e cache

### 7.2 Mapa de Entidades (Diagrama de Relacionamentos)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DOMÍNIO PRINCIPAL                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────┐     ┌────────────────┐     ┌─────────────────┐       │
│  │   User    │────▶│ ServiceListing │     │ ServiceCategory │       │
│  │          │     │ (Catálogo)     │◀────│ (20 categorias) │       │
│  │ id       │     │                │     │ 108 subcategorias│       │
│  │ email    │     │ title          │     └─────────────────┘       │
│  │ name     │     │ price          │                                │
│  │ role     │     │ description    │                                │
│  │ cpf      │     │ images[]       │                                │
│  │ status   │     └───────┬────────┘                                │
│  └────┬─────┘             │                                         │
│       │                   │  cria pedido                            │
│       │                   ▼                                         │
│       │         ┌────────────────┐      ┌──────────────┐           │
│       │         │ ServiceOrder   │─────▶│   Payment    │           │
│       ├────────▶│ (Pedido)       │      │              │           │
│       │ client  │                │      │ method       │           │
│       │ + prof  │ status         │      │ status       │           │
│       │         │ price          │      │ mpPaymentId  │           │
│       │         │ scheduledDate  │      │ platformFee  │           │
│       │         └───────┬────────┘      └──────┬───────┘           │
│       │                 │                      │                    │
│       │                 ▼                      ▼                    │
│       │    ┌─────────────────┐    ┌────────────────────┐           │
│       │    │    Message      │    │   PaymentEvent     │           │
│       │    │ (Chat)          │    │ (Histórico financ.) │           │
│       │    │ content         │    │ type, amount       │           │
│       │    │ attachments     │    │ idempotencyKey     │           │
│       │    └─────────────────┘    └────────────────────┘           │
│       │                                                             │
│       │    ┌──────────┐  ┌──────────┐  ┌────────────────┐         │
│       ├───▶│  Review   │  │ Proposal │  │   Dispute      │         │
│       │    │ rating    │  │ price    │  │ reason         │         │
│       │    │ comment   │  │ details  │  │ status         │         │
│       │    └──────────┘  └──────────┘  │ resolution     │         │
│       │                                 └────────────────┘         │
│       │                                                             │
│       │    ┌─────────────────────┐  ┌──────────────────┐           │
│       ├───▶│ Notification        │  │   Transaction    │           │
│       │    │ title, message      │  │ (Movimentações)  │           │
│       │    │ type, read          │  │ amount, type     │           │
│       │    └─────────────────────┘  │ walletBalance    │           │
│       │                              └──────────────────┘           │
│       │                                                             │
│       │    ┌──────────────────┐  ┌──────────────────────┐          │
│       ├───▶│ Address           │  │ ProfessionalSchedule │          │
│       │    │ cep, street       │  │ dayOfWeek            │          │
│       │    │ lat, lng          │  │ startTime, endTime   │          │
│       │    └──────────────────┘  └──────────────────────┘          │
│       │                                                             │
│       │    ┌───────────────┐  ┌──────────────────┐                 │
│       ├───▶│ UserMFA        │  │   AuditLog       │                 │
│       │    │ secret (AES)   │  │ action, entity   │                 │
│       │    │ enabled        │  │ userId, ip       │                 │
│       │    └───────────────┘  │ timestamp        │                 │
│       │                       └──────────────────┘                 │
│       │                                                             │
│       │    ┌──────────────────┐  ┌──────────────────┐              │
│       └───▶│ UserSession      │  │ Favorite          │              │
│            │ startedAt        │  │ userId+listingId  │              │
│            │ endedAt          │  └──────────────────┘              │
│            │ pageViews        │                                     │
│            └──────────────────┘                                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                      DOMÍNIO EMPRESARIAL                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐                                                   │
│  │ CompanyProfile│─────┬────────────────────────────────────┐       │
│  │ companyName   │     │                                    │       │
│  │ cnpj          │     ▼                                    │       │
│  │ industry      │  ┌──────────────┐   ┌────────────────┐  │       │
│  │ description   │  │CompanyMember │   │  CompanyRole    │  │       │
│  │ verified      │  │ userId       │──▶│  name           │  │       │
│  └──────────────┘  │ roleId       │   │  permissions{}  │  │       │
│                     └──────────────┘   └────────────────┘  │       │
│                                                             │       │
│  ┌──────────────────┐  ┌────────────────────────┐          │       │
│  │ CompanyTeam       │  │ CompanyChannel          │          │       │
│  │ name              │  │ name                    │          │       │
│  │ members[]         │  │ categoryId              │          │       │
│  └──────────────────┘  │ teams[]                  │          │       │
│                         └────────────────────────┘          │       │
│                                                             │       │
│  ┌──────────────────────┐  ┌────────────────────┐          │       │
│  │CompanyStorefrontSection│  │ CompanySalaryRule  │          │       │
│  │ title, items[]         │  │ memberId, amount  │          │       │
│  │ teamMembers (JSON)     │  │ dayOfMonth        │          │       │
│  └──────────────────────┘  └────────────────────┘          │       │
│                                                             │       │
│  ┌──────────────────┐  ┌──────────────────────┐            │       │
│  │ CompanyInvite     │  │ CompanyAnalytics      │            │       │
│  │ email, status     │  │ profileViews          │            │       │
│  │ expiresAt         │  │ totalRevenue          │            │       │
│  └──────────────────┘  └──────────────────────┘            │       │
│                                                             │       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     DOMÍNIO DE VITRINE (STOREFRONT)                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌────────────────────┐                                             │
│  │ Storefront          │ (Vitrine do profissional)                   │
│  │ userId              │                                             │
│  │ slug                │                                             │
│  │ published           │                                             │
│  └────────┬───────────┘                                             │
│           │                                                         │
│           ▼                                                         │
│  ┌────────────────────┐                                             │
│  │ StorefrontCategory  │ (Categorias de serviço)                     │
│  │ name, position      │                                             │
│  └────────┬───────────┘                                             │
│           │                                                         │
│           ▼                                                         │
│  ┌────────────────────┐                                             │
│  │ StorefrontService   │ (Serviços oferecidos)                       │
│  │ name, price, desc   │                                             │
│  │ duration             │                                             │
│  └────────┬───────────┘                                             │
│           │                                                         │
│           ▼                                                         │
│  ┌────────────────────┐                                             │
│  │ StorefrontOption    │ (Opções/add-ons)                             │
│  │ name, price         │                                             │
│  └────────────────────┘                                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.3 Enums Importantes

```
┌──────────────────────┬──────────────────────────────────────────────┐
│ Enum                 │ Valores                                      │
├──────────────────────┼──────────────────────────────────────────────┤
│ UserRole             │ CLIENT, PROFESSIONAL, ADMIN, COMPANY         │
│ UserStatus           │ ACTIVE, INACTIVE, SUSPENDED, BANNED          │
│ ServiceOrderStatus   │ PENDING → ACCEPTED → IN_PROGRESS →          │
│                      │ AWAITING_CLIENT_CONFIRMATION →               │
│                      │ AWAITING_PROFESSIONAL_CONFIRMATION →         │
│                      │ COMPLETED / CANCELLED / DISPUTED             │
│ PaymentStatus        │ PENDING → PROCESSING → HELD (escrow) →      │
│                      │ RELEASED / REFUNDED / FAILED                 │
│ PaymentMethod        │ PIX, CREDIT_CARD, DEBIT_CARD, BOLETO        │
│ TransactionType      │ PAYMENT, ESCROW_HOLD, ESCROW_RELEASE,       │
│                      │ WITHDRAWAL, PLATFORM_FEE, REFUND             │
│ NotificationType     │ ORDER, PAYMENT, CHAT, REVIEW, SYSTEM        │
│ DisputeStatus        │ OPEN, UNDER_REVIEW, RESOLVED, ESCALATED     │
│ InviteStatus         │ PENDING, ACCEPTED, REJECTED, EXPIRED        │
│ VerificationStatus   │ PENDING, APPROVED, REJECTED                 │
└──────────────────────┴──────────────────────────────────────────────┘
```

### 7.4 Redis — Usos no Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                        REDIS (:6379)                             │
├───────────────────┬─────────────────────────────────────────────┤
│ Uso               │ Detalhes                                    │
├───────────────────┼─────────────────────────────────────────────┤
│ BullMQ Queues     │ 6 filas: notification, email, payment,     │
│                   │ reconciliation, anti-fraud, scheduled       │
│ Idempotência      │ NX SET com TTL de 5 min para pagamentos    │
│                   │ Garante que pagamento duplicado é ignorado  │
│ Circuit Breaker   │ Estado do circuito MercadoPago              │
│ Rate Limiting     │ Contadores por IP com TTL                   │
│ Session Cache     │ Cache temporário de sessões ativas          │
└───────────────────┴─────────────────────────────────────────────┘
```

---

## 8. SEGURANÇA E AUDITORIA

### 8.1 Camadas de Proteção

```
┌─────────────────────────────────────────────────────────────────────┐
│                   SEGURANÇA DO FAZTUDO — 8 CAMADAS                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  CAMADA 1: REDE                                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Helmet.js → Headers HTTP seguros (CSP, HSTS, X-Frame-Options)│ │
│  │  CORS → Apenas frontend autorizado (localhost:5173)            │ │
│  │  Rate Limiting → Proteção contra DDoS e brute-force            │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  CAMADA 2: INPUT                                                    │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  XSS Sanitization → Escapa HTML perigoso em todos os inputs    │ │
│  │  Zod Validation → 35+ schemas tipados para validar dados       │ │
│  │  Chat Filter → Filtra conteúdo impróprio em mensagens          │ │
│  │  File Upload Auth → Verifica permissão antes de aceitar arquivo│ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  CAMADA 3: AUTENTICAÇÃO                                             │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  JWT Access Token (httpOnly cookie, 15min)                     │ │
│  │  JWT Refresh Token (httpOnly cookie, 30 dias)                  │ │
│  │  Token Version → Invalidação em troca de senha                 │ │
│  │  Bcrypt → Hash de senhas com salt round configurável           │ │
│  │  SameSite Cookie → "lax" em dev, "strict" em produção          │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  CAMADA 4: AUTORIZAÇÃO                                              │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  RBAC → 4 roles (CLIENT, PROFESSIONAL, ADMIN, COMPANY)        │ │
│  │  requireRole() → Verifica role do usuário                      │ │
│  │  requireVerified → Exige email verificado                      │ │
│  │  requireSelfOrAdmin → Acesso apenas ao próprio recurso         │ │
│  │  requireCompanyPermission() → Permissões granulares por empresa│ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  CAMADA 5: MFA (Autenticação Multifator)                            │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  TOTP (Time-based One-Time Password) → Google Authenticator    │ │
│  │  Segredos criptografados → AES-256-GCM no banco               │ │
│  │  Obrigatório para admins → 403 se não configurado              │ │
│  │  Header x-mfa-code → Código de 6 dígitos por requisição       │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  CAMADA 6: PAGAMENTOS                                               │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Circuit Breaker (Opossum) → Protege contra falhas MercadoPago│ │
│  │  Idempotência Dupla → Redis NX SET + DB Unique constraint     │ │
│  │  State Machine → Valida transições de status de pagamento      │ │
│  │  Webhook Signature → Verifica assinatura MP em webhooks        │ │
│  │  Anti-Fraud Worker → Análise assíncrona de transações          │ │
│  │  Reconciliation Worker → Verifica consistência de pagamentos   │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  CAMADA 7: AUDITORIA                                                │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  AuditLog automático → Middleware registra ações importantes    │ │
│  │  Campos: userId, action, entity, entityId, oldData, newData    │ │
│  │  IP Address → Registrado em cada ação                          │ │
│  │  User Agent → Registrado para rastreamento                     │ │
│  │  Timestamp → Preciso em cada evento                            │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  CAMADA 8: CI/CD & SCANNING                                        │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  GitHub Actions → Testes automáticos em cada push/PR           │ │
│  │  npm audit → Auditoria de dependências (high severity)         │ │
│  │  TruffleHog → Detecção de secrets vazados no código            │ │
│  │  CodeQL → SAST (Static Application Security Testing)           │ │
│  │  Testes de segurança → 8 arquivos dedicados                    │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.2 Fluxo de Auditoria

```
┌─────────┐    ┌───────────────┐    ┌──────────────────────────────┐
│ Usuário  │───▶│  Middleware    │───▶│  AuditLog no Banco           │
│ faz ação │    │  auditLog.ts  │    │                              │
└─────────┘    └───────────────┘    │  {                           │
                                     │    userId: 42,               │
                                     │    action: "UPDATE",         │
                                     │    entity: "ServiceOrder",   │
                                     │    entityId: 157,            │
                                     │    oldData: {...},           │
                                     │    newData: {...},           │
                                     │    ipAddress: "192.168.1.1", │
                                     │    userAgent: "Mozilla/5.0", │
                                     │    timestamp: "2026-02-22T"  │
                                     │  }                           │
                                     └──────────────────────────────┘
```

### 8.3 Segurança de Pagamento — Fluxo Detalhado

```
┌──────────────────────────────────────────────────────────────────┐
│            PROTEÇÃO DE PAGAMENTO — 5 VERIFICAÇÕES                │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. IDEMPOTÊNCIA (evita pagamento duplicado)                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Requisição chega → Redis NX SET (5min TTL)                │  │
│  │    ├─ Chave existe? → Retorna resultado anterior (409)     │  │
│  │    └─ Chave nova? → Prossegue + DB Unique constraint      │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  2. STATE MACHINE (evita transição inválida)                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  PENDING → PROCESSING → HELD → RELEASED                   │  │
│  │  Tentou PENDING → RELEASED? ❌ REJEITADO                  │  │
│  │  Cada transição validada antes de executar                 │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  3. CIRCUIT BREAKER (protege contra falha do MercadoPago)       │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Estado FECHADO → Chamadas normais                         │  │
│  │  >50% de falhas → Estado ABERTO (60s de cooldown)          │  │
│  │  Após 60s → Estado SEMI-ABERTO (tenta 1 chamada)          │  │
│  │  Sucesso → Fecha circuito. Falha → Abre novamente         │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  4. WEBHOOK VERIFICATION                                        │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  MercadoPago envia webhook → Verifica assinatura HMAC     │  │
│  │  Assinatura inválida → 401 Rejected                       │  │
│  │  Assinatura válida → Processa atualização de status       │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  5. ANTI-FRAUDE (análise assíncrona)                            │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Worker BullMQ analisa padrões suspeitos:                  │  │
│  │  - Múltiplos pagamentos em curto intervalo                 │  │
│  │  - Valores atípicos                                        │  │
│  │  - IPs suspeitos                                           │  │
│  │  Flagged → Notifica admin para revisão manual              │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 8.4 Testes de Segurança (8 arquivos dedicados)

```
┌──────────────────────────────────────────────────────────────────┐
│                    TESTES DE SEGURANÇA                            │
├─────────────────────┬────────────────────────────────────────────┤
│ Arquivo             │ O que testa                                │
├─────────────────────┼────────────────────────────────────────────┤
│ xss.test.ts         │ Injeção de scripts HTML/JS em inputs      │
│ validation.test.ts  │ Bypass de validação Zod                   │
│ rateLimiting.test.ts│ Brute-force e DDoS                        │
│ inputValidation.ts  │ SQL injection, path traversal             │
│ idor.test.ts        │ Acesso a recursos de outros usuários      │
│ dataLeak.test.ts    │ Vazamento de dados sensíveis na resposta  │
│ authBypass.test.ts  │ Tentativa de burlar autenticação          │
│ webhook.test.ts     │ Webhooks com assinatura inválida          │
└─────────────────────┴────────────────────────────────────────────┘
```

---

## 9. MÉTRICAS, ANALYTICS E PAINÉIS

### 9.1 Métricas do Sistema (Prometheus)

O backend expõe métricas em formato Prometheus no endpoint `/metrics` (acesso restrito a localhost):

```
┌─────────────────────────────────────────────────────────────────────┐
│                    MÉTRICAS PROMETHEUS (/metrics)                    │
├─────────────────────┬───────────────────────────────────────────────┤
│ Categoria           │ Métricas coletadas                            │
├─────────────────────┼───────────────────────────────────────────────┤
│ HTTP                │ Requisições por rota, método e status code    │
│                     │ Latência (percentis p50, p90, p99)            │
│                     │ Requisições em andamento                      │
├─────────────────────┼───────────────────────────────────────────────┤
│ Filas BullMQ        │ Jobs pendentes, ativos e completados          │
│                     │ Tempo médio de processamento                  │
│                     │ Taxa de falha por fila                        │
├─────────────────────┼───────────────────────────────────────────────┤
│ Pagamentos          │ Total por método (PIX, cartão, boleto)        │
│                     │ Total por status (sucesso, falha, pendente)   │
│                     │ Valor médio de transação                      │
├─────────────────────┼───────────────────────────────────────────────┤
│ Circuit Breaker     │ Estado atual (aberto/fechado/semi-aberto)     │
│                     │ Número de falhas consecutivas                 │
│                     │ Tempo desde última mudança de estado          │
├─────────────────────┼───────────────────────────────────────────────┤
│ MFA                 │ Tentativas de verificação (sucesso/falha)     │
│                     │ Usuários com MFA ativo                        │
├─────────────────────┼───────────────────────────────────────────────┤
│ Sistema             │ Uptime do processo                            │
│                     │ Uso de memória (heap)                         │
│                     │ Conexões ativas ao banco                      │
└─────────────────────┴───────────────────────────────────────────────┘
```

### 9.2 Health Check (/health)

```
GET /health → Retorna status de todos os componentes:

┌─────────────────────────────────────────────────────────────┐
│  {                                                          │
│    "status": "healthy",                                     │
│    "timestamp": "2026-02-22T12:00:00Z",                     │
│    "components": {                                          │
│      "database": { "status": "up", "latency": "2ms" },     │
│      "redis": { "status": "up", "latency": "1ms" },        │
│      "queues": {                                            │
│        "notification": { "waiting": 0, "active": 0 },      │
│        "email": { "waiting": 2, "active": 1 },             │
│        "payment": { "waiting": 0, "active": 0 },           │
│        "reconciliation": { "waiting": 0, "active": 0 },    │
│        "antiFraud": { "waiting": 0, "active": 0 }          │
│      },                                                     │
│      "circuitBreaker": {                                    │
│        "mercadopago": "CLOSED"                              │
│      }                                                      │
│    }                                                        │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
```

### 9.3 Painel Admin — Funcionalidades

```
┌─────────────────────────────────────────────────────────────────────┐
│                      PAINEL ADMINISTRATIVO                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │  DASHBOARD PRINCIPAL                                      │      │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │      │
│  │  │ Total    │  │ Pedidos  │  │ Receita  │  │ Usuários │ │      │
│  │  │ Usuários │  │ Ativos   │  │ Total    │  │ Novos    │ │      │
│  │  │  1.240   │  │   85     │  │R$ 45.2K  │  │   32     │ │      │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │      │
│  └──────────────────────────────────────────────────────────┘      │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │  GESTÃO DE USUÁRIOS                                       │      │
│  │  • Listar todos os usuários (filtro por role/status)     │      │
│  │  • Aprovar/rejeitar verificação de profissionais         │      │
│  │  • Suspender ou banir contas                             │      │
│  │  • Visualizar documentos de verificação (KYC)            │      │
│  │  • Ver histórico de ações (Audit Log)                    │      │
│  └──────────────────────────────────────────────────────────┘      │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │  GESTÃO DE PEDIDOS E DISPUTAS                             │      │
│  │  • Visualizar todos os pedidos do sistema                │      │
│  │  • Mediar disputas entre clientes e profissionais        │      │
│  │  • Aprovar/negar reembolsos                              │      │
│  │  • Configurar taxa da plataforma (% do escrow)           │      │
│  └──────────────────────────────────────────────────────────┘      │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │  CONFIGURAÇÕES DO SISTEMA                                 │      │
│  │  • Dias de custódia do escrow (padrão: 7 dias)           │      │
│  │  • Taxa da plataforma (padrão: 10%)                      │      │
│  │  • Categorias de serviço (20 categorias + 108 subs)      │      │
│  │  • Configurações de email (SMTP Brevo)                   │      │
│  └──────────────────────────────────────────────────────────┘      │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │  VERIFICAÇÃO DE EMPRESAS                                  │      │
│  │  • Aprovar/rejeitar perfis de empresa                    │      │
│  │  • Verificar CNPJ e documentação                         │      │
│  │  • Monitorar membros e atividade                         │      │
│  └──────────────────────────────────────────────────────────┘      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 9.4 Dashboard do Profissional

```
┌─────────────────────────────────────────────────────────────────────┐
│                  DASHBOARD DO PROFISSIONAL                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │  VISÃO GERAL                                              │      │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │      │
│  │  │ Pedidos  │  │ Receita  │  │ Avaliação │  │ Taxa de  │ │      │
│  │  │ Pendentes│  │ do Mês   │  │ Média     │  │ Conclusão│ │      │
│  │  │    3     │  │ R$ 2.4K  │  │  4.8 ★    │  │  94%     │ │      │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │      │
│  └──────────────────────────────────────────────────────────┘      │
│                                                                     │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐     │
│  │  CRM                 │  │  REPUTAÇÃO                       │     │
│  │  • Clientes ativos   │  │  • Rating médio                 │     │
│  │  • Histórico por     │  │  • Distribuição de notas        │     │
│  │    cliente           │  │  • Comparação com categoria     │     │
│  │  • Valor acumulado   │  │  • Tendência (últimos 30 dias)  │     │
│  │    por cliente       │  │  • Reviews mais recentes        │     │
│  └─────────────────────┘  └─────────────────────────────────┘     │
│                                                                     │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐     │
│  │  CALENDÁRIO          │  │  CARTEIRA                        │     │
│  │  • Agenda semanal    │  │  • Saldo disponível             │     │
│  │  • Bloqueios de      │  │  • Saldo em custódia            │     │
│  │    horário           │  │  • Histórico de transações      │     │
│  │  • Pedidos agendados │  │  • Solicitar saque              │     │
│  └─────────────────────┘  └─────────────────────────────────┘     │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │  VITRINE (STOREFRONT)                                     │      │
│  │  • Gerenciar categorias de serviço                       │      │
│  │  • Adicionar/editar serviços com preços                  │      │
│  │  • Opções e add-ons por serviço                          │      │
│  │  • Publicar/despublicar vitrine                          │      │
│  │  • URL personalizada (slug)                              │      │
│  └──────────────────────────────────────────────────────────┘      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 9.5 Dashboard da Empresa

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DASHBOARD DA EMPRESA                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │  VISÃO GERAL                                              │      │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │      │
│  │  │ Membros  │  │ Receita  │  │ Pedidos  │  │ Canais   │ │      │
│  │  │ Ativos   │  │ Total    │  │ Abertos  │  │ Ativos   │ │      │
│  │  │   12     │  │ R$ 18.7K │  │   23     │  │    5     │ │      │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │      │
│  └──────────────────────────────────────────────────────────┘      │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │  GESTÃO DE MEMBROS                                       │       │
│  │  • Convidar profissionais por email                     │       │
│  │  • Atribuir cargos e permissões                         │       │
│  │  • Criar equipes para canais de serviço                 │       │
│  │  • Gerenciar convites pendentes                         │       │
│  └─────────────────────────────────────────────────────────┘       │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │  CANAIS DE SERVIÇO                                       │       │
│  │  • Canal = Categoria de serviço da empresa              │       │
│  │  • Vincular equipes a canais específicos                │       │
│  │  • Ex: Canal "Elétrica" → Equipe "Eletricistas"        │       │
│  └─────────────────────────────────────────────────────────┘       │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │  REGRAS DE SALÁRIO                                       │       │
│  │  • Definir valor mensal por membro                      │       │
│  │  • Dia do mês para pagamento automático                 │       │
│  │  • Ativar/desativar regra por membro                    │       │
│  │  • Histórico de transferências                          │       │
│  └─────────────────────────────────────────────────────────┘       │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │  ANALYTICS DA EMPRESA                                    │       │
│  │  • Visualizações de perfil                              │       │
│  │  • Receita por período                                  │       │
│  │  • Desempenho por membro                                │       │
│  │  • Tracking de sessões de usuários                      │       │
│  └─────────────────────────────────────────────────────────┘       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 10. ROTAS DA API — MAPA COMPLETO

### 10.1 Rotas Públicas (Sem autenticação)

```
┌──────────┬──────────────────────────────┬──────────────────────────┐
│ Método   │ Rota                         │ Descrição                │
├──────────┼──────────────────────────────┼──────────────────────────┤
│ POST     │ /api/auth/register           │ Criar conta              │
│ POST     │ /api/auth/login              │ Login (retorna JWT)      │
│ POST     │ /api/auth/forgot-password    │ Solicitar reset de senha │
│ POST     │ /api/auth/reset-password     │ Redefinir senha          │
│ GET      │ /api/auth/verify-email/:token│ Verificar email          │
│ GET      │ /api/categories              │ Listar categorias        │
│ GET      │ /api/services                │ Buscar serviços          │
│ GET      │ /api/services/:id            │ Detalhes de um serviço   │
│ GET      │ /health                      │ Status do sistema        │
│ GET      │ /api/storefront/:slug        │ Vitrine pública          │
└──────────┴──────────────────────────────┴──────────────────────────┘
```

### 10.2 Rotas Autenticadas — Por Domínio

```
┌──────────────────────────────────────────────────────────────────┐
│  AUTH (/api/auth)                                                │
│  POST /refresh-token     │ Renovar JWT                          │
│  POST /logout            │ Logout (limpa cookies)               │
│  GET  /me                │ Perfil do usuário logado             │
│  PUT  /profile           │ Atualizar perfil                     │
├──────────────────────────────────────────────────────────────────┤
│  PEDIDOS (/api/services/orders)                                  │
│  POST /                  │ Criar pedido                         │
│  GET  /                  │ Listar pedidos do usuário            │
│  GET  /:id               │ Detalhes de um pedido                │
│  POST /:id/accept        │ Profissional aceita pedido           │
│  POST /:id/start         │ Profissional inicia serviço          │
│  POST /:id/submit        │ Profissional submete conclusão       │
│  POST /:id/confirm       │ Cliente confirma conclusão           │
│  POST /:id/cancel        │ Cancelar pedido                      │
├──────────────────────────────────────────────────────────────────┤
│  PAGAMENTOS (/api/services/payments)                             │
│  POST /create            │ Criar pagamento (MercadoPago)        │
│  POST /webhook           │ Webhook do MercadoPago               │
│  GET  /:orderId/status   │ Status do pagamento                  │
├──────────────────────────────────────────────────────────────────┤
│  CHAT (/api/services/messages)                                   │
│  GET  /:orderId          │ Mensagens de um pedido               │
│  POST /:orderId          │ Enviar mensagem                      │
│  POST /:orderId/upload   │ Upload de arquivo no chat            │
├──────────────────────────────────────────────────────────────────┤
│  CARTEIRA (/api/wallet)                                          │
│  GET  /balance           │ Saldo da carteira                    │
│  GET  /transactions      │ Histórico de transações              │
│  POST /withdraw          │ Solicitar saque                      │
├──────────────────────────────────────────────────────────────────┤
│  EMPRESA (/api/company)                                          │
│  POST /                  │ Criar perfil de empresa              │
│  GET  /profile           │ Perfil da empresa                    │
│  POST /members/invite    │ Convidar membro                      │
│  GET  /members           │ Listar membros                       │
│  POST /teams             │ Criar equipe                         │
│  POST /channels          │ Criar canal de serviço               │
│  GET  /salary/rules      │ Regras de salário                    │
│  POST /salary/rules      │ Criar regra de salário               │
│  PUT  /salary/transfer   │ Transferir salário                   │
├──────────────────────────────────────────────────────────────────┤
│  ADMIN (/api/admin)                                              │
│  GET  /users             │ Listar todos os usuários             │
│  GET  /users/:id         │ Detalhes de um usuário               │
│  PUT  /users/:id/status  │ Alterar status (ativar/banir)        │
│  GET  /verifications     │ Verificações pendentes               │
│  PUT  /verify/:id        │ Aprovar/rejeitar verificação         │
└──────────────────────────────────────────────────────────────────┘
```

---

## 11. WORKERS E PROCESSAMENTO ASSÍNCRONO

### 11.1 Filas BullMQ

```
┌─────────────────────────────────────────────────────────────────────┐
│                  PROCESSAMENTO ASSÍNCRONO (BullMQ)                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  API Backend                                                        │
│       │                                                             │
│       │ enqueue()                                                   │
│       ▼                                                             │
│  ┌──────────┐                                                       │
│  │  Redis    │ ◀── Filas armazenadas aqui                           │
│  └────┬─────┘                                                       │
│       │                                                             │
│       ├──────────────────┐                                          │
│       │                  │                                          │
│       ▼                  ▼                                          │
│  ┌─────────────┐  ┌──────────────┐                                 │
│  │ WORKER 1    │  │ WORKER 2     │                                 │
│  │ Notificação │  │ Email        │                                 │
│  │             │  │              │                                 │
│  │ Push + DB   │  │ Brevo SMTP   │                                 │
│  │ Socket.io   │  │ Templates    │                                 │
│  └─────────────┘  └──────────────┘                                 │
│       │                                                             │
│       ├──────────────────┐                                          │
│       │                  │                                          │
│       ▼                  ▼                                          │
│  ┌─────────────┐  ┌──────────────┐                                 │
│  │ WORKER 3    │  │ WORKER 4     │                                 │
│  │ Pagamento   │  │ Reconciliação│                                 │
│  │             │  │              │                                 │
│  │ MercadoPago │  │ Verifica     │                                 │
│  │ Webhook     │  │ consistência │                                 │
│  │ processing  │  │ de pagamentos│                                 │
│  └─────────────┘  └──────────────┘                                 │
│       │                                                             │
│       ├──────────────────┐                                          │
│       │                  │                                          │
│       ▼                  ▼                                          │
│  ┌─────────────┐  ┌──────────────┐                                 │
│  │ WORKER 5    │  │ SCHEDULER    │                                 │
│  │ Anti-Fraude │  │ Jobs Cron    │                                 │
│  │             │  │              │                                 │
│  │ Análise de  │  │ Expirar      │                                 │
│  │ padrões     │  │ pedidos,     │                                 │
│  │ suspeitos   │  │ reconciliar, │                                 │
│  │             │  │ limpar cache │                                 │
│  └─────────────┘  └──────────────┘                                 │
│                                                                     │
│  ⚠ Workers rodam como PROCESSOS SEPARADOS da API                   │
│  npm run worker    → Inicia todos os workers                       │
│  npm run scheduler → Inicia o scheduler de jobs recorrentes        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 12. INFRAESTRUTURA E CI/CD

### 12.1 Docker Compose (Desenvolvimento)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DOCKER COMPOSE — 5 CONTAINERS                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │  PostgreSQL   │  │    Redis      │  │   Backend    │             │
│  │  :5432        │  │  :6379        │  │  :3001       │             │
│  │  Volume:      │  │  Sem persist. │  │  Hot reload  │             │
│  │  pgdata       │  │  (dev only)   │  │  nodemon     │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐                                │
│  │  Frontend     │  │    Admin      │                                │
│  │  :5173        │  │  :5174        │                                │
│  │  Vite HMR     │  │  Vite HMR     │                                │
│  └──────────────┘  └──────────────┘                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 12.2 CI/CD Pipeline (GitHub Actions)

```
┌─────────────────────────────────────────────────────────────────────┐
│                   CI PIPELINE — 4 JOBS PARALELOS                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Push para main / Pull Request                                      │
│       │                                                             │
│       ├────────────────────────────────────────┐                    │
│       │                                        │                    │
│       ▼                                        ▼                    │
│  ┌────────────────────┐  ┌────────────────────────────┐            │
│  │ JOB 1: Backend     │  │ JOB 2: Frontend             │            │
│  │ • npm ci            │  │ • npm ci                    │            │
│  │ • prisma generate   │  │ • ESLint                    │            │
│  │ • tsc --noEmit      │  │ • tsc --noEmit              │            │
│  │ • npm test          │  │ • vite build                │            │
│  │ • vitest security/  │  │                             │            │
│  └────────────────────┘  └────────────────────────────┘            │
│       │                                        │                    │
│       ▼                                        ▼                    │
│  ┌────────────────────┐  ┌────────────────────────────┐            │
│  │ JOB 3: Security    │  │ JOB 4: CodeQL              │            │
│  │ • npm audit (high)  │  │ • SAST Analysis            │            │
│  │ • TruffleHog        │  │ • Security + Quality       │            │
│  │   (secret scanning) │  │ • javascript-typescript    │            │
│  └────────────────────┘  └────────────────────────────┘            │
│                                                                     │
│  Todos devem passar ✅ para merge na main                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 13. PARA INVESTIDORES — RESUMO EXECUTIVO

### 13.1 Números do Projeto

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FAZTUDO EM NÚMEROS                                │
├─────────────────────────┬───────────────────────────────────────────┤
│ Linhas de código        │ ~39.290 (14.250 backend + 25.040 front)  │
│ Modelos de dados        │ 40+ entidades no banco                   │
│ Testes automatizados    │ 337 testes (40 arquivos)                  │
│ Rotas da API            │ 90+ endpoints                            │
│ Páginas do frontend     │ 53 páginas                               │
│ Componentes React       │ 60 componentes                           │
│ Categorias de serviço   │ 20 categorias + 108 subcategorias        │
│ Workers assíncronos     │ 6 filas de processamento                 │
│ Testes de segurança     │ 8 arquivos dedicados                     │
│ Middlewares             │ 12 camadas de proteção                   │
├─────────────────────────┴───────────────────────────────────────────┤
│                                                                     │
│  🎯 MODELO DE RECEITA: 10% de taxa sobre cada serviço concluído   │
│                                                                     │
│  💰 Profissional recebe 90% via escrow (custódia segura)           │
│                                                                     │
│  🔒 Pagamento seguro via MercadoPago (PIX, Cartão, Boleto)        │
│                                                                     │
│  📊 Sistema empresarial completo (equipes, canais, salários)       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 13.2 Diferenciais Técnicos

```
┌─────────────────────────────────────────────────────────────────────┐
│                     DIFERENCIAIS COMPETITIVOS                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ✅ Escrow (Custódia) — Dinheiro protegido até conclusão           │
│  ✅ Pagamento só é liberado quando AMBOS confirmam                 │
│  ✅ Anti-fraude automatizado via worker dedicado                   │
│  ✅ Circuit breaker para alta disponibilidade                      │
│  ✅ Autenticação multifator (MFA/2FA) para admins                  │
│  ✅ Auditoria completa de todas as ações                           │
│  ✅ Sistema de disputas para resolver conflitos                    │
│  ✅ Vitrine personalizável para profissionais e empresas           │
│  ✅ CRM integrado para profissionais                               │
│  ✅ Sistema de recomendação personalizado                          │
│  ✅ Geolocalização com mapas interativos                           │
│  ✅ Chat em tempo real via Socket.io                                │
│  ✅ Email transacional (verificação, reset, notificações)          │
│  ✅ CI/CD com 4 jobs de qualidade e segurança                      │
│  ✅ Pronto para escalar (PostgreSQL + Redis + BullMQ)              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 13.3 Roadmap de Crescimento

```
┌─────────────────────────────────────────────────────────────────────┐
│                      ROADMAP FUTURO                                 │
├──────────────┬──────────────────────────────────────────────────────┤
│ Curto Prazo  │ • App mobile (React Native)                         │
│ (3 meses)    │ • WebSocket para chat em tempo real                 │
│              │ • Internacionalização (i18n)                        │
│              │ • Testes E2E automatizados (Playwright)             │
├──────────────┼──────────────────────────────────────────────────────┤
│ Médio Prazo  │ • Marketplace de produtos complementares           │
│ (6 meses)    │ • Sistema de assinaturas para profissionais        │
│              │ • Integração com mais gateways de pagamento         │
│              │ • IA para recomendação e matching                   │
├──────────────┼──────────────────────────────────────────────────────┤
│ Longo Prazo  │ • Expansão para outras cidades/estados             │
│ (12 meses)   │ • Programa de fidelidade para clientes             │
│              │ • API pública para integrações                     │
│              │ • White-label para empresas                        │
└──────────────┴──────────────────────────────────────────────────────┘
```

---

## 14. COMO RODAR O PROJETO

### 14.1 Pré-requisitos

```
• Node.js 20+
• PostgreSQL 15+
• Redis 7+
• Docker e Docker Compose (recomendado)
```

### 14.2 Setup Rápido

```bash
# 1. Clonar o repositório
git clone git@github.com:levygamer200-ux/faztudo.git
cd faztudo-main

# 2. Subir banco e Redis via Docker
docker compose up postgres redis -d

# 3. Backend
cd backend
cp .env.example .env          # Configurar variáveis
npm install
npx prisma generate
npx prisma db push
npm run db:seed               # Popular com dados de teste
npm run dev                   # API em http://localhost:3001

# 4. Workers (em outro terminal)
cd backend
npm run worker                # Workers BullMQ
npm run scheduler             # Jobs recorrentes

# 5. Frontend (em outro terminal)
cd frontend
cp .env.example .env          # Configurar VITE_API_URL
npm install
npm run dev                   # App em http://localhost:5173
```

### 14.3 Usuários de Teste

```
┌─────────────────────────┬────────────────────────┬──────────────┐
│ Role                    │ Email                  │ Senha        │
├─────────────────────────┼────────────────────────┼──────────────┤
│ Cliente                 │ cliente@teste.com      │ Teste@123    │
│ Profissional 1          │ profissional@teste.com │ Teste@123    │
│ Profissional 2          │ profissional2@teste.com│ Teste@123    │
│ Empresa                 │ empresa@teste.com      │ Teste@123    │
│ Admin                   │ admin@teste.com        │ Teste@123    │
└─────────────────────────┴────────────────────────┴──────────────┘
```

---

> **Documento gerado automaticamente** a partir da análise completa do código-fonte do FazTudo.
> **Última atualização**: 2026-02-22
