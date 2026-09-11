# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Output style: i-have-adhd (required)

Every agent working in this repo — Claude, Codex, Gemini/agy, Qwen, Kimi, OpenCode, any other — must shape every response by the rules in [`.agents/skills/i-have-adhd/SKILL.md`](.agents/skills/i-have-adhd/SKILL.md) (Claude Code also finds it at `.claude/skills/i-have-adhd`).

- Read that file at the start of every session and apply it to every reply, including the final report of delegated work.
- It is on by default here. Do not wait for `/i-have-adhd` to be typed.
- Only the user can turn it off, by saying "stop adhd mode" or "normal mode", and only for that session.

Installed with `npx skills add ayghri/i-have-adhd` and pinned in `skills-lock.json`. Update it with `npx skills update i-have-adhd`.
