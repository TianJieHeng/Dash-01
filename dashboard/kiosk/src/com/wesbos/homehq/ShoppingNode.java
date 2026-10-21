package com.wesbos.homehq;

import android.content.Context;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import java.io.*;
import java.net.*;
import java.util.*;
import org.json.*;

/** Credential-bearing transport restricted to same-origin dashboard POSTs. No JS bridge. */
final class ShoppingNode {
  private static final String ORIGIN = "http://127.0.0.1:8765";
  private final Context context;
  ShoppingNode(Context context) { this.context = context.getApplicationContext(); }
  private String read(InputStream in) throws IOException {
    ByteArrayOutputStream out = new ByteArrayOutputStream(); byte[] buf = new byte[8192]; int n;
    while ((n = in.read(buf)) != -1) { if (out.size()+n > 4*1024*1024) throw new IOException(); out.write(buf,0,n); }
    return out.toString("UTF-8");
  }
  private String header(WebResourceRequest req, String name) {
    for (Map.Entry<String,String> entry : req.getRequestHeaders().entrySet())
      if (name.equalsIgnoreCase(entry.getKey())) return entry.getValue();
    return "";
  }
  private WebResourceResponse reply(int code, String body) {
    Map<String,String> headers = new HashMap<>(); headers.put("Cache-Control","no-store");
    headers.put("X-Content-Type-Options","nosniff");
    return new WebResourceResponse("application/json","utf-8",code,code==200?"OK":"Error",headers,
      new ByteArrayInputStream(body.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
  }
  private WebResourceResponse error(int code, String message) {
    return reply(code,"{\"error\":{\"message\":\""+message+"\"}}");
  }
  synchronized WebResourceResponse response(WebResourceRequest req, String mainUrl) {
    // WebView interception cannot read a POST body. A bounded, percent-encoded command travels
    // in a custom header; mutations still require POST and browser-generated same-origin proof.
    if (req.isForMainFrame() || !"POST".equals(req.getMethod()) || !ORIGIN.equals(header(req,"Origin"))
        || mainUrl == null || !(mainUrl.equals(ORIGIN) || mainUrl.startsWith(ORIGIN+"/")))
      return error(403,"Shopping is available only inside the bundled dashboard");
    HttpURLConnection conn = null;
    try {
      String encoded = header(req,"X-Shopping-Command");
      if (encoded.isEmpty() || encoded.length()>16384) return error(422,"Invalid shopping command");
      JSONObject command = new JSONObject(URLDecoder.decode(encoded,"UTF-8"));
      String operation = command.getString("operation");
      if (!Arrays.asList("capabilities","listLists","getList","requestStatus","createList","renameList",
          "createItem","updateItem","removeItem","clearPickedUp","undo").contains(operation))
        return error(422,"Unsupported shopping operation");
      command.getJSONObject("payload");
      if (!Arrays.asList("capabilities","listLists","getList","requestStatus").contains(operation)
          && !command.optString("key").matches("[a-zA-Z0-9_-]{16,128}")) return error(422,"A valid action key is required");
      JSONObject config;
      try (InputStream in = new FileInputStream(new File(context.getFilesDir(),"shopping-connection.json"))) {
        config = new JSONObject(read(in));
      }
      URI endpoint = new URI(config.getString("endpoint")); String key = config.getString("apiKey");
      if (!"https".equals(endpoint.getScheme()) || endpoint.getHost()==null || endpoint.getUserInfo()!=null
          || endpoint.getQuery()!=null || endpoint.getFragment()!=null || !"/v1/shopping/dispatch".equals(endpoint.getPath())
          || key.isEmpty() || key.contains("\n") || key.contains("\r")) return error(503,"Shopping connection is invalid");
      conn = (HttpURLConnection)endpoint.toURL().openConnection();
      conn.setInstanceFollowRedirects(false); conn.setConnectTimeout(12000); conn.setReadTimeout(15000);
      conn.setRequestMethod("POST"); conn.setDoOutput(true);
      conn.setRequestProperty("Authorization","Bearer "+key); conn.setRequestProperty("Content-Type","application/json");
      byte[] bytes = command.toString().getBytes("UTF-8"); conn.setFixedLengthStreamingMode(bytes.length);
      try (OutputStream out = conn.getOutputStream()) { out.write(bytes); }
      int status = conn.getResponseCode();
      if (status>=300 && status<400) return error(503,"Shopping source redirected the request");
      InputStream stream = status>=400?conn.getErrorStream():conn.getInputStream();
      if (stream==null) return error(503,"Shopping source unavailable");
      String body; try (InputStream in = stream) { body = read(in); }
      JSONObject json = new JSONObject(body);
      if (!json.has("result") && !json.has("error")) return error(503,"Invalid shopping response");
      return reply(status,json.toString());
    } catch (FileNotFoundException e) { return error(503,"Shopping connection not configured");
    } catch (Exception e) { return error(503,"Shopping source unavailable; retry to check the save");
    } finally { if (conn!=null) conn.disconnect(); }
  }
}
