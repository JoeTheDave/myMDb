import { Router, Request, Response } from 'express'
import multer from 'multer'
import { authenticate } from '../middleware/authenticate'
import { authorize } from '../middleware/authorize'
import { uploadToS3 } from '../lib/s3'
import { logger } from '../lib/logger'

const router = Router()

const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (ACCEPTED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are accepted.'))
    }
  },
})

// POST /api/upload
router.post(
  '/',
  authenticate,
  authorize('EDITOR'),
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' })
      return
    }
    const userId = req.user!.id
    try {
      const url = await uploadToS3(req.file, userId)
      logger.info({ logId: 'fresh-sending-cloud', userId }, 'File uploaded to S3')
      res.json({ url })
    } catch (err) {
      logger.error({ logId: 'murky-pushing-smoke', err }, 'Failed to upload file to S3')
      res.status(500).json({ error: 'Failed to upload file' })
    }
  },
)

export default router
