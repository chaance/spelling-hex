import * as path from "path";
import * as fs from "fs";
import type {
  DictionaryReference,
  DictionaryReferenceWithSolver,
} from "~/types";
import { PuzzleSolver } from "~/lib/puzzle-solver";
import { json } from "@remix-run/node";

declare global {
  var __dictionaries: Map<string, DictionaryReferenceWithSolver>;
}

const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.resolve(ROOT_DIR, "data");
const dictionaryWordsCache = new Map<string, string[]>();

const dictionaries = getDictionaries();

function getDictionaries() {
  return (
    global.__dictionaries ||
    (global.__dictionaries = (() => {
      return new Map<string, DictionaryReferenceWithSolver>([
        // http://manpages.ubuntu.com/manpages/bionic/man5/american-english.5.html
        [
          "ubuntu-wamerican",
          buildDictionary(
            "ubuntu-wamerican",
            "Ubuntu standard dictionary, American English"
          ),
        ],
      ]);
    })())
  );
}

export function getDictionary(
  id: string
): DictionaryReferenceWithSolver | null {
  if (!dictionaries.has(id)) {
    return null;
  }
  return dictionaries.get(id)!;
}

export function dictionaryExists(id: string): boolean {
  return dictionaries.has(id);
}

function buildDictionary(
  id: string,
  name: string
): DictionaryReferenceWithSolver {
  return {
    id,
    name,
    get words() {
      if (dictionaryWordsCache.has(this.id)) {
        return dictionaryWordsCache.get(this.id)!;
      }
      let filePath = path.resolve(DATA_DIR, "dictionaries", `${this.id}.txt`);
      try {
        return fs.readFileSync(filePath, "utf-8").split("\n");
      } catch (err) {
        console.error(
          `Error getting words from the dictionary "${this.id}".\nCheck to make sure the file exists:\n  ${filePath}`
        );
        console.error("\n----------------------------------------\n");
        throw err;
      }
    },
    // @ts-ignore
    __solver: null,

    get solver() {
      // @ts-expect-error
      if (this.__solver) return this.__solver;
      return ((this as any).__solver = new PuzzleSolver(this.words));
    },
  };
}

export async function fetchDictWithSolver(
  dictionaryId: string
): Promise<DictionaryReferenceWithSolver> {
  if (!process.env.PUBLIC_SITE_URL) {
    console.error("PUBLIC_SITE_URL is not set");
    throw json("Missing request URL", 500);
  }
  let url = `${process.env.PUBLIC_SITE_URL}/dictionaries/${dictionaryId}`;
  let dict: DictionaryReference;
  let res: Response;
  try {
    res = await fetch(url, { method: "GET", headers: {} });
  } catch (err) {
    console.error(err);
    throw json("Could not fetch dictionary", 500);
  }

  if (res.status === 404) {
    throw json("Invalid dictionary ID", 400);
  }
  if (res.status !== 200) {
    throw json("Dictionary fetching failed: " + res.statusText, res.status);
  }

  dict = (await res.json()) as DictionaryReference;
  if (!dict) {
    throw json("Invalid dictionary", 400);
  }

  let solver = new PuzzleSolver(dict.words);

  return {
    ...dict,
    solver,
  };
}
