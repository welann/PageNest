# Repository Agent Instructions

## Module Documentation Requirement

- Treat documentation as part of the definition of done for every module.
- When a module is completed, add a dedicated `README.md` inside that module's own directory.
- If the module lives under `src/modules/<slug>`, the detailed document should be created at `src/modules/<slug>/README.md`.
- The module-level `README.md` must clearly describe:
  - the module's purpose and user-facing functionality
  - the directory structure and the responsibility of key files
  - important data flow, dependencies, and integration points when relevant
  - setup, usage, or maintenance notes when the module needs them
- After adding or updating a module-level `README.md`, also update the root `README.md`.
- The root `README.md` must include a brief introduction for the module and a Markdown link to the module's detailed `README.md`.
- Do not consider module work complete until both the module-level documentation and the root `README.md` entry have been updated.
