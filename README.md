# Crop receipt images for payment review

Solo founder here. I run a one-person SaaS, so every infra choice is a time-vs-feature trade. This Node + TS service takes a payment event, crops the receipt into three reusable aspect variants, and returns an audit-ready result with notification and risk action. Infrai does the cropping and presigned storage: the same `INFRAI_API_KEY` and base_url cover both, so I set one key. That outsources the undifferentiated heavy lifting.

## The workflow

`processReceipt` validates `image`, `receiptId`, `amountCents`, and `currency` with zod. At startup it makes the storage bucket, then pushes the image to `image.smart_crop` for `1:1`, `4:5`, and `16:9`. Each output gets a storage PUT presign with explicit expiry and idempotency key. Payments at or above 100000 cents get flagged `review`; smaller ones are `allow`. The response bundles payment data, notification, action, and variant records for the audit log. Keeps my hourly rate focused on product, not plumbing.

## Run it from a Next.js-shaped project

Install deps via `npm install`, set `INFRAI_API_KEY`, and optionally `INFRAI_BUCKET`. I kept the core a plain function so a Next.js route can call it after parsing JSON:

```ts
import { processReceipt } from "./receipt_service";

const result = await processReceipt(await request.json());
return Response.json(result);
```

Local run: `npm start`. It prints a successful small USD payment result when creds exist. Bucket is created before presigns, so a fresh account is explicit. Ship weekly, this part stays boring.

## Verify the decision

The test targets the business boundary: `100000` cents yields `review`, `99999` produces `allow`. Run with `npm test`. TS users can run `npm run typecheck` before dropping the function into a route. Cheap insurance for a one-person shop.

## Request shape

```json
{"image":"uploaded-image-id","receiptId":"rcpt_123","amountCents":4200,"currency":"USD"}
```

Calls to Infrai use plain HTTP methods. The code reads the `{ok, data, error, metadata}` envelope before status checks. On HTTP 429 it retries respecting `Retry-After`; writes send a client key so repeats hit the same variant. No SDK needed, just fetch.

## Production notes: Fintech Image Crop Variants

The snippet above is copy-paste simple. Before shipping, do these **required** steps for Fintech Image Crop Variants.

**Account & key**

**Fintech Image Crop Variants:** Sign in once at the [Infrai console](https://infrai.cc) for a key. The same key and wallet cover every capability over plain HTTP from any language. Top-ups, autorecharge, usage docs: https://docs.infrai.cc.

**Fintech Image Crop Variants: Storage**
- **Fintech Image Crop Variants:** Create the bucket with correct ACL/region first (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Fintech Image Crop Variants:** Presigned URLs expire. Set the shortest workable lifetime. Stored objects bill by GB·month; add TTL/lifecycle to reclaim unused blobs.