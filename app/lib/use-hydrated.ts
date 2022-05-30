import * as React from "react";

let _hydrated = false;

export function useHydrated() {
  let [hydrated, setHydrated] = React.useState(_hydrated);
  React.useEffect(() => {
    if (!_hydrated) {
      _hydrated = true;
      setHydrated(true);
    }
  }, []);
  return hydrated;
}
