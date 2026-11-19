# Pawhaven

- Use the Node version in `package.json` and the setup commands in `README.md`. Check the files needed for the current task.
- Keep the existing React and TypeScript client, CSS Modules, Fastify API, and shared Zod contracts.
- For UI changes, reuse `src/components/` and semantic variables in `src/styles/tokens.css`. Use Inter for interface text, Lora for headings, and existing assets in `src/assets/figma/`. Use the `pawhaven-design-delivery` skill for Figma-led changes and visual QA.
- When a task is tracked in Notion, record work in the existing Pawhaven Tasks board. Set In Progress when starting. Move to Done after verifying the acceptance criteria and linking the GitHub change. Record blockers on the task.
- Keep changes reviewable on a branch. Merge or deploy when the user explicitly requests it.

## Model routing

When the user's prompt authorizes delegation and your Codex session supports model-specific subagents, handle routine implementation, tests, and task updates in the main session. Delegate one focused assignment to GPT-6.2 Astra for difficult debugging, architecture decisions, or a visual review that needs deeper judgment. Use a lightweight subagent for a bounded read-only scan only when it saves meaningful work. Give each subagent only the context it needs. If the requested model or delegation is unavailable, continue in the selected model and report the fallback.
