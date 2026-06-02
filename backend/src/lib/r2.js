import { S3Client, PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import path from "path";

export function isR2Configured() {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME &&
    process.env.R2_PUBLIC_URL_BASE
  );
}

let _client = null;
function getClient() {
  if (!_client) {
    _client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return _client;
}

function safeExt(originalName) {
  const ext = path.extname(originalName ?? "").replace(".", "").toLowerCase();
  return ext || "bin";
}

function pathFor(clientSlug, originalName) {
  const yearMonth = new Date().toISOString().slice(0, 7);
  return `clients/${clientSlug}/${yearMonth}/${randomUUID()}.${safeExt(originalName)}`;
}

export async function uploadBuffer({ clientSlug, buffer, originalName, contentType }) {
  const key = pathFor(clientSlug, originalName);
  await getClient().send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
  return `${process.env.R2_PUBLIC_URL_BASE}/${key}`;
}

export async function listObjects(clientSlug) {
  const prefix = `clients/${clientSlug}/`;
  const cmd = new ListObjectsV2Command({
    Bucket: process.env.R2_BUCKET_NAME,
    Prefix: prefix,
    MaxKeys: 200,
  });
  const res = await getClient().send(cmd);
  return (res.Contents ?? [])
    .filter((o) => o.Size > 0)
    .map((o) => ({
      key: o.Key,
      url: `${process.env.R2_PUBLIC_URL_BASE}/${o.Key}`,
      size: o.Size,
      lastModified: o.LastModified,
    }))
    .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
}

export async function uploadToR2({ clientSlug, filename, buffer, contentType }) {
  const key = `${clientSlug}/${filename}`;
  await getClient().send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
  return `${process.env.R2_PUBLIC_URL_BASE}/${key}`;
}
