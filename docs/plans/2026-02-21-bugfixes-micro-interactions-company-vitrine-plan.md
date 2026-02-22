# Bugfixes, Micro-interações & Vitrine de Empresa — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix CSS micro-interaction bugs, resolve 3 functional bugs (accept order, edit profile, salary toggle), remove "Perfil da Empresa" from dashboard, make member invite role-optional, add seed members, replace company storefront blocks with service-based vitrine with team assignment, and perform full visual audit.

**Architecture:** CSS normalization at the global layer removes conflicting focus rules. Bug fixes are surgical changes in specific files. Company vitrine replaces the block-based editor with a hierarchical service manager (categories > services > options) based on the professional's StorefrontManager, with TeamBuilder integration per category.

**Tech Stack:** React 19, TypeScript, TailwindCSS 4 (CSS-first), Express 5, Prisma 7, SQLite

---

### Task 1: Fix global CSS focus rules in index.css

**Files:**
- Modify: `frontend/src/index.css:220-234`

**Step 1: Update the global focus rule**

Replace lines 220-234 in `frontend/src/index.css`:

```css
/* BEFORE (remove this): */
input:focus,
textarea:focus,
select:focus {
  @apply outline-none ring-2 ring-primary-500 ring-offset-2;
}
/* ... dark mode variant too */

/* AFTER (replace with): */
input:focus,
textarea:focus,
select:focus {
  @apply outline-none;
}
```

Also remove the dark mode variant (lines 230-234):
```css
/* REMOVE: */
html.dark input:focus,
html.dark textarea:focus,
html.dark select:focus {
  @apply ring-offset-slate-950;
}
```

**Step 2: Add global spin button removal**

Add after the focus rules:
```css
/* Remove number input spin buttons globally */
input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
input[type="number"] {
  -moz-appearance: textfield;
}
```

**Step 3: Update .input class to have consistent focus style**

Ensure the `.input` class in `@layer components` has:
```css
.input {
  @apply w-full px-4 py-2 border border-slate-300 rounded-lg
    focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30
    transition-colors duration-200;
}

html.dark .input {
  @apply border-slate-700 bg-slate-900 text-slate-100
    focus:border-primary-400 focus:ring-primary-400/30;
}
```

**Step 4: Verify build compiles**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: No errors

**Step 5: Commit**

```bash
git add frontend/src/index.css
git commit -m "fix: normalize CSS focus rules, remove spin buttons globally"
```

---

### Task 2: Fix "Editar perfil" button not working in Profile.tsx

**Files:**
- Modify: `frontend/src/pages/Profile.tsx:317-328`

**Step 1: Add pointer-events-none to SVG overlay and z-10 to button**

In `Profile.tsx`, find the banner div (~line 317). The SVG pattern overlay needs `pointer-events-none`:

```tsx
{/* Change this line (the SVG pattern overlay): */}
<div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,...')] opacity-30 pointer-events-none" />
```

Add `pointer-events-none` to the className of the SVG pattern div.

And add `z-10` to the edit button:

```tsx
<button
  onClick={() => setIsEditing(true)}
  className="absolute top-4 right-4 z-10 btn btn-sm bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm flex items-center gap-2"
>
```

