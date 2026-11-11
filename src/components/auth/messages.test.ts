import { test } from "node:test";
import assert from "node:assert/strict";
import { friendlyAuthError } from "./messages.ts";

test("auth errors become readable", () => {
  assert.equal(friendlyAuthError("Invalid login credentials").action, "forgot");
  assert.equal(friendlyAuthError("Email not confirmed").action, "resend");
  assert.equal(friendlyAuthError("User already registered").action, "signin");
  assert.match(friendlyAuthError("For security purposes, you can only request this after 42 seconds.").text, /Wait a minute/);
  assert.equal(friendlyAuthError("Something odd").text, "Something odd");
});
