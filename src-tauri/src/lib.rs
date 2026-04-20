use enigo::{
    Direction::{Click, Press, Release},
    Enigo, Key, Keyboard, Settings,
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
    Manager,
};

#[cfg(target_os = "windows")]
use windows::Win32::Foundation::*;
#[cfg(target_os = "windows")]
use windows::Win32::Graphics::Gdi::*;
#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::*;

use image::{DynamicImage, GenericImageView, ImageBuffer, Rgba, ImageFormat};
use base64::Engine;

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
    Ok(String::new())
}

#[cfg(target_os = "windows")]
fn find_wechat_window() -> Result<HWND, String> {
    unsafe {
        let mut hwnd: Option<HWND> = None;
        EnumWindows(
            Some(enum_windows_callback),
            LPARAM(&mut hwnd as *mut _ as isize),
        )
        .map_err(|e| format!("EnumWindows failed: {}", e))?;

        hwnd.ok_or("未找到微信窗口".to_string())
    }
}

#[cfg(target_os = "windows")]
unsafe extern "system" fn enum_windows_callback(hwnd: HWND, lparam: LPARAM) -> BOOL {
    let hwnd_ptr = &mut *(lparam.0 as *mut Option<HWND>);
    
    // 只要找到任何匹配的窗口，就立即返回
    if hwnd_ptr.is_some() {
        return TRUE;
    }

    let mut title = [0u16; 512];
    let title_len = GetWindowTextW(hwnd, &mut title);
    let title_str = String::from_utf16_lossy(&title[..title_len as usize]);

    let mut class_name = [0u16; 256];
    let class_len = GetClassNameW(hwnd, &mut class_name);
    let class_str = String::from_utf16_lossy(&class_name[..class_len as usize]);

    let is_visible = IsWindowVisible(hwnd);
    if !is_visible.as_bool() {
        return TRUE;
    }

    // 更宽松的匹配条件
    let title_lower = title_str.to_lowercase();
    let class_lower = class_str.to_lowercase();
    
    let matches_wechat = 
        title_str.contains("微信") || 
        title_lower.contains("wechat") ||
        class_str.contains("WeChatMainWndForPC") || 
        class_lower.contains("wechat");

    if matches_wechat {
        *hwnd_ptr = Some(hwnd);
        println!("[Context-Pod] Found WeChat window: title='{}', class='{}'", title_str, class_str);
        return FALSE; // 停止枚举
    }

    TRUE
}

#[cfg(target_os = "windows")]
fn capture_window_screenshot(hwnd: HWND) -> Result<DynamicImage, String> {
    unsafe {
        let mut rect = RECT::default();
        GetWindowRect(hwnd, &mut rect).map_err(|e| format!("GetWindowRect failed: {}", e))?;

        let width = (rect.right - rect.left) as u32;
        let height = (rect.bottom - rect.top) as u32;

        if width == 0 || height == 0 {
            return Err("窗口尺寸为0".to_string());
        }

        let hdc_window = GetDC(hwnd);
        let hdc_mem = CreateCompatibleDC(hdc_window);
        let hbitmap = CreateCompatibleBitmap(hdc_window, width as i32, height as i32);

        let _old_bitmap = SelectObject(hdc_mem, hbitmap);

        let _ = BitBlt(hdc_mem, 0, 0, width as i32, height as i32, hdc_window, 0, 0, SRCCOPY);

        let mut bmp_info = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: width as i32,
                biHeight: -(height as i32),
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                biSizeImage: 0,
                biXPelsPerMeter: 0,
                biYPelsPerMeter: 0,
                biClrUsed: 0,
                biClrImportant: 0,
            },
            bmiColors: [RGBQUAD { rgbBlue: 0, rgbGreen: 0, rgbRed: 0, rgbReserved: 0 }],
        };

        let row_size = (width * 4) as usize;
        let buf_size = row_size * height as usize;
        let mut pixels_buf: Vec<u8> = vec![0u8; buf_size];

        let result = GetDIBits(
            hdc_mem,
            hbitmap,
            0,
            height,
            Some(pixels_buf.as_mut_ptr() as *mut _),
            &mut bmp_info,
            DIB_RGB_COLORS,
        );

        if result == 0 {
            SelectObject(hdc_mem, _old_bitmap);
            let _ = DeleteObject(hbitmap);
            let _ = DeleteDC(hdc_mem);
            ReleaseDC(hwnd, hdc_window);
            return Err("GetDIBits failed".to_string());
        }

        let mut pixels: Vec<Rgba<u8>> = Vec::with_capacity((width * height) as usize);
        for y in 0..height {
            for x in 0..width {
                let offset = (y * width * 4 + x * 4) as usize;
                let b = pixels_buf[offset];
                let g = pixels_buf[offset + 1];
                let r = pixels_buf[offset + 2];
                let a = pixels_buf[offset + 3];
                pixels.push(Rgba([r, g, b, if a == 0 { 255 } else { a }]));
            }
        }

        SelectObject(hdc_mem, _old_bitmap);
        let _ = DeleteObject(hbitmap);
        let _ = DeleteDC(hdc_mem);
        ReleaseDC(hwnd, hdc_window);

        let img_buffer = ImageBuffer::from_fn(width, height, |x, y| {
            pixels[(y * width + x) as usize]
        });

        Ok(DynamicImage::ImageRgba8(img_buffer))
    }
}