**Step 2: Verify build compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/pages/Profile.tsx
git commit -m "fix: profile edit button blocked by SVG overlay — add pointer-events-none and z-10"
```

---

### Task 3: Fix accept order "Cannot convert undefined or null to object" error

**Files:**
- Modify: `frontend/src/services/serviceService.ts:290-296`

**Step 1: Add null guard to acceptOrder**

```ts
export const acceptOrder = async (id: number): Promise<ServiceOrder> => {
  const response = await api.post<ApiResponse<any>>(
    `/services/orders/${id}/accept`,
  );
  const payload = extractData(response) ?? {};
  return payload.serviceOrder || payload;
};
```

**Step 2: Also add null guard to other order functions that may have same issue**

Apply same pattern to `startOrder`, `submitOrderCompletion`, `completeOrder`, `confirmOrderCompletion`, `confirmProfessionalCompletion`, `cancelOrder`:

Each one should use `extractData(response) ?? {}` instead of `extractData(response)`.

**Step 3: Add defensive check in normalizePage**

```ts
const normalizePage = <T>(raw: RawPagePayload<T>): NormalizedPage<T> => {
  if (!raw) {
    return { items: [], total: 0, page: 1, limit: 10, totalPages: 0 };
  }
  // ... rest of function unchanged
```

**Step 4: Verify build compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add frontend/src/services/serviceService.ts
git commit -m "fix: null guard in extractData calls to prevent 'Cannot convert undefined' error"
```

---

### Task 4: Fix salary rule toggle — PATCH vs PUT mismatch

**Files:**
- Modify: `backend/src/routes/companySalaryRoutes.ts:13`

**Step 1: Add PATCH route**

After line 13 (`router.put(...)`) add:

```ts
router.patch("/rules/:ruleId", requireCompanyPermission("finance.salary"), updateSalaryRule);
```

**Step 2: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add backend/src/routes/companySalaryRoutes.ts
git commit -m "fix: add PATCH handler for salary rules (frontend sends PATCH, was returning 404)"
```

---

### Task 5: Remove "Perfil da Empresa" from company Dashboard quick links

**Files:**
- Modify: `frontend/src/pages/company/Dashboard.tsx:104`

**Step 1: Remove the quick link**

Remove this entry from the `quickLinks` array:

```ts
{ to: "/company/profile", icon: <Building2 className="h-5 w-5" />, label: "Perfil da Empresa", desc: "Editar informações" },
```

**Step 2: Verify build compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors. Check if `Building2` icon is still used elsewhere in the file — if not, remove from imports.

**Step 3: Commit**

```bash
git add frontend/src/pages/company/Dashboard.tsx
git commit -m "feat: remove 'Perfil da Empresa' from company dashboard quick links"
```

---

### Task 6: Make member invite roleId optional

**Files:**
- Modify: `backend/src/controllers/companyMemberController.ts:72-92`
- Modify: `frontend/src/pages/company/Members.tsx` (invite modal)

**Step 1: Fix backend — make roleId optional in inviteMember**

In `companyMemberController.ts`, update the `inviteMember` function:

```ts
export async function inviteMember(req: AuthRequest, res: Response) {
  try {
    const { email, roleId } = req.body;
    const targetUser = await prisma.user.findUnique({ where: { email } });
    if (!targetUser) return res.status(404).json({ success: false, message: "Usuário não encontrado com esse email" });

    const existing = await prisma.companyMember.findFirst({
      where: { userId: targetUser.id, companyId: req.companyId! },
    });
    if (existing) return res.status(400).json({ success: false, message: "Usuário já é membro desta empresa" });

    const member = await prisma.companyMember.create({
      data: {
        companyId: req.companyId!,
        userId: targetUser.id,
        roleId: roleId ? Number(roleId) : undefined,
      },
      include: { user: { select: { id: true, name: true, email: true, profileImage: true } }, role: true },
    });
    return res.status(201).json({ success: true, message: "Membro adicionado", data: member });
  } catch (err) {
    log.error({ err }, "inviteMember error");
    throw err;
  }
}
```

Key change: `roleId: roleId ? Number(roleId) : undefined` instead of `roleId: Number(roleId)`.

**Step 2: Fix frontend — make role select optional in Members.tsx invite modal**

Find the invite modal's role `<select>` and remove `required`. Update label to "Cargo (opcional)".

**Step 3: Verify both compile**

Run: `cd backend && npx tsc --noEmit` and `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add backend/src/controllers/companyMemberController.ts frontend/src/pages/company/Members.tsx
git commit -m "feat: make role optional when inviting company members"
```

---

### Task 7: Add seed members for empresa@teste.com

**Files:**
- Modify: `backend/prisma/seed.ts`

**Step 1: Add 2 new test users and link as company members**

After the existing company seed block (after line ~1097), add:

```ts
// Create test members for the company
const membro1 = await prisma.user.upsert({
  where: { email: "membro1@teste.com" },
  update: {},
  create: {
    email: "membro1@teste.com",
    name: "Membro Um",
    password: await bcrypt.hash("Teste@123", 10),
    role: "PROFESSIONAL",
    status: "ACTIVE",
    isVerified: true,
    emailVerified: true,
  },
});

const membro2 = await prisma.user.upsert({
  where: { email: "membro2@teste.com" },
  update: {},
  create: {
    email: "membro2@teste.com",
    name: "Membro Dois",
    password: await bcrypt.hash("Teste@123", 10),
    role: "PROFESSIONAL",
    status: "ACTIVE",
    isVerified: true,
    emailVerified: true,
  },
});

if (empresaProfile) {
  // Get default role
  const defaultRole = await prisma.companyRole.findFirst({
    where: { companyId: empresaProfile.id },
  });

  // Member 1 with role
  await prisma.companyMember.upsert({
    where: { userId: membro1.id },
    update: {},
    create: {
      companyId: empresaProfile.id,
      userId: membro1.id,
      roleId: defaultRole?.id,
    },
  });

  // Member 2 without role
  await prisma.companyMember.upsert({
    where: { userId: membro2.id },
    update: {},
    create: {
      companyId: empresaProfile.id,
      userId: membro2.id,
    },
  });

  console.log(`  - Membro 1: ${membro1.email} (com cargo)`);
  console.log(`  - Membro 2: ${membro2.email} (sem cargo)`);
}
```

**Step 2: Run seed to verify**

Run: `cd backend && npm run db:seed`
Expected: No errors, members created

**Step 3: Commit**

```bash
git add backend/prisma/seed.ts
git commit -m "feat: add test members (membro1@teste.com, membro2@teste.com) linked to company"
```

---

### Task 8: Salary Rules UI — replace number inputs with CurrencyInput and select

**Files:**
- Modify: `frontend/src/pages/company/Salary.tsx:198-224`

**Step 1: Import CurrencyInput**

Add at top of `Salary.tsx`:
```ts
import CurrencyInput from "../../components/common/CurrencyInput";
```

**Step 2: Replace amount input with CurrencyInput**

Replace the `<input type="number">` for "Valor (R$)" (~line 201-211):

```tsx
<div>
  <label className="label">Valor (R$)</label>
  <CurrencyInput
    value={ruleForm.amount ? Number(ruleForm.amount) * 100 : 0}
    onChange={(cents) => setRuleForm((p) => ({ ...p, amount: String(cents / 100) }))}
    disabled={ruleLoading}
    min={1}
    placeholder="0,00"
  />
</div>
```

Note: Check `CurrencyInput` props to confirm if it uses cents or reais as value. Adjust accordingly.

**Step 3: Replace day-of-month input with select**

Replace the `<input type="number">` for "Dia do Mês" (~line 214-223):

```tsx
<div>
  <label className="label">Dia do Mês</label>
  <select
    value={ruleForm.dayOfMonth}
    onChange={(e) => setRuleForm((p) => ({ ...p, dayOfMonth: e.target.value }))}
    className="input"
    disabled={ruleLoading}
  >
    {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
      <option key={day} value={String(day)}>
        {day}
      </option>
    ))}
  </select>
