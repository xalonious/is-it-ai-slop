# Is It AI Slop?

Is It AI Slop? is a satirical portfolio pattern analyzer. Give it a public developer portfolio and it renders the site, crawls a small set of internal pages, measures recurring design and copy patterns, and returns a SlopScore with the evidence behind it.

The score is a heuristic, not an AI-authorship detector. It describes how strongly a site resembles a collection of common AI-era and template-driven portfolio conventions.

## Overview

The backend opens the submitted site in a headless Chromium browser and records visible text, layout measurements, computed styles, links, images, animations, and framework fingerprints. It follows a bounded set of same-origin links, prioritizing project, work, and about pages, then runs a collection of independent detectors over each rendered page.

Duplicate findings are merged across pages so a repeated pattern does not receive the same points several times. The final report groups the findings into layout, copy, stack, motion, and template categories and shows the observed evidence for each one.

## Features

- Rendered-page analysis through Playwright rather than raw HTML matching
- Bounded same-origin crawling with project, work, and about page prioritization
- Detection of repeated portfolio patterns such as bento grids, glassmorphism, excessive pills, rounded surfaces, indigo-to-violet background washes, decorative radial blooms, neon-shadow overload, default framework metadata, faux terminals, cyber-neon heroes, generic copy, familiar hero layouts, and fade-up animation monocultures
- Evidence-backed findings with the page on which each signal appeared
- Category scores for layout, copy, stack, motion, and template energy
- Combination, breadth, and density bonuses for clusters of otherwise ordinary signals
- SSRF protection for private, loopback, link-local, reserved, and internal network targets
- Redirect validation, navigation limits, overall scan timeouts, and concurrency limits
- IP-based rate limiting of ten analysis requests every five minutes
- Responsive React interface styled with Tailwind CSS
- Clear severity bands from `Suspiciously Original` to `Weapons-Grade Slop`

## Important limitation

Is It AI Slop? cannot determine whether a person, an AI model, a template, or a component library authored a website. The same patterns can appear in entirely hand-written work, and an AI-generated site can avoid every detector.

The output should be treated as a playful design-pattern reading, not evidence of authorship, quality, originality, or intent.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite, TypeScript, Tailwind CSS 4 |
| API client | Axios |
| Backend | Node.js, Express 5, TypeScript |
| Browser automation | Playwright with headless Chromium |
| Validation and security | Joi, Helmet, DNS and IP address validation |
| Logging | Winston |

## Prerequisites

Before installing the project, make sure you have:

- [Node.js](https://nodejs.org/) 20.19 or newer, or 22.12 or newer
- npm
- Enough memory to run a headless Chromium instance

## Setup

Clone the repository:

```bash
git clone https://github.com/xalonious/is-it-ai-slop.git
cd is-it-ai-slop
```

### 1. Configure the backend

Install the backend dependencies:

```bash
cd backend
npm install
```

Install the Chromium browser used by Playwright:

```bash
npx playwright install chromium
```

Copy `backend/.env.example` to `backend/.env`. The included development values are:

```env
PORT=3000
NODE_ENV=development
MAX_CONCURRENT_SCANS=2
ANALYSIS_TIMEOUT_MS=25000
MAX_PAGES_PER_SCAN=4
```

### 2. Configure the frontend

In a second terminal, install the frontend dependencies:

```bash
cd frontend
npm install
```

The Vite development server proxies `/api` requests to port `3000`. If the backend uses another port, create `frontend/.env` and set:

```env
BACKEND_PORT=3000
```

## Running the application

Start the backend from `backend/`:

```bash
npm run dev
```

Start the frontend from `frontend/` in a separate terminal:

```bash
npm run dev
```

Open `http://localhost:5173` and submit a public portfolio URL. The API health endpoint is available at `http://localhost:3000/api/health/ping` when using the default port.

## Environment variables

### Backend

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | No | Express API port; defaults to `3000` |
| `NODE_ENV` | No | Enables development request logging when set to `development` |
| `MAX_CONCURRENT_SCANS` | No | Maximum number of browser scans running at once; defaults to `2` |
| `ANALYSIS_TIMEOUT_MS` | No | Overall time limit for a scan; defaults to `25000` |
| `MAX_PAGES_PER_SCAN` | No | Maximum number of same-origin pages inspected; defaults to `4` and is hard-capped at `8` |

`POST /api/analyze` is limited to ten requests per IP address every five minutes. The health endpoint is not rate-limited.

### Frontend

| Variable | Required | Description |
| --- | --- | --- |
| `BACKEND_PORT` | No | Backend port used by the Vite development proxy; defaults to `3000` |

## How scanning works

1. The submitted address is normalized and resolved through DNS.
2. Private, internal, reserved, and unsupported addresses are rejected before Chromium is launched.
3. Playwright renders the landing page and records visible elements, computed styles, text, animations, resources, and links.
4. The crawler follows a small number of same-origin HTML pages. Project, portfolio, work, case-study, and about routes receive priority.
5. Every page is evaluated by the detector collection. Landing-page-specific hero detectors only run against the entry page.
6. Duplicate detector hits are merged and retain evidence from the pages on which they appeared.
7. The scoring layer applies category caps, combination findings, and limited breadth and density bonuses before clamping the final score to `0–100`.

Assets, API routes, authentication routes, downloads, cross-origin redirects, and repeated URL variants are excluded from the crawl. A failure on a secondary page does not discard a successful landing-page scan.

## Scoring

The five report categories have independent display caps:

| Category | Point cap |
| --- | ---: |
| Layout | 32 |
| Copy | 20 |
| Stack | 12 |
| Motion | 12 |
| Template | 40 |

The overall score is based on detector points rather than an average of these category percentages. Strong clusters can add combination bonuses, while meaningful findings spread across several categories can add capped breadth and density bonuses.

| Score | Severity |
| ---: | --- |
| 80–100 | Weapons-Grade Slop |
| 60–79 | High Slop Concentration |
| 40–59 | Moderate Slop |
| 20–39 | Minor Slop Residue |
| 0–19 | Suspiciously Original |

See [`RESEARCH.md`](./RESEARCH.md) for the reasoning and external references behind the current heuristic design.

## API overview

All routes are prefixed with `/api`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health/ping` | Check whether the API is available |
| `POST` | `/analyze` | Analyze a public portfolio URL |

The analysis endpoint accepts:

```json
{
  "url": "https://example.dev"
}
```

It returns the normalized URL, overall score, severity, category scores, evidence-backed findings, scan duration, and number of pages inspected.

## Project structure

```text
is-it-ai-slop/
|-- backend/
|   `-- src/
|       |-- core/          # Middleware, logging, validation, and errors
|       |-- rest/          # Health and analysis routes
|       |-- scanner/       # Browser crawler, detectors, scoring, and URL safety
|       |-- service/       # Analysis orchestration
|       `-- validation/    # Request schemas
|-- frontend/
|   `-- src/
|       |-- api/           # Shared Axios instance and analysis API
|       |-- components/    # Analyzer, loading state, and result report
|       `-- types/         # API response types
|-- README.md
`-- RESEARCH.md
```

## Available scripts

Run these commands from the indicated directory.

| Directory | Command | Description |
| --- | --- | --- |
| `backend/` | `npm run dev` | Start the API with automatic TypeScript restarts |
| `backend/` | `npm run build` | Compile the backend TypeScript |
| `backend/` | `npm test` | Run the backend test suite |
| `frontend/` | `npm run dev` | Start the Vite development server |
| `frontend/` | `npm run build` | Type-check and create a production frontend build |
| `frontend/` | `npm run preview` | Preview the production frontend build |
