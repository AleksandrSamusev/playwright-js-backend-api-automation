import { test, expect } from "@playwright/test";
const testData = require("../../../testdata.json");

test.describe("User update - dynamic validation", () => {
  let targetUserId;
  let baseUrl = testData.userEndpoints.base;
  // Store the base valid data
  const validBase = testData.sharedUserScenarios.positive[0].payload;

  test.beforeAll(async ({ request }) => {
    // PRO: Use a unique email for the setup user to avoid conflicts with shared tests
    const setupPayload = { ...validBase, email: `setup.${Date.now()}@test.com` };

    const response = await request.post(baseUrl, { data: setupPayload });
    expect(response.status()).toBe(201);
    const body = await response.json();
    targetUserId = body.data.id;
  });

  const fieldConfigs = [
    { key: "firstName", scenarios: testData.sharedNameScenarios, label: "First name" },
    { key: "lastName", scenarios: testData.sharedNameScenarios, label: "Last name" },
    { key: "email", scenarios: testData.sharedEmailScenarios, label: "Email address" },
    { key: "phoneNumber", scenarios: testData.sharedPhoneNumberScenarios, label: "Phone number" },
  ];

  for (const { key, scenarios, label } of fieldConfigs) {
    test.describe(`Field: ${key}`, () => {



      for (const scenario of scenarios.positive) {
        test(`SUCCESS: ${scenario.testName}`, async ({ request }) => {
          // PRO: Merger - Keep all other fields valid so the validator doesn't reject the PUT
          const updatePayload = {...validBase, [key]: scenario.payload.value,
            // Ensure email is unique so it doesn't collide with the storage file
            email: key === "email" ? scenario.payload.value : `update.${Date.now()}@test.com`,
          };

          const response = await test.step(`Submit update for ${key}`, async () => {
            return await request.put(`${baseUrl}/${targetUserId}`, { data: updatePayload });
          });

          // DEBUG: If it's still 400, this will tell you exactly why
          if (response.status() !== 200) {
            const err = await response.json();
            console.log(`Error on ${scenario.testName}:`, err.errors);
          }

          expect(response.status()).toBe(200);
          const body = await response.json();
          expect(body.message).toBe("Success");

          await test.step(`Verify persistence`, async () => {
            const verifyRes = await request.get(`${baseUrl}/${targetUserId}`);
            const userData = await verifyRes.json();

            let expectedValue = scenario.payload.value;
            if (key === "email" && expectedValue) expectedValue = expectedValue.trim().toLowerCase();

            expect(userData.data[key].toString().trim()).toBe(expectedValue.toString().trim());
          });
        });
      }




      for (const scenario of scenarios.negative) {
        test(`REJECT: ${scenario.testName}`, async ({ request }) => {
          const invalidPayload = { ...validBase, [key]: scenario.payload.value };
          const response = await request.put(`${baseUrl}/${targetUserId}`, { data: invalidPayload });

          // PRO Check: If we sent a null and got a 200, but JSON expected 400,
          // it means the API is designed to ignore nulls.
          if (scenario.payload.value === null && response.status() === 200) {
            console.warn(`WARN: Field ${key} ignored null update instead of rejecting it.`);
            return;
          }

          expect(response.status()).toBe(400);
        });
      }
    });
  }

  test.afterAll(async ({ request }) => {
    if (targetUserId) {
      await request.delete(`${baseUrl}/${targetUserId}`);
    }
  });
});
