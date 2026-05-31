// Storage helper — backed by Supabase Storage (free tier)
// Mantém a mesma assinatura de uploadBuffer para não quebrar outros imports.
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BUCKET = 'nfs'

export async function uploadBuffer(
  buffer: Buffer,
  options: {
    folder?: string
    resource_type?: 'image' | 'raw' | 'auto'
    contentType?: string
  }
): Promise<string> {
  const folder = options.folder ?? 'nfs'
  const ext = options.resource_type === 'raw' ? 'pdf' : 'bin'
  const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const contentType =
    options.contentType ??
    (options.resource_type === 'raw' ? 'application/pdf' : 'application/octet-stream')

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, buffer, { contentType, upsert: false })

  if (error) throw new Error(`Storage upload failed: ${error.message}`)

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path)
  return urlData.publicUrl
}
