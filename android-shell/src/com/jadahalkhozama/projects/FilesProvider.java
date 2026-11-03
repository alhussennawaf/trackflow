package com.jadahalkhozama.projects;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import android.webkit.MimeTypeMap;
import java.io.File;
import java.io.FileNotFoundException;

// Shares files from the app's cache/shared folder with other apps
// (PDF viewers, the camera app writing a photo, the share sheet).
public class FilesProvider extends ContentProvider {
  public static final String AUTHORITY = "com.jadahalkhozama.projects.files";

  public static File dir(android.content.Context c) {
    File d = new File(c.getCacheDir(), "shared");
    d.mkdirs();
    return d;
  }

  public static Uri uriFor(File f) {
    return Uri.parse("content://" + AUTHORITY + "/" + Uri.encode(f.getName()));
  }

  private File fileFor(Uri uri) throws FileNotFoundException {
    String name = uri.getLastPathSegment();
    if (name == null || name.contains("/") || name.contains("..")) throw new FileNotFoundException();
    return new File(dir(getContext()), name);
  }

  @Override public boolean onCreate() { return true; }

  @Override public String getType(Uri uri) {
    String name = uri.getLastPathSegment();
    String ext = name == null ? "" : MimeTypeMap.getFileExtensionFromUrl(Uri.encode(name)).toLowerCase();
    String t = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
    return t != null ? t : "application/octet-stream";
  }

  @Override public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
    File f = fileFor(uri);
    int m = mode.contains("w")
        ? ParcelFileDescriptor.MODE_READ_WRITE | ParcelFileDescriptor.MODE_CREATE | ParcelFileDescriptor.MODE_TRUNCATE
        : ParcelFileDescriptor.MODE_READ_ONLY;
    return ParcelFileDescriptor.open(f, m);
  }

  @Override public Cursor query(Uri uri, String[] projection, String sel, String[] args, String sort) {
    File f;
    try { f = fileFor(uri); } catch (FileNotFoundException e) { return null; }
    MatrixCursor c = new MatrixCursor(new String[] { OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE });
    c.addRow(new Object[] { f.getName(), f.length() });
    return c;
  }

  @Override public Uri insert(Uri uri, ContentValues v) { return null; }
  @Override public int delete(Uri uri, String s, String[] a) { return 0; }
  @Override public int update(Uri uri, ContentValues v, String s, String[] a) { return 0; }
}
