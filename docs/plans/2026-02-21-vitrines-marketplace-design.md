# Vitrines Marketplace — Design Document

> **Data**: 2026-02-21
> **Autor**: Design colaborativo via brainstorming
> **Status**: Aprovado

## Resumo

Refatoracao do sistema de servicos do FazTudo: de servicos avulsos (ServiceListing) para um modelo de **Vitrines** estilo iFood, onde cada profissional/empresa tem sua propria "loja" personalizada com categorias internas, servicos e opcionais.

---

## Decisoes de Design

| Decisao | Escolha |
|---------|---------|
| Relacao Vitrine ↔ Usuario | 1 vitrine por profissional/empresa |
| Categorias internas | Livres (profissional cria como quiser) |
| Opcionais | Variantes que podem ou nao alterar preco |
| Carrinho | 1 por vitrine, client-side, reset apos 1h de ociosidade |
| ServiceListing existente | Substituicao completa |
| Storefront empresa existente | Substituido pelo modelo unificado de Vitrine |
| Busca | Hibrida (vitrines + servicos individuais) |
| Abordagem arquitetural | Modelo novo completo (Prisma) |

---

## 1. Modelo de Dados (Prisma)

### Novos modelos:

```prisma
model Storefront {
  id          Int      @id @default(autoincrement())
  userId      Int      @unique
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  name        String
  slug        String   @unique
  description String?
  logo        String?
  banner      String?

  isActive    Boolean  @default(true)
  isPublished Boolean  @default(false)

  mainCategoryId  Int?
  mainCategory    ServiceCategory? @relation(fields: [mainCategoryId], references: [id])

  ratingAverage   Float   @default(0.0)
  totalReviews    Int     @default(0)
  totalServices   Int     @default(0)

  categories  StorefrontCategory[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([slug])
  @@index([isActive, isPublished])
  @@index([mainCategoryId])
}

model StorefrontCategory {
  id           Int        @id @default(autoincrement())
  storefrontId Int
  storefront   Storefront @relation(fields: [storefrontId], references: [id], onDelete: Cascade)

  name         String
  order        Int
  isActive     Boolean    @default(true)

  services     StorefrontService[]

  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  @@index([storefrontId, order])
}

model StorefrontService {
  id           Int                @id @default(autoincrement())
  categoryId   Int
  category     StorefrontCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  title        String
  description  String?
  price        Float
  images       Json?
  isAvailable  Boolean            @default(true)
  order        Int

  options      StorefrontServiceOption[]
  orderItems   ServiceOrderItem[]

  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  @@index([categoryId, order])
  @@index([isAvailable])
}

model StorefrontServiceOption {
  id         Int               @id @default(autoincrement())
  serviceId  Int
  service    StorefrontService @relation(fields: [serviceId], references: [id], onDelete: Cascade)

  name       String
  price      Float?    // null = sem alteracao, valor = novo preco
  isDefault  Boolean   @default(false)
  order      Int

  orderItems ServiceOrderItem[] @relation("SelectedOptions")

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([serviceId, order])
}

model ServiceOrderItem {
  id              Int               @id @default(autoincrement())
  serviceOrderId  Int
  serviceOrder    ServiceOrder      @relation(fields: [serviceOrderId], references: [id], onDelete: Cascade)
  serviceId       Int
  service         StorefrontService @relation(fields: [serviceId], references: [id])

  quantity        Int     @default(1)
  unitPrice       Float
  totalPrice      Float

  selectedOptions StorefrontServiceOption[] @relation("SelectedOptions")

  createdAt       DateTime @default(now())

  @@index([serviceOrderId])
  @@index([serviceId])
}
```

### Mudancas em modelos existentes:

- **User**: adicionar `storefront Storefront?`
- **ServiceOrder**: adicionar `items ServiceOrderItem[]`
- **ServiceOrder.serviceListingId**: manter como campo legado (nullable)

---

## 2. API Routes

### Novo arquivo: `backend/src/routes/storefrontRoutes.ts`

