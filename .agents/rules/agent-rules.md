# Antigravity Agent Development Rules for SpendSleuth

These rules govern all automated and AI agent interactions within the SpendSleuth repository. Agents operating in this codebase MUST strictly adhere to the following principles:

## 1. Respect GitHub Issues as the Unit of Work
- Every development task must be tied to a specific GitHub Issue.
- Implement ONLY what is specified in the active issue scope.
- Do not proactively implement future roadmap items or unrequested features.

## 2. Scoped Changes & No Unrelated Modifications
- Keep changes strictly focused on the target issue and affected components.
- Do not make arbitrary modifications, formatting changes, or refactorings to unrelated files.
- Preserve existing working code unless the issue explicitly calls for its refactoring or removal.
- Do not modify untracked or scratch files unless instructed.

## 3. Review Existing Code Before Replacing It
- Always inspect and understand existing files, dependencies, and patterns before proposing or making changes.
- Do not assume existing code is incorrect without reviewing its context and requirements.
- Build on top of established conventions within the codebase.

## 4. Tests for Behavior Changes
- Every new feature, bug fix, or parser/categorization rule change MUST include corresponding unit or integration tests.
- When modifying extraction or parsing logic, verify against real or synthetic fixtures to prevent regressions.
- Ensure automated tests pass before considering an issue complete.

## 5. No Secrets Committed
- NEVER commit API keys, OAuth client secrets, refresh tokens, passwords, private keys, or `.env` files into version control.
- Always use environment variables for sensitive configuration and ensure secrets are listed in `.gitignore`.
- Encrypt sensitive data (such as OAuth tokens) before writing to persistent storage.

## 6. No Unnecessary Dependencies
- Keep the dependency footprint lean and minimal.
- Prefer Node.js built-ins or standard libraries where appropriate.
- Do not install new packages without explicit rationale and alignment with the current issue.

## 7. Explain Significant Architectural Decisions
- Document and explain non-obvious design choices, data model definitions, trade-offs, and failure recovery mechanisms.
- Maintain interview explainability and strong software engineering fundamentals across all design decisions.
