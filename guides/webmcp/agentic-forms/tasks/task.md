---
base_app: daily-grind
---
- can you add a coffee search form above the seasonal favorites section so both humans and ai agents can search our coffee menu? the form needs a tool name and tool description, and the search inputs should have labels or parameter descriptions. in the submit handler, make sure you prevent default submission, detect if an ai agent invoked the action, and respond with a promise of the search results. also, please style the form and its submit button with dashed outlines or background changes using the special pseudo-classes for when an agent is actively interacting with the form or when the submit action is active.
- can we add a newsletter subscription form in the footer? make it agent-enabled as well so digital assistants can sign users up for coffee deals with their email. make sure to use the event response promise API and add some glowing style for when the agent is using it.
- add a feedback and rating form for our customers. make it a declarative agent tool so their ai assistants can fill it out, and use some css highlights when an agent is interacting with it.
