package cloud.waytoearth.wear

import android.content.Intent
import android.util.Log
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig
import com.google.android.gms.wearable.*

/**
 * WearableListenerService for receiving messages from watch app
 * This service runs in background and can receive messages even when app is closed
 */
class WearMessageListenerService : WearableListenerService() {

    private val TAG = "WearListenerService"

    companion object {
        private const val PATH_RESPONSE_STARTED = "/waytoearth/response/started"
        private const val PATH_RESPONSE_STOPPED = "/waytoearth/response/stopped"
        private const val PATH_RESPONSE_PAUSED = "/waytoearth/response/paused"
        private const val PATH_RESPONSE_RESUMED = "/waytoearth/response/resumed"
        private const val PATH_REALTIME_UPDATE = "/waytoearth/realtime/update"
        private const val PATH_RUNNING_COMPLETE = "/waytoearth/running/complete"

        // Broadcast actions for React Native module
        const val ACTION_WEAR_MESSAGE = "cloud.waytoearth.wear.MESSAGE"
        const val EXTRA_EVENT_TYPE = "eventType"
        const val EXTRA_PAYLOAD = "payload"
    }

    override fun onMessageReceived(messageEvent: MessageEvent) {
        Log.d(TAG, "onMessageReceived: path=${messageEvent.path}, size=${messageEvent.data.size}")

        val eventType = when (messageEvent.path) {
            PATH_RESPONSE_STARTED -> "wearStarted"
            PATH_RESPONSE_STOPPED -> "wearStopped"
            PATH_RESPONSE_PAUSED -> "wearPaused"
            PATH_RESPONSE_RESUMED -> "wearResumed"
            PATH_REALTIME_UPDATE -> "wearRealtimeUpdate"
            PATH_RUNNING_COMPLETE -> "wearRunningComplete"
            else -> {
                Log.w(TAG, "Unknown message path: ${messageEvent.path}")
                return
            }
        }

        val payload = String(messageEvent.data)
        Log.d(TAG, "Event: $eventType, Payload length: ${payload.length}")

        // Broadcast to WayToEarthWearModule for React Native
        val intent = Intent(ACTION_WEAR_MESSAGE).apply {
            putExtra(EXTRA_EVENT_TYPE, eventType)
            putExtra(EXTRA_PAYLOAD, payload)
        }
        LocalBroadcastManager.getInstance(this).sendBroadcast(intent)
    }

    override fun onDataChanged(dataEvents: DataEventBuffer) {
        Log.d(TAG, "onDataChanged: ${dataEvents.count} events")

        dataEvents.forEach { event ->
            if (event.type == DataEvent.TYPE_CHANGED) {
                val item = event.dataItem
                if (item.uri.path == PATH_RUNNING_COMPLETE) {
                    try {
                        val dataMap = DataMapItem.fromDataItem(item).dataMap
                        val json = dataMap.getString("session_data")
                        Log.d(TAG, "Data layer complete: length=${json?.length}")

                        if (!json.isNullOrEmpty()) {
                            // Broadcast to React Native
                            val intent = Intent(ACTION_WEAR_MESSAGE).apply {
                                putExtra(EXTRA_EVENT_TYPE, "wearRunningComplete")
                                putExtra(EXTRA_PAYLOAD, json)
                            }
                            LocalBroadcastManager.getInstance(this).sendBroadcast(intent)
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "Error parsing data layer complete", e)
                    }
                }
            }
        }
    }
}
