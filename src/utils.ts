export const CACHE_MAX_AGE: string =
  "86400"; /* 60*60*24 = 86400 seconds = 1 day */

export const segments = (req: Request): string[] =>
  decodeURIComponent(new URL(req.url).pathname).split("/");

const DEFAULT_HEADERS = new Headers({
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "deny",
  "Content-Security-Policy": "default-src 'none'",
});

export const headers = (h: HeadersInit = {}): Headers => {
  const headers = new Headers(DEFAULT_HEADERS);
  if (h instanceof Headers) for (const [k, v] of h) headers.set(k, v);
  else if (isIterable(h)) {
    for (const [k, ...vs] of h) {
      for (const v of vs) {
        if (k === undefined) continue;
        headers.append(k, v);
      }
    }
  } else if (typeof h === "object") {
    for (const k in h) {
      if (Object.prototype.hasOwnProperty.call(h, k)) {
        const v = h[k];
        if (typeof v === "string") headers.set(k, v);
      }
    }
  } else throw new TypeError("Unsupported HeadersInit");
  return headers;
};

export type Origins = (string | URL)[] | "*";
export function checkOriginHeader(
  h: Headers,
  allowed_origins: Origins,
): ResponseInit & { headers?: Headers } {
  if (typeof allowed_origins === "string") {
    return {
      status: HTTP_STATUS.OK,
      headers: headers({ "Access-Control-Allow-Origin": allowed_origins }),
    };
  }
  const origin = h.get("Origin");
  if (origin === null) return { status: HTTP_STATUS.FORBIDDEN };
  for (const o of allowed_origins) {
    const o_str: string = typeof o === "string" ? o : o.toString();
    if (o_str === origin) {
      return {
        status: HTTP_STATUS.OK,
        headers: headers({
          "Access-Control-Allow-Origin": origin,
          "Vary": "Origin",
        }),
      };
    }
  }
  return { status: HTTP_STATUS.FORBIDDEN };
}

const isIterable = (value: any): value is Iterable<unknown> =>
  typeof value[Symbol.iterator] === "function";
