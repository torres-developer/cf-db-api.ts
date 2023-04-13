"use strict";

import { segments } from "./utils";

export interface Table {
  fetch(req: Request, needle: number, segments?: string[]): Promise<Response>;
}

export default class Database<T extends Table> implements Table {
  #tables: Map<string, T> | undefined;

  constructor(tables?: Map<string, T> | [string, T][]) {
    this.#tables = tables instanceof Map
      ? tables
      : tables?.length
      ? new Map(tables)
      : undefined;
  }

  async fetch(
    req: Request,
    needle: number = 0,
    segs?: string[],
  ): Promise<Response> {
    if (this.#tables === undefined) {
      return new Response(undefined, { status: HTTP_STATUS.NOT_FOUND });
    }

    segs ??= segments(req);
    const seg = segs[needle];

    if (seg === undefined) {
      return new Response(undefined, { status: HTTP_STATUS.NOT_FOUND });
    }

    const table = this.#tables.get(seg);

    return table?.fetch(req, needle + 1, segs) ??
      new Response(undefined, { status: HTTP_STATUS.NOT_FOUND });
  }

  set(k: string, v: T) {
    this.#tables ??= new Map();
    this.#tables.set(k, v);
    return this;
  }

  delete(k: string): boolean {
    return this.#tables?.delete(k) ?? false;
  }

  clear(): void {
    if (this.#tables !== undefined) {
      this.#tables.clear();
    }
  }
}
