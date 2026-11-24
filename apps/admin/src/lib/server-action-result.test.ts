import { describe, expect, it } from "vitest";
import { serverActionError } from "./server-action-result";

describe("serverActionError (V2)", () => {
  it("builds the ServerActionForm failure shape", () => {
    expect(serverActionError("editor required")).toEqual({
      ok: false,
      error: "editor required",
    });
  });
});