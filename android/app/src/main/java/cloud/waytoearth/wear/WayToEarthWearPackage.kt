package cloud.waytoearth.wear

import android.util.Log
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class WayToEarthWearPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        Log.d("WayToEarthWearPackage", "📲 createNativeModules() called")
        val modules = listOf(WayToEarthWearModule(reactContext))
        Log.d("WayToEarthWearPackage", "✅ Returning ${modules.size} native module(s)")
        return modules
    }
    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
