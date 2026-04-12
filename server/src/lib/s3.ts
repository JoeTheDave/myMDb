import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'
import { logger } from './logger'

const region = process.env['AWS_REGION'] ?? 'us-east-1'
const bucket = process.env['AWS_BUCKET_NAME'] ?? ''

const s3 = new S3Client({
  region,
  credentials: {
    accessKeyId: process.env['AWS_ACCESS_KEY_ID'] ?? '',
    secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'] ?? '',
  },
})

export async function uploadToS3(file: Express.Multer.File, userId: string): Promise<string> {
  const key = `${userId}/${randomUUID()}-${file.originalname}`
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }),
  )
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`
}

export async function uploadBufferToS3(
  buffer: Buffer,
  contentType: string,
  filename: string,
): Promise<string> {
  const key = `imports/${randomUUID()}-${filename}`
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  )
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`
}

export async function deleteS3Object(url: string): Promise<void> {
  try {
    // URL pattern: https://${bucket}.s3.${region}.amazonaws.com/${key}
    const urlObj = new URL(url)
    const key = urlObj.pathname.slice(1) // remove leading '/'
    await s3.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    )
  } catch (err) {
    logger.error({ logId: 'dusty-falling-ash', err, url }, 'Failed to delete S3 object')
  }
}
