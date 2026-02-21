# Correções & Novas Features — Checkout, Schedule, Upload, Vitrine

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Corrigir 4 bugs críticos e implementar 4 novas features: (1) PIX/checkout notification_url inválida, (2) reschedule 400 por mismatch de campo, (3) upload de imagens de serviço com validação de segurança, (4) analytics duplo `/api/api/` + type mismatches + channel member management UI.

**Architecture:** Correções cirúrgicas nos pontos exatos de falha; upload via multer local (reutilizando infraestrutura existente do chat); vitrine/channels com UI de gerenciamento de membros; analytics com fix de prefixo e alinhamento de tipos.

**Tech Stack:** Express 5 + TypeScript, Prisma 7, Zod 4, React 19, React Router 7, TailwindCSS 4, multer (já instalado), file-type (já instalado), Axios, lucide-react

---

## Mapa de Bugs Confirmados

| # | Bug | Arquivo(s) | Causa Raiz |
|---|-----|-----------|------------|
| B1 | PIX gera "notificaction_url attribute must be url valid" | `mercadopagoService.ts` | `notification_url` = `http://localhost:3001/...` — MP não aceita localhost em sandbox |
| B2 | Reschedule retorna 400 "Data inválida" | `validation.ts` (Zod), `scheduleController.ts` | Zod espera `scheduledDate`, frontend envia `newDate` |
| B3 | Analytics: 3 de 7 chamadas retornam 404 | `frontend/src/pages/company/Analytics.tsx` | Calls usam `/api/company/...` ao invés de `/company/...` (baseURL já tem `/api`) |
| B4 | NPS e TeamOccupancy mostram dados errados | `frontend/src/types/company.ts`, `Analytics.tsx` | `NPSData.score` vs `nps`, `TeamOccupancyEntry.name` vs `memberName` |

---

## Task 1: Fix B2 — Reschedule payload mismatch (Zod `scheduledDate` vs controller `newDate`)

**Files:**
- Modify: `backend/src/middleware/validation.ts` (linha ~496)

**Step 1: Localizar o schema**

```bash
grep -n "rescheduleOrderSchema" backend/src/middleware/validation.ts
```

Esperado: linha com `scheduledDate: z.string().datetime(...)`.

**Step 2: Corrigir o schema para aceitar `newDate`**

Encontrar no arquivo:
```ts
export const rescheduleOrderSchema = z.object({
  scheduledDate: z.string().datetime("Data inválida"),
  message: z.string().max(500).optional(),
});
```

Substituir por:
```ts
export const rescheduleOrderSchema = z.object({
  newDate: z.string().min(1, "Data é obrigatória"),
  reason: z.string().max(500).optional(),
});
```

> **Por quê**: O controller em `scheduleController.ts` lê `req.body.newDate` e `req.body.reason`. O frontend envia exatamente `{ newDate: "YYYY-MM-DDTHH:MM:00", reason?: string }`. O Zod estava bloqueando antes de chegar ao controller com 400. A validação `.datetime()` é desnecessária aqui pois `validateRescheduleRequest()` no service já valida com `new Date(newDate)`.

**Step 3: Verificar tipos TypeScript**

```bash
cd backend && npx tsc --noEmit 2>&1 | head -30
```

Esperado: sem erros novos.

**Step 4: Testar manualmente (backend rodando)**

Com o servidor em execução (`npm run dev`), testar no Postman ou curl:
```bash
curl -X POST http://localhost:3001/api/services/orders/59/reschedule \
  -H "Authorization: Bearer <token_cliente>" \
  -H "Content-Type: application/json" \
  -d '{"newDate":"2026-03-15T09:00:00"}'
```

Esperado: `200 OK` com `{ success: true, message: "..." }`.

**Step 5: Commit**

```bash
git add backend/src/middleware/validation.ts
git commit -m "fix: align rescheduleOrderSchema fields with controller (newDate+reason)"
```

---

## Task 2: Fix B1 — notification_url localhost inválida no MercadoPago

**Contexto:** O MercadoPago valida que `notification_url` seja uma URL pública acessível. Em desenvolvimento, `http://localhost:3001` é rejeitado com erro `code 4020`. A solução é tornar a URL configurável e, em sandbox/dev sem URL pública, omitir o campo.

**Files:**
- Modify: `backend/src/services/mercadopagoService.ts`
- Modify: `backend/.env.example`
- Modify: `backend/src/config/env.ts`

**Step 1: Adicionar `BACKEND_URL` ao env.ts**

Em `backend/src/config/env.ts`, dentro da interface `EnvConfig` e do objeto de validação, adicionar:

Encontrar (no final da interface):
```ts
  FRONTEND_URL: string;
```

Adicionar após:
```ts
  FRONTEND_URL: string;
  BACKEND_URL?: string;
```

Encontrar a validação (onde `FRONTEND_URL` é lida):
```ts
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",
```

