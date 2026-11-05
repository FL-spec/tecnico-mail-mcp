import { expect, test } from "vitest";
import { SendingBudget } from "../../src/smtp/budget.js";

const HOUR = 3_600_000;

test("allows up to the hourly cap, then refuses before anything is sent", () => {
  const budget = new SendingBudget(() => 0);
  budget.reserve(60);
  expect(() => budget.reserve(1)).toThrow(/60 recipients per hour/);
});

test("the hourly window slides", () => {
  let now = 0;
  const budget = new SendingBudget(() => now);
  budget.reserve(60);
  now = HOUR + 1;
  expect(() => budget.reserve(60)).not.toThrow();
});

test("the daily cap holds across hours", () => {
  let now = 0;
  const budget = new SendingBudget(() => now);
  for (let hour = 0; hour < 3; hour++) {
    budget.reserve(60);
    now += HOUR + 1;
  }
  budget.reserve(20);
  now += HOUR + 1;
  expect(() => budget.reserve(1)).toThrow(/200 recipients per day/);
});

test("a failed send gives its recipients back", () => {
  const budget = new SendingBudget(() => 0);
  const refund = budget.reserve(60);
  refund();
  expect(() => budget.reserve(60)).not.toThrow();
});
