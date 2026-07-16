import SwaggerParser from '@apidevtools/swagger-parser';
import { openApiPath } from './helpers';

describe('QA OpenAPI validation', () => {
  it('validates openapi/openapi.yaml and counts operations', async () => {
    const api = (await SwaggerParser.validate(openApiPath())) as {
      paths?: Record<string, Record<string, unknown>>;
    };
    expect(api.paths).toBeDefined();
    let ops = 0;
    for (const methods of Object.values(api.paths || {})) {
      for (const m of Object.keys(methods)) {
        if (['get', 'post', 'put', 'patch', 'delete'].includes(m)) ops += 1;
      }
    }
    expect(ops).toBeGreaterThanOrEqual(170);
  });
});
