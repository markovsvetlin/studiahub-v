import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { prisma } from '../db'

export async function handler(_event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
	let dbOk = false
	try { await prisma.$queryRaw`SELECT 1`; dbOk = true } catch {}
	return {
		statusCode: 200,
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ ok: true, db: dbOk })
	};
}
