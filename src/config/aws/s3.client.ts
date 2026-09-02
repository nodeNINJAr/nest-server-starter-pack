import { S3Client } from '@aws-sdk/client-s3';

// S3 upload is optional — fall back to a valid-but-unusable config so
// constructing the client never crashes the app at boot when it isn't
// configured. Actual uploads will fail at call time with a real AWS error.
export const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});
