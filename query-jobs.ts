import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const jobs = await db.job.findMany({ orderBy: { createdAt: 'desc' }, take: 10 });
for (const j of jobs) {
  console.log(j.id, '|', j.status, '|', j.createdAt.toISOString(), '|', j.updatedAt.toISOString());
}
await db.$disconnect();
