import prisma from "../../lib/prisma.js";

export async function runJob(clientId, jobName, fn) {
  const execution = await prisma.jobExecution.create({
    data: { clientId: clientId ?? null, jobName, status: "RUNNING" },
  });
  try {
    const details = await fn();
    await prisma.jobExecution.update({
      where: { id: execution.id },
      data: { status: "SUCCESS", details: details ?? {}, endedAt: new Date() },
    });
    return { ok: true, executionId: execution.id, details };
  } catch (err) {
    await prisma.jobExecution.update({
      where: { id: execution.id },
      data: { status: "FAILED", error: err.message, endedAt: new Date() },
    });
    throw err;
  }
}
