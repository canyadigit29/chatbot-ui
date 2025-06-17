"use client";
import React, { useState } from "react";

// TODO: Set this to your deployed backend URL on Railway
const BACKEND_URL = process.env.NEXT_PUBLIC_LLAMAINDEX_BACKEND_URL || "";

export default function AdminPage() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queryResult, setQueryResult] = useState<string | null>(null);
  const [query, setQuery] = useState<string>("");
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [reindexMessage, setReindexMessage] = useState<string | null>(null);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [indices, setIndices] = useState<string[] | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/admin/status`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStatus(data);
    } catch (err: any) {
      setError(err.message || "Unknown error");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const handleQuery = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question: query }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setQueryResult(data.answer);
    } catch (err: any) {
      setError(err.message || "Unknown error");
      setQueryResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${BACKEND_URL}/upload`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setUploadMessage(data.message);
    } catch (err: any) {
      setError(err.message || "Unknown error");
      setUploadMessage(null);
    } finally {
      setLoading(false);
    }
  };

  const handleReindex = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/reindex`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setReindexMessage(data.message);
    } catch (err: any) {
      setError(err.message || "Unknown error");
      setReindexMessage(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteIndex = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/delete_index`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDeleteMessage(data.message);
    } catch (err: any) {
      setError(err.message || "Unknown error");
      setDeleteMessage(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchIndices = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/list_indices`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setIndices(data.indices);
    } catch (err: any) {
      setError(err.message || "Unknown error");
      setIndices(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 32 }}>
      <h1>Admin Panel</h1>
      <button onClick={fetchStatus} disabled={loading} style={{ marginBottom: 16 }}>
        {loading ? "Loading..." : "Check Backend Status"}
      </button>
      {error && <div style={{ color: "red" }}>Error: {error}</div>}
      {status && (
        <pre style={{ background: "#eee", padding: 16, borderRadius: 8 }}>
          {JSON.stringify(status, null, 2)}
        </pre>
      )}

      <div style={{ marginTop: 32 }}>
        <h2>Query the Index</h2>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter your question"
          style={{ width: "100%", marginBottom: 16, padding: 8 }}
        />
        <button onClick={handleQuery} disabled={loading || !query}>
          {loading ? "Loading..." : "Submit Query"}
        </button>
        {queryResult && (
          <div style={{ marginTop: 16, background: "#eee", padding: 16, borderRadius: 8 }}>
            <strong>Answer:</strong> {queryResult}
          </div>
        )}
      </div>

      <div style={{ marginTop: 32 }}>
        <h2>Upload File</h2>
        <input
          type="file"
          onChange={(e) => e.target.files && handleUpload(e.target.files[0])}
          style={{ marginBottom: 16 }}
        />
        {uploadMessage && <div style={{ marginTop: 16 }}>{uploadMessage}</div>}
      </div>

      <div style={{ marginTop: 32 }}>
        <h2>Reindex</h2>
        <button onClick={handleReindex} disabled={loading}>
          {loading ? "Loading..." : "Reindex"}
        </button>
        {reindexMessage && <div style={{ marginTop: 16 }}>{reindexMessage}</div>}
      </div>

      <div style={{ marginTop: 32 }}>
        <h2>Delete Index</h2>
        <button onClick={handleDeleteIndex} disabled={loading}>
          {loading ? "Loading..." : "Delete Index"}
        </button>
        {deleteMessage && <div style={{ marginTop: 16 }}>{deleteMessage}</div>}
      </div>

      <div style={{ marginTop: 32 }}>
        <h2>List Indices</h2>
        <button onClick={fetchIndices} disabled={loading}>
          {loading ? "Loading..." : "Refresh Indices"}
        </button>
        {indices && (
          <ul style={{ marginTop: 16 }}>
            {indices.map((index) => (
              <li key={index}>{index}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
