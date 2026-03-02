import { ingestAllSources } from "@/lib/ingest/service";

async function main() {
  const results = await ingestAllSources();
  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
