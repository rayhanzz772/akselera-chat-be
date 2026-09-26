require('dotenv').config()
const { S3Client } = require('@aws-sdk/client-s3')
const { Upload } = require('@aws-sdk/lib-storage')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const { GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3')

const s3Client = new S3Client({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  },
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.AWS_ENDPOINT,
  forcePathStyle: true
})

async function uploadFile(path, data) {
  try {
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: process.env.AWS_BUCKET,
        Key: path,
        Body: data
      }
    })

    const result = await upload.done()
    const fileUrl = result.Location ? result.Location : null

    return {
      success: fileUrl ? true : false,
      url: path
    }
  } catch (error) {
    console.error('Error details:', error)
    throw error
  }
}

async function getFile(path) {
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET,
      Key: path,
      ResponseContentDisposition: 'inline'
    })

    const fileUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 })

    return fileUrl
  } catch (error) {
    console.error('Error getting file', error)
    throw error
  }
}

async function deleteFile(path) {
  try {
    const command = new DeleteObjectCommand({
      Bucket: process.env.AWS_BUCKET,
      Key: path
    })

    await s3Client.send(command)
    return { success: true }
  } catch (error) {
    console.error('Error deleting file', error)
    throw error
  }
}

module.exports = { uploadFile, getFile, deleteFile }
