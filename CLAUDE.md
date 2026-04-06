# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Arches Modular Reports is an Arches Application (Django plugin) that provides configurable, modular resource reports for the Arches heritage data platform. It replaces the default Knockout.js-based report system with a Vue 3 + PrimeVue frontend driven by JSON configuration stored in the database.

## Build & Development Commands

```bash
# Python setup (editable install with dev deps)
pip install -e . --group dev
pre-commit install

# Frontend
npm install
npm run build_development    # lint + typecheck + webpack dev build
npm run build_production     # lint + typecheck + webpack prod build
npm run start                # webpack dev server

# Linting & type checking
npm run eslint:check         # ESLint on **/src
npm run eslint:fix:all       # ESLint fix on **/src
npm run prettier:check       # Prettier check
npm run prettier:fix:all     # Prettier fix
npm run ts:check             # vue-tsc --noEmit

# Frontend tests
npm run vitest               # vitest --run --coverage (jsdom env)

# Python tests (requires Django/Arches DB setup)
python manage.py test tests/

# Management commands
python manage.py report_configs load [-s source_dir] [-g graph_slug]
python manage.py report_configs write [-d dest_dir] [-g graph_slug]
python manage.py report_configs generate [-g graph_slug] [--overwrite]
```

## Architecture

### Backend (Django)

- **`arches_modular_reports/models.py`** — `ReportConfig` model: stores JSON report configuration per graph+slug, with validation and auto-generation of default configs from graph structure. The `generate_config()` method produces the initial JSON config with all graph nodegroups and related resource sections.
- **`arches_modular_reports/app/views/modular_report.py`** — API views serving report config, node presentation data, nodegroup tile data (paginated), related resources, and permissions. `ModularReportAwareResourceReportView` dispatches between modular and legacy report templates.
- **`arches_modular_reports/app/utils/nodegroup_tile_data_utils.py`** — Heavy query logic: Django ORM annotations that transform raw tile data into display-ready values with concept labels, resource instance names, and links.
- **`arches_modular_reports/config_generator_registry.py`** — Plugin point: external Arches Applications register custom config factory functions by slug, used by the `report_configs generate` management command.
- **`arches_modular_reports/app/utils/update_report_configuration_for_nodegroup_permissions.py`** — Strips sections from the config JSON that the current user lacks nodegroup read permission for.

### Frontend (Vue 3 + TypeScript)

Source lives in `arches_modular_reports/src/arches_modular_reports/`.

- **`ModularReport/ModularReport.vue`** — Root component. Fetches config, node presentation, permissions, and language settings in parallel. Manages editor panel visibility and provides context via Vue `provide`/`inject`.
- **`ModularReport/api.ts`** — API client functions for all backend endpoints.
- **`ModularReport/types.ts`** — TypeScript interfaces for config structure, node presentation, tile data, etc.
- **`ModularReport/utils.ts`** — Dynamic component import via `defineAsyncComponent` driven by the JSON config's `component` paths.
- **`ModularReport/components/`** — Report section components, each corresponding to a JSON config entry:
  - `ReportHeader.vue` — Dynamic descriptor with node value interpolation (`<node_alias>` syntax)
  - `ReportToolbar.vue` — Export buttons, list tools, hide-empty-fields toggle
  - `ReportTombstone.vue` — Key metadata summary
  - `ReportTabs.vue` — Tab container
  - `LinkedSections.vue` — Groups of DataSection/RelatedResourcesSection
  - `DataSection.vue` — Renders nodegroup tile data in paginated tables
  - `RelatedResourcesSection.vue` — Related resources with pagination
  - `ResourceEditor/` — Inline editing panel using arches-component-lab widgets

### Config-Driven Rendering

The report layout is entirely defined by a JSON config stored in `ReportConfig.config`. The frontend dynamically imports Vue components by path string from the config. Components receive their `config` object as a prop. This means adding a new section type requires: (1) creating a Vue component, (2) adding it to the JSON config.

### Arches Version Compatibility

The codebase supports both Arches 7.6.x and 8.0.x. Version-specific behavior is gated by `arches_version >= Version("8.0")` checks throughout the Python code (e.g., `source_identifier` filtering, `grouping_node` vs `node_set` lookup).

### Key Dependencies

- **arches** (7.6.19–8.2.0) — Core platform
- **arches-component-lab** — Shared Vue widgets and API types
- **arches-querysets** — Queryset-based API (URLs included via `arches_querysets.urls`)
- **PrimeVue** — UI component library (via arches-dev-dependencies)
- **es-toolkit** — Utility functions
- **numeral** — Number formatting

### Webpack

Build config is in `webpack/`. Uses `webpack-metadata.json` (generated at build time in `frontend_configuration/`) for path resolution across Arches applications.
