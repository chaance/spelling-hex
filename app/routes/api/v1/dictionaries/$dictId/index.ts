import { json } from "@remix-run/node";
import type { LoaderFunction } from "@remix-run/node";
import type { DictionaryReference } from "~/types";
import { getCacheControl } from "~/lib/util";
import { DEFAULT_DICT_ID } from "~/constants";
import { getDictionary } from "~/lib/dictionaries.server";

const SECONDS_PER_DAY = 24 * 60 * 60;
type LoaderData = DictionaryReference;

export let loader: LoaderFunction = async ({ params }) => {
  let dict = getDictionary(params.dictId || DEFAULT_DICT_ID);
  if (!dict) {
    throw json("List not found", { status: 404 });
  }

  let { solver, ...serializable } = dict;

  return json<LoaderData>(serializable, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": getCacheControl({
        "max-age": SECONDS_PER_DAY * 365,
        immutable: true,
      }),
    },
  });
};
