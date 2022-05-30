import {
  ALPHABET_START_CHAR_CODE,
  ALPHABET_END_CHAR_CODE,
  MINIMUM_WORD_LENGTH,
  TOTAL_UNIQUE_LETTERS,
} from "~/constants";
import { popCount, stringToVector } from "~/lib/util";
import type { CharVec, Puzzle } from "~/types";

export class PuzzleSolver {
  words: string[];
  wordsByVector: Map<CharVec, string[]>;
  pots: Set<CharVec>;

  constructor(words: string[]) {
    this.words = [];
    this.wordsByVector = new Map();
    this.pots = new Set();
    outer: for (let word of words) {
      if (word.length < MINIMUM_WORD_LENGTH) {
        continue;
      }
      for (let i = 0; i < word.length; i++) {
        let c = word.charCodeAt(i);
        if (c < ALPHABET_START_CHAR_CODE || c > ALPHABET_END_CHAR_CODE) {
          continue outer;
        }
      }
      let vec: CharVec = stringToVector(word);
      let distinctLetterCount: number = popCount(vec);
      if (distinctLetterCount > TOTAL_UNIQUE_LETTERS) {
        continue;
      }
      this.words.push(word);
      let bucket = this.wordsByVector.get(vec);
      if (bucket == null) {
        bucket = [];
        this.wordsByVector.set(vec, bucket);
      }
      bucket.push(word);
      if (distinctLetterCount === TOTAL_UNIQUE_LETTERS) {
        this.pots.add(vec); // may be redundant; no problem
      }
    }
  }

  solutionsTo(puzzle: Puzzle): Set<string> {
    let result: Set<string> = new Set();
    this._addSolutions(result, puzzle.required, puzzle.optional);
    return result;
  }

  _addSolutions(result: Set<string>, required: CharVec, optional: CharVec) {
    if (!optional) {
      let bucket = this.wordsByVector.get(required);
      if (bucket) {
        for (let solution of bucket) {
          result.add(solution);
        }
      }
    } else {
      let oneHot: CharVec = optional & -optional;
      let nextOptional: CharVec = optional ^ oneHot;
      this._addSolutions(result, required, nextOptional);
      this._addSolutions(result, required | oneHot, nextOptional);
    }
  }
}