#[cfg(target_os = "windows")]
fn find_anchor_position(
    screenshot: &DynamicImage,
    anchor: &DynamicImage,
) -> Option<(u32, u32)> {
    let (sw, sh) = screenshot.dimensions();
    let (aw, ah) = anchor.dimensions();

    let search_x_start = if sw > 300 { sw - 300 } else { 0 };
    let search_x_end = sw;
    let search_y_start = 0u32;
    let search_y_end = if sh > 150 { 150 } else { sh };

    let anchor_pixels: Vec<Vec<Rgba<u8>>> = (0..ah)
        .map(|y| (0..aw).map(|x| anchor.get_pixel(x, y)).collect())
        .collect();

    let mut best_score = f64::MAX;
    let mut best_pos: Option<(u32, u32)> = None;

    let step = 2u32;

    for y in (search_y_start..search_y_end.saturating_sub(ah)).step_by(step as usize) {
        for x in (search_x_start..search_x_end.saturating_sub(aw)).step_by(step as usize) {
            let mut score = 0.0f64;
            let mut count = 0u32;

            for dy in (0..ah).step_by(2) {
                for dx in (0..aw).step_by(2) {
                    let sp = screenshot.get_pixel(x + dx, y + dy);
                    let ap = anchor_pixels[dy as usize][dx as usize];

                    if ap.0[3] < 128 {
                        continue;
                    }

                    let dr = sp.0[0] as f64 - ap.0[0] as f64;
                    let dg = sp.0[1] as f64 - ap.0[1] as f64;
                    let db = sp.0[2] as f64 - ap.0[2] as f64;
                    score += (dr * dr + dg * dg + db * db).sqrt();
                    count += 1;
                }
            }

            if count > 0 {
                let avg_score = score / count as f64;
                if avg_score < best_score {
                    best_score = avg_score;
                    best_pos = Some((x, y));
                }
            }
        }
    }

    if best_score < 50.0 {
        best_pos
    } else {
        None
    }
}

#[cfg(target_os = "windows")]
fn find_anchor_by_feature(screenshot: &DynamicImage) -> Option<(u32, u32)> {
    let (sw, sh) = screenshot.dimensions();

    let search_x_start = if sw > 300 { sw - 300 } else { 0 };
    let search_x_end = sw;
    let search_y_start = 0u32;
    let search_y_end = if sh > 120 { 120 } else { sh };

    let mut best_score = 0u32;
    let mut best_pos: Option<(u32, u32)> = None;

    for y in search_y_start..search_y_end.saturating_sub(10) {
        for x in search_x_start..search_x_end.saturating_sub(40) {
            let mut gray_dots = 0u32;
            let mut bg_pixels = 0u32;

            for dy in 0..10u32 {
                for dx in 0..40u32 {
                    let p = screenshot.get_pixel(x + dx, y + dy);
                    let r = p.0[0];
                    let g = p.0[1];
                    let b = p.0[2];

                    let is_grayish = (r as i32 - g as i32).unsigned_abs() < 20
                        && (g as i32 - b as i32).unsigned_abs() < 20
                        && r > 80 && r < 200;

                    if is_grayish {
                        gray_dots += 1;
                    }

                    let is_bg = (r > 230 && g > 230 && b > 230)
                        || (r < 50 && g < 50 && b < 50);

                    if is_bg {
                        bg_pixels += 1;
                    }
                }
            }

            let total = 10 * 40;
            let gray_ratio = gray_dots as f64 / total as f64;
            let bg_ratio = bg_pixels as f64 / total as f64;

            if gray_ratio > 0.15 && gray_ratio < 0.5 && bg_ratio > 0.3 {
                if gray_dots > best_score {
                    best_score = gray_dots;
                    best_pos = Some((x, y));
                }
            }
        }
    }

    best_pos
}

