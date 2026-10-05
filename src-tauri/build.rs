fn main() {
    println!("cargo:rerun-if-env-changed=TAURI_ANDROID_PROJECT_PATH");
    tauri_utils::build::update_android_manifest(
        "kartkoweczka-camera",
        "manifest",
        concat!(
            "<uses-permission android:name=\"android.permission.CAMERA\" />\n",
            "<uses-feature android:name=\"android.hardware.camera\" android:required=\"false\" />"
        )
        .to_owned(),
    )
    .expect("failed to configure Android camera permissions");

    tauri_build::build()
}
