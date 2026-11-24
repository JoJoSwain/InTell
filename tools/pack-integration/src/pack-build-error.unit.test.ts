/**
 * F2: typed PackBuildError (no Deno APIs — safe under Node/vitest).
 */
import { describe, expect, it } from "vitest";
import { PackBuildError } from "../../../supabase/functions/_shared/packBuildError.ts";

describe("PackBuildError (F2)", () => {
  it("carries code and entity without message regex", () => {
    const err = new PackBuildError({
      code: "NO_HOME_GROVE",
      entity: "character",
      entityId: "char-1",
      message: "character has no home grove",
    });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("PackBuildError");
    expect(err.code).toBe("NO_HOME_GROVE");
    expect(err.entity).toBe("character");
    expect(err.entityId).toBe("char-1");
    expect(err instanceof PackBuildError).toBe(true);
  });
});
