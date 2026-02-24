# Defining use cases and guidance for web-features

Follow this document to help us create guidance for web tooling. We’ll iterate on this process as we go along, but let’s get going. Use the chat below for any questions.

## Resources

* [Chrome Developers](https://developer.chrome.com/) - Best practice on new web platform features in Chrome 
* [MDN](https://developer.mozilla.org/en-US/) - Comprehensive web platform API reference documentation
* [webstatus.dev](https://webstatus.dev/) - Web feature status across browsers
* [web-features](https://github.com/web-platform-dx/web-features) - Web feature tracking
* [web.dev](https://web.dev/) - Best practice web development guidance from the Chrome team
* [chromestatus.com](https://chromestatus.com/) - Chrome feature status

## Workflow

1. **Step 1: Identify use cases.**   
   Each feature should have up to five use cases, which are ways developers might use that feature.  
2. **Step 2: Create guidance for agents.**  
   For each of the use cases we need step by step guidance written so that a coding tool can use that feature.  
3. TO DO (validation, evals, etc.)

## Step 1: Create use cases

IMPORTANT! Use cases should be action-oriented descriptions of what a developer would be trying to accomplish. For example, the distinct use cases for scroll-driven animations might be: Synchronize animation progress with the scroll distance of a container Synchronize animation progress with an element's position relative to the viewport.

1. Navigate to (or create) the relevant high-level web development discipline subdirectory under the [guides](https://github.com/GoogleChrome/guidance/tree/main/guides) directory (e.g. performance use cases should go under the [performance directory](https://github.com/GoogleChrome/guidance/tree/main/guides/performance)).  
2. Identify 2-5 use cases for the feature you're covering.  
3. For each use case:  
   1. Create a new subdirectory in this directory with a slugified version of the use case name (e.g. `prioritize-lcp-image`)  
   2. Within this new use-case subdirectory, create the following files:  
      1. guide.md  
      2. expectations.md  
      3. demo.html  
   3. Within the `guide.md` file, add YAML frontmatter with `name`, `description`, and `web-feature-ids` fields, and populate these fields with the relevant information:  
      1. The `name` field should match the directory name (the slugified use case)  
      2. The `description` field should describe the use case in detail (but also be less than 1024 characters)  
      3. The `web-feature-ids` field should be the ID of the feature you're working on  

IMPORTANT: See the following PR for a complete example implementing the above steps for the `fetchlater` feature: [https://github.com/GoogleChrome/guidance/pull/23](https://github.com/GoogleChrome/guidance/pull/23)

TIP: use Gemini Deep Research to help identify use cases. A prompt like the following works well: 

```
Thoroughly review the following resources for the `fetchLater()` API, as well as any additional resources you can find on the web, and identify the top 2-5 developer use cases for this API.

 - https://developer.mozilla.org/en-US/docs/Web/API/Window/fetchLater 
 - https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Deferred_Fetch 
 - https://developer.chrome.com/blog/fetch-later-api-origin-trial 
 - https://github.com/WICG/pending-beacon/blob/main/docs/fetch-later-api.md 
```

## Step 2: Create guidance

IMPORTANT! While you can use Gemini to help write the guidance, keep in mind that the primary reason we're creating this guidance is because AI models aren't currently very knowledgeable about these features. Make sure you thoroughly review any guidance that AI generates, as you are ultimately responsible for the accuracy of this guidance.

1. In your editor, open the `guide.md`, `expectations.md` and `demo.html` files for each of the use cases created in [step 1](?tab=t.0#bookmark=id.8eufr1vaasxe).  
   * **guide.md –** Write the guidance to implement each use case, follow the [best practices](?tab=t.0#bookmark=id.nd1z7yekqbg7) outlined below.  
   * **expectations.md** – In natural language, outline a set of expectations that should be true if the agent properly followed the instructions in `guide.md`.  
   * **demo.html** – an example of the use case implemented in a way that follows all of the expectations in `expecations.md`. This file will be used to ensure future evals are working properly (e.g. it should score 100%).

| TIP: See the following PR for an example implementing the guide.md files in the above steps (expectations and demo coming shortly\!): [https://github.com/GoogleChrome/guidance/pull/88](https://github.com/GoogleChrome/guidance/pull/88) |
| :---- |

**Best practices for writing guidance:**

* DO follow the overall structure of the example above.  
* DO ensure that each guide is a markdown file, with a frontmatter section at the top consisting of a description of the use case, a list of applicable web-feature IDs, and a list of primary sources that include the same best practices in a human-readable format.  
* DO create a use case description that helps agents decide whether to consume the guide, so they should follow a formula like "<do thing> <with feature>", for example "Create dynamic, accessible color systems using modern color syntax and relative colors".  
* DO Search [webstatus.dev](https://webstatus.dev/) for corresponding web-feature IDs. If the feature is very new, an ID might need to be created async in the [web-features](https://github.com/web-platform-dx/web-features/issues/new?template=new-feature.yml) repo.  
* Links to the primary sources are not provided to the agent (all relevant information should be contained directly in the guide) but the metadata is used to keep both the sources and the guides up to date if either one changes. Ideally, nothing should be new. All of the guidance provided in the doc should be found in the primary sources.  
* DO keep guidance short and to the point. Use explicit instructions like "DO" and "DO NOT" to ensure clarity. If you find that coding agents are still not following the guidance, even stronger language like "MANDATORY:" can be strangely effective.  
* DO include short blocks of sample code as needed to illustrate correct usage. Nuanced code should be commented to provide agents with more context.  
* DO include a "Fallback strategies" section, with subsections corresponding to each web-feature ID used by the guidance. If the feature is not yet Baseline Widely available at the time of writing, there must be a prescribed fallback strategy, which could include guidance for feature detection, polyfills, alternate code, or any other graceful degradation approach.  
* DO evaluate how well coding agents are able to adhere to your guidance, and iterate until success rates are nearly 100%.  
* Chrome's first party developer docs (web.dev, developer.chrome.com) must reflect all of the guidance given to coding agents. If we have no existing content for the use case you are writing a guide for, add a row to the **1st party docs needed** tab of the [sheet](https://docs.google.com/spreadsheets/d/109WjULhDwBXP9EgSdKYpN4aHBEG5b3BGkipTYXj0dxA/edit?gid=919049638#gid=919049638), with details of what should be covered. If we have content that needs updating for the best practice for this use case, add a link to the existing content and details of what needs changing.   
* If you identify missing or incorrect **MDN documentation**, raise a bug in the [MDN tracker](https://b.corp.google.com/issues?q=status:open%20componentid:1464943&s=created_time:desc) and assign it to rachelandrew@.
