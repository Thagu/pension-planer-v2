/**
 * Build FormData from a form element by reading control values directly.
 * Unlike `new FormData(form)`, this includes fields inside ancestors with the
 * HTML `hidden` attribute (e.g. inactive Radix tab panels).
 */
export function collectFormDataFromElement(
  form: HTMLFormElement,
  extra?: Record<string, FormDataEntryValue>,
): FormData {
  const fd = new FormData();

  for (const element of form.elements) {
    if (
      !(
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement
      )
    ) {
      continue;
    }

    const { name, disabled } = element;
    if (!name || disabled) continue;

    if (element instanceof HTMLInputElement) {
      const { type } = element;
      if (type === "radio") {
        if (!element.checked) continue;
      } else if (type === "checkbox") {
        fd.set(name, element.checked ? element.value || "on" : "off");
        continue;
      } else if (type === "file") {
        if (element.files?.[0]) fd.append(name, element.files[0]);
        continue;
      }
    }

    fd.set(name, element.value);
  }

  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      fd.set(key, value);
    }
  }

  return fd;
}
