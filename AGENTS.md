# Repository Guidelines

日本語で応答すること

## Project Structure & Module Organization
Core runtime lives in `main.ts`, exported for CLI entry and reuse. Companion tests are co-located as `main_test.ts`. Extended references live under `docs/`: align feature work with `docs/spec.md` (Japanese architecture + product brief), `docs/api/openapi-deno.yaml` (REST contract), and `docs/design/today.html` (Today screen mock). Update the appropriate doc whenever you change API shapes, UI flows, or domain rules to keep design and implementation synchronized.

## Build, Test, and Development Commands
- `deno run main.ts`: single-run sanity check for the current implementation.
- `deno task dev`: watches `main.ts` per `deno.json` and hot-reloads on save.
- `deno test`: executes the suite; add `--watch` while iterating locally.
- `deno fmt` / `deno lint`: enforce formatting and static analysis before committing.
- `firebase emulators:start`: boots the Auth/Firestore/Functions stack described in `docs/spec.md` when you integrate with the broader platform.

## Coding Style & Naming Conventions
Rely on the default Deno formatter (2-space indent, semicolons). Use camelCase for variables and functions, PascalCase for types, and hyphenated lowercase filenames like `routine-service.ts` for new modules. Group exports by feature boundaries that mirror the resource categories in `docs/api/openapi-deno.yaml`. Keep comments brief and only where control flow or Firestore access patterns are non-obvious.

## Testing Guidelines
Write focused `Deno.test` blocks with behavior-driven names (e.g., `restoresSoftDeletedRoutine`). Place tests next to their targets with the `_test.ts` suffix. Exercise lifecycle paths from the OpenAPI spec (create, soft-delete, restore) and validation rules described in `docs/spec.md`. Target thorough coverage of new logic using `deno test --coverage=coverage` followed by `deno coverage coverage`. Stub Firestore and external services via Deno mocks rather than custom globals.

## Commit & Pull Request Guidelines
Follow Conventional Commit prefixes (`feat:`, `fix:`, `docs:`, `chore:`). Each commit should bundle code, tests, and doc updates tied to a single change. Pull requests must summarize intent, cite the relevant sections of `docs/spec.md` or `docs/api/openapi-deno.yaml`, and paste the command output for `deno fmt`, `deno lint`, and `deno test`. Include emulator or UI screenshots whenever changes affect flows outlined in `docs/design/today.html`.

## Architecture & Security Notes
`docs/spec.md` documents the Firebase and Cloud Run topology, required emulator ports, and data-retention rules (seven-day soft delete). Keep environment secrets in Secret Manager or local `.env` files ignored by git; never commit credentials. When introducing new endpoints or fields, update `docs/api/openapi-deno.yaml` and confirm the design aligns with the Today screen UX. Mirror any task or configuration additions in `deno.json` so teammates inherit the same setup.
