import React, { useState, useEffect } from "react";
import { UploadCloud, CheckCircle2, AlertCircle, Sparkles, FileText, Trash2, Layers, RefreshCw } from "lucide-react";
import PageHeader from "../components/common/PageHeader";
import { uploadDocument, type DocumentUploadResponse } from "../api/documents";
import { getKnowledge, deleteKnowledge, type KnowledgeItem } from "../api/knowledge";

export default function Documents() {
  const [files, setFiles] = useState<File[]>([]);
  const [category, setCategory] = useState("General Knowledge");
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<DocumentUploadResponse[]>([]);
  const [error, setError] = useState("");
  const [knowledgeList, setKnowledgeList] = useState<KnowledgeItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchKnowledge = async () => {
    setLoadingList(true);
    try {
      const items = await getKnowledge(undefined, "all");
      setKnowledgeList(items);
    } catch (err) {
      console.warn("Failed to load knowledge list:", err);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchKnowledge();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...selected]);
      setError("");
      setResults([]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const dropped = Array.from(e.dataTransfer.files);
      setFiles((prev) => [...prev, ...dropped]);
      setError("");
      setResults([]);
    }
  };

  const removeSelectedFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) {
      setError("Please select one or more documents to upload.");
      return;
    }
    setUploading(true);
    setError("");
    setResults([]);

    const uploadResults: DocumentUploadResponse[] = [];
    try {
      for (const file of files) {
        const res = await uploadDocument(file, category.trim() || "General Knowledge");
        uploadResults.push(res);
      }
      setResults(uploadResults);
      setFiles([]);
      await fetchKnowledge();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to upload one or more documents.");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteKnowledge = async (id: number) => {
    setDeletingId(id);
    try {
      await deleteKnowledge(id);
      setKnowledgeList((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error("Failed to delete document:", err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex-1 min-h-screen bg-slate-900 pb-12">
      <PageHeader
        title="Multi-Document Knowledge Base"
        description="Upload any number of documents, brochures, policies, catalogs, or notes. Your AI receptionist analyzes all documents to answer visitor questions."
      />

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Upload Form Card */}
        <form onSubmit={handleUpload} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-400" />
                Upload Documents (Any Topic, Any Format)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Upload single or multiple files at once. All documents will be indexed and accessible to your AI receptionist.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-400">Category Tag (Optional):</label>
              <input
                type="text"
                placeholder="e.g. General, Courses, FAQ, Policies"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-2xl p-8 text-center bg-slate-900/40 transition cursor-pointer flex flex-col items-center justify-center"
          >
            <UploadCloud className="w-12 h-12 text-indigo-400 mb-3" />
            <p className="text-sm font-semibold text-white">
              Drag and drop any documents here, or click to browse
            </p>
            <p className="text-xs text-slate-400 mt-1">Supports PDF, DOCX, TXT, CSV, Markdown, JSON (Upload multiple files at once)</p>
            <label className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition cursor-pointer">
              Choose Documents
              <input type="file" multiple onChange={handleFileChange} className="hidden" accept=".pdf,.docx,.txt,.csv,.md,.json" />
            </label>
          </div>

          {/* Staged files list */}
          {files.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-300">
                Staged for upload ({files.length} {files.length === 1 ? "document" : "documents"}):
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {files.map((f, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-800 bg-slate-900/80 text-xs text-slate-200">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span className="truncate font-medium">{f.name}</span>
                      <span className="text-[10px] text-slate-500 shrink-0">({(f.size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSelectedFile(idx)}
                      className="text-slate-400 hover:text-rose-400 transition p-1"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl border border-red-500/30 bg-red-950/40 text-red-300 text-sm flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {results.length > 0 && (
            <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/40 text-emerald-300 text-sm flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">
                  {results.length} {results.length === 1 ? "Document" : "Documents"} Ingested Successfully!
                </p>
                <p className="text-xs mt-1 text-emerald-400">
                  Total knowledge chunks created: {results.reduce((acc, r) => acc + (r.data.chunks_created || 0), 0)}. Your AI receptionist can now cross-reference and answer questions from all uploaded documents.
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={uploading || files.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-500 disabled:opacity-50 transition"
            >
              <Sparkles className="w-4 h-4" />
              {uploading ? "Ingesting Documents..." : `Ingest ${files.length > 0 ? `${files.length} ` : ""}Document${files.length > 1 ? "s" : ""}`}
            </button>
          </div>
        </form>

        {/* Existing Active Knowledge Documents Catalog */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                Active Knowledge Documents ({knowledgeList.length})
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                All documents currently analyzed by your AI receptionist during chats, voice calls, and inquiries.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchKnowledge}
              disabled={loadingList}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingList ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {loadingList ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading active knowledge documents...</div>
          ) : knowledgeList.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl">
              <p className="text-sm font-semibold text-slate-300">No documents uploaded yet</p>
              <p className="text-xs text-slate-500 mt-1">Upload your documents above to equip the AI receptionist with knowledge.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {knowledgeList.map((doc) => (
                <div key={doc.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded-md bg-indigo-950/80 text-indigo-400 border border-indigo-800/50">
                        {doc.category || "General"}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {doc.chunks?.length || 1} chunks
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-white mt-1.5 truncate" title={doc.title}>
                      {doc.title}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-3 mt-1 leading-relaxed">
                      {doc.content}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-[11px] text-slate-500">
                    <span className="truncate">Source: {doc.source || "Uploaded Document"}</span>
                    <button
                      type="button"
                      disabled={deletingId === doc.id}
                      onClick={() => handleDeleteKnowledge(doc.id)}
                      className="text-slate-400 hover:text-rose-400 transition p-1"
                      title="Delete document"
                    >
                      {deletingId === doc.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
