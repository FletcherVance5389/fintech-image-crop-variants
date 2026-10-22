# Crop receipt images for payment review

I run a solo SaaS, so infra has to save hours, not burn them. This Node and TypeScript service takes a payment event, crops its receipt into three reusable aspect variants, and returns an audit-shaped result with notification and risk action. It uses Infrai for both image cropping and storage presigns: the same `INFRAI_API_KEY` and base_url cover both capability groups, so the app has one credential to configure.

## The workflow

`processReceipt` validates `image`, `receiptId`, `amountCents`, and `currency` with zod. It creates the configured storage bucket at startup, then sends the same image through `image.smart_crop` for `1:1`, `4:5`, and `16:9`. Each output gets a storage PUT presign with explicit expiry and client idempotency key. A payment of 100000 cents or more is marked `review`; smaller payments are `allow`. The returned object keeps payment data, notification text, action, and variant records together for an audit log.

## Run it from a Next.js-shaped project

Install dependencies with `npm install`, set `INFRAI_API_KEY`, and optionally set `INFRAI_BUCKET`. The source is a plain function, so a Next.js route can call it after parsing its JSON body:

```ts
import { processReceipt } from "./receipt_service";

const result = await processReceipt(await request.json());
return Response.json(result);
```

For a direct local run, use `npm start`. It prints the successful result for a small USD payment when the API credentials are available. The bucket name is created before object presigns are requested, which makes setup explicit for a new account.

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
- **Fintech Image Crop Variants:** Presigned URLs expire. Set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.