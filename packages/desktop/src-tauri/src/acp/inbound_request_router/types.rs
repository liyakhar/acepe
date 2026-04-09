use crate::terminal::types::EnvVariable;
use serde::Deserialize;
use serde_json::Value;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct FsReadTextFileParamsRaw {
    pub session_id: Option<String>,
    pub path: Option<String>,
    pub line: Option<u32>,
    pub limit: Option<u32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct FsWriteTextFileParamsRaw {
    pub session_id: Option<String>,
    pub path: Option<String>,
    pub content: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct TerminalRequestParamsRaw {
    pub session_id: Option<String>,
    pub terminal_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct TerminalCreateParamsRaw {
    pub session_id: Option<String>,
    pub command: Option<String>,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub cwd: Option<String>,
    #[serde(default)]
    pub env: Vec<EnvVariable>,
    #[serde(default)]
    pub output_byte_limit: Option<u64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct SessionRequestPermissionParamsRaw {
    pub session_id: Option<String>,
    #[serde(default)]
    pub options: Vec<PermissionOptionRaw>,
    pub tool_call: Option<PermissionToolCallRaw>,
    #[serde(rename = "_meta")]
    pub meta: Option<PermissionRequestMetaRaw>,
}

#[derive(Debug, Clone, Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct PermissionOptionRaw {
    pub kind: String,
    pub name: String,
    pub option_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct PermissionToolCallRaw {
    pub tool_call_id: Option<String>,
    pub name: Option<String>,
    pub title: Option<String>,
    pub kind: Option<String>,
    #[serde(default)]
    pub raw_input: Value,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct PermissionRequestMetaRaw {
    pub ask_user_question: Option<AskUserQuestionDataRaw>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct AskUserQuestionDataRaw {
    pub questions: Vec<InboundQuestionItemRaw>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct RawInputWithQuestionsRaw {
    pub questions: Vec<InboundQuestionItemRaw>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct InboundQuestionItemRaw {
    pub question: String,
    #[serde(default)]
    pub header: String,
    #[serde(default)]
    pub options: Vec<InboundQuestionOptionRaw>,
    #[serde(default)]
    pub multi_select: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct InboundQuestionOptionRaw {
    pub label: String,
    #[serde(default)]
    pub description: String,
}
