// Top-level forms of Extempore source, found by a scan which skips strings,
// comments and character literals.

export interface Form {
  start: number;
  end: number; // one past the closing paren
}

export function topLevelForms(text: string): Form[] {
  const forms: Form[] = [];
  let depth = 0;
  let start = 0;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === ";") {
      const newline = text.indexOf("\n", i);
      i = newline === -1 ? text.length : newline + 1;
    } else if (c === "#" && text[i + 1] === "|") {
      const close = text.indexOf("|#", i + 2);
      i = close === -1 ? text.length : close + 2;
    } else if (c === "#" && text[i + 1] === "\\") {
      i += 3; // #\( and the like
    } else if (c === '"') {
      i++;
      while (i < text.length && text[i] !== '"') {
        i += text[i] === "\\" ? 2 : 1;
      }
      i++;
    } else if (c === "(") {
      if (depth === 0) {
        start = i;
      }
      depth++;
      i++;
    } else if (c === ")") {
      if (depth > 0) {
        depth--;
        if (depth === 0) {
          forms.push({ start, end: i + 1 });
        }
      }
      i++;
    } else {
      i++;
    }
  }
  return forms;
}

// The top-level form around offset, or else the last one which ends before it
// (so that a cursor just after a form evaluates it).
export function topLevelFormAt(text: string, offset: number): Form | undefined {
  let before: Form | undefined;
  for (const form of topLevelForms(text)) {
    if (form.start <= offset && offset < form.end) {
      return form;
    }
    if (form.end <= offset) {
      before = form;
    } else {
      break;
    }
  }
  return before;
}
