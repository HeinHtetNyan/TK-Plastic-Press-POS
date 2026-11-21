import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Read pos.url from local.properties (never committed to git)
val localProps = Properties().apply {
    val f = rootProject.file("local.properties")
    if (f.exists()) load(f.inputStream())
}
val posUrl: String = localProps.getProperty("pos.url", "https://api.heinh.dev")
// Comma-separated backup URLs tried in order if pos.url is unreachable (e.g. an
// intermittently-blocked domain) — leave empty in local.properties if none yet
val posFallbackUrls: String = localProps.getProperty("pos.fallback_urls", "")

// Upload key lives OUTSIDE the repo (vault folder "tk-plastic-android-upload-key"). Point to it with
// tk.keystore.dir in local.properties, or put it at ~/AndroidReleaseKeys/tk-plastic-android-upload-key.
val tkKeyDir = File(localProps.getProperty("tk.keystore.dir", System.getProperty("user.home") + "/AndroidReleaseKeys/tk-plastic-android-upload-key"))
val tkKeyProps = Properties().apply {
    val f = File(tkKeyDir, "keystore.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}

android {
    namespace = "com.tkplasticpress.pos"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.tkplasticpress.pos"
        // Testing only: put app.id.suffix=.test in local.properties to install side by side with the real app (empty = normal).
        applicationIdSuffix = localProps.getProperty("app.id.suffix", "")
        minSdk = 24
        targetSdk = 36
        versionCode = 4
        versionName = "1.2"
        // Injected from local.properties — change pos.url there, not in source code
        buildConfigField("String", "POS_URL", "\"$posUrl\"")
        buildConfigField("String", "POS_FALLBACK_URLS", "\"$posFallbackUrls\"")
    }

    buildFeatures {
        buildConfig = true
    }

    signingConfigs {
        if (tkKeyProps.isNotEmpty()) {
            create("release") {
                storeFile = File(tkKeyDir, tkKeyProps.getProperty("storeFile"))
                storePassword = tkKeyProps.getProperty("storePassword")
                keyAlias = tkKeyProps.getProperty("keyAlias")
                keyPassword = tkKeyProps.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            if (tkKeyProps.isNotEmpty()) signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
    kotlinOptions {
        jvmTarget = "1.8"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.11.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")
}
