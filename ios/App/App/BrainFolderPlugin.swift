import Capacitor
import UIKit
import UniformTypeIdentifiers

/**
 * The brain's drive, for the iPad app. The brain (the robot's controller)
 * shows up as a USB drive in Files; the learner picks its folder once in
 * the system picker, the app keeps a security-scoped bookmark to it, and
 * programs are written into it. The web side is src/helpers/brainHelper.js,
 * which uses the browser's own folder access where that exists and this
 * plugin in the app; the Android twin is BrainFolderPlugin.java.
 *
 * Errors are rejected with the codes the web side already understands:
 * AbortError (the picker was closed), NotFoundError (no folder, or the
 * drive is not plugged in), NotAllowedError (the folder could not be
 * written).
 */
@objc(BrainFolderPlugin)
public class BrainFolderPlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {
    public let identifier = "BrainFolderPlugin"
    public let jsName = "BrainFolder"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "pick", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "remembered", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "forget", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "write", returnType: CAPPluginReturnPromise),
    ]

    private static let bookmarkKey = "brainFolderBookmark"

    /** The call waiting on the picker, while it is open. */
    private var pickCall: CAPPluginCall?

    /** Opens the system folder picker; resolves with the picked folder. */
    @objc func pick(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.folder])
            picker.delegate = self
            picker.allowsMultipleSelection = false
            self.pickCall = call
            self.bridge?.viewController?.present(picker, animated: true)
        }
    }

    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let call = pickCall else { return }
        pickCall = nil
        guard let url = urls.first else {
            call.reject("The folder picker was closed.", "AbortError")
            return
        }
        let accessed = url.startAccessingSecurityScopedResource()
        defer { if accessed { url.stopAccessingSecurityScopedResource() } }
        do {
            // the bookmark carries the access to the folder across launches
            let bookmark = try url.bookmarkData()
            UserDefaults.standard.set(bookmark, forKey: Self.bookmarkKey)
            call.resolve(Self.describe(url, reachable: true))
        } catch {
            call.reject("The folder could not be remembered: \(error.localizedDescription)", "NotAllowedError")
        }
    }

    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        pickCall?.reject("The folder picker was closed.", "AbortError")
        pickCall = nil
    }

    /**
     * The remembered folder, if any, and whether it can be reached right
     * now (an unplugged drive cannot). Resolves with an empty object when
     * no folder has been picked.
     */
    @objc func remembered(_ call: CAPPluginCall) {
        guard let url = Self.rememberedURL() else {
            call.resolve([:])
            return
        }
        call.resolve(Self.describe(url, reachable: Self.isReachable(url)))
    }

    /** Forgets the remembered folder. */
    @objc func forget(_ call: CAPPluginCall) {
        UserDefaults.standard.removeObject(forKey: Self.bookmarkKey)
        call.resolve()
    }

    /**
     * Writes files into the remembered folder, replacing any with the same
     * names. Takes `files`: an array of `{name, text}`.
     */
    @objc func write(_ call: CAPPluginCall) {
        guard let url = Self.rememberedURL(), Self.isReachable(url) else {
            call.reject("The brain is not plugged in.", "NotFoundError")
            return
        }
        guard let files = call.getArray("files", JSObject.self) else {
            call.reject("No files to write.", "NotAllowedError")
            return
        }
        let accessed = url.startAccessingSecurityScopedResource()
        defer { if accessed { url.stopAccessingSecurityScopedResource() } }
        do {
            for file in files {
                guard let name = file["name"] as? String, let text = file["text"] as? String else {
                    continue
                }
                try Self.writeFile(named: name, text: text, in: url)
            }
            call.resolve()
        } catch {
            call.reject("The brain could not be written to: \(error.localizedDescription)", "NotAllowedError")
        }
    }

    /** Writes one file, through the file coordinator the drive's provider expects. */
    private static func writeFile(named name: String, text: String, in folder: URL) throws {
        let target = folder.appendingPathComponent(name)
        var coordinationError: NSError?
        var writeError: Error?
        NSFileCoordinator().coordinate(writingItemAt: target, options: .forReplacing, error: &coordinationError) { url in
            do {
                try Data(text.utf8).write(to: url, options: .atomic)
            } catch {
                writeError = error
            }
        }
        if let error = coordinationError {
            throw error
        }
        if let error = writeError {
            throw error
        }
    }

    /** The remembered folder's URL, from its bookmark. */
    private static func rememberedURL() -> URL? {
        guard let bookmark = UserDefaults.standard.data(forKey: bookmarkKey) else {
            return nil
        }
        var stale = false
        return try? URL(resolvingBookmarkData: bookmark, bookmarkDataIsStale: &stale)
    }

    /** Whether the folder is there and writable right now. */
    private static func isReachable(_ url: URL) -> Bool {
        let accessed = url.startAccessingSecurityScopedResource()
        defer { if accessed { url.stopAccessingSecurityScopedResource() } }
        var isDirectory: ObjCBool = false
        let manager = FileManager.default
        return manager.fileExists(atPath: url.path, isDirectory: &isDirectory)
            && isDirectory.boolValue
            && manager.isWritableFile(atPath: url.path)
    }

    private static func describe(_ url: URL, reachable: Bool) -> [String: Any] {
        return ["uri": url.absoluteString, "name": url.lastPathComponent, "reachable": reachable]
    }
}
