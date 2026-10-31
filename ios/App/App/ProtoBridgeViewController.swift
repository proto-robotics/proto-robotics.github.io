import Capacitor

/** The app's web view: Capacitor's, plus our own plugins (set as the
 * storyboard's view controller class). */
class ProtoBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(BrainFolderPlugin())
    }
}
