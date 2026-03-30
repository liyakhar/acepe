use super::super::provider::{command_exists, AgentProvider, CommandAvailabilityCache, SpawnConfig};
use crate::acp::{agent_installer, types::CanonicalAgentId};

/// Codex ACP Agent Provider
///
/// Uses a binary downloaded on demand from the ACP registry CDN.
/// The binary is cached at `{app_data_dir}/agents/codex/`.
pub struct CodexProvider;

impl AgentProvider for CodexProvider {
    fn id(&self) -> &str {
        "codex"
    }

    fn name(&self) -> &str {
        "Codex Agent"
    }

    fn spawn_config(&self) -> SpawnConfig {
        self.spawn_configs()
            .into_iter()
            .next()
            .expect("Codex provider must always return at least one spawn config")
    }

    fn spawn_configs(&self) -> Vec<SpawnConfig> {
        resolve_codex_spawn_configs()
    }

    fn icon(&self) -> &str {
        "codex"
    }

    fn is_available(&self) -> bool {
        let command_cache = CommandAvailabilityCache::get();
        agent_installer::is_installed(&CanonicalAgentId::Codex)
            || command_exists("codex-acp")
            || command_cache.bunx
            || command_cache.npx
    }

    fn uses_wrapper_plan_streaming(&self) -> bool {
        true
    }

    fn clear_message_tracker_on_prompt_response(&self) -> bool {
        true
    }
}

fn resolve_codex_spawn_configs() -> Vec<SpawnConfig> {
    let configs = build_codex_spawn_configs(
        agent_installer::get_cached_binary(&CanonicalAgentId::Codex)
            .map(|path| path.to_string_lossy().to_string()),
        agent_installer::get_cached_args(&CanonicalAgentId::Codex),
        command_exists("codex-acp"),
        CommandAvailabilityCache::get(),
    );

    if let Some(config) = configs.first() {
        tracing::info!(command = %config.command, args = ?config.args, "Using codex ACP launcher");
    }

    configs
}

fn build_codex_spawn_configs(
    cached_binary: Option<String>,
    cached_args: Vec<String>,
    system_binary_available: bool,
    command_cache: &CommandAvailabilityCache,
) -> Vec<SpawnConfig> {
    let mut configs = Vec::new();

    if let Some(cached_binary) = cached_binary {
        push_unique_spawn_config(
            &mut configs,
            SpawnConfig {
                command: cached_binary,
                args: cached_args,
                env: codex_env(),
            },
        );
    }

    if system_binary_available {
        push_unique_spawn_config(
            &mut configs,
            SpawnConfig {
                command: "codex-acp".to_string(),
                args: Vec::new(),
                env: codex_env(),
            },
        );
    }

    if command_cache.bunx {
        push_unique_spawn_config(
            &mut configs,
            SpawnConfig {
                command: "bunx".to_string(),
                args: vec!["@zed-industries/codex-acp".to_string()],
                env: codex_env(),
            },
        );
    }

    if command_cache.npx {
        push_unique_spawn_config(
            &mut configs,
            SpawnConfig {
                command: "npx".to_string(),
                args: vec!["-y".to_string(), "@zed-industries/codex-acp@latest".to_string()],
                env: codex_env(),
            },
        );
    }

    if configs.is_empty() {
        configs.push(SpawnConfig {
            command: "codex-acp".to_string(),
            args: Vec::new(),
            env: codex_env(),
        });
    }

    configs
}

fn codex_env() -> std::collections::HashMap<String, String> {
    crate::shell_env::build_env(crate::shell_env::EnvStrategy::FullInherit)
}

fn push_unique_spawn_config(configs: &mut Vec<SpawnConfig>, candidate: SpawnConfig) {
    let exists = configs
        .iter()
        .any(|config| config.command == candidate.command && config.args == candidate.args);
    if !exists {
        configs.push(candidate);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::acp::provider::CommandAvailabilityCache;
    use crate::acp::providers::claude_code::ensure_test_cache_dir;

    #[test]
    fn spawn_config_never_panics() {
        ensure_test_cache_dir();
        let provider = CodexProvider;
        let result = std::panic::catch_unwind(|| provider.spawn_config());

        assert!(result.is_ok(), "spawn_config should never panic");
        let config = result.expect("spawn_config should return config");
        assert!(
            !config.command.trim().is_empty(),
            "spawn command should never be empty"
        );
    }

    #[test]
    fn spawn_configs_prefer_cached_binary_and_args() {
        let configs = build_codex_spawn_configs(
            Some("/tmp/codex-acp".to_string()),
            vec!["--stdio".to_string()],
            false,
            &CommandAvailabilityCache::default(),
        );

        assert_eq!(configs[0].command, "/tmp/codex-acp");
        assert_eq!(configs[0].args, vec!["--stdio".to_string()]);
    }

    #[test]
    fn spawn_configs_include_js_launcher_fallbacks_when_binary_is_missing() {
        let configs = build_codex_spawn_configs(
            None,
            Vec::new(),
            false,
            &CommandAvailabilityCache {
                bunx: true,
                npx: true,
            },
        );

        assert_eq!(configs[0].command, "bunx");
        assert_eq!(configs[0].args, vec!["@zed-industries/codex-acp".to_string()]);
        assert_eq!(configs[1].command, "npx");
        assert_eq!(
            configs[1].args,
            vec!["-y".to_string(), "@zed-industries/codex-acp@latest".to_string()]
        );
    }
}
