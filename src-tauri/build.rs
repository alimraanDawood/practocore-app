fn main() {
	println!("cargo:rerun-if-env-changed=PRACTOCORE_UPDATE_CONTROL_URL");
	println!("cargo:rerun-if-env-changed=PRACTOCORE_UPDATE_CHANNEL");
	println!("cargo:rerun-if-env-changed=PRACTOCORE_ENABLE_HOT_UPDATE_POC");
	println!(
		"cargo:rustc-env=PRACTOCORE_UPDATE_CONTROL_URL={}",
		std::env::var("PRACTOCORE_UPDATE_CONTROL_URL").unwrap_or_default()
	);
	println!(
		"cargo:rustc-env=PRACTOCORE_UPDATE_CHANNEL={}",
		std::env::var("PRACTOCORE_UPDATE_CHANNEL").unwrap_or_else(|_| "production".into())
	);
	println!(
		"cargo:rustc-env=PRACTOCORE_ENABLE_HOT_UPDATE_POC={}",
		std::env::var("PRACTOCORE_ENABLE_HOT_UPDATE_POC").unwrap_or_default()
	);
    tauri_build::build()
}
