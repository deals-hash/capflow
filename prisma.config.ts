import { defineConfig } from 'prisma/config'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL,
    directUrl: process.env.DIRECT_URL,
  },
})
