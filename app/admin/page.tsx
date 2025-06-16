"use client";
import React, { useState } from "react";

// TODO: Set this to your deployed backend URL on Railway
const BACKEND_URL = process.env.NEXT_PUBLIC_LLAMAINDEX_BACKEND_URL || "http://localhost:8000";

export default function AdminPage() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    </div>
  );
}
