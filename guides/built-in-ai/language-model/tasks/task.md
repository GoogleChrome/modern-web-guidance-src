---
base_app: daily-grind
---
- add a new section at the bottom of the container with a textarea and a button with id 'ask-the-barista'. when clicked, use the built-in ai to answer questions about the 'Maple Oat Latte' or 'Cold Brew'. stream the response into a div with id 'barista-answer' and make sure to check if the model is available before starting. also include a customer feedback analyzer section with a button with id 'sentiment-btn' that uses the local ai to output a structured JSON response containing a score and category. also include a conversation branching section with a button with id 'clone-btn' that clones active sessions and tracks context usage while cleaning up unneeded sessions. follow modern client-side AI best practices for session management, progress monitoring, and resource cleanup.
- i need a way to categorize customer feedback. can you build a function that takes a text comment and uses the browser's ai to return a json object with a 'score' and a 'category' like 'service' or 'flavor'? it should strictly return json without any extra chat.
- make the seasonal favorites section more dynamic by using the local ai to generate a 'daily fact' about each type of coffee when the page loads.
- can we add an image upload field so users can show us their coffee art? then have the local ai describe the art and give it a 'creative rating'.
