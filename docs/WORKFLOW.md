# WORKFLOW MANDATORIO PARA EL AGENTE

Para CADA ítem de la lista de tareas, debes ejecutar estrictamente este pipeline de 8 pasos antes de marcarlo como completado:

1. **Sync & Branch**: Never develop directly on `main`. Always update `main` first (`git checkout main && git pull origin main`), then create a dedicated feature branch (`git checkout -b feat/<nombre-funcionalidad>`).
2. **Plan & Document**: Create a folder `docs/<nombre-funcionalidad>/` and draft a design `.md` file detailing architecture, data flows, components, and testing strategy.
3. **Multi-Angle Plan Review**: Conduct an initial design review focusing on architecture, security, performance, and test strategy. Update the plan with necessary adjustments.
4. **Development & Testing**: Implement the feature code and write unit/integration/E2E tests to maintain or increase project coverage.
5. **PR Preparation**: Stage and commit all changes to the feature branch (`feat/<nombre-funcionalidad>`).
6. **Deep AI Review**: Run a deep code analysis over the feature diff to identify and fix security vulnerabilities, performance bottlenecks, or code smells.
7. **Safe Merge to `main`**: Verify that the PR fulfills ALL original requirements and edge cases defined in the task. Ensure all verification test suites pass at 100%. Switch back to `main`, sync latest changes, and perform the merge (`git checkout main && git pull origin main && git merge feat/<nombre-funcionalidad>`). **Explicitly verify the merge was successful (no conflicts) and that the `main` branch build remains stable.**
8. **Cleanup & Completion**: Delete the local feature branch (`git branch -d feat/<nombre-funcionalidad>`), compact context if necessary, and call `complete_goal`. The detached auditor will verify the `Done when:` contract directly on the clean `main` branch.