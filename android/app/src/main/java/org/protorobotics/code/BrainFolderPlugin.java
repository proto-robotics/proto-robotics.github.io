package org.protorobotics.code;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import androidx.documentfile.provider.DocumentFile;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * The brain's drive, for the Android app. The brain (the robot's
 * controller) shows up as a USB drive; the learner picks its folder once in
 * the system picker (the Storage Access Framework), the app keeps a
 * persistable permission to it, and programs are written into it through
 * the content resolver. The web side is src/helpers/brainHelper.js, which
 * uses the browser's own folder access where that exists and this plugin
 * in the app.
 *
 * Errors are rejected with the codes the web side already understands:
 * AbortError (the picker was cancelled), NotFoundError (no folder, or the
 * drive is not plugged in), NotAllowedError (the folder could not be
 * written).
 */
@CapacitorPlugin(name = "BrainFolder")
public class BrainFolderPlugin extends Plugin {
    private static final String PREFS = "brain";
    private static final String KEY_URI = "uri";
    private static final int ACCESS_FLAGS =
        Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION;

    /** Opens the system folder picker; resolves with the picked folder. */
    @PluginMethod
    public void pick(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(ACCESS_FLAGS | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(call, intent, "pickResult");
    }

    @ActivityCallback
    private void pickResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }
        Intent data = result.getData();
        Uri uri = data == null ? null : data.getData();
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) {
            call.reject("The folder picker was closed.", "AbortError");
            return;
        }
        getContext().getContentResolver().takePersistableUriPermission(uri, ACCESS_FLAGS);
        prefs().edit().putString(KEY_URI, uri.toString()).apply();
        call.resolve(describe(uri));
    }

    /**
     * The remembered folder, if any, and whether it can be reached right
     * now (an unplugged drive cannot). Resolves with an empty object when
     * no folder has been picked.
     */
    @PluginMethod
    public void remembered(PluginCall call) {
        String stored = prefs().getString(KEY_URI, null);
        call.resolve(stored == null ? new JSObject() : describe(Uri.parse(stored)));
    }

    /** Forgets the remembered folder and gives its permission back. */
    @PluginMethod
    public void forget(PluginCall call) {
        String stored = prefs().getString(KEY_URI, null);
        if (stored != null) {
            try {
                getContext().getContentResolver()
                    .releasePersistableUriPermission(Uri.parse(stored), ACCESS_FLAGS);
            } catch (SecurityException ignored) {
                // the permission was already gone
            }
            prefs().edit().remove(KEY_URI).apply();
        }
        call.resolve();
    }

    /**
     * Writes files into the remembered folder, replacing any with the same
     * names. Takes `files`: an array of `{name, text}`.
     */
    @PluginMethod
    public void write(PluginCall call) {
        String stored = prefs().getString(KEY_URI, null);
        DocumentFile folder = stored == null ? null : folderAt(Uri.parse(stored));
        if (folder == null) {
            call.reject("The brain is not plugged in.", "NotFoundError");
            return;
        }
        JSArray files = call.getArray("files");
        if (files == null) {
            call.reject("No files to write.", "NotAllowedError");
            return;
        }
        try {
            for (int i = 0; i < files.length(); i++) {
                JSONObject file = files.getJSONObject(i);
                writeFile(folder, file.getString("name"), file.getString("text"));
            }
            call.resolve();
        } catch (JSONException | IOException | SecurityException e) {
            call.reject("The brain could not be written to: " + e.getMessage(), "NotAllowedError");
        }
    }

    private void writeFile(DocumentFile folder, String name, String text) throws IOException {
        DocumentFile target = folder.findFile(name);
        if (target == null) {
            // a generic type keeps the name as given; a text type could get
            // ".txt" appended by the drive's provider
            target = folder.createFile("application/octet-stream", name);
        }
        if (target == null) {
            throw new IOException("could not create " + name);
        }
        try (OutputStream out =
                 getContext().getContentResolver().openOutputStream(target.getUri(), "wt")) {
            if (out == null) {
                throw new IOException("could not open " + name);
            }
            out.write(text.getBytes(StandardCharsets.UTF_8));
        }
    }

    /** The folder at a tree URI, or null when it cannot be used right now. */
    private DocumentFile folderAt(Uri uri) {
        try {
            DocumentFile folder = DocumentFile.fromTreeUri(getContext(), uri);
            return folder != null && folder.exists() && folder.canWrite() ? folder : null;
        } catch (SecurityException | IllegalArgumentException e) {
            return null;
        }
    }

    private JSObject describe(Uri uri) {
        DocumentFile folder = folderAt(uri);
        JSObject out = new JSObject();
        out.put("uri", uri.toString());
        out.put("name", folder == null || folder.getName() == null ? "" : folder.getName());
        out.put("reachable", folder != null);
        return out;
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, 0);
    }
}