#[tauri::command]
#[cfg(target_os = "windows")]
fn capture_wechat_name_roi() -> Result<String, String> {
    let hwnd = find_wechat_window()?;

    let screenshot = capture_window_screenshot(hwnd)?;

    let anchor_path = std::env::current_dir()
        .map(|p| p.join("assets").join("wechat_anchor.png"))
        .unwrap_or_else(|_| std::path::PathBuf::from("assets/wechat_anchor.png"));

    let anchor_pos = if anchor_path.exists() {
        let anchor = image::open(&anchor_path).map_err(|e| format!("加载锚点图片失败: {}", e))?;
        find_anchor_position(&screenshot, &anchor)
    } else {
        None
    };

    let (anchor_x, anchor_y) = match anchor_pos {
        Some(pos) => pos,
        None => {
            let feature_pos = find_anchor_by_feature(&screenshot);
            match feature_pos {
                Some(pos) => pos,
                None => {
                    let (sw, _sh) = screenshot.dimensions();
                    (sw.saturating_sub(50), 10)
                }
            }
        }
    };

    let roi_x = anchor_x.saturating_sub(280);
    let roi_y = anchor_y.saturating_sub(15);
    let roi_w = 260u32;
    let roi_h = 40u32;

    let (sw, sh) = screenshot.dimensions();

    let actual_x = roi_x.max(0);
    let actual_y = roi_y.max(0);
    let actual_w = roi_w.min(sw.saturating_sub(actual_x));
    let actual_h = roi_h.min(sh.saturating_sub(actual_y));

    if actual_w == 0 || actual_h == 0 {
        return Err("裁剪区域无效".to_string());
    }

    let cropped = screenshot.view(actual_x, actual_y, actual_w, actual_h).to_image();

    let mut buffer = std::io::Cursor::new(Vec::new());
    cropped
        .write_to(&mut buffer, ImageFormat::Png)
        .map_err(|e| format!("图片编码失败: {}", e))?;

    let base64_str = base64::engine::general_purpose::STANDARD.encode(buffer.into_inner());
    Ok(base64_str)
}

#[tauri::command]
#[cfg(not(target_os = "windows"))]
fn capture_wechat_name_roi() -> Result<String, String> {
    Err("此功能仅支持 Windows 平台".to_string())
}

#[tauri::command]
#[cfg(target_os = "windows")]
fn get_active_window_title() -> Result<String, String> {
    unsafe {
        let hwnd = GetForegroundWindow();
        let mut title = [0u16; 512];
        let title_len = GetWindowTextW(hwnd, &mut title);
        let title_str = String::from_utf16_lossy(&title[..title_len as usize]);
        Ok(title_str)
    }
}

#[tauri::command]
#[cfg(not(target_os = "windows"))]
fn get_active_window_title() -> Result<String, String> {
    Err("此功能仅支持 Windows 平台".to_string())
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
        
        println!("[Context-Pod] Window restored");
    } else {
        eprintln!("[Context-Pod] Window not found");
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
            capture_clipboard,
            capture_wechat_name_roi,
            get_active_window_title
        ])
        .setup(|app| {
            let show_item = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)?;
            let hide_item = MenuItem::with_id(app, "hide", "隐藏窗口", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            
            let menu = Menu::with_items(app, &[&show_item, &hide_item, &quit_item])?;
            
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
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
            
            println!("[Context-Pod] Tray icon created with double-click support");
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
