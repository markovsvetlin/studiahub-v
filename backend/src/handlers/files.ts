import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1'
})

const bucket = process.env.S3_BUCKET || ''

export async function upload(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    if (!event.body) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'body required' }) }
    }
    const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf-8') : event.body
    const { content, contentType, key } = JSON.parse(raw || '{}') as { content?: string; contentType?: string; key?: string }
    if (!content) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'content (base64) required' }) }
    }
    const allowed = new Set(['application/pdf','image/png','image/jpeg','image/webp','image/gif'])
    const ct = (contentType && typeof contentType === 'string') ? contentType : 'application/octet-stream'
    if (contentType && !allowed.has(ct)) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'unsupported contentType' }) }
    }
    const extMap: Record<string,string> = { 'application/pdf':'pdf','image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif' }
    const finalKey = (key && typeof key === 'string') ? key : `upload-${Date.now()}.${extMap[ct] ?? 'bin'}`
    const bodyBuf = Buffer.from(content, 'base64')
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: finalKey, Body: bodyBuf as any, ContentType: ct }))
    return { statusCode: 201, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ok: true, key: finalKey, contentType: ct }) }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: (err as Error).message }) }
  }
}



export async function get(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const key = event.pathParameters?.key
    if (!key) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'key required' }) }

    const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
    const body = await res.Body?.transformToString()

    return { statusCode: 200, headers: { 'content-type': 'text/plain' }, body: body || '' }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: (err as Error).message }) }
  }
}
