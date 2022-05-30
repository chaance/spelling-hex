import { json } from "@remix-run/node";
import type { ActionFunction } from "@remix-run/node";
import { shuffle } from "~/lib/util";
import type { PuzzleData } from "~/types";
import { getPuzzle, updatePuzzle } from "~/db.server";

interface ActionData {
  puzzleData: PuzzleData;
}

export const action: ActionFunction = async ({ request }) => {
  console.log("SHUFFLING");

  let formData = await request.formData();
  let puzzleId = formData.get("puzzle_id");

  if (!puzzleId || typeof puzzleId !== "string") {
    throw json("Missing puzzle ID", 400);
  }
  let puzzle = await getPuzzle(puzzleId);
  if (!puzzle) {
    throw json("Puzzle not found", 404);
  }
  let optionalLetters = shuffle(puzzle.optionalLetters);
  try {
    let puzzleData = await updatePuzzle(puzzleId, {
      optionalLetters,
    });
    if (!puzzleData) {
      throw json("Something went wrong updating the puzzle", 500);
    }
    return json<ActionData>({ puzzleData });
  } catch (err) {
    throw json("Something went wrong", 500);
  }
};
