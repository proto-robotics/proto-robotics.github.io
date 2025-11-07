import { autocompletion, completeFromList } from '@codemirror/autocomplete'
import { defaultKeymap, indentWithTab } from '@codemirror/commands'
import { python } from '@codemirror/lang-python'
import { lintGutter } from '@codemirror/lint'
import { keymap } from '@codemirror/view'
import { basicSetup, EditorView } from 'codemirror'
import { tomorrow } from 'thememirror'

export const new_base_view = () => {
    const view = new EditorView({
        doc: 'import make\n\n',
        extensions: [
            basicSetup,
            python(),
            tomorrow,
            customLinter,
            lintGutter(),
            autocompletion({
                override: [completeFromList(completions)],
            }),
            hoverExtension,
            keymap.of([defaultKeymap, indentWithTab]),
        ],
    })

    return view
}
