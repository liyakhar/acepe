use super::super::provider::{AgentProvider, SpawnConfig};
use super::opencode_settings::apply_opencode_session_defaults;
use crate::acp::client_session::{SessionModelState, SessionModes};
use crate::acp::client_trait::CommunicationMode;
use crate::acp::error::AcpResult;
use crate::acp::types::CanonicalAgentId;
use std::collections::HashMap;
use std::path::Path;

/// OpenCode HTTP Agent Provider
/// Uses HTTP REST API + SSE instead of ACP JSON-RPC
pub struct OpenCodeProvider;

/// Environment allowlist for downloaded agent subprocesses.
const ALLOWED_ENV_KEYS: &[&str] = &[
    "PATH",
    "HOME",
    "TERM",
    "TMPDIR",
    "SHELL",
    "USER",
    "LANG",
    "LC_ALL",
    "LC_CTYPE",
    "SSH_AUTH_SOCK",
];

fn filtered_env() -> HashMap<String, String> {
    crate::shell_env::build_env(crate::shell_env::EnvStrategy::Allowlist(ALLOWED_ENV_KEYS))
}

fn normalize_opencode_serve_args(cached_args: Vec<String>) -> Vec<String> {
    let args = cached_args
        .into_iter()
        .filter(|arg| !arg.is_empty())
        .collect::<Vec<_>>();

    match args.first().map(String::as_str) {
        None | Some("acp") => vec!["serve".to_string()],
        _ => args,
    }
}

pub(crate) fn resolve_opencode_spawn_configs(
    cached_command: Option<String>,
    cached_args: Vec<String>,
) -> Vec<SpawnConfig> {
    let mut configs = Vec::new();
    let env = filtered_env();

    if let Some(command) = cached_command {
        push_unique_spawn_config(
            &mut configs,
            SpawnConfig {
                command,
                args: normalize_opencode_serve_args(cached_args),
                env,
            },
        );
    }

    configs
}

fn push_unique_spawn_config(configs: &mut Vec<SpawnConfig>, candidate: SpawnConfig) {
    let exists = configs
        .iter()
        .any(|config| config.command == candidate.command && config.args == candidate.args);
    if !exists {
        configs.push(candidate);
    }
}

impl AgentProvider for OpenCodeProvider {
    fn id(&self) -> &str {
        "opencode"
    }

    fn name(&self) -> &str {
        "OpenCode"
    }

    fn spawn_config(&self) -> SpawnConfig {
        tracing::debug!("Determining spawn config for OpenCode");

        self.spawn_configs().into_iter().next().unwrap_or_else(|| {
            tracing::warn!(
                "OpenCode launcher unavailable in cache; returning placeholder spawn config"
            );
            SpawnConfig {
                command: "__acepe_missing_opencode_binary__".to_string(),
                args: vec!["serve".to_string()],
                env: filtered_env(),
            }
        })
    }

    fn spawn_configs(&self) -> Vec<SpawnConfig> {
        resolve_opencode_spawn_configs(
            crate::acp::agent_installer::get_cached_binary(&CanonicalAgentId::OpenCode)
                .map(|path| path.to_string_lossy().to_string()),
            crate::acp::agent_installer::get_cached_args(&CanonicalAgentId::OpenCode),
        )
    }

    fn communication_mode(&self) -> CommunicationMode {
        // OpenCode uses HTTP mode for full permission/question support
        CommunicationMode::Http
    }

    fn icon(&self) -> &str {
        "opencode"
    }

    fn is_available(&self) -> bool {
        !self.spawn_configs().is_empty()
    }

