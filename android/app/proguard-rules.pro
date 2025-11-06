# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Add any project specific keep options here:

# ===== WayToEarth Native Module 보호 (절대 제거 금지!) =====
-keep class cloud.waytoearth.wear.** { *; }
-keep class cloud.waytoearth.MainApplication { *; }

# React Native Bridge 클래스 보호
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.modules.core.** { *; }

# @ReactMethod 어노테이션 보호
-keepattributes *Annotation*
-keepclassmembers class * {
    @com.facebook.react.bridge.ReactMethod <methods>;
}

# React Native 모듈 보호
-keep,allowobfuscation @interface com.facebook.react.bridge.ReactMethod
-keep @com.facebook.react.bridge.ReactModule class * { *; }

# Google Play Services Wearable 보호
-keep class com.google.android.gms.wearable.** { *; }

# Kotlin Coroutines 보호
-keep class kotlinx.coroutines.** { *; }

# Gson 보호
-keep class com.google.gson.** { *; }
