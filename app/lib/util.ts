import * as React from "react";
import type { CharVec, DictionaryReference, PuzzleData } from "~/types";
import {
  ALPHABET_END_CHAR_CODE,
  ALPHABET_START_CHAR_CODE,
  MINIMUM_WORD_LENGTH,
} from "~/constants";

export const canUseDOM = !!(
  typeof window !== "undefined" &&
  window.document &&
  window.document.createElement
);

export const useLayoutEffect = canUseDOM
  ? React.useLayoutEffect
  : React.useEffect;

export function sanitize(str: string) {
  let result = "";
  for (let i = 0; i < str.length; i++) {
    let char = str[i].toLowerCase();
    let ordinal = char.charCodeAt(0);
    let c =
      ordinal < ALPHABET_START_CHAR_CODE || ordinal > ALPHABET_END_CHAR_CODE
        ? null
        : char;

    if (c != null) {
      result += c;
    }
  }
  return result;
}

/**
 * @see https://www.felixcloutier.com/x86/popcnt
 */
export function popCount(x: number): number {
  x = (x & 0x55555555) + ((x >> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >> 2) & 0x33333333);
  x = (x & 0x0f0f0f0f) + ((x >> 4) & 0x0f0f0f0f);
  x = (x & 0x00ff00ff) + ((x >> 8) & 0x00ff00ff);
  x = (x & 0x0000ffff) + (x >> 16);
  return x;
}

/**
 * @see http://fpgacpu.ca/fpga/Bitmask_Next_with_Constant_Popcount_ntz.html
 */
export function ntz(x: number): number {
  return popCount(~x & (x - 1));
}

/**
 * Convert a string to the character vector for its character set.
 */
export function stringToVector(s: string): CharVec {
  let result = 0;
  for (let i = 0; i < s.length; i++) {
    let ordinal = s.charCodeAt(i) - ALPHABET_START_CHAR_CODE;
    result |= 1 << ordinal;
  }
  return result;
}

/**
 * Convert a character vector to a representative string with the character set
 * represented by the vector. The resulting string's characters will be distinct
 * and in sorted order.
 */
export function vectorToString(v: CharVec): string {
  const chars: string[] = [];
  while (v) {
    const i = v & -v;
    const ordinal = ntz(i);
    chars.push(String.fromCharCode(ALPHABET_START_CHAR_CODE + ordinal));
    v ^= i;
  }
  return chars.join("");
}

export function getCacheControl(directives: Directives): string {
  let parts: string[] = [];
  for (let key in directives) {
    let outKey = key; // TODO: normalize
    let value = directives[key as keyof Directives];
    if (value === true) {
      parts.push(outKey);
    } else if (value !== false && value != null) {
      parts.push(`${outKey}=${value}`);
    }
  }
  return parts.join(", ");
}

interface Directives {
  /**
   * The `max-age=N` response directive indicates that the response remains
   * fresh until *N* seconds after the response is generated.
   *
   * Indicates that caches can store this response and reuse it for subsequent
   * requests while it's fresh.
   *
   * Note that `max-age` is not the elapsed time since the response was
   * received; it is the elapsed time since the response was generated on the
   * origin server. So if the other cache(s) — on the network route taken by the
   * response — store the response for 100 seconds (indicated using the `Age`
   * response header field), the browser cache would deduct 100 seconds from its
   * freshness lifetime.
   *
   * ```http
   * Cache-Control: max-age=604800
   * Age: 100
   * ```
   */
  "max-age"?: number;

  /**
   * The `stale-while-revalidate` response directive indicates that the cache
   * could reuse a stale response while it revalidates it to a cache.
   *
   * ```http
   * Cache-Control: max-age=604800, stale-while-revalidate=86400
   * ```
   *
   * In the example above, the response is fresh for 7 days (604800s). After 7
   * days it becomes stale, but the cache is allowed to reuse it for any
   * requests that are made in the following day (86400s), provided that they
   * revalidate the response in the background.
   *
   * Revalidation will make the cache be fresh again, so it appears to clients
   * that it was always fresh during that period — effectively hiding the
   * latency penalty of revalidation from them.
   *
   * If no request happened during that period, the cache became stale and the
   * next request will revalidate normally.
   */
  "stale-while-revalidate"?: number;

