import React, { useEffect, useState, useCallback } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import type { TextFormatType } from 'lexical';
import { FORMAT_TEXT_COMMAND, SELECT_ALL_COMMAND } from 'lexical';
import { $getSelection, $isRangeSelection } from 'lexical';

const ToolbarButton = ({ format, label }: { format: TextFormatType, label: string }) => {
    const [editor] = useLexicalComposerContext();
    const [isFormatted, setIsFormatted] = useState(false);

    const update = useCallback(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
            setIsFormatted(selection.hasFormat(format));
        }
    }, [format]);

    useEffect(() => {
        return editor.registerUpdateListener(({ editorState }) => {
            editorState.read(() => {
                update();
            });
        });
    }, [editor, update]);

    return (
        <button
            type="button" // prettier-ignore
            onClick={() => {
                editor.getEditorState().read(() => {
                    const selection = $getSelection();
                    if (
                        $isRangeSelection(selection) &&
                        !selection.isCollapsed()
                    ) {
                        editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
                    } else {
                        editor.dispatchCommand(SELECT_ALL_COMMAND, undefined);
                        editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
                    }
                });
            }}
            className={`px-3 py-1 rounded-md text-sm font-bold ${isFormatted ? 'bg-gray-300 text-gray-900' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`} // prettier-ignore
            aria-label={`Format ${format}`}
        >
            {label}
        </button>
    );
};

export default function ToolbarPlugin() {
    return (
        <div className="flex items-center gap-1 p-2 bg-gray-50 border-b border-gray-300 rounded-t-md">
            <ToolbarButton format="bold" label="B" />
            <ToolbarButton format="italic" label="I" />
            <ToolbarButton format="underline" label="U" />
        </div>
    );
}