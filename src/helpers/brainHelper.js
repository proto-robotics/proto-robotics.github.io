/*
 * "Send to Brain": writing the program straight onto the robot's brain,
 * which shows up on the computer as a USB drive.
 *
 * The drive is picked once in a system folder dialog and remembered. From
 * then on the editor can tell whether that drive is plugged in and write
 * files to it. Two providers do this behind one interface:
 *
 *   - In a browser, the File System Access API (Chrome and Edge): a handle
 *     to the picked folder, kept in IndexedDB (the only storage that can
 *     hold one). Other browsers get nothing, and the button says so.
 *   - In the app, the BrainFolder plugin (android/.../BrainFolderPlugin.java):
 *     the system picker, a persistable permission, and writes through the
 *     platform. The handle is the folder's URI.
 */

import { Capacitor, registerPlugin } from '@capacitor/core'

/** The states {@link watchBrain} reports. */
export const BrainState = Object.freeze({
    /** Nothing here can write to a folder; the button explains when clicked. */
    UNSUPPORTED: 'unsupported',
    /** No drive has been picked yet; offer to connect one. */
    NONE: 'none',
    /** The remembered drive is plugged in (or will ask before reading). */
    READY: 'ready',
    /** The remembered drive is not plugged in right now. */
    MISSING: 'missing',
})

/**
 * Makes an error with the name the button's messages are keyed on.
 * @param {string} name 'AbortError', 'NotFoundError', or 'NotAllowedError'.
 * @param {string} message What went wrong.
 * @returns {Error} The error.
 */
const namedError = (name, message) => {
    const error = new Error(message)
    error.name = name
    return error
}

// ---- the browser: the File System Access API --------------------------------

const DB_NAME = 'proto-brain'
const STORE = 'handles'
const KEY = 'brain'

const openDb = () =>
    new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1)
        request.onupgradeneeded = () => request.result.createObjectStore(STORE)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
    })

/**
 * Runs one request against the handle store.
 * @param {'readonly'|'readwrite'} mode The transaction mode.
 * @param {(store: IDBObjectStore) => IDBRequest} action The request to make.
 * @returns {Promise<*>} The request's result.
 */
const withStore = async (mode, action) => {
    const db = await openDb()
    return new Promise((resolve, reject) => {
        const request = action(db.transaction(STORE, mode).objectStore(STORE))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
    })
}

/**
 * Makes sure the page may write to the drive, asking if needed (the
 * browser forgets the grant between visits). Must run from a click when
 * it has to ask.
 * @param {FileSystemDirectoryHandle} handle The drive.
 * @returns {Promise<boolean>} Whether writing is allowed.
 */
const ensureWritable = async (handle) => {
    const options = { mode: 'readwrite' }
    if ((await handle.queryPermission(options)) === 'granted') {
        return true
    }
    return (await handle.requestPermission(options)) === 'granted'
}

const browserProvider = {
    supported: () =>
        typeof window.showDirectoryPicker === 'function' &&
        typeof indexedDB !== 'undefined',

    remembered: async () => {
        try {
            return (
                (await withStore('readonly', (store) => store.get(KEY))) ?? null
            )
        } catch {
            return null
        }
    },

    /** Must run from a click. Throws AbortError when the dialog is cancelled. */
    connect: async () => {
        const handle = await window.showDirectoryPicker({
            id: 'proto-brain',
            mode: 'readwrite',
        })
        await withStore('readwrite', (store) => store.put(handle, KEY))
        return handle
    },

    forget: () => withStore('readwrite', (store) => store.delete(KEY)),

    /**
     * Whether the drive is plugged in: listing it fails once it is gone.
     * Without a grant it cannot be read, so it counts as present and the
     * click will find out.
     */
    reachable: async (handle) => {
        try {
            const permission = await handle.queryPermission({
                mode: 'readwrite',
            })
            if (permission === 'denied') {
                return false
            }
            if (permission === 'prompt') {
                return true
            }
            await handle.entries().next()
            return true
        } catch {
            return false
        }
    },

    send: async (handle, files) => {
        if (!(await ensureWritable(handle))) {
            throw namedError(
                'NotAllowedError',
                'Writing to the brain was not allowed.',
            )
        }
        for (const file of files) {
            const fileHandle = await handle.getFileHandle(file.name, {
                create: true,
            })
            const writable = await fileHandle.createWritable()
            await writable.write(file.text)
            await writable.close()
        }
    },
}

