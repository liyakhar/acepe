use crate::acp::parsers::{get_parser, AgentType};
use crate::acp::session_update::{
    build_tool_call_from_raw, InteractionReplyHandler, PermissionData, QuestionData, QuestionItem,
    QuestionOption, RawToolCallInput, SessionUpdate, ToolCallStatus, ToolReference,
};
use crate::acp::streaming_log::log_streaming_event;
use crate::acp::tool_classification::{resolve_raw_tool_identity, ToolClassificationHints};
use serde_json::{json, Value};

use super::helpers::{
    build_permission_request_log_payload, parse_params, parse_permission_tool_arguments,
};
use super::types::{
    InboundQuestionItemRaw, PermissionOptionRaw, PermissionRequestMetaRaw, PermissionToolCallRaw,
    RawInputWithQuestionsRaw, SessionRequestPermissionParamsRaw,
};
use super::{InboundRoutingDecision, SyntheticToolCallContext};

pub(super) async fn handle_session_request_permission(
    params: &Value,
    request_id: u64,
    agent_type: AgentType,
) -> InboundRoutingDecision {
    let parsed: SessionRequestPermissionParamsRaw = match parse_params(params) {
        Ok(parsed) => parsed,
        Err(_) => {
            return InboundRoutingDecision::ForwardToUi {
                parsed_arguments: None,
                synthetic_tool_call: None,
                canonical_interaction: None,
                forward_legacy_event: true,
            };
        }
    };

    let SessionRequestPermissionParamsRaw {
        session_id,
        options,
        tool_call,
        meta,
    } = parsed;

    let tool_call = match tool_call {
        Some(tool_call) => tool_call,
        None => {
            return InboundRoutingDecision::ForwardToUi {
                parsed_arguments: None,
                synthetic_tool_call: None,
                canonical_interaction: None,
                forward_legacy_event: true,
            };
        }
    };

    let parser = get_parser(agent_type);
    let tool_call_id = normalized_tool_call_id(&tool_call, request_id);
    let identity = resolve_raw_tool_identity(
        parser,
        &tool_call_id,
        Some(&tool_call.raw_input),
        ToolClassificationHints {
            name: tool_call.name.as_deref(),
            title: tool_call.title.as_deref(),
            kind: tool_call
                .kind
                .as_deref()
                .map(|kind| parser.detect_tool_kind(kind)),
            kind_hint: tool_call.kind.as_deref(),
            locations: None,
        },
    );
    let parsed_arguments = parse_permission_tool_arguments(
        &tool_call_id,
        tool_call.name.as_deref(),
        tool_call.title.as_deref(),
        tool_call.raw_input.clone(),
        tool_call.kind.as_deref(),
        agent_type,
    );

    if let Some(session_id) = session_id.as_deref() {
        let payload = build_permission_request_log_payload(
            "session/request_permission",
            params,
            tool_call.name.as_deref(),
            tool_call.title.as_deref(),
            parsed_arguments.as_ref(),
            false,
            None,
        );
        log_streaming_event(session_id, &payload);
    }

    // Build ToolCallData via the same pipeline as normal tool_call events.
    let synthetic_tool_call = match session_id.as_deref() {
        Some(_) => {
            let raw = RawToolCallInput {
                id: tool_call_id.clone(),
                name: identity.name.clone(),
                arguments: tool_call.raw_input.clone(),
                status: ToolCallStatus::InProgress,
                kind: Some(identity.kind),
                title: tool_call.title.clone(),
                suppress_title_read_path_hint: false,
                parent_tool_use_id: None,
                task_children: None,
            };
            let tool_call_data = build_tool_call_from_raw(parser, raw);
            Some(Box::new(SyntheticToolCallContext { tool_call_data }))
        }
        None => None,
    };

    let canonical_interaction = session_id.as_deref().and_then(|session_id| {
        build_canonical_interaction(
            session_id,
            request_id,
            &tool_call,
            &tool_call_id,
            parsed_arguments.as_ref(),
            &options,
            meta.as_ref(),
        )
    });

    InboundRoutingDecision::ForwardToUi {
        parsed_arguments,
        synthetic_tool_call,
        canonical_interaction,
        forward_legacy_event: false,
    }
}

