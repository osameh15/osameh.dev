export type ToastKind = "success" | "error" | "warning" | "info";

export type ToastPayload = {
  message: string;
  kind?: ToastKind;
  duration?: number;
};

export function notify(message: string, kind: ToastKind = "info", duration = 3200) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ToastPayload>("portfolio:toast", {
    detail: { message, kind, duration },
  }));
}
