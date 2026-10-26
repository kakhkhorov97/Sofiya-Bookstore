import { describe, expect, it } from "vitest";
import { clientIpFrom } from "./client-ip";

describe("clientIpFrom", () => {
  it("takes the address Google appended, not what the browser sent", () => {
    expect(clientIpFrom("203.0.113.7")).toBe("203.0.113.7");
    expect(clientIpFrom("1.1.1.1, 203.0.113.7")).toBe("203.0.113.7");
  });

  it("counts extra hops from the right behind a load balancer", () => {
    expect(clientIpFrom("1.1.1.1, 203.0.113.7, 130.211.0.1", 2)).toBe("203.0.113.7");
  });

  it("returns nothing for missing or malformed values", () => {
    expect(clientIpFrom(null)).toBeNull();
    expect(clientIpFrom("")).toBeNull();
    expect(clientIpFrom("unknown")).toBeNull();
    expect(clientIpFrom("203.0.113.7", 2)).toBeNull();
    expect(clientIpFrom("2001:db8::1")).toBe("2001:db8::1");
  });
});
