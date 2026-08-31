package app.domainwatch.agent;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Build;
import android.os.IBinder;
import android.telephony.TelephonyManager;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

public class AgentService extends Service {
    public static final String ACTION_STOP = "app.domainwatch.agent.STOP";
    private static final String CHANNEL_ID = "domainwatch_monitor";
    private static final int NOTIFICATION_ID = 7101;
    private volatile boolean stopped = false;
    private Thread worker;
    private SecurePrefs prefs;

    @Override public void onCreate() {
        super.onCreate();
        prefs = new SecurePrefs(this);
        createChannel();
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopMonitoring();
            return START_NOT_STICKY;
        }
        startForeground(NOTIFICATION_ID, notification("กำลังเตรียมตรวจผ่านซิม..."));
        prefs.setServiceRunning(true);
        if (worker == null || !worker.isAlive()) {
            stopped = false;
            worker = new Thread(this::loop, "domainwatch-agent");
            worker.start();
        }
        return START_STICKY;
    }

    private void loop() {
        while (!stopped && prefs.isEnrolled()) {
            long cycleStarted = System.currentTimeMillis();
            try { runCycle(); }
            catch (Exception error) {
                String raw = String.valueOf(error.getMessage());
                boolean unauthorized = raw.toLowerCase(java.util.Locale.US).contains("unauthorized");
                String message = unauthorized
                        ? "สิทธิ์ผูกเครื่องหมดอายุ กรุณาสแกน QR ใหม่"
                        : "ตรวจไม่สำเร็จ: " + raw;
                prefs.setLastSummary(message, System.currentTimeMillis());
                updateNotification(message);
                broadcastUpdate();
                if (unauthorized) {
                    stopped = true;
                    prefs.clearEnrollment();
                    prefs.setLastSummary(message, System.currentTimeMillis());
                    break;
                }
            }
            long remaining = 300_000L - (System.currentTimeMillis() - cycleStarted);
            long sleep = Math.max(15_000L, remaining);
            for (long waited = 0; waited < sleep && !stopped; waited += 1000) {
                try { Thread.sleep(Math.min(1000, sleep - waited)); }
                catch (InterruptedException ignored) { Thread.currentThread().interrupt(); return; }
            }
        }
        stopMonitoring();
    }

    private void runCycle() throws Exception {
        String token = prefs.token();
        if (token.isEmpty()) throw new Exception("สิทธิ์เครื่องไม่ถูกต้อง กรุณาสแกน QR ใหม่");
        updateNotification("กำลังขอเครือข่ายมือถือ...");
        try (CellularSession cellular = CellularSession.acquire(this, 25)) {
            JSONObject jobsResponse = ApiClient.jobs(cellular.network, prefs.baseUrl(), token);
            JSONArray jobs = jobsResponse.getJSONArray("jobs");
            int slowMs = jobsResponse.optInt("slowResponseMs", 5000);
            String routeMode = jobsResponse.optString("routeMode", "CELLULAR_DIRECT");
            Network probeNetwork = cellular.network;
            String routeLabel = "ซิม " + prefs.carrier() + " โดยตรง";
            if ("VPN_DEFAULT".equals(routeMode)) {
                ConnectivityManager connectivity = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
                Network active = connectivity == null ? null : connectivity.getActiveNetwork();
                NetworkCapabilities activeCaps = connectivity == null || active == null ? null : connectivity.getNetworkCapabilities(active);
                if (active == null || activeCaps == null || !activeCaps.hasTransport(NetworkCapabilities.TRANSPORT_VPN)) {
                    throw new Exception("ตั้งค่าให้ตรวจผ่าน VPN แต่ไม่พบ VPN ที่เชื่อมต่อ กรุณาเปิด VPN แล้วรอรอบใหม่");
                }
                probeNetwork = active;
                routeLabel = "VPN (ตำแหน่งตาม IP ทางออก)";
            }
            updateNotification("กำลังตรวจ " + jobs.length() + " URL ผ่าน " + routeLabel);

            ExecutorService pool = Executors.newFixedThreadPool(Math.min(32, Math.max(1, jobs.length())));
            List<Future<JSONObject>> futures = new ArrayList<>();
            final Network selectedNetwork = probeNetwork;
            for (int index = 0; index < jobs.length(); index++) {
                JSONObject job = jobs.getJSONObject(index);
                futures.add(pool.submit((Callable<JSONObject>) () -> ApiClient.probe(selectedNetwork, job, slowMs)));
            }
            pool.shutdown();
            JSONArray results = new JSONArray();
            int up = 0, slow = 0, down = 0;
            for (Future<JSONObject> future : futures) {
                JSONObject result = future.get();
                results.put(result);
                String status = result.optString("status");
                if ("UP".equals(status)) up++; else if ("SLOW".equals(status)) slow++; else down++;
            }

            TelephonyManager phone = (TelephonyManager) getSystemService(TELEPHONY_SERVICE);
            String carrier = phone == null ? prefs.carrier() : phone.getNetworkOperatorName();
            NetworkCapabilities caps = ((ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE)).getNetworkCapabilities(probeNetwork);
            String networkType = caps != null && caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN) ? "VPN"
                    : caps != null && caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) ? "CELLULAR" : "UNKNOWN";
            JSONObject body = new JSONObject();
            body.put("deviceLabel", Build.MANUFACTURER + " " + Build.MODEL);
            body.put("appVersion", BuildConfig.VERSION_NAME);
            body.put("reportedCarrier", carrier);
            body.put("networkType", networkType);
            body.put("routeModeUsed", routeMode);
            body.put("results", results);
            // ส่งผลผ่านเส้นทางเดียวกับที่ตรวจ เพื่อให้ server อ่านเมือง/ประเทศของ IP ทางออกนั้นได้
            ApiClient.submit(probeNetwork, prefs.baseUrl(), token, body);
            String summary = "ปกติ " + up + " · ช้า " + slow + " · ใช้ไม่ได้ " + down;
            prefs.setLastSummary(summary, System.currentTimeMillis());
            updateNotification(summary + " · ตรวจอีกครั้งใน 5 นาที");
            broadcastUpdate();
        }
    }

    private void stopMonitoring() {
        stopped = true;
        prefs.setServiceRunning(false);
        if (worker != null) worker.interrupt();
        stopForeground(true);
        stopSelf();
        broadcastUpdate();
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "DomainWatch ตรวจเครือข่าย", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("แสดงสถานะการตรวจลิงก์ผ่านซิมมือถือ");
            ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(channel);
        }
    }

    private Notification notification(String text) {
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent openIntent = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Intent stop = new Intent(this, AgentService.class).setAction(ACTION_STOP);
        PendingIntent stopIntent = PendingIntent.getService(this, 1, stop, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new Notification.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_notify_sync)
                .setContentTitle("DomainWatch Agent · " + prefs.carrier())
                .setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(text))
                .setContentIntent(openIntent)
                .addAction(new Notification.Action.Builder(android.R.drawable.ic_media_pause, "หยุดตรวจ", stopIntent).build())
                .setOngoing(true)
                .build();
    }

    private void updateNotification(String text) {
        ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).notify(NOTIFICATION_ID, notification(text));
    }

    private void broadcastUpdate() { sendBroadcast(new Intent(MainActivity.ACTION_STATUS)); }
    @Override public void onDestroy() { prefs.setServiceRunning(false); super.onDestroy(); }
    @Override public IBinder onBind(Intent intent) { return null; }
}
