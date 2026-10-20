package com.wesbos.homehq;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.webkit.WebResourceResponse;
import java.io.*;
import java.net.*;
import java.security.MessageDigest;
import java.util.*;
import org.json.*;

/** Read-only Temporal Bureau client. The key never crosses into WebView. */
final class CalendarNode {
  private final Context context;
  private static final int LIMIT = 8 * 1024 * 1024;
  CalendarNode(Context context) { this.context = context.getApplicationContext(); }

  static JSONObject project(JSONObject input, String fields) throws JSONException {
    JSONObject output = new JSONObject();
    for (String name : fields.split(" ")) if (input.has(name)) output.put(name, input.get(name));
    return output;
  }
  static JSONArray collection(Object body, String name) throws JSONException {
    if (body instanceof JSONArray) return (JSONArray) body;
    if (body instanceof JSONObject && ((JSONObject) body).opt(name) instanceof JSONArray)
      return ((JSONObject) body).getJSONArray(name);
    throw new JSONException("Unexpected collection");
  }
  static JSONArray clean(JSONArray rows, String kind) throws JSONException {
    JSONArray result = new JSONArray();
    for (int i = 0; i < rows.length(); i++) {
      JSONObject row = rows.getJSONObject(i), item;
      if (row.optString("id").isEmpty()) throw new JSONException("Missing identity");
      if (kind.equals("calendars")) item = project(row, "id slug name displayName display_name color type isArchived is_archived serviceName");
      else if (kind.equals("events")) {
        item = project(row, "id title date start end endDate startAt endAt start_at end_at calendar calendarId calendar_id timezone allDay all_day status description location tags sourceKind agentLinked eventType");
        item.put("alarms", clean(row.optJSONArray("alarms") == null ? new JSONArray() : row.getJSONArray("alarms"), "alarms"));
      } else item = project(row, "id name enabled scopeType scopeRefId scheduleMode relativeTo offsetMinutes triggerAt timezone type alarmType requiresAck executionState lastResult lastAttemptAt lastFiredAt nextFireAt");
      result.put(item);
    }
    return result;
  }
  private static byte[] read(InputStream in) throws IOException {
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    byte[] buffer = new byte[16384]; int n;
    while ((n = in.read(buffer)) != -1) {
      if (out.size() + n > LIMIT) throw new IOException("Response too large");
      out.write(buffer, 0, n);
    }
    return out.toByteArray();
  }
  private JSONObject file(String name) throws Exception {
    try (InputStream in = new FileInputStream(new File(context.getFilesDir(), name))) {
      return new JSONObject(new String(read(in), "UTF-8"));
    }
  }
  private static String digest(String text) throws Exception {
    byte[] bytes = MessageDigest.getInstance("SHA-256").digest(text.getBytes("UTF-8"));
    StringBuilder out = new StringBuilder();
    for (byte b : bytes) out.append(String.format(Locale.ROOT, "%02x", b & 255));
    return out.toString();
  }
  private JSONArray get(String base, String path, String key, String kind) throws Exception {
    HttpURLConnection connection = (HttpURLConnection) new URL(base + path).openConnection();
    connection.setInstanceFollowRedirects(false);
    connection.setConnectTimeout(15000); connection.setReadTimeout(15000);
    connection.setRequestProperty("X-API-Key", key);
    connection.setRequestProperty("Accept", "application/json");
    connection.setRequestProperty("User-Agent", "DASH-01/1.2");
    try {
      int status = connection.getResponseCode();
      if (status != 200) throw new IOException("Calendar node returned HTTP " + status);
      try (InputStream in = connection.getInputStream()) {
        Object payload = new JSONTokener(new String(read(in), "UTF-8")).nextValue();
        return clean(collection(payload, kind), kind);
      }
    } finally { connection.disconnect(); }
  }
  private boolean wifi() {
    ConnectivityManager cm = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
    NetworkInfo net = cm == null ? null : cm.getActiveNetworkInfo();
    return net != null && net.isConnected() && net.getType() == ConnectivityManager.TYPE_WIFI;
  }
  synchronized WebResourceResponse response(boolean force) {
    JSONObject result = new JSONObject(); String fingerprint = ""; JSONObject cached = null;
    try {
      JSONObject config = file("calendar-connection.json");
      String base = config.getString("calendarUrl").replaceAll("/+$", "");
      String key = config.getString("calendarKey");
      URI uri = new URI(base);
      if (!"https".equals(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null ||
          uri.getQuery() != null || uri.getFragment() != null || !uri.getPath().isEmpty() || key.isEmpty())
        throw new IOException("Invalid calendar configuration");
      fingerprint = digest(config.toString());
      try { JSONObject old = file("calendar-cache.json"); if (fingerprint.equals(old.optString("configuration"))) cached = old; } catch (Exception ignored) {}
      if (!force && cached != null && System.currentTimeMillis() - cached.optLong("fetchedAt") < 60000) {
        result = cached;
      } else {
        JSONArray calendars = get(base, "/api/calendars", key, "calendars");
        JSONArray events = get(base, "/api/events", key, "events");
        JSONArray alarms; String warning = "";
        try { alarms = get(base, "/api/alarms", config.optString("alarmsKey", "").isEmpty() ? key : config.getString("alarmsKey"), "alarms"); }
        catch (Exception ignored) { alarms = cached == null ? new JSONArray() : cached.optJSONArray("alarms"); warning = "Alarms unavailable; showing last known alarms"; }
        result.put("calendars", calendars).put("events", events).put("alarms", alarms == null ? new JSONArray() : alarms);
        result.put("configured", true).put("stale", false).put("warning", warning).put("fetchedAt", System.currentTimeMillis());
        result.put("sourceName", "Calendar node").put("configuration", fingerprint);
        File temp = new File(context.getFilesDir(), "calendar-cache.json.new");
        try (FileOutputStream out = new FileOutputStream(temp)) { out.write(result.toString().getBytes("UTF-8")); out.getFD().sync(); }
        if (!temp.renameTo(new File(context.getFilesDir(), "calendar-cache.json"))) throw new IOException("Cache write failed");
      }
    } catch (Exception error) {
      try {
        result = cached == null ? new JSONObject() : cached;
        result.put("configured", !fingerprint.isEmpty()).put("stale", true);
        String message = error instanceof FileNotFoundException ? "Calendar connection not configured" :
          error.getMessage() != null && error.getMessage().matches("Calendar node returned HTTP [0-9]{3}") ? error.getMessage() : "Calendar node unavailable";
        result.put("error", message);
      } catch (JSONException ignored) {}
    }
    try { result.remove("configuration"); result.put("wifiConnected", wifi()); } catch (JSONException ignored) {}
    Map<String,String> headers = new HashMap<>(); headers.put("Cache-Control", "no-store");
    return new WebResourceResponse("application/json", "utf-8", 200, "OK", headers,
      new ByteArrayInputStream(result.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8)));
  }
}
