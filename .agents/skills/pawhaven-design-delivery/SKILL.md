---
name: pawhaven-design-delivery
description: Use for implementing an approved Pawhaven Figma frame, updating Pawhaven UI components or tokens, or comparing the rendered website with its design.
---

1. Start with the relevant Notion task and exact Figma frame. If only the file is known, find the frame from the task description. The source file key is recorded in `src/styles/tokens.css`. Open only the frame and variants needed for the change.
2. Use the connected Figma design-to-code workflow for node details and its screenshot. Check the affected screen in `src/features/`, shared components in `src/components/`, semantic CSS variables in `src/styles/tokens.css`, and existing exports in `src/assets/figma/`. Follow confirmed component mappings where available.
3. Implement with React, TypeScript, and CSS Modules. Reuse the existing component and token conventions. Apply approved token changes centrally. Preserve existing routing, API contracts, and interactions outside the task.
4. Compare the browser preview with Figma at the provided frame widths. Verify the changed layout, typography, colors, and relevant states with representative data. Check keyboard navigation and narrow layouts where applicable. Run the relevant lint, typecheck, and tests from `package.json`. Record which checks ran and any blockers.
5. Link the matching Figma frame and GitHub PR from the Notion card. Record verification on the card. Move work to Done when it meets the task's acceptance criteria.
