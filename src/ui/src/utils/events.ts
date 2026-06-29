export const emit = <T>(element: HTMLElement, name: string, detail?: T) => {
  element.dispatchEvent(
    new CustomEvent<T>(name, {
      bubbles: true,
      composed: true,
      detail,
    }),
  );
};
