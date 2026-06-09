import { useState, useEffect } from "react";
import DoctorLayout from "./components/DoctorLayout";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const statusColors = {
  published: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  draft: "bg-gray-100 text-gray-500",
  flagged: "bg-red-100 text-red-700",
};

function Toast({ message, type, onClose }) {
  return (
    <div
      className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl text-white text-sm font-semibold
      ${type === "success" ? "bg-emerald-600" : type === "error" ? "bg-red-600" : "bg-[#0D7377]"}`}
    >
      <span className="material-symbols-outlined text-lg">
        {type === "success" ? "check_circle" : type === "error" ? "cancel" : "article"}
      </span>
      {message}
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100">
        <span className="material-symbols-outlined text-base">close</span>
      </button>
    </div>
  );
}

function BlogFormModal({ initial, onClose, onSave }) {
  const [form, setForm] = useState(
    initial || { title: "", category: "General", content: "", status: "published" }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const update = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      setError("Title and content are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(form);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-50">
          <h3 className="text-lg font-bold text-gray-800">
            {initial ? "Edit Post" : "Write New Post"}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-6 space-y-4">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-xl">{error}</p>
          )}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5 block">
              Title
            </label>
            <input
              className="w-full bg-[#f0fafa] border-none rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200"
              placeholder="Post title..."
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5 block">
              Category
            </label>
            <select
              className="w-full bg-[#f0fafa] border-none rounded-xl px-4 py-3 text-sm focus:outline-none"
              value={form.category}
              onChange={(e) => update("category", e.target.value)}
            >
              {["General", "Cardiology", "Diabetes", "Neurology", "Technology", "Nutrition", "Mental Health"].map(
                (c) => <option key={c}>{c}</option>
              )}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5 block">
              Content
            </label>
            <textarea
              className="w-full bg-[#f0fafa] border-none rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200 resize-none h-40"
              placeholder="Write your post content here..."
              value={form.content}
              onChange={(e) => update("content", e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5 block">
              Publish As
            </label>
            <div className="flex gap-3">
              {["published", "draft"].map((s) => (
                <button
                  key={s}
                  onClick={() => update("status", s)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold capitalize transition-colors ${
                    form.status === s
                      ? "bg-[#0D7377] text-white"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {s === "published" ? "Publish Now" : "Save as Draft"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-100 text-gray-600 rounded-xl font-semibold text-sm hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-4 py-3 bg-[#0D7377] text-white rounded-xl font-bold text-sm hover:bg-teal-800 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : form.status === "published" ? "Publish" : "Save Draft"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DoctorBlogs() {
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingBlog, setEditingBlog] = useState(null);
  const [deletingBlog, setDeletingBlog] = useState(null);
  const [toast, setToast] = useState(null);

  const getHeaders = () => {
    const token = localStorage.getItem("token");
    return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  };

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchBlogs = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/blogs/mine`, { headers: getHeaders() });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setFetchError(err.message || `Error ${res.status}: failed to load your blogs.`);
        return;
      }
      setFetchError("");
      const data = await res.json();
      setBlogs(
        data.map((b) => ({
          id: b._id,
          title: b.title,
          category: b.category || "General",
          content: b.content,
          date: b.published_at
            ? new Date(b.published_at).toISOString().split("T")[0]
            : new Date(b.createdAt).toISOString().split("T")[0],
          status: b.status || "published",
          likes: b.likes?.length || 0,
        }))
      );
    } catch (err) {
      setFetchError("Network error — could not reach the server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBlogs(); }, []);

  if (loading)
    return (
      <DoctorLayout title="My Blogs">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-[#0D7377] border-t-transparent rounded-full animate-spin"></div>
        </div>
      </DoctorLayout>
    );

  if (fetchError)
    return (
      <DoctorLayout title="My Blogs">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <span className="material-symbols-outlined text-5xl text-red-300">error</span>
          <p className="text-red-500 font-semibold text-center">{fetchError}</p>
          <button
            onClick={() => { setLoading(true); setFetchError(""); fetchBlogs(); }}
            className="px-5 py-2 bg-[#0D7377] text-white rounded-xl font-bold text-sm hover:bg-teal-800 transition-colors"
          >
            Retry
          </button>
        </div>
      </DoctorLayout>
    );

  const filtered = blogs.filter((b) => activeTab === "all" || b.status === activeTab);

  const handleCreate = async (form) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/blogs`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ title: form.title, content: form.content, category: form.category, status: form.status }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to create blog");
      }
      setShowCreateModal(false);
      showToast(`"${form.title}" ${form.status === "published" ? "published" : "saved as draft"}.`);
      fetchBlogs();
    } catch (err) {
      showToast(err.message, "error");
      throw err;
    }
  };

  const handleEdit = async (form) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/blogs/${editingBlog.id}`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify({ title: form.title, content: form.content, category: form.category, status: form.status }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to update blog");
      }
      setEditingBlog(null);
      showToast(`"${form.title}" updated.`);
      fetchBlogs();
    } catch (err) {
      showToast(err.message, "error");
      throw err;
    }
  };

  const handleDeleteConfirm = async () => {
    const blog = deletingBlog;
    setDeletingBlog(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/blogs/${blog.id}`, {
        method: "DELETE",
        headers: getHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to delete blog");
      }
      showToast(`"${blog.title}" deleted.`, "error");
      fetchBlogs();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  return (
    <DoctorLayout title="My Blogs">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {showCreateModal && (
        <BlogFormModal onClose={() => setShowCreateModal(false)} onSave={handleCreate} />
      )}

      {editingBlog && (
        <BlogFormModal
          initial={editingBlog}
          onClose={() => setEditingBlog(null)}
          onSave={handleEdit}
        />
      )}

      {deletingBlog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <span className="material-symbols-outlined text-4xl text-red-400 mb-3 block">delete</span>
            <h3 className="text-lg font-bold text-gray-800 mb-1">Delete Post?</h3>
            <p className="text-sm text-gray-500 mb-6">
              "{deletingBlog.title}" will be permanently removed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingBlog(null)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-semibold text-sm hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-black text-[#0D7377]">My Blogs</h2>
          <p className="text-gray-400 mt-1">Share your medical knowledge with patients</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#0D7377] to-[#14A085] text-white rounded-full font-bold shadow-lg shadow-teal-200 hover:shadow-purple-400 hover:scale-105 transition-all"
        >
          <span className="material-symbols-outlined text-sm">edit</span>
          Write New Post
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-8">
        {[
          { label: "Published", value: blogs.filter((b) => b.status === "published").length, color: "text-emerald-600", bg: "bg-white" },
          { label: "Drafts", value: blogs.filter((b) => b.status === "draft").length, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Total Likes", value: blogs.reduce((sum, b) => sum + b.likes, 0), color: "text-[#0D7377]", bg: "bg-white" },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} p-6 rounded-2xl shadow-sm`}>
            <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-50 flex gap-2 flex-wrap">
          {["all", "published", "draft"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-full text-sm font-bold capitalize transition-colors ${
                activeTab === tab ? "bg-[#0D7377] text-white" : "text-gray-400 hover:bg-[#f0fafa]"
              }`}
            >
              {tab === "all" ? "All Posts" : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.length === 0 ? (
            <div className="col-span-3 py-16 text-center">
              <span className="material-symbols-outlined text-5xl text-gray-200 block mb-3">article</span>
              <p className="text-gray-400 font-medium">No posts in this category.</p>
            </div>
          ) : (
            filtered.map((blog) => (
              <div key={blog.id} className="bg-[#f0fafa] rounded-2xl p-5 flex flex-col gap-3">
                <div className="w-full h-32 bg-gradient-to-br from-[#0D7377]/20 to-[#600f72]/10 rounded-xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-4xl text-[#0D7377]/30">article</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 bg-white text-[#0D7377] text-xs font-bold rounded-full">{blog.category}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusColors[blog.status]}`}>{blog.status}</span>
                </div>
                <h4 className="font-bold text-gray-800 text-sm leading-snug">{blog.title}</h4>
                <p className="text-xs text-gray-400">{blog.date}</p>
                <div className="flex items-center justify-between mt-auto pt-2 border-t border-white">
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <span className="material-symbols-outlined text-sm">favorite</span>
                    {blog.likes.toLocaleString()}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setEditingBlog(blog)}
                      className="p-1.5 text-gray-400 hover:bg-white rounded-lg transition-colors"
                      title="Edit"
                    >
                      <span className="material-symbols-outlined text-lg">edit</span>
                    </button>
                    <button
                      onClick={() => setDeletingBlog(blog)}
                      className="p-1.5 text-red-500 hover:bg-white rounded-lg transition-colors"
                      title="Delete"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </DoctorLayout>
  );
}
