use std::path::{Path, PathBuf};

const ROOT_CANDIDATE_PATHS: [&str; 26] = [
    "logo.svg",
    "logo.png",
    "icon.svg",
    "icon.png",
    "favicon.svg",
    "favicon.png",
    "favicon.ico",
    ".github/logo.svg",
    ".github/logo.png",
    ".github/icon.svg",
    ".github/icon.png",
    ".github/favicon.svg",
    ".github/favicon.png",
    ".github/favicon.ico",
    "public/logo.svg",
    "public/logo.png",
    "public/favicon.svg",
    "public/favicon.png",
    "public/favicon.ico",
    "assets/logo.svg",
    "assets/logo.png",
    "assets/favicon.svg",
    "assets/favicon.png",
    "assets/favicon.ico",
    "static/logo.svg",
    "static/logo.png",
];

const WORKSPACE_ROOTS: [&str; 2] = ["packages", "apps"];
const WORKSPACE_CANDIDATE_PATHS: [&str; 13] = [
    "logo.svg",
    "logo.png",
    "icon.svg",
    "icon.png",
    "favicon.svg",
    "favicon.png",
    "favicon.ico",
    "public/logo.svg",
    "public/logo.png",
    "assets/logo.svg",
    "assets/logo.png",
    "assets/favicon.ico",
    "dev/logo.png",
];

fn find_first_file(base_path: &Path, candidate_paths: &[&str]) -> Option<String> {
    for candidate in candidate_paths {
        let full_path = base_path.join(candidate);
        if full_path.is_file() {
            return full_path.to_str().map(|s| s.to_string());
        }
    }
    None
}

fn find_workspace_icon(project_path: &Path) -> Option<String> {
    for workspace_root in WORKSPACE_ROOTS {
        let workspace_root_path = project_path.join(workspace_root);
        let entries = match std::fs::read_dir(&workspace_root_path) {
            Ok(entries) => entries,
            Err(_) => continue,
        };

        let mut package_paths: Vec<PathBuf> = entries
            .filter_map(|entry| entry.ok())
            .map(|entry| entry.path())
            .filter(|path| path.is_dir())
            .collect();
        package_paths.sort();

        for package_path in package_paths {
            if let Some(icon) = find_first_file(&package_path, &WORKSPACE_CANDIDATE_PATHS) {
                return Some(icon);
            }
        }
    }

    None
}

/// Detect a project icon by checking well-known candidate paths in priority order.
///
/// Returns the absolute path of the first matching file, or `None` if no
/// candidate exists. Filesystem errors (permission denied, etc.) are silently
/// ignored.
pub fn detect_project_icon(project_path: &Path) -> Option<String> {
    if let Some(icon) = find_first_file(project_path, &ROOT_CANDIDATE_PATHS) {
        return Some(icon);
    }

    find_workspace_icon(project_path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn empty_dir_returns_none() {
        let dir = tempdir().expect("create temp dir");
        assert_eq!(detect_project_icon(dir.path()), None);
    }

    #[test]
    fn finds_logo_png() {
        let dir = tempdir().expect("create temp dir");
        let logo = dir.path().join("logo.png");
        fs::write(&logo, b"fake png").expect("write logo.png");

        let result = detect_project_icon(dir.path());
        assert_eq!(result, Some(logo.to_string_lossy().to_string()));
    }

    #[test]
    fn svg_has_higher_priority_than_png() {
        let dir = tempdir().expect("create temp dir");
        fs::write(dir.path().join("logo.svg"), b"<svg/>").expect("write logo.svg");
        fs::write(dir.path().join("logo.png"), b"fake png").expect("write logo.png");

        let result = detect_project_icon(dir.path());
        let expected = dir.path().join("logo.svg").to_string_lossy().to_string();
        assert_eq!(result, Some(expected));
    }

    #[test]
    fn finds_public_favicon_ico() {
        let dir = tempdir().expect("create temp dir");
        let public_dir = dir.path().join("public");
        fs::create_dir(&public_dir).expect("create public/");
        let favicon = public_dir.join("favicon.ico");
        fs::write(&favicon, b"fake ico").expect("write favicon.ico");

        let result = detect_project_icon(dir.path());
        assert_eq!(result, Some(favicon.to_string_lossy().to_string()));
    }

    #[test]
    fn nonexistent_dir_returns_none() {
        let dir = Path::new("/tmp/acepe-nonexistent-dir-for-icon-test");
        assert_eq!(detect_project_icon(dir), None);
    }

    #[test]
    fn root_level_icon_beats_github_logo() {
        let dir = tempdir().expect("create temp dir");

        // Create .github/logo.svg (lower priority)
        let github_dir = dir.path().join(".github");
        fs::create_dir(&github_dir).expect("create .github/");
        fs::write(github_dir.join("logo.svg"), b"<svg/>").expect("write .github/logo.svg");

        // Create icon.png (higher priority — index 3 vs index 7)
        let icon = dir.path().join("icon.png");
        fs::write(&icon, b"fake png").expect("write icon.png");

        let result = detect_project_icon(dir.path());
        assert_eq!(result, Some(icon.to_string_lossy().to_string()));
    }

    #[test]
    fn finds_nested_workspace_asset_favicon() {
        let dir = tempdir().expect("create temp dir");
        let package_assets = dir.path().join("packages").join("extension").join("assets");
        fs::create_dir_all(&package_assets).expect("create packages/extension/assets");
        let favicon = package_assets.join("favicon.ico");
        fs::write(&favicon, b"fake ico").expect("write nested favicon");

        let result = detect_project_icon(dir.path());
        assert_eq!(result, Some(favicon.to_string_lossy().to_string()));
    }

    #[test]
    fn root_icon_beats_nested_workspace_icon() {
        let dir = tempdir().expect("create temp dir");
        let root_logo = dir.path().join("logo.svg");
        fs::write(&root_logo, b"<svg/>").expect("write root logo");

        let package_dev = dir.path().join("packages").join("extension").join("dev");
        fs::create_dir_all(&package_dev).expect("create packages/extension/dev");
        fs::write(package_dev.join("logo.png"), b"fake png").expect("write nested logo");

        let result = detect_project_icon(dir.path());
        assert_eq!(result, Some(root_logo.to_string_lossy().to_string()));
    }
}
