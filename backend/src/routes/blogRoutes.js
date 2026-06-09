import { Router } from "express";
import {
  getBlogs,
  getMyBlogs,
  getBlogById,
  createBlog,
  updateBlog,
  deleteBlog,
  toggleLike,
} from "../controllers/blogController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();
// Public routes - anyone can view blogs
router.get("/", getBlogs);
// Protected routes - only logged in users
router.get("/mine", protect, getMyBlogs);
router.get("/:id", getBlogById);
router.post("/", protect, createBlog);
router.put("/:id", protect, updateBlog);
router.delete("/:id", protect, deleteBlog);
router.patch("/:id/like", protect, toggleLike);
export default router;
