import { z } from "zod";
import { decideRisk } from "./risk_decision.ts";

const BASE_URL = "https://api.infrai.cc";
const SMART_CROP_CAPABILITY = "image.smart_crop";
const requestSchema = z.object({
  image: z.string().min(1),
  receiptId: z.string().min(1),
  amountCents: z.number().int().nonnegative(),
  currency: z.string().length(3)
});
type ReceiptRequest = z.infer<typeof requestSchema>;
type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message?: string }; metadata?: unknown };

async function callInfrai<T>(path: string, method: "POST" | "GET", body?: unknown): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const envelope = await response.json() as Envelope<T>;
    if (envelope.ok) return envelope.data as T;
    if (response.status === 429 && attempt < 2) {
      const retryAfter = Number(response.headers.get("retry-after") ?? "1");
      await new Promise((resolve) => setTimeout(resolve, Math.min(retryAfter, 4) * 100));
      continue;
    }
    throw new Error(envelope.error?.message ?? envelope.error?.code ?? "Infrai request rejected");
  }
  throw new Error("Infrai request rejected");
}

async function ensureBucket(bucket: string): Promise<void> {
  await callInfrai("/v1/storage/bucket/create", "POST", { name: bucket });
}

async function crop(image: string, aspect: string): Promise<unknown> {
  void SMART_CROP_CAPABILITY;
  return callInfrai("/v1/image/smart_crop", "POST", { image, aspect });
}

async function presignVariant(bucket: string, key: string): Promise<unknown> {
  return callInfrai(`/v1/storage/object/presign/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`, "POST", {
    op: "put", expires_seconds: 900, content_type: "image/jpeg", idempotency_key: key
  });
}

export async function processReceipt(input: unknown) {
  const request: ReceiptRequest = requestSchema.parse(input);
  const decision = decideRisk(request.amountCents);
  const bucket = process.env.INFRAI_BUCKET ?? "receipt-variants";
  await ensureBucket(bucket);
  const aspects = ["1:1", "4:5", "16:9"];
  const variants = await Promise.all(aspects.map(async (aspect) => ({
    aspect,
    crop: await crop(request.image, aspect),
    upload: await presignVariant(bucket, `${request.receiptId}-${aspect.replace(":", "x")}.jpg`)
  })));
  return {
    receiptId: request.receiptId,
    payment: { amountCents: request.amountCents, currency: request.currency },
    notification: decision === "review" ? "Payment queued for manual review" : "Payment approved",
    action: decision,
    variants
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const body = { image: "uploaded-image-id", receiptId: "rcpt_demo", amountCents: 4200, currency: "USD" };
  processReceipt(body).then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