Adicionar após:
```ts
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",
  BACKEND_URL: process.env.BACKEND_URL || undefined,
```

**Step 2: Criar helper `getWebhookUrl()` em `mercadopagoService.ts`**

No topo do arquivo, após os imports, adicionar:

```ts
/**
 * Retorna a notification_url para o MercadoPago.
 * MercadoPago rejeita localhost (code 4020).
 * Em dev sem BACKEND_URL configurado, omitimos o campo.
 */
function getNotificationUrl(): string | undefined {
  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl || backendUrl.includes("localhost")) {
    return undefined; // MP não aceita localhost — webhook será ignorado em dev local
  }
  return `${backendUrl}/api/services/payments/webhook`;
}
```

**Step 3: Substituir os 4 usos de `notification_url` no arquivo**

Há 4 ocorrências. Para cada função (`createPaymentPreference`, `createCardPayment`, `createPixPayment`, `createBoletoPayment`), localizar e substituir o bloco da notification_url.

Para `createPaymentPreference` (usa caminho diferente — também corrigir):
```ts
// ANTES:
notification_url: `${backendUrl}/api/payments/webhook`,
// DEPOIS:
...(getNotificationUrl() && { notification_url: getNotificationUrl() }),
```

Para as três funções de transparent checkout:
```ts
// ANTES:
notification_url: `${process.env.BACKEND_URL || `http://localhost:${env.PORT}`}/api/services/payments/webhook`,
// DEPOIS:
...(getNotificationUrl() && { notification_url: getNotificationUrl() }),
```

> **Nota:** O spread condicional `...(condition && { key: value })` adiciona a propriedade apenas se `condition` for truthy, omitindo-a completamente caso contrário.

**Step 4: Atualizar `.env.example`**

Adicionar no final do arquivo `backend/.env.example`:
```bash
# URL pública do backend (necessária para webhooks do MercadoPago)
# Em dev: usar ngrok ou similar. Ex: https://abc123.ngrok.io
# Em produção: URL real do servidor
BACKEND_URL=
```

**Step 5: Verificar tipos**

```bash
cd backend && npx tsc --noEmit 2>&1 | head -30
```

Esperado: sem erros.

**Step 6: Testar — Gerar PIX no frontend**

1. Iniciar backend: `cd backend && npm run dev`
2. Iniciar frontend: `cd frontend && npm run dev`
3. Logar como `cliente@teste.com` / `Teste@123`
4. Ir para um pedido com status PENDING
5. Entrar no checkout → Confirmar horário → Selecionar PIX → Preencher CPF → Clicar "Gerar PIX"

Esperado: QR code PIX aparece (sem erro 502 / "Erro de validação").
Log do backend: sem `ERROR: MercadoPago payment creation failed`.

**Step 7: Commit**

```bash
git add backend/src/services/mercadopagoService.ts \
        backend/src/config/env.ts \
        backend/.env.example
git commit -m "fix: omit notification_url when BACKEND_URL is localhost/unset (MP code 4020)"
```

---

## Task 3: Fix B3 + B4 — Analytics duplo /api/ prefix e type mismatches

**Files:**
- Modify: `frontend/src/pages/company/Analytics.tsx`
- Modify: `frontend/src/types/company.ts`

**Step 1: Corrigir prefixo duplo em Analytics.tsx**

Localizar as 3 chamadas com prefixo `/api/`:

```ts
// ANTES (linhas ~38-40):
api.get("/api/company/analytics/conversion-funnel"),
api.get("/api/company/analytics/team-occupancy"),
api.get("/api/company/analytics/nps"),

// DEPOIS:
api.get("/company/analytics/conversion-funnel"),
api.get("/company/analytics/team-occupancy"),
api.get("/company/analytics/nps"),
```

**Step 2: Corrigir type `NPSData` em `frontend/src/types/company.ts`**

Localizar:
```ts
export interface NPSData {
  score: number;
  // ...outros campos
}
```

Substituir (alinhando com o que o backend retorna `{ nps, promoters, passives, detractors, total }`):
```ts
export interface NPSData {
  nps: number;
  promoters: number;
  passives: number;
  detractors: number;
  total: number;
}
```

**Step 3: Corrigir type `TeamOccupancyEntry` em `frontend/src/types/company.ts`**

Localizar:
```ts
export interface TeamOccupancyEntry {
  userId: number;
  name: string;
  activeOrders: number;
}
```

Substituir (alinhando com o backend que retorna `{ memberId, memberName, profileImage, activeOrders, isActive }`):
```ts
export interface TeamOccupancyEntry {
  memberId: number;
  memberName: string;
  profileImage?: string | null;
  activeOrders: number;
  isActive: boolean;
}
```

**Step 4: Corrigir usos no Analytics.tsx**

Buscar no arquivo `Analytics.tsx` todos os usos de `nps.score` e `entry.name`:

```bash
grep -n "nps\.score\|entry\.name\|\.userId" frontend/src/pages/company/Analytics.tsx
```

