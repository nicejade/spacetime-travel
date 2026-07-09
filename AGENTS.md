# Agent Guidelines

## Git Commits

### Commit messages

- Write all commit messages in **English**.
- Use [gitmoji](https://gitmoji.dev/) at the start of the subject line, followed by a short imperative summary.

**Format:**

```
<gitmoji> <subject>

[optional body]
```

**Examples:**

```
✨ Add year filter to sidebar and map coloring
🐛 Fix pnpm workspace config for Cloudflare deploy
♻️ Remove trips model in favor of global visits/legs
📝 Sync README and HANDOFF to year-filter model
```

### Common gitmoji

| Emoji | Use when |
|-------|----------|
| ✨ | New feature |
| 🐛 | Bug fix |
| ♻️ | Refactor |
| 📝 | Documentation |
| 🎨 | UI / styling |
| ⚡️ | Performance |
| 🔧 | Configuration / tooling |
| 🗑️ | Remove code or files |
| ✅ | Tests |
| 🚀 | Deploy / release |

### Subject line rules

- Keep the subject concise (≤ 72 characters when possible).
- Use the imperative mood ("Add feature", not "Added feature").
- Do not end the subject with a period.
- Add a body only when the *why* is not obvious from the subject.
