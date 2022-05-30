import * as React from "react";
import { json } from "@remix-run/node";
import type { LoaderFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { getCacheControl } from "~/lib/util";
import type { PuzzleData } from "~/types";
import { SECONDS_PER_DAY } from "~/constants";
import { Container } from "~/ui/container";
import { getPuzzles } from "~/db.server";
import { DateTime } from "~/lib/util.server";

interface LoaderData {
  puzzles: (PuzzleData & { displayDate: string })[];
}

export const loader: LoaderFunction = async () => {
  try {
    let puzzles = (await getPuzzles(7)).map((puzzle) => {
      let displayDate = DateTime.fromISO(puzzle.createdOn).toLocaleString({
        dateStyle: "medium",
      });
      return {
        ...puzzle,
        displayDate,
      };
    });
    return json<LoaderData>(
      { puzzles },
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": getCacheControl({
            "max-age": 60 * 5,
            "stale-while-revalidate": SECONDS_PER_DAY * 7,
          }),
        },
      }
    );
  } catch (err) {
    if (err instanceof Error && err.message) {
      throw json(err.message, 500);
    }
    throw json("Something went wrong", 500);
  }
};

export default function Archive() {
  let { puzzles } = useLoaderData() as LoaderData;
  return (
    <Container style={{ padding: "3rem 0" }}>
      <article>
        <header>
          <h1>Puzzle Archive</h1>
          <p>Here are the puzzles from the past 7 days</p>
        </header>
        <div>
          {puzzles.map((puzzle) => (
            <div key={puzzle.id}>
              <h2>{puzzle.displayDate}</h2>
            </div>
          ))}
        </div>
      </article>
    </Container>
  );
}
