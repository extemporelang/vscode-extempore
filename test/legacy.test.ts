import * as assert from "node:assert/strict";
import * as vscode from "vscode";

import { splitReplies } from "../src/legacy";
import { resultLine } from "../src/results";

suite("legacy replies", () => {
  test("each reply ends with a NUL, and one may arrive in pieces", () => {
    assert.deepEqual(splitReplies("Welcome to extempore!\0" + "7\0" + "42\0" + "err"), {
      replies: ["Welcome to extempore!", "7", "42"],
      rest: "err",
    });
    assert.deepEqual(splitReplies("or\0"), { replies: ["or"], rest: "" });
  });
});

suite("where a result goes", () => {
  const lines = ["(define a 1)", "(define b", "  2)", "", "(c)"];

  test("on the last line of the code evaluated", () => {
    assert.equal(resultLine(lines, new vscode.Range(1, 0, 2, 4)), 2);
  });

  test("a selection of whole lines ends on the line before the next form", () => {
    assert.equal(resultLine(lines, new vscode.Range(1, 0, 4, 0)), 2);
    assert.equal(resultLine(lines, new vscode.Range(0, 0, 1, 0)), 0);
  });
});
