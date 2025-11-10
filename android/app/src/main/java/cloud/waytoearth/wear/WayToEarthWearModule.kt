package cloud.waytoearth.wear

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.util.Log
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.android.gms.wearable.*
import com.google.gson.Gson
import kotlinx.coroutines.*
import kotlinx.coroutines.tasks.await
import android.provider.Settings
import android.net.Uri
import android.content.pm.PackageManager

class WayToEarthWearModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext), LifecycleEventListener {
    private val TAG = "WayToEarthWear"
    private val gson = Gson()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val messageClient: MessageClient by lazy { Wearable.getMessageClient(reactContext) }
    private val dataClient: DataClient by lazy { Wearable.getDataClient(reactContext) }
    private val nodeClient: NodeClient by lazy { Wearable.getNodeClient(reactContext) }

    private val broadcastReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == WearMessageListenerService.ACTION_WEAR_MESSAGE) {
                val eventType = intent.getStringExtra(WearMessageListenerService.EXTRA_EVENT_TYPE)
                val payload = intent.getStringExtra(WearMessageListenerService.EXTRA_PAYLOAD)
                if (eventType != null && payload != null) {
                    Log.d(TAG, "Broadcast received: $eventType")
                    emit(eventType, payload)
                }
            }
        }
    }

    companion object {
        private const val PATH_COMMAND_START = "/waytoearth/command/start"
        private const val PATH_COMMAND_STOP = "/waytoearth/command/stop"
        private const val PATH_RESPONSE_STARTED = "/waytoearth/response/started"
        private const val PATH_RESPONSE_STOPPED = "/waytoearth/response/stopped"
        private const val PATH_REALTIME_UPDATE = "/waytoearth/realtime/update"
        private const val PATH_RUNNING_COMPLETE = "/waytoearth/running/complete"
        private const val PATH_COMMAND_PAUSE = "/waytoearth/command/pause"
        private const val PATH_COMMAND_RESUME = "/waytoearth/command/resume"
        private const val PATH_RESPONSE_PAUSED = "/waytoearth/response/paused"
        private const val PATH_RESPONSE_RESUMED = "/waytoearth/response/resumed"
        private const val PATH_COMMAND_SYNC_PROFILE = "/waytoearth/command/sync_profile"
    }

    override fun getName(): String {
        Log.d(TAG, "🔧 WayToEarthWear module getName() called")
        return "WayToEarthWear"
    }

    init {
        Log.d(TAG, "🚀 WayToEarthWearModule initialized")
        reactContext.addLifecycleEventListener(this)
        registerBroadcastReceiver()
    }

    private fun registerBroadcastReceiver() {
        val filter = IntentFilter(WearMessageListenerService.ACTION_WEAR_MESSAGE)
        LocalBroadcastManager.getInstance(reactContext).registerReceiver(broadcastReceiver, filter)
        Log.d(TAG, "Broadcast receiver registered")
    }

    private fun unregisterBroadcastReceiver() {
        try {
            LocalBroadcastManager.getInstance(reactContext).unregisterReceiver(broadcastReceiver)
            Log.d(TAG, "Broadcast receiver unregistered")
        } catch (e: Exception) {
            Log.w(TAG, "Failed to unregister receiver: ${e.message}")
        }
    }

    @ReactMethod
    fun startWatchSession(sessionId: String, runningType: String, promise: Promise) {
        scope.launch {
            try {
                val payload = mapOf("sessionId" to sessionId, "runningType" to runningType)
                val ok = sendMessageAll(PATH_COMMAND_START, gson.toJson(payload).toByteArray())
                promise.resolve(ok)
            } catch (t: Throwable) {
                promise.reject("START_FAIL", t)
            }
        }
    }

    @ReactMethod
    fun stopWatchSession(sessionId: String, promise: Promise) {
        scope.launch {
            try {
                val payload = mapOf("sessionId" to sessionId)
                val ok = sendMessageAll(PATH_COMMAND_STOP, gson.toJson(payload).toByteArray())
                promise.resolve(ok)
            } catch (t: Throwable) {
                promise.reject("STOP_FAIL", t)
            }
        }
    }

    private suspend fun sendMessageAll(path: String, bytes: ByteArray): Boolean {
        val nodes = try { nodeClient.connectedNodes.await() } catch (_: Throwable) { emptyList() }
        if (nodes.isEmpty()) return false
        nodes.forEach { node -> messageClient.sendMessage(node.id, path, bytes).await() }
        return true
    }

    private fun emit(event: String, payload: String) {
        try {
            reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(event, payload)
        } catch (t: Throwable) {
            Log.e(TAG, "emit failed: $event ${t.message}")
        }
    }

    override fun onHostResume() {}
    override fun onHostPause() {}
    override fun onHostDestroy() {
        unregisterBroadcastReceiver()
        scope.cancel()
    }

    @ReactMethod
    fun pauseWatchSession(sessionId: String, promise: Promise) {
        scope.launch {
            try {
                val payload = mapOf("sessionId" to sessionId)
                val ok = sendMessageAll(PATH_COMMAND_PAUSE, gson.toJson(payload).toByteArray())
                promise.resolve(ok)
            } catch (t: Throwable) {
                promise.reject("PAUSE_FAIL", t)
            }
        }
    }

    @ReactMethod
    fun resumeWatchSession(sessionId: String, promise: Promise) {
        scope.launch {
            try {
                val payload = mapOf("sessionId" to sessionId)
                val ok = sendMessageAll(PATH_COMMAND_RESUME, gson.toJson(payload).toByteArray())
                promise.resolve(ok)
            } catch (t: Throwable) {
                promise.reject("RESUME_FAIL", t)
            }
        }
    }

    @ReactMethod
    fun checkWatchConnection(promise: Promise) {
        scope.launch {
            try {
                val nodes = nodeClient.connectedNodes.await()
                val connected = nodes.isNotEmpty()
                val deviceName = nodes.firstOrNull()?.displayName ?: "Unknown"

                val result = Arguments.createMap().apply {
                    putBoolean("connected", connected)
                    putString("deviceName", deviceName)
                    putInt("nodeCount", nodes.size)
                }

                Log.d(TAG, "Watch connection check: connected=$connected, device=$deviceName")
                promise.resolve(result)
            } catch (t: Throwable) {
                Log.e(TAG, "Check connection failed", t)
                promise.reject("CHECK_FAIL", t)
            }
        }
    }

    @ReactMethod
    fun openWearManager(promise: Promise) {
        try {
            val pm: PackageManager = reactContext.packageManager
            val candidates = listOf(
                // Samsung Galaxy Wearable
                "com.samsung.android.app.watchmanager",
                // Wear OS by Google
                "com.google.android.wearable.app",
                // Older/alt companion ids (fallbacks)
                "com.google.android.apps.wear.companion"
            )
            var launched = false
            for (pkg in candidates) {
                val intent = pm.getLaunchIntentForPackage(pkg)
                if (intent != null) {
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    reactContext.startActivity(intent)
                    launched = true
                    break
                }
            }
            if (!launched) {
                // Try Play Store for Galaxy Wearable
                val market = Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=com.samsung.android.app.watchmanager"))
                market.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                try {
                    reactContext.startActivity(market)
                    launched = true
                } catch (_: Throwable) { }
            }
            if (!launched) {
                // Fallback to Bluetooth settings
                val bt = Intent(Settings.ACTION_BLUETOOTH_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                reactContext.startActivity(bt)
                launched = true
            }
            promise.resolve(launched)
        } catch (t: Throwable) {
            promise.reject("OPEN_WEAR_FAIL", t)
        }
    }

    @ReactMethod
    fun syncProfile(weight: Int, height: Int, promise: Promise) {
        scope.launch {
            try {
                val payload = mapOf(
                    "weight" to weight,
                    "height" to height
                )
                Log.d(TAG, "syncProfile: weight=$weight, height=$height")
                val ok = sendMessageAll(PATH_COMMAND_SYNC_PROFILE, gson.toJson(payload).toByteArray())
                promise.resolve(ok)
            } catch (t: Throwable) {
                Log.e(TAG, "syncProfile failed", t)
                promise.reject("SYNC_PROFILE_FAIL", t)
            }
        }
    }
}
