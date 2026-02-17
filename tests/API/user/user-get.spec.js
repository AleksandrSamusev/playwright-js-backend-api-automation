import { test, expect } from "@playwright/test";
const testData = require("../../../testdata.json");

test.describe("User API - Retrieval (GET) and Sorting Suite", () => {
  let targetUserId;
  const baseUrl = testData.userEndpoints.base;
  const createdUserIds = [];

  // 1. SETUP: Create baseline data for Retrieval and Sorting
  test.beforeAll(async ({ request }) => {
    // A. Single target user for direct ID retrieval tests
    await test.step("Create target user for retrieval tests", async () => {
      const payload = {
        ...testData.sharedUserScenarios.positive[0].payload,
        email: `get_test_${Date.now()}@test.jp`,
      };
      const response = await request.post(baseUrl, { data: payload });
      const body = await response.json();
      targetUserId = body.data.id;
      createdUserIds.push(targetUserId);
    });

    // B. Seed users for Sorting validation (distinct values to make sorting obvious)
    await test.step("Seed users for sorting validation", async () => {
      const sortingSeed = [
        { firstName: "Alpha", lastName: "Zebra", email: `a.${Date.now()}@sort.com`, phoneNumber: "+11111111111" },
        { firstName: "Zelda", lastName: "Alpha", email: `z.${Date.now()}@sort.com`, phoneNumber: "+22222222222" },
        { firstName: "Beta",  lastName: "Beta",  email: `b.${Date.now()}@sort.com`, phoneNumber: "+33333333333" }
      ];
      for (const user of sortingSeed) {
        const res = await request.post(baseUrl, { data: user });
        const body = await res.json();
        if (body.data?.id) createdUserIds.push(body.data.id);
      }
    });
  });

  /**
   * SECTION 1: POSITIVE & CONTRACT TESTS
   */
  test("Verify 'Get all users' list structure", async ({ request }) => {
    const response = await request.get(baseUrl);
    const body = await response.json();
    expect(response.status()).toBe(200);

    await test.step("Verify List Envelope and Array Data", async () => {
      testData.contractExpectations.successResponse.forEach(field => {
        expect.soft(body).toHaveProperty(field);
      });
      expect(Array.isArray(body.data)).toBeTruthy();
    });
  });

  test("Verify 'Get user by ID' structure and data accuracy", async ({ request }) => {
    const response = await request.get(`${baseUrl}/${targetUserId}`);
    const body = await response.json();
    expect(response.status()).toBe(200);

    await test.step("Verify Data Accuracy & Schema", async () => {
      expect(body.data).toMatchObject({
        id: targetUserId,
        firstName: testData.sharedUserScenarios.positive[0].payload.firstName
      });
      testData.contractExpectations.userObject.forEach(field => {
        expect.soft(body.data).toHaveProperty(field);
      });
    });
  });

  /**
   * SECTION 2: SORTING LOGIC VALIDATION
   */
  test.describe("Sorting Validation Loop", () => {
    for (const scenario of testData.sharedSortingScenarios) {
      test(`Verify ${scenario.testName}`, async ({ request }) => {
        const response = await request.get(`${baseUrl}?sortBy=${scenario.queryParam}`);
        expect(response.status()).toBe(200);

        const body = await response.json();
        const actualData = body.data;

        await test.step(`Check order for ${scenario.field} (${scenario.order})`, async () => {
          // Extract the values returned by the API
          const actualValues = actualData.map(u => u[scenario.field].toString());
          
          // Generate the expected order using JS sort
          const expectedValues = [...actualValues].sort((a, b) => {
            return scenario.order === 'asc' 
              ? a.localeCompare(b, undefined, { numeric: true }) 
              : b.localeCompare(a, undefined, { numeric: true });
          });

          expect(actualValues, `Data mismatch in ${scenario.queryParam}`).toEqual(expectedValues);
        });
      });
    }
  });

  /**
   * SECTION 3: NEGATIVE SCENARIOS
   */
  for (const scenario of testData.getScenarios.negative) {
    test(`REJECT: ${scenario.testName}`, async ({ request }) => {
      const response = await request.get(`${baseUrl}/${scenario.params.id}`);
      const body = await response.json();

      expect(response.status()).toBe(scenario.expected.status);

      await test.step("Verify Error Content", async () => {
        const hasError = body.errors.some(err => err.includes(scenario.expected.error));
        expect(hasError, `Error list ${JSON.stringify(body.errors)} missing: ${scenario.expected.error}`).toBeTruthy();
      });
    });
  }

  /**
   * SECTION 4: CLEANUP
   */
  test.afterAll(async ({ request }) => {
    await test.step("Cleanup seeded users", async () => {
      for (const id of createdUserIds) {
        await request.delete(`${baseUrl}/${id}`);
      }
    });
  });
});