```
GET    /api/storefronts                           # Listar vitrines (publico)
GET    /api/storefronts/:slug                     # Ver vitrine por slug (publico)
GET    /api/storefronts/mine                      # Minha vitrine (autenticado)
POST   /api/storefronts                           # Criar vitrine
PUT    /api/storefronts/mine                      # Atualizar minha vitrine
PUT    /api/storefronts/mine/publish              # Publicar/despublicar

GET    /api/storefronts/mine/categories           # Listar categorias
POST   /api/storefronts/mine/categories           # Criar categoria
PUT    /api/storefronts/mine/categories/:id       # Editar categoria
PUT    /api/storefronts/mine/categories/reorder   # Reordenar
DELETE /api/storefronts/mine/categories/:id       # Remover

GET    /api/storefronts/mine/services             # Listar servicos
POST   /api/storefronts/mine/services             # Criar servico
PUT    /api/storefronts/mine/services/:id         # Editar
DELETE /api/storefronts/mine/services/:id         # Remover

POST   /api/storefronts/mine/services/:id/options # Adicionar opcional
PUT    /api/storefronts/mine/options/:id          # Editar opcional
DELETE /api/storefronts/mine/options/:id          # Remover opcional
```

### Novos controllers:

- `backend/src/controllers/storefrontController.ts` — rotas publicas
- `backend/src/controllers/storefrontManageController.ts` — CRUD autenticado

### Mudanca em orderRoutes:

- `POST /api/services/orders/from-cart` — cria order a partir do carrinho

---

## 3. Frontend — Explorar (UX estilo iFood)

### Nova aba "Explorar" (`/explorar`):

1. **Barra de busca** no topo
2. **Cards de categorias** em scroll horizontal (cada categoria com imagem/foto propria + nome)
   - Apenas categorias PRINCIPAIS
   - Ao clicar: filtra o feed de vitrines por aquela categoria
   - Ao clicar novamente: desmarca, volta para todas
3. **Feed unico de vitrines** misturadas (todas as categorias)
   - Ordenacao por relevancia (rating + recencia + servicos)
   - Infinite scroll
   - Cards compactos: logo, nome, rating, nro servicos, categoria principal
4. **Busca hibrida**: retorna vitrines + servicos individuais

### Pagina da Vitrine (`/vitrine/:slug`):

1. **Header**: banner + logo + nome + rating + descricao
2. **Navegacao por categorias**: scroll horizontal com nomes das categorias internas
3. **Listagem de servicos** por categoria com precos
4. **Carrinho flutuante**: bottom bar com total e botao "Ver carrinho"
5. **Modal de servico**: descricao + opcionais + "Tirar duvidas" + "Adicionar ao carrinho"

### Estrutura de arquivos:

```
frontend/src/pages/
  explore/
    Explore.tsx
    StorefrontView.tsx
  professional/
    StorefrontSetup.tsx
    StorefrontManager.tsx

frontend/src/components/
  storefront/
    StorefrontCard.tsx
    StorefrontGrid.tsx
    StorefrontHeader.tsx
    StorefrontCategoryNav.tsx
    ServiceItemCard.tsx
    ServiceDetailModal.tsx
    ServiceCart.tsx
    CartSummary.tsx
    OptionSelector.tsx
```

### Carrinho (client-side):

- `localStorage` com chave `cart_storefront_{id}`
- Inclui `lastActivity: timestamp`
- Reset automatico apos 1h de ociosidade
- Hook `useStorefrontCart(storefrontId)` gerencia add/remove/clear/total

### Novas rotas no App.tsx:

```tsx
<Route path="explorar" element={<Explore />} />
<Route path="vitrine/:slug" element={<StorefrontView />} />
<Route path="professional/storefront" element={<StorefrontSetup />} />
<Route path="professional/storefront/manage" element={<StorefrontManager />} />
<Route path="company/storefront" element={<StorefrontSetup />} />
<Route path="company/storefront/manage" element={<StorefrontManager />} />
```

---

## 4. Categorias Globais (ServiceCategory)

20 categorias principais com subcategorias:

