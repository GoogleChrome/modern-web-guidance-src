---
base_app: daily-grind
---
- add a live roastery camera section below the seasonal favorites. connect to a websocket at ws://localhost:9000/live-roast to get the raw video data and draw it onto a canvas element with id 'roastery-view'. the video needs to be rendered with minimal delay as soon as the data arrives so it feels truly live.
- can you add a 'watch your drink' feature? it should be a new card in the grid that shows a real-time video feed from the bar. it needs to be super fast and interactive with no buffering.
- i want the live video feed to stay smooth even when the page is busy. can you make sure the video decoding doesn't get interrupted by other page activity, and ensure the canvas 'roastery-view' always matches the size of the incoming video?
- the live stream is using h.264 baseline. make sure the feed is optimized for the lowest possible latency and uses hardware power if available, and be careful not to leak any memory as the frames come through.
