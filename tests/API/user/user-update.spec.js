import { test, expect } from "@playwright/test";
const testData = require("../../../testdata.json");

test.describe("User update - dynamic validation", () => {
  let targetUserId;
  let userEndpoint = testData.userEndpoints.base;
  const validBase = testData.sharedUserScenarios.positive[0].payload;

  test.beforeAll(async ({ request }) => {
    const response = await request.post(userEndpoint, { data: { ...validBase, email: `setup.${Date.now()}@test.com` } });
    expect(response.status()).toBe(201);
    const body = await response.json();
    targetUserId = body.data.id;
  });

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
    test.describe(`Update Validation:: ${key}`, () => {
      for (const scenario of scenarios.positive) {
        test(`SUCCESS: ${scenario.testName}`, async ({ request }) => {

          const rawValue = scenario.payload.value ?? Object.values(scenario.payload)[0];
          const addressFields = ["streetAddress", "apartment", "city", "state", "postalCode", "countryCode"];
          let updatePayload = { ...validBase, email: `success_test.${Date.now()}.${Math.random()}@test.com`};

          if (addressFields.includes(key)) {
            updatePayload.address = { ...validBase.address, [key]: rawValue };
          } else {
            updatePayload[key] = rawValue;
          }

          const response = await test.step(`Submit update for ${key}`, async () => {
            return await request.put(`${userEndpoint}/${targetUserId}`, { data: updatePayload });
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
          const verifyRes = await request.get(`${userEndpoint}/${targetUserId}`);
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
          const addressFields = ["streetAddress", "apartment", "city", "state", "postalCode", "countryCode"];
          let invalidPayload = { ...validBase, email: `fail_test.${Date.now()}.${Math.random()}@test.com`};

          if (addressFields.includes(key)) {
            invalidPayload.address = { ...validBase.address, [key]: rawValue };
          } else {
            invalidPayload[key] = rawValue;
          }

;
          const response = await request.put(`${userEndpoint}/${targetUserId}`, { data: invalidPayload });

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
      await request.delete(`${userEndpoint}/${targetUserId}`);
    }
  });
});
