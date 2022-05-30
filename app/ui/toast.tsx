import * as React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";

//type ProviderProps = React.ComponentProps<typeof ToastPrimitive.Provider>;
export const ToastProvider = ToastPrimitive.Provider;

interface ToastProps {
  message: string;
  open?: boolean;
  setOpen?(o: boolean): void;
  title: string;
}

export interface ToastHandle {
  publish(): void;
}

const Toast = React.forwardRef<ToastHandle, ToastProps>(
  (props, forwardedRef) => {
    let { message, open, setOpen, title } = props;
    let [count, setCount] = React.useState(0);

    React.useImperativeHandle(forwardedRef, () => ({
      publish() {
        setCount((c) => c + 1);
      },
    }));

    return (
      <>
        {Array.from({ length: count }).map((_, index, arr) => {
          return (
            <ToastPrimitive.Root
              key={index}
              open={index === arr.length - 1 ? open : false}
              onOpenChange={setOpen}
              className="ui--toast"
            >
              <ToastPrimitive.Title className="ui--toast__title">
                {title}
              </ToastPrimitive.Title>
              <ToastPrimitive.Description asChild>
                <p className="ui--toast__description">{message}</p>
              </ToastPrimitive.Description>
              <ToastPrimitive.Action asChild altText="Dismiss">
                <button className="ui--toast__action ui--toast__dismiss">
                  <svg
                    aria-hidden
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    width={24}
                    height={24}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="sr-only">Dismiss</span>
                </button>
              </ToastPrimitive.Action>
            </ToastPrimitive.Root>
          );
        })}
        <ToastPrimitive.Viewport className="ui--toast__viewport" />
      </>
    );
  }
);
Toast.displayName = "Toast";
export { Toast };
