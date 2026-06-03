import prisma from "../../lib/prisma.js";
import { sendEmail } from "../../lib/resend.js";

const ALERT_TO = "financeiro@addereon.com.br";

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
    sendEmail({
      to: ALERT_TO,
      subject: `[Addere] Falha no job: ${jobName} — cliente ${clientId ?? "global"}`,
      html: `<p><strong>Job:</strong> ${jobName}</p><p><strong>Cliente:</strong> ${clientId ?? "global"}</p><p><strong>Erro:</strong> ${err.message}</p><p><strong>Execution ID:</strong> ${execution.id}</p>`,
    }).catch(() => {});
    throw err;
  }
}
