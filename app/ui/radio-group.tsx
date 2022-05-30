import * as React from "react";

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(
  null
);

interface RadioGroupContextValue {
  name: string;
  selectedValue: string | null | undefined;
  onChange(value: string): void;
}

function useRadioGroupContext() {
  let ctx = React.useContext(RadioGroupContext);
  if (!ctx) {
    throw new Error("RadioGroupContext not found");
  }
  return ctx;
}

interface RadioGroupProps {
  name: string;
  selectedValue: string | null | undefined;
  onChange(e: string): void;
}

interface RadioProps
  extends Omit<
    React.ComponentPropsWithoutRef<"input">,
    "name" | "type" | "defaultValue" | "value" | "checked" | "defaultChecked"
  > {
  value: string;
}

function RadioGroup({
  name,
  children,
  onChange,
  selectedValue,
  ...rest
}: React.PropsWithChildren<RadioGroupProps>) {
  return (
    <fieldset {...rest}>
      <RadioGroupContext.Provider
        value={{
          name,
          selectedValue,
          onChange,
        }}
      >
        {children}
      </RadioGroupContext.Provider>
    </fieldset>
  );
}

function Radio({
  value,
  // @ts-expect-error
  name: __name,
  // @ts-expect-error
  checked: __checked,
  // @ts-expect-error
  defaultChecked: __defaultChecked,
  // @ts-expect-error
  type: __type,
  // @ts-expect-error
  defaultValue: __defaultValue,
  onChange: onInputChange,
  ...rest
}: RadioProps) {
  let { name, onChange: onValueChange, selectedValue } = useRadioGroupContext();
  return (
    <input
      {...rest}
      type="radio"
      name={name}
      checked={selectedValue === value}
      onChange={(e) => {
        onInputChange?.(e);
        if (!e.defaultPrevented) {
          onValueChange(e.target.value);
        }
      }}
    />
  );
}

export { RadioGroup, Radio, useRadioGroupContext };
export type { RadioGroupProps, RadioProps, RadioGroupContextValue };