fn normalized_tool_call_id(tool_call: &PermissionToolCallRaw, request_id: u64) -> String {
    tool_call
        .tool_call_id
        .clone()
        .unwrap_or_else(|| format!("permission-request-{request_id}"))
}

fn normalized_tool_label(tool_call: &PermissionToolCallRaw) -> String {
    tool_call
        .title
        .clone()
        .or_else(|| tool_call.name.clone())
        .unwrap_or_else(|| "Execute tool".to_string())
}

fn build_permission_id(session_id: &str, tool_call_id: &str, request_id: u64) -> String {
    format!("{session_id}\u{0}{tool_call_id}\u{0}{request_id}")
}

fn build_canonical_interaction(
    session_id: &str,
    request_id: u64,
    tool_call: &PermissionToolCallRaw,
    tool_call_id: &str,
    parsed_arguments: Option<&Value>,
    options: &[PermissionOptionRaw],
    meta: Option<&PermissionRequestMetaRaw>,
) -> Option<SessionUpdate> {
    if let Some(question) =
        build_question_update(session_id, request_id, tool_call, tool_call_id, meta)
    {
        return Some(question);
    }

    Some(SessionUpdate::PermissionRequest {
        permission: PermissionData {
            id: build_permission_id(session_id, tool_call_id, request_id),
            session_id: session_id.to_string(),
            json_rpc_request_id: Some(request_id),
            reply_handler: Some(InteractionReplyHandler::json_rpc(request_id)),
            permission: normalized_tool_label(tool_call),
            patterns: Vec::new(),
            metadata: json!({
                "rawInput": tool_call.raw_input.clone(),
                "parsedArguments": parsed_arguments.cloned(),
                "options": options,
            }),
            always: options
                .iter()
                .filter(|option| option.kind == "allow_always")
                .map(|option| option.option_id.clone())
                .collect(),
            tool: Some(ToolReference {
                message_id: String::new(),
                call_id: tool_call_id.to_string(),
            }),
        },
        session_id: Some(session_id.to_string()),
    })
}

fn build_question_update(
    session_id: &str,
    request_id: u64,
    tool_call: &PermissionToolCallRaw,
    tool_call_id: &str,
    meta: Option<&PermissionRequestMetaRaw>,
) -> Option<SessionUpdate> {
    let questions = extract_questions(tool_call, meta)?;
    Some(SessionUpdate::QuestionRequest {
        question: QuestionData {
            id: tool_call_id.to_string(),
            session_id: session_id.to_string(),
            json_rpc_request_id: Some(request_id),
            reply_handler: Some(InteractionReplyHandler::json_rpc(request_id)),
            questions,
            tool: Some(ToolReference {
                message_id: String::new(),
                call_id: tool_call_id.to_string(),
            }),
        },
        session_id: Some(session_id.to_string()),
    })
}

fn extract_questions(
    tool_call: &PermissionToolCallRaw,
    meta: Option<&PermissionRequestMetaRaw>,
) -> Option<Vec<QuestionItem>> {
    if let Some(ask_user_question) = meta.and_then(|meta| meta.ask_user_question.as_ref()) {
        return Some(normalize_question_items(&ask_user_question.questions));
    }

    let is_ask_user_question = tool_call
        .name
        .as_deref()
        .or(tool_call.title.as_deref())
        .is_some_and(|value| value.eq_ignore_ascii_case("AskUserQuestion"));
    if !is_ask_user_question {
        return None;
    }

    let raw_input =
        serde_json::from_value::<RawInputWithQuestionsRaw>(tool_call.raw_input.clone()).ok()?;
    Some(normalize_question_items(&raw_input.questions))
}

fn normalize_question_items(questions: &[InboundQuestionItemRaw]) -> Vec<QuestionItem> {
    questions
        .iter()
        .map(|question| QuestionItem {
            question: question.question.clone(),
            header: question.header.clone(),
            options: question
                .options
                .iter()
                .map(|option| QuestionOption {
                    label: option.label.clone(),
                    description: option.description.clone(),
                })
                .collect(),
            multi_select: question.multi_select,
        })
        .collect()
}
