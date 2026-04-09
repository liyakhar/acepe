use crate::acp::session_update::SessionUpdate;

#[derive(Debug, Clone)]
pub struct ProviderExtensionEvent {
    pub updates: Vec<SessionUpdate>,
    pub response_adapter: Option<InboundResponseAdapter>,
}

#[derive(Debug, Clone)]
pub enum InboundResponseAdapter {
    AskQuestion {
        questions: Vec<QuestionResponseAdapter>,
    },
    CreatePlan {
        plan_uri: Option<String>,
    },
}

#[derive(Debug, Clone)]
pub struct QuestionResponseAdapter {
    pub question: String,
    pub question_id: String,
    pub options: Vec<QuestionOptionResponseAdapter>,
}

#[derive(Debug, Clone)]
pub struct QuestionOptionResponseAdapter {
    pub label: String,
    pub option_id: String,
}
