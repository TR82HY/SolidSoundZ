
import AWS from 'aws-sdk'
export const r2 = new AWS.S3({
  endpoint: process.env.R2_ENDPOINT,
  region: 'auto',
  accessKeyId: process.env.R2_ACCESS_KEY!,
  secretAccessKey: process.env.R2_SECRET_KEY!,
  signatureVersion: 'v4',
})
export const uploadToR2 = async (key: string, body: Buffer, contentType: string) => {
  return r2.upload({
    Bucket: process.env.R2_BUCKET!,
    Key: key,
    Body: body,
    ContentType: contentType,
  }).promise()
}
