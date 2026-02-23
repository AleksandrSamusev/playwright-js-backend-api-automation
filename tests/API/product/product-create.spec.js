import {test, expect} from '@playwright/test'
const testData = require('../../../product.json')

test.describe("Product API - creation Suite", () => {
    const endpoint = testData.userEndpoints.base;
    const validData = testData.validPayload;

    // Contract tests

    test("Verify response schema (success & error)", async({request}) => {
        await test.step("Verify success schema", async() => {
            
            const response = await request.post(endpoint, {data: validData});
            const body = await response.json();

            expect(response.status()).toBe(201);
            testData.contractExpectations.successResponse.forEach((field) => {
               expect.soft(body).toHaveProperty(field) 
            });

            testData.contractExpectations.productResponseObject.forEach((field)=> {
                expect.soft(body.data).toHaveProperty(field);
            });
        });
        await test.step("Verify error schema", async() => {
            const response = await request.post(endpoint, {data: {...validData, name: ""}});
            const body = await response.json();

            expect(response.status()).toBe(400);
            testData.contractExpectations.errorResponse.forEach((field) => {
                expect.soft(body).toHaveProperty(field);
            });
        });
    });

    // Fields validation

    const validationFields =
    [
        {key: "name", scenarios: testData.createScenarios.productNameScenarios, label: "Product name"},
        {key: "category", scenarios: testData.createScenarios.productCategoryScenarios, label: "Product category"},
        {key: "manufacturer", scenarios: testData.createScenarios.productManufacturerScenarios, label: "Product manufacturer"},
        {key: "price", scenarios: testData.createScenarios.priceScenarios, label: "price"},
        {key: "costPrice", scenarios: testData.createScenarios.costPriceScenarios, label: "Cost price"},
        {key: "salePrice", scenarios: testData.createScenarios.salePriceScenarios, label: "Sale price"},
        {key: "currencyCode", scenarios: testData.createScenarios.currencyCodeScenarios, label: "Currency code"},
        {key: "sku", scenarios: testData.createScenarios.skuScenarios, label: "sku"},
        {key: "quantityInStock", scenarios: testData.createScenarios.quantityInStockScenarios, label: "quantity in stock"},
        {key: "lowStockThreshold", scenarios: testData.createScenarios.lowStockThresholdScenarios, label: "low stock threshold"},
        {key: "expectedAvailabilityDate", scenarios: testData.createScenarios.expectedAvailabilityDateScenarios, label: "expected availability date"},
        {key: "imageUrl", scenarios: testData.createScenarios.imageUrlScenarios, label: "image URL"},
        {key: "status", scenarios: testData.createScenarios.statusScenarios, label: "status"}
    ];

    for(const {key, scenarios, label} of validationFields) {
        test.describe(`Creation validation: ${key}`, ()=> {

            scenarios.positive.forEach((scenario, i) => {
                    test(`[${i}] SUCCESS: ${label} - ${scenario.testName}`, async({request}) => {
                    const updatedPayload = {...validData, [key]:scenario.payload.value}

                    const response = await request.post(endpoint, {data: updatedPayload});
                    expect(response.status()).toBe(201);
                    const body = await response.json();
                    const id = body.data.id;

                    await test.step(`Verify persistence`, async() => {
                        const getResponse = await request.get(`${endpoint}/${id}`)
                        expect(getResponse.status()).toBe(200);
                        const getBody = await getResponse.json();
                        
                        if(key !== "costPrice" && key !== "lowStockThreshold") {
                            expect(getBody.data[key]?.toString().trim()).toBe(scenario.payload.value.toString().trim());
                        }                        
                    });
                });
            });
                
            
            scenarios.negative.forEach((scenario, i) => {
                    test(`[${i}] FAIL: ${label} - ${scenario.testName}`, async({request}) => {
                    const updatedPayload = {...validData, [key]:scenario.payload.value}

                    const response = await request.post(endpoint, {data: updatedPayload});
                    expect(response.status()).toBe(400);
                    const body = await response.json();

                    const expectedError = scenario.expected.error.replace("{{field}}", label);
                    const errorExist = body.errors.some((err) => err.includes(expectedError));
                    //expect(errorExist, `Expected error list to contain: "${expectedError}"`).toBeTruthy();
                });
            });           
        });
    }
});
