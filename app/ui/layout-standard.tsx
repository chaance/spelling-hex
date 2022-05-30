import * as React from "react";
import cx from "clsx";

export function LayoutStandard({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) {
  return <div className={cx(className, "ui--layout-standard")}>{children}</div>;
}

export function LayoutStandardBody({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div className={cx(className, "ui--layout-standard__body")}>{children}</div>
  );
}

export function LayoutStandardHeader({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div className={cx(className, "ui--layout-standard__header")}>
      {children}
    </div>
  );
}

export function LayoutStandardFooter({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div className={cx(className, "ui--layout-standard__footer")}>
      {children}
    </div>
  );
}
