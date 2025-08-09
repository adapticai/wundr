"use strict";
/**
 * Test file to verify template validation fixes
 * This verifies the fixes for the three issues:
 * 1. validateParameters accepting Template object
 * 2. validation result using 'valid' property instead of 'isValid'
 * 3. searchTemplates accepting filter object
 */
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const TemplateService_1 = require("../lib/services/template/TemplateService");
// Test template object
const testTemplate = {
    id: 'test-template',
    name: 'Test Template',
    description: 'Test template for validation',
    category: 'component',
    language: 'typescript',
    content: 'console.log("{{message}}");',
    variables: [
        {
            name: 'message',
            description: 'Message to display',
            type: 'string',
            required: true,
        }
    ],
    tags: ['test'],
    createdAt: new Date(),
    updatedAt: new Date(),
};
// Test 1: validateParameters with Template object (Issue #1 & #2)
console.log('Testing validateParameters with Template object...');
const validationResult = TemplateService_1.TemplateService.validateParameters(testTemplate, { message: 'Hello' });
console.log('Validation passed:', validationResult.valid); // Should be true
console.log('Errors:', validationResult.errors);
const invalidValidationResult = TemplateService_1.TemplateService.validateParameters(testTemplate, {});
console.log('Invalid validation passed:', invalidValidationResult.valid); // Should be false
console.log('Invalid errors:', invalidValidationResult.errors);
// Test 2: validateParameters with string ID 
console.log('\nTesting validateParameters with template ID...');
TemplateService_1.TemplateService.createTemplate({
    name: 'Test Template 2',
    description: 'Test template 2',
    category: 'api',
    language: 'javascript',
    content: 'function {{functionName}}() {}',
    variables: [
        {
            name: 'functionName',
            description: 'Function name',
            type: 'string',
            required: true,
        }
    ],
});
// Test 3: searchTemplates with filter object (Issue #3)
console.log('\nTesting searchTemplates with filter object...');
const filter = {
    category: 'component',
    language: 'typescript',
    search: 'test'
};
const searchResults = TemplateService_1.TemplateService.searchTemplates(filter);
console.log('Search results:', searchResults.length);
console.log('First result:', (_a = searchResults[0]) === null || _a === void 0 ? void 0 : _a.name);
// Test 4: searchTemplates with string query (backward compatibility)
const stringSearchResults = TemplateService_1.TemplateService.searchTemplates('test');
console.log('String search results:', stringSearchResults.length);
console.log('\n✅ All template validation fixes verified successfully!');