  /**
   * The `stale-if-error` response directive indicates that the cache can reuse
   * a stale response when an origin server responds with an error (500, 502,
   * 503, or 504).
   *
   * ```http
   * Cache-Control: max-age=604800, stale-if-error=86400
   * ```
   *
   * In the example above, the response is fresh for 7 days (604800s). After 7
   * days it becomes stale, but it can be used for an extra 1 day (86400s) if
   * the server responds with an error.
   *
   * After a period of time, the stored response became stale normally. This
   * means that the client will receive an error response as-is if the origin
   * server sends it.
   */
  "stale-if-error"?: number;

  /**
   * The `max-stale=N` request directive indicates that the client allows a
   * stored response that is stale within *N* seconds.
   *
   * ```http
   * Cache-Control: max-stale=3600
   * ```
   *
   * In the case above, if the response with `Cache-Control: max-age=604800` was
   * generated more than 3 hours ago (calculated from `max-age` and the `Age`
   * header), the cache couldn't reuse that response.
   *
   * Clients can use this header when the origin server is down or too slow and
   * can accept cached responses from caches even if they are a bit old.
   *
   * Note that the major browsers do not support requests with `max-stale`.
   */
  "max-stale"?: number;

  /**
   * The `min-fresh=N` request directive indicates that the client allows a
   * stored response that is fresh for at least *N* seconds.
   *
   * ```http
   * Cache-Control: min-fresh=600
   * ```
   *
   * In the case above, if the response with `Cache-Control: max-age=3600` was
   * stored in caches 51 minutes ago, the cache couldn't reuse that response.
   *
   * Clients can use this header when the user requires the response to not only
   * be fresh, but also requires that it won't be updated for a period of time.
   *
   * Note that the major browsers do not support requests with `min-fresh`.
   */
  "min-fresh"?: number;

  /**
   * The `s-maxage` response directive also indicates how long the response is
   * fresh for (similar to `max-age`) — but it is specific to shared caches, and
   * they will ignore `max-age` when it is present.
   */
  "s-maxage"?: number;

  /**
   * The `no-cache` response directive indicates that the response can be stored
   * in caches, but the response must be validated with the origin server before
   * each reuse, even when the cache is disconnected from the origin server.
   *
   * If you want caches to always check for content updates while reusing stored
   * content, `no-cache` is the directive to use. It does this by requiring
   * caches to revalidate each request with the origin server.
   *
   * Note that `no-cache` does not mean "don't cache". `no-cache` allows caches
   * to store a response but requires them to revalidate it before reuse. If the
   * sense of "don't cache" that you want is actually "don't store", then
   * `no-store` is the directive to use.
   */
  "no-cache"?: boolean;

  /**
   * The `no-store` response directive indicates that any caches of any kind
   * (private or shared) should not store this response.
   */
  "no-store"?: boolean;

  /**
   * Same meaning that `no-transform` has for a response, but for a request
   * instead.
   */
  "no-transform"?: boolean;

  /**
   * The client indicates that cache should obtain an already-cached response.
   * If a cache has stored a response, it's reused.
   */
  "only-if-cached"?: boolean;

  /**
   * The `must-revalidate` response directive indicates that the response can be
   * stored in caches and can be reused while fresh. If the response becomes
   * stale, it must be validated with the origin server before reuse.
   *
   * Typically, `must-revalidate` is used with `max-age`.
   *
   * ```http
   * Cache-Control: max-age=604800, must-revalidate
   * ```
   *
   * HTTP allows caches to reuse stale responses when they are disconnected from
   * the origin server. `must-revalidate` is a way to prevent this from
   * happening — either the stored response is revalidated with the origin
   * server or a 504 (Gateway Timeout) response is generated.
   */
  "must-revalidate"?: boolean;

  /**
   * The `proxy-revalidate` response directive is the equivalent of
   * `must-revalidate`, but specifically for shared caches only.
   */
  "proxy-revalidate"?: boolean;

