import { ApiError, errorMessage } from './client';
import type { BatchResponse, BatchResults } from './types';

/** 批量接口一次最多收这么多个 */
export const BATCH_LIMIT = 100;

export function chunked<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * 批量接口一次最多 100 个，多了分批发，结果并到一起。
 * 某一批全没成（后端回 400）也记进失败里，后面的批照常发；一个都没成才报错，报的是第一条失败原因。
 */
export async function inBatches<T extends BatchResponse>(ids: number[], send: (chunk: number[]) => Promise<T>): Promise<T> {
  const results: BatchResults = { succeeded: [], failed: [] };
  let last: T | null = null;
  let firstError: unknown = null;
  for (const chunk of chunked(ids, BATCH_LIMIT)) {
    try {
      const res = await send(chunk);
      last = res;
      results.succeeded.push(...(res.results?.succeeded ?? chunk));
      results.failed.push(...(res.results?.failed ?? []));
    } catch (e) {
      firstError ??= e;
      const r = e instanceof ApiError ? (e.details.results as BatchResults | undefined) : undefined;
      if (r?.failed?.length || r?.succeeded?.length) {
        results.succeeded.push(...(r.succeeded ?? []));
        results.failed.push(...(r.failed ?? []));
      } else {
        results.failed.push(...chunk.map((file_id) => ({ file_id, error: errorMessage(e) })));
      }
    }
  }
  if (!results.succeeded.length && firstError) {
    const reason = results.failed[0]?.error;
    if (firstError instanceof ApiError && reason) {
      throw new ApiError(firstError.code, reason, firstError.status, { ...firstError.details, results });
    }
    throw firstError;
  }
  return { ...(last as T), success: !results.failed.length, results };
}
