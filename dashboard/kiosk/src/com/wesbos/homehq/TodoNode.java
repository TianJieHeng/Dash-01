package com.wesbos.homehq;

import android.content.Context;
import android.webkit.WebResourceResponse;
import java.io.*;
import java.net.*;
import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.*;
import org.json.*;

/** Adapts the existing V2 daily TODO contract without exposing its credential or write operations. */
final class TodoNode {
  private final Context context;
  TodoNode(Context context) { this.context = context.getApplicationContext(); }
  private byte[] read(InputStream in) throws IOException {
    ByteArrayOutputStream out = new ByteArrayOutputStream(); byte[] buffer = new byte[8192]; int n;
    while ((n = in.read(buffer)) != -1) { if (out.size()+n > 8*1024*1024) throw new IOException(); out.write(buffer,0,n); }
    return out.toByteArray();
  }
  private JSONObject file(String name) throws Exception {
    try (InputStream in = new FileInputStream(new File(context.getFilesDir(),name))) { return new JSONObject(new String(read(in),"UTF-8")); }
  }
  private String fingerprint(String value) throws Exception {
    StringBuilder hex = new StringBuilder();
    for (byte b : MessageDigest.getInstance("SHA-256").digest(value.getBytes("UTF-8"))) hex.append(String.format(Locale.ROOT,"%02x",b&255));
    return hex.toString();
  }
  synchronized WebResourceResponse response(String date, boolean force) {
    JSONObject result = new JSONObject(), cached = null; String identity = "";
    try {
      SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd",Locale.ROOT); format.setLenient(false);
      if (date == null || !date.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}") || !format.format(format.parse(date)).equals(date)) throw new IOException();
      JSONObject config = file("todo-connection.json");
      String base = config.getString("todoUrl").replaceAll("/+$", ""), key = config.getString("todoKey");
      URI uri = new URI(base);
      if (!"https".equals(uri.getScheme()) || uri.getHost()==null || uri.getUserInfo()!=null || uri.getQuery()!=null || uri.getFragment()!=null || !uri.getPath().isEmpty() || key.isEmpty() || key.contains("\n") || key.contains("\r")) throw new IOException();
      identity = fingerprint(config.toString());
      try { JSONObject old=file("todo-cache.json"); if (identity.equals(old.optString("configuration")) && date.equals(old.optString("date"))) cached=old; } catch (Exception ignored) {}
      if (!force && cached!=null && System.currentTimeMillis()-cached.optLong("fetchedAt")<60000) result=cached;
      else {
        HttpURLConnection conn=(HttpURLConnection)new URL(base+"/v1/schedule/dispatch").openConnection();
        conn.setInstanceFollowRedirects(false);conn.setConnectTimeout(15000);conn.setReadTimeout(15000);conn.setRequestMethod("POST");conn.setDoOutput(true);
        conn.setRequestProperty("Authorization","Bearer "+key);conn.setRequestProperty("Content-Type","application/json");conn.setRequestProperty("Accept","application/json");
        byte[] body=new JSONObject().put("operation","getTodos").put("payload",new JSONObject().put("date",date)).toString().getBytes("UTF-8");
        conn.setFixedLengthStreamingMode(body.length);
        try {
          try(OutputStream out=conn.getOutputStream()){out.write(body);}
          int status=conn.getResponseCode();if(status!=200)throw new IOException("To-do source returned HTTP "+status);
          JSONObject day;
          try(InputStream in=conn.getInputStream()){day=new JSONObject(new String(read(in),"UTF-8")).getJSONObject("result");}
          if(!date.equals(day.getString("date")))throw new IOException();
          JSONArray items=day.getJSONArray("items"), clean=new JSONArray(); Set<String> ids=new HashSet<>();
          for(int i=0;i<items.length();i++){
            JSONObject item=items.getJSONObject(i);String id=item.getString("id"), title=item.getString("text");
            if(id.isEmpty()||title.trim().isEmpty()||!ids.add(id)||!(item.get("completed") instanceof Boolean))throw new IOException();
            clean.put(CalendarNode.project(item,"id text completed position completed_at created_at updated_at"));
          }
          result.put("date",date).put("items",clean).put("revision",day.getLong("revision")).put("updatedAt",day.optString("updatedAt"));
          result.put("configured",true).put("stale",false).put("fetchedAt",System.currentTimeMillis()).put("configuration",identity);
          File temp=new File(context.getFilesDir(),"todo-cache.json.new");
          try(FileOutputStream out=new FileOutputStream(temp)){out.write(result.toString().getBytes("UTF-8"));out.getFD().sync();}
          if(!temp.renameTo(new File(context.getFilesDir(),"todo-cache.json")))throw new IOException();
        } finally {conn.disconnect();}
      }
    } catch(Exception error) {
      try {result=cached==null?new JSONObject():cached;result.put("configured",!identity.isEmpty()).put("stale",true);
        String message=error instanceof FileNotFoundException?"To-do connection not configured":error.getMessage()!=null&&error.getMessage().matches("To-do source returned HTTP [0-9]{3}")?error.getMessage():"To-do source unavailable";
        result.put("error",message);
      }catch(JSONException ignored){}
    }
    result.remove("configuration");Map<String,String> headers=new HashMap<>();headers.put("Cache-Control","no-store");
    return new WebResourceResponse("application/json","utf-8",200,"OK",headers,new ByteArrayInputStream(result.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8)));
  }
}
