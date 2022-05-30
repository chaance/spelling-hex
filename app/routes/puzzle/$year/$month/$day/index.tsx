import * as React from "react";
import { json } from "@remix-run/node";
import type { LoaderFunction } from "@remix-run/node";
import {
  useLoaderData,
  useCatch,
  useActionData,
  useFetchers,
} from "@remix-run/react";
import { DateTime } from "~/lib/util.server";
import type { DateTime as LuxonDateTime } from "luxon";
import { DEFAULT_DICT_ID } from "~/constants";
import { getCacheControl } from "~/lib/util";
import type { PuzzleData } from "~/types";
import { getDictionary } from "~/lib/dictionaries.server";
import { generateRandomPuzzleBasis } from "~/lib/puzzles.server";
import { getPuzzle, createPuzzle } from "~/db.server";
import { PuzzleGame } from "~/ui/puzzle-game";
import { Container } from "~/ui/container";

interface LoaderData {
  puzzleData: PuzzleData;
  date: {
    year: string;
    month: string;
    day: string;
  };
}

interface ActionData {
  puzzleData: PuzzleData;
}

export const loader: LoaderFunction = async ({ params }) => {
  let { day, month, year } = params;
  if (!day || !month || !year) {
    throw json(
      `Missing date data: ${[!day && "day", !month && "month", !year && "year"]
        .filter(Boolean)
        .join(", ")}`,
      400
    );
  }

  if (day.length === 1) day = `0${day}`;
  if (month.length === 1) month = `0${month}`;
  if (year.length === 2) year = `20${year}`;
  let requestedDate = getDateFromParams({ day, month, year });

  let puzzleId = `${year}-${month}-${day}`;
  let headers = {
    "Content-Type": "application/json",
    "Cache-Control": getCacheControl({
      "max-age": 60 * 5,
    }),
  };

  // Check our db for existing puzzle data
  let puzzleData = await getPuzzle(puzzleId);
  let date = { month, year, day };
  if (puzzleData) {
    return json<LoaderData>({ puzzleData, date }, { headers });
  } else {
    try {
      // TODO: Fetch from resource route instead
      let dict = getDictionary(DEFAULT_DICT_ID)!;
      let puzzleData = await createPuzzle(
        dict,
        generateRandomPuzzleBasis(dict),
        requestedDate,
        puzzleId
      );
      return json<LoaderData>({ puzzleData, date }, { headers });
    } catch (e) {
      if (e && typeof e === "object" && e instanceof Response) {
        throw e;
      }
      if (e instanceof Error && e.message) {
        throw json(e.message, 500);
      }
      console.error(e);
      throw json("Something went wrong while fetching words", 500);
    }
  }
};

export default function PuzzleRoute() {
  let { puzzleData } = useLoaderData() as LoaderData;
  let actionData = useActionData() as ActionData;
  let fetchers = useFetchers();

  let fetcher: typeof fetchers[number] | null = null;
  for (let fetcha of fetchers) {
    if (fetcha.data) {
      fetcher = fetcha;
    }
  }

  let {
    createdOn,
    updatedOn,
    distinctLetters,
    optionalLetters,
    basisWord,
    requiredLetter,
    dictionaryId,
    solutions,
    id,
  } =
    (fetcher?.data as undefined | ActionData)?.puzzleData ||
    actionData?.puzzleData ||
    puzzleData;

  return (
    <Container className="route--puzzle__body-container">
      <div className="puzzle-screen">
        <PuzzleGame
          basisWord={basisWord}
          dictionaryId={dictionaryId}
          distinctLetters={distinctLetters}
          requiredLetter={requiredLetter}
          optionalLetters={optionalLetters}
          solutions={solutions}
          id={id}
          createdOn={createdOn}
          updatedOn={updatedOn}
        />
      </div>
    </Container>
  );
}

// export function ErrorBoundary() {}

export function CatchBoundary() {
  let caught = useCatch();
  console.error(caught);
  return <p>Damn</p>;
}

function getDateFromParams({
  day,
  month,
  year,
}: {
  day: string;
  month: string;
  year: string;
}) {
  let requestedDate: LuxonDateTime;
  try {
    requestedDate = DateTime.fromObject({
      day: parseInt(day, 10),
      month: parseInt(month, 10),
      year: parseInt(year, 10),
    });
    if (!requestedDate.isValid) {
      throw Error();
    }
  } catch (e) {
    throw json("Invalid date", 400);
  }

  if (requestedDate.year < 2022 || requestedDate.year > 2099) {
    throw json("Date must be between 2022 and 2099", 400);
  }

  let now = DateTime.now();

  if (
    requestedDate.startOf("day") > now.startOf("day") &&
    !now.hasSame(requestedDate, "day")
  ) {
    throw json("Date too late", 400);
  }
  return requestedDate;
}
