# Scout Material Management - Frontend

The web interface for my [Scout Material Management tool](https://github.com/severinsch/material-api). This application allows Scout groups to organize storage, report damages, and plan material needs for upcoming camps.

## Features

* **Material Catalog:** Browse and filter the entire inventory.
* **Smart Kit Selector:**
    * Select kits (e.g., "5 Jurten").
    * Toggle optional parts (e.g., "Include Windows").
    * Automatically calculates total required individual items (pegs, poles, ropes).
* **Check-in / Check-out:** Manage material flow for camps.
* **Responsive Design:** Works on desktop and mobile (for use in the storage room).

## Development Setup

### Prerequisites

- [Bun](https://bun.sh/) (v1.0+)
- [Docker](https://www.docker.com/) (optional, for containerized deployment)

### Local Development

1. **Install dependencies:**
   ```bash
   bun install
   ```

2. **Start the development server:**
   ```bash
   bun run dev
   ```
   The app will be available at `http://localhost:5173`.

3. **Build for production:**
   ```bash
   bun run build
   ```

4. **Preview production build:**
   ```bash
   bun run preview
   ```

### Docker

Build and run the application in a container:

```bash
# Build the image
docker build -t material-frontend .

# Run the container
docker run -p 3000:3000 material-frontend
```

The app will be available at `http://localhost:3000`.

## API Client

The API client is auto-generated from an OpenAPI specification using [openapi-generator-cli](https://openapi-generator.tech/). The generated TypeScript client is located in `src/lib/api/generated/`.

To regenerate the client after updating the OpenAPI spec (`src/lib/api/open-api.json`):

```bash
bun run api:generate
```

This runs:
```bash
openapi-generator-cli generate -i src/lib/api/open-api.json -g typescript-fetch -o src/lib/api --additional-properties=typescriptThreePlus=true,supportsES6=true,modelPropertyNaming=original,useSingleRequestParameter=true
```

## UI Components

This project uses [shadcn-svelte](https://shadcn-svelte.com/) for UI components. Components are located in `src/lib/components/ui/`.

To add new components:

```bash
bunx shadcn-svelte@latest add <component-name>
```

For example:
```bash
bunx shadcn-svelte@latest add button
bunx shadcn-svelte@latest add card
```
