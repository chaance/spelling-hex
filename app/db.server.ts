import * as path from "path";
import * as fs from "fs";
import { json } from "@remix-run/node";
import { isPuzzleData, popCount, stringToVector } from "~/lib/util";
import type { DictionaryReferenceWithSolver, PuzzleData } from "~/types";
import { generatePuzzleFromBasis } from "~/lib/puzzles.server";
import { ensureDir, DateTime } from "~/lib/util.server";
import type { DateTime as LuxonDateTime } from "luxon";
import { TOTAL_UNIQUE_LETTERS } from "~/constants";
import { getDictionary } from "./lib/dictionaries.server";

const DATA_PATH = path.join(__dirname, "../data/puzzles");

export async function getPuzzles(limit = 7) {
  let puzzleFiles = await fs.promises.readdir(DATA_PATH);
  let puzzles: PuzzleData[] = [];
  let count = 0;
  for (let fileName of puzzleFiles) {
    if (count >= limit) {
      break;
    }

    let file = path.resolve(DATA_PATH, fileName);
    if (fs.lstatSync(file).isDirectory()) {
      continue;
    }
    if (path.extname(file) === ".json") {
      let puzzleData = await fs.promises.readFile(file, "utf8");
      let puzzle = JSON.parse(puzzleData);
      if (isPuzzleData(puzzle)) {
        puzzles.push(puzzle);
        count++;
      }
    }
  }
  return puzzles;
}

export async function getPuzzle(id: string) {
  let filePath = path.join(DATA_PATH, `${id}.json`);
  if (fs.existsSync(filePath)) {
    try {
      let data = JSON.parse(await fs.promises.readFile(filePath, "utf8"));
      if (isPuzzleData(data)) {
        return data;
      } else {
        throw Error();
      }
    } catch (_) {
      console.error(
        "The data file exists but the data is invalid. Generating a new puzzle and overwriting the file"
      );
      return null;
    }
  }
  return null;
}

export async function createPuzzle(
  dictionary: DictionaryReferenceWithSolver,
  basisWord: string,
  date: LuxonDateTime,
  // TODO: Remove when this is generated
  puzzleId: string
) {
  let puzzleData = generatePuzzleFromBasis(basisWord, dictionary);
  (puzzleData as PuzzleData).id = puzzleId;
  (puzzleData as PuzzleData).createdOn = date.toISO();
  (puzzleData as PuzzleData).updatedOn = null;
  if (!isPuzzleData(puzzleData)) {
    throw json("Invalid puzzle data", 500);
  }
  let filePath = path.join(DATA_PATH, `${puzzleId}.json`);
  await ensureDir(path.dirname(filePath));
  await fs.promises.writeFile(filePath, JSON.stringify(puzzleData));
  return puzzleData;
}

export async function updatePuzzle(
  id: PuzzleData["id"],
  updateData:
    | { basisWord: PuzzleData["basisWord"] }
    | {
        requiredLetter?: PuzzleData["requiredLetter"];
        optionalLetters?: PuzzleData["optionalLetters"];
      }
): Promise<PuzzleData | null> {
  let puzzleId = id;
  let existingPuzzle = await getPuzzle(puzzleId);
  if (!existingPuzzle) {
    return null;
  }
  let filePath = path.join(DATA_PATH, `${puzzleId}.json`);

  if ("basisWord" in updateData) {
    if (!updateData.basisWord) {
      console.error("Missing basis word");
      return null;
    }
    let vector = stringToVector(updateData.basisWord.toLowerCase());
    let distinctLetterCount = popCount(vector);
    if (distinctLetterCount !== TOTAL_UNIQUE_LETTERS) {
      console.error(
        `Invalid basis word: ${updateData.basisWord}. This word has ${distinctLetterCount} distint letters, but the puzzle must have ${TOTAL_UNIQUE_LETTERS}.`
      );
      return null;
    }
    if (updateData.basisWord === existingPuzzle.basisWord) {
      return existingPuzzle;
    }
    try {
      let dictionary = getDictionary(existingPuzzle.dictionaryId)!;
      let newPuzzle = generatePuzzleFromBasis(updateData.basisWord, dictionary);
      let dateTime = DateTime.now();
      let puzzleData: PuzzleData = {
        ...newPuzzle,
        id: puzzleId,
        createdOn: existingPuzzle.createdOn,
        updatedOn: dateTime.toISO?.() || "",
      };
      await fs.promises.writeFile(filePath, JSON.stringify(puzzleData));
      return puzzleData;
    } catch (err) {
      if (err instanceof Error && err.message) {
        console.error(err);
      }
      return null;
    }
  }

  let requiredLetter = existingPuzzle.requiredLetter;
  let optionalLetters = existingPuzzle.optionalLetters;
  if ("requiredLetter" in updateData) {
    if (!updateData.requiredLetter) {
      console.error("Missing required letter");
      return null;
    }
    if (!existingPuzzle.basisWord.includes(updateData.requiredLetter)) {
      console.error(
        "Invalid required letter. Required letter must be in the basis word"
      );
      return null;
    }
    requiredLetter = updateData.requiredLetter;
  }

  if ("optionalLetters" in updateData) {
    if (!updateData.optionalLetters) {
      console.error("Missing optional letters");
      return null;
    }

    let dataSorted = [...updateData.optionalLetters].sort();
    let existingSorted = [...existingPuzzle.optionalLetters].sort();
    for (let i = 0; i < updateData.optionalLetters.length; i++) {
      let letter = dataSorted[i];
      let compar = existingSorted[i];
      if (letter !== compar) {
        console.error(
          "Invalid optional letters. Optional letters must be a subset of the distinct letters in the basis word and not include the required letter."
        );
        return null;
      }
      if (letter === requiredLetter) {
        console.error(
          "Invalid optional letters. Required letter must not be in the optional letters."
        );
        return null;
      }
    }
    optionalLetters = updateData.optionalLetters;
  }

  let recordData = JSON.parse(
    await fs.promises.readFile(filePath, "utf8")
  ) as PuzzleData;
  recordData.requiredLetter = requiredLetter;
  recordData.optionalLetters = optionalLetters;
  await fs.promises.writeFile(filePath, JSON.stringify(recordData));

  return recordData;
}
