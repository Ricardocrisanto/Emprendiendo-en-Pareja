package mx.emprendiendoenpareja.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.URLUtil;
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
    private static final int IMPORT = 1, EXPORT = 2, MAX_BACKUP = 5 * 1024 * 1024;
    private WebView web;
    private String exportData;

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
                return request.isForMainFrame() && !trusted(request.getUrl());
            }
        });
        web.setDownloadListener((url, agent, disposition, mime, length) ->
            downloadBlob(url, URLUtil.guessFileName(url, disposition, mime), mime));
        if (state != null) exportData = state.getString("exportData");
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
            + ").then(r=>r.text()).then(t=>{window.__parejaDownload=t}).catch(()=>{window.__parejaDownload=false});", ignored ->
            readDownload(filename, mime, 20));
    }

    private void readDownload(String filename, String mime, int attempts) {
        if (!pageReady()) return;
        web.evaluateJavascript("window.__parejaDownload", result -> {
            String data = asString(result);
            if (data != null) {
                web.evaluateJavascript("delete window.__parejaDownload", null);
                saveFile(data, filename, mime);
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
        exportData = data;
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mime == null ? "text/plain" : mime.split(";")[0]);
        intent.putExtra(Intent.EXTRA_TITLE, filename);
        startActivityForResult(intent, EXPORT);
    }

    @Override protected void onActivityResult(int request, int result, Intent intent) {
        super.onActivityResult(request, result, intent);
        Uri file = result == RESULT_OK && intent != null ? intent.getData() : null;
        if (request == EXPORT) {
            String data = exportData;
            exportData = null;
            if (file == null || data == null) return;
            try (OutputStream output = getContentResolver().openOutputStream(file, "wt")) {
                if (output == null) throw new IllegalStateException();
                output.write(data.getBytes(StandardCharsets.UTF_8));
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
        if (exportData != null && exportData.length() < 100000) state.putString("exportData", exportData);
    }

    private void message(String text) { Toast.makeText(this, text, Toast.LENGTH_LONG).show(); }
}
