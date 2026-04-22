import { defineConfig } from "prisma/config"

export default defineConfig({
  datasource: {
    url: process.env.POSTGRES_PRISMA_URL!,
  },
})
