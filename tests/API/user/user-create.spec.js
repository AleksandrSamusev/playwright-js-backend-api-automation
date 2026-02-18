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
      testData.contractExpectations.userObject.forEach((field) => {
        expect.soft(body.data).toHaveProperty(field);
      });
      testData.contractExpectations.addressObject.forEach((field) => {
        expect.soft(body.data.address).toHaveProperty(field);
      });
    });

    await test.step("Verify Error Schema", async () => {
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
    { key: "streetAddress", scenarios: testData.addressScenarios.streetAddressScenarios, label: "Street address" },
    { key: "apartment", scenarios: testData.addressScenarios.apartmentScenarios, label: "Apartment" },
    { key: "city", scenarios: testData.addressScenarios.cityScenarios, label: "City" },
    { key: "state", scenarios: testData.addressScenarios.stateScenarios, label: "State" },
    { key: "postalCode", scenarios: testData.addressScenarios.postalCodeScenarios, label: "Postal code" },
    { key: "countryCode", scenarios: testData.addressScenarios.countryCodeScenarios, label: "Country code" },
  ];

  for (const { key, scenarios, label } of validationFields) {
  test.describe(`Creation Validation: ${key}`, () => {
    
    for (const scenario of scenarios.positive) {
      test(`SUCCESS: ${scenario.testName}`, async ({ request }) => {
        
        const rawValue = scenario.payload.value ?? Object.values(scenario.payload)[0];       
        const addressFields = ["streetAddress", "apartment", "city", "state", "postalCode", "countryCode"];
        let payload = { 
          ...validBase, 
          email: `success_test.${Date.now()}.${Math.random()}@test.com` 
        };

        if (addressFields.includes(key)) {
          payload.address = { ...validBase.address, [key]: rawValue };
        } else {
          payload[key] = rawValue;
        }

        const response = await request.post(userEndpoint, { data: payload });
        expect(response.status()).toBe(201);
        
        const body = await response.json();
        const currentId = body.data.id; // Local scope variable
        if (currentId) createdUserIds.push(currentId);

        await test.step(`Verify persistence`, async () => {
          const verifyRes = await request.get(`${userEndpoint}/${currentId}`);
          const userData = await verifyRes.json();

          let expectedValue = rawValue;
          if (key === "email" && expectedValue) expectedValue = expectedValue.trim().toLowerCase();

          if (["firstName", "lastName", "phoneNumber"].includes(key)) {
            expect(userData.data[key].toString().trim()).toBe(expectedValue.toString().trim());
          } else if (addressFields.includes(key)) {
            expect(userData.data.address[key].toString().trim()).toBe(expectedValue.toString().trim());
          }
        });
      });
    }

    for (const scenario of scenarios.negative) {
      test(`REJECT: ${scenario.testName}`, async ({ request }) => {
        const rawValue = scenario.payload.value ?? Object.values(scenario.payload)[0];
        
        let payload = { ...validBase };
        const addressFields = ["streetAddress", "apartment", "city", "state", "postalCode", "countryCode"];

        if (addressFields.includes(key)) {
          payload.address = { ...validBase.address, [key]: rawValue };
        } else {
          payload[key] = rawValue;
        }

        const response = await request.post(userEndpoint, { data: payload });
        expect(response.status()).toBe(400);

        const body = await response.json();
        const expectedError = scenario.expected.error.replace("{{field}}", label);
        const errorExists = body.errors.some((err) => err.includes(expectedError));

        expect(errorExists, `Expected error list to contain: "${expectedError}"`).toBeTruthy();
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
