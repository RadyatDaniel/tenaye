import mongoose from "mongoose";

const blogSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: { type: String, required: true },
    content: { type: String, required: true },
    category: { type: String, default: "General" },
    cover_image_url: { type: String },
    status: { type: String, enum: ["published", "draft", "pending", "flagged"], default: "published" },
    rejection_reason: { type: String },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    published_at: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export default mongoose.model("Blog", blogSchema);
