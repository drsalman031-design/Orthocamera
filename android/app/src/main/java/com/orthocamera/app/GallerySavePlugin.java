package com.orthocamera.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * GallerySavePlugin
 *
 * Saves captured high-resolution orthodontic JPEG photos directly to the Android device's
 * system MediaStore gallery (Pictures/Orthocamera) so they immediately appear in Google Photos,
 * Samsung Gallery, and system media pickers without routing to browser Downloads.
 */
@CapacitorPlugin(name = "GallerySave")
public class GallerySavePlugin extends Plugin {

    private static String lastSavedUriString = null;

    @PluginMethod
    public void savePhotoToGallery(PluginCall call) {
        String filename = call.getString("filename");
        String jpegBase64 = call.getString("jpegBase64");
        String album = call.getString("album", "Orthocamera");

        if (filename == null || filename.trim().isEmpty()) {
            call.reject("Missing required parameter: filename");
            return;
        }

        if (jpegBase64 == null || jpegBase64.trim().isEmpty()) {
            call.reject("Missing required parameter: jpegBase64");
            return;
        }

        // Sanitize base64 string: remove data URL prefix if present (e.g. data:image/jpeg;base64,...)
        if (jpegBase64.contains(",")) {
            jpegBase64 = jpegBase64.substring(jpegBase64.indexOf(",") + 1);
        }

        byte[] imageBytes;
        try {
            imageBytes = Base64.decode(jpegBase64, Base64.DEFAULT);
        } catch (IllegalArgumentException e) {
            call.reject("Invalid Base64 JPEG data: " + e.getMessage());
            return;
        }

        Context context = getContext();
        if (context == null) {
            call.reject("Android Context is unavailable");
            return;
        }

        ContentResolver resolver = context.getContentResolver();
        Uri imageUri = null;

        try {
            // Android 10+ (API 29+): Scoped Storage with MediaStore relative path & IS_PENDING
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.Images.Media.DISPLAY_NAME, filename);
                values.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
                values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + File.separator + album);
                values.put(MediaStore.Images.Media.IS_PENDING, 1);

                imageUri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
                if (imageUri == null) {
                    call.reject("Failed to insert MediaStore record");
                    return;
                }

                try (OutputStream out = resolver.openOutputStream(imageUri)) {
                    if (out == null) {
                        call.reject("Failed to open MediaStore output stream");
                        return;
                    }
                    out.write(imageBytes);
                    out.flush();
                }

                values.clear();
                values.put(MediaStore.Images.Media.IS_PENDING, 0);
                resolver.update(imageUri, values, null, null);

            } else {
                // Android 9 and below (API <= 28) compatibility path
                File picturesDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES);
                File albumDir = new File(picturesDir, album);
                if (!albumDir.exists() && !albumDir.mkdirs()) {
                    call.reject("Failed to create gallery album directory: " + albumDir.getAbsolutePath());
                    return;
                }

                File imageFile = new File(albumDir, filename);
                try (FileOutputStream fos = new FileOutputStream(imageFile)) {
                    fos.write(imageBytes);
                    fos.flush();
                }

                ContentValues values = new ContentValues();
                values.put(MediaStore.Images.Media.DATA, imageFile.getAbsolutePath());
                values.put(MediaStore.Images.Media.DISPLAY_NAME, filename);
                values.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
                imageUri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
            }

            if (imageUri != null) {
                lastSavedUriString = imageUri.toString();
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("uri", imageUri != null ? imageUri.toString() : "");
            ret.put("filename", filename);
            ret.put("album", album);
            call.resolve(ret);

        } catch (Exception e) {
            // Clean up pending entry if created
            if (imageUri != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                try {
                    resolver.delete(imageUri, null, null);
                } catch (Exception ignored) {
                }
            }
            call.reject("Failed to save image to Android MediaStore: " + e.getMessage(), e);
        }
    }

    /**
     * openGallery
     *
     * Launches the Android device's native Gallery or Photos app (Google Photos, Samsung Gallery, etc.)
     * directly focused on the saved orthodontic photo or the Pictures/Orthocamera album.
     */
    @PluginMethod
    public void openGallery(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("Android Context is unavailable");
            return;
        }

        String uriString = call.getString("uri");
        if ((uriString == null || uriString.trim().isEmpty()) && lastSavedUriString != null) {
            uriString = lastSavedUriString;
        }

        boolean opened = false;

        // 1. Try viewing the specific photo if a content URI is available
        if (uriString != null && !uriString.trim().isEmpty()) {
            try {
                Uri photoUri = Uri.parse(uriString);
                Intent viewIntent = new Intent(Intent.ACTION_VIEW);
                viewIntent.setDataAndType(photoUri, "image/*");
                viewIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                viewIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(viewIntent);
                opened = true;
            } catch (Exception ignored) {
            }
        }

        // 2. Fallback: Open system MediaStore external images collection in Gallery
        if (!opened) {
            try {
                Intent galleryIntent = new Intent(Intent.ACTION_VIEW);
                galleryIntent.setDataAndType(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, "image/*");
                galleryIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(galleryIntent);
                opened = true;
            } catch (Exception ignored) {
            }
        }

        // 3. Fallback: Standard CATEGORY_APP_GALLERY
        if (!opened) {
            try {
                Intent appGalleryIntent = new Intent(Intent.ACTION_MAIN);
                appGalleryIntent.addCategory(Intent.CATEGORY_APP_GALLERY);
                appGalleryIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(appGalleryIntent);
                opened = true;
            } catch (Exception ignored) {
            }
        }

        // 4. Fallback: Intent chooser with image/*
        if (!opened) {
            try {
                Intent chooserIntent = new Intent(Intent.ACTION_VIEW);
                chooserIntent.setType("image/*");
                chooserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                Intent chooser = Intent.createChooser(chooserIntent, "Open Gallery");
                chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(chooser);
                opened = true;
            } catch (Exception e) {
                call.reject("Could not open gallery: " + e.getMessage(), e);
                return;
            }
        }

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }
}
