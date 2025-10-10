import { tag } from 'ellipsi'
import { EditorMode } from './editorMode'

export default (vocab) => {
    const LineEditor = tag('line-editor',
        'line',
    )

    return new EditorMode("line", LineEditor, () => {}, () => {})
}
