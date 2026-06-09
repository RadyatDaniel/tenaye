import Blog from "../models/Blog.js";

export const getBlogs = async (req, res) => {
  try {
    const blogs = await Blog.find({ $or: [{ status: "published" }, { status: { $exists: false } }] })
      .populate("author", "full_name avatar_url")
      .sort({ published_at: -1 });
    res.json(blogs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getMyBlogs = async (req, res) => {
  try {
    const blogs = await Blog.find({ author: req.user._id })
      .populate("author", "full_name avatar_url")
      .sort({ createdAt: -1 });
    res.json(blogs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getBlogById = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id).populate(
      "author",
      "full_name avatar_url",
    );
    if (!blog) return res.status(404).json({ message: "Blog not found" });
    res.json(blog);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const createBlog = async (req, res) => {
  try {
    const blog = await Blog.create({ ...req.body, author: req.user._id });
    res.status(201).json(blog);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ message: "Blog not found" });
    
    // Only author or admin can update
    if (blog.author.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized to update this blog" });
    }
    
    const update = { ...req.body };
    if (req.body.status === "published" && blog.status !== "published") {
      update.published_at = new Date();
    }
    const updated = await Blog.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true, runValidators: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deleteBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ message: "Blog not found" });

    // Only author or admin can delete
    if (blog.author.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized to delete this blog" });
    }

    await Blog.findByIdAndDelete(req.params.id);
    res.json({ message: "Blog deleted successfully" });
  } catch (err) {
    if (err.name === "CastError" && err.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid blog ID format" });
    }
    res.status(500).json({ message: err.message });
  }
};

export const toggleLike = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    const liked = blog.likes.includes(req.user._id);
    liked ? blog.likes.pull(req.user._id) : blog.likes.push(req.user._id);
    await blog.save();
    res.json({ likes: blog.likes.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
