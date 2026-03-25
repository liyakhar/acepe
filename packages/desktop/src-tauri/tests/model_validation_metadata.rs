use std::fs;

use acepe_lib::voice::models::validate_model_file;
use acepe_lib::voice::models_validation::validation_metadata_path;

#[test]
fn validate_model_file_writes_validation_metadata_sidecar() {
    let temp_dir = tempfile::tempdir().expect("temp dir");
    let model_path = temp_dir.path().join("ggml-small.en.bin");
    let source_path =
        "/Users/alex/Documents/acepe/packages/desktop/src-tauri/test-data/voice/ggml-small.en.bin";
    fs::copy(source_path, &model_path).expect("copy fixture model");

    validate_model_file("small.en", &model_path).expect("validate model");

    let metadata_path = validation_metadata_path(&model_path).expect("metadata path");
    assert!(metadata_path.exists());
}
