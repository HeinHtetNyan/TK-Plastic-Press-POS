# The web page calls window.TKAndroid.sharePdf(...) (voucher printing). R8 must not rename or remove it.
-keepattributes JavascriptInterface
-keepclassmembers class com.tkplasticpress.pos.MainActivity$PrintBridge {
    @android.webkit.JavascriptInterface <methods>;
}