Substituir `nps.score` por `nps.nps` (ou criar variável local):
```tsx
// ANTES:
{nps.score > 0 ? `+${nps.score}` : nps.score}
// DEPOIS:
{nps.nps > 0 ? `+${nps.nps}` : nps.nps}
```

Substituir `entry.name` por `entry.memberName` e `entry.userId` por `entry.memberId`:
```tsx
// ANTES:
<span>{entry.name}</span>
<div key={entry.userId}>

// DEPOIS:
<span>{entry.memberName}</span>
<div key={entry.memberId}>
```

**Step 5: Verificar tipos TypeScript no frontend**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -40
```

Esperado: erros de tipo relacionados a `score`/`name`/`userId` resolvidos.

**Step 6: Testar Analytics**

1. Logar como empresa no frontend
2. Navegar para `/company/analytics`
3. Verificar que todos os 7 cards carregam (sem "Erro ao carregar analytics")
4. Verificar card NPS mostra número (não `undefined`)
5. Verificar seção Team Occupancy mostra nomes dos membros

**Step 7: Commit**

```bash
git add frontend/src/pages/company/Analytics.tsx \
        frontend/src/types/company.ts
git commit -m "fix: remove duplicate /api/ prefix in analytics calls; align NPSData and TeamOccupancyEntry types"
```

---

## Task 4: Feature — Upload de Imagens de Serviço (Profissional)

**Contexto:** Atualmente profissionais só podem colar URLs de imagens. Vamos adicionar upload real de arquivos com validação de magic bytes (já usado no chat). Usaremos storage local em `backend/uploads/listings/` e serviremos via rota estática existente.

**Files:**
- Create: `backend/src/controllers/service/listingUploadController.ts`
- Modify: `backend/src/routes/serviceRoutes.ts`
- Modify: `backend/src/index.ts` (adicionar static serve para `/uploads/listings`)
- Modify: `frontend/src/pages/professional/CreateService.tsx`
- Modify: `frontend/src/pages/professional/EditService.tsx`
- Modify: `frontend/src/services/serviceService.ts`

### Sub-task 4a: Backend — Upload endpoint

**Step 1: Criar diretório de uploads para listings**

```bash
mkdir -p backend/uploads/listings
touch backend/uploads/listings/.gitkeep
```

**Step 2: Criar `listingUploadController.ts`**

Criar `backend/src/controllers/service/listingUploadController.ts`:

```ts
import path from "path";
import fs from "fs";
import multer from "multer";
import { Request, Response } from "express";
import { createLogger } from "../../lib/logger";

const log = createLogger("listingUpload");

// ─── Configuração de Storage ───────────────────────────────────────────────
const UPLOAD_DIR = path.join(process.cwd(), "uploads", "listings");
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB por imagem
const MAX_FILES = 8; // máximo de imagens por upload
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

// Garantir que o diretório existe
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `listing-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(new Error(`Tipo de arquivo não permitido: ${file.mimetype}`));
    return;
  }
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    cb(new Error(`Extensão não permitida: ${ext}`));
    return;
  }
  cb(null, true);
};

export const listingUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES,
  },
});

// ─── Controller ────────────────────────────────────────────────────────────
export async function uploadListingImages(req: Request, res: Response): Promise<void> {
  const files = req.files as Express.Multer.File[] | undefined;

  if (!files || files.length === 0) {
    res.status(400).json({ success: false, message: "Nenhum arquivo enviado" });
    return;
  }

  const uploadedUrls: string[] = [];
  const failedFiles: string[] = [];

  for (const file of files) {
    try {
      // Validação de magic bytes — previne upload de arquivos disfarçados
      const { fileTypeFromFile } = await import("file-type");
      const detected = await fileTypeFromFile(file.path).catch(() => null);

      if (!detected || !ALLOWED_MIME_TYPES.includes(detected.mime)) {
        log.warn(
          { filename: file.filename, declared: file.mimetype, detected: detected?.mime },
          "Magic byte mismatch — arquivo rejeitado"
        );
        fs.unlinkSync(file.path);
        failedFiles.push(file.originalname);
        continue;
      }

      // URL pública relativa
      const publicUrl = `/uploads/listings/${file.filename}`;
      uploadedUrls.push(publicUrl);
    } catch (err) {
      log.error({ err, filename: file.filename }, "Erro ao validar arquivo");
      try { fs.unlinkSync(file.path); } catch {}
      failedFiles.push(file.originalname);
    }
  }

  if (uploadedUrls.length === 0) {
    res.status(400).json({
      success: false,
      message: "Nenhum arquivo válido. Verifique se são imagens reais (JPEG, PNG, WebP, GIF).",
      failed: failedFiles,
    });
    return;
  }

  log.info({ count: uploadedUrls.length }, "Imagens de listing enviadas");

  res.status(201).json({
    success: true,
    message: `${uploadedUrls.length} imagem(ns) enviada(s)${failedFiles.length > 0 ? `, ${failedFiles.length} rejeitada(s)` : ""}`,
    data: { urls: uploadedUrls, failed: failedFiles },
  });
}
```

