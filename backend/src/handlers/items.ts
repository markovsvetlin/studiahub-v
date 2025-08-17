import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { prisma } from '../db'

export async function create(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const now = new Date().toISOString()
    const body = event.body ? JSON.parse(event.body) : {}
    const name = typeof body?.name === 'string' ? body.name : 'test'
    const created = await prisma.item.create({ data: { name, createdAt: new Date(now) } })

    return {
      statusCode: 201,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: true, item: { id: created.id, name: created.name, createdAt: created.createdAt.toISOString() } })
    }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: (err as Error).message }) }
  }
}

export async function get(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const id = event.pathParameters?.id
    if (!id) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'id required' }) }

    const res = await prisma.item.findUnique({ where: { id } })
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: true, item: res ? { id: res.id, name: res.name, createdAt: res.createdAt.toISOString() } : null })
    }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: (err as Error).message }) }
  }
}
