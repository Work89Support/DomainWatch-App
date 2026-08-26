package app.domainwatch.agent;

import android.net.Network;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

public final class ApiClient {
    private ApiClient() { }

    public static JSONObject enroll(Network network, String baseUrl, String code, String deviceId, String deviceLabel) throws Exception {
        JSONObject body = new JSONObject();
        body.put("code", code);
        body.put("deviceId", deviceId);
        body.put("deviceLabel", deviceLabel);
        body.put("appVersion", BuildConfig.VERSION_NAME);
        return jsonRequest(network, "POST", cleanBase(baseUrl) + "/api/agent/enroll", null, body);
    }

    public static JSONObject jobs(Network network, String baseUrl, String token) throws Exception {
        return jsonRequest(network, "GET", cleanBase(baseUrl) + "/api/agent/jobs", token, null);
    }

    public static JSONObject submit(Network network, String baseUrl, String token, JSONObject body) throws Exception {
        return jsonRequest(network, "POST", cleanBase(baseUrl) + "/api/agent/results", token, body);
    }

    public static JSONObject probe(Network network, JSONObject job, int slowMs) {
        long started = System.currentTimeMillis();
        HttpURLConnection connection = null;
        JSONObject result = new JSONObject();
        try {
            String url = job.getString("url");
            result.put("url", url);
            result.put("urlHash", job.getString("urlHash"));
            connection = (HttpURLConnection) network.openConnection(new URL(url));
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(12000);
            connection.setReadTimeout(12000);
            connection.setInstanceFollowRedirects(true);
            connection.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36 DomainWatchAgent/" + BuildConfig.VERSION_NAME);
            connection.setRequestProperty("Accept", "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8");
            connection.setRequestProperty("Accept-Language", "th-TH,th;q=0.9,en;q=0.7");
            int code = connection.getResponseCode();
            InputStream stream = code >= 400 ? connection.getErrorStream() : connection.getInputStream();
            if (stream != null) {
                byte[] buffer = new byte[2048];
                stream.read(buffer);
                stream.close();
            }
            long responseMs = System.currentTimeMillis() - started;
            boolean alive = code < 400 || code == 401 || code == 403 || code == 429 || code == 451;
            result.put("status", alive ? (responseMs >= slowMs ? "SLOW" : "UP") : "DOWN");
            result.put("httpCode", code);
            result.put("responseMs", responseMs);
            if (!alive) result.put("error", "HTTP " + code + " จากเครือข่ายมือถือ");
        } catch (Exception error) {
            try {
                result.put("url", job.optString("url"));
                result.put("urlHash", job.optString("urlHash"));
                result.put("status", "DOWN");
                result.put("responseMs", System.currentTimeMillis() - started);
                result.put("error", error.getClass().getSimpleName() + ": " + String.valueOf(error.getMessage()));
            } catch (Exception ignored) { }
        } finally {
            if (connection != null) connection.disconnect();
        }
        try { result.put("checkedAt", isoNow()); } catch (Exception ignored) { }
        return result;
    }

    private static JSONObject jsonRequest(Network network, String method, String url, String token, JSONObject body) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) network.openConnection(new URL(url));
        connection.setRequestMethod(method);
        connection.setConnectTimeout(20000);
        connection.setReadTimeout(30000);
        connection.setRequestProperty("Accept", "application/json");
        connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        connection.setRequestProperty("User-Agent", "DomainWatchAgent/" + BuildConfig.VERSION_NAME);
        if (token != null && !token.isEmpty()) connection.setRequestProperty("Authorization", "Bearer " + token);
        if (body != null) {
            connection.setDoOutput(true);
            byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream output = connection.getOutputStream()) { output.write(bytes); }
        }
        int status = connection.getResponseCode();
        InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
        String text = readText(stream);
        connection.disconnect();
        JSONObject response = text.isEmpty() ? new JSONObject() : new JSONObject(text);
        if (status < 200 || status >= 300) throw new Exception(response.optString("error", "HTTP " + status));
        return response;
    }

    private static String readText(InputStream input) throws Exception {
        if (input == null) return "";
        StringBuilder builder = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(input, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) builder.append(line);
        }
        return builder.toString();
    }

    public static String sha256(String value) throws Exception {
        byte[] bytes = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
        StringBuilder out = new StringBuilder();
        for (byte b : bytes) out.append(String.format("%02x", b));
        return out.toString();
    }

    private static String cleanBase(String value) {
        String result = value == null ? "" : value.trim();
        while (result.endsWith("/")) result = result.substring(0, result.length() - 1);
        return result;
    }

    private static String isoNow() {
        java.text.SimpleDateFormat format = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US);
        format.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
        return format.format(new java.util.Date());
    }
}
