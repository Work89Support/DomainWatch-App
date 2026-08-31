package app.domainwatch.agent;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.view.Gravity;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;

import java.text.DateFormat;
import java.util.Date;

public class MainActivity extends Activity {
    public static final String ACTION_STATUS = "app.domainwatch.agent.STATUS";
    private SecurePrefs prefs;
    private TextView titleStatus;
    private TextView detail;
    private TextView lastResult;
    private Button startButton;
    private Button stopButton;
    private final BroadcastReceiver statusReceiver = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) { refresh(); }
    };

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        prefs = new SecurePrefs(this);
        buildUi();
        requestNotificationPermission();
        handleIntent(getIntent());
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    @Override protected void onResume() {
        super.onResume();
        IntentFilter filter = new IntentFilter(ACTION_STATUS);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(statusReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(statusReceiver, filter);
        refresh();
    }

    @Override protected void onPause() {
        try { unregisterReceiver(statusReceiver); } catch (Exception ignored) { }
        super.onPause();
    }

    private void buildUi() {
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(Color.rgb(245, 247, 252));
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(22), dp(28), dp(22), dp(28));
        scroll.addView(root, new ScrollView.LayoutParams(-1, -2));

        TextView logo = text("D", 28, Color.WHITE, true);
        logo.setGravity(Gravity.CENTER);
        logo.setBackground(rounded(Color.rgb(36, 88, 230), 18));
        root.addView(logo, params(dp(64), dp(64), 0, 0, 0, 14));

        root.addView(text("DomainWatch Agent", 27, Color.rgb(29, 41, 57), true), params(-1, -2, 0, 0, 0, 4));
        root.addView(text("ตรวจผ่านซิมมือถือหรือ VPN ทุก 5 นาที · ไม่ใช้ GPS", 15, Color.rgb(100, 116, 139), false), params(-1, -2, 0, 0, 0, 22));

        LinearLayout card = card();
        titleStatus = text("ยังไม่ผูกเครื่อง", 20, Color.rgb(71, 85, 105), true);
        detail = text("ติดตั้งสำเร็จแล้ว รอสแกน QR จากระบบ", 14, Color.rgb(100, 116, 139), false);
        detail.setLineSpacing(0, 1.25f);
        card.addView(titleStatus, params(-1, -2, 0, 0, 0, 8));
        card.addView(detail, params(-1, -2, 0, 0, 0, 0));
        root.addView(card, params(-1, -2, 0, 0, 0, 16));

        LinearLayout resultCard = card();
        resultCard.addView(text("ผลตรวจรอบล่าสุด", 13, Color.rgb(100, 116, 139), true));
        lastResult = text("ยังไม่มีผลตรวจ", 18, Color.rgb(30, 41, 59), true);
        resultCard.addView(lastResult, params(-1, -2, 0, 8, 0, 0));
        root.addView(resultCard, params(-1, -2, 0, 0, 0, 16));

        startButton = button("เริ่มตรวจตลอดเวลา", Color.rgb(36, 88, 230), Color.WHITE);
        startButton.setOnClickListener(v -> startMonitoring());
        root.addView(startButton, params(-1, dp(52), 0, 0, 0, 10));

        stopButton = button("หยุดตรวจชั่วคราว", Color.rgb(232, 238, 255), Color.rgb(23, 63, 173));
        stopButton.setOnClickListener(v -> stopMonitoring());
        root.addView(stopButton, params(-1, dp(50), 0, 0, 0, 10));

        Button battery = button("อนุญาตให้ทำงานเบื้องหลัง", Color.WHITE, Color.rgb(23, 63, 173));
        battery.setOnClickListener(v -> requestBatteryExemption());
        root.addView(battery, params(-1, dp(50), 0, 0, 0, 10));

        Button clear = button("ยกเลิกการผูกเครื่องนี้", Color.WHITE, Color.rgb(220, 38, 38));
        clear.setOnClickListener(v -> new AlertDialog.Builder(this)
                .setTitle("ยกเลิกการผูกเครื่อง?")
                .setMessage("โทรศัพท์เครื่องนี้จะหยุดส่งผลตรวจ ต้องสแกน QR ใหม่หากต้องการใช้อีกครั้ง")
                .setNegativeButton("ไม่ยกเลิก", null)
                .setPositiveButton("ยืนยัน", (dialog, which) -> {
                    stopMonitoring();
                    prefs.clearEnrollment();
                    refresh();
                }).show());
        root.addView(clear, params(-1, dp(50), 0, 0, 0, 20));

        TextView help = text("วิธีผูกเครื่อง\n1. แอดมินเปิดเมนู เครื่องตรวจเครือข่าย\n2. กดสร้าง QR หรือย้ายเครื่อง\n3. ใช้กล้องโทรศัพท์สแกน QR\n4. กด เปิดแอป DomainWatch Agent\n5. กดอนุญาตแจ้งเตือนและการทำงานเบื้องหลัง", 14, Color.rgb(71, 85, 105), false);
        help.setLineSpacing(dp(3), 1.2f);
        LinearLayout helpCard = card();
        helpCard.addView(help);
        root.addView(helpCard, params(-1, -2, 0, 0, 0, 0));
        setContentView(scroll);
    }

    private void handleIntent(Intent intent) {
        Uri data = intent == null ? null : intent.getData();
        if (data == null || !"domainwatch-agent".equals(data.getScheme()) || !"enroll".equals(data.getHost())) return;
        String base = data.getQueryParameter("base");
        String code = data.getQueryParameter("code");
        if (base == null || code == null) return;
        titleStatus.setText("กำลังผูกเครื่อง...");
        detail.setText("กำลังยืนยัน QR ผ่านเครือข่ายมือถือ");
        new Thread(() -> {
            try (CellularSession cellular = CellularSession.acquire(this, 25)) {
                JSONObject response = ApiClient.enroll(cellular.network, base, code, prefs.deviceId(this), Build.MANUFACTURER + " " + Build.MODEL);
                JSONObject agent = response.getJSONObject("agent");
                prefs.saveEnrollment(base, response.getString("token"), agent.getString("name"), agent.getString("carrier"));
                runOnUiThread(() -> {
                    Toast.makeText(this, "ผูกเครื่องสำเร็จ", Toast.LENGTH_LONG).show();
                    refresh();
                    startMonitoring();
                });
            } catch (Exception error) {
                runOnUiThread(() -> {
                    titleStatus.setText("ผูกเครื่องไม่สำเร็จ");
                    detail.setText(String.valueOf(error.getMessage()));
                    Toast.makeText(this, String.valueOf(error.getMessage()), Toast.LENGTH_LONG).show();
                });
            }
        }, "domainwatch-enroll").start();
    }

    private void startMonitoring() {
        if (!prefs.isEnrolled()) {
            Toast.makeText(this, "กรุณาสแกน QR จากระบบก่อน", Toast.LENGTH_LONG).show();
            return;
        }
        Intent service = new Intent(this, AgentService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(service); else startService(service);
        prefs.setServiceRunning(true);
        refresh();
    }

    private void stopMonitoring() {
        startService(new Intent(this, AgentService.class).setAction(AgentService.ACTION_STOP));
        prefs.setServiceRunning(false);
        refresh();
    }

    private void refresh() {
        if (!prefs.isEnrolled()) {
            titleStatus.setText("⚪ ยังไม่ผูกเครื่อง");
            detail.setText("กรุณาสร้าง QR ใหม่จาก DomainWatch แล้วสแกนเพื่อผูกเครื่อง");
            String last = prefs.lastSummary();
            if (prefs.lastTime() > 0) last += "\n" + DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(new Date(prefs.lastTime()));
            lastResult.setText(last);
            startButton.setEnabled(false);
            stopButton.setEnabled(false);
            return;
        }
        boolean running = prefs.serviceRunning();
        titleStatus.setText(running ? "🟢 กำลังตรวจตลอดเวลา" : "🟡 หยุดตรวจชั่วคราว");
        String carrier = prefs.carrier().toUpperCase().contains("TRUE") ? "TRUE" : prefs.carrier().toUpperCase();
        detail.setText("เครื่อง: " + prefs.agentName()
                + "\nจุดตรวจ: " + carrier + " — ประเทศไทย"
                + "\nเส้นทาง: อ่านค่าที่แอดมินกำหนดจากระบบในแต่ละรอบ"
                + "\nความเป็นส่วนตัว: ไม่ใช้ GPS และไม่ส่งพิกัด/IP โทรศัพท์");
        String last = prefs.lastSummary();
        if (prefs.lastTime() > 0) last += "\n" + DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(new Date(prefs.lastTime()));
        lastResult.setText(last);
        startButton.setEnabled(!running);
        stopButton.setEnabled(running);
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 100);
        }
    }

    private void requestBatteryExemption() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return;
        PowerManager power = (PowerManager) getSystemService(POWER_SERVICE);
        if (power.isIgnoringBatteryOptimizations(getPackageName())) {
            Toast.makeText(this, "อนุญาตทำงานเบื้องหลังแล้ว", Toast.LENGTH_LONG).show();
            return;
        }
        try { startActivity(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + getPackageName()))); }
        catch (Exception error) { startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)); }
    }

    private LinearLayout card() {
        LinearLayout view = new LinearLayout(this);
        view.setOrientation(LinearLayout.VERTICAL);
        view.setPadding(dp(18), dp(18), dp(18), dp(18));
        view.setBackground(rounded(Color.WHITE, 18));
        view.setElevation(dp(2));
        return view;
    }

    private TextView text(String value, int sp, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value); view.setTextSize(sp); view.setTextColor(color);
        if (bold) view.setTypeface(android.graphics.Typeface.DEFAULT, android.graphics.Typeface.BOLD);
        return view;
    }

    private Button button(String value, int background, int foreground) {
        Button button = new Button(this);
        button.setText(value); button.setTextSize(15); button.setTextColor(foreground);
        button.setAllCaps(false); button.setBackground(rounded(background, 12));
        return button;
    }

    private android.graphics.drawable.GradientDrawable rounded(int color, int radiusDp) {
        android.graphics.drawable.GradientDrawable shape = new android.graphics.drawable.GradientDrawable();
        shape.setColor(color); shape.setCornerRadius(dp(radiusDp)); return shape;
    }

    private LinearLayout.LayoutParams params(int width, int height, int left, int top, int right, int bottom) {
        LinearLayout.LayoutParams value = new LinearLayout.LayoutParams(width, height);
        value.setMargins(dp(left), dp(top), dp(right), dp(bottom)); return value;
    }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
}