</div>
```

**Step 4: Also fix transfer modal amount input if it has same issue**

Check the transfer modal's amount input (~line 93-118) and apply same CurrencyInput pattern.

**Step 5: Verify build compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add frontend/src/pages/company/Salary.tsx
git commit -m "fix: replace number inputs in salary rules with CurrencyInput and select, remove spin buttons"
```

---

### Task 9: Replace company StorefrontEditor with service-based CompanyStorefrontManager

**Files:**
- Create: `frontend/src/pages/company/CompanyStorefrontManager.tsx`
- Modify: `frontend/src/App.tsx` (update import for route)
- Modify: `frontend/src/services/companyStorefrontService.ts` (add service methods if needed)
- Possibly modify: `backend/src/routes/companyStorefrontRoutes.ts`
- Possibly modify: `backend/prisma/schema.prisma` (add team member relation to sections)

**Step 1: Analyze existing StorefrontManager.tsx structure**

The professional `StorefrontManager.tsx` has:
- Categories (CRUD + reorder)
- Services per category (CRUD)
- Options/add-ons per service (CRUD)
- Uses `storefrontService.ts` API methods
- Uses `CurrencyInput` for prices
- Inline modals for creation/editing

**Step 2: Create CompanyStorefrontManager.tsx**

Base it on `StorefrontManager.tsx` but:
- Use `companyStorefrontService` API instead of `storefrontService`
- Replace "sections" (current company model) concept with categories > services flow
- Add TeamBuilder integration per section/category for assigning members
- Import `TeamBuilder` from `../../components/company/TeamBuilder`
- The company storefront sections already exist in the database (`CompanyStorefrontSection`, `CompanyStorefrontItem`)
- Map: Section = Category, Items = Services within that category

