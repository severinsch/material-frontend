# Scout Material Management - Frontend

The web interface for the [Scout Material Management API](https://github.com/severinsch/material-api). It helps scout
groups keep track of their material, plan what to pack for camps and record what is lent out.

## Features

- **Materials:** bulk materials (counted, e.g. tent pegs) with stock, location and purchases; individual materials
  (tracked piece by piece, e.g. tents) with their items, condition, status and damage reports.
- **Kits and packing list:** define kits (e.g. "Jurte") from parts with interchangeable materials; a part can come in
  several amounts ("Ausführungen", e.g. Einbein or Dreibein, or with and without windows). Select kits, several times
  with different amounts if needed, to see which materials to pack, where they are stored and what is short. The
  selection is kept in the URL (shareable), and the list can be printed or copied.
- **Loans:** a simple loan book of what was lent to whom, and when it came back. Material is lent by quantity
  ("4 Kohtenblätter"); for individual materials specific items can be picked instead where it matters. Lent out pieces
  can optionally count as unavailable.
- **Locations:** where material is stored, and what is stored where.
- **Overview:** overdue and open loans, items that need repair and open damage reports.
- **Accounts and Stämme:** login with username and password; each Stamm has its own inventory and members with a
  role (read, edit, admin). Admins create accounts and pass on a setup link; platform admins manage all Stämme and
  accounts on `/admin`.

The interface is in German and follows the system's light or dark mode (switchable in the header).

## Architecture

- [SvelteKit](https://svelte.dev/docs/kit) 3 with Svelte 5, [shadcn-svelte](https://shadcn-svelte.com/) components
  (`src/lib/components/ui/`) and Tailwind CSS 4.
- Pages load their data in universal `+page.ts` load functions; changes are made from the browser and reload the data
  afterwards (`mutate` in `src/lib/api/index.ts`).
- The browser only talks to the SvelteKit server: `src/routes/api/[...path]/+server.ts` forwards `/api/*` to the
  backend at `API_URL`. The API therefore needs neither CORS nor a public address.
- **Sessions:** the API issues an opaque session token at login, which lives in an httpOnly cookie and never reaches
  page JavaScript. `hooks.server.ts` loads the user for every page request and sends visitors without a session to
  `/login`. The proxy adds the token as `Authorization: Bearer`, forwards only the routes the pages need (login and
  setup go through form actions), rejects changes from other origins and passes on the client's IP address, which the
  API uses to throttle failed logins.
- **Stämme (tenants):** all pages live below `/[tenant]/` (the Stamm's slug), so every page and request belongs to
  one Stamm. `[tenant]/+layout.svelte` provides the Stamm, the user's permissions and an API client bound to the
  Stamm (`getTenant()` in `src/lib/tenant.ts`; its paths omit the `/tenants/{tenantId}` prefix). `/` goes to the only
  or last used Stamm, old links like `/kits` are redirected into it. Top-level route names can't be slugs; the API
  rejects them and `src/reserved-slugs.test.ts` keeps both lists in sync.
- The UI hides what a role can't do (`src/lib/permissions.ts`); the API enforces it regardless.
- The API types in `src/lib/api/schema.d.ts` are generated from the backend's `openapi.json` with
  [openapi-typescript](https://openapi-ts.dev/); requests use the matching typed client
  [openapi-fetch](https://openapi-ts.dev/openapi-fetch/).
- The packing list calculation is a pure function in `src/lib/kits/allocate.ts` with unit tests next to it; the helpers
  for its URL state, storage places and shortage texts are in `src/lib/kits/packing.ts`.

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

On a fresh API database, the API logs a setup link for the first platform admin (`admin`), see the API's README.

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

Behind nginx (as in the VPS setup), only route the domain to this container, not `/api` to the backend: the
frontend's own `/api` proxy adds the session. The server assumes `https`, which matches nginx terminating TLS (the
session cookie is `Secure`, and changes from other origins are rejected). To see the browser's address instead of
nginx's (for the throttling of logins), set `ADDRESS_HEADER=X-Forwarded-For` and `XFF_DEPTH=1` and let nginx set the
header.

When running next to the API's compose stack, join its network and use the service name, e.g.
`docker run --network material-api_default -p 3000:3000 -e API_URL=http://api:8080 material-frontend`.
