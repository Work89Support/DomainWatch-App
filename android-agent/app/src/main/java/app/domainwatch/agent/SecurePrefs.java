package app.domainwatch.agent;

import android.content.Context;
import android.content.SharedPreferences;
import android.provider.Settings;
import android.util.Base64;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

public final class SecurePrefs {
    private static final String PREFS = "domainwatch_agent";
    private static final String KEY_ALIAS = "domainwatch_agent_key";
    private final SharedPreferences prefs;

    public SecurePrefs(Context context) {
        prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public String deviceId(Context context) {
        String existing = prefs.getString("device_id", "");
        if (!existing.isEmpty()) return existing;
        String androidId = Settings.Secure.getString(context.getContentResolver(), Settings.Secure.ANDROID_ID);
        String value = androidId + "-" + java.util.UUID.randomUUID();
        prefs.edit().putString("device_id", value).apply();
        return value;
    }

    public void saveEnrollment(String baseUrl, String token, String agentName, String carrier) throws Exception {
        prefs.edit()
                .putString("base_url", baseUrl)
                .putString("token", encrypt(token))
                .putString("agent_name", agentName)
                .putString("carrier", carrier)
                .apply();
    }

    public boolean isEnrolled() { return !prefs.getString("token", "").isEmpty(); }
    public String baseUrl() { return prefs.getString("base_url", ""); }
    public String agentName() { return prefs.getString("agent_name", "ยังไม่ผูกเครื่อง"); }
    public String carrier() { return prefs.getString("carrier", "-"); }
    public String token() {
        try { return decrypt(prefs.getString("token", "")); }
        catch (Exception e) { return ""; }
    }
    public void clearEnrollment() {
        String device = prefs.getString("device_id", "");
        prefs.edit().clear().putString("device_id", device).apply();
    }
    public void setServiceRunning(boolean value) { prefs.edit().putBoolean("service_running", value).apply(); }
    public boolean serviceRunning() { return prefs.getBoolean("service_running", false); }
    public void setLastSummary(String text, long time) { prefs.edit().putString("last_summary", text).putLong("last_time", time).apply(); }
    public String lastSummary() { return prefs.getString("last_summary", "ยังไม่มีผลตรวจ"); }
    public long lastTime() { return prefs.getLong("last_time", 0L); }

    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (store.containsAlias(KEY_ALIAS)) return ((KeyStore.SecretKeyEntry) store.getEntry(KEY_ALIAS, null)).getSecretKey();
        KeyGenerator generator = KeyGenerator.getInstance("AES", "AndroidKeyStore");
        generator.init(new android.security.keystore.KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                android.security.keystore.KeyProperties.PURPOSE_ENCRYPT | android.security.keystore.KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(android.security.keystore.KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(android.security.keystore.KeyProperties.ENCRYPTION_PADDING_NONE)
                .build());
        return generator.generateKey();
    }

    private String encrypt(String value) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key());
        byte[] encrypted = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
        return Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP) + "." + Base64.encodeToString(encrypted, Base64.NO_WRAP);
    }

    private String decrypt(String value) throws Exception {
        if (value == null || value.isEmpty()) return "";
        String[] parts = value.split("\\.", 2);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)));
        return new String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), StandardCharsets.UTF_8);
    }
}
