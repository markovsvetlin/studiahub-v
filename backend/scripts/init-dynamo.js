/*
  Initializes DynamoDB tables for local or remote environments.
  Respects the naming from serverless.yml: `${service}-${stage}-items|files`.
  Config via env:
    - DYNAMO_ENDPOINT (default: http://localhost:8000)
    - AWS_REGION (default: us-east-1)
    - STAGE (default: dev)
    - SERVICE (default: studiahub-backend)
*/

const { DynamoDBClient, DescribeTableCommand, CreateTableCommand } = require("@aws-sdk/client-dynamodb");

const endpoint = process.env.DYNAMO_ENDPOINT || "http://localhost:8000";
const region = process.env.AWS_REGION || "us-east-1";
const stage = process.env.STAGE || "dev";
const service = process.env.SERVICE || "studiahub-backend";

const itemsTableName = `${service}-${stage}-items`;
const filesTableName = `${service}-${stage}-files`;
const quizTableName = `${service}-${stage}-quizzes`;
const usageTableName = `${service}-${stage}-usage`;
const subscriptionsTableName = `${service}-${stage}-subscriptions`;
const chatTableName = `${service}-${stage}-chat`;
const conversationsTableName = `${service}-${stage}-conversations`;

const client = new DynamoDBClient({ region, endpoint });

async function waitForActive(tableName) {
  const start = Date.now();
  while (true) {
    const { Table } = await client.send(new DescribeTableCommand({ TableName: tableName }));
    if (Table && Table.TableStatus === "ACTIVE") return;
    if (Date.now() - start > 60_000) throw new Error(`Timed out waiting for table ${tableName} to become ACTIVE`);
    await new Promise((r) => setTimeout(r, 500));
  }
}

async function ensureTable(params) {
  try {
    await client.send(new DescribeTableCommand({ TableName: params.TableName }));
    console.log(`Table already exists: ${params.TableName}`);
  } catch (err) {
    if (err && err.name === "ResourceNotFoundException") {
      console.log(`Creating table: ${params.TableName}`);
      await client.send(new CreateTableCommand(params));
      await waitForActive(params.TableName);
      console.log(`Created: ${params.TableName}`);
    } else {
      throw err;
    }
  }
}

async function main() {
  console.log(`Using endpoint: ${endpoint}, region: ${region}, stage: ${stage}, service: ${service}`);

  await ensureTable({
    TableName: itemsTableName,
    AttributeDefinitions: [
      { AttributeName: "id", AttributeType: "S" },
    ],
    KeySchema: [
      { AttributeName: "id", KeyType: "HASH" },
    ],
    BillingMode: "PAY_PER_REQUEST",
  });

  await ensureTable({
    TableName: filesTableName,
    AttributeDefinitions: [
      { AttributeName: "id", AttributeType: "S" },
      { AttributeName: "key", AttributeType: "S" },
      { AttributeName: "userId", AttributeType: "S" },
      { AttributeName: "status", AttributeType: "S" },
    ],
    KeySchema: [
      { AttributeName: "id", KeyType: "HASH" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "key-index",
        KeySchema: [
          { AttributeName: "key", KeyType: "HASH" },
        ],
        Projection: { ProjectionType: "ALL" },
      },
      {
        IndexName: "user-status-index",
        KeySchema: [
          { AttributeName: "userId", KeyType: "HASH" },
          { AttributeName: "status", KeyType: "RANGE" },
        ],
        Projection: { ProjectionType: "ALL" },
      },
    ],
    BillingMode: "PAY_PER_REQUEST",
  });

  await ensureTable({
    TableName: quizTableName,
    AttributeDefinitions: [
      { AttributeName: "id", AttributeType: "S" },
      { AttributeName: "userId", AttributeType: "S" },
    ],
    KeySchema: [
      { AttributeName: "id", KeyType: "HASH" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "user-index",
        KeySchema: [
          { AttributeName: "userId", KeyType: "HASH" },
        ],
        Projection: { ProjectionType: "ALL" },
      },
    ],
    BillingMode: "PAY_PER_REQUEST",
  });

  await ensureTable({
    TableName: usageTableName,
    AttributeDefinitions: [
      { AttributeName: "userId", AttributeType: "S" },
    ],
    KeySchema: [
      { AttributeName: "userId", KeyType: "HASH" },
    ],
    BillingMode: "PAY_PER_REQUEST",
  });

  await ensureTable({
    TableName: subscriptionsTableName,
    AttributeDefinitions: [
      { AttributeName: "userId", AttributeType: "S" },
      { AttributeName: "stripeCustomerId", AttributeType: "S" },
      { AttributeName: "stripeSubscriptionId", AttributeType: "S" },
    ],
    KeySchema: [
      { AttributeName: "userId", KeyType: "HASH" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "stripe-customer-index",
        KeySchema: [
          { AttributeName: "stripeCustomerId", KeyType: "HASH" },
        ],
        Projection: { ProjectionType: "ALL" },
      },
      {
        IndexName: "stripe-subscription-index",
        KeySchema: [
          { AttributeName: "stripeSubscriptionId", KeyType: "HASH" },
        ],
        Projection: { ProjectionType: "ALL" },
      },
    ],
    BillingMode: "PAY_PER_REQUEST",
  });

  await ensureTable({
    TableName: chatTableName,
    AttributeDefinitions: [
      { AttributeName: "id", AttributeType: "S" },
      { AttributeName: "userId", AttributeType: "S" },
    ],
    KeySchema: [
      { AttributeName: "id", KeyType: "HASH" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "user-index",
        KeySchema: [
          { AttributeName: "userId", KeyType: "HASH" },
        ],
        Projection: { ProjectionType: "ALL" },
      },
    ],
    BillingMode: "PAY_PER_REQUEST",
  });

  await ensureTable({
    TableName: conversationsTableName,
    AttributeDefinitions: [
      { AttributeName: "conversationId", AttributeType: "S" },
      { AttributeName: "userId", AttributeType: "S" },
    ],
    KeySchema: [
      { AttributeName: "conversationId", KeyType: "HASH" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "user-index",
        KeySchema: [
          { AttributeName: "userId", KeyType: "HASH" },
        ],
        Projection: { ProjectionType: "ALL" },
      },
    ],
    BillingMode: "PAY_PER_REQUEST",
  });

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
