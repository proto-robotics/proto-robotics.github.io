package org.protorobotics.code;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

/** The app: Capacitor's web view plus our own plugins. */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // our plugins register before the bridge starts
        registerPlugin(BrainFolderPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
