export const text = (value: unknown) => String(value ?? "");

export const setText = (root: ParentNode, selector: string, value: unknown) => {
  const element = root.querySelector<HTMLElement>(selector);
  if (element) {
    element.textContent = text(value);
  }
  return element;
};

export const setInputValue = (root: ParentNode, selector: string, value: unknown) => {
  const input = root.querySelector<HTMLInputElement>(selector);
  if (input && input.value !== text(value)) {
    input.value = text(value);
  }
  return input;
};
