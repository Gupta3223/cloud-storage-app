import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { upload } from "../middleware/upload.js";
import { uploadFile } from "../controllers/fileController.js";
import File from "../models/File.js";
import Folder from "../models/Folder.js";
import fs from "fs";
import path from "path";

const router = express.Router();

/* ================= RENAME FILE ================= */
router.put("/:id/rename", authMiddleware, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "File name is required" });
    }

    const file = await File.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { name: name.trim() },
      { new: true }
    );

    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }

    res.json(file);
  } catch (err) {
    console.error("Rename file error:", err);
    res.status(500).json({ message: "File rename failed" });
  }
});

/* ================= UPLOAD SINGLE FILE ================= */
router.post("/upload", authMiddleware, upload.single("file"), uploadFile);

/* ================= GET FILES ================= */
router.get("/", authMiddleware, async (req, res) => {
  try {
    const files = await File.find({ userId: req.user.id });
    res.json(files);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch files" });
  }
});

/* ================= MOVE FILE ================= */
router.put("/:id/move", authMiddleware, async (req, res) => {
  try {
    const file = await File.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { folderId: req.body.folderId || null },
      { new: true }
    );

    if (!file) return res.status(404).json({ message: "File not found" });

    res.json(file);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Move failed" });
  }
});

/* ================= DOWNLOAD FILE ================= */
router.get("/:id/download", authMiddleware, async (req, res) => {
  try {
    const file = await File.findOne({ _id: req.params.id, userId: req.user.id });
    if (!file) return res.status(404).json({ message: "File not found" });

    res.download(file.path, file.name);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Download failed" });
  }
});

/* ================= DELETE FILE ================= */
router.delete("/:id", authMiddleware, async (req, res) => {
  const file = await File.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    { isTrashed: true },
    { new: true }
  );

  if (!file) return res.status(404).json({ message: "File not found" });

  res.json({ message: "Moved to Trash" });
});

router.put("/:id/restore", authMiddleware, async (req, res) => {
  const file = await File.findOneAndUpdate(
    {
      _id: req.params.id,
      userId: req.user.id,
      isTrashed: true,
    },
    { isTrashed: false },
    { new: true }
  );

  if (!file) {
    return res
      .status(404)
      .json({ message: "File not found in trash" });
  }

  res.json(file);
});

router.delete("/:id/permanent", authMiddleware, async (req, res) => {
  const file = await File.findOneAndDelete({
    _id: req.params.id,
    userId: req.user.id,
  });

  if (!file) return res.status(404).json({ message: "File not found" });

  fs.unlink(file.path, () => {});
  res.json({ message: "Deleted permanently" });
});

/* ================= DELETE FOLDER RECURSIVELY ================= */
const deleteFolderRecursive = async (folderId, userId) => {
  // 1️⃣ Delete all files in this folder
  const files = await File.find({ folderId, userId });
  for (const file of files) {
    fs.unlink(file.path, (err) => {
      if (err) console.error("Failed to delete file from disk:", err);
    });
  }
  await File.deleteMany({ folderId, userId });

  // 2️⃣ Find subfolders
  const subfolders = await Folder.find({ parentFolder: folderId, userId });
  for (const sub of subfolders) {
    await deleteFolderRecursive(sub._id, userId);
  }

  // 3️⃣ Delete folder itself
  await Folder.deleteOne({ _id: folderId, userId });
};

// DELETE FOLDER ENDPOINT
router.delete("/folder/:id", authMiddleware, async (req, res) => {
  try {
    const folderId = req.params.id;
    const userId = req.user.id;

    const folder = await Folder.findOne({ _id: folderId, userId });
    if (!folder) return res.status(404).json({ message: "Folder not found" });

    await deleteFolderRecursive(folderId, userId);

    res.json({ message: "Folder and all its contents deleted successfully" });
  } catch (err) {
    console.error("Delete folder error:", err);
    res.status(500).json({ message: "Failed to delete folder" });
  }
});

export default router;  
