import { defineConfig } from "prisma/config"

export default defineConfig({
  datasource: {
    // Fallback keeps `prisma generate` working in CI/build environments where
    // the DB env var isn't set yet (generate only reads the schema, no connection needed).
    url: process.env.POSTGRES_PRISMA_URL ?? "postgresql://localhost/placeholder",
  },
})
