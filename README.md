# SignalMap MVP

校园活动地图 MVP：点击建筑查看正在进行和未来三天活动。

## 1. 准备环境

1. 复制环境变量：
```bash
cp .env.example .env
```
2. 修改 `DATABASE_URL`（PostgreSQL）和 `NEXT_PUBLIC_MAPBOX_TOKEN`。

## 2. 安装与初始化

```bash
npm install
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run prisma:seed
```

## 3. 启动

```bash
npm run dev
```

打开 `http://localhost:3000`。

## 4. 关键接口

- `GET /api/buildings`
- `GET /api/events?buildingId=<id>&from=<iso>&to=<iso>`
- `POST /api/admin/re-ingest/:sourceId`（需 `x-admin-token`）

## 5. 数据抓取脚本

```bash
npm run ingest
```

当前已内置 UNC Heel Life 多策略抓取（优先 API，失败回退 HTML + JSON-LD）。
解析逻辑在 `src/lib/ingest/heellife-parser.ts`。
