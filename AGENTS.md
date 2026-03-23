# AGENTS.md - Developer Guide for arches-modular-reports

This file provides coding guidelines and commands for agents working in this repository.

## Project Overview

Arches Modular Reports is a Django + Vue.js application that provides fast, configurable reports for Arches heritage data management. It includes Python backend (Django) and TypeScript/Vue frontend components.

---

## Build, Lint, and Test Commands

### Python Tests

```bash
# Run all Python tests
pytest

# Run a single test file
pytest tests/test_settings.py

# Run a specific test
pytest tests/test_settings.py::test_single_test_name -v
```

### Frontend Build

```bash
# Development build (includes lint + type check)
npm run build_development

# Production build
npm run build_production

# Test build
npm run build_test
```

### Frontend Linting

```bash
# Check ESLint (TypeScript/Vue)
npm run eslint:check

# Fix ESLint issues
npm run eslint:fix
npm run eslint:fix:all

# Watch mode for ESLint
npm run eslint:watch
```

### Frontend Formatting

```bash
# Check Prettier formatting
npm run prettier:check

# Fix Prettier issues
npm run prettier:fix
npm run prettier:fix:all
```

### TypeScript

```bash
# Type check
npm run ts:check

# Watch mode for type checking
npm run ts:watch
```

### Frontend Tests

```bash
# Run Vitest tests with coverage
npm run vitest

# Run a single Vitest test file
npx vitest run tests/example.test.ts
```

### Pre-commit Hooks

```bash
# Install pre-commit hooks
pre-commit install

# Run all pre-commit checks
pre-commit run --all-files
```

---

## Code Style Guidelines

### General

- This is an Arches application - follow Arches project conventions
- Python 3.10+ required
- TypeScript with strict mode enabled
- Vue 3 with Composition API

### Python (Backend)

**Formatting:**
- Use **Black** for code formatting (line length 88)
- 4-space indentation
- Single quotes for strings unless escaping required

**Imports:**
- Standard library first, then third-party, then local
- Use explicit relative imports within the package
- Sort with `isort` (integrated via Black)

**Type Hints:**
- Use type hints for all function signatures
- Use `typing` module for complex types
- Example: `def fetch_report(resource_id: str) -> dict[str, Any]:`

**Naming:**
- `snake_case` for functions, variables, modules
- `PascalCase` for classes
- Constants: `UPPER_SNAKE_CASE`

**Error Handling:**
- Use custom exceptions for domain-specific errors
- Catch specific exceptions, not bare `Exception`
- Log errors appropriately (see settings.py LOGGING config)

**Django Specific:**
- Use Django's built-in views and serializers
- Follow Django REST Framework patterns
- Settings in `settings.py` extend Arches settings

### TypeScript/Vue (Frontend)

**Formatting:**
- Use **Prettier** (4-space indentation, singleAttributePerLine)
- ESM imports (no CommonJS)

**Imports:**
- Use path aliases: `@/` for app source, `@/arches` for Arches core
- Example: `import type { ResourceData } from "@/arches_modular_reports/ModularReport/types.ts";`
- Group imports: external, then Arches, then local

**TypeScript:**
- Strict mode enabled in tsconfig.json
- Use explicit types for function parameters and return types
- Use `interface` for object shapes, `type` for unions/aliases
- Use `import type` for type-only imports

**Vue Components:**
- Use Composition API with `<script setup>`
- Define props with typed defineProps
- Use TypeScript in template expressions

**Naming:**
- `camelCase` for functions, variables
- `PascalCase` for components, interfaces, types
- `kebab-case` for filenames (components: `MyComponent.vue`)
- Prefix interfaces with purpose: `ResourceData`, `NodeValueDisplayData`

**Error Handling:**
- Always check `response.ok` after fetch calls
- Throw descriptive errors: `throw new Error(parsed.message || response.statusText)`
- Handle async errors with try/catch in async functions

---

## File Organization

```
arches_modular_reports/
├── app/                    # Django app views and utils
│   ├── utils/
│   └── views/
├── migrations/             # Django migrations
├── src/                    # Vue/TypeScript source
│   └── arches_modular_reports/
│       └── ModularReport/
│           ├── components/ # Vue components
│           ├── utils.ts   # Helper functions
│           ├── api.ts     # API calls
│           └── types.ts   # TypeScript types
├── management/commands/    # Django management commands
├── templates/               # Django templates
└── settings.py             # Django settings
```

---

## Testing Guidelines

### Python Tests

- Tests in `tests/` directory
- Use pytest fixtures for common setup
- Follow naming: `test_<module>_<feature>.py`

### Frontend Tests

- Vitest for unit tests
- jsdom environment for DOM testing
- Test files alongside source: `utils.ts` → `utils.test.ts`

---

## Git Workflow

- Use conventional commit messages (optional)
- Run linting before committing: `npm run eslint:check && npm run prettier:check`
- Run tests before pushing
- Pre-commit hooks handle formatting automatically

---

## Key Dependencies

- **Django**: Web framework
- **Vue 3**: Frontend framework
- **TypeScript**: Type-safe JavaScript
- **ESLint + Prettier**: Code quality
- **Black**: Python formatting
- **Vitest**: Frontend testing
- **pytest**: Python testing

---

## Notes for Agents

- This is an Arches application - many imports come from `@/arches` (Arches core)
- Path aliases are configured in tsconfig.json
- Webpack handles bundling (see `webpack/` directory)
- Settings extend Arches settings - check parent project for defaults
- The project uses Vue gettext for internationalization
