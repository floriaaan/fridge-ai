# AGENTS.md

## Command execution policy

Be cost-conscious when executing commands.

* **Do not automatically run tests, builds, lint, typechecks, E2E tests, benchmarks, coverage, or other expensive commands.**
* **Only execute costly commands when the user explicitly requests them or when they are genuinely necessary to diagnose a specific reported issue.**
* When execution is necessary, prefer the **smallest and most targeted command** possible.
* **Writing and modifying tests is allowed and encouraged** when appropriate. This policy only restricts their execution.
* Prefer lightweight validation such as inspecting code, reviewing diffs, searching files, and checking configuration.
* Do not run expensive commands merely to "verify" work or out of habit.
* Do not repeat an expensive command when its previous result is still valid.
* Do not install dependencies, rebuild Docker images, restart services, run migrations, or perform other costly operations unless necessary or explicitly requested.
* Never perform destructive operations just for validation.

### Default

**Write the code and tests. Inspect the changes. Stop.**

**Do not execute expensive commands unless explicitly asked or genuinely required to diagnose an issue.**

### Validation

Do not run expensive validation commands automatically.

Tests, builds, lint, typechecks, E2E, benchmarks, coverage and similar commands:
- may be written/modified but must not be executed unless explicitly requested or genuinely required for diagnosis;
- must not be repeatedly rerun in a fix → test → fix loop;
- when execution is necessary, run the smallest targeted command possible.