| # | Categoria Principal | Subcategorias |
|---|---|---|
| 1 | Manutencao e Reparos | Eletricista, Encanador, Pintor, Pedreiro, Marceneiro, Serralheiro, Gesseiro, Vidraceiro, Telhadista |
| 2 | Limpeza | Limpeza Residencial, Limpeza Comercial, Limpeza Pos-Obra, Lavagem de Estofados, Limpeza de Piscina, Dedetizacao, Higienizacao de Ar-Condicionado |
| 3 | Instalacoes | Ar Condicionado, Antenas e TV, Redes e Internet, Cameras de Seguranca, Fechaduras, Chuveiros e Torneiras, Aquecedores, Energia Solar |
| 4 | Construcao e Reforma | Reforma Residencial, Reforma Comercial, Alvenaria, Acabamento, Piso e Revestimento, Impermeabilizacao, Projeto Arquitetonico |
| 5 | Beleza e Estetica | Cabeleireiro, Manicure/Pedicure, Maquiagem, Design de Sobrancelhas, Depilacao, Barbearia, Estetica Facial, Massagem |
| 6 | Saude e Bem-Estar | Fisioterapia, Nutricionista, Psicologo, Enfermagem Domiciliar, Personal Trainer, Cuidador de Idosos, Fonoaudiologo |
| 7 | Aulas e Educacao | Reforco Escolar, Aulas de Idiomas, Aulas de Musica, Aulas de Informatica, Preparatorio Concursos, Preparatorio Vestibular, Educacao Especial |
| 8 | Eventos e Festas | Buffet, Decoracao, DJ e Sonorizacao, Fotografia, Filmagem, Garcom, Cerimonialista, Aluguel de Equipamentos |
| 9 | Servicos Domesticos | Diarista, Passadeira, Cozinheira, Baba, Cuidador de Idosos, Lavanderia, Organizacao de Ambientes |
| 10 | Pets e Animais | Banho e Tosa, Pet Sitter, Dog Walker, Veterinario Domiciliar, Adestramento |
| 11 | Jardinagem e Paisagismo | Corte de Grama, Poda de Arvores, Paisagismo, Limpeza de Terreno, Irrigacao, Manutencao de Jardim |
| 12 | Mudancas e Fretes | Mudanca Residencial, Mudanca Comercial, Carreto, Montagem de Moveis, Embalagem |
| 13 | Automotivo | Mecanica, Auto Eletrica, Funilaria e Pintura, Vidracaria Automotiva, Estetica Automotiva, Borracharia, Guincho |
| 14 | Tecnologia e Informatica | Conserto de Celular, Conserto de Computador, Suporte Tecnico, Formatacao, Redes, Desenvolvimento Web, Marketing Digital |
| 15 | Consertos e Assistencia Tecnica | Eletrodomesticos, Eletronicos, Maquinas de Costura, Celulares, Notebooks, Impressoras |
| 16 | Moda e Costura | Costureira, Alfaiate, Customizacao, Bordado, Conserto de Roupas |
| 17 | Servicos Rurais e Agricolas | Perfuracao de Poco, Cerca e Alambrado, Trator e Terraplanagem, Consultoria Agricola, Irrigacao Rural |
| 18 | Design e Comunicacao | Design Grafico, Social Media, Fotografia Profissional, Filmagem, Impressao e Grafica |
| 19 | Consultoria e Servicos Profissionais | Contabilidade, Advocacia, Despachante, Corretor de Imoveis, Consultoria Financeira, RH |
| 20 | Seguranca | Porteiro, Vigilante, Instalacao de Alarmes, Monitoramento, Escolta |

---

## 5. Migracao

1. Script automatico: ServiceListing → StorefrontService
   - Cria Storefront para cada profissional/empresa com listings
   - Cria categoria "Geral" como default
   - Converte listings em servicos da vitrine
2. ServiceOrder.serviceListingId mantido como campo legado
3. CompanyStorefront* modelos descontinuados apos migracao

## 6. Checkout

1. Cliente navega vitrine, adiciona servicos ao carrinho (localStorage)
2. Carrinho: servicos + opcionais + total
3. "Finalizar pedido" → POST /api/services/orders/from-cart
4. Backend cria ServiceOrder + ServiceOrderItems
5. Redirect para checkout/payment (fluxo existente)

## 7. "Tirar duvidas"

- Botao no modal de servico
- Cria DRAFT order vinculado a vitrine
- Abre chat entre cliente e profissional
- Conversao DRAFT → order real se decidir contratar
