import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'

let dynamoClient: DynamoDBDocumentClient

declare global {
  var __dynamoClient: DynamoDBDocumentClient | undefined
}

if (!global.__dynamoClient) {
  const client = new DynamoDBClient({
    region: process.env.AWS_REGION || 'us-east-1',
    // For local development with serverless-dynamodb-local
    ...(process.env.IS_OFFLINE && {
      endpoint: 'http://localhost:8000',
      credentials: {
        accessKeyId: 'fake',
        secretAccessKey: 'fake'
      }
    })
  })
  
  global.__dynamoClient = DynamoDBDocumentClient.from(client)
}

dynamoClient = global.__dynamoClient

export { dynamoClient as db }


