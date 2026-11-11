import { test } from "node:test";
import assert from "node:assert/strict";
import { splitScenes } from "./scenes.ts";

const para = (n: number, s: string) => Array.from({ length: n }, () => s).join(" ");

test("splitScenes: scene count follows length, within 3 to 8", () => {
  const short = ["Ama walked to the door.", "The door was locked.", "She knocked twice."].join("\n\n");
  assert.equal(splitScenes(short).length, 3);
  const long = Array.from({ length: 30 }, (_, i) => para(8, `Sentence number ${i} about the long dark corridor beneath the city.`)).join("\n\n");
  const scenes = splitScenes(long);
  assert.ok(scenes.length >= 3 && scenes.length <= 8, `got ${scenes.length}`);
  assert.equal(splitScenes("").length, 0);
  assert.equal(splitScenes("Only one paragraph here.").length, 1);
});

test("splitScenes: captions prefer narration over dialogue, prompts name characters", () => {
  const body = [
    '"Run," said Corvin.',
    "Ilse climbed the long ash-covered stairs toward the Guild Tower while Corvin kept watch below.",
    "The bells rang. Pell waited by the canal with the stolen map in her satchel, watching the water.",
  ].join("\n\n");
  const [first] = splitScenes(body, { min: 1, max: 1 });
  assert.ok(!first.caption.includes('"'), first.caption);
  assert.match(first.prompt, /Characters: .*Corvin/);
});

test("splitScenes: keeps captions short", () => {
  const body = para(1, "A very long sentence ".repeat(40).trim() + ".");
  for (const s of splitScenes(body)) {
    assert.ok(s.caption.length <= 181);
    assert.ok(s.prompt.length <= 401);
  }
});
