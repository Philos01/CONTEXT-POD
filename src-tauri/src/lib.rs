use enigo::{
    Direction::{Click, Press, Release},
    Enigo, Key, Keyboard, Settings,
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
    Manager,
};

#[tauri::command]
fn simulate_paste_action() -> Result<(), String> {
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    enigo.key(Key::Control, Press).map_err(|e| e.to_string())?;
    enigo.key(Key::Unicode('v'), Click).map_err(|e| e.to_string())?;
    enigo.key(Key::Control, Release).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn show_window(app: tauri::AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("Window not found")?;
    window.show().map_err(|e| e.to_string())?;
    window.unminimize().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn hide_window(app: tauri::AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("Window not found")?;
    window.hide().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn capture_clipboard() -> Result<String, String> {
    // 静默读取剪贴板，不输出任何内容
    Ok(String::new())
}

fn restore_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        println!("[Context-Pod] Restoring window...");
        
        if let Err(e) = window.show() {
            eprintln!("[Context-Pod] show() failed: {}", e);
        }
        
        if let Err(e) = window.unminimize() {
            eprintln!("[Context-Pod] unminimize() failed: {}", e);
        }
        
        if let Err(e) = window.set_focus() {
            eprintln!("[Context-Pod] set_focus() failed: {}", e);
        }
        
        if let Err(e) = window.set_always_on_top(true) {
            eprintln!("[Context-Pod] set_always_on_top() failed: {}", e);
        }
        
        println!("[Context-Pod] ✅ Window restored");
    } else {
        eprintln!("[Context-Pod] ❌ Window not found");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            simulate_paste_action,
            show_window,
            hide_window,
            capture_clipboard
        ])
        .setup(|app| {
            let show_item = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)?;
            let hide_item = MenuItem::with_id(app, "hide", "隐藏窗口", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            
            let menu = Menu::with_items(app, &[&show_item, &hide_item, &quit_item])?;
            
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    println!("[Context-Pod] Menu event: {:?}", event.id);
                    match event.id.as_ref() {
                        "show" => restore_window(app),
                        "hide" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.hide();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    println!("[Context-Pod] Tray event: {:?}", event);
                    match event {
                        TrayIconEvent::DoubleClick { button, .. } => {
                            println!("[Context-Pod] Double click detected: {:?}", button);
                            restore_window(tray.app_handle());
                        }
                        _ => {}
                    }
                })
                .build(app)?;
            
            println!("[Context-Pod] ✅ Tray icon created with double-click support");
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}