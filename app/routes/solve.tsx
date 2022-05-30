import * as React from "react";
import { json } from "@remix-run/node";
import type { LoaderFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  getCacheControl,
  popCount,
  sanitize,
  stringToVector,
} from "~/lib/util";
import {
  ALPHABET,
  PERFECT_PANGRAM_SCORE,
  TOTAL_UNIQUE_LETTERS,
} from "~/constants";
import type { AlphaChar } from "~/constants";
import type { DictionaryReference } from "~/types";
import { PuzzleSolver } from "~/lib/puzzle-solver";
import { DEFAULT_DICT_ID, SECONDS_PER_DAY } from "~/constants";
import { getDictionary } from "~/lib/dictionaries.server";
import { Container } from "~/ui/container";

interface LoaderData extends DictionaryReference {}

export const loader: LoaderFunction = async ({ context, params, request }) => {
  const BASE_URL = process.env.PUBLIC_SITE_URL;
  if (!BASE_URL) {
    throw json("Cannot find the URL", 500);
  }

  let url = new URL(request.url);
  let searchParams = url.search ? new URLSearchParams(url.search) : null;
  let dictionaryId = searchParams?.get("dictionary") || DEFAULT_DICT_ID;

  let dict = getDictionary(dictionaryId);
  if (!dict) {
    dict = getDictionary(DEFAULT_DICT_ID)!;
  }

  return json<LoaderData>(dict, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": getCacheControl({
        "max-age": 60 * 5,
        "stale-while-revalidate": SECONDS_PER_DAY * 7,
      }),
    },
  });
};

// export const action: ActionFunction = async ({ context, params, request }) => {
//   let puzzleSolver = React.useMemo(
//     () => new PuzzleSolver(dictionary.words),
//     [dictionary.words]
//   );
// };

export default function Solve() {
  let dictionary = useLoaderData() as LoaderData;

  let [{ revealed, optional, required }, setSolutionsState] = React.useState({
    required: "",
    optional: "",
    revealed: false,
  });

  let [optionalField, setOptionalField] = React.useState("");

  let puzzleSolver = React.useMemo(
    () => new PuzzleSolver(dictionary.words),
    [dictionary.words]
  );

  let puzzle = {
    required: stringToVector(required),
    optional: stringToVector(optional),
  };
  let solutions = Array.from(puzzleSolver.solutionsTo(puzzle));

  function cmp(x: string, y: string): 1 | 0 | -1 {
    let bingoX = popCount(stringToVector(x)) >= TOTAL_UNIQUE_LETTERS;
    let bingoY = popCount(stringToVector(y)) >= TOTAL_UNIQUE_LETTERS;
    if (bingoX !== bingoY) {
      return bingoX ? -1 : 1;
    }
    return x > y ? 1 : x < y ? -1 : 0;
  }

  function score(x: string) {
    return popCount(stringToVector(x)) >= TOTAL_UNIQUE_LETTERS
      ? PERFECT_PANGRAM_SCORE
      : 1;
  }

  function solutionEntry(word: string) {
    let name = score(word) > 1 ? <strong>{word}</strong> : word;
    let definitionLink = (
      <a
        href={`https://www.thefreedictionary.com/${word}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        {name}
      </a>
    );
    return (
      <li key={word}>
        {definitionLink} ({score(word)})
      </li>
    );
  }

  let totalScore = solutions
    .map((x: any) => score(x))
    .reduce((x, y) => x + y, 0);

  return (
    <Container style={{ padding: "3rem 0" }}>
      <h3>Specify puzzle</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          let form = e.target as HTMLFormElement;
          let data = new FormData(form);
          let optionalField = data.get("optional") as string;
          let requiredField = data.get("required") as string;

          if (optionalField) {
            optionalField = sanitize(optionalField)
              .toUpperCase()
              .replace(/[^A-Z]/g, "");
          } else {
            optionalField = optional;
          }

          if (
            requiredField &&
            ALPHABET.includes(requiredField.toUpperCase() as AlphaChar)
          ) {
            requiredField = requiredField.toUpperCase() as AlphaChar;
          } else {
            requiredField = required;
          }

          setSolutionsState({
            optional: optionalField,
            required: requiredField,
            revealed: true,
          });
        }}
      >
        <ul>
          <li>
            <label>
              Required letter:{" "}
              <select
                name="required"
                value={required}
                onChange={(e) => {
                  let value = e.target.value;
                  if (ALPHABET.includes(value.toUpperCase() as AlphaChar)) {
                    setSolutionsState((state) => ({
                      optional: state.optional,
                      required: value,
                      revealed: false,
                    }));
                  }
                }}
              >
                <option disabled>Select an option</option>
                {ALPHABET.map((letter) => (
                  <option value={letter} key={letter}>
                    {letter.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
          </li>
          <li>
            <label>
              Optional letters:{" "}
              <input
                name="optional"
                min={6}
                max={6}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                // value={optional}
                value={optionalField}
                onChange={(e) => {
                  setOptionalField(e.target.value);
                }}
                key={optional}
                onBlur={(e) => {
                  let value = sanitize(e.target.value)
                    .toUpperCase()
                    .replace(/[^A-Z]/g, "");
                  setSolutionsState((state) => ({
                    required: state.required,
                    revealed: state.revealed,
                    optional: value,
                  }));
                }}
              />
            </label>
          </li>
        </ul>
        <button type="submit">Reveal solutions</button>
      </form>
      {revealed ? (
        <div>
          <h3>Solutions</h3>
          {solutions.length > 0 ? (
            <p>Words ({solutions.length} total):</p>
          ) : (
            <p>No valid solutions.</p>
          )}
          <ul style={{ lineHeight: 1.2 }}>
            {(solutions as any[]).sort(cmp).map((word) => solutionEntry(word))}
          </ul>
          <p>Total score: {totalScore}.</p>
        </div>
      ) : null}
    </Container>
  );
}
