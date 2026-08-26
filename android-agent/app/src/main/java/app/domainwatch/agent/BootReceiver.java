package app.domainwatch.agent;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

public class BootReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        SecurePrefs prefs = new SecurePrefs(context);
        if (!prefs.isEnrolled()) return;
        Intent service = new Intent(context, AgentService.class);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(service);
            else context.startService(service);
        } catch (Exception ignored) {
            prefs.setServiceRunning(false);
        }
    }
}
