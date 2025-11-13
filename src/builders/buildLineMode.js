import { tag, button, on } from 'ellipsi'
import { EditorMode } from '../classes/editorMode'
import { saveFilesInZip } from '../helpers/zipHelper'
import { closePopUpEvent, PopUp } from '../helpers/popUpHelper'
import { getViewText, newView, setViewText } from '../helpers/codeMirrorHelper'
import { checkSyntax } from '../helpers/pyodideHelper'

export default (vocab) => {
    const view = newView()
    view.dom.id = 'line-editor-canvas'

    const previousState = localStorage.getItem('codeMirrorState')
    if (previousState) {
        setViewText(view, previousState)
    }

    const saveState = () => {
        localStorage.setItem('codeMirrorState', getViewText(view))
    }
    view.dom.addEventListener('keydown', saveState)
    view.dom.addEventListener('focus', saveState)
    view.dom.addEventListener('blur', saveState)

    const saveCode = (ProjectNameInput) => {
        const projectName = ProjectNameInput?.value || 'proto'

        saveFilesInZip(projectName, [
            {
                name: 'main.py',
                text: view.state.doc.toString(),
            },
        ])
    }

    const loadCode = (ProjectNameInput) => {
        const FileInput = tag('input', {
            type: 'file',
            accept: '.py',
        })

        const LoadButton = button(
            'Load project',
            on('click', () => {
                if (FileInput.files.length < 1) {
                    // Wait for them to add a file
                    return
                }

                const file = FileInput.files[0]

                // Set project name to the file name
                const projectName = file.name.replaceAll('.json', '')
                ProjectNameInput.value = projectName
                localStorage.setItem('projectName', projectName)

                // Load the contents of the file
                const reader = new FileReader()
                reader.readAsText(file, 'utf-8')
                reader.onload = (event) => {
                    setViewText(view, event.target.result)
                    saveState()
                }

                // Close the pop up
                LoadPopUp.dispatchEvent(new Event(closePopUpEvent))
            }),
        )

        const LoadPopUp = PopUp(
            'Find the zip file for the project in your downloads folder, and ',
            'choose the file inside it named main.py.',
            FileInput,
            LoadButton,
        )

        document.body.appendChild(LoadPopUp)
    }

    const LineEditor = tag(
        'line-editor',
        button(
            'Verify',
            { id: 'verify-button' },
            on('click', async () => {
                const result = await checkSyntax(getViewText(view))
                const lintingEvent = new CustomEvent('perform-linting', {
                    detail: result,
                })
                view.dom.dispatchEvent(lintingEvent)
            }),
        ),
        view.dom,
        on('click', () => view.focus()),
    )

    return new EditorMode('line', LineEditor, saveCode, loadCode)
}
