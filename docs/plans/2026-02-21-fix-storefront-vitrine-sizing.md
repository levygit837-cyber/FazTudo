# Fix Storefront Vitrine Sizing on Service Selection

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the bug where clicking a service item inside a storefront vitrine causes the entire vitrine/grid section to visually resize — the vitrine cards should have independent heights, not stretch to match their siblings.

**Architecture:** The root cause is CSS Grid's default `align-items: stretch` behavior in `CategorySection`, which forces all cards in the same row to share the tallest card's height. When a `ServiceItem` expands (showing options/quantity), its sibling card stretches too, making the whole vitrine appear to "grow." Two fixes: (1) add `items-start` to the grid so cards size independently, and (2) animate the expansion for polished UX instead of an abrupt height change.

**Tech Stack:** React 19, TailwindCSS v4 (CSS-first), TypeScript

---

### Task 1: Fix grid alignment so sibling cards don't stretch

**Files:**
- Modify: `frontend/src/pages/services/StorefrontViewPage.tsx:235`

**Step 1: Add `items-start` to the CategorySection grid**

In `StorefrontViewPage.tsx`, find the `CategorySection` component's grid div (line 235):

```tsx
// BEFORE (line 235):
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">

// AFTER:
<div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
```

This single class (`items-start` = `align-items: start`) makes each grid cell take only its own intrinsic height. An expanding card will no longer force its row-sibling to stretch.

**Step 2: Verify in browser**

Run: `cd frontend && npm run dev`

1. Open `http://localhost:5173/explorar`
2. Navigate to any storefront that has 2+ services in the same category
3. Click a service to expand it
4. Confirm the **sibling card does NOT grow taller** — only the clicked card expands
5. Confirm cards still align properly in the 2-column grid on `md+` screens
6. Confirm single-column layout on mobile is unaffected

**Step 3: Commit**

```bash
git add frontend/src/pages/services/StorefrontViewPage.tsx
git commit -m "fix: prevent vitrine grid row from stretching sibling cards on expand"
```

---

### Task 2: Animate service item expansion for smooth UX

**Files:**
- Modify: `frontend/src/pages/services/StorefrontViewPage.tsx:82-198` (ServiceItem component)

**Step 1: Replace conditional render with animated expansion**

In the `ServiceItem` component, replace the `{expanded && (...)}` block (lines 115-196) with an always-rendered wrapper that uses `max-height` + `opacity` transitions via Tailwind:

```tsx
// BEFORE (lines 115-196):
      {expanded && (
        <div className="px-5 md:px-6 pb-5 md:pb-6 border-t border-slate-100 dark:border-slate-700/50 pt-4 space-y-4">
          {/* ... all the options/qty/actions content ... */}
        </div>
      )}

// AFTER:
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          expanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-5 md:px-6 pb-5 md:pb-6 border-t border-slate-100 dark:border-slate-700/50 pt-4 space-y-4">
          {/* ... all the options/qty/actions content remain EXACTLY as they are ... */}
        </div>
      </div>
```

The full replacement for lines 115-196 should be:

```tsx
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          expanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-5 md:px-6 pb-5 md:pb-6 border-t border-slate-100 dark:border-slate-700/50 pt-4 space-y-4">
          {/* Options */}
          {hasOptions && (
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Opcionais:
              </p>
              <div className="space-y-2">
                {service.options.map((opt) => {
                  const isSelected = selectedOptions.some(
                    (o) => o.id === opt.id,
                  );
                  return (
                    <button
                      key={opt.id}
                      onClick={() => toggleOption(opt)}
                      className={`w-full text-left px-4 py-3 rounded-lg text-sm border transition-colors flex items-center justify-between ${
                        isSelected
                          ? "border-primary-400 bg-primary-50 dark:bg-primary-900/20 dark:border-primary-600"
                          : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                      }`}
                    >
                      <span className={isSelected ? "text-primary-700 dark:text-primary-300 font-medium" : "text-slate-700 dark:text-slate-300"}>
                        {opt.name}
                      </span>
                      {opt.price != null && (
                        <span className={`text-sm font-medium ${isSelected ? "text-primary-600 dark:text-primary-400" : "text-slate-400 dark:text-slate-500"}`}>
                          +{formatCurrency(opt.price)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity + Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-10 h-10 rounded-lg border border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-10 text-center font-semibold text-lg text-slate-900 dark:text-slate-100">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-10 h-10 rounded-lg border border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAskQuestion(service);
                }}
                className="btn btn-outline flex items-center gap-2 px-4 py-2.5"
              >
                <MessageCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Tirar duvida</span>
                <span className="sm:hidden">Duvida</span>
              </button>

              <button
                onClick={handleAdd}
                className="btn btn-primary flex items-center gap-2 px-5 py-2.5"
              >
                <ShoppingCart className="w-4 h-4" />
                Adicionar {formatCurrency(calcPrice() * quantity)}
              </button>
            </div>
          </div>
        </div>
      </div>
```

**Step 2: Verify in browser**

1. Open `http://localhost:5173/explorar`
2. Navigate to any storefront
3. Click a service → confirm it **smoothly animates open** (300ms slide+fade)
4. Click again → confirm it **smoothly animates closed**
5. Click "Adicionar" → confirm after adding to cart, the card collapses smoothly
6. Verify on mobile (single column) — expansion should be smooth too
7. Verify dark mode — transitions should work the same

**Step 3: Commit**

```bash
git add frontend/src/pages/services/StorefrontViewPage.tsx
git commit -m "feat: animate service item expand/collapse in storefront vitrine"
```

---

### Task 3: Final verification — full regression check

**Step 1: Run type checking**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 2: Run lint**

Run: `cd frontend && npm run lint`
Expected: No errors

**Step 3: Full browser test checklist**

1. Navigate to `/explorar`
2. Open a storefront with multiple categories and services
3. **Grid fix**: Expand a service in a 2-column row → sibling stays same height ✓
4. **Animation**: Expansion/collapse is smooth (300ms) ✓
5. **Options**: Select/deselect options → price updates correctly ✓
6. **Quantity**: Increase/decrease quantity → price updates correctly ✓
7. **Add to cart**: Click "Adicionar" → toast appears, card collapses, cart bar updates ✓
8. **Mobile**: Resize to mobile → single column, expansion works ✓
9. **Dark mode**: Toggle dark mode → all transitions work ✓
10. **Multiple expands**: Expand service A, then service B → both expand independently ✓

**Step 4: Final commit (if any adjustments were needed)**

```bash
git add frontend/src/pages/services/StorefrontViewPage.tsx
git commit -m "fix: final adjustments to vitrine sizing fix"
```

---

## Summary of Changes

| File | Change | Lines Affected |
|------|--------|----------------|
| `frontend/src/pages/services/StorefrontViewPage.tsx` | Add `items-start` to CategorySection grid | Line 235 |
| `frontend/src/pages/services/StorefrontViewPage.tsx` | Replace conditional render with animated expand/collapse wrapper | Lines 115-196 |

**Total changes:** 1 file, ~5 lines modified (1 class addition + 3 wrapper lines + 1 conditional removed)

**Risk:** Very low — changes are purely CSS/presentation. No logic, state, or API changes.
