import { MINIMUM_WORD_LENGTH, TOTAL_UNIQUE_LETTERS } from "~/constants";
import { popCount, shuffle, stringToVector } from "~/lib/util";
import { PuzzleSolver } from "~/lib/puzzle-solver";
import { DateTime } from "luxon";
import type {
  DictionaryReference,
  DictionaryReferenceWithSolver,
  PuzzleData,
} from "~/types";

export function generateRandomPuzzleBasis(
  dictionary: DictionaryReference
): string {
  // instead of looping through a huge list to filter words that don't qualify
  // we'll just snag random words from the dictionary until one matches the
  // criteria
  let word: string | null = null;
  while (!word) {
    let allWords = dictionary.words;
    let rand: string = allWords[Math.floor(Math.random() * allWords.length)];
    let vector = stringToVector(rand);
    if (
      rand.length >= MINIMUM_WORD_LENGTH &&
      popCount(vector) === TOTAL_UNIQUE_LETTERS
    ) {
      word = rand;
    }
  }
  return word.toLowerCase();
}

export function generatePuzzleFromBasis(
  basisWord: string,
  dictionary: DictionaryReferenceWithSolver
): Omit<PuzzleData, "id" | "createdOn" | "updatedOn"> {
  let vector = stringToVector(basisWord.toLowerCase());
  let distinctLetterCount = popCount(vector);
  if (distinctLetterCount !== TOTAL_UNIQUE_LETTERS) {
    throw Error(
      `Invalid basis word: ${basisWord}. This word has ${distinctLetterCount} distint letters, but the puzzle must have ${TOTAL_UNIQUE_LETTERS}.`
    );
  }

  let requiredLetter = basisWord[Math.floor(Math.random() * basisWord.length)];
  let distinctLetters = shuffle([...new Set(basisWord.split(""))]);
  let optionalLetters = distinctLetters.filter(
    (letter) => letter !== requiredLetter
  );
  let solutions = Array.from(
    dictionary.solver.solutionsTo({
      required: stringToVector(requiredLetter),
      optional: stringToVector(optionalLetters.join("")),
    })
  );
  if (solutions.length === 0) {
    throw Error(
      `No solutions found for puzzle with basis word ${basisWord} and required letter ${requiredLetter}.`
    );
  }

  return {
    basisWord,
    distinctLetters,
    optionalLetters,
    requiredLetter,
    // solutions,
    dictionaryId: dictionary.id,
    solutions,
  };
}

export async function generateRandomPuzzle(
  dictionary: DictionaryReferenceWithSolver
): Promise<Omit<PuzzleData, "id" | "createdOn" | "updatedOn">> {
  try {
    let basisWord = generateRandomPuzzleBasis(dictionary);
    return generatePuzzleFromBasis(basisWord, dictionary);
  } catch (err) {
    console.error("Something went wrong while generating the puzzle");
    console.error("\n----------------------------------------------------\n");
    throw err;
  }
}
