# VibeCraft

VibeCraft is an AI-powered content generator that creates marketing copy, blog posts, and social media text from simple prompts. It combines an Express.js backend for generation and user/history management with a Vite + React (TypeScript) frontend for a smooth, responsive UI. Designed for fast iterations, history tracking, and easy local setup.

## Features
- Generate AI-written content from prompts
- Save and browse generated content history
- User authentication and profile management

## Tech stack
- Backend: Node.js, Express
- Frontend: React, Vite, TypeScript
- Database: (see backend `package.json` / `db.js`)

## Quick start

1. Backend

```powershell
cd ai-content-backend
npm install
npm start
# or: node server.js
```

2. Frontend

```powershell
cd ai-content-frontend
npm install
npm run dev
# open the URL printed by Vite (usually http://localhost:5173)
```

## Project structure (top-level)

- `ai-content-backend/` — Express backend (API routes, models, middleware)
- `ai-content-frontend/` — Vite + React TypeScript frontend

## Contributing
- Open an issue or PR. Keep changes small and include a short description of the problem and the fix.

## License
Include your license here (e.g., MIT) or add `LICENSE` to the repo.

---
If you'd like, I can also add a short `description` field to each `package.json` or generate a `LICENSE` file — tell me which license you prefer.
