const assert = require('assert');
const { loginSchema, registerSchema } = require('../schemas/userSchemas');
const { saveDespatchSchema } = require('../schemas/despatchSchemas');
const { pincodeSchema, translateSchema } = require('../schemas/apiSchemas');

function runTests() {
    console.log('--- Running Schema Validation Tests ---\n');

    // 1. Test Login Schema
    try {
        const { error, value } = loginSchema.validate({ phone_no: '1234567890' });
        assert(!error, 'Login should pass with valid phone');
        console.log('✅ Login Schema (Valid) Passed');
        
        const resInvalid = loginSchema.validate({ phone_no: '123' });
        assert(resInvalid.error, 'Login should fail with short phone');
        console.log('✅ Login Schema (Invalid length) Passed');
    } catch (e) { console.error('❌ Login Schema Test Failed', e); }

    // 2. Test Register Schema
    try {
        const validReg = {
            first_name: 'John',
            last_name: 'Doe',
            phone_no: '0987654321',
            agreed: true
        };
        const { error } = registerSchema.validate(validReg);
        assert(!error, 'Register should pass with valid payload');
        console.log('✅ Register Schema (Valid) Passed');

        const invalidReg = { ...validReg, phone_no: '123', agreed: false };
        const resInvalid = registerSchema.validate(invalidReg, { abortEarly: false });
        assert(resInvalid.error.details.length >= 2, 'Register should fail on multiple fields');
        console.log('✅ Register Schema (Invalid multiple) Passed');
    } catch (e) { console.error('❌ Register Schema Test Failed', e); }

    // 3. Test Despatch Schema (Arrays)
    try {
        const payload = {
            data: [
                {
                    serialNo: 1,
                    letterDate: '12/12/2023',
                    status: 'submitted'
                }
            ]
        };
        const { error } = saveDespatchSchema.validate(payload);
        assert(!error, 'Despatch schema should accept valid data array');
        console.log('✅ Despatch Schema (Valid array) Passed');

        const resInvalid = saveDespatchSchema.validate({ data: 'not_an_array' });
        assert(resInvalid.error, 'Despatch schema should reject string data');
        console.log('✅ Despatch Schema (Invalid type) Passed');
    } catch (e) { console.error('❌ Despatch Schema Test Failed', e); }

    // 4. Test API Schemas
    try {
        assert(!pincodeSchema.validate({ pin: '793001' }).error, 'Pincode should pass 6 digits');
        assert(pincodeSchema.validate({ pin: '123' }).error, 'Pincode should fail < 6 digits');
        
        assert(!translateSchema.validate({ text: 'hello' }).error, 'Translate should pass normal text');
        assert(translateSchema.validate({ text: '' }).error, 'Translate should fail empty text');
        console.log('✅ API Schemas Passed');
    } catch (e) { console.error('❌ API Schema Test Failed', e); }

    console.log('\n--- All Tests Completed ---');
}

runTests();
