import * as React from "react";
import cx from "clsx";
import type { Screens } from "~/types";

const Container = React.forwardRef<HTMLDivElement, ContainerProps>(
  ({ children, className, screenDown, screen, ...props }, forwardedRef) => {
    return (
      <div
        className={cx(className, {
          "ui--container": !(screenDown != null || screen != null),
          [`${screenDown}-down:ui--container`]: screenDown != null,
          [`${screen}:ui--container`]: screen != null,
        })}
        ref={forwardedRef}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Container.displayName = "Container";

type ContainerProps = React.ComponentPropsWithRef<"div"> &
  (
    | { screen?: keyof Screens; screenDown?: never }
    | { screenDown?: Omit<keyof Screens, "3xl">; screen?: never }
  );

export type { ContainerProps };
export { Container };
