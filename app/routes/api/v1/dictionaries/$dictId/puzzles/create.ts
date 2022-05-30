import { json } from "@remix-run/node";
import type { ActionFunction } from "@remix-run/node";
import { DEFAULT_DICT_ID } from "~/constants";
import { getDictionary } from "~/lib/dictionaries.server";
import { DateTime } from "~/lib/util.server";
import {
  generatePuzzleFromBasis,
  generateRandomPuzzleBasis,
} from "~/lib/puzzles.server";
import type { PuzzleData } from "~/types";

interface LoaderData extends PuzzleData {}

export const action: ActionFunction = async ({ params, request }) => {
  // TODO: Auth
  let dict = getDictionary(params.dictId || DEFAULT_DICT_ID);
  if (!dict) {
    throw json("List not found", { status: 404 });
  }
  let formData = await request.formData();
  let basisWord = formData.get("basis");
  let puzzleId = formData.get("id");
  let random = formData.get("random");
  if (!puzzleId || typeof puzzleId !== "string") {
    throw json("Missing puzzle id", { status: 400 });
  }
  if (random === "true") {
    basisWord = generateRandomPuzzleBasis(dict);
  }
  if (!basisWord || typeof basisWord !== "string") {
    throw json("Missing basis word", { status: 400 });
  }

  try {
    let puzzle = generatePuzzleFromBasis(basisWord, dict);
    let createdOn = DateTime.now().toISO();

    return json<LoaderData>({
      id: puzzleId,
      createdOn,
      updatedOn: null,
      ...puzzle,
    });
  } catch (err) {
    if (err instanceof Error && err.message) {
      throw json(err.message, { status: 500 });
    }
    if (err instanceof Response) {
      throw err;
    }
    throw json("Something went wrong!", { status: 500 });
  }
};
