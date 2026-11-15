import test from "node:test";
import assert from "node:assert/strict";
import { parseDeck, OutputError } from "../src/lib/validate.js";

const good = {
  title: "T",
  cards: [{ front: "a", back: "b" }],
  questions: [{ question: "q?", options: ["x", "y", "z", "w"], answerIndex: 2, explanation: "because" }],
};

const kindOf = (fn) => {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof OutputError, `expected OutputError, got ${e}`);
    return e.kind;
  }
  assert.fail("expected a throw");
};

test("parses clean JSON", () => {
  const { deck, warnings } = parseDeck(JSON.stringify(good));
  assert.equal(deck.cards.length, 1);
  assert.equal(deck.questions[0].answerIndex, 2);
  assert.equal(warnings.length, 0);
});

test("strips markdown fences", () => {
  const { deck } = parseDeck("```json\n" + JSON.stringify(good) + "\n```");
  assert.equal(deck.title, "T");
});

test("extracts JSON surrounded by chatter", () => {
  const { deck } = parseDeck("Sure! Here you go:\n" + JSON.stringify(good) + "\nHope that helps!");
  assert.equal(deck.cards.length, 1);
});

test("empty / whitespace → empty", () => {
  assert.equal(kindOf(() => parseDeck("")), "empty");
  assert.equal(kindOf(() => parseDeck("   \n")), "empty");
  assert.equal(kindOf(() => parseDeck(null)), "empty");
});

test("truncated JSON → malformed", () => {
  assert.equal(kindOf(() => parseDeck('{ "title": "x", "cards": [ { "front": "What')), "malformed");
});

test("plain prose → malformed", () => {
  assert.equal(kindOf(() => parseDeck("I'm sorry, I can't help with that.")), "malformed");
});

test("wrong shape → shape", () => {
  assert.equal(kindOf(() => parseDeck(JSON.stringify({ result: "hi", items: [1, 2] }))), "shape");
  assert.equal(kindOf(() => parseDeck("42")), "shape");
  assert.equal(kindOf(() => parseDeck(JSON.stringify({ cards: [], questions: [] }))), "shape");
});

test("drops invalid items but keeps valid ones, with warnings", () => {
  const { deck, warnings } = parseDeck(
    JSON.stringify({
      cards: [{ front: "ok", back: "fine" }, { front: "no back" }, 7],
      questions: [{ question: "bad", options: ["one"], answerIndex: 9 }],
    })
  );
  assert.equal(deck.cards.length, 1);
  assert.equal(deck.questions.length, 0);
  assert.ok(warnings.some((w) => /2 malformed cards/.test(w)));
  assert.ok(warnings.some((w) => /No quiz questions/.test(w)));
});

test("tolerates renamed keys and answer formats", () => {
  const { deck } = parseDeck(
    JSON.stringify({
      flashcards: [{ term: "t", definition: "d" }],
      quiz: [
        { prompt: "p1", choices: ["a", "b", "c"], answer: "B" },
        { question: "p2", options: ["a", "b", "c"], answer: "c" },
        { question: "p3", options: ["red", "blue"], answer: "blue" },
      ],
    })
  );
  assert.equal(deck.cards[0].front, "t");
  assert.deepEqual(deck.questions.map((q) => q.answerIndex), [1, 2, 1]);
});

test("rejects questions with duplicate options or out-of-range answers", () => {
  const { deck } = parseDeck(
    JSON.stringify({
      cards: [{ front: "a", back: "b" }],
      questions: [
        { question: "dup", options: ["a", "A", "b"], answerIndex: 0 },
        { question: "range", options: ["a", "b"], answerIndex: 7 },
      ],
    })
  );
  assert.equal(deck.questions.length, 0);
});
