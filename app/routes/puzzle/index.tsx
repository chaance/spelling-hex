import { redirect, json } from "@remix-run/node";
import type { LoaderFunction } from "@remix-run/node";
import { DateTime } from "~/lib/util.server";

export const loader: LoaderFunction = async () => {
  let now = DateTime.now();
  let [mm, dd, yyyy] = now
    .toLocaleString({
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .split("/");
  return redirect(`/puzzle/${yyyy}/${mm}/${dd}`);
};
