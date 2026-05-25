import { describe, expect, it } from "vitest";
import { createCopyOnSelectHandler } from "./copyOnSelect";

type ScheduledTask = { fn: () => void; ms: number };

function makeScheduler() {
  const tasks: ScheduledTask[] = [];
  const schedule = (fn: () => void, ms: number) => {
    const task: ScheduledTask = { fn, ms };
    tasks.push(task);
    return task;
  };
  const cancel = (handle: unknown) => {
    const idx = tasks.indexOf(handle as ScheduledTask);
    if (idx >= 0) tasks.splice(idx, 1);
  };
  const flushAll = () => {
    while (tasks.length > 0) {
      const t = tasks.shift()!;
      t.fn();
    }
  };
  return { schedule, cancel, flushAll, tasks };
}

describe("createCopyOnSelectHandler", () => {
  it("copies the latest selection after the debounce", () => {
    const copies: string[] = [];
    const sched = makeScheduler();
    const handler = createCopyOnSelectHandler({
      isEnabled: () => true,
      copy: (t) => copies.push(t),
      schedule: sched.schedule,
      cancel: sched.cancel,
    });

    handler.notify("hel");
    handler.notify("hell");
    handler.notify("hello");
    expect(copies).toEqual([]);
    sched.flushAll();
    expect(copies).toEqual(["hello"]);
  });

  it("skips empty selections and preserves the previous copy", () => {
    const copies: string[] = [];
    const sched = makeScheduler();
    const handler = createCopyOnSelectHandler({
      isEnabled: () => true,
      copy: (t) => copies.push(t),
      schedule: sched.schedule,
      cancel: sched.cancel,
    });

    handler.notify("first");
    sched.flushAll();
    handler.notify("");
    sched.flushAll();
    expect(copies).toEqual(["first"]);
  });

  it("dedupes consecutive identical selections", () => {
    const copies: string[] = [];
    const sched = makeScheduler();
    const handler = createCopyOnSelectHandler({
      isEnabled: () => true,
      copy: (t) => copies.push(t),
      schedule: sched.schedule,
      cancel: sched.cancel,
    });

    handler.notify("same");
    sched.flushAll();
    handler.notify("same");
    sched.flushAll();
    expect(copies).toEqual(["same"]);
  });

  it("no-ops when the preference is off", () => {
    const copies: string[] = [];
    const sched = makeScheduler();
    let enabled = false;
    const handler = createCopyOnSelectHandler({
      isEnabled: () => enabled,
      copy: (t) => copies.push(t),
      schedule: sched.schedule,
      cancel: sched.cancel,
    });

    handler.notify("hello");
    sched.flushAll();
    expect(copies).toEqual([]);

    enabled = true;
    handler.notify("hello");
    sched.flushAll();
    expect(copies).toEqual(["hello"]);
  });

  it("re-checks isEnabled at flush time (toggle during debounce)", () => {
    const copies: string[] = [];
    const sched = makeScheduler();
    let enabled = true;
    const handler = createCopyOnSelectHandler({
      isEnabled: () => enabled,
      copy: (t) => copies.push(t),
      schedule: sched.schedule,
      cancel: sched.cancel,
    });

    handler.notify("hello");
    enabled = false;
    sched.flushAll();
    expect(copies).toEqual([]);
  });

  it("dispose cancels a pending write", () => {
    const copies: string[] = [];
    const sched = makeScheduler();
    const handler = createCopyOnSelectHandler({
      isEnabled: () => true,
      copy: (t) => copies.push(t),
      schedule: sched.schedule,
      cancel: sched.cancel,
    });

    handler.notify("pending");
    handler.dispose();
    sched.flushAll();
    expect(copies).toEqual([]);
  });
});
