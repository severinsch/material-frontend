FROM oven/bun:1 AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# The build bundles all dependencies, so the runtime image only needs the output.
FROM oven/bun:1-slim
WORKDIR /app
COPY --from=builder /app/build ./build
COPY package.json ./
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
CMD ["bun", "./build/index.js"]
