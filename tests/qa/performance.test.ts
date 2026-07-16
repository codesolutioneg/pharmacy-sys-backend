import { adminLogin, auth, getApp, request } from './helpers';

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)]!;
}

describe('QA Performance', () => {
  let token = '';
  beforeAll(async () => {
    token = (await adminLogin()).accessToken;
  });

  it('dashboard summary p95 under 2000ms (20 calls)', async () => {
    const times: number[] = [];
    for (let i = 0; i < 20; i += 1) {
      const start = Date.now();
      const res = await request(getApp()).get('/api/v1/dashboard/summary').set(auth(token));
      expect(res.status).toBe(200);
      times.push(Date.now() - start);
    }
    const p95 = percentile(times, 95);
    // eslint-disable-next-line no-console
    console.log(`dashboard p95=${p95}ms avg=${Math.round(times.reduce((a, b) => a + b, 0) / times.length)}ms`);
    expect(p95).toBeLessThan(2000);
  });

  it('10 concurrent medicine list requests succeed', async () => {
    const app = getApp();
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        request(app).get('/api/v1/medicines').query({ limit: 50 }).set(auth(token)),
      ),
    );
    expect(results.every((r) => r.status === 200)).toBe(true);
  });
});