**Step 3: Registrar rota em `serviceRoutes.ts`**

Em `backend/src/routes/serviceRoutes.ts`, adicionar import e rota:

```ts
import { listingUpload, uploadListingImages } from "../controllers/service/listingUploadController";

// Adicionar ANTES das rotas com :id (para não conflitar):
router.post(
  "/listings/upload-images",
  verifyToken,
  requireRole("PROFESSIONAL"),
  listingUpload.array("images", 8),
  uploadListingImages
);
```

**Step 4: Servir arquivos estáticos de listings em `index.ts`**

Em `backend/src/index.ts`, localizar onde `/uploads/chat` é servido e adicionar logo após:

```ts
// Adicionar após o bloco de upload/chat estático:
app.use(
  "/uploads/listings",
  express.static(path.join(process.cwd(), "uploads", "listings"))
);
```

> Nota: `/uploads/listings` é público (sem auth) pois são imagens de vitrine visíveis a todos.

**Step 5: Verificar tipos**

```bash
cd backend && npx tsc --noEmit 2>&1 | head -30
```

Esperado: sem erros.

**Step 6: Commit parcial (backend)**

```bash
git add backend/src/controllers/service/listingUploadController.ts \
        backend/src/routes/serviceRoutes.ts \
        backend/src/index.ts \
        backend/uploads/listings/.gitkeep
git commit -m "feat: add service listing image upload endpoint with magic byte validation"
```

### Sub-task 4b: Frontend — UI de upload em CreateService e EditService

**Step 7: Adicionar função de upload em `serviceService.ts`**

Em `frontend/src/services/serviceService.ts`, adicionar:

```ts
/**
 * Faz upload de imagens para um listing.
 * Retorna array de URLs públicas.
 */
export async function uploadListingImages(files: File[]): Promise<string[]> {
  const formData = new FormData();
  files.forEach((file) => formData.append("images", file));

  const response = await api.post<{
    success: boolean;
    data: { urls: string[]; failed: string[] };
    message: string;
  }>("/services/listings/upload-images", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return response.data.data.urls;
}
```

**Step 8: Substituir textarea de URLs por componente de upload em `CreateService.tsx`**

Localizar a seção de imagens (cerca de linha 239):
```tsx
<div className="md:col-span-2">
  <label className="label">
    Imagens (uma URL por linha, opcional)
  </label>
  <textarea
    className="input min-h-28"
    value={imagesInput}
    onChange={(event) => setImagesInput(event.target.value)}
    placeholder={"https://.../imagem-1.jpg\nhttps://.../imagem-2.jpg"}
  />
</div>
```

Substituir por novo bloco (ver código completo abaixo). Antes disso, adicionar ao estado do componente:

```tsx
// Adicionar nos states existentes:
const [uploadingImages, setUploadingImages] = useState(false);
const [uploadedImages, setUploadedImages] = useState<string[]>([]); // URLs já enviadas
```

Adicionar handler de upload:
```tsx
const handleImageFiles = async (files: FileList | null) => {
  if (!files || files.length === 0) return;

  const fileArray = Array.from(files).filter((f) => f.type.startsWith("image/"));
  if (fileArray.length === 0) {
    addToast("Selecione apenas arquivos de imagem (JPEG, PNG, WebP, GIF)", "error");
    return;
  }
  if (uploadedImages.length + fileArray.length > 8) {
    addToast("Máximo de 8 imagens por serviço", "error");
    return;
  }

  setUploadingImages(true);
  try {
    const urls = await uploadListingImages(fileArray);
    setUploadedImages((prev) => [...prev, ...urls]);
    // Manter também imagesInput para URLs externas opcionais
    addToast(`${urls.length} imagem(ns) enviada(s) com sucesso`, "success");
  } catch (err) {
    addToast("Erro ao enviar imagens. Tente novamente.", "error");
  } finally {
    setUploadingImages(false);
  }
};
```

Ao construir `parsedImages` no submit, incluir também `uploadedImages`:
```tsx
// ANTES:
const parsedImages = imagesInput
  .split("\n")
  .map((item) => item.trim())
  .filter(Boolean);

// DEPOIS:
const urlImages = imagesInput
  .split("\n")
  .map((item) => item.trim())
  .filter(Boolean);
const parsedImages = [...uploadedImages, ...urlImages];
```

