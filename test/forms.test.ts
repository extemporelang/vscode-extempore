import * as assert from "node:assert/strict";

import { topLevelFormAt, topLevelForms } from "../src/forms";

const text = (forms: { start: number; end: number }[], source: string) =>
  forms.map((f) => source.slice(f.start, f.end));

suite("top-level forms", () => {
  test("skip strings, comments and character literals", () => {
    const source = [
      '(define a ")")',
      "; (not a form",
      "#| (nor this) |#",
      "(define b #\\()",
      '(println "\\"(")',
    ].join("\n");
    assert.deepEqual(text(topLevelForms(source), source), ['(define a ")")', "(define b #\\()", '(println "\\"(")']);
  });

  test("a cursor inside a form, or just after one, finds it", () => {
    const source = "(define x 1)\n\n(define y\n  (+ x 1))  \n";
    assert.equal(text([topLevelFormAt(source, 3)!], source)[0], "(define x 1)");
    assert.equal(text([topLevelFormAt(source, 26)!], source)[0], "(define y\n  (+ x 1))");
    assert.equal(text([topLevelFormAt(source, source.length)!], source)[0], "(define y\n  (+ x 1))");
    assert.equal(topLevelFormAt("  ; nothing", 4), undefined);
  });
});
