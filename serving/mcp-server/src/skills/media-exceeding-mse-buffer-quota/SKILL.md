---
description: |
  Handles QuotaExceededError when exceeding Media Source Extensions buffering limits by implementing strategies to manage buffer space.
filename: exceeding-mse-buffer-quota
category: media
---

# Exceeding the Buffering Quota with Media Source Extensions

When working with Media Source Extensions (MSE), you will eventually encounter a `QuotaExceededError` if the buffer becomes too full. This article outlines effective strategies for managing and resolving this common issue.

## Understanding QuotaExceededError

A `QuotaExceededError` is thrown when you attempt to append more data to a `SourceBuffer` than it can hold. This error is a signal that your buffer is over capacity.

In Chrome, this error typically manifests in the console with a message indicating an "Out of memory" or similar, rather than explicitly stating `QuotaExceededError`. To see the exact error name, you may need to set a breakpoint and inspect the error object in your debugger's watch or scope window.

It's important to note that there isn't a direct API to query the exact buffer limit or the amount of data currently appended. You must manage this information yourself.

## Browser Behavior Differences

Browser implementations of buffer management can vary:

*   **Safari:** Historically, Safari has handled buffer overflow differently. Instead of throwing an error, it attempts to free up space by removing frames, starting with older content. This behavior is detailed in Webkit changesets.
*   **Chrome, Edge, Firefox:** These browsers generally throw the `QuotaExceededError` when the buffer limit is reached.

For comprehensive testing across different browsers, François Beaufort's [source buffer limit test](https://beaufortfrancois.github.io/sandbox/media/source-buffer-limit.html) can be a useful tool.

## Typical Buffer Limits

The precise amount of data a `SourceBuffer` can hold varies significantly between browsers and even devices. The table below provides general upper limits at the time of writing:

|        | Chrome | Chromecast* | Firefox | Safari | Edge    |
| :----- | :----- | :---------- | :------ | :----- | :------ |
| Video  | 150MB  | 30MB        | 100MB   | 290MB  | Unknown |
| Audio  | 12MB   | 2MB         | 15MB    | 14MB   | Unknown |

\* Or other limited memory Chrome devices.

These numbers can be lower under system memory pressure.

## Strategies for Handling QuotaExceededError

Since you cannot directly query buffer limits, you must infer them by handling `QuotaExceededError`. A combination of the following approaches is often the most effective:

1.  **Remove unneeded data and re-append:** This involves removing older or less relevant data from the buffer to make space for new data.
2.  **Append smaller fragments:** Instead of appending large chunks of data, break them into smaller, more manageable pieces.
3.  **Lower the playback resolution:** If your content has multiple quality levels, switching to a lower resolution can reduce the amount of data needed in the buffer.

### 1. Remove Unneeded Data and Re-append

This strategy is more accurately described as "Remove least-likely-to-be-used-soon data, and then retry append of data likely-to-be-used-soon."

**Important Considerations:**

*   **`SourceBuffer.updating` Flag:** You can only call `SourceBuffer.remove()` when the `updating` flag is `false`. If it's `true`, you must call `SourceBuffer.abort()` first.
*   **Impact on Playback:** Removing data can negatively impact playback, especially if you need to replay or loop content. If a user seeks to a part of the video where data has been removed, you'll need to re-append it.
*   **Conservative Removal:** Be cautious when removing data near the current playback position (`currentTime`). Removing frames from the currently playing group of pictures, especially from a keyframe, can cause playback stalls. It's best to remove data that is no longer needed, typically older content.
*   **Safari `abort()` Issues:** Older versions of Safari (9 and 10) have known issues with `SourceBuffer.abort()`. Workarounds, such as stubbing out an empty `abort()` function, may be necessary.

### 2. Append Smaller Fragments

This approach involves segmenting the data you intend to append into smaller pieces. The size of these fragments can be adjusted based on your needs and the observed behavior of `QuotaExceededError`. This method has the advantage of not requiring additional network requests, which can be beneficial for users with metered data plans.

```js
const pieces = new Uint8Array([data]); // Assuming 'data' is your complete byte array

(function appendFragments(pieces) {
    if (sourceBuffer.updating) {
        // If the buffer is updating, wait and retry.
        // A more robust implementation might use an event listener for 'updateend'.
        setTimeout(() => appendFragments(pieces), 100);
        return;
    }
    
    let appendedSuccessfully = false;
    for (const piece of pieces) {
        try {
            sourceBuffer.appendBuffer(piece);
            appendedSuccessfully = true;
        } catch (e) {
            if (e.name !== 'QuotaExceededError') {
                throw e; // Re-throw unexpected errors
            }

            // Reduce the size of the current piece and try again.
            // This is a simplified reduction schedule.
            const currentPieceLength = piece.byteLength;
            if (currentPieceLength === 0) {
                throw new Error('MediaSource threw QuotaExceededError with zero-byte fragment.');
            }

            const reductionAmount = Math.max(1024 * 1024, currentPieceLength * 0.2); // Reduce by at least 1MB or 20%
            const newSize = Math.max(0, currentPieceLength - reductionAmount);

            if (newSize === 0 && currentPieceLength > 0) {
                 // If reduction makes it too small and we still have data, fail.
                throw new Error('MediaSource threw QuotaExceededError: Cannot append smaller fragments.');
            }

            // Re-queue the current piece with reduced size and the remaining part.
            const reducedPiece = piece.slice(0, newSize);
            const remainingPiece = piece.slice(newSize);
            
            // Create a new array for the next iteration, replacing the failed piece
            // with its reduced version and the remaining part.
            const updatedPieces = [];
            let replaced = false;
            for(const p of pieces) {
                if (p === piece && !replaced) {
                    if (reducedPiece.byteLength > 0) updatedPieces.push(reducedPiece);
                    if (remainingPiece.byteLength > 0) updatedPieces.push(remainingPiece);
                    replaced = true;
                } else {
                    updatedPieces.push(p);
                }
            }
            appendFragments(updatedPieces);
            return; // Exit after handling the error and re-queuing
        }
    }
    // If all pieces were appended successfully, you might want to signal completion
    // or proceed to the next batch.
})(pieces);
```

### 3. Lower the Playback Resolution

This technique involves switching to a lower-quality representation of the media. This can be combined with other strategies.

**Key Points:**

*   **Initialization Segment:** You must append a new initialization segment for the chosen lower resolution. This segment describes the media format for the subsequent segments.
*   **Presentation Timestamps (PTS):** Ensure the PTS of the appended media segments align closely with the buffered data to avoid stuttering or stalls. Avoid overlapping the playhead, as this will cause errors.
*   **Seeking Interruption:** Be aware that seeking to a new location might interrupt playback until the seek operation is complete.

By understanding these strategies and their nuances, you can effectively manage `QuotaExceededError` and deliver a robust media playback experience using Media Source Extensions.