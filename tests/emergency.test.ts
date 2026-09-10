import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { prisma } from "../src/lib/prisma";
import { hashSecret } from "../src/lib/mobileAgent";
import { POST } from "../src/app/api/agent/emergency/route";

test("emergency refuses missing credentials", async () => {
  const result = await POST(new NextRequest("https://example.com/api/agent/emergency", { method: "POST" }));
  assert.equal(result.status, 401);
});

for (const scenario of ["valid", "unknown", "rotated"] as const) {
  test(`emergency ${scenario}: only the bearer enrollment can be revoked`, async (t) => {
    const changes: unknown[] = [];
    const enrollments: unknown[] = [];
    const tx = {
      mobileAgent: {
        findUnique: async (args: unknown) => {
          assert.deepEqual(args, { where: { tokenHash: hashSecret("device-secret") } });
          return scenario === "unknown" ? null : { id: "this-device" };
        },
        updateMany: async (args: unknown) => { changes.push(args); return { count: scenario === "rotated" ? 0 : 1 }; },
      },
      mobileEnrollment: { updateMany: async (args: unknown) => { enrollments.push(args); return { count: 2 }; } },
      // No user, link, case or other-device mutation is available to this transaction.
    };
    t.mock.method(prisma, "$transaction", async (callback: (client: typeof tx) => unknown) => callback(tx));
    const response = await POST(new NextRequest("https://example.com/api/agent/emergency", {
      method: "POST", headers: { authorization: "Bearer device-secret", "content-type": "application/json" },
      body: JSON.stringify({ agentId: "someone-else", userId: "admin" }),
    }));
    assert.equal(response.status, scenario === "valid" ? 200 : 401);
    assert.equal(enrollments.length, scenario === "valid" ? 1 : 0);
    if (scenario !== "unknown") {
      const change = changes[0] as { where: unknown; data: Record<string, unknown> };
      assert.deepEqual(change.where, { id: "this-device", tokenHash: hashSecret("device-secret") });
      assert.equal(change.data.isActive, false);
      assert.equal(change.data.tokenHash, null);
      assert.ok(change.data.emergencyLockedAt instanceof Date);
    }
    if (scenario === "valid") {
      assert.deepEqual((enrollments[0] as { where: unknown }).where, { agentId: "this-device", usedAt: null });
    }
  });
}
