import fs from "fs";
import { DateTime as LuxonDateTime } from "luxon";
import type {
  DateTimeOptions,
  DateObjectUnits,
  DateTimeJSOptions,
} from "luxon";

export async function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    try {
      await fs.promises.mkdir(dir);
    } catch (_) {}
  }
}

const TIME_ZONE = "America/Los_Angeles";
const LOCALE = "en-US";

export const DateTime = {
  now() {
    return LuxonDateTime.now().setZone(TIME_ZONE).setLocale(LOCALE);
  },
  fromISO(iso: string, opts?: DateTimeOptions) {
    return LuxonDateTime.fromISO(iso, opts)
      .setZone(TIME_ZONE)
      .setLocale(LOCALE);
  },
  fromObject(iso: DateObjectUnits, opts?: DateTimeJSOptions) {
    return LuxonDateTime.fromObject(iso, opts)
      .setZone(TIME_ZONE)
      .setLocale(LOCALE);
  },
};