    fn apply_session_defaults(
        &self,
        cwd: &Path,
        models: &mut SessionModelState,
        modes: &mut SessionModes,
    ) -> AcpResult<()> {
        apply_opencode_session_defaults(cwd, models, modes)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::acp::client::{AvailableModel, SessionModelState, SessionModes};
    use std::fs;

    #[test]
    fn resolve_spawn_configs_uses_cached_binary_and_defaults_to_serve() {
        let configs = resolve_opencode_spawn_configs(Some("/tmp/opencode".to_string()), Vec::new());

        assert_eq!(configs.len(), 1);
        assert_eq!(configs[0].command, "/tmp/opencode");
        assert_eq!(configs[0].args, vec!["serve"]);
    }

    #[test]
    fn resolve_spawn_configs_omits_fake_fallback_when_cache_is_missing() {
        let configs = resolve_opencode_spawn_configs(None, Vec::new());

        assert!(configs.is_empty());
    }

    #[test]
    fn normalize_serve_args_defaults_to_serve() {
        assert_eq!(normalize_opencode_serve_args(Vec::new()), vec!["serve"]);
    }

    #[test]
    fn normalize_serve_args_rewrites_cached_acp_mode_to_serve() {
        assert_eq!(
            normalize_opencode_serve_args(vec!["acp".to_string()]),
            vec!["serve"]
        );
    }

    #[test]
    fn configured_opencode_defaults_prefer_project_config() {
        let temp = tempfile::tempdir().expect("tempdir");
        let home = temp.path().join("home");
        let project = temp.path().join("project");
        fs::create_dir_all(home.join(".config/opencode")).expect("create user opencode dir");
        fs::create_dir_all(&project).expect("create project dir");

        fs::write(
            home.join(".config/opencode/opencode.json"),
            r#"{
  "$schema": "https://opencode.ai/config.json",
  "model": "anthropic/claude-sonnet-4-5",
  "default_agent": "build"
}"#,
        )
        .expect("write user config");
        fs::write(
            project.join("opencode.json"),
            r#"{
  "$schema": "https://opencode.ai/config.json",
  "model": "openai/gpt-5.4",
  "default_agent": "plan"
}"#,
        )
        .expect("write project config");

        let mut models = SessionModelState {
            available_models: vec![
                AvailableModel {
                    model_id: "anthropic/claude-sonnet-4-5".to_string(),
                    name: "Claude Sonnet 4.5".to_string(),
                    description: None,
                },
                AvailableModel {
                    model_id: "openai/gpt-5.4".to_string(),
                    name: "GPT-5.4".to_string(),
                    description: None,
                },
            ],
            current_model_id: "auto".to_string(),
            models_display: Default::default(),
        };
        let mut modes = SessionModes {
            current_mode_id: "build".to_string(),
            available_modes: vec![],
        };

        super::super::opencode_settings::apply_opencode_session_defaults_from_paths(
            Some(home.as_path()),
            project.as_path(),
            &mut models,
            &mut modes,
        )
        .expect("opencode session defaults should apply");

        assert_eq!(models.current_model_id, "openai/gpt-5.4");
        assert_eq!(modes.current_mode_id, "plan");
    }

    #[test]
    fn configured_opencode_model_is_inserted_when_missing_from_provider_catalog() {
        let temp = tempfile::tempdir().expect("tempdir");
        let home = temp.path().join("home");
        let project = temp.path().join("project");
        fs::create_dir_all(home.join(".config/opencode")).expect("create user opencode dir");
        fs::create_dir_all(&project).expect("create project dir");

        fs::write(
            home.join(".config/opencode/opencode.json"),
            r#"{
  "$schema": "https://opencode.ai/config.json",
  "model": "openrouter/qwen-coder"
}"#,
        )
        .expect("write user config");

        let mut models = SessionModelState {
            available_models: vec![],
            current_model_id: "auto".to_string(),
            models_display: Default::default(),
        };
        let mut modes = SessionModes {
            current_mode_id: "build".to_string(),
            available_modes: vec![],
        };

        super::super::opencode_settings::apply_opencode_session_defaults_from_paths(
            Some(home.as_path()),
            project.as_path(),
            &mut models,
            &mut modes,
        )
        .expect("opencode session defaults should apply");

        assert_eq!(models.current_model_id, "openrouter/qwen-coder");
        assert_eq!(models.available_models.len(), 1);
        assert_eq!(models.available_models[0].model_id, "openrouter/qwen-coder");
    }
}
