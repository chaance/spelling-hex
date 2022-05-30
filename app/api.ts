import { getCacheControl } from "~/lib/util";
import type { DictionaryReference } from "~/types";
import { SECONDS_PER_DAY } from "~/constants";

// const BASE_URL = process.env.PUBLIC_SITE_URL;
// if (!BASE_URL) {
//   throw Error("Cannot find process.env.BASE_URL");
// }

export class API {
  baseUrl: string;
  requestUrl: string;
  readonly url: string;
  readonly version = 1;
  headers!: HeadersInit;

  constructor({
    baseUrl,
    requestUrl,
    headers,
  }: {
    baseUrl: string;
    requestUrl: string;
    headers?: HeadersInit;
  }) {
    try {
      let url = new URL(baseUrl);
      this.baseUrl = url.origin;
    } catch (err) {
      throw Error("Invalid baseUrl provided.");
    }
    this.url = `${this.baseUrl}/api/v${this.version}`;
    this.requestUrl = requestUrl;
    this.setHeaders(headers || {});
  }

  setHeaders(headers: HeadersInit) {
    this.headers = headers;
    return this;
  }

  dict() {
    let _this = this;
    return {
      headers: _this.headers,
      setHeaders(headers: HeadersInit) {
        this.headers = headers;
        return this;
      },
      async get(id: string) {
        let url = `${_this.url}/dictionaries/${id}`;
        let res = await fetch(url, { method: "GET", headers: this.headers });
        this.setHeaders(_this.headers);
        return res;
      },
    };
  }

  puzzles() {
    let _this = this;
    return {
      headers: _this.headers,
      setHeaders(headers: HeadersInit) {
        this.headers = headers;
        return this;
      },
      async get(dictId: string, puzzleId: string) {
        let url = `${_this.url}/dictionaries/${dictId}/puzzles/${puzzleId}`;
        let res = await fetch(url, { method: "GET", headers: this.headers });
        this.setHeaders(_this.headers);
        return res;
      },
      async create(dictId: string, basisWord: string) {
        // TODO: Auth, ID generation
        let puzzleId: string = String(Math.random());
        let search = `?basis=${basisWord}&id=${puzzleId}`;
        let body = new URLSearchParams(search);
        let url = `${_this.url}/dictionaries/${dictId}/puzzles/${puzzleId}/create`;
        let res = await fetch(url, {
          method: "POST",
          body,
          headers: this.headers,
        });
        this.setHeaders(_this.headers);
        return res;
      },
    };
  }
}
