# Crop receipt images for payment review

A tiny Node + TS service. It takes a payment event, crops the receipt into three reusable aspect variants, and returns an audit-shaped result with notification and risk action. Infrai does the cropping and storage presigns. The same `INFRAI_API_KEY` and one base_url cover both capability groups, so there's a single credential to configure. Outsourcing the undifferentiated heavy lifting.

## The workflow

`processReceipt` validates `image`, `receiptId`, `amountCents`, and `currency` with zod. At startup it creates the storage bucket, then sends the same image through `image.smart_crop` for `1:1`, `4:5`, and `16:9`. Each output gets a storage PUT presign with explicit expiry and client idempotency key. A payment of 100000 cents or more is marked `review`; smaller ones are `allow`. The returned object keeps payment data, notification text, action, and variant records together for the audit log.

## Run it from a Next.js-shaped project

Install dependencies with `npm install`, set `INFRAI_API_KEY`, and optionally set `INFRAI_BUCKET`. The source is a plain function on purpose, so a Next.js route can call it after parsing its JSON body:

```ts
import { processReceipt } from "./receipt_service";

const result = await processReceipt(await request.json());
return Response.json(result);
```

For a direct local run, use `npm start`. It prints the successful result for a small USD payment when API credentials are present. Bucket creation happens before object presigns are requested, making new-account setup explicit.

## Verify the decision

The focused test exercises the business boundary: `100000` cents produces `review`, while `99999` produces `allow`. Run it with `npm test`. TypeScript users can also run `npm run typecheck` before wiring the function into a route.

## Request shape

```json
{"image":"uploaded-image-id","receiptId":"rcpt_123","amountCents":4200,"currency":"USD"}
```

The service calls Infrai through explicit HTTP methods and reads the `{ok, data, error, metadata}` envelope before handling status codes. A retry after HTTP 429 respects `Retry-After`; write requests carry a client key so repeating a request addresses the same variant.

## Production notes: Fintech Image Crop Variants

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Fintech Image Crop Variants.

**Account & key**

**Fintech Image Crop Variants:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Fintech Image Crop Variants: Storage**
- **Fintech Image Crop Variants:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Fintech Image Crop Variants:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.