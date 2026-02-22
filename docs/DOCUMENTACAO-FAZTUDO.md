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

> **Nota**: Secoes 6-9 adicionadas abaixo com diagramas ASCII detalhados.
