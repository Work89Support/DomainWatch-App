package app.domainwatch.agent;

import android.net.Network;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.SocketTimeoutException;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

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
            String currentUrl = url;
            JSONArray redirectChain = new JSONArray();
            CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
            redirectChain.put(url);
            result.put("url", url);
            result.put("urlHash", job.getString("urlHash"));
            int code = 0;
            int redirectCount = 0;
            for (int hop = 0; hop <= 10; hop++) {
                if (connection != null) connection.disconnect();
                connection = openProbeConnection(network, currentUrl, cookies);
                code = connection.getResponseCode();
                cookies.put(new URI(currentUrl), connection.getHeaderFields());
                String location = connection.getHeaderField("Location");
                if (code < 300 || code >= 400 || location == null || location.trim().isEmpty()) break;
                if (hop == 10) throw new Exception("Redirect มากเกิน 10 ครั้ง");
                URL next = new URL(new URL(currentUrl), location.trim());
                String scheme = next.getProtocol().toLowerCase(Locale.US);
                if (!"http".equals(scheme) && !"https".equals(scheme)) throw new Exception("Redirect ไป protocol ที่ไม่รองรับ");
                currentUrl = next.toString();
                redirectChain.put(currentUrl);
                redirectCount++;
            }
            InputStream stream = code >= 400 ? connection.getErrorStream() : connection.getInputStream();
            String preview = "";
            if (stream != null) {
                byte[] buffer = new byte[8192];
                int read = stream.read(buffer);
                if (read > 0) preview = new String(buffer, 0, read, StandardCharsets.UTF_8);
                stream.close();
            }
            long responseMs = System.currentTimeMillis() - started;
            boolean blockPage = looksLikeBlockPage(currentUrl, preview, code);
            boolean alive = !blockPage && (code < 400 || code == 401 || code == 403 || code == 429);
            result.put("status", alive ? (responseMs >= slowMs ? "SLOW" : "UP") : "DOWN");
            result.put("httpCode", code);
            result.put("responseMs", responseMs);
            result.put("finalUrl", currentUrl);
            result.put("redirectCount", redirectCount);
            result.put("redirectChain", redirectChain);
            result.put("blockPageDetected", blockPage);
            String title = extractTitle(preview);
            if (!title.isEmpty()) result.put("pageTitle", title);
            if (blockPage) result.put("error", "ถูก Redirect ไปหน้าปิดกั้นของเครือข่ายมือถือ");
            else if (!alive) result.put("error", "HTTP " + code + " จากเครือข่ายมือถือ");
        } catch (SocketTimeoutException error) {
            try {
                result.put("url", job.optString("url"));
                result.put("urlHash", job.optString("urlHash"));
                result.put("status", "SLOW");
                result.put("responseMs", System.currentTimeMillis() - started);
                result.put("error", "ตอบกลับช้าหรือหมดเวลาตรวจ (ยังไม่ยืนยันว่าเว็บล่ม)");
            } catch (Exception ignored) { }
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

    private static HttpURLConnection openProbeConnection(Network network, String url, CookieManager cookies) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) network.openConnection(new URL(url));
        connection.setRequestMethod("GET");
        connection.setConnectTimeout(12000);
        connection.setReadTimeout(12000);
        connection.setInstanceFollowRedirects(false);
        connection.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36 DomainWatchAgent/" + BuildConfig.VERSION_NAME);
        connection.setRequestProperty("Accept", "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8");
        connection.setRequestProperty("Accept-Language", "th-TH,th;q=0.9,en;q=0.7");
        for (Map.Entry<String, List<String>> header : cookies.get(new URI(url), java.util.Collections.emptyMap()).entrySet()) {
            for (String value : header.getValue()) connection.addRequestProperty(header.getKey(), value);
        }
        return connection;
    }

    private static boolean looksLikeBlockPage(String finalUrl, String body, int code) {
        if (code == 451) return true;
        String urlText = finalUrl.toLowerCase(Locale.US);
        String[] urlMarkers = { "blockpage", "access-denied", "access_denied", "forbidden-by-policy", "/blocked/" };
        for (String marker : urlMarkers) if (urlText.contains(marker)) return true;
        String text = body.toLowerCase(Locale.US);
        String[] bodyMarkers = {
                "this site has been blocked", "access to this website has been blocked",
                "เว็บไซต์นี้ถูกระงับ", "ระงับการเข้าถึง", "ไม่สามารถเข้าถึงเว็บไซต์", "ถูกปิดกั้น",
                "สำนักงาน กสทช", "กระทรวงดิจิทัล", "internet censorship"
        };
        for (String marker : bodyMarkers) if (text.contains(marker)) return true;
        return false;
    }

    private static String extractTitle(String html) {
        if (html == null || html.isEmpty()) return "";
        Matcher matcher = Pattern.compile("(?is)<title[^>]*>(.*?)</title>").matcher(html);
        if (!matcher.find()) return "";
        String title = matcher.group(1).replaceAll("\\s+", " ").trim();
        return title.substring(0, Math.min(200, title.length()));
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
