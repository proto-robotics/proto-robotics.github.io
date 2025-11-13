import { a } from 'ellipsi'
import JSZip from 'jszip'

/**
 * Saves multiple files as a zip file.
 * @param {string} zipName The name of the zip file.
 * @param {{name: string, text: string}[]} files The files to be saved in
 * the zip.
 */
export const saveFilesInZip = (zipName, files) => {
    const zip = new JSZip()

    for (const file of files) {
        zip.file(file.name, file.text)
    }

    zip.generateAsync({ type: 'base64' }).then((encoding) => {
        const dummyLink = a({
            download: zipName + ".zip",
            href: 'data:application/zip;base64,' + encoding,
        })
        dummyLink.dispatchEvent(new MouseEvent('click'))
    })
}
