package mx.emprendiendoenpareja.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.util.Base64;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;
import android.widget.PopupMenu;
import android.widget.TextView;
import android.widget.Toast;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;

public final class MainActivity extends Activity {
    private static final String HOST = "emprendiendo-en-pareja.web.app";
    private static final String URL = "https://" + HOST + "/";
    private static final String KEY = "'emprendiendo-en-pareja-local-v1'";
    private static final int IMPORT = 1, EXPORT = 2, PHOTO = 3, MAX_BACKUP = 5 * 1024 * 1024;
    private WebView web;
    private String exportData;
    private ValueCallback<Uri[]> photoCallback;
    private boolean exportIsBase64;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setBackgroundColor(Color.rgb(247, 243, 239));
        layout.setOnApplyWindowInsetsListener((v, insets) -> {
            v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets.consumeSystemWindowInsets();
        });

        TextView menu = new TextView(this);
        menu.setText("⋮");
        menu.setTextSize(23);
        menu.setTextColor(Color.rgb(145, 80, 102));
        menu.setGravity(android.view.Gravity.END | android.view.Gravity.CENTER_VERTICAL);
        menu.setPadding(0, 0, (int) (16 * getResources().getDisplayMetrics().density), 0);
        menu.setContentDescription("Opciones de la aplicación");
        menu.setOnClickListener(this::showOptions);
        layout.addView(menu, new LinearLayout.LayoutParams(-1,
            (int) (44 * getResources().getDisplayMetrics().density)));

