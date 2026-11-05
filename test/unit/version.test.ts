import { expect, test } from "vitest";
import { VERSION } from "../../src/version.js";

test("reports a development version when run from source", () => {
  expect(VERSION).toBe("0.0.0-dev");
});
