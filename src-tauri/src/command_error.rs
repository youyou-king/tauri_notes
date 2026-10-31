use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandError {
    pub code: &'static str,
    pub message: String,
}

impl CommandError {
    pub fn failed(message: impl Into<String>) -> Self {
        Self {
            code: "COMMAND_FAILED",
            message: message.into(),
        }
    }
}

impl From<String> for CommandError {
    fn from(message: String) -> Self {
        Self::failed(message)
    }
}
