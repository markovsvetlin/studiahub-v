import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb'

const isOffline = !!process.env.IS_OFFLINE

const client = new DynamoDBClient({
  region: isOffline ? 'localhost' : process.env.AWS_REGION || 'us-east-1',
  endpoint: isOffline ? 'http://localhost:8000' : undefined,
  credentials: isOffline ? { accessKeyId: 'fake', secretAccessKey: 'fake' } : undefined,
})
const ddb = DynamoDBDocumentClient.from(client)

const tableName = process.env.TABLE_NAME || 'studiahub-backend-dev-items'

export async function create(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const now = new Date().toISOString()
    const body = event.body ? JSON.parse(event.body) : {}
    const name = typeof body?.name === 'string' ? body.name : 'test'
    const id = (globalThis as any).crypto?.randomUUID?.() || `${Date.now()}`

    const item = { id, name, createdAt: now }
    await ddb.send(new PutCommand({ TableName: tableName, Item: item }))

    return {
      statusCode: 201,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: true, item })
    }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: (err as Error).message }) }
  }
}

export async function get(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const id = event.pathParameters?.id
    if (!id) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'id required' }) }

    const res = await ddb.send(new GetCommand({ TableName: tableName, Key: { id } }))
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: true, item: res.Item ?? null })
    }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: (err as Error).message }) }
  }
}
