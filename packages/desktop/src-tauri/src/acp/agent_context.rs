use crate::acp::parsers::AgentType;

tokio::task_local! {
    static TASK_AGENT: AgentType;
}

pub fn with_agent<F, R>(agent: AgentType, f: F) -> R
where
    F: FnOnce() -> R,
{
    TASK_AGENT.sync_scope(agent, f)
}

pub fn current_agent() -> Option<AgentType> {
    TASK_AGENT.try_with(|agent| *agent).ok()
}

#[cfg(test)]
mod tests {
    use super::{current_agent, with_agent};
    use crate::acp::parsers::AgentType;

    #[test]
    fn returns_none_without_context_and_restores_after_nesting() {
        assert_eq!(current_agent(), None);

        with_agent(AgentType::Codex, || {
            assert_eq!(current_agent(), Some(AgentType::Codex));
            with_agent(AgentType::Cursor, || {
                assert_eq!(current_agent(), Some(AgentType::Cursor))
            });
            assert_eq!(current_agent(), Some(AgentType::Codex));
        });

        assert_eq!(current_agent(), None);
    }

    #[tokio::test]
    async fn maintains_context_across_await_points() {
        assert_eq!(current_agent(), None);

        let result = super::TASK_AGENT
            .scope(AgentType::Codex, async {
                assert_eq!(current_agent(), Some(AgentType::Codex));
                tokio::time::sleep(tokio::time::Duration::from_millis(1)).await;
                assert_eq!(current_agent(), Some(AgentType::Codex));

                let nested = super::TASK_AGENT
                    .scope(AgentType::Cursor, async {
                        assert_eq!(current_agent(), Some(AgentType::Cursor));
                        tokio::time::sleep(tokio::time::Duration::from_millis(1)).await;
                        assert_eq!(current_agent(), Some(AgentType::Cursor));
                        42
                    })
                    .await;

                assert_eq!(current_agent(), Some(AgentType::Codex));
                nested
            })
            .await;

        assert_eq!(result, 42);
        assert_eq!(current_agent(), None);
    }
}
