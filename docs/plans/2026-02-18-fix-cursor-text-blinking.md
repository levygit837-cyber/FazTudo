# Fix: Cursor Piscando ao Clicar em Texto (Tailwind v4 Breaking Change)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remover o cursor de texto piscante (I-beam / `cursor: text`) e restaurar `cursor: pointer` em botões do admin panel, ambos causados por breaking changes no Tailwind v4 preflight.

**Architecture:** O problema é um **browser default behavior** exposto pelo Tailwind v4. O preflight do v3 incluía `cursor: default` no html e `cursor: pointer` em botões — o v4 removeu ambos. A solução é restaurar essas regras explicitamente no `@layer base` de cada workspace. O `frontend/src/index.css` **já tem ambas as regras corrigidas**. O `admin/src/index.css` tem apenas `html { cursor: default; }` mas está **faltando o `button { cursor: pointer; }`**.

**Tech Stack:** CSS puro, Tailwind v4 CSS-first (`@layer base`). Apenas `admin/src/index.css` precisa de correção.

---

## Estado Atual (Investigação Completa)

### Frontend (`frontend/src/index.css`) — ✅ COMPLETO
Ambas as correções já estão aplicadas (commits `b12d1a1`, `c4c6195`, `ee325a4`):
```css
html { cursor: default; }                    /* ✅ Presente nas linhas 131-133 */
button, [role="button"], ... { cursor: pointer; } /* ✅ Presente nas linhas 137-144 */
```

### Admin (`admin/src/index.css`) — ⚠️ PARCIALMENTE CORRIGIDO
```css
html { cursor: default; }                    /* ✅ Presente (linha 91) */
button, [role="button"], ... { cursor: pointer; } /* ❌ AUSENTE — a corrigir */
```

---

## Causa Raiz

```
npm upgrade → tailwindcss 3.3.5 → 4.1.18

v3 preflight (unlayered):
  html { cursor: default; }              ← REMOVIDO no v4
  button { cursor: pointer; }            ← REMOVIDO no v4

v4 preflight (@layer base):
  (sem nenhuma regra de cursor)          ← browser UA stylesheet domina

Resultado:
  - texto: cursor:auto → browser resolve para I-beam (cursor:text)
  - botões: cursor:auto → browser pode mostrar seta ou I-beam dependendo do OS
```

---

## Task 1: Adicionar `cursor: pointer` nos Botões do Admin

**Files:**
- Modify: `admin/src/index.css`

**Contexto:** A regra `html { cursor: default; }` já existe no admin (linha 91). Precisamos adicionar logo após ela a regra de `cursor: pointer` para elementos interativos, espelhando exatamente o que o `frontend/src/index.css` já tem (linhas 135–144).

**Step 1: Localizar o ponto de inserção**

Abrir `admin/src/index.css`. Encontrar o bloco `@layer base {` e dentro dele a regra existente:

```css
  /* Tailwind v4 breaking change: o preflight v4 não define cursor padrão no body/html.
     O browser usa cursor:auto que resolve para cursor:text em elementos com texto.
     Esta regra restaura cursor:default (seta) como comportamento base. */
  html {
    @apply scroll-smooth;
    cursor: default;
  }
```

**Step 2: Inserir regra de `cursor: pointer` após o bloco `html {}`**

Logo após o bloco `html { ... cursor: default; }`, antes do próximo bloco `body {`, adicionar:

```css
  /* Tailwind v4 removeu cursor:pointer de <button> no preflight (breaking change vs v3).
     Esta regra restaura o comportamento esperado globalmente. */
  button,
  [role="button"],
  [type="button"],
  [type="reset"],
  [type="submit"],
  ::file-selector-button {
    cursor: pointer;
  }
```

O trecho final do `@layer base` deve ficar assim:

