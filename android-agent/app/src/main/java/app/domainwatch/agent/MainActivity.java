package app.domainwatch.agent;

import android.Manifest;
import android.annotation.SuppressLint;
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
import java.util.Locale;

public class MainActivity extends Activity {
    public static final String ACTION_STATUS = "app.domainwatch.agent.STATUS";
    private SecurePrefs prefs;
    private TextView titleStatus;
    private TextView detail;
    private TextView lastResult;
    private TextView setupStatus;
    private Button setupButton;
    private Button startButton;
    private Button stopButton;
    private boolean quickSetupPending = false;
    private boolean waitingForBatterySettings = false;
    private final BroadcastReceiver statusReceiver = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) { refresh(); }
    };

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        prefs = new SecurePrefs(this);
        buildUi();
        handleIntent(getIntent());
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    @SuppressLint("UnspecifiedRegisterReceiverFlag")
    @Override protected void onResume() {
        super.onResume();
        IntentFilter filter = new IntentFilter(ACTION_STATUS);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(statusReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(statusReceiver, filter);
        refresh();
        if (waitingForBatterySettings) {
            waitingForBatterySettings = false;
            if (quickSetupPending && isBatteryExempt()) finishQuickSetup();
            else if (quickSetupPending) {
                quickSetupPending = false;
                Toast.makeText(this, "ยังไม่ได้อนุญาตแบตเตอรี่ กรุณากดปุ่มตั้งค่าอีกครั้ง", Toast.LENGTH_LONG).show();
                refresh();
            }
        }
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

        LinearLayout setupCard = card();
        setupCard.addView(text("ตั้งค่าเครื่องครั้งเดียว", 17, Color.rgb(30, 41, 59), true));
        setupCard.addView(text("กดปุ่มเดียว แล้วแตะ อนุญาต ในหน้าต่าง Android ที่แสดง", 13, Color.rgb(100, 116, 139), false), params(-1, -2, 0, 4, 0, 10));
        setupStatus = text("กำลังตรวจสอบการตั้งค่า...", 14, Color.rgb(71, 85, 105), false);
        setupStatus.setLineSpacing(dp(2), 1.15f);
        setupCard.addView(setupStatus, params(-1, -2, 0, 0, 0, 12));
        setupButton = button("ตั้งค่าให้พร้อมและเริ่มตรวจ", Color.rgb(36, 88, 230), Color.WHITE);
        setupButton.setOnClickListener(v -> beginQuickSetup());
        setupCard.addView(setupButton, params(-1, dp(54), 0, 0, 0, 0));
        root.addView(setupCard, params(-1, -2, 0, 0, 0, 16));

        LinearLayout resultCard = card();
        resultCard.addView(text("ผลตรวจรอบล่าสุด", 13, Color.rgb(100, 116, 139), true));
        lastResult = text("ยังไม่มีผลตรวจ", 18, Color.rgb(30, 41, 59), true);
        resultCard.addView(lastResult, params(-1, -2, 0, 8, 0, 0));
        root.addView(resultCard, params(-1, -2, 0, 0, 0, 16));

        startButton = button("เริ่มตรวจอีกครั้ง", Color.rgb(232, 238, 255), Color.rgb(23, 63, 173));
        startButton.setOnClickListener(v -> startMonitoring());
        root.addView(startButton, params(-1, dp(52), 0, 0, 0, 10));

        stopButton = button("หยุดตรวจชั่วคราว", Color.rgb(232, 238, 255), Color.rgb(23, 63, 173));
        stopButton.setOnClickListener(v -> stopMonitoring());
        root.addView(stopButton, params(-1, dp(50), 0, 0, 0, 10));

        Button battery = button("เปิดการตั้งค่าแบตเตอรี่เพิ่มเติม", Color.WHITE, Color.rgb(23, 63, 173));
        battery.setOnClickListener(v -> openBatterySettings());
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

        TextView help = text("วิธีใช้งานแบบง่าย\n1. สแกน QR จากหน้าเครื่องตรวจเครือข่าย\n2. กด เปิดแอป DomainWatch Agent\n3. กด ตั้งค่าให้พร้อมและเริ่มตรวจ\n4. แตะ อนุญาต ในหน้าต่าง Android ที่แสดง\n5. เมื่อครบทุกข้อสามารถปิดหน้าจอได้", 14, Color.rgb(71, 85, 105), false);
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
                    beginQuickSetup();
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
            refreshSetupStatus();
            return;
        }
        boolean running = prefs.serviceRunning();
        titleStatus.setText(running ? "🟢 กำลังตรวจตลอดเวลา" : "🟡 หยุดตรวจชั่วคราว");
        String normalizedCarrier = prefs.carrier().toUpperCase(Locale.ROOT);
        String carrier = normalizedCarrier.contains("TRUE") ? "TRUE" : normalizedCarrier;
        detail.setText("เครื่อง: " + prefs.agentName()
                + "\nจุดตรวจ: " + carrier + " — ประเทศไทย"
                + "\nเส้นทาง: อ่านค่าที่แอดมินกำหนดจากระบบในแต่ละรอบ"
                + "\nความเป็นส่วนตัว: ไม่ใช้ GPS และไม่ส่งพิกัด/IP โทรศัพท์");
        String last = prefs.lastSummary();
        if (prefs.lastTime() > 0) last += "\n" + DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(new Date(prefs.lastTime()));
        lastResult.setText(last);
        startButton.setEnabled(!running);
        stopButton.setEnabled(running);
        refreshSetupStatus();
    }

    private void beginQuickSetup() {
        if (!prefs.isEnrolled()) {
            Toast.makeText(this, "กรุณาสแกน QR จากระบบก่อน", Toast.LENGTH_LONG).show();
            return;
        }
        quickSetupPending = true;
        if (!hasNotificationPermission()) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 100);
            return;
        }
        continueQuickSetup();
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != 100 || !quickSetupPending) return;
        if (!hasNotificationPermission()) {
            quickSetupPending = false;
            Toast.makeText(this, "ต้องอนุญาตการแจ้งเตือนเพื่อให้เห็นว่าแอปกำลังตรวจ", Toast.LENGTH_LONG).show();
            refresh();
            return;
        }
        continueQuickSetup();
    }

    private void continueQuickSetup() {
        if (!isBatteryExempt()) {
            waitingForBatterySettings = true;
            try { startActivity(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + getPackageName()))); }
            catch (Exception error) { startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)); }
            return;
        }
        finishQuickSetup();
    }

    private void finishQuickSetup() {
        quickSetupPending = false;
        startMonitoring();
        Toast.makeText(this, "ตั้งค่าพร้อมแล้ว เริ่มตรวจตลอดเวลา", Toast.LENGTH_LONG).show();
        refresh();
    }

    private boolean hasNotificationPermission() {
        return Build.VERSION.SDK_INT < 33 || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean isBatteryExempt() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true;
        PowerManager power = (PowerManager) getSystemService(POWER_SERVICE);
        return power != null && power.isIgnoringBatteryOptimizations(getPackageName());
    }

    private void refreshSetupStatus() {
        if (setupStatus == null || setupButton == null) return;
        boolean enrolled = prefs.isEnrolled();
        boolean notifications = hasNotificationPermission();
        boolean battery = isBatteryExempt();
        boolean running = prefs.serviceRunning();
        setupStatus.setText((enrolled ? "✅" : "⬜") + " ผูกเครื่องกับระบบ\n"
                + (notifications ? "✅" : "⬜") + " อนุญาตการแจ้งเตือน\n"
                + (battery ? "✅" : "⬜") + " ไม่จำกัดการทำงานเบื้องหลัง\n"
                + (running ? "✅" : "⬜") + " บริการตรวจทำงานอยู่");
        setupButton.setEnabled(enrolled);
        setupButton.setText(enrolled && notifications && battery && running
                ? "พร้อมแล้ว · เริ่มตรวจอีกครั้ง"
                : "ตั้งค่าให้พร้อมและเริ่มตรวจ");
    }

    private void openBatterySettings() {
        try { startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()))); }
        catch (Exception error) { startActivity(new Intent(Settings.ACTION_SETTINGS)); }
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
