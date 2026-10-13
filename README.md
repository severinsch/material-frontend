# Scout Material Management - Frontend

The web interface for the [Scout Material Management API](https://github.com/severinsch/material-api). It helps scout
groups keep track of their material, plan what to pack for camps and record what is lent out.

## Features

- **Materials:** bulk materials (counted, e.g. tent pegs) with stock, location and purchases; individual materials
  (tracked piece by piece, e.g. tents) with their items, condition, status and damage reports.
- **Kits and packing list:** define kits (e.g. "Jurte") from parts with interchangeable materials and optional parts.
  Select kits to see which materials to pack and what is short.
- **Loans:** a simple loan book of what was lent to whom, and when it came back. Lent out pieces can optionally count
  as unavailable.
- **Locations:** where material is stored.

## Architecture

- [SvelteKit](https://svelte.dev/docs/kit) 3 with Svelte 5, [shadcn-svelte](https://shadcn-svelte.com/) components
  (`src/lib/components/ui/`) and Tailwind CSS 4.
- Pages load their data in universal `+page.ts` load functions; changes are made from the browser and reload the data
  afterwards (`mutate` in `src/lib/api/index.ts`).
- The browser only talks to the SvelteKit server: `src/routes/api/[...path]/+server.ts` forwards `/api/*` to the
  backend at `API_URL`. The API therefore needs neither CORS nor a public address.
- The API types in `src/lib/api/schema.d.ts` are generated from the backend's `openapi.json` with
  [openapi-typescript](https://openapi-ts.dev/); requests use the matching typed client
  [openapi-fetch](https://openapi-ts.dev/openapi-fetch/).
- The packing list calculation is a pure function in `src/lib/kits/allocate.ts` with unit tests next to it.

## Development

Requires [Bun](https://bun.sh/) and a running backend (see the API's README; `docker compose up -d` there starts it on
port 8080).

```bash
bun install
bun run dev          # http://localhost:5173, uses the API at http://localhost:8080
bun run check        # type check
bun run lint         # prettier + eslint
bun run test         # unit tests
```

| Variable  | Default                 | Description                                     |
| --------- | ----------------------- | ----------------------------------------------- |
| `API_URL` | `http://localhost:8080` | Base URL of the API, as reached from the server |
| `PORT`    | `3000`                  | Port of the production server                   |

### API types

After API changes, regenerate the types from the backend's committed spec (expects the API repository next to this
one as `../material-api`):

```bash
bun run api:generate
```

### UI components

```bash
bunx shadcn-svelte@latest add <component-name>
```

## Docker

```bash
docker build -t material-frontend .
docker run -p 3000:3000 -e API_URL=http://<api-host>:8080 material-frontend
```

When running next to the API's compose stack, join its network and use the service name, e.g.
`docker run --network material-api_default -p 3000:3000 -e API_URL=http://api:8080 material-frontend`.
