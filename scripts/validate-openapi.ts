import path from 'path';
import SwaggerParser from '@apidevtools/swagger-parser';

async function main(): Promise<void> {
  const file = path.join(__dirname, '../openapi/openapi.yaml');
  const api = (await SwaggerParser.validate(file)) as {
    paths?: Record<string, Record<string, unknown>>;
  };
  let ops = 0;
  for (const methods of Object.values(api.paths || {})) {
    for (const m of Object.keys(methods)) {
      if (['get', 'post', 'put', 'patch', 'delete'].includes(m)) ops += 1;
    }
  }
  // eslint-disable-next-line no-console
  console.log(`OpenAPI valid. operations=${ops}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
