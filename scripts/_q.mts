import "dotenv/config";
import { db } from "@/lib/db";
const rows = await db.$queryRaw<{ s: string }[]>`SELECT l.slug || '/' || m.slug AS s FROM "Model" m JOIN "Lab" l ON l.id = m."labId" WHERE m.slug !~ '^[a-z0-9][a-z0-9._-]*$' OR l.slug !~ '^[a-z0-9][a-z0-9._-]*$'`;
const prov = await db.$queryRaw<{ s: string }[]>`SELECT slug AS s FROM "Provider" WHERE slug !~ '^[a-z0-9][a-z0-9._-]*$'`;
const bench = await db.benchmark.findMany({ select: { key: true, name: true, category: true, _count: { select: { scores: true } } }, orderBy: { key: "asc" } });
console.log(rows, prov, bench.map((b) => `${b.key}:${b.category}:${b._count.scores}`).join(" "));
const maxLen = await db.$queryRaw`SELECT max(length(slug)) FROM "Model"`; console.log(maxLen);
await db.$disconnect();
