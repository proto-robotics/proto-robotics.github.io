import { tag } from 'ellipsi'
import { EditMode } from './editMode'

export default (vocab) => {
    const LineEditor = tag('line-editor',
        'line',
    )

    return new EditMode(LineEditor, () => {}, () => {})
}
