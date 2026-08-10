const { PrismaClient } = require('/home/z/my-project/node_modules/.prisma/client');
const p = new PrismaClient();
(async () => {
  const j = await p.job.findUnique({ where: { id: 'cmskkmj740000q4u0udt84lxv' }, select: { status: true, stage: true, message: true, progress: true, doneImages: true, totalImages: true, doneChapters: true, totalChapters: true } });
  console.log(JSON.stringify(j, null, 2));
  await p.disconnect();
})();
