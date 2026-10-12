/**
 * In-process Postgres (PGlite + pgcrypto) wrapped in the same interface the Worker
 * uses from @neondatabase/serverless: tagged-template queries that run lazily when
 * awaited, `sql.query(text, params)`, and `sql.transaction([...queries])`.
 */
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { handleApi } from '../../src/server/api.js';

function lazyQuery(run, text, params) {
  let promise;
  const exec = () => {
    promise ||= run(text, params);
    return promise;
  };
  return {
    text,
    params,
    then: (resolve, reject) => exec().then(resolve, reject),
    catch: (reject) => exec().catch(reject),
    finally: (fn) => exec().finally(fn),
  };
}

export async function createTestDatabase() {
  const db = await PGlite.create({ extensions: { pgcrypto } });
  let queue = Promise.resolve();
  // PGlite is single-connection; serialise statements like a pool of one.
  const serial = (fn) => {
    const next = queue.then(fn, fn);
    queue = next.catch(() => {});
    return next;
  };
  const run = (text, params) => serial(() => db.query(text, params)).then((r) => r.rows);

  const sql = (strings, ...values) => {
    let text = strings[0];
    values.forEach((_, i) => {
      text += `$${i + 1}${strings[i + 1]}`;
    });
    return lazyQuery(run, text, values);
  };
  sql.query = (text, params = []) => lazyQuery(run, text, params);
  sql.transaction = (queries) => serial(() => db.transaction(async (tx) => {
    const out = [];
    for (const q of queries) out.push((await tx.query(q.text, q.params)).rows);
    return out;
  }));

  return { db, sql, raw: (text, params) => run(text, params) };
}

/** Small client for calling the API like the browser does. */
export function createApiClient(sql, env = {}) {
  let ipCounter = 0;
  async function call(method, path, { body, token, ip } = {}) {
    const headers = { 'cf-connecting-ip': ip || `10.0.0.${(ipCounter += 1) % 250}` };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (token) headers.authorization = `Bearer ${token}`;
    const request = new Request(`http://localhost${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const response = await handleApi(request, env, { sql });
    const data = await response.json();
    return { status: response.status, data };
  }
  return {
    get: (path, opts) => call('GET', path, opts),
    post: (path, body, opts) => call('POST', path, { ...opts, body }),
    patch: (path, body, opts) => call('PATCH', path, { ...opts, body }),
    put: (path, body, opts) => call('PUT', path, { ...opts, body }),
    del: (path, opts) => call('DELETE', path, opts),
  };
}
