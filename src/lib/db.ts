import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
  })

<<<<<<< HEAD
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
=======
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
