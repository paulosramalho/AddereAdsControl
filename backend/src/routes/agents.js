import { Router } from "express";
import prisma from "../lib/prisma.js";
import { requireAuth, requireSuperAdmin } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth, requireSuperAdmin);

const JOB_NAMES = [
  "instagram-collection",
  "post-analysis",
  "content-suggestions",
  "trending-suggestions",
  "ads-collection",
  "instagram-notify",
  "publish-scheduled",
  "boost-suggestions",
  "weekly-report",
];

router.get("/status", async (req, res) => {
  try {
    const { clientId } = req.query;

    const where = clientId ? { clientId } : {};

    const executions = await prisma.jobExecution.findMany({
      where,
      orderBy: { startedAt: "desc" },
      take: 500,
      select: {
        id: true,
        clientId: true,
        jobName: true,
        status: true,
        details: true,
        error: true,
        startedAt: true,
        endedAt: true,
        client: { select: { slug: true, name: true } },
      },
    });

    const byClientJob = {};
    for (const exec of executions) {
      const cid = exec.clientId ?? "__global__";
      if (!byClientJob[cid]) byClientJob[cid] = {};
      if (!byClientJob[cid][exec.jobName]) {
        byClientJob[cid][exec.jobName] = exec;
      }
    }

    const clients = Object.entries(byClientJob).map(([cid, jobs]) => ({
      clientId: cid === "__global__" ? null : cid,
      clientSlug: Object.values(jobs)[0]?.client?.slug ?? null,
      clientName: Object.values(jobs)[0]?.client?.name ?? null,
      jobs: JOB_NAMES.map((name) => ({
        name,
        ...(jobs[name]
          ? {
              status: jobs[name].status,
              lastRun: jobs[name].startedAt,
              duration:
                jobs[name].endedAt && jobs[name].startedAt
                  ? Math.round(
                      (new Date(jobs[name].endedAt) - new Date(jobs[name].startedAt)) / 1000
                    )
                  : null,
              details: jobs[name].details,
              error: jobs[name].error,
            }
          : { status: "NEVER" }),
      })),
    }));

    res.json({ ok: true, clients });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
