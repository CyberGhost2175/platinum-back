import session from 'express-session';
import Redis from 'ioredis';

type Callback<T = void> = (err?: unknown, result?: T) => void;

export function createRedisSessionStore(
  redis: Redis,
  prefix = 'sess:',
): session.Store {
  return new (class RedisSessionStore extends session.Store {
    get(sid: string, callback: Callback<session.SessionData | null>): void {
      redis
        .get(prefix + sid)
        .then((data) => {
          callback(null, data ? (JSON.parse(data) as session.SessionData) : null);
        })
        .catch((error) => callback(error));
    }

    set(sid: string, sess: session.SessionData, callback?: Callback): void {
      const ttlMs = sess.cookie?.maxAge;
      const ttlSeconds =
        typeof ttlMs === 'number' && ttlMs > 0
          ? Math.ceil(ttlMs / 1000)
          : 86400;

      redis
        .set(prefix + sid, JSON.stringify(sess), 'EX', ttlSeconds)
        .then(() => callback?.())
        .catch((error) => callback?.(error));
    }

    destroy(sid: string, callback?: Callback): void {
      redis
        .del(prefix + sid)
        .then(() => callback?.())
        .catch((error) => callback?.(error));
    }

    touch(sid: string, sess: session.SessionData, callback?: Callback): void {
      const ttlMs = sess.cookie?.maxAge;
      if (typeof ttlMs !== 'number' || ttlMs <= 0) {
        callback?.();
        return;
      }
      redis
        .pexpire(prefix + sid, ttlMs)
        .then(() => callback?.())
        .catch((error) => callback?.(error));
    }
  })();
}
