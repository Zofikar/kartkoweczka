fn main() {
    println!("cargo:rerun-if-env-changed=TAURI_ANDROID_PROJECT_PATH");
    tauri_utils::build::update_android_manifest(
        "kartkoweczka-camera",
        "manifest",
        concat!(
            "<uses-permission android:name=\"android.permission.CAMERA\" />\n",
            "<uses-permission android:name=\"android.permission.REQUEST_INSTALL_PACKAGES\" />\n",
            "<uses-feature android:name=\"android.hardware.camera\" android:required=\"false\" />"
        )
        .to_owned(),
    )
    .expect("failed to configure Android camera permissions");

    println!("cargo:rerun-if-changed=android/update-provider.xml");
    tauri_utils::build::update_android_manifest(
        "kartkoweczka-updater",
        "application",
        include_str!("android/update-provider.xml").to_owned(),
    )
    .expect("failed to configure Android update file provider");

    tauri_build::build()
}
