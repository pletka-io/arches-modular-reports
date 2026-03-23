# Hide Empty Fields Toggle Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a user-toggleable checkbox in the report toolbar to hide sections with no data. Setting persists per-graph in localStorage.

**Architecture:** Use Vue provide/inject pattern. ModularReport manages state, provides to children. Toolbar has checkbox. DataSection checks before rendering.

**Tech Stack:** Vue 3, TypeScript, PrimeVue, localStorage

---

## Task 1: Add hideEmptyFields state to ModularReport.vue

**Files:**
- Modify: `arches_modular_reports/src/arches_modular_reports/ModularReport/ModularReport.vue`

**Step 1: Add state and provide**

Add these imports and code after the existing provide blocks (around line 100):

```typescript
import { watch } from "vue";

const LOCALSTORAGE_KEY_PREFIX = "arches_modular_reports_hide_empty_";

function getStorageKey(graphSlug: string): string {
    return `${LOCALSTORAGE_KEY_PREFIX}${graphSlug}`;
}

function loadHideEmptyFromStorage(): boolean {
    const stored = localStorage.getItem(getStorageKey(graphSlug));
    if (stored !== null) {
        return stored === "true";
    }
    return false;
}

const hideEmptyFields = ref(loadHideEmptyFromStorage());

watch(hideEmptyFields, (newValue) => {
    localStorage.setItem(getStorageKey(graphSlug), String(newValue));
});

provide("hideEmptyFields", { hideEmptyFields });
```

**Step 2: Verify file compiles**

Run: `npm run ts:check`
Expected: No errors

---

## Task 2: Add toggle checkbox to ReportToolbar

**Files:**
- Modify: `arches_modular_reports/src/arches_modular_reports/ModularReport/components/ReportToolbar.vue`

**Step 1: Add imports**

Add after existing imports (line 3):

```typescript
import Checkbox from "primevue/checkbox";
import type { Ref } from "vue";
```

**Step 2: Add inject and state**

Add after line 9 ($gettext):

```typescript
const hideEmptyFields = inject("hideEmptyFields") as {
    hideEmptyFields: Ref<boolean>;
};
```

**Step 3: Add checkbox in template**

Add after the export-links div closes (before `</template>`):

```html
<div class="hide-empty-toggle">
    <Checkbox
        v-model="hideEmptyFields.hideEmptyFields"
        input-id="hide-empty-fields"
        :binary="true"
    />
    <label
        for="hide-empty-fields"
        class="hide-empty-label"
    >
        {{ $gettext("Hide empty fields") }}
    </label>
</div>
```

**Step 4: Add styling**

Add after line 99 (before `</style>`):

```css
.hide-empty-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 10px;
}

.hide-empty-label {
    color: var(--p-text-color);
    cursor: pointer;
}
```

**Step 5: Verify file compiles**

Run: `npm run ts:check`
Expected: No errors

---

## Task 3: Filter empty sections in DataSection

**Files:**
- Modify: `arches_modular_reports/src/arches_modular_reports/ModularReport/components/DataSection.vue`

**Step 1: Add inject**

Add after line 86 (after nodePresentationLookup inject):

```typescript
const hideEmptyFields = inject("hideEmptyFields") as {
    hideEmptyFields: Ref<boolean>;
};
```

**Step 2: Modify template condition**

In the template around line 280, change the first condition:

From:
```html
<div
    v-else-if="isEmpty"
    class="section-table"
```

To:
```html
<div
    v-else-if="isEmpty && !hideEmptyFields?.hideEmptyFields"
    class="section-table"
```

Also update the `v-else` condition on line 299 from:
```html
<DataTable
    v-else
```

To:
```html
<DataTable
    v-else-if="!isEmpty || (isEmpty && !hideEmptyFields?.hideEmptyFields)"
```

Actually, let me reconsider. The simpler approach is to add a computed that combines the checks. Let me revise:

**Step 2 (revised): Add computed**

Add after line 120 (after isEmpty computed):

```typescript
const shouldShowEmptyState = computed(() => {
    if (hideEmptyFields?.hideEmptyFields.value && isEmpty.value) {
        return false;
    }
    return true;
});
```

**Step 3 (revised): Update template conditions**

Line 280: change `v-else-if="isEmpty"` to `v-else-if="isEmpty && shouldShowEmptyState"`
Line 299: change `v-else` to `v-else-if="!isEmpty || shouldShowEmptyState"`

**Step 4: Verify file compiles**

Run: `npm run ts:check`
Expected: No errors

---

## Task 4: Handle RelatedResourcesSection

**Files:**
- Modify: `arches_modular_reports/src/arches_modular_reports/ModularReport/components/RelatedResourcesSection.vue`

**Step 1: Check current implementation**

This component may already have an isEmpty state. Look for similar pattern.

**Step 2: Add inject and filter if needed**

Add inject similar to Task 3, apply same logic to hide when empty + toggle enabled.

---

## Task 5: Run build and tests

**Step 1: Run full build**

Run: `npm run build_development`
Expected: Build completes without errors

**Step 2: Run tests**

Run: `npm run vitest`
Expected: All tests pass

---

## Verification Steps (Manual)

1. Open a resource report with empty sections
2. Verify checkbox appears in toolbar
3. Toggle checkbox - empty sections should disappear
4. Refresh page - setting should persist
5. Open different resource type - default should be off
6. Toggle on, refresh - should persist per resource type