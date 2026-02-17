import { test, expect } from "@playwright/test";
const testData = require("../../../testdata.json");

test.describe("User API - Deletion (DELETE) Scenarios", () => {
  const baseUrl = testData.userEndpoints.base;

  test("Verify successful deletion and data removal", async ({ request }) => {
    let tempUserId;

    await test.step("PRE-CONDITION: Create a user to delete", async () => {
      const response = await request.post(baseUrl, {
        data: { ...testData.sharedUserScenarios.positive[0].payload, email: `delete.${Date.now()}@test.com` },
      });
      const body = await response.json();
      tempUserId = body.data.id;
      expect(response.status()).toBe(201);
    });

    await test.step("ACTION: Delete the user", async () => {
      const response = await request.delete(`${baseUrl}/${tempUserId}`);
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.message).toBe("Success");
    });

    await test.step("VERIFY: User is truly gone from storage", async () => {
      // If your GET returns 404 for missing users, this is the ultimate proof
      const response = await request.get(`${baseUrl}/${tempUserId}`);
      expect(response.status()).toBe(404);
    });
  });

  // Loop for Technical/Format errors (like the 'abc-123' ID)
  for (const scenario of testData.deleteScenarios.negative) {
    test(`REJECT: ${scenario.testName}`, async ({ request }) => {
      const response = await request.delete(`${baseUrl}/${scenario.params.id}`);
      const body = await response.json();

      expect(response.status()).toBe(scenario.expected.status);

      await test.step("Verify Type Mismatch Error", async () => {
        const hasError = body.errors.some((err) => err.includes(scenario.expected.error));
        expect(hasError).toBeTruthy();
      });
    });
  }
});
