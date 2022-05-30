import type { PuzzleSolver } from "~/lib/puzzle-solver";

export type { PuzzleSolver };

export interface DictionaryReference {
  id: string;
  name: string;
  readonly words: string[];
}

export interface DictionaryReferenceWithSolver extends DictionaryReference {
  solver: PuzzleSolver;
}

export interface PuzzleData {
  createdOn: string;
  updatedOn: string | null;
  id: string;
  basisWord: string;
  distinctLetters: string[];
  optionalLetters: string[];
  requiredLetter: string;
  dictionaryId: DictionaryReference["id"];
  solutions: string[];
}

/**
 * A character vector is a set of characters in the alphabet, stored as a bit
 * vector. Position `i` (zero-indexed from the LSB) is on in the vector if and
 * only if the character of ordinal `i` (zero-indexed from the start of the
 * alphabet) appears in the set. The alphabet consists of those characters from
 * `ALPHABET_START_CHAR_CODE` to `ALPHABET_END_CHAR_CODE`, inclusive.
 */
export type CharVec = number;

/**
 * A Spelling Bee puzzle. The `required` field is the vector of all characters
 * that are required to be in every word (usually just one). The `optional`
 * field is the vector of all characters that are not required, but are allowed
 * to be in any word. These sets should be disjoint: we should have `required &
 * optional === 0`.
 */
export interface Puzzle {
  required: CharVec;
  optional: CharVec;
}

export type Mutable<T> = {
  -readonly [K in keyof T]: T[K];
};

export interface Screens {
  readonly xxs: 480; // 34rem
  readonly xs: 544; // 34rem
  readonly sm: 640; // 40rem
  readonly md: 768; // 48rem
  readonly lg: 1024; // 64rem
  readonly xl: 1280; // 80rem
  readonly "2x": 1536; // 96rem
  readonly "3x": 1920; // 120rem
}
