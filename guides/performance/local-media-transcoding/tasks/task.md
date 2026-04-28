---
base_app: daily-grind
---
- hey, can you add a 'share your brew' section to the home page? i want a button that captures 5 seconds of video from the user's camera and encodes it locally in the browser so we don't have to send raw video to our servers. it should handle the video at the frame level to keep it as fast and private as possible.
- make sure the recording process is robust by checking if the user's hardware can actually support the high-quality video settings before it starts. also, it's really important that we manage memory carefully by cleaning up each video frame immediately after it's processed so the site doesn't lag.
- i'd like the recorder to provide some feedback during the process, maybe show a status message that updates as it processes the video chunks. and make sure it finishes processing all the pending data before it considers the recording complete.