  /**
   * The `must-understand` response directive indicates that a cache should
   * store the response only if it understands the requirements for caching
   * based on status code.
   *
   * `must-understand` should be coupled with `no-store` for fallback behavior.
   *
   * ```http
   * Cache-Control: must-understand, no-store
   * ```
   *
   * If a cache doesn't support `must-understand`, it will be ignored. If
   * `no-store` is also present, the response isn't stored.
   *
   * If a cache supports `must-understand`, it stores the response with an
   * understanding of cache requirements based on its status code.
   */
  "must-understand"?: boolean;

  /**
   * The `private` response directive indicates that the response can be stored
   * only in a private cache (e.g. local caches in browsers).
   *
   * You should add the `private` directive for user-personalized content,
   * especially for responses received after login and for sessions managed via
   * cookies.
   *
   * If you forget to add `private` to a response with personalized content,
   * then that response can be stored in a shared cache and end up being reused
   * for multiple users, which can cause personal information to leak.
   */
  private?: boolean;

  /**
   * The `public` response directive indicates that the response can be stored
   * in a shared cache. Responses for requests with `Authorization` header
   * fields must not be stored in a shared cache; however, the `public`
   * directive will cause such responses to be stored in a shared cache.
   *
   * In general, when pages are under Basic Auth or Digest Auth, the browser
   * sends requests with the `Authorization` header. This means that the
   * response is access-controlled for restricted users (who have accounts), and
   * it's fundamentally not shared-cacheable, even if it has `max-age`.
   *
   * You can use the `public` directive to unlock that restriction.
   *
   * ```http
   * Cache-Control: public, max-age=604800
   * ```
   *
   * Note that `s-maxage` or `must-revalidate` also unlock that restriction.
   *
   * If a request doesn't have an `Authorization` header, or you are already
   * using `s-maxage` or `must-revalidate` in the response, then you don't need
   * to use `public`.
   */
  public?: boolean;

  /**
   * The `immutable` response directive indicates that the response will not be
   * updated while it's fresh.
   *
   * A modern best practice for static resources is to include version/hashes in
   * their URLs, while never modifying the resources — but instead, when
   * necessary, _updating_ the resources with newer versions that have new
   * version-numbers/hashes, so that their URLs are different. That's called the
   * **cache-busting** pattern.
   *
   * ```html
   * <script src=https://example.com/react.0.0.0.js></script>
   * ```
   *
   * When a user reloads the browser, the browser will send conditional requests
   * for validating to the origin server. But it's not necessary to revalidate
   * those kinds of static resources even when a user reloads the browser,
   * because they're never modified. `immutable` tells a cache that the response
   * is immutable while it's fresh and avoids those kinds of unnecessary
   * conditional requests to the server.
   *
   * When you use a cache-busting pattern for resources and apply them to a long
   * `max-age`, you can also add `immutable` to avoid revalidation.
   */
  immutable?: boolean;
}

export function isDictionaryData(val: any): val is DictionaryReference {
  return (
    val &&
    typeof val === "object" &&
    Array.isArray(val.words) &&
    typeof val.name === "string" &&
    typeof val.id === "string"
  );
}

export function isPuzzleData(val: any): val is PuzzleData {
  return (
    val &&
    typeof val === "object" &&
    typeof val.id === "string" &&
    typeof val.basisWord === "string" &&
    typeof val.createdOn === "string" &&
    // (val.updatedOn == null || typeof val.updatedOn === "string") &&
    val.basisWord.length >= MINIMUM_WORD_LENGTH &&
    typeof val.requiredLetter === "string" &&
    val.requiredLetter.length === 1 &&
    // Array.isArray(val.solutions) &&
    Array.isArray(val.distinctLetters) &&
    Array.isArray(val.optionalLetters)
  );
}

export function shuffle<T extends any[] | ReadonlyArray<any>>(
  array: T
): T[number][] {
  let copy = [...array];
  let currentIndex = array.length;
  let randomIndex: number;

  while (currentIndex != 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [copy[currentIndex], copy[randomIndex]] = [
      copy[randomIndex],
      copy[currentIndex],
    ];
  }
  return copy;
}

export function insertAt<T extends any[], I>(
  array: T,
  item: I,
  index: number
): (T[number] | I)[] {
  return [...array.slice(0, index), item, ...array.slice(index)];
}