**Step 3: Add team member assignment to sections**

Each `CompanyStorefrontSection` needs a way to associate team members. Options:
- Add a `teamMemberIds` JSON field to `CompanyStorefrontSection` (quickest)
- Or create a join table (more proper but more complex)

Use JSON field approach for now — add `teamMembers` as optional JSON field to schema:

In `schema.prisma`, update `CompanyStorefrontSection`:
```prisma
model CompanyStorefrontSection {
  // ... existing fields
  teamMembers Json?  // Array of member IDs assigned to this section/category
}
```

Run: `cd backend && npx prisma db push`

**Step 4: Update companyStorefrontService.ts**

Add methods for managing team members per section:
```ts
updateSectionTeam: async (sectionId: number, memberIds: number[]) => {
  const res = await api.patch(`/company/storefront/sections/${sectionId}`, { teamMembers: memberIds });
  return res.data;
},
```

**Step 5: Build the CompanyStorefrontManager component**

This is the largest component. Structure:
1. Header with title + "Publicar" toggle
2. List of sections/categories (each expandable)
3. Within each section: list of items (services) linked from `ServiceListing`
4. TeamBuilder per section showing assigned members
5. Add/edit/remove modals matching StorefrontManager style

**Step 6: Update App.tsx route**

Change the import for `/company/storefront-editor` from `StorefrontEditor` to `CompanyStorefrontManager`.

**Step 7: Verify build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: No errors

**Step 8: Commit**

```bash
git add frontend/src/pages/company/CompanyStorefrontManager.tsx frontend/src/App.tsx frontend/src/services/companyStorefrontService.ts backend/prisma/schema.prisma
git commit -m "feat: replace company storefront blocks with service-based vitrine with team assignment"
```

---

### Task 10: Full visual audit of interactive components

**Files:**
- Potentially modify: multiple component files across `frontend/src/components/` and `frontend/src/pages/`

**Step 1: Launch app and visually audit**

Start the dev servers:
```bash
cd backend && npm run dev &
cd frontend && npm run dev
```

Navigate through key pages checking:
- [ ] Wallet → Solicitar Saque (CurrencyInput focus)
- [ ] Professional → Vitrine → Edit service price
- [ ] Company → Salary → Valor / Dia do Mês inputs
- [ ] Profile → Editar perfil button
- [ ] Company → Members → Invite modal
- [ ] Login/Register forms
- [ ] Order details page
- [ ] Chat message input
- [ ] Service search filters
- [ ] Checkout form
- [ ] All modals (backdrop, focus trap)
- [ ] Checkboxes and toggles (StorefrontEditor checkboxes, notification settings)
- [ ] Select dropdowns
- [ ] Tabs component

**Step 2: Fix any remaining inconsistencies**

Common patterns to fix:
- Inline inputs not using `.input` class → add `.input` or matching focus styles
- Checkboxes with `accent-blue-600` → standardize to `accent-primary-600`
- Toggles without transition → add `transition-colors duration-200`
- Focus rings that are too thick or have wrong color

**Step 3: Verify build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: No errors

**Step 4: Commit**

```bash
git add -A
git commit -m "fix: visual audit — standardize focus styles, checkboxes, toggles, and interactive elements"
```
