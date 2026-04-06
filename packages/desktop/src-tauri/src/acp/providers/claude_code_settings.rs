use std::path::Path;

pub(crate) fn resolve_claude_runtime_mode_id(
    requested_mode_id: Option<&str>,
    cwd: &Path,
) -> String {
    match requested_mode_id {
        Some(mode_id) if mode_id != "default" => mode_id.to_string(),
        _ => configured_claude_permission_mode(cwd).unwrap_or_else(|| "default".to_string()),
    }
}

pub(crate) fn configured_claude_permission_mode(cwd: &Path) -> Option<String> {
    configured_claude_permission_mode_with_home(cwd, dirs::home_dir().as_deref())
}

fn configured_claude_permission_mode_with_home(
    cwd: &Path,
    home_dir: Option<&Path>,
) -> Option<String> {
    let mut configured_mode = None;

    if let Some(home_dir) = home_dir {
        configured_mode = read_claude_permission_mode_from_settings(
            &home_dir.join(".claude").join("settings.json"),
        );
    }

    for settings_path in [
        cwd.join(".claude").join("settings.json"),
        cwd.join(".claude").join("settings.local.json"),
    ] {
        if let Some(mode) = read_claude_permission_mode_from_settings(&settings_path) {
            configured_mode = Some(mode);
        }
    }

    configured_mode
}

fn read_claude_permission_mode_from_settings(path: &Path) -> Option<String> {
    let contents = std::fs::read_to_string(path).ok()?;
    let parsed = serde_json::from_str::<serde_json::Value>(&contents).ok()?;
    parse_claude_permission_mode(&parsed)
}

fn parse_claude_permission_mode(settings: &serde_json::Value) -> Option<String> {
    for pointer in [
        "/permissions/defaultMode",
        "/permissionMode",
        "/claude/permissionMode",
    ] {
        if let Some(value) = settings
            .pointer(pointer)
            .and_then(serde_json::Value::as_str)
        {
            if matches!(
                value,
                "default" | "acceptEdits" | "bypassPermissions" | "plan"
            ) {
                return Some(value.to_string());
            }
        }
    }

    for pointer in [
        "/dangerouslySkipPermissions",
        "/claude/dangerouslySkipPermissions",
    ] {
        if settings
            .pointer(pointer)
            .and_then(serde_json::Value::as_bool)
            == Some(true)
        {
            return Some("bypassPermissions".to_string());
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{LazyLock, Mutex};

    static HOME_ENV_LOCK: LazyLock<Mutex<()>> = LazyLock::new(|| Mutex::new(()));

    #[test]
    fn resolve_claude_runtime_mode_id_uses_user_settings_for_default_requests() {
        let _guard = HOME_ENV_LOCK.lock().expect("lock HOME env");
        let previous_home = std::env::var_os("HOME");
        let temp = tempfile::tempdir().expect("temp dir");
        let home = temp.path().join("home");
        let project = temp.path().join("project");
        std::fs::create_dir_all(home.join(".claude")).expect("create claude dir");
        std::fs::create_dir_all(&project).expect("create project dir");
        std::fs::write(
            home.join(".claude").join("settings.json"),
            r#"{
  "skipDangerousModePermissionPrompt": true,
  "permissions": {
    "defaultMode": "bypassPermissions"
  }
}"#,
        )
        .expect("write settings");
        std::env::set_var("HOME", &home);

        let resolved = resolve_claude_runtime_mode_id(None, &project);

        match previous_home {
            Some(previous_home) => std::env::set_var("HOME", previous_home),
            None => std::env::remove_var("HOME"),
        }

        assert_eq!(resolved, "bypassPermissions");
    }

    #[test]
    fn configured_claude_permission_mode_prefers_local_over_user_settings() {
        let temp = tempfile::tempdir().expect("temp dir");
        let home = temp.path().join("home");
        let project = temp.path().join("project");
        std::fs::create_dir_all(home.join(".claude")).expect("create user claude dir");
        std::fs::create_dir_all(project.join(".claude")).expect("create project claude dir");
        std::fs::write(
            home.join(".claude").join("settings.json"),
            r#"{"permissions":{"defaultMode":"acceptEdits"}}"#,
        )
        .expect("write user settings");
        std::fs::write(
            project.join(".claude").join("settings.local.json"),
            r#"{"permissions":{"defaultMode":"bypassPermissions"}}"#,
        )
        .expect("write local settings");

        let mode = configured_claude_permission_mode_with_home(&project, Some(&home));

        assert_eq!(mode.as_deref(), Some("bypassPermissions"));
    }

    #[test]
    fn parse_claude_permission_mode_supports_legacy_dangerously_skip_permissions() {
        let settings = serde_json::json!({
            "claude": {
                "dangerouslySkipPermissions": true
            }
        });

        assert_eq!(
            parse_claude_permission_mode(&settings).as_deref(),
            Some("bypassPermissions")
        );
    }
}
