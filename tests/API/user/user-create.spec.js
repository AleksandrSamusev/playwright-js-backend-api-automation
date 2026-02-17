import { test, expect } from "@playwright/test";
const testData = require("../../../testdata.json");

test.describe("User API - Dynamic Creation Suite", () => {
  const createdUserIds = [];
  const userEndpoint = testData.userEndpoints.base;
  const validBase = testData.sharedUserScenarios.positive[0].payload;

  /**
   * SECTION 1: CONTRACT TESTS
   */
  test("Verify Response Schemas (Success & Error)", async ({ request }) => {
    await test.step("Verify Success Schema", async () => {
      const response = await request.post(userEndpoint, {
        data: { ...validBase, email: `contract.${Date.now()}@test.com` },
      });
      const body = await response.json();
      if (body.data?.id) createdUserIds.push(body.data.id);

      expect(response.status()).toBe(201);
      testData.contractExpectations.successResponse.forEach((field) => {
        expect.soft(body).toHaveProperty(field);
      });
    });

    await test.step("Verify Error Schema", async () => {
      // Send empty object to trigger error
      const response = await request.post(userEndpoint, { data: {} });
      const body = await response.json();
      expect(response.status()).toBe(400);
      testData.contractExpectations.errorResponse.forEach((field) => {
        expect.soft(body).toHaveProperty(field);
      });
    });
  });

  /**
   * SECTION 2: DYNAMIC FIELD VALIDATION (The PRO Merger)
   */
  const validationFields = [
    { key: "firstName", scenarios: testData.sharedNameScenarios, label: "First name" },
    { key: "lastName", scenarios: testData.sharedNameScenarios, label: "Last name" },
    { key: "email", scenarios: testData.sharedEmailScenarios, label: "Email address" },
    { key: "phoneNumber", scenarios: testData.sharedPhoneNumberScenarios, label: "Phone number" },
  ];

  for (const { key, scenarios, label } of validationFields) {
    test.describe(`Creation Validation: ${key}`, () => {
      for (const scenario of scenarios.negative) {
        test(`REJECT: ${scenario.testName}`, async ({ request }) => {
          const payload = { ...validBase, [key]: scenario.payload.value };

          const response = await request.post(userEndpoint, { data: payload });
          expect(response.status()).toBe(400);

          const body = await response.json();

          // 1. Prepare the expected string by replacing the placeholder
          const expectedError = scenario.expected.error.replace("{{field}}", label);

          // 2. PRO CHECK: Search for the string inside the body.errors array
          // We use some() to see if at least one error in the list matches
          const errorExists = body.errors.some((err) => err.includes(expectedError));

          expect(errorExists, `Expected error list ${JSON.stringify(body.errors)} to contain: "${expectedError}"`).toBeTruthy();
        });
      }
    });
  }

  /**
   * SECTION 3: SHARED USER SCENARIOS (Conflict/Unique checks)
   */
  test.describe("User Business Logic", () => {
    test("REJECT: Duplicate Email Conflict", async ({ request }) => {
      const scenario = testData.sharedUserScenarios.negative[0];
      const conflictEmail = scenario.payload.email;

      await test.step("PRE-CONDITION: Ensure the email exists in storage", async () => {
        const response = await request.post(userEndpoint, {
          data: { ...validBase, email: conflictEmail },
        });

        // CAPTURE THE ID HERE TOO!
        const body = await response.json();
        if (body.data?.id) {
          createdUserIds.push(body.data.id);
        }
      });

      await test.step("ACTION: Attempt to create user with SAME email", async () => {
        const response = await request.post(userEndpoint, {
          data: { ...validBase, email: conflictEmail },
        });

        expect(response.status()).toBe(409);
        const body = await response.json();
        expect(body.errors).toContain(scenario.expected.error);
      });
    });

    test("SUCCESS: Create full valid user", async ({ request }) => {
      const uniqueEmail = `success.${Date.now()}@test.com`;
      const payload = { ...validBase, email: uniqueEmail };

      const response = await request.post(userEndpoint, { data: payload });
      const body = await response.json();

      if (body.data?.id) createdUserIds.push(body.data.id);

      expect(response.status()).toBe(201);
      expect(body.message).toBe("User successfully created");
    });
  });

  test.afterAll(async ({ request }) => {
    for (const id of createdUserIds) {
      await request.delete(`${userEndpoint}/${id}`);
    }
  });
});