        web = new WebView(this);
        layout.addView(web, new LinearLayout.LayoutParams(-1, 0, 1));
        setContentView(layout);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame() || trusted(request.getUrl())) return false;
                Uri target = request.getUrl();
                if ("https".equals(target.getScheme()) && "www.facebook.com".equals(target.getHost())
                    && target.getPort() == -1 && target.getUserInfo() == null
                    && target.getPath() != null && target.getPath().matches("/groups/(?:[a-zA-Z0-9._-]+/)?")) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, target)); }
                    catch (android.content.ActivityNotFoundException error) { message("No se pudo abrir Facebook."); }
                }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (!pageReady()) return false;
                if (photoCallback != null) photoCallback.onReceiveValue(null);
                photoCallback = callback;
                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("image/*");
                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                try { startActivityForResult(Intent.createChooser(intent, "Seleccionar fotos"), PHOTO); }
                catch (android.content.ActivityNotFoundException error) {
                    photoCallback = null;
                    callback.onReceiveValue(null);
                    message("No se pudo abrir la galería.");
                }
                return true;
            }
        });
        web.setDownloadListener((url, agent, disposition, mime, length) ->
            downloadBlob(url, URLUtil.guessFileName(url, disposition, mime), mime));
        if (state != null) {
            exportData = state.getString("exportData");
            exportIsBase64 = state.getBoolean("exportIsBase64");
        }
        web.loadUrl(URL);
    }

    private boolean trusted(Uri uri) {
        return uri != null && "https".equals(uri.getScheme()) && HOST.equals(uri.getHost())
            && (uri.getPort() == -1 || uri.getPort() == 443) && uri.getUserInfo() == null;
    }

    private boolean pageReady() {
        return web.getUrl() != null && trusted(Uri.parse(web.getUrl()));
    }

    private void showOptions(View anchor) {
        PopupMenu menu = new PopupMenu(this, anchor);
        menu.getMenu().add("Actualizar").setOnMenuItemClickListener(item -> { web.reload(); return true; });
        menu.getMenu().add("Importar respaldo").setOnMenuItemClickListener(item -> {
            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("*/*");
            startActivityForResult(intent, IMPORT);
            return true;
        });
        menu.getMenu().add("Guardar respaldo").setOnMenuItemClickListener(item -> {
            if (pageReady()) web.evaluateJavascript("localStorage.getItem(" + KEY + ")", result -> {
                String data = asString(result);
                if (data == null) message("Todavía no hay movimientos para respaldar.");
                else saveFile(data, "respaldo-emprendiendo-en-pareja.json", "application/json");
            });
            return true;
        });
        menu.show();
    }

    private void downloadBlob(String url, String filename, String mime) {
        if (!pageReady() || url == null || !url.startsWith("blob:" + URL)) return;
        web.evaluateJavascript("window.__parejaDownload=null;fetch(" + JSONObject.quote(url)
            + ").then(r=>r.blob()).then(b=>{const f=new FileReader();"
            + "f.onload=()=>{window.__parejaDownload=f.result};f.onerror=()=>{window.__parejaDownload=false};"
            + "f.readAsDataURL(b)}).catch(()=>{window.__parejaDownload=false});", ignored ->
            readDownload(filename, mime, 20));
    }

    private void readDownload(String filename, String mime, int attempts) {
        if (!pageReady()) return;
        web.evaluateJavascript("window.__parejaDownload", result -> {
            String data = asString(result);
            if (data != null) {
                web.evaluateJavascript("delete window.__parejaDownload", null);
                int separator = data.indexOf(',');
                if (separator < 0) { message("No se pudo preparar el archivo."); return; }
                saveFile(data.substring(separator + 1), filename, mime, true);
            } else if ("null".equals(result) && attempts > 0) {
                web.postDelayed(() -> readDownload(filename, mime, attempts - 1), 100);
            } else message("No se pudo preparar el archivo.");
        });
    }

    private String asString(String result) {
        try {
            Object value = new JSONTokener(result).nextValue();
            return value instanceof String ? (String) value : null;
        } catch (Exception error) { return null; }
    }

    private void saveFile(String data, String filename, String mime) {
        saveFile(data, filename, mime, false);
    }

    private void saveFile(String data, String filename, String mime, boolean encoded) {
        exportData = data;
        exportIsBase64 = encoded;
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mime == null ? "text/plain" : mime.split(";")[0]);
        intent.putExtra(Intent.EXTRA_TITLE, filename);
        startActivityForResult(intent, EXPORT);
    }

    @Override protected void onActivityResult(int request, int result, Intent intent) {
        super.onActivityResult(request, result, intent);
        Uri file = result == RESULT_OK && intent != null ? intent.getData() : null;
        if (request == PHOTO) {
            ValueCallback<Uri[]> callback = photoCallback;
            photoCallback = null;
            if (callback == null) return;
            android.content.ClipData selection = result == RESULT_OK && intent != null ? intent.getClipData() : null;
            if (selection == null) {
                callback.onReceiveValue(file == null ? null : new Uri[]{file});
            } else {
                Uri[] photos = new Uri[selection.getItemCount()];
                for (int i = 0; i < photos.length; i++) photos[i] = selection.getItemAt(i).getUri();
                callback.onReceiveValue(photos);
            }
        } else if (request == EXPORT) {
            String data = exportData;
            exportData = null;
            if (file == null || data == null) return;
            try (OutputStream output = getContentResolver().openOutputStream(file, "wt")) {
                if (output == null) throw new IllegalStateException();
                output.write(exportIsBase64 ? Base64.decode(data, Base64.DEFAULT) : data.getBytes(StandardCharsets.UTF_8));
                message("Archivo guardado.");
            } catch (Exception error) { message("No se pudo guardar el archivo."); }
        } else if (request == IMPORT && file != null) {
            importBackup(file);
        }
    }

    private void importBackup(Uri file) {
        if (!pageReady()) { message("Abre la app antes de importar el respaldo."); return; }
        try (InputStream input = getContentResolver().openInputStream(file);
             ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
            if (input == null) throw new IllegalArgumentException();
            byte[] buffer = new byte[8192];
            int count;
            while ((count = input.read(buffer)) != -1) {
                if (bytes.size() + count > MAX_BACKUP) throw new IllegalArgumentException();
                bytes.write(buffer, 0, count);
            }
            JSONObject data = new JSONObject(new String(bytes.toByteArray(), StandardCharsets.UTF_8));
            for (String section : new String[]{"products", "purchases", "sales", "expenses", "profiles"}) {
                JSONArray records = data.getJSONArray(section);
                for (int i = 0; i < records.length(); i++) records.getJSONObject(i);
            }
            JSONObject settings = data.getJSONObject("settings");
            for (String field : new String[]{"capital", "reserve", "minimum", "discount"}) settings.getDouble(field);
            new AlertDialog.Builder(this).setTitle("Importar respaldo")
                .setMessage("El respaldo reemplazará los registros y ajustes guardados en esta app.")
                .setNegativeButton("Cancelar", null)
                .setPositiveButton("Importar", (dialog, option) -> restore(data)).show();
        } catch (Exception error) { message("Elige un respaldo JSON válido de Emprendiendo en Pareja."); }
    }

    private void restore(JSONObject data) {
        if (!pageReady()) return;
        web.evaluateJavascript("(()=>{try{localStorage.setItem(" + KEY + ","
            + JSONObject.quote(data.toString()) + ");return true}catch(e){return false}})()", result -> {
            if ("true".equals(result)) { web.reload(); message("Respaldo importado."); }
            else message("No se pudo importar el respaldo.");
        });
    }

    @Override protected void onSaveInstanceState(Bundle state) {
        super.onSaveInstanceState(state);
        if (exportData != null && exportData.length() < 250000) {
            state.putString("exportData", exportData);
            state.putBoolean("exportIsBase64", exportIsBase64);
        }
    }

    private void message(String text) { Toast.makeText(this, text, Toast.LENGTH_LONG).show(); }
}
