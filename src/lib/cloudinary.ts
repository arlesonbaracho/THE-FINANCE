import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
})

export async function uploadBuffer(
  buffer: Buffer,
  options: { folder?: string; resource_type?: 'image' | 'raw' | 'auto' }
): Promise<string> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        { folder: options.folder ?? 'nfs', resource_type: options.resource_type ?? 'auto' },
        (err, result) => {
          if (err || !result) reject(err ?? new Error('Cloudinary upload failed'))
          else resolve(result.secure_url)
        }
      )
      .end(buffer)
  })
}
