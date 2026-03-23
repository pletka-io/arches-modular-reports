# Design: Hide Empty Fields Toggle

## Overview

Add a user-toggleable checkbox in the modular report toolbar to hide sections (cards/nodegroups) that contain no data. The setting persists per-report in localStorage.

## Requirements

- Toggle checkbox in report toolbar
- Hide sections with no data when enabled
- User preference only (localStorage, not database)
- Match existing codebase patterns (provide/inject)

## UI/UX

### Placement
- Toggle added to `ReportToolbar.vue`
- Label: "Hide empty fields" (translated via gettext)
- Default: Read from localStorage, fallback to `HIDE_EMPTY_NODES_IN_REPORT` Django setting (fetched via API)

### Persistence
- localStorage key: `arches_modular_reports_hide_empty_{graphSlug}`
- Value: `true` or `false`
- When toggled: update localStorage and trigger reactivity

## Architecture

### Provide/Inject Flow

```
ModularReport.vue
  ├── Provide: hideEmptyFields (Ref<boolean>)
  │   └── Created from localStorage or default
  │
  ├── ReportToolbar.vue
  │   └── Injects: hideEmptyFields
  │   └── Emits: update:hideEmptyFields on toggle
  │
  └── LinkedSections.vue
      └── Injects: hideEmptyFields
      └── Passes to children via props
          └── DataSection.vue
              └── Injects: hideEmptyFields
              └── Checks on render, returns null if empty + hidden
```

### Implementation Locations

| File | Change |
|------|--------|
| `ModularReport.vue` | Add `hideEmptyFields` state + provide |
| `ReportToolbar.vue` | Add checkbox toggle |
| `LinkedSections.vue` | Pass through or inject directly |
| `DataSection.vue` | Check and return null when empty + hidden |

## Component Behavior

### DataSection.vue
- Already has `isEmpty` computed (line 114)
- When `isEmpty && hideEmptyFields.value`: return empty template instead of "No data found"
- This prevents section from rendering at all when hidden

### Edge Cases
- **Related Resources tab**: Apply same logic to `RelatedResourcesSection.vue`
- **Child tiles in expansion**: Already has `showEmptyNodes` prop (hardcoded true) - could also be controlled
- **Permission denied sections**: Still show if permission exists but no data

## Data Flow

1. On mount, `ModularReport.vue` reads localStorage key for current graph
2. Provide `hideEmptyFields` to children
3. Toolbar toggle emits update, ModularReport updates state
4. localStorage updated on each toggle
5. Child components react via injected Ref

## Translation Keys

- `Hide empty fields` - checkbox label
- When state changes, sections re-render automatically (Vue reactivity)

## Testing Considerations

- Unit test: DataSection hides when enabled and empty
- Unit test: localStorage read/write
- Manual: Toggle persists after page refresh
- Manual: Toggle differs per resource type (graph)

## Alternative Considered

- **Database-backed**: Considered but rejected - user preference only, simpler
- **Pre-fetch all data**: Rejected - unnecessary complexity for async data
- **Full section pre-check**: Rejected - DataSection already knows if empty

## Success Criteria

1. Checkbox appears in toolbar
2. Toggle hides sections with no data
3. Setting persists in localStorage per graph
4.lowing and re-enabling shows hidden sections again
5. No breaking changes to existing functionality