Substituir o bloco de imagens no JSX:
```tsx
<div className="md:col-span-2">
  <label className="label">Imagens do Serviço (máx. 8)</label>

  {/* Upload de arquivo */}
  <div
    className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
      ${uploadingImages
        ? "border-primary/40 bg-primary/5 cursor-wait"
        : "border-border hover:border-primary/60 hover:bg-primary/5"}`}
    onClick={() => !uploadingImages && document.getElementById("listing-image-input")?.click()}
    onDragOver={(e) => e.preventDefault()}
    onDrop={(e) => {
      e.preventDefault();
      handleImageFiles(e.dataTransfer.files);
    }}
  >
    <input
      id="listing-image-input"
      type="file"
      accept="image/jpeg,image/png,image/webp,image/gif"
      multiple
      className="hidden"
      onChange={(e) => handleImageFiles(e.target.files)}
      disabled={uploadingImages}
    />
    {uploadingImages ? (
      <p className="text-sm text-muted-foreground">Enviando imagens...</p>
    ) : (
      <>
        <p className="text-sm font-medium">Clique ou arraste imagens aqui</p>
        <p className="text-xs text-muted-foreground mt-1">JPEG, PNG, WebP, GIF — máx. 5MB cada</p>
      </>
    )}
  </div>

  {/* Preview das imagens enviadas */}
  {uploadedImages.length > 0 && (
    <div className="flex flex-wrap gap-2 mt-3">
      {uploadedImages.map((url, idx) => (
        <div key={idx} className="relative group">
          <img
            src={`http://localhost:3001${url}`}
            alt={`Imagem ${idx + 1}`}
            className="w-20 h-20 object-cover rounded-md border border-border"
          />
          <button
            type="button"
            onClick={() => setUploadedImages((prev) => prev.filter((_, i) => i !== idx))}
            className="absolute -top-1 -right-1 bg-destructive text-white rounded-full w-5 h-5
                       flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )}

  {/* URLs externas (opcional) */}
  <details className="mt-3">
    <summary className="text-xs text-muted-foreground cursor-pointer select-none">
      Ou adicionar URLs externas (opcional)
    </summary>
    <textarea
      className="input min-h-20 mt-2 text-sm"
      value={imagesInput}
      onChange={(event) => setImagesInput(event.target.value)}
      placeholder={"https://exemplo.com/imagem.jpg"}
    />
  </details>
</div>
```

**Step 9: Aplicar as mesmas mudanças em `EditService.tsx`**

O EditService tem estrutura similar. Adicionar os mesmos states, handler e JSX. Diferença: ao carregar o serviço existente, popular `uploadedImages` com as URLs que começam com `/uploads/listings/` e `imagesInput` com as URLs externas:

```tsx
// No useEffect que carrega o serviço:
const allImages: string[] = data.images || [];
const localImages = allImages.filter((u) => u.startsWith("/uploads/listings/"));
const externalImages = allImages.filter((u) => !u.startsWith("/uploads/listings/"));
setUploadedImages(localImages);
setImagesInput(externalImages.join("\n"));
```

**Step 10: Verificar tipos TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -40
```

Corrigir quaisquer erros de tipo.

**Step 11: Testar upload**

1. Logar como `profissional@teste.com`
2. Ir para "Criar Serviço"
3. Clicar na área de upload → selecionar imagem JPEG/PNG
4. Verificar que preview aparece
5. Clicar em "Criar Serviço" → verificar que a imagem aparece no listing

Testar segurança: renomear um arquivo `.txt` para `.jpg` e tentar enviar → deve ser rejeitado.

**Step 12: Commit**

```bash
git add frontend/src/services/serviceService.ts \
        frontend/src/pages/professional/CreateService.tsx \
        frontend/src/pages/professional/EditService.tsx
git commit -m "feat: add image file upload for service listings with drag-and-drop and magic byte validation"
```

---

## Task 5: Feature — Channel Member Management UI (Vitrine/Canais)

**Contexto:** O backend já tem os endpoints `POST /api/company/channels/:channelId/members` e `DELETE /api/company/channels/:channelId/members/:memberId`. Falta a UI no frontend.

**Files:**
- Modify: `frontend/src/pages/company/Channels.tsx`
- Modify: `frontend/src/services/companyService.ts` (ou equivalente)

**Step 1: Verificar se companyService tem funções de channel members**

```bash
grep -n "channel" frontend/src/services/companyService.ts | head -30
```

Se não existirem funções para gerenciar membros de canal, adicioná-las.

**Step 2: Adicionar funções de API em `companyService.ts`**

```ts
// Membros de canal
export async function getChannelMembers(channelId: number) {
  const res = await api.get(`/company/channels/${channelId}/members`);
  return res.data.data;
}

export async function addChannelMember(channelId: number, memberId: number) {
  const res = await api.post(`/company/channels/${channelId}/members`, { memberId });
  return res.data;
}

export async function removeChannelMember(channelId: number, memberId: number) {
  const res = await api.delete(`/company/channels/${channelId}/members/${memberId}`);
  return res.data;
}
```

**Step 3: Verificar endpoint GET members no backend**

```bash
grep -n "getChannelMembers\|GET.*channelId.*members" backend/src/controllers/companyChannelController.ts
grep -n "channelId.*members" backend/src/routes/companyChannelRoutes.ts
```

Se não existir endpoint GET, adicioná-lo ao controller:

```ts
// Em companyChannelController.ts:
export async function getChannelMembers(req: AuthRequest, res: Response) {
  const { channelId } = req.params;

  const members = await prisma.companyChannelMember.findMany({
    where: { channelId: Number(channelId) },
    include: {
      member: {
        include: {
          user: { select: { id: true, name: true, profileImage: true } },
          role: { select: { name: true } },
        },
      },
    },
  });

  return res.json({ success: true, data: members });
}
```

E registrar a rota:
```ts
// Em companyChannelRoutes.ts — ANTES das rotas com :channelId/:memberId:
router.get("/:channelId/members", verifyToken, requireCompanyAccess, getChannelMembers);
```

**Step 4: Adicionar modal de gerenciamento de membros em `Channels.tsx`**

O componente precisa:
1. Botão "Gerenciar Membros" em cada `ChannelCard`
2. Modal/drawer com lista de membros atuais do canal + botão de remover
3. Seletor para adicionar novos membros (busca nos membros da empresa)

Adicionar estados:
```tsx
const [managingChannel, setManagingChannel] = useState<Channel | null>(null);
const [channelMembers, setChannelMembers] = useState<ChannelMember[]>([]);
const [companyMembers, setCompanyMembers] = useState<CompanyMember[]>([]);
const [loadingMembers, setLoadingMembers] = useState(false);
const [addMemberId, setAddMemberId] = useState<string>("");
```

Adicionar handler de abertura:
```tsx
const handleOpenMemberManager = async (channel: Channel) => {
  setManagingChannel(channel);
  setLoadingMembers(true);
  try {
    const [channelMems, compMems] = await Promise.all([
      getChannelMembers(channel.id),
      getCompanyMembers(), // função existente que busca membros da empresa
    ]);
    setChannelMembers(channelMems);
    setCompanyMembers(compMems);
  } finally {
    setLoadingMembers(false);
  }
};
```

Adicionar handler de adicionar:
```tsx
const handleAddMember = async () => {
  if (!managingChannel || !addMemberId) return;
  try {
    await addChannelMember(managingChannel.id, Number(addMemberId));
    const updated = await getChannelMembers(managingChannel.id);
    setChannelMembers(updated);
    setAddMemberId("");
    addToast("Membro adicionado ao canal", "success");
  } catch (err: any) {
    addToast(err.response?.data?.message || "Erro ao adicionar membro", "error");
  }
};
```

Adicionar handler de remover:
```tsx
const handleRemoveMember = async (memberId: number) => {
  if (!managingChannel) return;
  try {
    await removeChannelMember(managingChannel.id, memberId);
    setChannelMembers((prev) => prev.filter((m) => m.id !== memberId));
    addToast("Membro removido do canal", "success");
  } catch (err: any) {
    addToast(err.response?.data?.message || "Erro ao remover membro", "error");
  }
};
```

Adicionar botão no `ChannelCard`:
```tsx
<button
  onClick={() => handleOpenMemberManager(channel)}
  className="btn btn-sm btn-outline"
>
  <Users className="w-4 h-4 mr-1" />
  Membros ({channel._count?.members ?? 0})
</button>
```

Adicionar modal:
```tsx
{managingChannel && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div className="card w-full max-w-lg max-h-[80vh] overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-lg">
          Membros — {managingChannel.name}
        </h3>
        <button onClick={() => setManagingChannel(null)} className="btn btn-ghost btn-sm">✕</button>
      </div>

      {/* Adicionar membro */}
      <div className="flex gap-2 mb-4">
        <select
          value={addMemberId}
          onChange={(e) => setAddMemberId(e.target.value)}
          className="input flex-1"
        >
          <option value="">Selecionar membro...</option>
          {companyMembers
            .filter((m) => !channelMembers.some((cm) => cm.memberId === m.id))
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.user.name} — {m.role?.name ?? "Sem cargo"}
              </option>
            ))}
        </select>
        <button
          onClick={handleAddMember}
          disabled={!addMemberId}
          className="btn btn-primary btn-sm"
        >
          Adicionar
        </button>
      </div>

      {/* Lista de membros atuais */}
      {loadingMembers ? (
        <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
      ) : channelMembers.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhum membro neste canal ainda.
        </p>
      ) : (
        <ul className="space-y-2">
          {channelMembers.map((cm) => (
            <li key={cm.id} className="flex justify-between items-center p-2 rounded-md bg-muted/40">
              <div className="flex items-center gap-2">
                {cm.member?.user?.profileImage ? (
                  <img
                    src={cm.member.user.profileImage}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium">
                    {cm.member?.user?.name?.[0] ?? "?"}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium">{cm.member?.user?.name}</p>
                  <p className="text-xs text-muted-foreground">{cm.member?.role?.name ?? "Sem cargo"}</p>
                </div>
              </div>
              <button
                onClick={() => handleRemoveMember(cm.id)}
                className="btn btn-ghost btn-sm text-destructive hover:text-destructive"
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  </div>
)}
```

**Step 5: Verificar tipos TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -40
```

Corrigir erros conforme aparecem (principalmente tipos de `ChannelMember`, `CompanyMember`).

**Step 6: Testar Channel Members**

1. Logar como empresa
2. Navegar para `/company/channels`
3. Clicar em "Membros" em um canal
4. Adicionar um membro da empresa ao canal
5. Verificar que aparece na lista
6. Remover o membro
7. Verificar que some da lista

**Step 7: Commit**

```bash
git add frontend/src/pages/company/Channels.tsx \
        frontend/src/services/companyService.ts \
        backend/src/controllers/companyChannelController.ts \
        backend/src/routes/companyChannelRoutes.ts
git commit -m "feat: add channel member management UI with add/remove capabilities"
```

---

## Task 6: Feature — Order Progress Steps (Checkout pre-payment)

**Contexto:** O `CheckoutStepper` atual tem apenas 3 steps: "Pedido Criado", "Horário", "Pagamento". O cliente quer mais granularidade: Pedido Solicitado → Aguardando Pagamento → Pagamento Realizado → Profissional Notificado → ...

Já existe um stepper pós-pagamento completo (`OrderProgressStepper` com 5 steps). O gap é no pré-pagamento. Vamos expandir o `CheckoutStepper` e garantir que o `OrderProgressStepper` inclua o step de "Profissional Notificado".

**Files:**
- Modify: `frontend/src/pages/orders/OrderDetails.tsx` (ou onde `CheckoutStepper` está definido)
- Possibly: `frontend/src/components/orders/CheckoutStepper.tsx` (se for componente separado)

**Step 1: Localizar onde CheckoutStepper é definido**

```bash
grep -rn "CheckoutStepper" frontend/src/
```

**Step 2: Expandir os steps do CheckoutStepper**

Localizar:
```tsx
const CHECKOUT_STEPS = [
  { label: "Pedido Criado", icon: <CheckCircle className="w-4 h-4" /> },
  { label: "Horario",       icon: <Calendar className="w-4 h-4" /> },
  { label: "Pagamento",     icon: <CreditCard className="w-4 h-4" /> },
];
```

Substituir por:
```tsx
const CHECKOUT_STEPS = [
  { label: "Pedido Solicitado",    icon: <CheckCircle className="w-4 h-4" /> },
  { label: "Agendar Horário",      icon: <Calendar className="w-4 h-4" /> },
  { label: "Aguardando Pagamento", icon: <CreditCard className="w-4 h-4" /> },
  { label: "Pagamento Realizado",  icon: <DollarSign className="w-4 h-4" /> },
];
```

Atualizar a lógica de `currentStep`:
```tsx
// ANTES:
<CheckoutStepper currentStep={order.scheduledDate ? 2 : 1} />

// DEPOIS:
<CheckoutStepper currentStep={
  order.payment?.status === "APPROVED" ? 3 :  // Pagamento realizado
  order.scheduledDate ? 2 :                    // Tem horário → aguardando pagamento
  1                                            // Sem horário → agendar
} />
```

**Step 3: Expandir OrderProgressStepper com "Profissional Notificado"**

Localizar o array de `steps` no `OrderProgressStepper`. Atualmente:
1. Serviço Iniciado (pagamento aprovado)
2. Aguardando Profissional
3. Serviço em Andamento
4. Aguardando Confirmação
5. Concluído

Substituir pelo array expandido:
```tsx
const steps = [
  {
    label: "Pagamento Aprovado",
    description: "Pagamento processado com sucesso",
    done: true,
  },
  {
    label: "Profissional Notificado",
    description: "Profissional recebeu a notificação do pedido",
    done: ["ACCEPTED", "IN_PROGRESS", "AWAITING_CLIENT_CONFIRMATION",
           "AWAITING_PROFESSIONAL_CONFIRMATION", "COMPLETED"].includes(order.status),
  },
  {
    label: "Profissional a Caminho",
    description: "Profissional confirmou e está se deslocando",
    done: ["IN_PROGRESS", "AWAITING_CLIENT_CONFIRMATION",
           "AWAITING_PROFESSIONAL_CONFIRMATION", "COMPLETED"].includes(order.status),
  },
  {
    label: "Serviço em Andamento",
    description: "Profissional está realizando o serviço",
    done: ["AWAITING_CLIENT_CONFIRMATION", "AWAITING_PROFESSIONAL_CONFIRMATION",
           "COMPLETED"].includes(order.status),
  },
  {
    label: "Aguardando Confirmação",
    description: order.status === "AWAITING_PROFESSIONAL_CONFIRMATION"
      ? "Aguardando confirmação do profissional"
      : order.status === "AWAITING_CLIENT_CONFIRMATION"
      ? "Aguardando sua confirmação de conclusão"
      : "Confirmação do serviço",
    done: ["AWAITING_PROFESSIONAL_CONFIRMATION", "COMPLETED"].includes(order.status),
  },
  {
    label: "Serviço Concluído",
    description: "Serviço finalizado com sucesso — pagamento liberado",
    done: order.status === "COMPLETED",
  },
];
```

**Step 4: Importar ícones necessários**

Verificar que `DollarSign` e outros ícones necessários estão importados de `lucide-react`.

**Step 5: Verificar tipos**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -40
```

**Step 6: Testar visualmente**

1. Logar como cliente
2. Ver um pedido nos diferentes status
3. Verificar que o stepper mostra o step correto para cada status

**Step 7: Commit**

```bash
git add frontend/src/pages/orders/OrderDetails.tsx
# ou se componentes separados:
# git add frontend/src/components/orders/CheckoutStepper.tsx
# git add frontend/src/components/orders/OrderProgressStepper.tsx
git commit -m "feat: expand order progress stepper with payment and professional notification steps"
```

---

## Task 7: Vitrine — Planejamento de Storefront Avançado (Design)

> **Nota:** Esta task é de planejamento/design apenas. A implementação completa da vitrine avançada (similar ao iFood) é um projeto maior que merece um plano separado. Aqui documentamos o que já existe e o que falta para orientar o próximo plano.

**O que já existe (funcional):**

| Componente | Status |
|-----------|--------|
| `CompanyStorefrontSection` (seções de serviços) | ✅ Backend completo |
| `CompanyStorefrontBlock` (HERO, ABOUT, TESTIMONIALS) | ✅ Backend completo |
| `CompanyStorefront.tsx` (página pública) | ✅ Renderiza tudo |
| `StorefrontEditor.tsx` (editor admin) | ⚠️ Parcial (só `headline`, sem imagem hero, cores, corpo about) |
| Channel member management | ❌ Frontend faltando (Task 5) |

**O que falta para a vitrine completa (iFood-style):**

1. **Editor completo de blocos**: Campos `heroImageUrl`, `subText`, `bgColor` para HERO; `body` para ABOUT; `pinnedTestimonials` para TESTIMONIALS
2. **Drag-and-drop para reordenar seções**: O campo `order` existe mas não há UI de reordenação
3. **Adicionar/remover listings de seções**: Interface para escolher quais serviços aparecem em cada seção da vitrine
4. **Preview ao vivo**: Mostrar como a vitrine ficará durante a edição
5. **Upload de imagem hero e logo**: Usar a infraestrutura de upload criada na Task 4
6. **Vitrine de profissional individual**: Atualmente só existe para empresas — profissionais freelancers também podem ter sua "lojinha"

**Ação imediata (incluir neste plano):** Corrigir o `StorefrontEditor.tsx` para salvar campos completos dos blocos.

**Files:**
- Modify: `frontend/src/pages/company/StorefrontEditor.tsx`

**Step 1: Expandir formulário do bloco HERO**

No editor, localizar onde o bloco HERO é editado. Adicionar campos:
- `subText` (texto secundário)
- `heroImageUrl` (URL da imagem — pode usar upload ou URL externa)
- `bgColor` (seletor de cor ou input hex)

**Step 2: Expandir formulário do bloco ABOUT**

Adicionar campo `body` (textarea para texto completo da empresa).

**Step 3: Salvar campos completos no `upsertBlock`**

Verificar que o service call inclui todos os campos no `content` JSON.

**Step 4: Verificar tipos e testar**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -40
```

Testar editando um bloco HERO com imagem URL e verificar que aparece na vitrine pública.

**Step 5: Commit**

```bash
git add frontend/src/pages/company/StorefrontEditor.tsx
git commit -m "feat: expand storefront block editor with full HERO/ABOUT field support"
```

---

## Ordem de Execução Recomendada

```
Task 1 (reschedule fix)    → imediato, sem dependências, alto impacto
Task 2 (MP notification)   → imediato, desbloqueia PIX/pagamento
Task 3 (analytics fix)     → imediato, 3 linhas de mudança
Task 4 (image upload)      → backend + frontend, ~2h
Task 5 (channel members)   → frontend + pequeno backend, ~1h
Task 6 (order steps)       → frontend only, ~45min
Task 7 (vitrine editor)    → frontend, ~1h
```

**Commits esperados:** 8-10 commits atômicos e rastreáveis.

---

## Verificação Final

Após todas as tasks:

```bash
# Backend
cd backend && npx tsc --noEmit && npm test

# Frontend
cd frontend && npx tsc --noEmit && npm run lint

# Smoke test manual:
# 1. Criar pedido → agendar → gerar PIX → sem erro 502
# 2. Profissional cria serviço com imagem → imagem aparece no listing
# 3. Analytics empresa → todos os 7 cards carregam
# 4. Canal → adicionar/remover membro funciona
# 5. OrderDetails → stepper mostra steps corretos
```
