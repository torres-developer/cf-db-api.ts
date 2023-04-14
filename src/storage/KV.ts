"use strict";

import type { Table } from "./Storage";

import {
  CACHE_MAX_AGE,
  checkOriginHeader,
  headers,
  type Origins,
  segments,
} from "../utils";

type Value = string | ArrayBuffer | ArrayBufferView | ReadableStream;

export class KV<Key extends string = string> implements Table {
  readonly #kv: KVNamespace<Key>;
  readonly #allowed_origins: Origins;

  constructor(kv: KVNamespace<Key>, origins: Origins = "*") {
    this.#kv = kv;
    this.#allowed_origins = origins;
  }

  async fetch(
    req: Request,
    needle: number = 0,
    segs?: string[],
  ): Promise<Response> {
    const res = checkOriginHeader(req.headers, this.#allowed_origins);

    if (
      (res.status === undefined) || (res.status < 200 && res.status >= 400)
    ) {
      return new Response(undefined, res);
    }

    segs ??= segments(req);

    const k = <Key> segs[needle];

    switch (req.method) {
      case "GET":
        if (!k) {
          res.status = HTTP_STATUS.BAD_REQUEST;
          return new Response(undefined, res);
        }

        const { value, metadata } = await this.get(k);

        res.headers ??= headers();
        res.headers.set(
          "Content-Type",
          metadata ? metadata : MIME.OCTET_STREAM,
        );

        return new Response(value, res);
      case "POST":
        if (!k) {
          res.status = 400;
          return new Response(undefined, res);
        }

        const ct = req.headers.get("Content-Type");
        if (ct !== MIME.X_WWW_FORM_URLENCODED && ct !== MIME.FORM_DATA) {
          res.status = 415;

          res.headers ??= headers();
          res.headers.append("Accept", MIME.X_WWW_FORM_URLENCODED);
          res.headers.append("Accept", MIME.FORM_DATA);

          return new Response(undefined, res);
        }

        const body = await req.formData();

        let v: Value | null = body.get("value");
        if (v === null) {
          res.status = 400;
          return new Response(undefined, res);
        }

        let type: MIME = MIME.PLAIN;
        for (const i of body.values()) {
          if (i instanceof File) {
            if (v === await i.text()) {
              v = i.stream();
              type = <MIME> i.type;
              break;
            }
          } else if (v === i) break;
        }

        const exp = body.get("expiration");

        const opts: KVNamespacePutOptions = { metadata: type };

        if (exp !== null) opts.expiration = parseInt(exp, 10);

        this.put(k, v, opts);

        return new Response(undefined, res);
      case "OPTIONS":
        res.headers ??= headers();
        res.headers.append("Access-Control-Allow-Methods", "GET");
        res.headers.append("Access-Control-Allow-Methods", "POST");
        res.headers.append("Access-Control-Allow-Methods", "OPTIONS");
        res.headers.append("Access-Control-Max-Age", CACHE_MAX_AGE);

        return new Response(undefined, res);
      default:
        res.status = HTTP_STATUS.METHOD_NOT_ALLOWED;

        return new Response(undefined, res);
    }
  }

  async get(
    k: Key,
  ): Promise<KVNamespaceGetWithMetadataResult<ReadableStream, MIME>> {
    return this.#kv.getWithMetadata<MIME>(k, "stream");
  }

  async put(
    k: Key,
    v: Value,
    opts: KVNamespacePutOptions = {},
  ): Promise<void> {
    return this.#kv.put(k, v, opts);
  }
}
