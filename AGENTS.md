# Repository Guidelines

## Project Structure & Module Organization

This repository has two independent npm projects. `backend/` is an Express API with `server.js` as the entry point and application code in `backend/src/`. Backend modules live under `src/modules/<domain>/` and usually split into `*.controller.js`, `*.service.js`, `*.routes.js`, and `*.validation.js`; shared models, middleware, jobs, config, seeds, and utilities are in their matching `src/` folders. Backend tests are in `backend/test/`.

`frontend/` is a Next.js app. Routes are in `frontend/src/app/`, reusable UI is in `src/components/`, API/helpers are in `src/lib/`, Redux state is in `src/store/`, and static assets are in `frontend/public/`. Frontend tests are in `frontend/test/`.

## Build, Test, and Development Commands

Install dependencies separately in each project:

```bash
cd backend && npm install
cd frontend && npm install
```

Backend commands: `npm run dev` starts the API with nodemon, `npm start` runs production mode, `npm test` runs Node test files, and `npm run seed` loads seed data.

Frontend commands: `npm run dev` starts Next locally, `npm run build` creates a production build, `npm start` serves that build, `npm run lint` runs ESLint, and `npm test` runs Node test files.

## Coding Style & Naming Conventions

Use JavaScript with 2-space indentation and follow nearby file style. Backend code uses CommonJS (`require`, `module.exports`); frontend code uses ESM imports and React components. Name React components in PascalCase, route folders in lowercase or kebab-case, and dynamic routes with Next brackets such as `[slug]`. For backend domains, keep names consistent with the existing `product.service.js` / `product.routes.js` pattern.

## Testing Guidelines

Both projects use Node's built-in test runner (`node --test`). Add backend tests as `backend/test/<feature>.test.js` and frontend tests as `frontend/test/<feature>.test.mjs` when matching existing ESM utilities. There is no enforced coverage threshold, so focus tests on changed behavior, regressions, validation, and security-sensitive flows.

## Commit & Pull Request Guidelines

Recent commits use short, lowercase summaries such as `security hardening` and `payment testing`. Keep commits focused and use direct subject lines. Pull requests should describe the change, list backend/frontend impact, mention required environment changes, link issues when available, and include screenshots for visible UI changes.

## Security & Configuration Tips

Do not commit real secrets. Use `backend/.env.example` and `frontend/.env.example` as templates, and keep local `.env` files private. Treat `backend/logs/`, `backend/uploads/`, `.next/`, and `node_modules/` as generated local artifacts.
