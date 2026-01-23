---
description: Provide guidance on effective testing strategies to determine what to test and what to avoid, ensuring efficient and maintainable code.
filename: testing-best-practices
category: testing
---

# To test or not to test, a technical perspective

Determine what you need to test and what you can rule out.

## General guidelines and patterns

It's worth noting that specific patterns and points are crucial, regardless of whether you're conducting unit, integration, or end-to-end tests. These principles can and should be applied to both types of testing, so they are a good place to start.

### Keep it simple

When it comes to writing tests, one of the most important things to remember is to keep it simple. The main production code takes up significant space, leaving little room for additional complexity. Prioritize simplicity in testing, as your test should feel like an assistant and not like a complex mathematical formula. You should be able to understand your test's intent at first glance. Aim for simplicity in all types of tests; the more complex a test is, the more critical it is to simplify it.

### Test what's worth it

Focus your tests and ensure they are meaningful. Don't create tests just for the sake of coverage—they should always have a purpose.

### Don't test implementation details

Avoid designing tests to test implementation details, such as using selectors in components or end-to-end tests. Implementation details are things that users of your code will not typically use, see, or even know about. This can lead to false negatives and false positives. Instead, consider what users will see or interact with, and make tests dependent on those things. For example, choose selectors that are less prone to change, like data-attributes instead of CSS selectors.

### Mocking: Don't lose control

Mocking is used in unit and sometimes integration testing to create fake data or components to simulate dependencies, allowing for isolated testing. Mocks can improve predictability, separation of concerns, and performance. However, be mindful that mocks can affect test accuracy as they are not real user experiences.

#### Should you mock in end-to-end tests?

Generally, no. However, mocking can be a lifesaver in specific scenarios, like when a third-party service sandbox is malfunctioning. In such cases, it might be more beneficial to lessen the dependency on services you cannot control. Use mocking carefully in integration or end-to-end tests, as it decreases the confidence level of your tests.

## Test specifics: Dos and don'ts

### What belongs to a good unit test?

An ideal and effective unit test should:
- Concentrate on specific aspects.
- Operate independently.
- Encompass small-scale scenarios.
- Use descriptive names.
- Follow the AAA pattern if applicable.
- Guarantee comprehensive test coverage.

| Do ✅ | Don't ❌ |
| --- | --- |
| Keep the tests as small as possible. Test one thing per test case. | Write tests over large units. |
| Always keep tests isolated and mock the things you need which are outside your unit. | Include other components or services. |
| Keep tests independent. | Rely on previous tests or share test data. |
| Cover different scenarios and paths. | Limit yourself to the happy path or negative tests at maximum. |
| Use descriptive test titles, so you can immediately see what your test is about. | Test by function name only, not being descriptive enough as a result: `testBuildFoo()` or `testGetId()`. |
| Aim for good code coverage or a broader range of test cases. | Test from every class down to database (I/O) level. |

### What belongs to a good integration test?

A great integration test should:
- Simulate interactions between components.
- Cover real-world scenarios, and use mocks or stubs.
- Consider performance.

| Do ✅ | Don't ❌ |
| --- | --- |
| Test the integration points: verify that each unit works together gracefully when integrated with each other. | Test each unit in isolation—that's what unit tests are for. |
| Test real-world scenarios: use test data derived from real-world data. | Use repetitive auto-generated test data or other data which doesn't reflect real-world use cases. |
| Use mocks and stubs for external dependencies to maintain control of your complete test. | Create dependencies on third-party services, for example, network requests to outside services. |
| Use a clean-up routine before and after each test. | Forget to use clean-up measures inside your tests, otherwise this can lead to test failures or false positives, due to lack of proper test isolation. |

### What belongs to a good end-to-end test?

A comprehensive end-to-end test should:
- Replicate user interactions.
- Encompass vital scenarios.
- Span multiple layers.
- Manage asynchronous operations.
- Verify results.
- Account for performance.

| Do ✅ | Don't ❌ |
| --- | --- |
| Use API-driven shortcuts. | Use UI interactions for every step, including the `beforeEach` hook. |
| Use a clean-up routine before each test. Take even more care of test isolation than you do in unit and integration tests because there's a higher risk of side effects here. | Forget to clean up after each test. If you don't clean up the leftover state, data or side effects, they will affect other tests executed later. |
| Regard end-to-end tests as system tests. This means you need to test the whole application stack. | Test each unit in isolation—that's what unit tests are for. |
| Use minimal or no mocking inside the test. Consider carefully if you want to mock external dependencies. | Rely heavily on mocks. |
| Consider performance and workload by, for example, not over-testing large scenarios in the same test. | Cover large workflows without using shortcuts. |