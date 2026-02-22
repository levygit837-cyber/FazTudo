import { Worker, Job } from "bullmq";
import { getRedisConnectionOpts } from "../queues/connection";
import { QUEUE_NAMES, type EmailJobData } from "../queues/queues";
import { sendEmail, sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail } from "../services/emailService";
import { createLogger } from "../lib/logger";

const log = createLogger("worker:email");

async function processEmail(job: Job<EmailJobData>): Promise<void> {
  const { to, subject, template, data } = job.data;

  log.info({ jobId: job.id, to, template }, "Processing email");

  let result;

  switch (template) {
    case "verification":
      result = await sendVerificationEmail(
        to,
        data.name as string,
        data.verifyUrl as string
      );
      break;

    case "password-reset":
      result = await sendPasswordResetEmail(
        to,
        data.name as string,
        data.resetUrl as string
      );
      break;

    case "welcome":
      result = await sendWelcomeEmail(
        to,
        data.name as string,
        data.loginUrl as string
      );
      break;

    case "notification":
      result = await sendEmail({
        to,
        subject,
        html: `<div style="font-family:sans-serif;padding:16px;">
          <h2 style="color:#1e293b;">${data.title}</h2>
          <p style="color:#475569;">${data.message}</p>
          <hr style="border-color:#e2e8f0;" />
          <p style="color:#94a3b8;font-size:12px;">FazTudo - Marketplace de Serviços</p>
        </div>`,
      });
      break;

    default:
      result = await sendEmail({ to, subject, html: data.html as string });
      break;
  }

  if (!result.success) {
    throw new Error(`Email send failed: ${result.error}`);
  }

  log.info({ jobId: job.id, messageId: result.messageId }, "Email sent");
}

export function createEmailWorker(): Worker<EmailJobData> {
  const worker = new Worker<EmailJobData>(
    QUEUE_NAMES.EMAIL,
    processEmail,
    {
      connection: getRedisConnectionOpts(),
      concurrency: 5,
      limiter: {
        max: 30, // 30 emails per second max
        duration: 1000,
      },
    }
  );

  worker.on("completed", (job) => {
    log.debug({ jobId: job.id }, "Email job completed");
  });

  worker.on("failed", (job, err) => {
    log.error({ jobId: job?.id, err }, "Email job failed");
  });

  log.info("Email worker started");
  return worker;
}
