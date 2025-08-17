# Backend local setup (Postgres + Prisma + Serverless)

## 1) Start Postgres locally

```bash
cd backend
docker compose up -d
```

This starts Postgres 16 on `localhost:5432` with DB `studiahub`, user `postgres`, password `postgres`.

## 2) Environment vars

Create a file named `.env.dev` (not committed) with:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/studiahub?schema=public"
IS_OFFLINE=true
```

## 3) Install deps and run migrations

```bash
npm i
npx prisma generate
npx prisma migrate dev --name init_items
```

## 4) Run the API locally

```bash
npm run dev
```

- Health: `GET http://localhost:4000/health` → `{ ok: true, db: true }`
- Items: `POST /items` and `GET /items/{id}`

## Deploying Aurora (prod)
- Create Aurora PostgreSQL Serverless v2 in us-east-1
- Get a connection string and set `DATABASE_URL` in your prod env
- Run one-time migrations: `npx prisma migrate deploy`
- Deploy: `npm run deploy:prod`

## Notes
- DynamoDB is removed; all app data will go to Postgres going forward.
- We’ll extend the Prisma schema with files/chunks/embeddings once this slice is verified.
