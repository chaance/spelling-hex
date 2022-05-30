import { json } from "@remix-run/node";
import type { ActionFunction } from "@remix-run/node";
import { DEFAULT_DICT_ID } from "~/constants";
import { getDictionary } from "~/lib/dictionaries.server";
import { DateTime } from "~/lib/util.server";
import { generateRandomPuzzleBasis } from "~/lib/puzzles.server";
import type { PuzzleData } from "~/types";
import { createPuzzle } from "~/db.server";

interface LoaderData {
  puzzleData: PuzzleData;
}

export const action: ActionFunction = async ({ params, request }) => {
  // TODO: Auth
  let dict = getDictionary(params.dictId || DEFAULT_DICT_ID);
  if (!dict) {
    throw json("List not found", { status: 404 });
  }

  let formData = await request.formData();
  let basisWord = formData.get("basis");
  let puzzleId = formData.get("puzzle_id");
  let createdOn = formData.get("created_on");
  let random = formData.get("random");
  if (random) {
    basisWord = generateRandomPuzzleBasis(dict);
  }

  let now: ReturnType<typeof DateTime["now"]>;
  try {
    now =
      typeof createdOn === "string"
        ? DateTime.fromISO(createdOn)
        : DateTime.now();
  } catch (err) {
    now = DateTime.now();
  }

  if (!puzzleId || typeof puzzleId !== "string") {
    let [mm, dd, yyyy] = now
      .toLocaleString({
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
      .split("/");
    puzzleId = `${yyyy}-${mm}-${String(dd)}`;
  }

  if (!basisWord || typeof basisWord !== "string") {
    throw json("Missing basis word", { status: 400 });
  }

  try {
    // TODO: This is a weird way to check for existence, fix when I bring in a
    // proper db layer
    let puzzleData = await createPuzzle(dict, basisWord, now, puzzleId);
    return json<LoaderData>({ puzzleData });
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
