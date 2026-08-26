package app.domainwatch.agent;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

public final class CellularSession implements AutoCloseable {
    private final ConnectivityManager manager;
    private final ConnectivityManager.NetworkCallback callback;
    public final Network network;

    private CellularSession(ConnectivityManager manager, ConnectivityManager.NetworkCallback callback, Network network) {
        this.manager = manager;
        this.callback = callback;
        this.network = network;
    }

    public static CellularSession acquire(Context context, long timeoutSeconds) throws Exception {
        ConnectivityManager manager = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<Network> selected = new AtomicReference<>();
        ConnectivityManager.NetworkCallback callback = new ConnectivityManager.NetworkCallback() {
            @Override public void onAvailable(Network network) {
                if (selected.compareAndSet(null, network)) latch.countDown();
            }
        };
        NetworkRequest request = new NetworkRequest.Builder()
                .addTransportType(NetworkCapabilities.TRANSPORT_CELLULAR)
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .build();
        manager.requestNetwork(request, callback);
        if (!latch.await(timeoutSeconds, TimeUnit.SECONDS) || selected.get() == null) {
            manager.unregisterNetworkCallback(callback);
            throw new Exception("ไม่พบอินเทอร์เน็ตจากซิม กรุณาเปิดข้อมูลมือถือ");
        }
        return new CellularSession(manager, callback, selected.get());
    }

    @Override public void close() {
        try { manager.unregisterNetworkCallback(callback); } catch (Exception ignored) { }
    }
}