```css
@layer base {
  * {
    @apply border-slate-200;
  }

  html.dark * {
    @apply border-slate-800/50;
  }

  /* Tailwind v4 breaking change: o preflight v4 não define cursor padrão no body/html.
     O browser usa cursor:auto que resolve para cursor:text em elementos com texto.
     Esta regra restaura cursor:default (seta) como comportamento base. */
  html {
    @apply scroll-smooth;
    cursor: default;
  }

  /* Tailwind v4 removeu cursor:pointer de <button> no preflight (breaking change vs v3).
     Esta regra restaura o comportamento esperado globalmente. */
  button,
  [role="button"],
  [type="button"],
  [type="reset"],
  [type="submit"],
  ::file-selector-button {
    cursor: pointer;
  }

  body {
    @apply bg-slate-50 text-slate-900 antialiased font-sans;
    line-height: 1.5;
  }
  /* ... resto do arquivo permanece igual ... */
```

**Step 3: Verificar que não quebra cursors existentes**

A regra `cursor: default` no `html` é o fallback. Qualquer elemento com `cursor: pointer`, `cursor-not-allowed`, etc. sobrescreve normalmente via cascade (sem `!important` necessário).

Confirmar que esses padrões continuam funcionando:
- `.cursor-not-allowed` (no `.btn` via `disabled:cursor-not-allowed`) → ✅ sobrescreve
- Links `<a>` → normalmente herdam `cursor: pointer` do UA stylesheet para `<a href>` → ✅ ok
- `cursor: pointer` em `.btn` via `@layer components` → ✅ sobrescreve

**Step 4: Rodar o dev server do admin para teste visual**

```bash
cd /home/levybonito/faztudo-main/admin && npm run dev
```

Abrir `http://localhost:5174` (ou porta do admin) e verificar:
- [ ] Hover sobre texto comum (`<p>`, `<h1>`, `<div>`) mostra cursor de **seta** (não I-beam)
- [ ] Hover sobre botões (`.btn`, `<button>`) mostra cursor de **mão** (pointer)
- [ ] Hover sobre inputs/textareas mostra **I-beam** (correto — esses SÃO editáveis)
- [ ] Hover sobre links mostra **pointer**
- [ ] Elementos com `cursor-not-allowed` (botões desabilitados) mostram cursor correto

**Step 5: Verificar que o frontend continua funcionando**

```bash
cd /home/levybonito/faztudo-main/frontend && npm run dev
```

Abrir `http://localhost:5173` e repetir os mesmos testes visuais acima.

**Step 6: Commit**

```bash
git add admin/src/index.css
git commit -m "fix: restore cursor:pointer on buttons in admin after Tailwind v4 preflight change"
```

---

## Checklist de Validação Final

Após o commit:

### Frontend (`http://localhost:5173`)
- [ ] Hover em `<p>`, `<h1>`, `<span>`, `<div>` com texto → seta (default)
- [ ] Hover em `<button>`, `[role="button"]` → mão (pointer)
- [ ] Hover em `<input>`, `<textarea>` → I-beam (correto)
- [ ] Hover em `<a href>` → mão (pointer)
- [ ] Botão desabilitado (`disabled`) → `cursor: not-allowed`

### Admin (`http://localhost:5174` ou outra porta)
- [ ] Mesmos critérios acima
- [ ] Especialmente: botões do dashboard admin mostram pointer

### Verificação TypeScript (ambos workspaces — mudança só é CSS, deve passar)
```bash
cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit
cd /home/levybonito/faztudo-main/admin && npx tsc --noEmit
```

---

## Notas Técnicas

### Por que `html { cursor: default }` e não `body` ou `*`?

- **`html`**: O cursor é herdado. Definir em `html` garante cobertura máxima. Filhos herdam via cascade, e utilidades como `.cursor-pointer` sobrescrevem normalmente.
- **Não `body`**: `html` cobre casos extremos como conteúdo fora do body.
- **Não `* { cursor: default }`**: O seletor `*` teria precedência igual às utilidades Tailwind, quebrando `.cursor-pointer` sem precisar de `!important`.

### Por que a regra de `button` é necessária mesmo com `html { cursor: default }`?

O `cursor: default` no `html` faz todos os filhos herdarem o cursor de seta. Mas botões precisam de `cursor: pointer` (mão) para indicar interatividade — e isso precisa ser explicitado porque `cursor: pointer` não é o padrão do UA stylesheet para `<button>` em todos os browsers quando o preflight do Tailwind não o define.
