import * as React from "react";
import { json } from "@remix-run/node";
import type { LoaderFunction } from "@remix-run/node";
import { getCacheControl } from "~/lib/util";
import { SECONDS_PER_DAY } from "~/constants";
import { Container } from "~/ui/container";

export const loader: LoaderFunction = async () => {
  return json<null>(null, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": getCacheControl({
        "max-age": 60 * 5,
        "stale-while-revalidate": SECONDS_PER_DAY * 7,
      }),
    },
  });
};

export default function Index() {
  return (
    <Container>
      <h1>Welcome to the Spelling Hex</h1>
    </Container>
  );
}
