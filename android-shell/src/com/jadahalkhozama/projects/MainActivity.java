package com.jadahalkhozama.projects;

import android.Manifest;
import android.app.Activity;
import android.content.ClipData;
import android.content.ContentValues;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.hardware.biometrics.BiometricPrompt;
import android.hardware.fingerprint.FingerprintManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.Handler;
import android.os.Looper;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.util.Base64;
import android.view.View;
import android.view.Window;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.Executor;

// Hosts the JAK Projects web build (assets/www) in a WebView and gives it the
// phone features a browser lacks: biometrics, PDF printing, saving files,
// camera, location and the back button.
public class MainActivity extends Activity {
  static final String HOST = "app.jak.local";
  static final String ORIGIN = "https://" + HOST + "/";
  static final int REQ_FILE = 1, REQ_LOCATION = 2;

  WebView web;
  ValueCallback<Uri[]> fileCallback;
  Uri cameraUri;
  GeolocationPermissions.Callback geoCallback;
  String geoOrigin;
  final Handler ui = new Handler(Looper.getMainLooper());
  final Executor uiExec = new Executor() {
    public void execute(Runnable r) { ui.post(r); }
  };

  static final Map<String, String> MIME = new HashMap<>();
  static {
    MIME.put("html", "text/html"); MIME.put("js", "application/javascript"); MIME.put("css", "text/css");
    MIME.put("json", "application/json"); MIME.put("png", "image/png"); MIME.put("jpg", "image/jpeg");
    MIME.put("ico", "image/x-icon"); MIME.put("ttf", "font/ttf"); MIME.put("woff2", "font/woff2"); MIME.put("svg", "image/svg+xml");
  }

  @Override protected void onCreate(Bundle b) {
    super.onCreate(b);
    Window w = getWindow();
    w.setStatusBarColor(Color.parseColor("#1C3354"));
    if (Build.VERSION.SDK_INT >= 21) w.setNavigationBarColor(Color.parseColor("#FFFFFF"));

    web = new WebView(this);
    web.setBackgroundColor(Color.parseColor("#F4F6FA"));
    setContentView(web);

    WebSettings s = web.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);
    s.setDatabaseEnabled(true);
    s.setGeolocationEnabled(true);
    s.setAllowFileAccess(false);
    s.setAllowContentAccess(true);
    s.setTextZoom(100);
    s.setSupportMultipleWindows(true);
    s.setJavaScriptCanOpenWindowsAutomatically(true);
    s.setMediaPlaybackRequiresUserGesture(false);
    s.setUserAgentString(s.getUserAgentString() + " JAKProjectsAndroid/1.0");

