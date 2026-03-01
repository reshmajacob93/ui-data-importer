import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8001",
});

// Step 6 — POST /upload: parse file → { file_type, columns, preview }
export const uploadFile = (file) => {
  const form = new FormData();
  form.append("file", file);
  return api.post("/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

// Step 7 — POST /ai/detect-schema: identify which master entity the file is
export const detectSchema = (columns, rows) =>
  api.post("/ai/detect-schema", { columns, rows: rows.slice(0, 3) });

// Step 8 — POST /ai/map-columns: AI column → schema field mapping
export const mapColumns = (columns, rows, schemaOverride = null) =>
  api.post("/ai/map-columns", {
    columns,
    rows,
    schema_override: schemaOverride,
  });

// Step 9 — POST /validate: rule-based validation (no AI)
export const validateRows = (rows, columnMapping, schemaName, numericFields = []) =>
  api.post("/validate", {
    rows,
    column_mapping: columnMapping,
    schema_name: schemaName,
    numeric_fields: numericFields,
  });

// Step 10 — POST /ai/analyse: validate values + build DB-ready JSON
export const analyseData = (columns, rows, schemaOverride, validateRows = true) =>
  api.post("/ai/analyse", {
    columns,
    rows,
    schema_override: schemaOverride,
    validate_rows: validateRows,
    max_validate_rows: 50,
  });

// GET /schemas — list all available schema names
export const listSchemas = () => api.get("/schemas");

export default api;
