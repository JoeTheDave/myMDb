import sharp from 'sharp'
import AWS from 'aws-sdk'
import { v4 as uuid } from 'uuid'

const s3 = new AWS.S3()

const bucketName = process.env.BUCKET_NAME || ''

const processImage = async (base64img: string, width: number, height: number) => {
  try {
    const buffer = Buffer.from(base64img, 'base64')
    const processed = await sharp(buffer)
      .resize({
        width,
        height,
        fit: 'cover',
      })
      .toFormat('jpeg')
      .toBuffer()
    return processed.toString('base64')
  } catch (error) {
    console.error('Error processing image:', error)
    throw new Error('Failed to process image')
  }
}

const processImageLg = async (base64img: string) => processImage(base64img, 600, 900)

const processImageSm = async (base64img: string) => processImage(base64img, 200, 300)

const uploadImage = async (base64img: string) => {
  try {
    const buffer = Buffer.from(base64img, 'base64')
    const filename = uuid()
    const params = {
      Bucket: bucketName,
      Key: filename,
      Body: buffer,
      ContentEncoding: 'base64',
      ContentType: 'image/jpeg',
    }

    const response = await s3.upload(params).promise()
    return response.Key
  } catch (error) {
    console.error('Error to upload image:', error)
    throw new Error('Failed to upload image')
  }
}

export default {
  processImageLg,
  processImageSm,
  uploadImage,
}