    web.addJavascriptInterface(new Bridge(), "JakNative");
    web.setWebViewClient(new AppClient());
    web.setWebChromeClient(new Chrome());
    if (b != null) web.restoreState(b);
    else web.loadUrl(ORIGIN);
  }

  @Override protected void onSaveInstanceState(Bundle out) {
    super.onSaveInstanceState(out);
    web.saveState(out);
  }

  @Override public void onBackPressed() {
    web.evaluateJavascript("(window.__jakBack && window.__jakBack()) ? 'handled' : 'exit'", new ValueCallback<String>() {
      public void onReceiveValue(String v) {
        if (v == null || !v.contains("handled")) MainActivity.super.onBackPressed();
      }
    });
  }

  /* ----------------------------- asset server ---------------------------- */

  class AppClient extends WebViewClient {
    @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
      Uri u = req.getUrl();
      if (!HOST.equals(u.getHost())) return null;
      String path = u.getPath() == null ? "/" : u.getPath();
      if (path.equals("/") || !path.substring(path.lastIndexOf('/') + 1).contains(".")) path = "/index.html";
      String ext = path.substring(path.lastIndexOf('.') + 1).toLowerCase();
      try {
        InputStream in = getAssets().open("www" + Uri.decode(path));
        String mime = MIME.containsKey(ext) ? MIME.get(ext) : "application/octet-stream";
        WebResourceResponse r = new WebResourceResponse(mime, "utf-8", in);
        Map<String, String> h = new HashMap<>();
        h.put("Cache-Control", "no-cache");
        h.put("Access-Control-Allow-Origin", "*");
        r.setResponseHeaders(h);
        return r;
      } catch (Exception e) {
        return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, null);
      }
    }

    @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
      Uri u = Uri.parse(url);
      if (HOST.equals(u.getHost())) return false;
      openExternal(url);
      return true;
    }
  }

  void openExternal(String url) {
    try {
      startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
    } catch (Exception e) {
      toast("No app can open this link");
    }
  }

  void toast(final String msg) {
    ui.post(new Runnable() { public void run() { Toast.makeText(MainActivity.this, msg, Toast.LENGTH_LONG).show(); } });
  }

  /* ------------------------ file picker, camera, GPS ------------------------ */

  class Chrome extends WebChromeClient {
    @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
      if (fileCallback != null) fileCallback.onReceiveValue(null);
      fileCallback = cb;
      Intent intent;
      try {
        if (p.isCaptureEnabled()) {
          File f = new File(FilesProvider.dir(MainActivity.this), "camera_" + System.currentTimeMillis() + ".jpg");
          cameraUri = FilesProvider.uriFor(f);
          intent = new Intent(android.provider.MediaStore.ACTION_IMAGE_CAPTURE);
          intent.putExtra(android.provider.MediaStore.EXTRA_OUTPUT, cameraUri);
          intent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
          intent.setClipData(ClipData.newRawUri("photo", cameraUri));
        } else {
          cameraUri = null;
          // Build the picker ourselves: accept lists may hold extensions (".xlsx") that Android does not understand.
          java.util.ArrayList<String> mimes = new java.util.ArrayList<>();
          for (String a : p.getAcceptTypes()) for (String t : a.split(",")) if (t.trim().contains("/")) mimes.add(t.trim());
          intent = new Intent(Intent.ACTION_GET_CONTENT);
          intent.addCategory(Intent.CATEGORY_OPENABLE);
          intent.setType("*/*");
          if (!mimes.isEmpty() && !mimes.contains("*/*")) intent.putExtra(Intent.EXTRA_MIME_TYPES, mimes.toArray(new String[0]));
          if (p.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        }
        startActivityForResult(intent, REQ_FILE);
        return true;
      } catch (Exception e) {
        fileCallback = null;
        toast("Could not open the picker");
        return false;
      }
    }

    @Override public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback cb) {
      if (Build.VERSION.SDK_INT < 23 || checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
        cb.invoke(origin, true, false);
        return;
      }
      geoCallback = cb;
      geoOrigin = origin;
      requestPermissions(new String[] { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }, REQ_LOCATION);
    }

    @Override public boolean onCreateWindow(WebView view, boolean dialog, boolean user, android.os.Message msg) {
      // window.open(url): hand http(s) links to the browser.
      WebView tmp = new WebView(MainActivity.this);
      tmp.setWebViewClient(new WebViewClient() {
        @Override public boolean shouldOverrideUrlLoading(WebView v, String url) {
          openExternal(url);
          v.destroy();
          return true;
        }
      });
      ((WebView.WebViewTransport) msg.obj).setWebView(tmp);
      msg.sendToTarget();
      return true;
    }
  }

  @Override protected void onActivityResult(int req, int res, Intent data) {
    super.onActivityResult(req, res, data);
    if (req != REQ_FILE || fileCallback == null) return;
    Uri[] result = null;
    if (res == RESULT_OK) {
      if (cameraUri != null) result = new Uri[] { cameraUri };
      else if (data != null && data.getClipData() != null) {
        ClipData c = data.getClipData();
        result = new Uri[c.getItemCount()];
        for (int i = 0; i < c.getItemCount(); i++) result[i] = c.getItemAt(i).getUri();
      } else if (data != null && data.getData() != null) result = new Uri[] { data.getData() };
    }
    fileCallback.onReceiveValue(result);
    fileCallback = null;
  }

  @Override public void onRequestPermissionsResult(int req, String[] perms, int[] grants) {
    if (req == REQ_LOCATION && geoCallback != null) {
      boolean ok = grants.length > 0 && grants[0] == PackageManager.PERMISSION_GRANTED;
      geoCallback.invoke(geoOrigin, ok, false);
      geoCallback = null;
    }
  }

  /* ------------------------------- biometrics ------------------------------ */

  boolean hasBiometrics() {
    try {
      if (Build.VERSION.SDK_INT >= 29) {
        Class<?> bm = Class.forName("android.hardware.biometrics.BiometricManager");
        Object m = getSystemService(bm);
        int r = (Integer) bm.getMethod("canAuthenticate").invoke(m);
        return r == 0;
      }
      FingerprintManager fm = (FingerprintManager) getSystemService(Context.FINGERPRINT_SERVICE);
      return fm != null && fm.isHardwareDetected() && fm.hasEnrolledFingerprints();
    } catch (Throwable t) {
      return false;
    }
  }

  void reply(final String fn, final String id, final boolean ok) {
    ui.post(new Runnable() {
      public void run() {
        web.evaluateJavascript("window." + fn + " && window." + fn + "(" + org.json.JSONObject.quote(id) + "," + ok + ")", null);
      }
    });
  }

  void authenticate(final String id) {
    if (Build.VERSION.SDK_INT >= 28) {
      BiometricPrompt prompt = new BiometricPrompt.Builder(this)
          .setTitle("Unlock JAK - flowTracker")
          .setSubtitle("Use your fingerprint or face")
          .setNegativeButton("Use PIN", uiExec, new DialogInterface.OnClickListener() {
            public void onClick(DialogInterface d, int which) { reply("__jakBio", id, false); }
          })
          .build();
      prompt.authenticate(new CancellationSignal(), uiExec, new BiometricPrompt.AuthenticationCallback() {
        @Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult r) { reply("__jakBio", id, true); }
        @Override public void onAuthenticationError(int code, CharSequence msg) { reply("__jakBio", id, false); }
      });
      return;
    }
    FingerprintManager fm = (FingerprintManager) getSystemService(Context.FINGERPRINT_SERVICE);
    toast("Touch the fingerprint sensor");
    fm.authenticate(null, new CancellationSignal(), 0, new FingerprintManager.AuthenticationCallback() {
      @Override public void onAuthenticationSucceeded(FingerprintManager.AuthenticationResult r) { reply("__jakBio", id, true); }
      @Override public void onAuthenticationError(int code, CharSequence msg) { reply("__jakBio", id, false); }
    }, ui);
  }

  /* --------------------------------- files --------------------------------- */

  static String safeName(String n) {
    String s = n == null ? "file" : n.replaceAll("[\\\\/:*?\"<>|]+", "_").trim();
    return s.isEmpty() ? "file" : s;
  }

  // Saves to Downloads/JAK Projects (Android 10+) and always keeps a shareable copy.
  Uri writeFile(String name, byte[] bytes, String mime, boolean toDownloads) throws Exception {
    File f = new File(FilesProvider.dir(this), safeName(name));
    try (OutputStream o = new FileOutputStream(f)) { o.write(bytes); }
    if (toDownloads && Build.VERSION.SDK_INT >= 29) {
      ContentValues v = new ContentValues();
      v.put("_display_name", safeName(name));
      v.put("mime_type", mime);
      v.put("relative_path", "Download/JAK Projects");
      Uri dl = getContentResolver().insert(Uri.parse("content://media/external/downloads"), v);
      if (dl != null) {
        try (OutputStream o = getContentResolver().openOutputStream(dl)) { o.write(bytes); }
        toast("Saved to Downloads/JAK Projects/" + safeName(name));
      }
    }
    return FilesProvider.uriFor(f);
  }

  void view(Uri uri, String mime) {
    Intent i = new Intent(Intent.ACTION_VIEW);
    i.setDataAndType(uri, mime);
    i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
    try {
      startActivity(Intent.createChooser(i, "Open with"));
    } catch (Exception e) {
      share(uri, mime);
    }
  }

  void share(Uri uri, String mime) {
    Intent i = new Intent(Intent.ACTION_SEND);
    i.setType(mime);
    i.putExtra(Intent.EXTRA_STREAM, uri);
    i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
    startActivity(Intent.createChooser(i, "Share"));
  }

  void printHtml(final String html, final String title) {
    final WebView pw = new WebView(this);
    pw.setWebViewClient(new WebViewClient() {
      @Override public void onPageFinished(WebView v, String url) {
        PrintManager pm = (PrintManager) getSystemService(Context.PRINT_SERVICE);
        PrintAttributes attrs = new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build();
        pm.print(title, v.createPrintDocumentAdapter(title), attrs);
      }
    });
    pw.loadDataWithBaseURL(ORIGIN, html, "text/html", "utf-8", null);
  }

  /* ------------------------------ JS bridge -------------------------------- */

  class Bridge {
    @JavascriptInterface public String version() { return "1.1.1"; }

    @JavascriptInterface public boolean biometricAvailable() { return hasBiometrics(); }

    @JavascriptInterface public void authenticate(final String id) {
      ui.post(new Runnable() {
        public void run() {
          try { MainActivity.this.authenticate(id); } catch (Throwable t) { reply("__jakBio", id, false); }
        }
      });
    }

    // Opens Android's print screen; "Save as PDF" or a printer, both A4.
    @JavascriptInterface public void printHtml(final String html, final String title) {
      ui.post(new Runnable() { public void run() { MainActivity.this.printHtml(html, title); } });
    }

    @JavascriptInterface public boolean saveFile(String name, String base64, String mime) {
      try {
        Uri u = writeFile(name, Base64.decode(base64, Base64.DEFAULT), mime, true);
        share(u, mime);
        return true;
      } catch (Exception e) {
        toast("Could not save " + name);
        return false;
      }
    }

    @JavascriptInterface public boolean openDataUrl(String name, String dataUrl) {
      try {
        int comma = dataUrl.indexOf(',');
        String meta = dataUrl.substring(5, comma);
        String mime = meta.split(";")[0];
        Uri u = writeFile(name, Base64.decode(dataUrl.substring(comma + 1), Base64.DEFAULT), mime, false);
        view(u, mime);
        return true;
      } catch (Exception e) {
        toast("Could not open " + name);
        return false;
      }
    }

    @JavascriptInterface public void openExternal(String url) { MainActivity.this.openExternal(url); }
  }
}