// ---- the app: the BrainFolder plugin ------------------------------------------

const BrainFolder = registerPlugin('BrainFolder')

/**
 * Runs a plugin call, turning its rejection into an error with the name
 * the plugin sent as the code.
 * @param {Promise<*>} call The plugin call.
 * @returns {Promise<*>} Its result.
 */
const fromPlugin = async (call) => {
    try {
        return await call
    } catch (error) {
        throw namedError(
            error?.code ?? 'Error',
            error?.message ?? String(error),
        )
    }
}

/**
 * @param {{uri?: string, name?: string, reachable?: boolean}} folder What
 *     the plugin reports.
 * @returns {{uri: string, name: string}|null} The handle, or null for none.
 */
const nativeHandle = (folder) =>
    folder?.uri ? { uri: folder.uri, name: folder.name ?? '' } : null

const nativeProvider = {
    /** The plugin is registered by the app's own code on each platform. */
    supported: () => Capacitor.isPluginAvailable('BrainFolder'),

    remembered: async () =>
        nativeHandle(await fromPlugin(BrainFolder.remembered())),

    connect: async () => nativeHandle(await fromPlugin(BrainFolder.pick())),

    forget: () => fromPlugin(BrainFolder.forget()),

    reachable: async () => {
        const folder = await fromPlugin(BrainFolder.remembered())
        return Boolean(folder?.reachable)
    },

    send: (handle, files) => fromPlugin(BrainFolder.write({ files })),
}

/** Whichever of the two this page runs on. */
const provider = Capacitor.isNativePlatform() ? nativeProvider : browserProvider

// ---- the interface the button uses -------------------------------------------

/** @returns {boolean} Whether this page can pick and write to a folder. */
export const brainSupported = () => provider.supported()

/** @returns {Promise<object|null>} The remembered drive, as a handle. */
export const rememberedBrain = () => provider.remembered()

/**
 * Asks the learner to pick the brain's drive, and remembers it.
 * Must run from a click. Throws AbortError when the dialog is cancelled.
 * @returns {Promise<object>} The picked drive, as a handle.
 */
export const connectBrain = () => provider.connect()

/** Forgets the remembered drive. */
export const forgetBrain = () => provider.forget()

/**
 * Writes files onto the brain, replacing any with the same names.
 * @param {object} handle The drive.
 * @param {{name: string, text: string}[]} files The files to write.
 * @throws {Error} With name 'NotAllowedError' when writing was refused,
 *     or 'NotFoundError' when the drive is gone.
 */
export const sendToBrain = (handle, files) => provider.send(handle, files)

/**
 * Keeps watch on the brain: reports its state now and whenever it changes
 * (checked every few seconds, since a plugged-in drive raises no event).
 * @param {(state: string, handle: object|null) => void} onState Receives a
 *     {@link BrainState} and the drive, if any.
 * @param {number} [interval=3000] Milliseconds between checks.
 * @returns {{refresh: () => void, stop: () => void}} `refresh` re-reads the
 *     remembered drive (after connecting or forgetting one); `stop` ends
 *     the watch.
 */
export const watchBrain = (onState, interval = 3000) => {
    let handle
    let lastState = null
    let checking = false
    const report = (state, current) => {
        if (state !== lastState) {
            lastState = state
            onState(state, current)
        }
    }
    const check = async () => {
        if (checking) {
            return
        }
        checking = true
        try {
            if (!provider.supported()) {
                report(BrainState.UNSUPPORTED, null)
                return
            }
            if (handle === undefined) {
                handle = await provider.remembered()
            }
            if (!handle) {
                report(BrainState.NONE, null)
                return
            }
            report(
                (await provider.reachable(handle))
                    ? BrainState.READY
                    : BrainState.MISSING,
                handle,
            )
        } catch (error) {
            // a provider that cannot even be asked (a plugin that is not
            // there, a store that cannot be opened) counts as unsupported,
            // so the button still appears and explains
            console.warn('Send to Brain is unavailable:', error)
            report(BrainState.UNSUPPORTED, null)
        } finally {
            checking = false
        }
    }
    check()
    const timer = setInterval(check, interval)
    return {
        refresh: () => {
            handle = undefined
            check()
        },
        stop: () => clearInterval(timer),
    }
}
