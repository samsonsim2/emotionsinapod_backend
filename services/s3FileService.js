// services/s3FileService.js
import {
  HeadBucketCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3, BUCKET, PREFIX } from '../config/s3.js';

const PRESIGNED_URL_EXPIRES_IN = 60 * 60 * 24 * 7; // 7 days

// --- Debug ---
export async function debugS3Connectivity() {
  const result = {
    region: process.env.AWS_REGION,
    bucket: BUCKET,
    steps: [],
  };

  try {
    const head = await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
    result.steps.push({
      step: 'HeadBucket',
      ok: true,
      httpStatus: head?.$metadata?.httpStatusCode,
    });
  } catch (err) {
    result.steps.push({
      step: 'HeadBucket',
      ok: false,
      code: err?.name,
      message: err?.message,
    });
  }

  try {
    const list = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: PREFIX,
        MaxKeys: 5,
      })
    );

    result.steps.push({
      step: 'ListObjectsV2',
      ok: true,
      count: (list?.Contents || []).length,
      keys: (list?.Contents || []).map((o) => o.Key),
    });
  } catch (err) {
    result.steps.push({
      step: 'ListObjectsV2',
      ok: false,
      code: err?.name,
      message: err?.message,
    });
  }

  return result;
}

export async function getPresignedVideoUrl(
  key,
  expiresIn = PRESIGNED_URL_EXPIRES_IN
) {
  const getCmd = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  return getSignedUrl(s3, getCmd, { expiresIn });
}

// --- Upload ---
export async function uploadVideoToS3(file) {
  const ct = file.mimetype;
  const original = file.originalname || 'video.mp4';
  const sanitized = original.replace(/\s+/g, '_');

  const key = `${PREFIX}${Date.now()}-${sanitized}`;

  const uploader = new Upload({
    client: s3,
    params: {
      Bucket: BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: ct,
    },
  });

  await uploader.done();

  const presignedUrl = await getPresignedVideoUrl(
    key,
    PRESIGNED_URL_EXPIRES_IN
  );

  return {
    key,
    presignedUrl,
    contentType: ct,
    size: file.size,
  };
}

// --- List recent files (existing behavior preserved) ---
export async function listRecentFiles(limit = 5) {
  const listCmd = new ListObjectsV2Command({
    Bucket: BUCKET,
    Prefix: PREFIX,
    MaxKeys: 200,
  });

  const data = await s3.send(listCmd);
  if (!data.Contents) return [];

  const realObjects = data.Contents.filter((o) => o.Key && o.Size > 0);

  const recent = realObjects
    .sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified))
    .slice(0, limit);

  return Promise.all(
    recent.map(async (item) => {
      const presignedUrl = await getPresignedVideoUrl(
        item.Key,
        PRESIGNED_URL_EXPIRES_IN
      );

      return {
        key: item.Key,
        size: item.Size,
        lastModified: item.LastModified,
        presignedUrl,
      };
    })
  );
}

// --- List all files from S3 ---
export async function listAllFiles() {
  let continuationToken;
  const allObjects = [];

  do {
    const listCmd = new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: PREFIX,
      MaxKeys: 1000,
      ContinuationToken: continuationToken,
    });

    const data = await s3.send(listCmd);

    const realObjects = (data.Contents || []).filter(
      (o) => o.Key && o.Size > 0
    );

    allObjects.push(...realObjects);

    continuationToken = data.IsTruncated
      ? data.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return allObjects.sort(
    (a, b) => new Date(b.LastModified) - new Date(a.LastModified)
  );
}

// --- Paginated dashboard list ---
export async function listFilesPaginated(page = 1, limit = 8) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 8));

  const allFiles = await listAllFiles();
  const total = allFiles.length;
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));

  const startIndex = (safePage - 1) * safeLimit;
  const pagedItems = allFiles.slice(startIndex, startIndex + safeLimit);

  const files = await Promise.all(
    pagedItems.map(async (item) => {
      const presignedUrl = await getPresignedVideoUrl(
        item.Key,
        PRESIGNED_URL_EXPIRES_IN
      );

      return {
        key: item.Key,
        size: item.Size,
        lastModified: item.LastModified,
        presignedUrl,
      };
    })
  );

  return {
    page: safePage,
    limit: safeLimit,
    total,
    totalPages,
    files,
  };
}

// --- Delete file from private S3 ---
export async function deleteFileFromS3(key) {
  if (!key || typeof key !== 'string') {
    throw new Error('Missing or invalid S3 key');
  }

  await s3.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  );

  return {
    success: true,
    key,
  };
}